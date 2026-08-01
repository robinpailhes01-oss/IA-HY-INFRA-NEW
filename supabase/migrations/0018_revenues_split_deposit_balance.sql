-- Suite du fix 0017 : Robin précise la règle métier exacte —
--   - l'ACOMPTE compte pour le jour où il a été réellement payé (souvent
--     à la réservation) ;
--   - le SOLDE compte pour le jour DE LA SORTIE, pas le jour où
--     l'encaissement est validé dans l'outil (le solde est en pratique
--     remis le jour même du départ, même si Robin ne coche la case
--     qu'après coup).
-- Une seule ligne revenues par réservation ne peut pas porter deux dates
-- différentes → on passe à DEUX lignes par réservation (acompte / solde),
-- chacune avec sa propre date.

begin;

alter table public.revenues
  add column if not exists payment_kind text
    check (payment_kind is null or payment_kind in ('deposit', 'balance'));

-- Les lignes existantes liées à une résa mélangent acompte+solde sous une
-- seule date : on les supprime pour les regénérer proprement ci-dessous.
-- Les entrées manuelles (booking_id null) ne sont pas touchées.
delete from public.revenues where booking_id is not null;

drop index if exists idx_revenues_booking_id_unique;
create unique index if not exists idx_revenues_booking_id_kind_unique
  on public.revenues(booking_id, payment_kind)
  where booking_id is not null;

create or replace function public.bookings_to_revenues()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_type text;
  v_total_collected numeric;
  v_deposit_collected numeric;
  v_balance_collected numeric;
  v_prev_deposit_amount numeric;
  v_deposit_date date;
begin
  v_type := case coalesce(new.booking_type, '')
    when 'sortie_privative' then 'sea_trip'
    when 'nuit_prestige'    then 'unusual_night'
    when 'nuit_insolite'    then 'unusual_night'
    else 'other'
  end;

  if new.status = 'cancelled' then
    v_total_collected := 0;
  else
    v_total_collected := greatest(0, coalesce(new.total_amount, 0) - coalesce(new.balance_due, 0));
  end if;

  if v_total_collected <= 0 then
    delete from revenues where booking_id = new.id;
    return null;
  end if;

  v_deposit_collected := least(v_total_collected, greatest(0, coalesce(new.deposit_amount, 0)));
  v_balance_collected := v_total_collected - v_deposit_collected;

  -- Acompte : daté le jour où il a été réellement payé. Figé une fois
  -- posé, sauf si le montant d'acompte collecté augmente (nouvel argent
  -- réellement encaissé maintenant) — même logique que 0017.
  if v_deposit_collected <= 0 then
    delete from revenues where booking_id = new.id and payment_kind = 'deposit';
  else
    select amount, date into v_prev_deposit_amount, v_deposit_date
    from revenues where booking_id = new.id and payment_kind = 'deposit';

    if v_prev_deposit_amount is null or v_deposit_collected > v_prev_deposit_amount then
      v_deposit_date := current_date;
    end if;

    insert into revenues (booking_id, payment_kind, date, type, amount, note)
    values (new.id, 'deposit', v_deposit_date, v_type, v_deposit_collected, format('Acompte — %s', coalesce(new.offer_name, '—')))
    on conflict (booking_id, payment_kind) where booking_id is not null
    do update set date = excluded.date, type = excluded.type, amount = excluded.amount, note = excluded.note;
  end if;

  -- Solde : toujours daté le jour de la sortie — c'est là que l'argent
  -- change réellement de main, indépendamment du jour où l'encaissement
  -- est validé dans l'outil.
  if v_balance_collected <= 0 then
    delete from revenues where booking_id = new.id and payment_kind = 'balance';
  else
    insert into revenues (booking_id, payment_kind, date, type, amount, note)
    values (new.id, 'balance', coalesce(new.date, current_date), v_type, v_balance_collected, format('Solde — %s', coalesce(new.offer_name, '—')))
    on conflict (booking_id, payment_kind) where booking_id is not null
    do update set date = excluded.date, type = excluded.type, amount = excluded.amount, note = excluded.note;
  end if;

  return null;
end;
$function$;

-- Regénère les lignes pour toutes les réservations existantes. Pour
-- l'historique, faute d'avoir jamais enregistré la date exacte de
-- paiement de l'acompte, on utilise created_at de la résa comme meilleure
-- estimation (même logique que le fix 0014) ; le solde, lui, est connu
-- avec certitude : c'est toujours la date de sortie de la résa.
with calc as (
  select
    b.id as booking_id,
    b.date as outing_date,
    b.created_at::date as created_date,
    case coalesce(b.booking_type, '')
      when 'sortie_privative' then 'sea_trip'
      when 'nuit_prestige'    then 'unusual_night'
      when 'nuit_insolite'    then 'unusual_night'
      else 'other'
    end as v_type,
    b.offer_name,
    greatest(0, coalesce(b.total_amount, 0) - coalesce(b.balance_due, 0)) as total_collected,
    least(
      greatest(0, coalesce(b.total_amount, 0) - coalesce(b.balance_due, 0)),
      greatest(0, coalesce(b.deposit_amount, 0))
    ) as deposit_collected
  from public.bookings b
  where b.status <> 'cancelled'
)
insert into public.revenues (booking_id, payment_kind, date, type, amount, note)
select booking_id, 'deposit', created_date, v_type, deposit_collected, format('Acompte — %s', coalesce(offer_name, '—'))
from calc where deposit_collected > 0
union all
select booking_id, 'balance', coalesce(outing_date, created_date), v_type, (total_collected - deposit_collected), format('Solde — %s', coalesce(offer_name, '—'))
from calc where (total_collected - deposit_collected) > 0
on conflict (booking_id, payment_kind) where booking_id is not null
do update set date = excluded.date, type = excluded.type, amount = excluded.amount, note = excluded.note;

commit;
