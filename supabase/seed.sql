-- Seed démo Harmonie Yacht — saison été 2026 (Carnon)
-- Idempotent : nettoie les données de démo puis ré-insère avec des UUID fixes.
-- À exécuter sur un projet de développement uniquement.
-- Note : bookings.net_margin est une colonne générée (total_amount - costs).

begin;

-- Nettoyage (ordre des dépendances)
delete from expenses;
delete from bookings;
delete from event_bookings;
delete from events_public;
delete from ad_stats;
delete from weather_cache;
delete from customers;
delete from leads;

-- Clients (tier ∈ membre | membre_privilegie | capitaine_honneur)
insert into customers (id, first_name, last_name, email, phone, acquisition_channel, tier, total_spent, bookings_count) values
  ('c0000000-0000-4000-8000-000000000001', 'Camille',  'Laurent',  'camille.laurent@example.com',  '+33600000001', 'instagram', 'membre_privilegie', 12800, 4),
  ('c0000000-0000-4000-8000-000000000002', 'Thomas',   'Mercier',  'thomas.mercier@example.com',   '+33600000002', 'whatsapp',  'membre',             5400, 2),
  ('c0000000-0000-4000-8000-000000000003', 'Julie',    'Garnier',  'julie.garnier@example.com',    '+33600000003', 'referral',  'membre_privilegie',  9100, 3),
  ('c0000000-0000-4000-8000-000000000004', 'Antoine',  'Rousseau', 'antoine.rousseau@example.com', '+33600000004', 'website',   'membre',             1900, 1),
  ('c0000000-0000-4000-8000-000000000005', 'Marie',    'Lefevre',  'marie.lefevre@example.com',    '+33600000005', 'instagram', 'membre_privilegie',  7200, 2),
  ('c0000000-0000-4000-8000-000000000006', 'Pierre',   'Dumas',    'pierre.dumas@example.com',     '+33600000006', 'manychat',  'membre',             3300, 1),
  ('c0000000-0000-4000-8000-000000000007', 'Sophie',   'Blanc',    'sophie.blanc@example.com',     '+33600000007', 'referral',  'capitaine_honneur', 21400, 6),
  ('c0000000-0000-4000-8000-000000000008', 'Nicolas',  'Faure',    'nicolas.faure@example.com',    '+33600000008', 'whatsapp',  'membre_privilegie',  6900, 2),
  ('c0000000-0000-4000-8000-000000000009', 'Elise',    'Henry',    'elise.henry@example.com',      '+33600000009', 'instagram', 'membre',             2600, 1),
  ('c0000000-0000-4000-8000-000000000010', 'Maxime',   'Robin',    'maxime.robin@example.com',     '+33600000010', 'website',   'membre_privilegie',  8200, 2);

-- Leads (score 0–10 ; source_channel & status selon contraintes)
insert into leads (id, first_name, last_name, email, phone, source_channel, interested_offer, score, status, needs_human_intervention, created_at) values
  ('1ead0000-0000-4000-8000-000000000001', 'Sophie',  'Marchand', 'sophie.marchand@example.com', '+33611000001', 'instagram_organic', 'Journée privée',    8, 'new',        true,  '2026-05-25 09:12:00+02'),
  ('1ead0000-0000-4000-8000-000000000002', 'Thomas',  'Bernard',  'thomas.bernard@example.com',  '+33611000002', 'whatsapp',          'Coucher de soleil', 7, 'contacted',  false, '2026-05-24 14:30:00+02'),
  ('1ead0000-0000-4000-8000-000000000003', 'Léa',     'Dubois',   'lea.dubois@example.com',      '+33611000003', 'word_of_mouth',     'EVJF',              9, 'qualified',  true,  '2026-05-23 18:05:00+02'),
  ('1ead0000-0000-4000-8000-000000000004', 'Hugo',    'Petit',    'hugo.petit@example.com',      '+33611000004', 'website',           'Apéritif sunset',   4, 'new',        false, '2026-05-22 11:20:00+02'),
  ('1ead0000-0000-4000-8000-000000000005', 'Emma',    'Moreau',   'emma.moreau@example.com',     '+33611000005', 'instagram_organic', 'Journée prestige',  8, 'quote_sent', false, '2026-05-20 16:45:00+02'),
  ('1ead0000-0000-4000-8000-000000000006', 'Lucas',   'Girard',   'lucas.girard@example.com',    '+33611000006', 'other',             'Anniversaire',      6, 'new',        false, '2026-05-19 10:00:00+02'),
  ('1ead0000-0000-4000-8000-000000000007', 'Chloé',   'Roux',     'chloe.roux@example.com',      '+33611000007', 'whatsapp',          'Demi-journée',      5, 'lost',       false, '2026-05-15 08:40:00+02'),
  ('1ead0000-0000-4000-8000-000000000008', 'Nathan',  'Fontaine', 'nathan.fontaine@example.com', '+33611000008', 'word_of_mouth',     'Corporate',         9, 'booked',     false, '2026-05-12 13:15:00+02');

