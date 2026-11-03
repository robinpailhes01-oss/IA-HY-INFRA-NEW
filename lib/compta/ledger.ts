// Le cœur de la comptabilité : transformer des mouvements (banque, caisse)
// et leur classement en un journal, une TVA et des écritures.
//
// Fonctions PURES — aucune requête ici. La page, les exports et Léa partagent
// exactement ce calcul (voir lib/compta/data.ts pour le chargement).
//
// Règles de calcul (TVA « sur les encaissements », le régime des prestations
// de services) :
//   · une vente (compte 7) contient de la TVA collectée : TTC × t / (100 + t) ;
//   · un achat (compte 6 ou 2) contient de la TVA déductible, même formule ;
//   · un achat en autoliquidation (fournisseur étranger) est payé HT : on
//     calcule la TVA sur le montant payé (HT × t / 100) et on la déclare à la
//     fois en collectée et en déductible — net nul, mais obligatoire sur la CA3 ;
//   · un virement SumUp arrive NET de commission : la vente réelle est
//     virement + commission. La TVA se calcule sur la vente, la commission
//     devient une charge (627, sans TVA).

import {
  DEFAULT_ACCOUNTS,
  SUSPENSE_ACCOUNT,
  type Account,
} from "@/lib/compta/accounts";

export type EntryRow = {
  id: string;
  source: "bank" | "cash";
  source_id: string;
  entry_date: string;
  account_code: string;
  vat_rate: number | string;
  reverse_charge: boolean;
  vat_amount_override: number | string | null;
  receipt_path: string | null;
  receipt_name: string | null;
  no_receipt_reason: string | null;
  label: string | null;
  note: string | null;
  classified_by: string;
};

export type BankTxRow = {
  id: string;
  side: "debit" | "credit";
  amount_cents: number;
  status: string;
  operation_type: string | null;
  label: string | null;
  counterparty_name: string | null;
  reference: string | null;
  settled_at: string | null;
  emitted_at: string | null;
};

export type CashRow = {
  id: string;
  date: string;
  direction: "in" | "out" | "deposit";
  amount: number | string;
  category: string | null;
  description: string | null;
};

export type SettlementRow = { date: string; net_amount: number | string; fees: number | string | null };

export type RuleRow = {
  id: string;
  pattern: string;
  side: "debit" | "credit" | null;
  operation_type: string | null;
  account_code: string;
  vat_rate: number | string;
  reverse_charge: boolean;
  no_receipt_reason: string | null;
  priority: number;
};

export type Status = "a_classer" | "justificatif" | "ok";

export type Movement = {
  /** `${source}:${id}` — identifiant stable côté interface. */
  key: string;
  source: "bank" | "cash";
  sourceId: string;
  date: string;
  /** Sens pour l'entreprise : « in » = l'argent rentre. */
  direction: "in" | "out";
  /** Montant TTC encaissé ou payé, positif, en euros. */
  amount: number;
  title: string;
  detail: string | null;
  pending: boolean;
  entry: EntryRow | null;
  /** Classement proposé quand rien n'est encore validé. */
  suggestion: { account: string; vatRate: number; reverseCharge: boolean; noReceiptReason: string | null } | null;
  /** Commission SumUp retrouvée pour ce virement (null si inconnue). */
  sumupFee: number | null;
  status: Status;
  account: Account | null;
  vat: VatParts;
};

export type VatParts = {
  /** Base HT des ventes. */
  salesBase: number;
  collected: number;
  /** TVA déductible sur achats courants. */
  deductible: number;
  /** TVA déductible sur immobilisations. */
  deductibleAssets: number;
  /** Autoliquidation : base HT et TVA (collectée ET déductible). */
  reverseBase: number;
  reverseVat: number;
};

const ZERO_VAT: VatParts = { salesBase: 0, collected: 0, deductible: 0, deductibleAssets: 0, reverseBase: 0, reverseVat: 0 };

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const toNum = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

// Correspondance des catégories de dépenses du tableau de bord (expenses /
// cash_movements) vers le plan de comptes — pour proposer un classement aux
// sorties de caisse.
const EXPENSE_CATEGORY_ACCOUNT: Record<string, string> = {
  fuel: "606100",
  maintenance: "615500",
  marketing: "623000",
  subscription: "651100",
  tools: "651100",
  subcontract: "604000",
  fixed_monthly: "613200",
  salary: "641000",
  taxes: "635000",
};

export function accountMap(accounts: Account[] | null | undefined): Map<string, Account> {
  const list = accounts && accounts.length > 0 ? accounts : DEFAULT_ACCOUNTS;
  return new Map(list.map((a) => [a.code, a]));
}

