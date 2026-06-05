// Supabase Edge Function — agent "Léa"
// Anthropic Messages API : prompt caching (system = config stable, mis en cache)
// + tool use (qualify_lead, update_lead_status, create_lead, escalate_to_human,
//   get_active_events, check_availability, send_booking_link).
// Modèle : claude-sonnet-4-6 (dernier Sonnet ; caching/effort/adaptive thinking en GA).
//
// Léa fait du FRONT-OFFICE conversationnel uniquement : informer, qualifier,
// communiquer les disponibilités, relancer. Elle NE crée PAS de réservation —
// les réservations se font sur le site (send_booking_link partage le lien).

import { createClient } from "npm:@supabase/supabase-js@2";
import { gcalFromEnv } from "../_shared/google-calendar.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Lien de réservation du site (les résa se font sur le site, pas via Léa).
const SITE_BOOKING_URL = Deno.env.get("SITE_BOOKING_URL") ?? "";
const MAX_TOOL_TURNS = 6;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-lea-secret",
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

// ── Normalisation téléphone (E.164, biais France) ────────────────────
// Évite les doublons quand un même client est saisi en "06xx xx", "+33…", "33…".
function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim().replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) return /^\+\d{6,15}$/.test(s) ? s : null;
  if (/^0\d{9}$/.test(s)) return "+33" + s.slice(1); // 0XXXXXXXXX → +33XXXXXXXXX
  if (/^33\d{9}$/.test(s)) return "+" + s;            // 33XXXXXXXXX → +33XXXXXXXXX
  if (/^\d{6,15}$/.test(s)) return "+" + s;
  return null;
}

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
  {
    name: "check_availability",
    description:
      "Vérifie le planning du yacht (unique) pour une date donnée et renvoie les créneaux déjà occupés ce jour-là. À utiliser dès que le client demande une disponibilité ou propose une date. Ne JAMAIS affirmer une disponibilité sans avoir appelé cet outil — il n'y a qu'un seul bateau, donc une sortie déjà réservée bloque ce créneau.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date à vérifier au format YYYY-MM-DD" },
      },
      required: ["date"],
    },
  },
  {
    name: "send_booking_link",
    description:
      "Renvoie le lien officiel de réservation du site. Les réservations se font UNIQUEMENT sur le site, jamais par toi. Appelle cet outil pour obtenir le lien exact (ne l'invente jamais) puis transmets-le au client. Tu peux pré-remplir l'offre et la date si tu les connais.",
    input_schema: {
      type: "object",
      properties: {
        offer: { type: "string", description: "Clé ou nom de l'offre visée (optionnel)" },
        date: { type: "string", description: "Date souhaitée YYYY-MM-DD (optionnel)" },
      },
    },
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
- **Mémoire de la conversation : tu RELIS systématiquement TOUT l'historique avant de répondre.** Tu ne redemandes JAMAIS une information que le client t'a déjà donnée (occasion, nb personnes, date, créneau, prénom…). Si tu as un doute, vérifie l'historique et la fiche prospect ci-dessous — pas le client.
- Réponse au fil du fil : le client peut répondre partiellement à tes questions. Considère sa réponse comme acquise et enchaîne sur la suite logique (proposer un créneau précis, vérifier la dispo, envoyer le lien…) sans le faire répéter.
- N'invente JAMAIS d'information. Si une donnée n'est pas dans ta base de connaissances ci-dessous, dis que tu te renseignes et escalade si besoin.
- Pas de négociation sur les prix. Applique automatiquement la réduction matinée -10% si départ avant 11h. Pour toute demande de remise, esquive poliment ou propose une offre plus courte.
- Nuit Prestige le week-end (ven/sam/dim) → escalade humaine obligatoire.
- Ne mentionne le skipper optionnel QUE si le client le demande explicitement.
- Mentionne OBLIGATOIREMENT en confirmation que le retard empiète sur la durée du créneau.
- En cas de doute, de sujet sensible (PMR, météo, demande spéciale) ou hors de tes connaissances → utilise escalate_to_human.

# Réservations
- Tu NE prends PAS les réservations toi-même. Les réservations (acompte) se font sur le site.
- Quand le client est prêt à réserver, utilise send_booking_link pour lui transmettre le lien officiel, puis accompagne-le.
- Tu informes, tu qualifies, tu communiques les disponibilités et tu relances — c'est tout.

# Utilisation des outils (côté serveur, invisible pour le client)
- create_lead : sur WhatsApp, une fiche minimale (téléphone seul) est créée automatiquement à la 1ère message. Appelle create_lead dès que tu as le prénom : ça enrichit la fiche existante (sans doublon) et fait passer le statut "new" → "contacted".
- qualify_lead : IMMÉDIATEMENT après chaque nouvelle info reçue (offre, occasion, nb pers., date, créneau, score). Appelle-le AVANT de répondre au client — sinon la fiche n'est pas à jour. Un score ≥ 7 = lead chaud (remonte automatiquement dans le tableau de l'équipe).
- update_lead_status : fais avancer le pipeline (contacted → qualified → quote_sent…).
- check_availability : AVANT d'annoncer une disponibilité. N'invente jamais un créneau libre.
- send_booking_link : pour partager le lien de réservation du site (jamais inventé).
- get_active_events : si le client demande des événements / soirées publiques.
- escalate_to_human : selon les règles ci-dessus.
Continue toujours à répondre naturellement au client APRÈS avoir utilisé un outil.

