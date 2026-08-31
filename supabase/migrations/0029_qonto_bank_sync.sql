-- Synchronisation bancaire Qonto — la banque devient la source de vérité de la
-- trésorerie, à côté des tables `revenues`/`expenses` qui restent la vision
-- métier (saisie manuelle + revenus générés depuis les réservations).
--
-- Contexte : le dashboard affichait un « résultat cumulé » (revenus − dépenses
-- saisies) que Robin lisait comme sa trésorerie. Écart constaté : ~18 800 € en
-- base contre ~6 000 € réellement en banque, principalement parce que des
-- sorties d'argent réelles (charges sociales, taxes, prélèvements) ne sont
-- jamais saisies. On importe donc les mouvements bancaires bruts.
--
-- Alimenté par l'Edge Function `qonto-sync` (voir supabase/functions/qonto-sync).

-- Comptes bancaires + solde réel, rafraîchis à chaque synchro.
create table bank_accounts (
  -- Identifiant Qonto du compte (bank_account_id), pas un uuid à nous.
  id text primary key,
  name text,
  iban text,
  currency text not null default 'EUR',
  -- Soldes en centimes, comme les renvoie Qonto (balance_cents) — on évite
  -- les flottants sur de l'argent.
  balance_cents bigint not null default 0,
  -- Solde autorisé = solde moins les opérations engagées mais pas encore
  -- réglées (cartes en attente). C'est le montant réellement disponible.
  authorized_balance_cents bigint not null default 0,
  is_main boolean not null default false,
  status text,
  balance_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mouvements bancaires bruts. On ne transforme rien ici : le rapprochement
-- avec `expenses` se fait dans un second temps, via bank_transaction_id.
create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  qonto_id text not null unique,
  bank_account_id text references bank_accounts (id) on delete set null,
  -- 'debit' (sortie) ou 'credit' (entrée) — amount_cents reste toujours positif.
  side text not null check (side in ('debit', 'credit')),
  amount_cents bigint not null,
  currency text not null default 'EUR',
  -- completed | pending | declined | reversed
  status text not null,
  -- card, transfer, income, direct_debit, qonto_fee, cheque…
  operation_type text,
  label text,
  counterparty_name text,
  reference text,
  note text,
  -- Champ `category` de Qonto : déprécié côté Qonto (plus affiché dans leur UI,
  -- parfois absent ou 'fallback') mais encore renvoyé — gardé uniquement comme
  -- indice faible pour deviner notre propre catégorie.
  qonto_category text,
  -- Catégorie de flux Qonto : taxonomie personnalisée par organisation, à
  -- configurer côté Qonto si on veut qu'elle colle à nos catégories à nous.
  cashflow_category text,
  -- settled_at est null tant que l'opération n'est pas 'completed'.
  settled_at timestamptz,
  emitted_at timestamptz,
  qonto_updated_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bank_transactions_settled_idx on bank_transactions (settled_at desc);
create index bank_transactions_side_idx on bank_transactions (side, settled_at desc);
-- Curseur de synchro : on repolle par updated_at (et non settled_at) pour
-- rattraper aussi les opérations modifiées ou passées de pending à completed.
create index bank_transactions_qonto_updated_idx on bank_transactions (qonto_updated_at desc);

-- Rapprochement bancaire : une dépense saisie peut être rattachée au mouvement
-- bancaire correspondant. Nullable — l'historique saisi à la main avant la
-- synchro reste valide, simplement non rapproché.
alter table expenses add column bank_transaction_id uuid references bank_transactions (id) on delete set null;

-- Une transaction bancaire ne peut alimenter qu'une seule dépense (évite les
-- doublons si la synchro repasse sur un mouvement déjà traité).
create unique index expenses_bank_transaction_id_key
  on expenses (bank_transaction_id)
  where bank_transaction_id is not null;

-- État de la synchro : une seule ligne, contrainte par le check sur id.
create table qonto_sync_state (
  id boolean primary key default true check (id),
  -- Borne haute du dernier import réussi, réutilisée comme updated_at_from.
  last_synced_at timestamptz,
  last_run_at timestamptz,
  last_error text,
  transactions_synced integer not null default 0
);

insert into qonto_sync_state (id) values (true) on conflict (id) do nothing;

alter table bank_accounts enable row level security;
alter table bank_transactions enable row level security;
alter table qonto_sync_state enable row level security;

-- Lecture réservée au dashboard (utilisateurs connectés). L'écriture ne passe
-- que par l'Edge Function de synchro, avec la clé service-role qui contourne
-- RLS — jamais par un client authentifié classique.
create policy "Authenticated users can read bank accounts"
  on bank_accounts for select
  to authenticated
  using (true);

create policy "Authenticated users can read bank transactions"
  on bank_transactions for select
  to authenticated
  using (true);

create policy "Authenticated users can read qonto sync state"
  on qonto_sync_state for select
  to authenticated
  using (true);
