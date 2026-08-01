-- Bug découvert en usage réel (Ali Labrag, Aurore Moneta — résa du 1er
-- août) : le trigger bookings_to_revenues (0013) fige la date d'une ligne
-- revenues à la toute première fois où de l'argent est enregistré comme
-- encaissé sur une réservation (typiquement l'acompte, à la création). Un
-- solde encaissé bien plus tard — même un autre mois — met à jour le
-- montant mais garde l'ANCIENNE date : l'argent réellement collecté
-- aujourd'hui se retrouve compté sur le mois de l'acompte, invisible dans
-- le CA du mois en cours.
--
-- Correctif : la date avance à current_date UNIQUEMENT quand le montant
-- réellement collecté (v_collected) AUGMENTE par rapport à la ligne
-- existante — c'est-à-dire quand du nouvel argent est réellement encaissé
-- (acompte, puis solde plus tard). Si le montant reste identique ou
-- diminue (simple correction, retrait d'un paiement), la date d'origine
-- est conservée — comportement du fix 0013 préservé pour ce cas-là.

begin;

create or replace function public.bookings_to_revenues()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_type text;
  v_collected numeric;
  v_prev_amount numeric;
  v_date date;
begin
  v_type := case coalesce(new.booking_type, '')
    when 'sortie_privative' then 'sea_trip'
    when 'nuit_prestige'    then 'unusual_night'
    when 'nuit_insolite'    then 'unusual_night'
    else 'other'
  end;

  if new.status = 'cancelled' then
    v_collected := 0;
  else
    v_collected := greatest(0, coalesce(new.total_amount, 0) - coalesce(new.balance_due, 0));
  end if;

  if v_collected <= 0 then
    delete from revenues where booking_id = new.id;
    return null;
  end if;

  select amount, date into v_prev_amount, v_date
  from revenues where booking_id = new.id;

  if v_prev_amount is null or v_collected > v_prev_amount then
    -- Pas encore de ligne (1er encaissement) ou nouvel argent réellement
    -- collecté maintenant (ex: solde payé après l'acompte) → daté aujourd'hui.
    v_date := current_date;
  end if;
  -- Sinon (montant identique ou en baisse = correction) : v_date garde la
  -- valeur déjà lue en base, inchangée.

  insert into revenues (booking_id, date, type, amount, note)
  values (
    new.id,
    v_date,
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

-- Corrige rétroactivement les deux réservations à l'origine du bug : le
-- solde a été réellement encaissé le 01/08 (updated_at), pas à la date de
-- création de la résa.
update public.revenues r
set date = b.updated_at::date
from public.bookings b
where r.booking_id = b.id
  and b.id in ('16e72e9c-5e63-4efb-9668-2c9682e9d3e6', 'b6e0ee5b-0564-4aa5-aa82-dd6914e64649');

commit;
