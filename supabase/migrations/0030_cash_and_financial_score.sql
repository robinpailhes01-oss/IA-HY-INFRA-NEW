-- Caisse espèces + historique du score financier.
--
-- Deux manques mis en évidence par l'écart de 12 800 € entre le dashboard et le
-- compte réel :
--   1. Tout ce qui se passe en espèces est invisible du système (Qonto ne voit
--      que ce qui passe par la banque).
--   2. Rien ne mémorise où on en était : impossible de dire si la situation
--      s'améliore ou se dégrade, seulement où elle en est aujourd'hui.

-- ── Caisse espèces ──────────────────────────────────────────────────────────
-- Saisie manuelle (c'est le seul endroit où Robin doit encore saisir).
--   'in'      encaissement espèces d'un client
--   'out'     dépense payée en espèces
--   'deposit' dépôt des espèces sur le compte Qonto
--
-- Le dépôt est le point délicat : il sort de la caisse ET apparaît en crédit
-- sur Qonto. Il ne doit JAMAIS être compté comme du chiffre d'affaires, sinon
-- l'encaissement client serait compté deux fois (une fois en espèces, une fois
-- à l'arrivée sur le compte). D'où une direction dédiée plutôt qu'un 'out'.
create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  direction text not null check (direction in ('in', 'out', 'deposit')),
  amount numeric not null check (amount > 0),
  -- Mêmes catégories que la table expenses, pour les sorties d'espèces.
  category text,
  description text,
  booking_id uuid references bookings (id) on delete set null,
  -- Un encaissement espèces reste du CA : on crée aussi la ligne dans revenues
  -- et on la rattache ici, pour garder une seule source de vérité sur le CA.
  revenue_id uuid references revenues (id) on delete set null,
  -- Idem pour une dépense payée en espèces : la ligne expenses reste la
  -- référence comptable, cash_movements ne suit que le solde de la caisse.
  expense_id uuid references expenses (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cash_movements_date_idx on cash_movements (date desc);
create index cash_movements_direction_idx on cash_movements (direction, date desc);

-- Solde de la caisse : les entrées augmentent, les sorties et les dépôts en
-- banque diminuent (le dépôt ne disparaît pas, il change simplement de poche).
create view cash_balance as
select
  coalesce(sum(case when direction = 'in' then amount else -amount end), 0) as balance,
  max(date) as last_movement_date,
  count(*) as movement_count
from cash_movements;

-- ── Historique du score financier ───────────────────────────────────────────
-- Une photo par jour, pour pouvoir répondre à « est-ce que ça va mieux qu'il y
-- a un mois ? » — la question à laquelle rien ne répond aujourd'hui.
create table financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  -- Une seule photo par jour : un recalcul le même jour écrase la précédente.
  date date not null unique,
  captured_at timestamptz not null default now(),
  bank_balance numeric,
  cash_balance numeric,
  treasury numeric,
  -- Charges moyennes mensuelles observées sur les 90 derniers jours.
  monthly_burn numeric,
  -- Trésorerie / charges mensuelles = nombre de mois tenables sans aucune
  -- rentrée d'argent. null si les charges sont nulles (runway infini).
  runway_months numeric,
  -- Reste à encaisser sur les réservations confirmées à venir.
  outstanding numeric,
  revenue_30d numeric,
  expenses_30d numeric,
  score integer check (score between 0 and 100),
  score_label text,
  -- Détail du calcul (sous-scores, hypothèses) — pour que le score reste
  -- explicable et jamais un chiffre sorti d'une boîte noire.
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index financial_snapshots_date_idx on financial_snapshots (date desc);

alter table cash_movements enable row level security;
alter table financial_snapshots enable row level security;

create policy "Authenticated users can read cash movements"
  on cash_movements for select
  to authenticated
  using (true);

create policy "Authenticated users can insert cash movements"
  on cash_movements for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update cash movements"
  on cash_movements for update
  to authenticated
  using (true);

create policy "Authenticated users can delete cash movements"
  on cash_movements for delete
  to authenticated
  using (true);

create policy "Authenticated users can read financial snapshots"
  on financial_snapshots for select
  to authenticated
  using (true);
