-- Seed démo Harmonie Yacht — saison été 2026 (Carnon)
-- Idempotent : nettoie les données de démo puis ré-insère avec des UUID fixes.
-- À exécuter sur un projet de développement uniquement.
-- Note : bookings.net_margin est une colonne générée (total_amount - costs).

begin;

-- Nettoyage (ordre des dépendances)
delete from content_marketing;
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

-- Réservations (net_margin = total_amount - costs, calculé ; solde = total - acompte, dû le jour J)
-- Saison juin–août 2026 (à venir)
insert into bookings (id, customer_id, date, start_time, end_time, duration_hours, offer_name, party_size, total_amount, costs, deposit_amount, deposit_paid, balance_due, balance_due_date, status, source_channel, booking_type, reminder_sent) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '2026-06-06', '18:00:00', '21:00:00', 3, 'Coucher de soleil', 8,  2400, 900,  720,  true,  1680, '2026-06-06', 'confirmed', 'instagram', 'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', '2026-06-13', '10:00:00', '17:00:00', 7, 'Journée privée',    10, 6800, 2600, 2040, true,  4760, '2026-06-13', 'confirmed', 'whatsapp',  'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', '2026-06-20', '18:30:00', '21:30:00', 3, 'Apéritif sunset',   6,  1900, 700,  570,  true,  1330, '2026-06-20', 'confirmed', 'referral',  'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', '2026-06-27', '09:00:00', '13:00:00', 4, 'Demi-journée',      12, 4500, 1700, 1350, false, 3150, '2026-06-27', 'confirmed', 'website',   'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', '2026-07-04', '10:00:00', '18:00:00', 8, 'Journée prestige',  12, 7200, 2600, 2160, true,  5040, '2026-07-04', 'confirmed', 'instagram', 'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', '2026-07-11', '18:00:00', '21:00:00', 3, 'Coucher de soleil', 8,  2600, 1000, 780,  true,  1820, '2026-07-11', 'confirmed', 'instagram', 'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000006', '2026-07-18', '14:00:00', '19:00:00', 5, 'EVJF',              14, 5400, 2100, 1620, true,  3780, '2026-07-18', 'confirmed', 'manychat',  'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000007', '2026-07-25', '10:00:00', '17:00:00', 7, 'Journée privée',    10, 6900, 2600, 2070, true,  4830, '2026-07-25', 'confirmed', 'referral',  'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000008', '2026-08-01', '17:00:00', '22:00:00', 5, 'Anniversaire',      12, 5200, 2000, 1560, true,  3640, '2026-08-01', 'confirmed', 'whatsapp',  'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000009', '2026-08-08', '18:00:00', '22:00:00', 4, 'Sunset prestige',   8,  3100, 1200, 930,  true,  2170, '2026-08-08', 'confirmed', 'instagram', 'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000010', '2026-08-15', '09:00:00', '18:00:00', 9, 'Journée corporate', 16, 8200, 3100, 2460, true,  5740, '2026-08-15', 'confirmed', 'website',   'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000002', '2026-08-22', '14:00:00', '19:00:00', 5, 'EVG',               10, 3800, 1500, 1140, false, 2660, '2026-08-22', 'pending',   'whatsapp',  'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000004', '2026-08-29', '11:00:00', '15:00:00', 4, 'Sortie famille',    6,  1700, 650,  510,  false, 1190, '2026-08-29', 'pending',   'website',   'sortie_privative', false),
  ('b0000000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000003', '2026-07-07', '10:00:00', '17:00:00', 7, 'Journée privée',    8,  2100, 800,  630,  false, 0,    null,         'cancelled', 'referral',  'sortie_privative', false);