# Base de connaissances (faits — source de vérité)
${JSON.stringify(config, null, 2)}`;
}

function buildDynamicSystem(lead: Record<string, unknown> | null, nowIso: string): string {
  if (!lead) {
    return `Date et heure actuelles : ${nowIso} (Europe/Paris).\nAucune fiche prospect connue pour ce contact (nouveau lead potentiel — pense à create_lead).`;
  }
  // Liste explicite : ce que tu SAIS déjà (ne redemande pas) vs ce qui MANQUE.
  const known: string[] = [];
  const missing: string[] = [];
  const add = (label: string, value: unknown) => {
    if (value !== null && value !== undefined && value !== "") known.push(`${label} = ${JSON.stringify(value)}`);
    else missing.push(label);
  };
  add("prénom", lead.first_name);
  add("occasion", lead.occasion);
  add("nb_personnes", lead.party_size);
  add("date_souhaitée", lead.desired_date);
  add("créneau", lead.desired_time_slot);
  add("offre_visée", lead.interested_offer);
  const statut = lead.status ?? "new";
  const score = lead.score ?? "—";
  return `Date et heure actuelles : ${nowIso} (Europe/Paris).

# Fiche prospect (id ${lead.id}, statut ${statut}, score ${score})
Tu connais DÉJÀ ces infos — ne les redemande JAMAIS :
${known.length ? known.map((k) => "  - " + k).join("\n") : "  (aucune info collectée à ce stade)"}

Infos encore à collecter au fil de la conversation (si pertinent) :
${missing.length ? missing.map((m) => "  - " + m).join("\n") : "  (tout est collecté ✓)"}

⚠️ Si le client te donne UNE des infos manquantes ci-dessus, considère-la acquise et passe à l'étape suivante (check_availability, qualify_lead pour la persister, puis recommandation/lien de réservation).`;
}

