"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { parseIcsEvents, splitName, extractPhone } from "@/lib/ics";
import { buildNameChangeEmail } from "@/lib/email-templates";

// Adresses de l'entreprise elle-même — jamais des clients, même quand elles
// apparaissent comme "invité" d'un événement sans ORGANIZER distinct (cas
// fréquent sur le calendrier perso : auto-invitation à la création d'un
// événement). Les calendriers partagés Google utilisent en plus une adresse
// technique en @group.calendar.google.com comme organisateur ET invité.
const SELF_EMAILS = new Set(["next.yacht34@gmail.com", "harmonieyacht@gmail.com"]);
function isSelfEmail(email: string): boolean {
  const e = email.toLowerCase();
  return SELF_EMAILS.has(e) || e.endsWith("@group.calendar.google.com");
}

const ok = <T,>(data: T) => ({ ok: true as const, data, error: null });
const fail = (error: string) => ({ ok: false as const, data: null, error });

/**
 * Importe un fichier .ics exporté depuis l'ancien calendrier (Next Yacht) :
 * parse chaque événement, ignore l'organisateur (ce n'est pas un client),
 * crée une fiche `legacy_clients` par invité restant.
 *
 * Idempotent : réimporter le même fichier ne crée jamais de doublons — la clé
 * (uid événement, email) est unique en base, et un conflit met simplement à
 * jour la fiche existante plutôt que d'échouer.
 */
export async function importIcsFile(fileContent: string, fileName: string) {
  const supabase = await createClient();

  let events;
  try {
    events = parseIcsEvents(fileContent);
  } catch (e) {
    return fail(`Fichier illisible : ${e instanceof Error ? e.message : String(e)}`);
  }

  if (events.length === 0) {
    return fail("Aucun événement trouvé dans ce fichier — vérifie que c'est bien un export .ics.");
  }

  let imported = 0;
  let skippedNoAttendee = 0;
  const rows: Array<{
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
    offer_summary: string | null;
    event_date: string | null;
    event_year: number | null;
    ics_uid: string;
    raw_description: string | null;
    source_file: string;
  }> = [];

  for (const ev of events) {
    // Les invités = les clients. On exclut l'organisateur (le compte
    // next.yacht34@gmail.com lui-même) et tout email qui serait celui de
    // l'organisateur au cas où il apparaîtrait aussi comme invité.
    const clients = ev.attendees.filter(
      (a) =>
        a.email &&
        a.email.toLowerCase() !== (ev.organizerEmail ?? "").toLowerCase() &&
        !isSelfEmail(a.email),
    );
    if (clients.length === 0) {
      skippedNoAttendee++;
      continue;
    }

    const phone = extractPhone(ev.description ?? "");
    const year = ev.date ? Number(ev.date.slice(0, 4)) : null;

    for (const attendee of clients) {
      const { firstName, lastName } = splitName(attendee.name);
      rows.push({
        first_name: firstName,
        last_name: lastName,
        email: attendee.email,
        phone,
        offer_summary: ev.summary || null,
        event_date: ev.date,
        event_year: year,
        ics_uid: ev.uid,
        raw_description: ev.description || null,
        source_file: fileName,
      });
      imported++;
    }
  }

  if (rows.length === 0) {
    return fail(
      `${events.length} événement(s) lus, mais aucun n'a d'invité identifiable (hors organisateur) — rien à importer.`,
    );
  }

  const { error } = await supabase
    .from("legacy_clients")
    .upsert(rows, { onConflict: "ics_uid,email" });

  if (error) return fail(error.message);

  revalidatePath("/archives");
  return ok({ eventsRead: events.length, imported, skippedNoAttendee });
}

/**
 * Envoie la campagne "changement de nom" à une liste de clients archivés.
 *
 * Chaque envoi est indépendant : un échec (email invalide, Resend en erreur)
 * n'interrompt pas les suivants, et est enregistré tel quel — la page de
 * contrôle doit pouvoir montrer précisément qui a été touché et qui a échoué,
 * pas juste un statut global de la campagne.
 */
