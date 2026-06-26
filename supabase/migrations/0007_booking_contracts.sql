-- Contrats de location : on garde une trace de la signature côté DB.
-- Le contrat lui-même est généré en HTML imprimable depuis les infos
-- existantes (client + booking) — pas de stockage de PDF. Cette migration
-- ajoute juste les champs pour marquer un contrat comme signé.

alter table public.bookings
  add column if not exists contract_signed_at timestamptz,
  add column if not exists contract_signed_by_name text;

create index if not exists bookings_contract_signed_at_idx
  on public.bookings (contract_signed_at)
  where contract_signed_at is not null;
