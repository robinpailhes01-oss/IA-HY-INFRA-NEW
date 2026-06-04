// Supabase Edge Function — sync-gcal
//
// Synchronise UN booking (ou event_public) vers Google Calendar.
// Appelée depuis les Server Actions Next.js après chaque création /
// modification / annulation de réservation.
//
// POST body :
//   { action: "upsert" | "delete", type: "booking" | "event_public", id: string }
//
// Secrets requis (Supabase → Edge Functions → Secrets) :
//   GOOGLE_CALENDAR_ID                  ID du calendrier (ex: xxx@group.calendar.google.com)
//   GOOGLE_SERVICE_ACCOUNT_EMAIL        client_email du fichier JSON
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  private_key du fichier JSON
//   SYNC_GCAL_SECRET                    (optionnel) clé partagée avec les Server Actions
//
// Couleurs GCal (colorId) :
//   "2" = Sauge   → sortie privative confirmée
//   "5" = Banane  → en attente d'acompte
//   "4" = Flamant → annulé / à ignorer
//   "3" = Raisin  → événement public

import { createClient } from "npm:@supabase/supabase-js@2";
import { gcalFromEnv, type GCalEvent } from "../_shared/google-calendar.ts";

const SYNC_SECRET = Deno.env.get("SYNC_GCAL_SECRET") ?? "";
const TZ = "Europe/Paris";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

// Construit le body GCal depuis un booking Supabase.
function bookingToEvent(b: Record<string, any>): GCalEvent {
  const dateStr = b.date as string; // YYYY-MM-DD
  const startTime = (b.start_time as string)?.slice(0, 5) ?? "00:00";
  const endTime = (b.end_time as string)?.slice(0, 5) ?? "00:00";

  const statusLabel: Record<string, string> = {
    confirmed: "✅",
    pending: "⏳",
    cancelled: "❌",
    completed: "🏁",
  };
  const icon = statusLabel[b.status as string] ?? "📅";

  const name = [b.offer_name, b.party_size ? `(${b.party_size} pers.)` : ""].filter(Boolean).join(" ");
  const colorId = b.status === "confirmed" ? "2" : b.status === "pending" ? "5" : "4";

  const lines: string[] = [
    `Offre : ${b.offer_name ?? "—"}`,
    `Personnes : ${b.party_size ?? "—"}`,
    `Montant total : ${b.total_amount ? `${b.total_amount} €` : "—"}`,
    `Acompte payé : ${b.deposit_paid ? "Oui" : "Non"}`,
    `Statut : ${b.status ?? "—"}`,
    `Canal : ${b.source_channel ?? "—"}`,
  ];
  if (b.notes) lines.push(`Notes : ${b.notes}`);

  return {
    summary: `${icon} Harmonie Yacht — ${name}`,
    description: lines.join("\n"),
    location: "Port de Carnon, Hérault, France",
    start: { dateTime: `${dateStr}T${startTime}:00`, timeZone: TZ },
    end: { dateTime: `${dateStr}T${endTime}:00`, timeZone: TZ },
    colorId,
  };
}

// Construit le body GCal depuis un event public Supabase.
function publicEventToGCal(ev: Record<string, any>): GCalEvent {
  const dateStr = ev.date as string;
  const startTime = (ev.start_time as string)?.slice(0, 5) ?? "00:00";
  const endTime = (ev.end_time as string)?.slice(0, 5) ?? "00:00";

  return {
    summary: `🎉 ${ev.title ?? "Événement Harmonie Yacht"}`,
    description: [
      `Thème : ${ev.theme ?? "—"}`,
      `Prix / pers. : ${ev.price_per_person ? `${ev.price_per_person} €` : "—"}`,
      `Inscrits : ${ev.current_bookings ?? 0} / ${ev.max_participants ?? "—"}`,
    ].join("\n"),
    location: "Port de Carnon, Hérault, France",
    start: { dateTime: `${dateStr}T${startTime}:00`, timeZone: TZ },
    end: { dateTime: `${dateStr}T${endTime}:00`, timeZone: TZ },
    colorId: "3",
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (SYNC_SECRET && req.headers.get("x-sync-secret") !== SYNC_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: { action?: string; type?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON invalide" }, 400);
  }

  const { action, type, id } = body;
  if (!action || !type || !id) {
    return json({ error: "action, type et id sont requis" }, 400);
  }
  if (!["upsert", "delete"].includes(action)) {
    return json({ error: "action doit être 'upsert' ou 'delete'" }, 400);
  }
  if (!["booking", "event_public"].includes(type)) {
    return json({ error: "type doit être 'booking' ou 'event_public'" }, 400);
  }

  const gcal = gcalFromEnv();
  if (!gcal) {
    // Pas de credentials → on log mais on ne bloque pas le caller.
    console.warn("sync-gcal: GOOGLE_* secrets absents, synchronisation ignorée.");
    return json({ skipped: "google_credentials_missing" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const table = type === "booking" ? "bookings" : "events_public";

  // ── DELETE ──────────────────────────────────────────────────────────
  if (action === "delete") {
    const { data } = await supabase
      .from(table)
      .select("google_calendar_event_id")
      .eq("id", id)
      .maybeSingle();
    const gcalId = data?.google_calendar_event_id as string | null;
    if (gcalId) {
      await gcal.deleteEvent(gcalId);
      await supabase.from(table).update({ google_calendar_event_id: null }).eq("id", id);
    }
    return json({ deleted: true, gcal_event_id: gcalId });
  }

  // ── UPSERT ──────────────────────────────────────────────────────────
  const { data: row, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error || !row) return json({ error: error?.message ?? "Enregistrement introuvable" }, 404);

  // Les réservations annulées : on supprime l'event GCal.
  if (type === "booking" && (row.status === "cancelled" || row.status === "refunded")) {
    const gcalId = row.google_calendar_event_id as string | null;
    if (gcalId) {
      await gcal.deleteEvent(gcalId);
      await supabase.from(table).update({ google_calendar_event_id: null }).eq("id", id);
      return json({ deleted: true, reason: "booking_cancelled", gcal_event_id: gcalId });
    }
    return json({ skipped: "already_no_gcal_event" });
  }

  const event = type === "booking" ? bookingToEvent(row) : publicEventToGCal(row);
  const existingId = row.google_calendar_event_id as string | null;

  let gcalEventId: string;
  if (existingId) {
    await gcal.updateEvent(existingId, event);
    gcalEventId = existingId;
  } else {
    gcalEventId = await gcal.createEvent(event);
    await supabase.from(table).update({ google_calendar_event_id: gcalEventId }).eq("id", id);
  }

  return json({ upserted: true, gcal_event_id: gcalEventId });
});
