-- Synchronisation automatique Qonto + SumUp, toutes les heures.
--
-- Les deux fonctions (0029 qonto-sync, 0031 sumup-sync) existaient mais rien
-- ne les appelait : la banque et les ventes au terminal ne remontaient que sur
-- appel manuel. Ce sont elles qui alimentent la future partie Comptabilité
-- (journal bancaire, justificatifs, TVA).
--
-- Décalées dans l'heure (:07 et :37) pour ne pas tomber en même temps que les
-- autres tâches planifiées, ni l'une sur l'autre.
--
-- Sans les secrets (QONTO_API_KEY, SUMUP_API_KEY, SUMUP_MERCHANT_CODE), chaque
-- passage renvoie simplement une erreur explicite et n'écrit rien : on peut
-- donc poser ce planning avant même d'avoir créé les clés.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'qonto-sync-hourly') then
    perform cron.unschedule('qonto-sync-hourly');
  end if;
  if exists (select 1 from cron.job where jobname = 'sumup-sync-hourly') then
    perform cron.unschedule('sumup-sync-hourly');
  end if;
end $$;

select cron.schedule(
  'qonto-sync-hourly',
  '7 * * * *',
  $cron$
    select net.http_post(
      url := 'https://szdfpjyytwedhochvzfd.supabase.co/functions/v1/qonto-sync',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);

select cron.schedule(
  'sumup-sync-hourly',
  '37 * * * *',
  $cron$
    select net.http_post(
      url := 'https://szdfpjyytwedhochvzfd.supabase.co/functions/v1/sumup-sync',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);
