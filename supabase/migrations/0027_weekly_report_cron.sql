-- Planifie l'envoi du rapport hebdomadaire (leads, messages, leads chauds) à
-- Robin sur Telegram, chaque lundi matin (8h Paris ≈ 6h UTC en heure d'été).
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'weekly-report-monday') then
    perform cron.unschedule('weekly-report-monday');
  end if;
end $$;

select cron.schedule(
  'weekly-report-monday',
  '0 6 * * 1',
  $cron$
    select net.http_post(
      url := 'https://szdfpjyytwedhochvzfd.supabase.co/functions/v1/weekly-report',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
      ),
      body := '{}'::jsonb
    );
  $cron$
);
