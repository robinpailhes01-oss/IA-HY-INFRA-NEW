// Edge Function : import-gcal-bookings
//
// Scan Google Calendar sur 90 jours et importe en DB les events réservation
// absents. Dédup par google_calendar_event_id. Envoie un mail de confirmation
// via Resend si la clé RESEND_API_KEY est présente, et un message WhatsApp
// via Baileys si un téléphone est disponible.
//
// Remplace le workflow n8n "🛥️ Sync Réservations Site Web" (cassé : Gmail
// Trigger défaillant). Lovable écrit déjà chaque réservation dans le Google
// Calendar partagé — c'est une source plus fiable qu'un mail Resend.
//
// IMPORTANT : on filtre les events que nous avons nous-mêmes créés via
// sync-gcal (description contient "Statut :" ou "Canal :") pour éviter une
// boucle d'import.
//
// Cron : déclenché toutes les 10 min via pg_cron + pg_net (cf. migration
// cron_import_gcal_bookings).
//
// Rattachement lead/client existant : un prospect peut déjà avoir discuté
// avec Léa sur WhatsApp (fiche `leads` créée à son 1er message) avant de
// payer sur le site. On cherche donc un lead/client existant par téléphone
// puis par email avant d'en créer un nouveau — sinon la réservation atterrit
// sur une fiche différente de celle que Léa consulte, et elle ne voit jamais
// que ce prospect a payé.

import { createClient } from "npm:@supabase/supabase-js@2";

const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const RESEND_URL = "https://api.resend.com/emails";
const SCAN_DAYS_AHEAD = 90;

function b64url(u: Uint8Array): string {
  return btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function signJwt(payload: unknown, pemKey: string): Promise<string> {
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const msg = `${header}.${body}`;
  const b64 = pemKey.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(msg));
  return `${msg}.${b64url(new Uint8Array(sig))}`;
}

function normalizePhone(input: string | null): string | null {
  if (!input) return null;
  let s = input.trim().replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) return /^\+\d{6,15}$/.test(s) ? s : null;
  if (/^0\d{9}$/.test(s)) return "+33" + s.slice(1);
  if (/^33\d{9}$/.test(s)) return "+" + s;
  if (/^\d{6,15}$/.test(s)) return "+" + s;
  return null;
}

function parseEvent(desc: string) {
  const ext = (re: RegExp): string | null => {
    const m = desc.match(re);
    return m ? m[1].trim() : null;
  };
  const duration = parseFloat(ext(/Dur[ée]e\s*:\s*([0-9.,]+)/i) ?? "") || null;
  const client = ext(/Client\s*:\s*([^\n]+)/i);
  const email = ext(/Email\s*:\s*(\S+)/i);
  const phone = ext(/T[ée]l[ée]phone\s*:\s*(\S+)/i);
  const partySize = parseInt(ext(/Invit[ée]s\s*:\s*(\d+)/i) ?? "", 10) || null;
  const special = ext(/Demandes?\s*:\s*([^\n]+)/i);
  const total = parseFloat((ext(/Prix\s+total\s*:\s*([0-9.,]+)/i) ?? "").replace(",", ".")) || null;
  const deposit = parseFloat((ext(/Acompte\s+pay[ée]\s*:\s*([0-9.,]+)/i) ?? "").replace(",", ".")) || null;
  const parts = (client ?? "").split(/\s+/);
  const firstName = parts[0] || null;
  const lastName = parts.slice(1).join(" ") || null;
  return { duration, client, firstName, lastName, email, phone, partySize, special, total, deposit };
}

function detectType(summary: string): string {
  const l = summary.toLowerCase();
  if (l.includes("nuit prestige")) return "nuit_prestige";
  if (l.includes("nuit insolite")) return "nuit_insolite";
  return "sortie_privative";
}

function extractOfferName(summary: string): string {
  const m = summary.match(/^([^—\-]+?)\s*[—\-]\s*/);
  return (m ? m[1] : summary).trim();
}

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

