-- ═══════════════════════════════════════════════════════════════════════
-- Après les tables de base : fonction publique, vue, accès (RLS), profils.
-- RECONSTITUÉ : l'original n'a pas été conservé. Choix par défaut sûrs —
-- tout utilisateur connecté au tableau de bord a accès à tout (équipe très
-- réduite), le public (anon) ne lit que ce que le site affiche.
-- ═══════════════════════════════════════════════════════════════════════

-- Créneaux déjà pris (appelée par le site public avec la clé anon).
create or replace function public.get_booked_slots(p_from date, p_to date)
returns table (booking_type text, date date, start_time time, end_time time)
language sql stable security definer set search_path = public as $$
  select b.booking_type, b.date, b.start_time, b.end_time
  from public.bookings b
  where b.date between p_from and p_to
    and coalesce(b.status, '') <> 'cancelled'
  union all
  select 'blocked'::text, d.date, d.start_time, d.end_time
  from public.blocked_dates d
  where d.date between p_from and p_to
$$;
grant execute on function public.get_booked_slots(date, date) to anon, authenticated, service_role;

-- Un instantané par jour pour la page Audience du site (dérivé de site_pageviews).
-- Créée après la migration 0033 : voir 03_after_migrations.sql.

-- Profil créé automatiquement pour chaque nouveau compte de connexion. Le
-- premier compte devient administrateur (c'est lui qui peut restaurer et
-- sauvegarder) ; les suivants sont des membres.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when exists (select 1 from public.profiles) then 'member' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accès : RLS activé sur toutes les tables de base.
do $$
declare
  t text;
begin
  foreach t in array array[
    'ad_stats','agent_config','blocked_dates','bookings','content_marketing','conversations','customers',
    'event_bookings','events_public','expenses','goals','hub_agent_activities','hub_agent_channels','hub_agents',
    'hub_channel_connections','hub_contacts','hub_conversations','hub_credit_ledger','hub_messages','hub_settings',
    'hub_workspaces','leads','profiles','prospects','recaps','referrals','revenues','transactions',
    'wa_auth_state','wa_conversations','wa_messages','weather_cache'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    if t <> 'wa_auth_state' then
      -- wa_auth_state (session WhatsApp) : aucune politique = clé de service uniquement.
      execute format('drop policy if exists "Authenticated users full access" on public.%I', t);
      execute format('create policy "Authenticated users full access" on public.%I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- Ce que le site public a le droit de lire.
drop policy if exists "Public can read events" on public.events_public;
create policy "Public can read events" on public.events_public for select to anon using (true);
