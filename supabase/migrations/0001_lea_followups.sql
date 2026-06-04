-- Relances automatiques de Léa : suivi du nombre de relances envoyées par lead.
-- Idempotent (mêmes conventions que supabase/seed.sql).
-- Consommé par l'Edge Function `lea-followups`.

begin;

alter table leads add column if not exists followup_count integer not null default 0;
alter table leads add column if not exists last_followup_at timestamptz;

-- Accélère la sélection des candidats à la relance (statut actif + dernière relance).
create index if not exists idx_leads_followup
  on leads (status, last_followup_at)
  where needs_human_intervention = false;

commit;
