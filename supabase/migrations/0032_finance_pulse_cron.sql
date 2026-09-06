-- Point financier hebdomadaire, envoyé sur Telegram le lundi matin.
--
-- Planifié une heure après le rapport hebdo d'activité (weekly-report, 6h UTC)
-- pour que Robin reçoive d'abord ce qui s'est passé, puis ce que ça donne côté
-- argent — et non deux messages en même temps.
--
-- La fonction refuse de produire un score tant que la banque n'est pas
-- connectée : ce cron peut donc être posé maintenant sans risque de diffuser
-- un chiffre faux, il expliquera simplement ce qui manque.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'finance-pulse-monday') then
    perform cron.unschedule('finance-pulse-monday');
  end if;
end $$;

select cron.schedule(
  'finance-pulse-monday',
  '0 7 * * 1',
  $cron$
    select net.http_post(
      url := 'https://szdfpjyytwedhochvzfd.supabase.co/functions/v1/finance-pulse',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
      ),
      body := '{}'::jsonb
    );
  $cron$
);
