// Supabase Edge Function — capture des tentatives de réservation du site
//
// Le formulaire de réservation du site (harmonie-yacht.fr, actuellement sur
// Lovable) appelle ce webhook DÈS LA SOUMISSION du formulaire, avant même le
// paiement SumUp. Ainsi, qu'un client aille au bout du paiement ou abandonne
// / échoue en route, ses coordonnées sont déjà dans le CRM — plus aucune
// tentative de réservation n'est perdue.
//
// Contrat d'API (POST, JSON) :
//   {
//     first_name: string (requis)
//     last_name?: string
//     phone?: string
//     email?: string            // au moins phone OU email requis
//     party_size?: number
//     desired_date?: string     // YYYY-MM-DD
//     desired_time_slot?: string
//     interested_offer?: string
//     occasion?: string
//     message?: string
//     payment_status?: string  // "attempted" | "failed" | "abandoned" (informatif)
//   }
//
// Secrets attendus (Supabase → Edge Functions → Secrets) :
//   RESEND_API_KEY            pour l'email d'alerte
//   RESEND_FROM                (optionnel) expéditeur, défaut reservations@harmonie-yacht.fr
//   OWNER_EMAIL                adresse qui reçoit l'alerte (ex. harmonieyacht@gmail.com)
//   DASHBOARD_URL              (optionnel) défaut https://ia-hy-infra-new.vercel.app
//   OWNER_PHONE, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID  (optionnel) alerte WhatsApp en plus de l'email
//   BOOKING_WEBHOOK_SECRET      (optionnel) vérifié via header x-webhook-secret

import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("RESEND_FROM") ?? "Harmonie Yacht <reservations@harmonie-yacht.fr>";
const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") ?? "";
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") ?? "https://ia-hy-infra-new.vercel.app";
const OWNER_PHONE = Deno.env.get("OWNER_PHONE") ?? "";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const WEBHOOK_SECRET = Deno.env.get("BOOKING_WEBHOOK_SECRET") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

type BookingAttempt = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  party_size?: number;
  desired_date?: string;
  desired_time_slot?: string;
  interested_offer?: string;
  occasion?: string;
  message?: string;
  payment_status?: string;
};

// Même logique de normalisation que agent-lea (évite les doublons 06xx / +33...).
function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim().replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) return /^\+\d{6,15}$/.test(s) ? s : null;
  if (/^0\d{9}$/.test(s)) return "+33" + s.slice(1);
  if (/^33\d{9}$/.test(s)) return "+" + s;
  if (/^\d{6,15}$/.test(s)) return "+" + s;
  return null;
}

function normalizeEmail(input: string | null | undefined): string | null {
  const s = input?.trim().toLowerCase();
  return s && s.includes("@") ? s : null;
}

async function sendOwnerEmail(lead: Record<string, unknown>, body: BookingAttempt, leadUrl: string): Promise<void> {
  if (!RESEND_API_KEY || !OWNER_EMAIL) return;
  const lines = [
    `Prénom : ${body.first_name ?? "—"}`,
    body.last_name ? `Nom : ${body.last_name}` : null,
    body.phone ? `Téléphone : ${body.phone}` : null,
    body.email ? `Email : ${body.email}` : null,
    body.party_size != null ? `Personnes : ${body.party_size}` : null,
    body.desired_date ? `Date souhaitée : ${body.desired_date}` : null,
    body.desired_time_slot ? `Créneau : ${body.desired_time_slot}` : null,
    body.interested_offer ? `Offre : ${body.interested_offer}` : null,
    body.occasion ? `Occasion : ${body.occasion}` : null,
    body.message ? `Message : ${body.message}` : null,
    `Statut paiement : ${body.payment_status ?? "non abouti"}`,
  ].filter(Boolean);

  const text =
    `Un client a rempli le formulaire de réservation du site mais la réservation n'a pas abouti (paiement non finalisé ou abandonné).\n\n` +
    `${lines.join("\n")}\n\n` +
    `Voir la fiche dans le dashboard : ${leadUrl}\n\n` +
    `Recontacte-le rapidement pendant qu'il est encore chaud.`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [OWNER_EMAIL],
        subject: `🚨 Tentative de réservation non aboutie — ${body.first_name ?? "Nouveau client"}`,
        text,
      }),
    });
  } catch (e) {
    console.warn("[booking-form-webhook] email alert failed:", e);
  }
  void lead;
}

