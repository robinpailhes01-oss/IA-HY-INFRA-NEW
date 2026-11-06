-- ═══════════════════════════════════════════════════════════════════════
-- Après les migrations 0001–0035.
-- ═══════════════════════════════════════════════════════════════════════

-- Un instantané par jour pour la page Audience du site (vue dérivée de site_pageviews).
create or replace view public.site_daily_snapshots as
select
  d.day as snapshot_date,
  d.visitors::integer as visitors,
  d.pageviews::integer as pageviews,
  coalesce((
    select jsonb_agg(jsonb_build_object('hostname', r.host, 'visitors', r.visitors, 'pageviews', r.pageviews) order by r.visitors desc, r.pageviews desc)
    from (
      select coalesce(referrer_host, 'Direct') as host, count(distinct visitor_hash) as visitors, count(*) as pageviews
      from public.site_pageviews p where p.day = d.day
      group by 1 order by 2 desc, 3 desc limit 10
    ) r
  ), '[]'::jsonb) as top_referrers,
  coalesce((
    select jsonb_agg(jsonb_build_object('path', g.path, 'visitors', g.visitors, 'pageviews', g.pageviews) order by g.visitors desc, g.pageviews desc)
    from (
      select path, count(distinct visitor_hash) as visitors, count(*) as pageviews
      from public.site_pageviews p where p.day = d.day
      group by 1 order by 2 desc, 3 desc limit 10
    ) g
  ), '[]'::jsonb) as top_pages
from public.site_traffic_daily d;

-- Les vues n'héritent pas de la sécurité des tables : on les ouvre aux seuls utilisateurs connectés.
revoke all on public.site_daily_snapshots, public.site_traffic_daily, public.site_traffic_by_source,
  public.site_traffic_by_page, public.lead_last_message, public.cash_balance, public.sumup_daily_settlements from anon;
grant select on public.site_daily_snapshots, public.site_traffic_daily, public.site_traffic_by_source,
  public.site_traffic_by_page, public.lead_last_message, public.cash_balance, public.sumup_daily_settlements
  to authenticated, service_role;