-- Sorties hors-saison réalisées (janvier→mai 2026, soldées)
insert into bookings (id, customer_id, date, start_time, end_time, duration_hours, offer_name, party_size, total_amount, costs, deposit_amount, deposit_paid, balance_due, balance_due_date, status, source_channel, booking_type, reminder_sent) values
  ('b0000000-0000-4000-8000-000000000015', 'c0000000-0000-4000-8000-000000000005', '2026-02-14', '18:00:00', '21:00:00', 3, 'Saint-Valentin sunset', 2,  1800, 700,  540,  true, 0, null, 'completed', 'instagram', 'sortie_privative', true),
  ('b0000000-0000-4000-8000-000000000016', 'c0000000-0000-4000-8000-000000000003', '2026-03-22', '10:00:00', '17:00:00', 7, 'Sortie privée',         8,  2200, 850,  660,  true, 0, null, 'completed', 'referral',  'sortie_privative', true),
  ('b0000000-0000-4000-8000-000000000017', 'c0000000-0000-4000-8000-000000000007', '2026-04-12', '09:00:00', '13:00:00', 4, 'Demi-journée',          10, 2600, 1000, 780,  true, 0, null, 'completed', 'referral',  'sortie_privative', true),
  ('b0000000-0000-4000-8000-000000000018', 'c0000000-0000-4000-8000-000000000001', '2026-04-26', '18:00:00', '21:00:00', 3, 'Coucher de soleil',     6,  1900, 750,  570,  true, 0, null, 'completed', 'instagram', 'sortie_privative', true),
  ('b0000000-0000-4000-8000-000000000019', 'c0000000-0000-4000-8000-000000000008', '2026-05-03', '18:30:00', '21:30:00', 3, 'Apéritif sunset',       6,  2100, 800,  630,  true, 0, null, 'completed', 'whatsapp',  'sortie_privative', true),
  ('b0000000-0000-4000-8000-000000000020', 'c0000000-0000-4000-8000-000000000002', '2026-05-10', '10:00:00', '17:00:00', 7, 'Journée privée',        10, 4200, 1600, 1260, true, 0, null, 'completed', 'whatsapp',  'sortie_privative', true),
  ('b0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000009', '2026-05-17', '17:00:00', '22:00:00', 5, 'Anniversaire',          12, 3100, 1200, 930,  true, 0, null, 'completed', 'instagram', 'sortie_privative', true),
  ('b0000000-0000-4000-8000-000000000022', 'c0000000-0000-4000-8000-000000000010', '2026-05-24', '18:00:00', '21:00:00', 3, 'Coucher de soleil',     8,  2400, 900,  720,  true, 0, null, 'completed', 'website',   'sortie_privative', true);

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
  ('2026-06-01', 'fuel',              1200, 'Plein début de saison',         false, null),
  ('2026-07-05', 'fuel',              1100, 'Plein juillet',                 false, null),
  ('2026-08-02', 'fuel',              1300, 'Plein août',                    false, null),
  ('2026-06-15', 'maintenance',       850,  'Révision moteur',               false, null),
  ('2026-06-01', 'insurance',         480,  'Assurance — juin',              true,  'monthly'),
  ('2026-07-01', 'insurance',         480,  'Assurance — juillet',           true,  'monthly'),
  ('2026-08-01', 'insurance',         480,  'Assurance — août',              true,  'monthly'),
  ('2026-06-01', 'port',              650,  'Place de port — juin',          true,  'monthly'),
  ('2026-07-01', 'port',              650,  'Place de port — juillet',       true,  'monthly'),
  ('2026-08-01', 'port',              650,  'Place de port — août',          true,  'monthly'),
  ('2026-06-30', 'cleaning',          240,  'Nettoyage fin juin',            false, null),
  ('2026-07-31', 'cleaning',          240,  'Nettoyage fin juillet',         false, null),
  ('2026-07-04', 'food_options',      780,  'Approvisionnement prestations', false, null),
  ('2026-06-01', 'advertising_meta',  600,  'Campagne Meta été',             false, null),
  ('2026-06-15', 'advertising_tiktok',300,  'Campagne TikTok',               false, null),
  ('2026-06-10', 'equipment',         450,  'Gilets & équipement sécurité',  false, null),
  ('2026-08-15', 'salary_bonus',      1500, 'Prime skipper haute saison',    false, null);

-- Stats publicitaires (channel libre)
insert into ad_stats (channel, campaign_name, period_start, period_end, budget_spent, impressions, clicks, leads_generated, bookings_attributed, revenue_generated) values
  ('meta_ads',      'Sunset été 2026',   '2026-05-01', '2026-05-25', 600, 48000, 1320, 14, 4, 9200),
  ('google',        'Réservation yacht', '2026-05-01', '2026-05-25', 420, 21000, 680,  8,  2, 5400),
  ('instagram_ads', 'Stories prestige',  '2026-05-01', '2026-05-25', 350, 32000, 980,  9,  3, 6800),
  ('tiktok_ads',    'Reels découverte',  '2026-05-01', '2026-05-25', 280, 41000, 1500, 6,  1, 2400);

-- Contenus marketing (channel/status selon contraintes)
insert into content_marketing (channel, content_type, title, description, status, publish_date, publish_time, views, likes, comments, shares, leads_attributed) values
  ('instagram_reel',  'reel',  'Coucher de soleil sur l''eau', 'Reel ambiance sunset', 'published', '2026-05-18', '19:30:00', 12400, 890,  45, 120, 4),
  ('tiktok',          'video', 'Une journée à bord',           'Vlog accéléré',        'published', '2026-05-22', '12:00:00', 28900, 2100, 95, 410, 5),
  ('instagram_post',  'post',  'Nouvelle offre EVJF',          'Carrousel offre',      'published', '2026-05-20', '18:00:00', 5400,  320,  18, 30,  2),
  ('instagram_story', 'story', 'Dispo ce week-end',            'Story dispo',          'published', '2026-05-24', '10:00:00', 3200,  0,    0,  0,   1),
  ('instagram_reel',  'reel',  'Apéritif prestige au large',   'Reel apéritif',        'scheduled', '2026-05-28', '19:00:00', 0,     0,    0,  0,   0),
  ('facebook',        'post',  'Événement Soirée DJ Sunset',   'Annonce événement',    'scheduled', '2026-06-01', '11:00:00', 0,     0,    0,  0,   0);

-- Aligne l'objectif sur le CA confirmé
update goals
set current_revenue = (
  select coalesce(sum(total_amount), 0)
  from bookings
  where status in ('confirmed', 'completed')
)
where period_type = 'seasonal';

commit;