function matchRule(rules: RuleRow[], tx: BankTxRow): RuleRow | null {
  const haystack = `${tx.counterparty_name ?? ""} ${tx.label ?? ""}`.toLowerCase();
  const candidates = rules
    .filter(
      (r) =>
        (!r.side || r.side === tx.side) &&
        (!r.operation_type || r.operation_type === tx.operation_type) &&
        (r.pattern === "" || haystack.includes(r.pattern.toLowerCase())),
    )
    .sort((a, b) => a.priority - b.priority || b.pattern.length - a.pattern.length);
  return candidates[0] ?? null;
}

/** La TVA contenue dans un mouvement classé. */
export function vatFor(
  amount: number,
  direction: "in" | "out",
  account: Account | null,
  rate: number,
  reverseCharge: boolean,
  override: number | null,
): VatParts {
  if (!account || rate <= 0) return ZERO_VAT;
  if (account.kind === "produit" && direction === "in") {
    const vat = override ?? round2((amount * rate) / (100 + rate));
    return { ...ZERO_VAT, salesBase: round2(amount - vat), collected: vat };
  }
  if ((account.kind === "charge" || account.kind === "immobilisation") && direction === "out") {
    if (reverseCharge) {
      const vat = override ?? round2((amount * rate) / 100);
      return { ...ZERO_VAT, reverseBase: amount, reverseVat: vat };
    }
    const vat = override ?? round2((amount * rate) / (100 + rate));
    return account.kind === "immobilisation"
      ? { ...ZERO_VAT, deductibleAssets: vat }
      : { ...ZERO_VAT, deductible: vat };
  }
  // Remboursement fournisseur, avoir client… : rare, laissé au calcul manuel
  // via vat_amount_override plutôt que deviné.
  return ZERO_VAT;
}

export function statusOf(entry: EntryRow | null, account: Account | null): Status {
  if (!entry || !account || entry.account_code === SUSPENSE_ACCOUNT) return "a_classer";
  if (account.needs_receipt && !entry.receipt_path && !entry.no_receipt_reason) return "justificatif";
  return "ok";
}

export function buildLedger({
  bank,
  cash,
  entries,
  rules,
  accounts,
  settlements,
}: {
  bank: BankTxRow[];
  cash: CashRow[];
  entries: EntryRow[];
  rules: RuleRow[];
  accounts: Map<string, Account>;
  settlements: SettlementRow[];
}): Movement[] {
  const byKey = new Map(entries.map((e) => [`${e.source}:${e.source_id}`, e]));
  const out: Movement[] = [];

  for (const tx of bank) {
    if (tx.status !== "completed" && tx.status !== "pending") continue;
    const date = (tx.settled_at ?? tx.emitted_at ?? "").slice(0, 10);
    if (!date) continue;
    const amount = round2((tx.amount_cents ?? 0) / 100);
    const direction = tx.side === "credit" ? "in" : "out";
    const entry = byKey.get(`bank:${tx.id}`) ?? null;
    const rule = entry ? null : matchRule(rules, tx);

    // Commission SumUp : le virement du jour J correspond à une ligne de
    // sumup_daily_settlements au montant identique, quelques jours avant.
    let sumupFee: number | null = null;
    const who = `${tx.counterparty_name ?? ""} ${tx.label ?? ""}`;
    if (direction === "in" && /sum\s?up/i.test(who)) {
      const t = Date.parse(date);
      const match = settlements.find((s) => {
        const d = Date.parse(s.date);
        return Math.abs((toNum(s.net_amount) ?? 0) - amount) < 0.02 && t - d >= -86_400_000 && t - d <= 7 * 86_400_000;
      });
      sumupFee = match ? toNum(match.fees) : null;
    }

    out.push(
      finish({
        key: `bank:${tx.id}`,
        source: "bank",
        sourceId: tx.id,
        date,
        direction,
        amount,
        title: tx.counterparty_name || tx.label || "Mouvement bancaire",
        detail: tx.counterparty_name && tx.label && tx.label !== tx.counterparty_name ? tx.label : tx.reference,
        pending: tx.status === "pending",
        entry,
        suggestion: rule
          ? {
              account: rule.account_code,
              vatRate: toNum(rule.vat_rate) ?? 0,
              reverseCharge: rule.reverse_charge,
              noReceiptReason: rule.no_receipt_reason,
            }
          : null,
        sumupFee,
      }, accounts),
    );
  }

  for (const c of cash) {
    const amount = round2(toNum(c.amount) ?? 0);
    const entry = byKey.get(`cash:${c.id}`) ?? null;
    let suggestion: Movement["suggestion"] = null;
    if (c.direction === "deposit") {
      suggestion = { account: "580000", vatRate: 0, reverseCharge: false, noReceiptReason: "Dépôt d'espèces sur le compte" };
    } else if (c.direction === "in") {
      suggestion = { account: "706100", vatRate: 10, reverseCharge: false, noReceiptReason: null };
    } else {
      const code = EXPENSE_CATEGORY_ACCOUNT[c.category ?? ""];
      const acc = code ? accounts.get(code) : undefined;
      if (acc) suggestion = { account: acc.code, vatRate: acc.default_vat_rate, reverseCharge: false, noReceiptReason: null };
    }
    out.push(
      finish({
        key: `cash:${c.id}`,
        source: "cash",
        sourceId: c.id,
        date: c.date,
        // Un dépôt sort de la caisse (il entre en banque, déjà vu côté Qonto).
        direction: c.direction === "in" ? "in" : "out",
        amount,
        title:
          c.direction === "deposit"
            ? "Dépôt d'espèces en banque"
            : c.description || (c.direction === "in" ? "Encaissement espèces" : "Dépense en espèces"),
        detail: c.direction === "deposit" ? null : c.direction === "in" ? "Caisse · encaissement" : "Caisse · dépense",
        pending: false,
        entry,
        suggestion,
        sumupFee: null,
      }, accounts),
    );
  }

  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.key < b.key ? -1 : 1));
}

