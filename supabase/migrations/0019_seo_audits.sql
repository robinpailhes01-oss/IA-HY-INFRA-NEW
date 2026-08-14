-- Audits SEO / GEO — historique des passages de l'agent Auditeur.
--
-- Une ligne = un audit complet du site public. Les contrôles sont stockés en
-- JSONB plutôt qu'en colonnes : la liste évolue (on ajoutera le suivi de
-- positions, les citations IA…) sans migration à chaque fois.
--
-- Le score est volontairement un simple ratio "contrôles conformes / total" :
-- il doit rester explicable en une phrase à quelqu'un qui n'y connaît rien.

create table if not exists seo_audits (
  id uuid primary key default gen_random_uuid(),
  site_url text not null,
  run_at timestamptz not null default now(),

  score int not null check (score >= 0 and score <= 100),
  checks_passed int not null default 0,
  checks_total int not null default 0,
  critical_count int not null default 0,
  warning_count int not null default 0,

  -- [{ key, label, why, severity: critical|warning, status: pass|fail, detail }]
  checks jsonb not null default '[]'::jsonb,
  -- [{ url, status, bytes, text_length, title, description, h1_count }]
  pages jsonb not null default '[]'::jsonb,

  duration_ms int,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists seo_audits_run_at_idx on seo_audits (run_at desc);

alter table seo_audits enable row level security;

drop policy if exists "Authenticated users full access" on seo_audits;
create policy "Authenticated users full access"
  on seo_audits for all
  to authenticated
  using (true)
  with check (true);
