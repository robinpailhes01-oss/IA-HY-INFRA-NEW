-- Comptabilité — de la banque à un FEC propre.
--
-- Harmonie Yacht est une SAS assujettie à la TVA, sans expert-comptable. Le
-- tableau de bord ne remplace pas un logiciel comptable agréé, mais il doit
-- produire des données qu'un comptable (ou l'administration) peut reprendre :
--   · chaque mouvement bancaire (Qonto) et chaque mouvement de caisse classé
--     sur un compte du plan comptable général (PCG), avec sa TVA ;
--   · un justificatif rattaché à chaque pièce (conservation 10 ans) ;
--   · la TVA à déclarer, au régime réel normal (CA3 mensuelle) OU simplifié
--     (CA12 annuelle + deux acomptes) — les deux sont prévus ;
--   · des mois clôturés, qu'on ne peut plus modifier ;
--   · un export FEC (fichier des écritures comptables).
--
-- Principe : les tables de synchro (bank_transactions, cash_movements) ne
-- sont jamais modifiées par la compta. La classification vit à part, dans
-- accounting_entries, une ligne par mouvement.

-- ── Réglages (une seule ligne) ──────────────────────────────────────────────
create table accounting_settings (
  id boolean primary key default true check (id),
  company_name text not null default 'Harmonie Yacht',
  legal_form text not null default 'SAS',
  -- 9 chiffres : nécessaire au nom du fichier FEC.
  siren text,
  -- 'normal'    : réel normal, CA3 chaque mois
  -- 'simplifie' : réel simplifié, CA12 annuelle + acomptes juillet/décembre
  vat_regime text not null default 'normal' check (vat_regime in ('normal', 'simplifie')),
  -- Jour limite de dépôt de la CA3 (entre le 15 et le 24 selon l'entreprise :
  -- il est indiqué dans l'espace professionnel impots.gouv).
  vat_due_day integer not null default 19 check (vat_due_day between 1 and 31),
  -- Mois de début de l'exercice (1 = janvier → exercice calé sur l'année civile).
  fiscal_year_start_month integer not null default 1 check (fiscal_year_start_month between 1 and 12),
  -- TVA due l'an dernier (régime simplifié) : base des acomptes.
  previous_year_vat numeric,
  updated_at timestamptz not null default now()
);

insert into accounting_settings (id) values (true) on conflict (id) do nothing;

