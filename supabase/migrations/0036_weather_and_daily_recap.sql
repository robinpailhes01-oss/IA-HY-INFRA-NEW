-- Météo marine automatique + récap quotidien.
--
--  · weather-sync : chaque matin, remplit weather_cache (10 jours de prévisions
--    de Carnon). La table n'était alimentée par rien dans le dépôt : les cartes
--    météo restaient vides.
--  · daily-recap : chaque matin, compose le récap du jour (météo, sorties, clients
--    qui attendent, argent à encaisser), l'enregistre dans `recaps` et l'envoie
--    (Telegram / e-mail, si configurés).
--
-- Le secret partagé est lu dans le coffre-fort (vault.secrets 'cron_secret'), comme
-- pour les autres tâches planifiées.

-- Une ligne par jour : l'upsert de weather-sync s'appuie dessus.
delete from weather_cache a using weather_cache b where a.date = b.date and a.ctid < b.ctid;
create unique index if not exists weather_cache_date_key on weather_cache (date);

-- Un seul récap quotidien par jour.
create unique index if not exists recaps_daily_day_key on recaps (period_end) where type = 'daily';

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'weather-sync-daily') then
    perform cron.unschedule('weather-sync-daily');
  end if;
  if exists (select 1 from cron.job where jobname = 'daily-recap-morning') then
    perform cron.unschedule('daily-recap-morning');
  end if;
end $$;

-- 04 h 30 UTC = 5 h 30 (hiver) / 6 h 30 (été) à Paris.
select cron.schedule(
  'weather-sync-daily',
  '30 4 * * *',
  $cron$
    select net.http_post(
      url := 'https://szdfpjyytwedhochvzfd.supabase.co/functions/v1/weather-sync',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1), '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);

-- 05 h 30 UTC = 6 h 30 (hiver) / 7 h 30 (été) : après la météo.
select cron.schedule(
  'daily-recap-morning',
  '30 5 * * *',
  $cron$
    select net.http_post(
      url := 'https://szdfpjyytwedhochvzfd.supabase.co/functions/v1/daily-recap',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1), '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);
