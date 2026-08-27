-- Historique permanent des statistiques de visite du site (Vercel Web
-- Analytics ne garde que 30 jours en plan Hobby) — un instantané par jour et
-- par projet Vercel, alimenté par une synchro quotidienne (voir
-- app/api/analytics/sync).
create table analytics_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  vercel_project_id text not null,
  snapshot_date date not null,
  visitors integer not null default 0,
  pageviews integer not null default 0,
  -- [{ hostname: string, visitors: number, pageviews: number }, ...]
  top_referrers jsonb not null default '[]'::jsonb,
  -- [{ path: string, visitors: number, pageviews: number }, ...]
  top_pages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vercel_project_id, snapshot_date)
);

create index analytics_daily_snapshots_date_idx
  on analytics_daily_snapshots (vercel_project_id, snapshot_date desc);

alter table analytics_daily_snapshots enable row level security;

-- Lecture réservée au dashboard (utilisateurs connectés) ; l'écriture ne
-- passe que par la route de synchro, avec la clé service-role (contourne
-- RLS), jamais par un client authentifié classique.
create policy "Authenticated users can read analytics snapshots"
  on analytics_daily_snapshots for select
  to authenticated
  using (true);