async function sendOwnerWhatsApp(body: BookingAttempt, leadUrl: string): Promise<void> {
  if (!OWNER_PHONE || !WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return;
  const text =
    `🚨 Réservation site non aboutie\n` +
    `${body.first_name ?? "Client"}${body.phone ? " · " + body.phone : ""}${body.email ? " · " + body.email : ""}\n` +
    `${body.interested_offer ?? ""}${body.desired_date ? " · " + body.desired_date : ""}\n` +
    `${leadUrl}`;
  try {
    await fetch(`https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: OWNER_PHONE, type: "text", text: { body: text } }),
    });
  } catch (e) {
    console.warn("[booking-form-webhook] whatsapp alert failed:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: BookingAttempt;
  try {
    body = (await req.json()) as BookingAttempt;
  } catch {
    return json({ error: "JSON invalide" }, 400);
  }

  const firstName = body.first_name?.trim();
  const phone = normalizePhone(body.phone);
  const email = normalizeEmail(body.email);
  if (!firstName) return json({ error: "first_name requis" }, 400);
  if (!phone && !email) return json({ error: "phone ou email requis pour pouvoir recontacter le client" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date().toISOString();

  // Dédup : recherche par téléphone d'abord, sinon par email.
  let existing: { id: string; last_interaction_at: string | null; notes: string | null } | null = null;
  if (phone) {
    const { data } = await supabase.from("leads").select("id, last_interaction_at, notes").eq("phone", phone).maybeSingle();
    existing = data;
  }
  if (!existing && email) {
    const { data } = await supabase.from("leads").select("id, last_interaction_at, notes").eq("email", email).maybeSingle();
    existing = data;
  }

  const stamp = `[Tentative résa site — ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}] ${body.interested_offer ?? ""} ${body.desired_date ?? ""} — paiement: ${body.payment_status ?? "non abouti"}${body.message ? " — " + body.message : ""}`.trim();

  let leadId: string;
  let shouldNotify = true;

  if (existing) {
    leadId = existing.id;
    // Évite de spammer une notif à chaque nouvel essai rapproché (ex. 5-6 tentatives en 2 min) :
    // on notifie seulement si la dernière interaction date de plus de 30 min.
    if (existing.last_interaction_at) {
      const minsSince = (Date.now() - new Date(existing.last_interaction_at).getTime()) / 60_000;
      shouldNotify = minsSince > 30;
    }
    const notes = existing.notes ? `${existing.notes}\n${stamp}` : stamp;
    await supabase
      .from("leads")
      .update({
        last_name: body.last_name?.trim() || undefined,
        email: email || undefined,
        phone: phone || undefined,
        party_size: body.party_size ?? undefined,
        desired_date: body.desired_date || undefined,
        desired_time_slot: body.desired_time_slot || undefined,
        interested_offer: body.interested_offer || undefined,
        occasion: body.occasion || undefined,
        needs_human_intervention: true,
        notes,
        last_interaction_at: now,
        updated_at: now,
      })
      .eq("id", leadId);
  } else {
    const { data, error } = await supabase
      .from("leads")
      .insert({
        first_name: firstName,
        last_name: body.last_name?.trim() || null,
        phone,
        email,
        source_channel: "website",
        source_status: "confirmed",
        status: "new",
        score: 8, // forte intention d'achat : il a été jusqu'à tenter de payer
        interested_offer: body.interested_offer || null,
        occasion: body.occasion || null,
        party_size: body.party_size ?? null,
        desired_date: body.desired_date || null,
        desired_time_slot: body.desired_time_slot || null,
        needs_human_intervention: true,
        notes: stamp,
        last_interaction_at: now,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[booking-form-webhook] lead creation failed", error);
      return json({ error: error?.message ?? "Erreur création lead" }, 500);
    }
    leadId = data.id as string;
  }

  const leadUrl = `${DASHBOARD_URL}/leads?lead=${leadId}`;
  if (shouldNotify) {
    await Promise.all([sendOwnerEmail({ id: leadId }, body, leadUrl), sendOwnerWhatsApp(body, leadUrl)]);
  }

  return json({ ok: true, lead_id: leadId, notified: shouldNotify });
});
