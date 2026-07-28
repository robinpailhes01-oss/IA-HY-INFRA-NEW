-- Permet au Manager Telegram de modifier la configuration de Léa (offres,
-- tarifs, règles) — mais JAMAIS en un seul coup. Le flux est toujours :
--   1. propose_config_change → écrit une ligne "pending" ici, ne touche
--      PAS agent_config. Le Manager décrit le changement et demande
--      confirmation à Robin.
--   2. confirm_pending_change → SEULEMENT si Robin confirme explicitement
--      dans son message suivant → applique réellement le changement à
--      agent_config et journalise dans agent_config_history.
-- Aucun tool ne peut modifier agent_config directement — la mutation ne
-- se produit que dans le second temps, garantissant qu'un message ambigu
-- ou mal interprété ne casse jamais silencieusement la config de Léa.

create table if not exists public.agent_config_pending_changes (
  id          uuid primary key default gen_random_uuid(),
  chat_id     text not null,
  column_name text not null,
  key_name    text,
  old_value   jsonb,
  new_value   jsonb not null,
  description text not null,
  status      text not null default 'pending', -- pending | applied | cancelled
  created_at  timestamptz not null default now()
);

create index if not exists idx_agent_config_pending_chat
  on public.agent_config_pending_changes(chat_id, status);

create table if not exists public.agent_config_history (
  id          uuid primary key default gen_random_uuid(),
  applied_at  timestamptz not null default now(),
  column_name text not null,
  key_name    text,
  old_value   jsonb,
  new_value   jsonb not null,
  description text not null,
  source      text not null default 'telegram-manager'
);

alter table public.agent_config_pending_changes enable row level security;
alter table public.agent_config_history enable row level security;

create policy "Authenticated users full access"
  on public.agent_config_pending_changes for all to authenticated
  using (true) with check (true);

create policy "Authenticated users full access"
  on public.agent_config_history for all to authenticated
  using (true) with check (true);
