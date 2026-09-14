-- Mesure d'audience du site, en propre (sans dépendre de Vercel Web Analytics).
--
-- Pourquoi ne pas utiliser Vercel : Web Analytics n'est pas activé sur le projet
-- du site, et l'activer demande de toute façon de toucher au code du site
-- (le site est en Vite, Vercel n'injecte pas le traqueur tout seul). À effort
-- égal, un traqueur maison donne trois avantages décisifs :
--   • l'historique est permanent (le plan Hobby de Vercel ne garde que 30 jours)
--   • les données vivent dans notre base, donc l'agent Manager peut les lire
--   • on mesure exactement ce que Robin demande : d'OÙ viennent les visiteurs
--
-- RGPD : aucun cookie, aucune adresse IP stockée. L'identifiant de visiteur est
-- un hachage non réversible (IP + user-agent + jour + sel), qui change chaque
-- jour — il permet de compter les visiteurs uniques d'une journée sans jamais
-- pouvoir remonter à une personne, ni la suivre d'un jour à l'autre.

create table site_pageviews (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  -- Jour en Europe/Paris, calculé côté fonction : c'est la maille d'analyse.
  day date not null,
  path text not null,
  -- Domaine de provenance : 'instagram.com', 'google.com'… null = accès direct.
  referrer_host text,
  referrer_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  -- Libellé lisible calculé à l'arrivée (Instagram, Google, WhatsApp, Direct…).
  -- Stocké plutôt que recalculé à la lecture : si on change les règles de
  -- classement plus tard, l'historique déjà classé ne bouge pas sous nos pieds.
  source_label text not null default 'Direct',
  -- Regroupement large : recherche, social, direct, referral, campagne payante.
  source_group text not null default 'direct',
  visitor_hash text not null,
  device text,
  country text,
  created_at timestamptz not null default now()
);

create index site_pageviews_day_idx on site_pageviews (day desc);
create index site_pageviews_source_idx on site_pageviews (source_label, day desc);
create index site_pageviews_visitor_idx on site_pageviews (day, visitor_hash);
create index site_pageviews_path_idx on site_pageviews (path, day desc);

-- ── Vues de lecture pour le dashboard ───────────────────────────────────────

-- Trafic par jour : visiteurs uniques et pages vues.
create view site_traffic_daily as
select
  day,
  count(distinct visitor_hash) as visitors,
  count(*) as pageviews
from site_pageviews
group by day;

-- LA réponse à « d'où viennent les gens ». Une ligne par source.
create view site_traffic_by_source as
select
  day,
  source_label,
  source_group,
  count(distinct visitor_hash) as visitors,
  count(*) as pageviews
from site_pageviews
group by day, source_label, source_group;

-- Pages les plus vues.
create view site_traffic_by_page as
select
  day,
  path,
  count(distinct visitor_hash) as visitors,
  count(*) as pageviews
from site_pageviews
group by day, path;

alter table site_pageviews enable row level security;

-- Lecture par le dashboard uniquement. L'écriture passe exclusivement par la
-- fonction track-pageview (clé service-role, contourne RLS) : aucun client
-- authentifié ne peut insérer, et le site public n'écrit jamais en direct.
create policy "Authenticated users can read site pageviews"
  on site_pageviews for select
  to authenticated
  using (true);
