-- 0038 — Accès en lecture seule pour le tableau de pilotage d'Harmonie Group.
--
-- Le tableau du groupe lit les encaissements d'Harmonie Yacht SANS rien écrire
-- et sans passer par les tables internes : il ne voit que la vue
-- groupe.encaissements, qui ne contient AUCUNE donnée personnelle de client
-- (ni nom, ni téléphone, ni e-mail, ni notes libres).
--
-- Le rôle groupe_lecture_hy est créé SANS mot de passe : il ne peut pas se
-- connecter tant que Robin n'en a pas défini un lui-même dans Supabase
-- (SQL Editor : alter role groupe_lecture_hy password '…';).

create schema if not exists groupe;

create or replace view groupe.encaissements as
select
  r.id::text                                   as id_transaction,
  r.date                                       as date,
  r.amount                                     as montant_ttc,
  case lower(coalesce(b.payment_method, ''))
    when 'sumup'       then 'SumUp'
    when 'stripe'      then 'Stripe'
    when 'card_online' then 'Carte en ligne'
    when 'transfer'    then 'Virement'
    when 'cash'        then 'Espèces'
    when 'partner'     then 'Partenaire'
    else 'Inconnu'
  end                                          as moyen,
  case when b.status = 'cancelled' then 'annulé' else 'encaissé' end as statut,
  r.type                                       as type_prestation,
  r.payment_kind                               as nature_paiement
from public.revenues r
left join public.bookings b on b.id = r.booking_id;

comment on view groupe.encaissements is
  'Encaissements Harmonie Yacht pour le tableau de pilotage du groupe. Lecture seule, sans donnée personnelle.';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'groupe_lecture_hy') then
    create role groupe_lecture_hy login nosuperuser nocreatedb nocreaterole noinherit nobypassrls connection limit 5;
  end if;
end $$;

alter role groupe_lecture_hy set statement_timeout = '10s';
alter role groupe_lecture_hy set search_path = groupe;

revoke all on schema groupe from public;
revoke all on all tables in schema groupe from public;
grant usage on schema groupe to groupe_lecture_hy;
revoke all on groupe.encaissements from groupe_lecture_hy;
grant select on groupe.encaissements to groupe_lecture_hy;