function finish(
  m: Omit<Movement, "status" | "account" | "vat">,
  accounts: Map<string, Account>,
): Movement {
  const account = m.entry ? accounts.get(m.entry.account_code) ?? null : null;
  const rate = toNum(m.entry?.vat_rate) ?? 0;
  // La vente SumUp réelle = virement + commission.
  const gross = m.sumupFee && account?.kind === "produit" ? round2(m.amount + m.sumupFee) : m.amount;
  const vat = m.entry
    ? vatFor(gross, m.direction, account, rate, m.entry.reverse_charge, toNum(m.entry.vat_amount_override))
    : ZERO_VAT;
  return { ...m, account, vat, status: statusOf(m.entry, account) };
}

// ── Agrégats ────────────────────────────────────────────────────────────────

export type VatTotals = VatParts & {
  /** Commissions SumUp (charge 627 sans TVA). */
  fees: number;
  /** TVA nette due (négatif = crédit de TVA). */
  net: number;
  /** Mouvements de la période encore à classer (la TVA peut être fausse). */
  unclassified: number;
};

export function vatTotals(movements: Movement[]): VatTotals {
  const t = { ...ZERO_VAT, fees: 0, net: 0, unclassified: 0 };
  for (const m of movements) {
    t.salesBase += m.vat.salesBase;
    t.collected += m.vat.collected;
    t.deductible += m.vat.deductible;
    t.deductibleAssets += m.vat.deductibleAssets;
    t.reverseBase += m.vat.reverseBase;
    t.reverseVat += m.vat.reverseVat;
    if (m.sumupFee && m.account?.kind === "produit") t.fees += m.sumupFee;
    if (m.status === "a_classer") t.unclassified += 1;
  }
  // L'autoliquidation s'annule : collectée et déductible du même montant.
  t.net = t.collected + t.reverseVat - t.deductible - t.deductibleAssets - t.reverseVat;
  for (const k of ["salesBase", "collected", "deductible", "deductibleAssets", "reverseBase", "reverseVat", "fees", "net"] as const) {
    t[k] = round2(t[k]);
  }
  return t;
}

export const monthKey = (iso: string) => `${iso.slice(0, 7)}-01`;

export function inMonth(movements: Movement[], month: string): Movement[] {
  const prefix = month.slice(0, 7);
  return movements.filter((m) => m.date.startsWith(prefix));
}

/** Résultat d'exploitation simplifié (HT) : ventes − charges, hors TVA. */
export function resultOf(movements: Movement[]): { sales: number; charges: number; result: number } {
  let sales = 0;
  let charges = 0;
  for (const m of movements) {
    if (!m.account) continue;
    if (m.account.kind === "produit") {
      const gross = m.sumupFee ? m.amount + m.sumupFee : m.amount;
      sales += (m.direction === "in" ? 1 : -1) * (gross - m.vat.collected);
      if (m.sumupFee) charges += m.sumupFee;
    } else if (m.account.kind === "charge") {
      const ht = m.entry?.reverse_charge ? m.amount : m.amount - m.vat.deductible;
      charges += (m.direction === "out" ? 1 : -1) * ht;
    }
  }
  return { sales: round2(sales), charges: round2(charges), result: round2(sales - charges) };
}
