// Supabase Edge Function — Relances automatiques de Léa (cron)
//
// Invoquée périodiquement (ex. toutes les heures via pg_cron / Scheduled
// Functions). Pour chaque prospect "tiède" qui n'a pas donné de nouvelles,
// Léa rédige UN message de relance court et chaleureux, l'envoie sur WhatsApp,
// puis met à jour la fiche (compteur de relances, horodatage, statut).
//
// Règles (issues de agent_config) :
//   - statut actif uniquement (contacted, qualified, quote_sent, followed_up)
//   - pas d'escalade humaine en cours (needs_human_intervention = false)
//   - followup_count < max_followups
//   - délai écoulé >= followup_intervals_hours[followup_count]
//   - un numéro de téléphone est requis (canal WhatsApp)
//
// Secrets : ANTHROPIC_API_KEY, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
//           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET (optionnel),
//           GRAPH_API_VERSION (optionnel).

import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const GRAPH_VERSION = Deno.env.get("GRAPH_API_VERSION") ?? "v21.0";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
const DEFAULT_INTERVALS = [24, 72, 168]; // heures

const ACTIVE_STATUSES = ["contacted", "qualified", "quote_sent", "followed_up"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Lead = Record<string, any>;

async function sendWhatsApp(to: string, text: string): Promise<boolean> {
  const res = await fetch(GRAPH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: true, body: text },
    }),
  });
  if (!res.ok) {
    console.error("WhatsApp send error", res.status, await res.text());
    return false;
  }
  return true;
}

// Rédige une relance courte dans la voix de Léa, adaptée au contexte du prospect.
async function writeFollowup(lead: Lead, followupNumber: number, config: Lead): Promise<string> {
  const system = `Tu es Léa, l'assistante commerciale de Harmonie Yacht (location de yacht privatif à Carnon).
Tu rédiges UNE relance WhatsApp pour un prospect qui n'a pas répondu. Style : chaleureux, élégant, vouvoiement, court (1-3 phrases), un emoji pertinent maximum. Tu ne te présentes jamais comme une IA.
Ne propose pas de remise. Ne réserve rien (les réservations se font sur le site). Sois naturelle, pas insistante : c'est la relance n°${followupNumber}. Plus le numéro est élevé, plus tu es légère et tu laisses une porte de sortie.
Réponds UNIQUEMENT par le texte du message à envoyer, sans guillemets ni préambule.

Contexte commercial (faits) : ${JSON.stringify(config)}`;

  const ctx = {
    prénom: lead.first_name,
    offre_visée: lead.interested_offer,
    occasion: lead.occasion,
    personnes: lead.party_size,
    date_souhaitée: lead.desired_date,
    statut: lead.status,
  };
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system,
      messages: [
        {
          role: "user",
          content: `Rédige la relance n°${followupNumber} pour ce prospect : ${JSON.stringify(ctx)}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  // Garde-fou : si CRON_SECRET est défini, il doit être présenté.
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY manquante" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: config } = await supabase
    .from("agent_config")
    .select("offers, options, faq, max_followups, auto_followup_enabled")
    .limit(1)
    .single();

  if (!config?.auto_followup_enabled) {
    return json({ skipped: "auto_followup_enabled = false", processed: 0 });
  }
  const maxFollowups = (config.max_followups as number) ?? 3;
  const intervals =
    (config.faq as any)?.agent_settings?.followup_intervals_hours ?? DEFAULT_INTERVALS;

  // Candidats : statut actif, pas d'escalade, non archivés, avec téléphone,
  // relances restantes. Le filtre fin de délai se fait en mémoire (par palier).
  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, first_name, phone, interested_offer, occasion, party_size, desired_date, status, last_interaction_at, created_at, followup_count, last_followup_at, needs_human_intervention, archived",
    )
    .in("status", ACTIVE_STATUSES)
    .eq("needs_human_intervention", false)
    .not("phone", "is", null)
    .or("archived.is.null,archived.eq.false")
    .lt("followup_count", maxFollowups);

  if (error) return json({ error: error.message }, 500);

  const now = Date.now();
  const results: Array<{ lead_id: string; sent: boolean; reason?: string }> = [];

  for (const lead of leads ?? []) {
    const count = (lead.followup_count as number) ?? 0;
    const ref = (lead.last_followup_at as string) ?? (lead.last_interaction_at as string) ?? (lead.created_at as string);
    if (!ref) continue;
    const hoursSince = (now - new Date(ref).getTime()) / 3_600_000;
    const dueAfter = intervals[Math.min(count, intervals.length - 1)] ?? 24;
    if (hoursSince < dueAfter) continue; // pas encore l'heure de relancer

    try {
      const text = await writeFollowup(lead, count + 1, config);
      if (!text) {
        results.push({ lead_id: lead.id, sent: false, reason: "message vide" });
        continue;
      }
      const ok = await sendWhatsApp(lead.phone, text);
      const nowIso = new Date().toISOString();

      if (ok) {
        await supabase
          .from("leads")
          .update({
            followup_count: count + 1,
            last_followup_at: nowIso,
            last_interaction_at: nowIso,
            status: "followed_up",
            updated_at: nowIso,
          })
          .eq("id", lead.id);

        // Trace dans la conversation (même format que le dashboard).
        const { data: conv } = await supabase
          .from("conversations")
          .select("id, messages")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const newMsg = { from: "ai", text, at: nowIso };
        if (conv) {
          const prev = Array.isArray(conv.messages) ? conv.messages : [];
          await supabase.from("conversations").update({ messages: [...prev, newMsg], updated_at: nowIso }).eq("id", conv.id);
        } else {
          await supabase.from("conversations").insert({
            lead_id: lead.id,
            channel: "whatsapp",
            messages: [newMsg],
            created_at: nowIso,
            updated_at: nowIso,
          });
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