async function sendConfirmation(to: string, data: {
  firstName: string | null; dateFr: string; startTime: string | null;
  duration: number | null; partySize: number | null; offerName: string;
  total: number | null; deposit: number | null; balanceDue: number | null;
  special: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { sent: false, reason: "RESEND_API_KEY absent" };
  const from = Deno.env.get("RESEND_FROM") || "Harmonie Yacht <reservations@harmonie-yacht.fr>";
  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
<h2 style="color: #1a5490;">⚓ Votre réservation est confirmée</h2>
<p>Bonjour ${data.firstName ?? ""},</p>
<p>Merci pour votre réservation ! Toute l'équipe Harmonie Yacht a hâte de vous accueillir à bord pour ce moment privilégié${data.special ? ` — et tout particulièrement pour : ${data.special}` : ""}.</p>
<h3 style="color: #1a5490; border-bottom: 2px solid #1a5490; padding-bottom: 4px;">📋 Récapitulatif</h3>
<table style="border-collapse: collapse; width: 100%;">
<tr><td style="padding: 6px 0; color: #666;">Date</td><td style="padding: 6px 0;"><strong>${data.dateFr}</strong></td></tr>
<tr><td style="padding: 6px 0; color: #666;">Heure de départ</td><td style="padding: 6px 0;"><strong>${data.startTime ?? "à confirmer"}</strong></td></tr>
<tr><td style="padding: 6px 0; color: #666;">Durée</td><td style="padding: 6px 0;"><strong>${data.duration ?? "—"}h</strong></td></tr>
<tr><td style="padding: 6px 0; color: #666;">Invités</td><td style="padding: 6px 0;"><strong>${data.partySize ?? "—"}</strong></td></tr>
<tr><td style="padding: 6px 0; color: #666;">Prestation</td><td style="padding: 6px 0;"><strong>${data.offerName}</strong></td></tr>
<tr><td style="padding: 6px 0; color: #666;">Prix total</td><td style="padding: 6px 0;"><strong>${data.total ?? "—"}€</strong></td></tr>
<tr><td style="padding: 6px 0; color: #666;">Acompte réglé</td><td style="padding: 6px 0; color: #2a9d4f;"><strong>${data.deposit ?? "—"}€</strong></td></tr>
<tr><td style="padding: 6px 0; color: #666;">Solde à régler le jour J</td><td style="padding: 6px 0; color: #c08820;"><strong>${data.balanceDue ?? "—"}€</strong></td></tr>
</table>
<h3 style="color: #1a5490; border-bottom: 2px solid #1a5490; padding-bottom: 4px; margin-top: 24px;">📍 Rendez-vous</h3>
<p><strong>239 rue de l'étang de l'or</strong><br>Carnon-Port — 34130 Mauguio</p>
<p style="color: #555;">L'adresse vous amène directement au parking à côté de l'Hôtel Neptune — le bateau est juste à proximité. Pensez à arriver quelques minutes en avance pour vous garer sereinement et rejoindre le quai tranquillement.</p>
<h3 style="color: #1a5490; border-bottom: 2px solid #1a5490; padding-bottom: 4px; margin-top: 24px;">ℹ️ À prévoir</h3>
<ul style="color: #555;">
<li>Affaires confortables, lunettes de soleil, crème solaire ☀️</li>
<li>En cas de doute météo, nous vous contactons la veille</li>
<li>Pour toute question, répondez directement à ce mail</li>
</ul>
<p style="margin-top: 32px;">Au plaisir de vous accueillir à bord pour ce beau moment en mer 🌅</p>
<p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; color: #666;"><strong>L'équipe Harmonie Yacht</strong><br>📞 07 53 48 12 63<br>✉️ harmonieyacht@gmail.com</p>
</div>`;

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: "harmonieyacht@gmail.com",
      subject: `✅ Votre sortie en mer est confirmée — ${data.dateFr}`,
      html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { sent: false, reason: `Resend ${res.status}: ${txt.slice(0, 200)}` };
  }
  return { sent: true };
}

// Même logique que sendConfirmation (email), version WhatsApp via Baileys —
// même endpoint /send que lea-followups. Le message est un texte fixe, pas
// généré par le LLM : une confirmation de paiement doit être prévisible.
async function sendWhatsappConfirmation(phone: string, data: {
  firstName: string | null; dateFr: string; startTime: string | null;
  offerName: string; deposit: number | null; balanceDue: number | null;
}): Promise<{ sent: boolean; reason?: string; text?: string }> {
  const baileysUrl = Deno.env.get("BAILEYS_SERVICE_URL");
  if (!baileysUrl) return { sent: false, reason: "BAILEYS_SERVICE_URL absent" };

  const text = `Bonjour ${data.firstName ?? ""} ! ⚓ Léa de Harmonie Yacht — je vous confirme que votre réservation a bien été reçue et enregistrée ✅

📅 ${data.dateFr}${data.startTime ? ` à ${data.startTime}` : ""}
🛥️ ${data.offerName}
💶 Acompte réglé : ${data.deposit ?? "—"}€${data.balanceDue && data.balanceDue > 0 ? `\n💰 Solde à régler le jour J : ${data.balanceDue}€` : ""}

On a hâte de vous accueillir à bord ! N'hésitez pas si vous avez la moindre question 🌊`;

  const res = await fetch(`${baileysUrl}/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone, message: text }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { sent: false, reason: `Baileys ${res.status}: ${detail.slice(0, 200)}` };
  }
  return { sent: true, text };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });

  const secret = Deno.env.get("GCAL_IMPORT_SECRET");
  if (secret && req.headers.get("x-import-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const calId = Deno.env.get("GOOGLE_CALENDAR_ID");
  const saEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const saKey = (Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
  if (!calId || !saEmail || !saKey) {
    return new Response(JSON.stringify({ error: "missing google secrets" }), { status: 500 });
  }

  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt(
    { iss: saEmail, scope: GCAL_SCOPE, aud: TOKEN_URL, exp: now + 3600, iat: now },
    saKey,
  );
  const tok = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!tok.ok) {
    return new Response(JSON.stringify({ error: `gcal token ${tok.status}: ${await tok.text()}` }), { status: 500 });
  }
  const { access_token } = await tok.json();

  const today = new Date();
  const future = new Date(today.getTime() + SCAN_DAYS_AHEAD * 86_400_000);
  const params = new URLSearchParams({
    timeMin: today.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`;
  const gcalRes = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!gcalRes.ok) {
    return new Response(JSON.stringify({ error: `gcal events ${gcalRes.status}: ${await gcalRes.text()}` }), { status: 500 });
  }
  const gcalData = await gcalRes.json();

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const summary = {
    scanned: 0,
    skipped_already_in_db: 0,
    skipped_not_a_booking: 0,
    skipped_self_synced: 0,
    imported: 0,
    emailed: 0,
    whatsapp_sent: 0,
    errors: [] as Array<{ event: string; reason: string }>,
  };

  for (const ev of (gcalData.items ?? []) as Array<Record<string, any>>) {
    summary.scanned++;
    const evSummary: string = ev.summary ?? "(sans titre)";
    if (!ev.summary || !ev.description) { summary.skipped_not_a_booking++; continue; }
    const desc: string = ev.description;

    // Skip nos propres events (créés par sync-gcal Edge Function depuis Supabase).
    // Notre format de description contient "Statut :" et "Canal :" — absents du
    // format Lovable. Filtre robuste vs le summary qui peut varier.
    if (/Statut\s*:/i.test(desc) || /Canal\s*:/i.test(desc) || /Harmonie\s+Yacht/i.test(evSummary)) {
      summary.skipped_self_synced++;
      continue;
    }

    if (!/Client\s*:/i.test(desc) || !/Email\s*:/i.test(desc)) {
      summary.skipped_not_a_booking++;
      continue;
    }

    const { data: existing } = await supabase
      .from("bookings").select("id").eq("google_calendar_event_id", ev.id).maybeSingle();
    if (existing) { summary.skipped_already_in_db++; continue; }

    const startIso: string = ev.start?.dateTime ?? ev.start?.date;
    const endIso: string = ev.end?.dateTime ?? ev.end?.date;
    if (!startIso || !endIso) {
      summary.errors.push({ event: evSummary, reason: "start/end manquant" });
      continue;
    }

    const parsed = parseEvent(desc);
    const dateStr = startIso.slice(0, 10);
    const startTime = startIso.length > 10 ? startIso.slice(11, 16) : null;
    const endTime = endIso.length > 10 ? endIso.slice(11, 16) : null;
    const offerName = extractOfferName(evSummary);
    const bookingType = detectType(evSummary);
    const normalizedPhone = normalizePhone(parsed.phone);
    const balanceDue = parsed.total !== null && parsed.deposit !== null
      ? Math.round((parsed.total - parsed.deposit) * 100) / 100
      : null;

    try {
      // Rattachement à une fiche existante (par téléphone, puis par email) —
      // un prospect qui discute déjà avec Léa sur WhatsApp a déjà une fiche
      // `leads`/`customers` ; sans ce matching, la réservation créerait une
      // fiche séparée que Léa ne consulte jamais.
      let customerId: string;
      let leadId: string;

      const { data: custByPhone } = normalizedPhone
        ? await supabase.from("customers").select("id").eq("phone", normalizedPhone).maybeSingle()
        : { data: null };
      const { data: custByEmail } = !custByPhone && parsed.email
        ? await supabase.from("customers").select("id").eq("email", parsed.email).maybeSingle()
        : { data: null };
      const existingCustomer = custByPhone ?? custByEmail;

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: cust, error: cErr } = await supabase
          .from("customers")
          .insert({
            first_name: parsed.firstName,
            last_name: parsed.lastName,
            email: parsed.email,
            phone: normalizedPhone,
            acquisition_channel: "website",
          })
          .select("id")
          .single();
        if (cErr) throw new Error(`customer: ${cErr.message}`);
        customerId = cust.id;
      }

      const { data: leadByPhone } = normalizedPhone
        ? await supabase.from("leads").select("id").eq("phone", normalizedPhone).maybeSingle()
        : { data: null };
      const { data: leadByEmail } = !leadByPhone && parsed.email
        ? await supabase.from("leads").select("id").eq("email", parsed.email).maybeSingle()
        : { data: null };
      const existingLead = leadByPhone ?? leadByEmail;

      if (existingLead) {
        leadId = existingLead.id;
        const { error: uErr } = await supabase
          .from("leads")
          .update({
            status: "booked",
            interested_offer: offerName,
            desired_date: dateStr,
            party_size: parsed.partySize,
            occasion: parsed.special,
            updated_at: new Date().toISOString(),
          })
          .eq("id", leadId);
        if (uErr) throw new Error(`lead update: ${uErr.message}`);
      } else {
        const { data: lead, error: lErr } = await supabase
          .from("leads")
          .insert({
            first_name: parsed.firstName,
            last_name: parsed.lastName,
            email: parsed.email,
            phone: normalizedPhone,
            source_channel: "website",
            source_status: "confirmed",
            status: "booked",
            interested_offer: offerName,
            desired_date: dateStr,
            party_size: parsed.partySize,
            occasion: parsed.special,
            notes: "Réservation auto-importée depuis Google Calendar.",
          })
          .select("id")
          .single();
        if (lErr) throw new Error(`lead: ${lErr.message}`);
        leadId = lead.id;
      }

      const { error: bErr } = await supabase
        .from("bookings")
        .insert({
          customer_id: customerId,
          lead_id: leadId,
          booking_type: bookingType,
          date: dateStr,
          start_time: startTime,
          end_time: endTime,
          duration_hours: parsed.duration,
          offer_name: offerName,
          party_size: parsed.partySize,
          total_amount: parsed.total,
          deposit_amount: parsed.deposit,
          balance_due: balanceDue,
          deposit_paid: !!(parsed.deposit && parsed.deposit > 0),
          status: "confirmed",
          source_channel: "website",
          payment_method: "card_online",
          google_calendar_event_id: ev.id,
          notes: parsed.special,
        });
      if (bErr) throw new Error(`booking: ${bErr.message}`);

      summary.imported++;

      if (parsed.email) {
        const emailRes = await sendConfirmation(parsed.email, {
          firstName: parsed.firstName,
          dateFr: formatDateFr(startIso),
          startTime,
          duration: parsed.duration,
          partySize: parsed.partySize,
          offerName,
          total: parsed.total,
          deposit: parsed.deposit,
          balanceDue,
          special: parsed.special,
        });
        if (emailRes.sent) {
          summary.emailed++;
          await supabase.from("email_log").insert({
            lead_id: leadId,
            to_email: parsed.email,
            subject: `Votre sortie en mer est confirmée — ${formatDateFr(startIso)}`,
            source: "booking_confirmation",
          });
        } else if (emailRes.reason !== "RESEND_API_KEY absent") {
          summary.errors.push({ event: evSummary, reason: `mail: ${emailRes.reason}` });
        }
      }

      if (normalizedPhone) {
        const waRes = await sendWhatsappConfirmation(normalizedPhone, {
          firstName: parsed.firstName,
          dateFr: formatDateFr(startIso),
          startTime,
          offerName,
          deposit: parsed.deposit,
          balanceDue,
        });
        if (waRes.sent && waRes.text) {
          summary.whatsapp_sent++;
          const nowIso = new Date().toISOString();
          const { data: conv } = await supabase
            .from("conversations")
            .select("id, messages")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const newMsg = { from: "ai", text: waRes.text, at: nowIso };
          if (conv) {
            const prev = Array.isArray(conv.messages) ? conv.messages : [];
            await supabase
              .from("conversations")
              .update({ messages: [...prev, newMsg], updated_at: nowIso })
              .eq("id", conv.id);
          } else {
            await supabase.from("conversations").insert({
              lead_id: leadId,
              channel: "whatsapp",
              messages: [newMsg],
              created_at: nowIso,
              updated_at: nowIso,
            });
          }
          await supabase.from("leads").update({ last_interaction_at: nowIso }).eq("id", leadId);
        } else if (waRes.reason !== "BAILEYS_SERVICE_URL absent") {
          summary.errors.push({ event: evSummary, reason: `whatsapp: ${waRes.reason}` });
        }
      }
    } catch (e) {
      summary.errors.push({ event: evSummary, reason: String(e).slice(0, 300) });
    }
  }

  return new Response(JSON.stringify(summary, null, 2), {
    headers: { "content-type": "application/json" },
  });
});