// URL du dashboard lui-même (pas harmonie-yacht.fr, qui est le site public
// hébergé ailleurs) — sert de base au lien de désabonnement. À remplacer par
// NEXT_PUBLIC_APP_URL une fois un domaine personnalisé branché sur Vercel.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ia-hy-infra-new.vercel.app";

export async function sendOutreachCampaign(legacyClientIds: string[], campaign: string) {
  const supabase = await createClient();
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM ?? "Harmonie Yacht <reservations@harmonie-yacht.fr>";

  if (!resendKey) {
    return fail("Resend non configuré (RESEND_API_KEY absent des variables d'environnement Vercel).");
  }
  if (legacyClientIds.length === 0) return fail("Aucun destinataire sélectionné.");

  const { data: clients, error: fetchErr } = await supabase
    .from("legacy_clients")
    .select("id, first_name, email")
    .in("id", legacyClientIds);
  if (fetchErr) return fail(fetchErr.message);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const client of clients ?? []) {
    if (!client.email) {
      skipped++;
      continue;
    }

    // Ne renvoie jamais deux fois la même campagne au même client : si une
    // ligne 'sent' existe déjà, on saute sans y toucher.
    const { data: existing } = await supabase
      .from("client_outreach")
      .select("id, status")
      .eq("legacy_client_id", client.id)
      .eq("campaign", campaign)
      .maybeSingle();
    if (existing?.status === "sent") {
      skipped++;
      continue;
    }

    // Liste de désabonnement globale, vérifiée à chaque envoi — un client
    // désinscrit ne doit plus jamais recevoir la moindre campagne.
    const { data: unsub } = await supabase
      .from("email_unsubscribes")
      .select("email")
      .eq("email", client.email)
      .maybeSingle();
    if (unsub) {
      await supabase.from("client_outreach").upsert(
        {
          legacy_client_id: client.id,
          campaign,
          status: "skipped",
          error: "Adresse désabonnée",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "legacy_client_id,campaign" },
      );
      skipped++;
      continue;
    }

    // La ligne outreach est créée AVANT l'envoi : son id sert de jeton de
    // désabonnement dans l'email lui-même (voir app/api/unsubscribe). Il faut
    // donc connaître cet id avant de composer le message.
    const { data: outreachRow, error: upsertErr } = await supabase
      .from("client_outreach")
      .upsert(
        {
          legacy_client_id: client.id,
          campaign,
          status: "sending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "legacy_client_id,campaign" },
      )
      .select("id")
      .single();
    if (upsertErr || !outreachRow) {
      failed++;
      continue;
    }

    const unsubscribeUrl = `${APP_URL}/api/unsubscribe?token=${outreachRow.id}`;
    const { subject, html, text } = buildNameChangeEmail(client.first_name, unsubscribeUrl);

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from: fromEmail, to: [client.email], subject, html, text }),
      });

      if (!res.ok) {
        const detail = await res.text();
        await supabase
          .from("client_outreach")
          .update({
            status: "failed",
            provider: "resend",
            error: `Resend ${res.status}: ${detail.slice(0, 300)}`,
            email_subject: subject,
            email_body_html: html,
            updated_at: new Date().toISOString(),
          })
          .eq("id", outreachRow.id);
        failed++;
        continue;
      }

      const data = (await res.json()) as { id?: string };
      await supabase
        .from("client_outreach")
        .update({
          status: "sent",
          provider: "resend",
          provider_message_id: data.id ?? null,
          error: null,
          email_subject: subject,
          email_body_html: html,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", outreachRow.id);
      sent++;
    } catch (e) {
      await supabase
        .from("client_outreach")
        .update({
          status: "failed",
          provider: "resend",
          error: e instanceof Error ? e.message : String(e),
          email_subject: subject,
          email_body_html: html,
          updated_at: new Date().toISOString(),
        })
        .eq("id", outreachRow.id);
      failed++;
    }
  }

  revalidatePath("/archives");
  return ok({ sent, failed, skipped });
}

export async function deleteLegacyClient(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("legacy_clients").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/archives");
  return ok(null);
}
