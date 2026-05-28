// Supabase Edge Function — agent "Léa"
// Anthropic Messages API : prompt caching (system = config stable, mis en cache)
// + tool use (qualify_lead, update_lead_status, create_lead, escalate_to_human, get_active_events).
// Modèle : claude-sonnet-4-6 (dernier Sonnet ; caching/effort/adaptive thinking en GA).

import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOOL_TURNS = 6;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

// ── Types ───────────────────────────────────────────────────────────
type ChatMsg = { from: "client" | "ai" | "human"; text: string; at: string };
type ApiMessage = { role: "user" | "assistant"; content: unknown };

// ── Outils exposés au modèle ────────────────────────────────────────
const TOOLS = [
  {
    name: "qualify_lead",
    description:
      "Enregistre les informations qualifiées du prospect (score d'intérêt, offre visée, occasion, nombre de personnes, date souhaitée). À appeler dès que tu collectes ces éléments au fil de la conversation.",
    input_schema: {
      type: "object",
      properties: {
        score: { type: "integer", minimum: 0, maximum: 10, description: "Intérêt estimé 0-10" },
        interested_offer: { type: "string", description: "Offre visée (ex. 'Sortie privative 3h', 'Nuit Prestige')" },
        occasion: { type: "string", description: "Occasion (anniversaire, EVJF, demande en mariage…)" },
        party_size: { type: "integer", minimum: 1, description: "Nombre de personnes" },
        desired_date: { type: "string", description: "Date souhaitée au format YYYY-MM-DD" },
        desired_time_slot: { type: "string", description: "Créneau (matin, après-midi, coucher de soleil…)" },
      },
    },
  },
  {
    name: "update_lead_status",
    description:
      "Met à jour l'étape du prospect dans le pipeline. Utilise 'contacted' au 1er échange, 'qualified' une fois les besoins clairs, 'quote_sent' si tu as communiqué un prix, 'lost' si le prospect se désiste.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["new", "contacted", "qualified", "quote_sent", "followed_up", "booked", "lost"],
        },
      },
      required: ["status"],
    },
  },
  {
    name: "create_lead",
    description:
      "Crée une fiche prospect si elle n'existe pas encore (nouveau contact). Appelle-le une seule fois, dès que tu as au moins un prénom ou un téléphone.",
    input_schema: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        phone: { type: "string" },
        interested_offer: { type: "string" },
        occasion: { type: "string" },
        party_size: { type: "integer" },
        source_channel: {
          type: "string",
          enum: ["instagram_organic", "instagram_ads", "tiktok_organic", "tiktok_ads", "meta_ads", "whatsapp", "email", "website", "phone", "word_of_mouth", "other"],
        },
      },
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Transfère à l'équipe humaine. À utiliser pour : Nuit Prestige le week-end, demande de négociation, PMR, cas hors de tes connaissances, ou toute situation ambiguë/sensible.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string", description: "Raison courte de l'escalade" } },
      required: ["reason"],
    },
  },
  {
    name: "get_active_events",
    description: "Liste les événements publics à venir (soirées, brunchs en mer…) pour pouvoir y rediriger le prospect.",
    input_schema: { type: "object", properties: {} },
  },
];

