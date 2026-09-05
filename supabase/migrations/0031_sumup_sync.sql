-- Synchronisation SumUp — les encaissements par carte sur place.
--
-- Pourquoi c'est le maillon manquant : 15 353 € de soldes de réservations sont
-- réglés le jour de la sortie, hors Stripe. Ce flux n'existait nulle part dans
-- le système. Qonto n'en voit que le virement groupé qui arrive quelques jours
-- plus tard, sans le détail des ventes qui le composent.
--
-- Règle anti-double-comptage (la même que pour les dépôts d'espèces) :
--   • une transaction SumUp        = du chiffre d'affaires
--   • un virement SumUp → Qonto    = un transfert, JAMAIS du chiffre d'affaires
-- Qonto porte la trésorerie, SumUp porte le détail du CA. Les deux ne
-- s'additionnent pas, ils se rapprochent.

-- ── Ventes encaissées via SumUp ─────────────────────────────────────────────
create table sumup_transactions (
  -- Identifiant SumUp (uuid côté API, stocké en text : on ne le génère pas).
  id text primary key,
  -- Clé de jointure avec les virements : chaque ligne de virement porte le
  -- transaction_code de la vente d'origine.
  transaction_code text unique,
  -- Montants en unités majeures (l'API SumUp renvoie des flottants, ex. 132.45)
  -- convertis en numeric dès l'insertion — jamais de float sur de l'argent.
  amount numeric not null,
  currency text not null default 'EUR',
  -- SUCCESSFUL | CANCELLED | FAILED | PENDING | REFUNDED
  status text,
  -- PAYMENT | REFUND | CHARGE_BACK
  type text,
  -- POS (terminal) | ECOM (en ligne) | CASH | MOTO | BALANCE…
  payment_type text,
  card_type text,
  -- CHIP | CONTACTLESS | APPLE_PAY | GOOGLE_PAY | MANUAL_ENTRY…
  entry_mode text,
  -- La commission n'est PAS renvoyée par la liste des transactions : il faut un
  -- appel de détail par vente. detail_fetched_at évite de le refaire à chaque
  -- passage (voir la fonction sumup-sync).
  fee_amount numeric,
  vat_amount numeric,
  tip_amount numeric,
  refunded_amount numeric,
  occurred_at timestamptz,
  -- Date à laquelle SumUp reverse cette vente : permet de regrouper les ventes
  -- par virement sans même appeler l'endpoint des virements.
  payout_date date,
  payout_type text,
  detail_fetched_at timestamptz,
  -- Rapprochement avec une réservation — laissé vide pour l'instant, SumUp ne
  -- transmet aucune donnée client (pas de nom, pas d'email, pas de téléphone) :
  -- le rapprochement se fera sur le montant et la date, pas automatiquement.
  booking_id uuid references bookings (id) on delete set null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sumup_transactions_occurred_idx on sumup_transactions (occurred_at desc);
create index sumup_transactions_payout_date_idx on sumup_transactions (payout_date);
create index sumup_transactions_detail_idx on sumup_transactions (detail_fetched_at) where detail_fetched_at is null;

-- ── Virements SumUp → banque ────────────────────────────────────────────────
-- Attention au nom : ce ne sont pas les virements groupés tels qu'ils
-- apparaissent sur le relevé bancaire, mais une ligne par vente reversée. Le
-- montant réellement crédité en banque est la somme d'une journée.
create table sumup_payouts (
  id bigint primary key,
  -- PAYOUT | CHARGE_BACK_DEDUCTION | REFUND_DEDUCTION | DD_RETURN_DEDUCTION |
  -- BALANCE_DEDUCTION — seul PAYOUT est un encaissement, le reste retranche.
  type text not null,
  amount numeric not null,
  fee numeric,
  currency text not null default 'EUR',
  date date not null,
  status text,
  reference text,
  -- Vente d'origine, jointure directe vers sumup_transactions.transaction_code.
  transaction_code text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sumup_payouts_date_idx on sumup_payouts (date desc);
create index sumup_payouts_transaction_code_idx on sumup_payouts (transaction_code);

-- Montant net crédité en banque par jour : c'est cette somme qu'on doit
-- retrouver en crédit sur Qonto, et non les ventes individuelles.
create view sumup_daily_settlements as
select
  date,
  currency,
  sum(case when type = 'PAYOUT' then amount else -amount end) as net_amount,
  sum(coalesce(fee, 0)) as fees,
  count(*) as line_count
from sumup_payouts
where status = 'SUCCESSFUL'
group by date, currency;

create table sumup_sync_state (
  id boolean primary key default true check (id),
  -- Sert de `changes_since` : rattrape aussi les remboursements et impayés
  -- survenus après coup sur des ventes déjà importées.
  last_synced_at timestamptz,
  last_payout_date date,
  last_run_at timestamptz,
  last_error text,
  transactions_synced integer not null default 0,
  payouts_synced integer not null default 0
);

insert into sumup_sync_state (id) values (true) on conflict (id) do nothing;

alter table sumup_transactions enable row level security;
alter table sumup_payouts enable row level security;
alter table sumup_sync_state enable row level security;

create policy "Authenticated users can read sumup transactions"
  on sumup_transactions for select
  to authenticated
  using (true);

create policy "Authenticated users can read sumup payouts"
  on sumup_payouts for select
  to authenticated
  using (true);

create policy "Authenticated users can read sumup sync state"
  on sumup_sync_state for select
  to authenticated
  using (true);