// ── Exécution des outils côté Supabase ──────────────────────────────
async function runTool(
  supabase: ReturnType<typeof createClient>,
  name: string,
  input: Record<string, unknown>,
  state: { leadId: string | null; escalated: boolean; phone: string | null; bookingUrl: string },
): Promise<string> {
  const now = new Date().toISOString();
  switch (name) {
    case "create_lead": {
      // Enrichit le stub auto-créé à la 1ère message WhatsApp si présent,
      // sinon crée une nouvelle fiche (canaux sans téléphone : web, etc.).
      if (state.leadId) {
        const patch: Record<string, unknown> = { updated_at: now, last_interaction_at: now };
        for (const k of ["first_name", "interested_offer", "occasion", "party_size", "source_channel"]) {
          if (input[k] !== undefined && input[k] !== null) patch[k] = input[k];
        }
        // Passe de "new" (stub) à "contacted" dès qu'on a un prénom.
        if (input.first_name) patch.status = "contacted";
        const { error } = await supabase.from("leads").update(patch).eq("id", state.leadId);
        return error ? `Erreur mise à jour: ${error.message}` : `Fiche enrichie (id ${state.leadId}).`;
      }
      const insertPhone = normalizePhone((input.phone as string) ?? state.phone);
      const { data, error } = await supabase
        .from("leads")
        .insert({
          first_name: (input.first_name as string) ?? null,
          phone: insertPhone,
          interested_offer: (input.interested_offer as string) ?? null,
          occasion: (input.occasion as string) ?? null,
          party_size: (input.party_size as number) ?? null,
          source_channel: (input.source_channel as string) ?? "whatsapp",
          source_status: "to_ask",
          status: input.first_name ? "contacted" : "new",
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
    case "check_availability": {
      const date = (input.date as string)?.slice(0, 10);
      if (!date) return "Date manquante (format YYYY-MM-DD attendu).";

      // ── Source 1 : table bookings (source de vérité principale) ──
      const { data: bk, error } = await supabase
        .from("bookings")
        .select("start_time, end_time, offer_name, status")
        .eq("date", date)
        .in("status", ["pending", "confirmed"])
        .order("start_time", { ascending: true });
      if (error) return `Erreur: ${error.message}`;

      // ── Source 2 : events_public Supabase ──
      const { data: evts } = await supabase
        .from("events_public")
        .select("title, start_time, end_time")
        .eq("date", date)
        .eq("status", "published");

      // ── Source 3 : Google Calendar (si credentials présents) ──
      // Donne la visibilité sur les blocages manuels saisis directement dans GCal
      // (congé, maintenance, réservation hors-système…).
      let gcalOccupied: Array<{ type: string; from: string; to: string; label: string }> = [];
      try {
        const gcal = gcalFromEnv();
        if (gcal) {
          const timeMin = `${date}T00:00:00+02:00`;
          const timeMax = `${date}T23:59:59+02:00`;
          const gcalEvts = await gcal.listEvents(timeMin, timeMax);
          gcalOccupied = gcalEvts.map((e) => ({
            type: "agenda google",
            from: e.start.length > 10 ? e.start.slice(11, 16) : "00:00",
            to: e.end.length > 10 ? e.end.slice(11, 16) : "23:59",
            label: e.summary,
          }));
        }
      } catch (e) {
        console.warn("check_availability: GCal indisponible, lecture ignorée.", e);
      }

      const occupied = [
        ...(bk ?? []).map((b) => ({
          type: "sortie privative",
          from: (b.start_time as string)?.slice(0, 5),
          to: (b.end_time as string)?.slice(0, 5),
          label: b.offer_name,
        })),
        ...(evts ?? []).map((e) => ({
          type: "événement public",
          from: (e.start_time as string)?.slice(0, 5),
          to: (e.end_time as string)?.slice(0, 5),
          label: e.title,
        })),
        ...gcalOccupied,
      ];

      return JSON.stringify({
        date,
        fully_free: occupied.length === 0,
        occupied,
        note:
          occupied.length === 0
            ? "Aucun créneau réservé ce jour — le bateau est disponible."
            : "Créneaux déjà pris ci-dessus. Le reste de la journée peut rester disponible (un seul bateau).",
      });
    }
    case "send_booking_link": {
      if (!state.bookingUrl) {
        return "Lien de réservation non configuré (SITE_BOOKING_URL absent). Escalade vers l'équipe humaine pour transmettre le lien.";
      }
      const params = new URLSearchParams();
      if (input.offer) params.set("offer", String(input.offer));
      if (input.date) params.set("date", String(input.date).slice(0, 10));
      const qs = params.toString();
      const url = qs ? `${state.bookingUrl}${state.bookingUrl.includes("?") ? "&" : "?"}${qs}` : state.bookingUrl;
      return `Lien de réservation officiel à transmettre au client : ${url}`;
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

  // Auth optionnelle par secret partagé : appliquée seulement si LEA_SHARED_SECRET est défini.
  const sharedSecret = Deno.env.get("LEA_SHARED_SECRET");
  if (sharedSecret && req.headers.get("x-lea-secret") !== sharedSecret) {
    return json({ error: "unauthorized" }, 401);
  }

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

  // Contexte lead — recherche par lead_id, sinon par téléphone normalisé.
  const normalizedPhone = normalizePhone(body.phone);
  let lead: Record<string, unknown> | null = null;
  if (body.lead_id) {
    const { data } = await supabase.from("leads").select("*").eq("id", body.lead_id).maybeSingle();
    lead = data;
  } else if (normalizedPhone) {
    const { data } = await supabase.from("leads").select("*").eq("phone", normalizedPhone).maybeSingle();
    lead = data;
  }

  // Stub auto à la première message WhatsApp : garantit que tout prospect apparaisse
  // dans /leads dès le premier échange, même si Léa n'a pas encore appelé create_lead
  // (le client n'a pas encore donné son prénom).
  if (!lead && normalizedPhone) {
    const nowStub = new Date().toISOString();
    const { data: stub } = await supabase
      .from("leads")
      .insert({
        phone: normalizedPhone,
        source_channel: "whatsapp",
        source_status: "to_ask",
        status: "new",
        created_at: nowStub,
        updated_at: nowStub,
        last_interaction_at: nowStub,
      })
      .select("*")
      .single();
    lead = stub;
  }

  const state = {
    leadId: (lead?.id as string) ?? null,
    escalated: false,
    phone: normalizedPhone ?? (lead?.phone as string) ?? null,
    bookingUrl: SITE_BOOKING_URL || ((config.faq as Record<string, any>)?.booking_process?.deposit_link ?? ""),
  };

  // Lie la conversation WhatsApp au lead — permet d'afficher le fil WA sur la
  // fiche du prospect dans le dashboard.
  if (state.leadId && state.phone) {
    await supabase
      .from("wa_conversations")
      .update({ lead_id: state.leadId })
      .eq("customer_phone", state.phone)
      .is("lead_id", null);
  }
  // Placeholder du seed : on ne transmet pas un lien factice au client.
  if (state.bookingUrl === "TO_BE_PROVIDED") state.bookingUrl = "";

  // Historique → messages API. Si non fourni, on recharge depuis le Dashboard
  // (conversation du lead) pour une continuité stateful par téléphone/lead.
  let history: ChatMsg[] = body.history ?? [];
  if (!body.history && state.leadId) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("messages")
      .eq("lead_id", state.leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (conv && Array.isArray(conv.messages)) {
      history = (conv.messages as ChatMsg[]).slice(-20);
    }
  }
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
