-- Le trigger `bookings_to_revenues` existait déjà en base (créé hors
-- migrations, jamais versionné) mais avait un vrai bug : il insérait un
-- revenu à chaque acompte/solde encaissé, mais ne le retirait JAMAIS quand
-- la réservation était annulée, ni quand un paiement était corrigé/retiré.
-- Résultat : l'argent d'une résa annulée restait compté dans Finances.
--
-- Cette migration :
--   1. Ajoute revenues.booking_id (lien 1↔1 avec la réservation source).
--   2. Supprime les anciennes lignes auto-générées (reconnaissables à leur
--      note "(booking <uuid>)") — les entrées manuelles ne contenant pas ce
--      motif sont préservées telles quelles.
--   3. Remplace la fonction du trigger par une version idempotente : à
--      chaque INSERT/UPDATE d'une réservation, elle recalcule le montant
--      réellement encaissé (total_amount − balance_due, 0 si annulée) et
--      UPSERT une unique ligne revenues par réservation — jamais de doublon,
--      jamais de résidu après annulation ou retrait de paiement.
--   4. Force un re-passage du trigger sur toutes les réservations
--      existantes pour regénérer proprement les lignes consolidées.

begin;

alter table public.revenues
  add column if not exists booking_id uuid references public.bookings(id) on delete cascade;

create unique index if not exists idx_revenues_booking_id_unique
  on public.revenues(booking_id)
  where booking_id is not null;

-- Purge des anciennes lignes auto-générées (motif "(booking <uuid>)" dans la note).
-- Les entrées manuelles (sans ce motif) ne sont pas touchées.
delete from public.revenues
where note ~ 'booking [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

create or replace function public.bookings_to_revenues()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_type text;
  v_collected numeric;
begin
  v_type := case coalesce(new.booking_type, '')
    when 'sortie_privative' then 'sea_trip'
    when 'nuit_prestige'    then 'unusual_night'
    when 'nuit_insolite'    then 'unusual_night'
    else 'other'
  end;

  -- Réservation annulée = plus rien de compté, même si un acompte avait
  -- été encaissé avant l'annulation.
  if new.status = 'cancelled' then
    v_collected := 0;
  else
    v_collected := greatest(0, coalesce(new.total_amount, 0) - coalesce(new.balance_due, 0));
  end if;

  if v_collected <= 0 then
    delete from revenues where booking_id = new.id;
    return null;
  end if;

  insert into revenues (booking_id, date, type, amount, note)
  values (
    new.id,
    coalesce(new.date, new.created_at::date, current_date),
    v_type,
    v_collected,
    format('Encaissé — %s', coalesce(new.offer_name, '—'))
  )
  on conflict (booking_id) where booking_id is not null
  do update set
    date   = excluded.date,
    type   = excluded.type,
    amount = excluded.amount,
    note   = excluded.note;

  return null;
end;
$function$;

drop trigger if exists trg_bookings_to_revenues on public.bookings;
create trigger trg_bookings_to_revenues
  after insert or update on public.bookings
  for each row execute function public.bookings_to_revenues();

-- Force le trigger à repasser sur toutes les réservations existantes pour
-- régénérer les lignes consolidées (une seule par réservation, montant
-- correct, absente si annulée). Ne modifie aucune autre colonne — le
-- trigger trg_bookings_sync_gcal ignore les updates qui ne touchent que
-- updated_at (aucun impact sur Google Agenda).
update public.bookings set updated_at = now();

commit;
