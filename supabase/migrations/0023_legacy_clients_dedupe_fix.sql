-- Correction : un même événement .ics peut avoir plusieurs invités (couple,
-- amis réservant ensemble) — chacun doit devenir un client distinct. La
-- déduplication doit donc porter sur (uid événement, email), pas sur l'uid
-- seul, sinon le 2e invité d'un même événement serait rejeté au réimport.
alter table legacy_clients drop constraint if exists legacy_clients_ics_uid_key;
alter table legacy_clients alter column event_year drop not null;
create unique index if not exists legacy_clients_uid_email_idx on legacy_clients (ics_uid, email);
