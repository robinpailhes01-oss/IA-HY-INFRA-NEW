// Supabase Edge Function — capture les emails laissés contre le code promo
// -5 % (pop-up "LeadMagnet" du site, cf. src/components/LeadMagnet.tsx).
//
// Différence volontaire avec booking-form-webhook : ce n'est PAS une
// tentative de réservation (le client n'a rien configuré, pas de date, pas
// de montant) — score plus bas, needs_human_intervention à false, et
// aucune alerte email/WhatsApp au propriétaire à chaque inscription (Léa
// reprend ces leads dans ses relances normales, pas la peine de déranger
// Robin pour chaque email laissé).
//
// Contrat d'API (POST, JSON) :
//   { first_name: string (requis), email: string (requis) }
//   -> { ok: true, code: "BIENVENUE5" }
//
// Secrets : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (déjà présents, partagés).

import { createClient } from "npm:@supabase/supabase-js@2";

const PROMO_CODE = "BIENVENUE5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

function normalizeEmail(input: unknown): string | null {
  const s = typeof input === "string" ? input.trim().toLowerCase() : "";
  return s && s.includes("@") ? s : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { first_name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON invalide" }, 400);
  }

  const firstName = body.first_name?.trim();
  const email = normalizeEmail(body.email);
  if (!firstName) return json({ error: "first_name requis" }, 400);
  if (!email) return json({ error: "email requis" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date().toISOString();
  const stamp = `[Code -5% site — ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}]`;

  const { data: existing } = await supabase.from("leads").select("id, notes").eq("email", email).maybeSingle();

  if (existing) {
    const notes = existing.notes ? `${existing.notes}\n${stamp}` : stamp;
    await supabase.from("leads").update({ notes, last_interaction_at: now, updated_at: now }).eq("id", existing.id);
    return json({ ok: true, code: PROMO_CODE });
  }

  const { error } = await supabase.from("leads").insert({
    first_name: firstName,
    email,
    source_channel: "website",
    source_status: "confirmed",
    status: "new",
    score: 4,
    interested_offer: "reduction_5pct",
    needs_human_intervention: false,
    notes: stamp,
    last_interaction_at: now,
    created_at: now,
    updated_at: now,
  });

  if (error) {
    console.error("[lead-magnet-signup] insert failed", error);
    return json({ error: error.message }, 500);
  }

  return json({ ok: true, code: PROMO_CODE });
});
