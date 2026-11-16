-- Corrige l'adresse du projet dans les tâches planifiées et le déclencheur Google
-- Agenda, quand le SQL de reconstruction a été généré pour une autre adresse.
-- Remplacer les deux valeurs ci-dessous, puis Run. Sans danger si on le relance.
do $$
declare
  ancien text := 'whcrxozfxpsftaqjzxld';   -- identifiant utilisé par erreur
  nouveau text := 'fscrhzxpmxvejrhppftc';  -- identifiant du vrai projet
  j record;
  def text;
begin
  -- 1. Tâches planifiées (pg_cron)
  for j in select jobid, command from cron.job where command like '%' || ancien || '%' loop
    perform cron.alter_job(j.jobid, command := replace(j.command, ancien, nouveau));
  end loop;

  -- 2. Fonction appelée à chaque réservation / événement (synchro Google Agenda)
  select pg_get_functiondef('public.notify_sync_gcal'::regproc) into def;
  if def like '%' || ancien || '%' then
    execute replace(def, ancien, nouveau);
  end if;
end $$;

-- Contrôle : ne doit plus rien renvoyer.
select 'cron' as ou, jobname as nom from cron.job where command like '%whcrxozfxpsftaqjzxld%'
union all
select 'fonction', proname from pg_proc where prosrc like '%whcrxozfxpsftaqjzxld%';