-- ── Plan de comptes (PCG, sous-ensemble utile à l'activité) ─────────────────
create table accounting_accounts (
  code text primary key,
  label text not null,
  -- charge | produit | immobilisation | tva | tiers | tresorerie | capital | attente
  kind text not null check (kind in ('charge', 'produit', 'immobilisation', 'tva', 'tiers', 'tresorerie', 'capital', 'attente')),
  -- Taux de TVA proposé par défaut quand on classe sur ce compte (en %).
  default_vat_rate numeric not null default 0,
  -- Le mouvement exige-t-il un justificatif ? (non pour un virement interne)
  needs_receipt boolean not null default true,
  -- Groupe d'affichage dans le sélecteur.
  grp text not null,
  sort integer not null default 0,
  active boolean not null default true
);

insert into accounting_accounts (code, label, kind, default_vat_rate, needs_receipt, grp, sort) values
  -- Produits
  ('706100', 'Sorties en mer', 'produit', 10, true, 'Ventes', 10),
  ('706200', 'Nuits insolites', 'produit', 10, true, 'Ventes', 11),
  ('706300', 'eFoil', 'produit', 20, true, 'Ventes', 12),
  ('706000', 'Autres prestations', 'produit', 20, true, 'Ventes', 13),
  ('708000', 'Produits annexes', 'produit', 20, true, 'Ventes', 14),
  ('758000', 'Produits divers', 'produit', 0, true, 'Ventes', 15),
  -- Charges
  ('606100', 'Carburant, eau, énergie', 'charge', 20, true, 'Bateau', 20),
  ('615500', 'Entretien et réparations bateau', 'charge', 20, true, 'Bateau', 21),
  ('613200', 'Place de port', 'charge', 20, true, 'Bateau', 22),
  ('616000', 'Assurances', 'charge', 0, true, 'Bateau', 23),
  ('606300', 'Petit équipement (< 500 € HT)', 'charge', 20, true, 'Bateau', 24),
  ('604000', 'Sous-traitance (skippers, prestataires)', 'charge', 20, true, 'Activité', 30),
  ('613500', 'Locations de matériel', 'charge', 20, true, 'Activité', 31),
  ('625700', 'Réceptions, accueil clients', 'charge', 20, true, 'Activité', 32),
  ('606400', 'Fournitures administratives', 'charge', 20, true, 'Fonctionnement', 40),
  ('651100', 'Logiciels et abonnements', 'charge', 20, true, 'Fonctionnement', 41),
  ('623000', 'Publicité et marketing', 'charge', 20, true, 'Fonctionnement', 42),
  ('622600', 'Honoraires', 'charge', 20, true, 'Fonctionnement', 43),
  ('626000', 'Téléphone, internet, poste', 'charge', 20, true, 'Fonctionnement', 44),
  ('625100', 'Déplacements', 'charge', 20, true, 'Fonctionnement', 45),
  ('627000', 'Frais bancaires et commissions', 'charge', 0, true, 'Fonctionnement', 46),
  ('641000', 'Salaires', 'charge', 0, true, 'Personnel et État', 50),
  ('645000', 'Charges sociales (URSSAF…)', 'charge', 0, true, 'Personnel et État', 51),
  ('635000', 'Impôts et taxes (CFE…)', 'charge', 0, true, 'Personnel et État', 52),
  ('695000', 'Impôt sur les sociétés', 'charge', 0, true, 'Personnel et État', 53),
  ('661000', 'Intérêts d''emprunt', 'charge', 0, true, 'Personnel et État', 54),
  ('671000', 'Charges exceptionnelles (amendes…)', 'charge', 0, true, 'Personnel et État', 55),
  -- Immobilisations
  ('218200', 'Bateau, matériel de transport', 'immobilisation', 20, true, 'Investissements', 60),
  ('215400', 'Matériel nautique (> 500 € HT)', 'immobilisation', 20, true, 'Investissements', 61),
  ('218300', 'Matériel informatique (> 500 € HT)', 'immobilisation', 20, true, 'Investissements', 62),
  -- TVA, tiers, capital, trésorerie
  ('445510', 'Paiement de TVA aux impôts', 'tva', 0, false, 'État, associés, banque', 70),
  ('445670', 'Remboursement de crédit de TVA', 'tva', 0, false, 'État, associés, banque', 71),
  ('455000', 'Compte courant d''associé', 'tiers', 0, false, 'État, associés, banque', 72),
  ('101300', 'Apport en capital', 'capital', 0, false, 'État, associés, banque', 73),
  ('164000', 'Emprunt (capital remboursé ou reçu)', 'capital', 0, true, 'État, associés, banque', 74),
  ('580000', 'Virement interne (dépôt d''espèces…)', 'tresorerie', 0, false, 'État, associés, banque', 75),
  ('471000', 'À classer (compte d''attente)', 'attente', 0, false, 'État, associés, banque', 99);

-- ── Classification d'un mouvement ───────────────────────────────────────────
create table accounting_entries (
  id uuid primary key default gen_random_uuid(),
  -- 'bank' → bank_transactions.id ; 'cash' → cash_movements.id
  source text not null check (source in ('bank', 'cash')),
  source_id uuid not null,
  -- Date de l'opération, recopiée : sert au verrouillage des mois clôturés.
  entry_date date not null,
  account_code text not null references accounting_accounts (code),
  -- Taux de TVA en % (0, 2.1, 5.5, 10, 20).
  vat_rate numeric not null default 0,
  -- Autoliquidation : achat de service à un fournisseur étranger (Google,
  -- Meta, Anthropic…). La facture est HT ; la TVA est à la fois collectée et
  -- déductible par nous, pour le même montant. Elle doit figurer sur la CA3.
  reverse_charge boolean not null default false,
  -- Montant de TVA saisi à la main (facture à plusieurs taux) — sinon calculé.
  vat_amount_override numeric,
  -- Chemin dans le bucket « justificatifs ».
  receipt_path text,
  receipt_name text,
  -- Raison quand il n'y a volontairement pas de justificatif.
  no_receipt_reason text,
  label text,
  note text,
  -- 'regle' (règle automatique) | 'lea' | 'robin'
  classified_by text not null default 'robin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index accounting_entries_date_idx on accounting_entries (entry_date desc);

-- ── Règles de classement automatique ────────────────────────────────────────
create table accounting_rules (
  id uuid primary key default gen_random_uuid(),
  -- Texte cherché (insensible à la casse) dans « contrepartie + libellé ».
  pattern text not null,
  -- 'debit' | 'credit' | null (les deux)
  side text check (side in ('debit', 'credit')),
  -- Filtre optionnel sur le type d'opération Qonto (ex. 'qonto_fee').
  operation_type text,
  account_code text not null references accounting_accounts (code),
  vat_rate numeric not null default 0,
  reverse_charge boolean not null default false,
  -- Aucun justificatif attendu (ex. frais Qonto : le relevé suffit).
  no_receipt_reason text,
  priority integer not null default 100,
  created_at timestamptz not null default now()
);

insert into accounting_rules (pattern, side, operation_type, account_code, vat_rate, reverse_charge, no_receipt_reason, priority) values
  ('', 'debit', 'qonto_fee', '627000', 0, false, 'Frais bancaires : figurent sur le relevé Qonto', 10),
  ('sumup', 'credit', null, '706100', 10, false, 'Ventes détaillées dans SumUp', 20),
  ('stripe', 'credit', null, '706100', 10, false, 'Acomptes en ligne : détail dans Stripe', 20),
  ('urssaf', 'debit', null, '645000', 0, false, null, 30),
  ('total', 'debit', null, '606100', 20, false, null, 50),
  ('esso', 'debit', null, '606100', 20, false, null, 50),
  ('shell', 'debit', null, '606100', 20, false, null, 50),
  ('google', 'debit', null, '623000', 20, true, null, 60),
  ('facebk', 'debit', null, '623000', 20, true, null, 60),
  ('meta platforms', 'debit', null, '623000', 20, true, null, 60),
  ('anthropic', 'debit', null, '651100', 20, true, null, 60),
  ('openai', 'debit', null, '651100', 20, true, null, 60),
  ('vercel', 'debit', null, '651100', 20, true, null, 60),
  ('supabase', 'debit', null, '651100', 20, true, null, 60),
  ('notion', 'debit', null, '651100', 20, true, null, 60);

-- ── Mois (clôture + TVA) ────────────────────────────────────────────────────
create table accounting_periods (
  -- Premier jour du mois.
  month date primary key check (extract(day from month) = 1),
  closed_at timestamptz,
  -- Déclaration de TVA faite pour ce mois (régime normal) — montant déclaré.
  vat_declared_at timestamptz,
  vat_declared_amount numeric,
  note text,
  updated_at timestamptz not null default now()
);

-- Déclarations annuelles (régime simplifié : CA12 + acomptes).
create table accounting_vat_filings (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  -- 'acompte_juillet' | 'acompte_decembre' | 'ca12' | 'ca3'
  kind text not null check (kind in ('acompte_juillet', 'acompte_decembre', 'ca12', 'ca3')),
  amount numeric,
  filed_at timestamptz not null default now(),
  unique (year, kind)
);

-- ── Verrou : un mois clôturé ne se modifie plus ─────────────────────────────
create or replace function accounting_guard_closed_period() returns trigger
language plpgsql as $$
declare
  d date;
begin
  d := coalesce(case when tg_op = 'DELETE' then old.entry_date else new.entry_date end, current_date);
  if exists (
    select 1 from accounting_periods
    where month = date_trunc('month', d)::date and closed_at is not null
  ) then
    raise exception 'Le mois de % est clôturé : rouvre-le avant de modifier une écriture.', to_char(d, 'MM/YYYY');
  end if;
  if tg_op = 'UPDATE' and old.entry_date <> new.entry_date and exists (
    select 1 from accounting_periods
    where month = date_trunc('month', old.entry_date)::date and closed_at is not null
  ) then
    raise exception 'Le mois d''origine est clôturé.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end $$;

create trigger accounting_entries_guard
  before insert or update or delete on accounting_entries
  for each row execute function accounting_guard_closed_period();

-- ── Classement automatique des nouveaux mouvements Qonto ────────────────────
create or replace function accounting_apply_rules(tx bank_transactions) returns void
language plpgsql security definer set search_path = public as $$
declare
  r accounting_rules;
  haystack text;
begin
  if tx.status not in ('completed', 'pending') then return; end if;
  haystack := lower(coalesce(tx.counterparty_name, '') || ' ' || coalesce(tx.label, ''));
  select * into r from accounting_rules
  where (side is null or side = tx.side)
    and (operation_type is null or operation_type = tx.operation_type)
    and (pattern = '' or haystack like '%' || lower(pattern) || '%')
  order by priority, length(pattern) desc
  limit 1;
  if not found then return; end if;

  insert into accounting_entries (source, source_id, entry_date, account_code, vat_rate, reverse_charge, no_receipt_reason, classified_by)
  values ('bank', tx.id, coalesce(tx.settled_at, tx.emitted_at, now())::date, r.account_code, r.vat_rate, r.reverse_charge, r.no_receipt_reason, 'regle')
  on conflict (source, source_id) do nothing;
exception when others then
  -- Un mois clôturé ou une règle cassée ne doit jamais bloquer la synchro
  -- bancaire : le mouvement restera simplement « à classer ».
  null;
end $$;

create or replace function accounting_bank_tx_inserted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform accounting_apply_rules(new);
  return new;
end $$;

create trigger bank_transactions_auto_classify
  after insert on bank_transactions
  for each row execute function accounting_bank_tx_inserted();

-- Rattrapage : on classe l'historique déjà importé.
do $$
declare
  tx bank_transactions;
begin
  for tx in select * from bank_transactions loop
    perform accounting_apply_rules(tx);
  end loop;
end $$;

-- ── Sécurité ────────────────────────────────────────────────────────────────
alter table accounting_settings enable row level security;
alter table accounting_accounts enable row level security;
alter table accounting_entries enable row level security;
alter table accounting_rules enable row level security;
alter table accounting_periods enable row level security;
alter table accounting_vat_filings enable row level security;

-- Le tableau de bord est mono-entreprise : tout utilisateur connecté gère la
-- compta, comme pour les dépenses et les réservations.
create policy "compta settings" on accounting_settings for all to authenticated using (true) with check (true);
create policy "compta accounts read" on accounting_accounts for select to authenticated using (true);
create policy "compta entries" on accounting_entries for all to authenticated using (true) with check (true);
create policy "compta rules" on accounting_rules for all to authenticated using (true) with check (true);
create policy "compta periods" on accounting_periods for all to authenticated using (true) with check (true);
create policy "compta vat filings" on accounting_vat_filings for all to authenticated using (true) with check (true);

-- ── Justificatifs (stockage privé) ──────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('justificatifs', 'justificatifs', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "justificatifs lecture" on storage.objects for select to authenticated
  using (bucket_id = 'justificatifs');
create policy "justificatifs ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'justificatifs');
-- Pas de suppression ni de remplacement depuis le tableau de bord : une pièce
-- comptable se conserve (10 ans). On peut en rattacher une autre, l'ancienne
-- reste dans le bucket.