// ── Construction du system prompt (partie stable mise en cache) ──────
function buildStableSystem(config: Record<string, unknown>): string {
  return `Tu es Léa, l'assistante commerciale de Harmonie Yacht, location de yacht privatif au départ de Carnon (Hérault). Tu réponds sur WhatsApp/Instagram.

# Personnalité & style
- Chaleureuse, élégante, efficace. Vouvoiement. Messages courts façon messagerie (1-4 phrases), avec un emoji occasionnel et pertinent.
- Tu vends avec goût : tu écoutes le besoin, tu recommandes l'offre adaptée, tu crées l'envie sans forcer.
- Tu ne te présentes JAMAIS comme une IA ou un robot. Tu es Léa de Harmonie Yacht.

# Règles strictes
- N'invente JAMAIS d'information. Si une donnée n'est pas dans ta base de connaissances ci-dessous, dis que tu te renseignes et escalade si besoin.
- Pas de négociation sur les prix. Applique automatiquement la réduction matinée -10% si départ avant 11h. Pour toute demande de remise, esquive poliment ou propose une offre plus courte.
- Nuit Prestige le week-end (ven/sam/dim) → escalade humaine obligatoire.
- Ne mentionne le skipper optionnel QUE si le client le demande explicitement.
- Mentionne OBLIGATOIREMENT en confirmation que le retard empiète sur la durée du créneau.
- En cas de doute, de sujet sensible (PMR, météo, demande spéciale) ou hors de tes connaissances → utilise escalate_to_human.

# Utilisation des outils (côté serveur, invisible pour le client)
- create_lead : dès qu'un nouveau contact te donne prénom ou téléphone (si la fiche n'existe pas déjà).
- qualify_lead : au fil de l'eau, dès que tu apprends offre/occasion/nb de personnes/date/score.
- update_lead_status : fais avancer le pipeline (contacted → qualified → quote_sent…).
- get_active_events : si le client demande des événements / soirées publiques.
- escalate_to_human : selon les règles ci-dessus.
Continue toujours à répondre naturellement au client APRÈS avoir utilisé un outil.

# Base de connaissances (faits — source de vérité)
${JSON.stringify(config, null, 2)}`;
}

function buildDynamicSystem(lead: Record<string, unknown> | null, nowIso: string): string {
  const ctx = lead
    ? `Fiche prospect en cours : ${JSON.stringify({
        id: lead.id,
        prénom: lead.first_name,
        statut: lead.status,
        offre: lead.interested_offer,
        occasion: lead.occasion,
        personnes: lead.party_size,
        date_souhaitée: lead.desired_date,
        score: lead.score,
      })}`
    : "Aucune fiche prospect connue pour ce contact (nouveau lead potentiel — pense à create_lead).";
  return `Date et heure actuelles : ${nowIso} (Europe/Paris).\n${ctx}`;
}

