-- Cartes cadeaux : une carte cadeau = une réservation pré-payée mais sans
-- date encore fixée. Le bénéficiaire revient plus tard et on lui attribue
-- une date — la carte devient alors une réservation normale.
--
-- Choix d'archi : on étend la table bookings au lieu de créer une table
-- dédiée. Avantages : un seul flux d'encaissement/comptabilité/contrat,
-- la carte cadeau apparaît dans la liste des « réservations à traiter »
-- jusqu'à ce qu'elle soit consommée.

-- 1) `date` devient nullable (NULL = carte cadeau en attente d'utilisation).
alter table public.bookings
  alter column date drop not null;

-- 2) Champs spécifiques aux cartes cadeaux.
alter table public.bookings
  add column if not exists is_gift_card boolean not null default false,
  add column if not exists gift_card_code text,
  add column if not exists gift_card_recipient_name text;

-- Code unique quand il est renseigné (collision improbable mais sécurise).
create unique index if not exists bookings_gift_card_code_uniq
  on public.bookings (gift_card_code)
  where gift_card_code is not null;

-- Index pour retrouver vite les cartes cadeaux en attente d'utilisation.
create index if not exists bookings_gift_card_pending_idx
  on public.bookings (created_at desc)
  where is_gift_card = true and date is null;

-- 3) Skip de la sync Google Calendar tant qu'une carte cadeau n'a pas
--    de date. Sinon l'edge function sync-gcal essaie de créer un event
--    avec une date NULL → erreur.
create or replace function public.notify_sync_gcal()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
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

    -- Pour les bookings : pas de sync GCal tant qu'il n'y a pas de date
    -- (typiquement une carte cadeau non encore utilisée).
    if v_type = 'booking' and new.date is null then
      return null;
    end if;

    -- Anti-boucle : si seul google_calendar_event_id (ou updated_at) a changé,
    -- c'est l'Edge Function sync-gcal qui écrit. On ne re-déclenche pas.
    if tg_op = 'UPDATE' and v_type = 'booking' then
      if (old.date              is not distinct from new.date
       and old.start_time        is not distinct from new.start_time
       and old.end_time          is not distinct from new.end_time
       and old.offer_name        is not distinct from new.offer_name
       and old.party_size        is not distinct from new.party_size
       and old.status            is not distinct from new.status
       and old.total_amount      is not distinct from new.total_amount
       and old.deposit_paid      is not distinct from new.deposit_paid
       and old.deposit_amount    is not distinct from new.deposit_amount
       and old.balance_due       is not distinct from new.balance_due
       and old.source_channel    is not distinct from new.source_channel
       and old.notes             is not distinct from new.notes) then
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

  -- Récupère le secret du vault.
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'sync_gcal_secret';

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
$function$;
