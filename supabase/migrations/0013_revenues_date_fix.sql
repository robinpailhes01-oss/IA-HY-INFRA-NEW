-- Bug découvert en usage réel : le trigger bookings_to_revenues (migration
-- 0011) datait la ligne revenues par la DATE DE SORTIE de la réservation
-- (new.date), pas par la date d'encaissement réel. Résultat : l'argent
-- collecté aujourd'hui pour une sortie future (ex. en août) était rangé
-- sous une date d'août — invisible dans la vue "mois courant" de Finances,
-- qui filtre par défaut sur le mois en cours. D'où l'impression que rien
-- ne se mettait à jour.
--
-- Correctif : la date d'une ligne revenues reflète désormais le jour où
-- l'argent a été enregistré comme encaissé (current_date), fixée UNE FOIS
-- à la création de la ligne — les mises à jour suivantes (nouveau
-- paiement, montant corrigé...) ne déplacent plus cette date, seul le
-- montant/type/note sont rafraîchis.

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

  insert into revenues (booking_id, date, type, amount, note)
  values (
    new.id,
    current_date,
    v_type,
    v_collected,
    format('Encaissé — %s', coalesce(new.offer_name, '—'))
  )
  on conflict (booking_id) where booking_id is not null
  do update set
    type   = excluded.type,
    amount = excluded.amount,
    note   = excluded.note;
  -- `date` volontairement absent du do update : la date d'encaissement
  -- initiale ne bouge plus quand on corrige juste un montant plus tard.

  return null;
end;
$function$;

-- Corrige rétroactivement les lignes déjà créées par la migration 0011
-- (datées par erreur avec la date de sortie). On utilise updated_at de la
-- réservation liée comme date de référence — bien plus proche de la date
-- réelle d'encaissement que la date de sortie, et surtout ça évite de
-- tout regrouper artificiellement sur la date du jour (qui écraserait
-- l'historique réel des transactions passées).
update public.revenues r
set date = b.updated_at::date
from public.bookings b
where r.booking_id = b.id;

commit;
