-- Mémoire de conversation pour l'agent Manager Telegram (edge function
-- telegram-manager). Une ligne par chat_id — un seul propriétaire attendu,
-- mais on garde la structure générique par sécurité.

create table if not exists public.telegram_manager_conversations (
  id         uuid primary key default gen_random_uuid(),
  chat_id    text unique not null,
  messages   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_manager_conversations enable row level security;

create policy "Authenticated users full access"
  on public.telegram_manager_conversations for all to authenticated
  using (true) with check (true);