// ── Exécution des outils côté Supabase ──────────────────────────────
async function runTool(
  supabase: ReturnType<typeof createClient>,
  name: string,
  input: Record<string, unknown>,
  state: { leadId: string | null; escalated: boolean },
): Promise<string> {
  const now = new Date().toISOString();
  switch (name) {
    case "create_lead": {
      if (state.leadId) return `Fiche déjà existante (id ${state.leadId}).`;
      const { data, error } = await supabase
        .from("leads")
        .insert({
          first_name: (input.first_name as string) ?? null,
          phone: (input.phone as string) ?? null,
          interested_offer: (input.interested_offer as string) ?? null,
          occasion: (input.occasion as string) ?? null,
          party_size: (input.party_size as number) ?? null,
          source_channel: (input.source_channel as string) ?? "whatsapp",
          source_status: "to_ask",
          status: "contacted",
          last_interaction_at: now,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      if (error) return `Erreur création: ${error.message}`;
      state.leadId = data.id as string;
      return `Fiche créée (id ${data.id}).`;
    }
    case "qualify_lead": {
      if (!state.leadId) return "Aucune fiche à mettre à jour — appelle create_lead d'abord.";
      const patch: Record<string, unknown> = { updated_at: now, last_interaction_at: now };
      for (const k of ["score", "interested_offer", "occasion", "party_size", "desired_date", "desired_time_slot"]) {
        if (input[k] !== undefined && input[k] !== null) patch[k] = input[k];
      }
      const { error } = await supabase.from("leads").update(patch).eq("id", state.leadId);
      return error ? `Erreur: ${error.message}` : "Informations enregistrées.";
    }
    case "update_lead_status": {
      if (!state.leadId) return "Aucune fiche à mettre à jour.";
      const { error } = await supabase
        .from("leads")
        .update({ status: input.status, updated_at: now, last_interaction_at: now })
        .eq("id", state.leadId);
      return error ? `Erreur: ${error.message}` : `Statut mis à jour : ${input.status}.`;
    }
    case "escalate_to_human": {
      state.escalated = true;
      if (state.leadId) {
        await supabase
          .from("leads")
          .update({ needs_human_intervention: true, updated_at: now })
          .eq("id", state.leadId);
      }
      return `Escalade enregistrée (raison: ${input.reason ?? "—"}). L'équipe humaine prendra le relais.`;
    }
    case "get_active_events": {
      const today = now.slice(0, 10);
      const { data, error } = await supabase
        .from("events_public")
        .select("title, theme, date, start_time, end_time, price_per_person, max_participants, current_bookings")
        .eq("status", "published")
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(10);
      if (error) return `Erreur: ${error.message}`;
      return data && data.length ? JSON.stringify(data) : "Aucun événement public à venir.";
    }
    default:
      return `Outil inconnu: ${name}`;
  }
}

// ── Appel Anthropic (un tour) ───────────────────────────────────────
async function callAnthropic(system: unknown[], messages: ApiMessage[]) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system,
      tools: TOOLS,
      messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Anthropic ${res.status}: ${detail}`);
  }
  return await res.json();
}

// ── Handler ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY manquante (secret Supabase)" }, 500);

  let body: { message?: string; lead_id?: string; phone?: string; history?: ChatMsg[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON invalide" }, 400);
  }
  const userText = (body.message ?? "").trim();
  if (!userText) return json({ error: "Champ 'message' requis" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Config (source de vérité, mise en cache côté Anthropic)
  const { data: config, error: cfgErr } = await supabase
    .from("agent_config")
    .select("offers, options, faq, business_hours, auto_followup_enabled, max_followups, morning_discount_percent, weekend_nuit_prestige_contact")
    .limit(1)
    .single();
  if (cfgErr || !config) return json({ error: `agent_config introuvable: ${cfgErr?.message}` }, 500);

  // Contexte lead
  let lead: Record<string, unknown> | null = null;
  if (body.lead_id) {
    const { data } = await supabase.from("leads").select("*").eq("id", body.lead_id).maybeSingle();
    lead = data;
  } else if (body.phone) {
    const { data } = await supabase.from("leads").select("*").eq("phone", body.phone).maybeSingle();
    lead = data;
  }
  const state = { leadId: (lead?.id as string) ?? null, escalated: false };

  // Historique → messages API
  const history: ChatMsg[] = body.history ?? [];
  const messages: ApiMessage[] = history.map((m) => ({
    role: m.from === "client" ? "user" : "assistant",
    content: m.text,
  }));
  messages.push({ role: "user", content: userText });

  // System : bloc stable (caché) + bloc dynamique
  const nowIso = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  const system = [
    { type: "text", text: buildStableSystem(config), cache_control: { type: "ephemeral" } },
    { type: "text", text: buildDynamicSystem(lead, nowIso) },
  ];

  // Boucle tool_use / tool_result
  let reply = "";
  const usedTools: string[] = [];
  try {
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const data = await callAnthropic(system, messages);
      messages.push({ role: "assistant", content: data.content });

      const toolUses = (data.content as Array<Record<string, unknown>>).filter((b) => b.type === "tool_use");
      reply = (data.content as Array<Record<string, unknown>>)
        .filter((b) => b.type === "text")
        .map((b) => b.text as string)
        .join("\n")
        .trim();

      if (data.stop_reason !== "tool_use" || toolUses.length === 0) break;

      const results = [];
      for (const tu of toolUses) {
        usedTools.push(tu.name as string);
        const out = await runTool(supabase, tu.name as string, (tu.input as Record<string, unknown>) ?? {}, state);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    return json({ error: String(e) }, 502);
  }

  // Persistance de la conversation (format du dashboard : {from, text, at})
  if (state.leadId) {
    const now = new Date().toISOString();
    const newMsgs: ChatMsg[] = [
      { from: "client", text: userText, at: now },
      { from: "ai", text: reply, at: now },
    ];
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, messages")
      .eq("lead_id", state.leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (conv) {
      const prev = Array.isArray(conv.messages) ? (conv.messages as ChatMsg[]) : [];
      await supabase
        .from("conversations")
        .update({ messages: [...prev, ...newMsgs], updated_at: now })
        .eq("id", conv.id);
    } else {
      await supabase.from("conversations").insert({
        lead_id: state.leadId,
        channel: "whatsapp",
        messages: newMsgs,
        created_at: now,
        updated_at: now,
      });
    }
    await supabase.from("leads").update({ last_interaction_at: now }).eq("id", state.leadId);
  }

  return json({ reply, lead_id: state.leadId, escalated: state.escalated, tools_used: usedTools });
});
