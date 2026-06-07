// Supabase Edge Function — Relances automatiques de Léa (cron horaire)
//
// Envoie via le service Baileys (Railway) — pas l'API Meta Cloud (legacy).
// Cron : appeler ce endpoint avec header x-cron-secret toutes les heures.

import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const BAILEYS_SERVICE_URL = Deno.env.get("BAILEYS_SERVICE_URL") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const DEFAULT_INTERVALS = [24, 72, 168]; // 1j, 3j, 7j
const ACTIVE_STATUSES = ["contacted", "qualified", "quote_sent", "followed_up"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Lead = Record<string, any>;

async function sendViaBaileys(phone: string, text: string): Promise<boolean> {
  if (!BAILEYS_SERVICE_URL) {
    console.error("BAILEYS_SERVICE_URL manquant");
    return false;
  }
  const res = await fetch(`${BAILEYS_SERVICE_URL}/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone, message: text }),
  });
  if (!res.ok) {
    console.error("Baileys send error", res.status, await res.text());
    return false;
  }
  return true;
}

async function writeFollowup(lead: Lead, followupNumber: number, config: Lead): Promise<string> {
  const system = `Tu es Léa, l'assistante commerciale de Harmonie Yacht (location de yacht privatif à Carnon).
Tu rédiges UNE relance WhatsApp pour un prospect qui n'a pas répondu.

# Style maison — calque EXACTEMENT ces exemples réels :
> "Bonjour 👋🏼 avez vous pu regarder ? 🌊"
> "Bonjour 😊 avez vous pu regarder ?"
> "Bonjour {prénom} comment allez-vous ? 😊 Est-ce qu'une sortie en mer est toujours d'actualité ? Nous avons une magnifique météo ce soir 🌇"
> "Bonjour {prénom} 😊 vous avez pu réfléchir à la sortie ? Nous avons encore des dispos {date_souhaitée}."

# Règles
- Très court (1-3 phrases max).
- Vouvoiement, chaleureuse, JAMAIS pompeuse.
- Un seul emoji pertinent (😊, 👋🏼, 🌊, ☀️, 🌇).
- Si tu connais le prénom → utilise-le naturellement. Sinon "Bonjour 😊" suffit.
- Ne propose JAMAIS de remise.
- Ne réserve rien (les réservations se font sur le site harmonie-yacht.fr).
- C'est la relance n°${followupNumber}. Plus le n° monte, plus tu es légère et laisses une porte de sortie ("on reste à votre disposition", "belle journée").
- Bonus à valoriser si la sortie évoquée est le soir ET groupe ≤ 5 pers : "Nous incluons les tapas pour les groupes de 5 personnes max" (partenaire Una Mas).
- Tu ne te présentes JAMAIS comme une IA.

Réponds UNIQUEMENT par le texte du message à envoyer, sans guillemets ni préambule.`;

  const ctx = {
    prénom: lead.first_name,
    offre_visée: lead.interested_offer,
    occasion: lead.occasion,
    personnes: lead.party_size,
    date_souhaitée: lead.desired_date,
    créneau: lead.desired_time_slot,
    statut: lead.status,
  };
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: `Rédige la relance n°${followupNumber} pour ce prospect : ${JSON.stringify(ctx)}` }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "unauthorized" }, 401);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY manquante" }, 500);
  if (!BAILEYS_SERVICE_URL) return json({ error: "BAILEYS_SERVICE_URL manquant" }, 500);

  // Mode "manuel" : si lead_id est fourni dans le body, on traite uniquement ce
  // lead, en bypassant le check d'intervalle (clic sur "Relancer" depuis la fiche).
  let manualLeadId: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.lead_id === "string") manualLeadId = body.lead_id;
  } catch { /* body vide = mode cron normal */ }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: config } = await supabase.from("agent_config").select("offers, options, faq, max_followups, auto_followup_enabled").limit(1).single();

  // En mode manuel, on ne respecte pas auto_followup_enabled (l'humain a cliqué).
  if (!manualLeadId && !config?.auto_followup_enabled) {
    return json({ skipped: "auto_followup_enabled = false", processed: 0 });
  }
  const maxFollowups = (config?.max_followups as number) ?? 3;
  const intervals = (config?.faq as any)?.agent_settings?.followup_intervals_hours ?? DEFAULT_INTERVALS;

  let leadsQuery = supabase
    .from("leads")
    .select("id, first_name, phone, interested_offer, occasion, party_size, desired_date, desired_time_slot, status, last_interaction_at, created_at, followup_count, last_followup_at, needs_human_intervention, archived");

  if (manualLeadId) {
    leadsQuery = leadsQuery.eq("id", manualLeadId);
  } else {
    leadsQuery = leadsQuery
      .in("status", ACTIVE_STATUSES)
      .eq("needs_human_intervention", false)
      .not("phone", "is", null)
      .or("archived.is.null,archived.eq.false")
      .lt("followup_count", maxFollowups);
  }

  const { data: leads, error } = await leadsQuery;
  if (error) return json({ error: error.message }, 500);

  const now = Date.now();
  const results: Array<{ lead_id: string; sent: boolean; reason?: string }> = [];

  for (const lead of leads ?? []) {
    const count = (lead.followup_count as number) ?? 0;
    if (!manualLeadId) {
      // Mode cron : on respecte l'intervalle.
      const ref = (lead.last_followup_at as string) ?? (lead.last_interaction_at as string) ?? (lead.created_at as string);
      if (!ref) continue;
      const hoursSince = (now - new Date(ref).getTime()) / 3_600_000;
      const dueAfter = intervals[Math.min(count, intervals.length - 1)] ?? 24;
      if (hoursSince < dueAfter) continue;
    } else {
      // Mode manuel : on refuse uniquement si le lead n'a pas de téléphone.
      if (!lead.phone) {
        results.push({ lead_id: lead.id, sent: false, reason: "pas de téléphone" });
        continue;
      }
    }

    try {
      const text = await writeFollowup(lead, count + 1, config);
      if (!text) {
        results.push({ lead_id: lead.id, sent: false, reason: "message vide" });
        continue;
      }
      const ok = await sendViaBaileys(lead.phone, text);
      const nowIso = new Date().toISOString();

      if (ok) {
        await supabase.from("leads").update({
          followup_count: count + 1,
          last_followup_at: nowIso,
          last_interaction_at: nowIso,
          status: "followed_up",
          updated_at: nowIso,
        }).eq("id", lead.id);

        const { data: conv } = await supabase.from("conversations").select("id, messages").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        const newMsg = { from: "ai", text, at: nowIso };
        if (conv) {
          const prev = Array.isArray(conv.messages) ? conv.messages : [];
          await supabase.from("conversations").update({ messages: [...prev, newMsg], updated_at: nowIso }).eq("id", conv.id);
        } else {
          await supabase.from("conversations").insert({ lead_id: lead.id, channel: "whatsapp", messages: [newMsg], created_at: nowIso, updated_at: nowIso });
        }
      }
      results.push({ lead_id: lead.id, sent: ok });
    } catch (e) {
      console.error("followup failed", lead.id, e);
      results.push({ lead_id: lead.id, sent: false, reason: String(e) });
    }
  }

  return json({ processed: results.length, sent: results.filter((r) => r.sent).length, results });
});
