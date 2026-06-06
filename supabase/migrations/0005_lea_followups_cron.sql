-- Active pg_cron pour planifier les relances Léa toutes les heures.
-- L'extension pg_net est déjà active (utilisée pour les triggers GCal).
create extension if not exists pg_cron;

-- Idempotent : retire l'ancien job si déjà créé.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'lea-followups-hourly') then
    perform cron.unschedule('lea-followups-hourly');
  end if;
end $$;

-- Toutes les heures à h:00, ping la Edge Function. L'auth est gérée par
-- x-cron-secret côté fonction (configurable via le secret CRON_SECRET).
select cron.schedule(
  'lea-followups-hourly',
  '0 * * * *',
  $cron$
    select net.http_post(
      url := 'https://szdfpjyytwedhochvzfd.supabase.co/functions/v1/lea-followups',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
      ),
      body := '{}'::jsonb
    );
  $cron$
);
