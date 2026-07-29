-- Lie automatiquement toute réservation à la fiche prospect existante du même
-- client (par téléphone ou email), quel que soit le point d'entrée qui crée la
-- réservation : formulaire du site (booking-form-webhook), saisie manuelle
-- dans Réservations, conversion depuis Prospects, import Google Agenda...
--
-- Sans ce lien (bookings.lead_id), agent-lea ne peut pas savoir qu'un contact
-- avec qui il discute sur WhatsApp a déjà réservé, et continue à le traiter
-- comme un prospect à qualifier au lieu d'un client déjà confirmé.

create or replace function public.link_booking_to_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_email text;
  v_lead_id uuid;
begin
  if new.lead_id is not null or new.customer_id is null then
    return new;
  end if;

  select phone, email into v_phone, v_email from customers where id = new.customer_id;

  if v_phone is not null then
    select id into v_lead_id from leads where phone = v_phone order by created_at desc limit 1;
  end if;

  if v_lead_id is null and v_email is not null then
    select id into v_lead_id from leads where email = v_email order by created_at desc limit 1;
  end if;

  if v_lead_id is not null then
    new.lead_id := v_lead_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_link_booking_to_lead on bookings;
create trigger trg_link_booking_to_lead
  before insert on bookings
  for each row execute function public.link_booking_to_lead();

-- Backfill : réservations déjà existantes sans lead_id mais dont le client
-- correspond à un prospect connu.
update bookings b
set lead_id = matched.lead_id
from (
  select
    c.id as customer_id,
    (
      select l.id from leads l
      where (c.phone is not null and l.phone = c.phone)
         or (c.email is not null and l.email = c.email)
      order by l.created_at desc
      limit 1
    ) as lead_id
  from customers c
) matched
where b.customer_id = matched.customer_id
  and b.lead_id is null
  and matched.lead_id is not null;
