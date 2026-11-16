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

-- Les tâches planifiées lisent leur secret partagé dans le coffre-fort : Supabase
-- refuse « alter database … set app.* » aux rôles d'administration du projet.
-- La valeur 'CHANGE_ME_BEFORE_DEPLOY' est à remplacer (voir docs/reconstruction.md) :
--   select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), 'LA_VALEUR');
do $$
declare
  j record;
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret('CHANGE_ME_BEFORE_DEPLOY', 'cron_secret');
  end if;
  for j in select jobid, command from cron.job where command like '%app.cron_secret%' loop
    perform cron.alter_job(j.jobid, command := replace(j.command,
      $a$coalesce(current_setting('app.cron_secret', true), '')$a$,
      $b$coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1), '')$b$));
  end loop;
end $$;