-- Réservations (saison juin–août 2026 ; net_margin = total_amount - costs, calculé)
insert into bookings (id, customer_id, date, start_time, end_time, duration_hours, offer_name, party_size, total_amount, costs, deposit_amount, deposit_paid, balance_due, balance_due_date, status, source_channel, booking_type, reminder_sent) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '2026-06-06', '18:00:00', '21:00:00', 3,  'Coucher de soleil', 8,  2400, 900,  720,  true,  0,    null,         'confirmed', 'instagram', 'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', '2026-06-13', '10:00:00', '17:00:00', 7,  'Journée privée',    10, 6800, 2600, 2040, true,  3400, '2026-05-30', 'confirmed', 'whatsapp',  'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', '2026-06-20', '18:30:00', '21:30:00', 3,  'Apéritif sunset',   6,  1900, 700,  570,  true,  0,    null,         'confirmed', 'referral',  'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', '2026-06-27', '09:00:00', '13:00:00', 4,  'Demi-journée',      12, 4500, 1700, 1350, false, 0,    null,         'confirmed', 'website',   'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', '2026-07-04', '10:00:00', '18:00:00', 8,  'Journée prestige',  12, 7200, 2600, 2160, true,  3600, '2026-06-27', 'confirmed', 'instagram', 'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', '2026-07-11', '18:00:00', '21:00:00', 3,  'Coucher de soleil', 8,  2600, 1000, 780,  true,  0,    null,         'confirmed', 'instagram', 'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000006', '2026-07-18', '14:00:00', '19:00:00', 5,  'EVJF',              14, 5400, 2100, 1620, true,  2700, '2026-07-11', 'confirmed', 'manychat',  'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000007', '2026-07-25', '10:00:00', '17:00:00', 7,  'Journée privée',    10, 6900, 2600, 2070, true,  0,    null,         'confirmed', 'referral',  'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000008', '2026-08-01', '17:00:00', '22:00:00', 5,  'Anniversaire',      12, 5200, 2000, 1560, true,  0,    null,         'confirmed', 'whatsapp',  'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000009', '2026-08-08', '18:00:00', '22:00:00', 4,  'Sunset prestige',   8,  3100, 1200, 930,  true,  0,    null,         'confirmed', 'instagram', 'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000010', '2026-08-15', '09:00:00', '18:00:00', 9,  'Journée corporate', 16, 8200, 3100, 2460, true,  0,    null,         'confirmed', 'website',   'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000002', '2026-08-22', '14:00:00', '19:00:00', 5,  'EVG',               10, 3800, 1500, 1140, false, 0,    null,         'pending',   'whatsapp',  'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000004', '2026-08-29', '11:00:00', '15:00:00', 4,  'Sortie famille',    6,  1700, 650,  510,  false, 0,    null,         'pending',   'website',   'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000003', '2026-07-07', '10:00:00', '17:00:00', 7,  'Journée privée',    8,  2100, 800,  630,  false, 0,    null,         'cancelled', 'referral',  'sortie_privative', false);

-- Météo marine (rating ∈ ideal | acceptable | discouraged)
insert into weather_cache (date, rating, wind_speed_kmh, wind_direction, wave_height_m, water_temp_c, swell_m, fetched_at) values
  ('2026-05-26', 'acceptable',  12, 'NO', 0.3, 19, 0.4, now()),
  ('2026-05-27', 'ideal',        8, 'E',  0.2, 20, 0.2, now()),
  ('2026-05-28', 'acceptable',  24, 'SE', 0.6, 19, 0.7, now()),
  ('2026-05-29', 'ideal',       15, 'S',  0.4, 21, 0.5, now()),
  ('2026-05-30', 'discouraged', 34, 'SO', 0.9, 18, 1.1, now());

-- Événements publics (à venir)
insert into events_public (id, title, theme, date, start_time, end_time, price_per_person, max_participants, current_bookings, cost_estimate, net_margin, total_revenue, status) values
  ('e0000000-0000-4000-8000-000000000001', 'Soirée DJ Sunset', 'musique',     '2026-07-12', '19:00:00', '23:00:00', 65, 30, 18, 600, 570, 1170, 'published'),
  ('e0000000-0000-4000-8000-000000000002', 'Brunch en mer',    'gastronomie', '2026-08-03', '11:00:00', '14:00:00', 80, 20, 6,  450, 30,  480,  'published');

-- Dépenses (category selon contrainte)
insert into expenses (date, category, amount, description, is_recurring, recurrence_period) values
  ('2026-06-01', 'fuel',        1200, 'Plein début de saison', false, null),
  ('2026-06-15', 'maintenance', 850,  'Révision moteur',       false, null),
  ('2026-06-01', 'insurance',   480,  'Prime mensuelle',       true,  'monthly');

-- Stats publicitaires
insert into ad_stats (channel, campaign_name, period_start, period_end, budget_spent, impressions, clicks, leads_generated, bookings_attributed, revenue_generated) values
  ('meta',   'Sunset été 2026',   '2026-05-01', '2026-05-25', 600, 48000, 1320, 14, 4, 9200),
  ('google', 'Réservation yacht', '2026-05-01', '2026-05-25', 420, 21000, 680,  8,  2, 5400);

-- Aligne l'objectif sur le CA confirmé
update goals
set current_revenue = (
  select coalesce(sum(total_amount), 0)
  from bookings
  where status in ('confirmed', 'completed')
)
where period_type = 'seasonal';

commit;
