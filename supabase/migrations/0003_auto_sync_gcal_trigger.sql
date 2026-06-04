-- Trigger Postgres qui appelle sync-gcal automatiquement après chaque
-- INSERT / UPDATE / DELETE sur bookings et events_public.
-- Garantit que GCal reste synchronisé peu importe la source (site, dashboard,
-- app future, SQL manuel) — un seul point de vérité.

create extension if not exists pg_net with schema extensions;

-- Secret partagé avec l'Edge Function sync-gcal (stocké dans le vault).
-- ⚠️ À remplacer par votre propre secret avant de migrer un nouvel environnement.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'sync_gcal_secret') then
    perform vault.create_secret(
      'CHANGE_ME_BEFORE_DEPLOY',
      'sync_gcal_secret'
    );
  end if;
end $$;

create or replace function public.notify_sync_gcal()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $func$
declare
  v_action text;
  v_type   text := tg_argv[0];
  v_id     uuid;
  v_secret text;
begin
  if tg_op = 'DELETE' then
    v_action := 'delete';
    v_id     := old.id;
  else
    v_action := 'upsert';
    v_id     := new.id;

    -- Anti-boucle : si seul google_calendar_event_id / updated_at a changé,
    -- c'est sync-gcal qui écrit. On ne re-déclenche pas.
    if tg_op = 'UPDATE' and v_type = 'booking' then
      if (old.date           is not distinct from new.date
       and old.start_time    is not distinct from new.start_time
       and old.end_time      is not distinct from new.end_time
       and old.offer_name    is not distinct from new.offer_name
       and old.party_size    is not distinct from new.party_size
       and old.status        is not distinct from new.status
       and old.total_amount  is not distinct from new.total_amount
       and old.deposit_paid  is not distinct from new.deposit_paid
       and old.deposit_amount is not distinct from new.deposit_amount
       and old.balance_due   is not distinct from new.balance_due
       and old.source_channel is not distinct from new.source_channel
       and old.notes         is not distinct from new.notes) then
        return null;
      end if;
    end if;

    if tg_op = 'UPDATE' and v_type = 'event_public' then
      if (old.title             is not distinct from new.title
       and old.date             is not distinct from new.date
       and old.start_time       is not distinct from new.start_time
       and old.end_time         is not distinct from new.end_time
       and old.status           is not distinct from new.status
       and old.theme            is not distinct from new.theme
       and old.price_per_person is not distinct from new.price_per_person
       and old.max_participants is not distinct from new.max_participants) then
        return null;
      end if;
    end if;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'sync_gcal_secret';

  -- ⚠️ URL à adapter par projet
  perform net.http_post(
    url     := 'https://szdfpjyytwedhochvzfd.supabase.co/functions/v1/sync-gcal',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-sync-secret', v_secret
    ),
    body    := jsonb_build_object(
      'action', v_action,
      'type',   v_type,
      'id',     v_id
    )
  );

  return null;
end;
$func$;

drop trigger if exists trg_bookings_sync_gcal on bookings;
create trigger trg_bookings_sync_gcal
  after insert or update or delete on bookings
  for each row execute function public.notify_sync_gcal('booking');

drop trigger if exists trg_events_public_sync_gcal on events_public;
create trigger trg_events_public_sync_gcal
  after insert or update or delete on events_public
  for each row execute function public.notify_sync_gcal('event_public');
