// Supabase Edge Function — gcal-list
//
// Liste les events du calendrier Google sur une plage de dates donnée.
// Outil de back-office : utile pour ré-aligner Supabase avec GCal
// (import initial, audit de cohérence, recherche d'event ID…).
//
// Body : { timeMin: ISO, timeMax: ISO }
// Auth : header `x-sync-secret` (même que sync-gcal).

import { createClient } from "npm:@supabase/supabase-js@2";
import { gcalFromAccount } from "../_shared/google-calendar.ts";

const SYNC_SECRET = Deno.env.get("SYNC_GCAL_SECRET") ?? "";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    if (SYNC_SECRET && req.headers.get("x-sync-secret") !== SYNC_SECRET) {
      return json({ error: "unauthorized" }, 401);
    }

    const { timeMin, timeMax } = await req.json();
    if (!timeMin || !timeMax) return json({ error: "timeMin et timeMax requis (ISO)" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const gcal = await gcalFromAccount(supabase);
    if (!gcal) return json({ error: "Google non connecté" }, 503);
    const calId = gcal.calendarId;
    const token = await gcal.token();
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return json({ error: `gcal ${res.status}: ${await res.text()}` }, 502);
    const data = await res.json();
    const events = (data.items ?? []).map((ev: any) => ({
      id: ev.id,
      summary: ev.summary ?? "",
      description: ev.description ?? "",
      start: ev.start?.dateTime ?? ev.start?.date ?? "",
      end: ev.end?.dateTime ?? ev.end?.date ?? "",
      creator: ev.creator?.email ?? "",
      organizer: ev.organizer?.email ?? "",
      location: ev.location ?? "",
    }));
    return json({ count: events.length, events });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
