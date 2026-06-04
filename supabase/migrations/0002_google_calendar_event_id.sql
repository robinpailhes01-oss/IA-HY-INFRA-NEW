-- Synchronisation Google Calendar : colonne pour stocker l'ID de l'event GCal
-- associé à chaque booking, et pour les events_public.
-- Idempotent.

begin;

alter table bookings add column if not exists google_calendar_event_id text;
alter table events_public add column if not exists google_calendar_event_id text;

-- Index pour retrouver rapidement un booking depuis un event GCal
-- (utile si on reçoit un webhook GCal à l'avenir).
create index if not exists idx_bookings_gcal_event_id
  on bookings (google_calendar_event_id)
  where google_calendar_event_id is not null;

commit;
