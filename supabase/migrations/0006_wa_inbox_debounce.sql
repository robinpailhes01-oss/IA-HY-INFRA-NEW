-- Buffer d'entrée WhatsApp pour debouncing.
-- Quand un client envoie plusieurs messages rapprochés (typique : « Bonjour »
-- + « Je veux savoir vos tarifs »), Meta appelle le webhook plusieurs fois.
-- Sans buffer, Léa était appelée en parallèle et envoyait plusieurs réponses
-- redondantes — parfois quasi à l'identique, parfois une note méta interne.
-- On bufferise 6s : le DERNIER message reçu pour un numéro déclenche l'appel
-- à Léa avec TOUS les messages non-traités concaténés.

create table if not exists public.wa_inbox (
  id            bigserial primary key,
  wa_message_id text not null unique,
  phone         text not null,
  text          text not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists wa_inbox_phone_pending_idx
  on public.wa_inbox (phone, received_at)
  where processed_at is null;

create index if not exists wa_inbox_received_idx
  on public.wa_inbox (received_at);

alter table public.wa_inbox enable row level security;
-- Aucune policy : seule la service role (edge function) y accède.

-- Cleanup : on garde 7 jours pour le debug, puis purge.
create or replace function public.wa_inbox_cleanup()
returns void
language sql
as $$
  delete from public.wa_inbox where received_at < now() - interval '7 days';
$$;
