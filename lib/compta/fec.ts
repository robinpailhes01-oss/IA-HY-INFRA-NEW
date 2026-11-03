// Fichier des écritures comptables (FEC) — article A47 A-1 du livre des
// procédures fiscales : 18 colonnes, séparateur tabulation, une ligne par
// écriture, débit = crédit pour chaque écriture.
//
// Chaque mouvement de banque (journal BQ) ou de caisse (journal CA) devient
// une écriture équilibrée. Un mouvement non classé part en compte d'attente
// (471) : le fichier reste complet, mais un comptable verra ce qu'il reste à
// traiter.

import {
  BANK_ACCOUNT,
  BANK_FEES,
  CASH_ACCOUNT,
  SUSPENSE_ACCOUNT,
  VAT_COLLECTED,
  VAT_DEDUCTIBLE_ASSETS,
  VAT_DEDUCTIBLE_GOODS,
  VAT_REVERSE_COLLECTED,
  type Account,
} from "@/lib/compta/accounts";
import { round2, type Movement } from "@/lib/compta/ledger";
import type { PeriodRow } from "@/lib/compta/vat";

export const FEC_HEADER = [
  "JournalCode",
  "JournalLib",
  "EcritureNum",
  "EcritureDate",
  "CompteNum",
  "CompteLib",
  "CompAuxNum",
  "CompAuxLib",
  "PieceRef",
  "PieceDate",
  "EcritureLib",
  "Debit",
  "Credit",
  "EcritureLet",
  "DateLet",
  "ValidDate",
  "Montantdevise",
  "Idevise",
] as const;

export type FecLine = {
  journal: "BQ" | "CA";
  num: string;
  date: string;
  account: string;
  accountLabel: string;
  piece: string;
  label: string;
  debit: number;
  credit: number;
  validDate: string;
};

type Leg = { account: string; label: string; debit: number; credit: number };

function legsFor(m: Movement, account: Account | null): Leg[] {
  const treasury = m.source === "bank" ? BANK_ACCOUNT : CASH_ACCOUNT;
  const acc = account ?? { code: SUSPENSE_ACCOUNT, label: "À classer (compte d'attente)", kind: "attente" as const };
  const amount = m.amount;
  const legs: Leg[] = [];

  if (acc.kind === "produit" && m.direction === "in") {
    const fee = m.sumupFee ?? 0;
    const gross = round2(amount + fee);
    legs.push({ account: treasury.code, label: treasury.label, debit: amount, credit: 0 });
    if (fee > 0) legs.push({ account: BANK_FEES.code, label: BANK_FEES.label, debit: fee, credit: 0 });
    legs.push({ account: acc.code, label: acc.label, debit: 0, credit: round2(gross - m.vat.collected) });
    if (m.vat.collected > 0) legs.push({ account: VAT_COLLECTED.code, label: VAT_COLLECTED.label, debit: 0, credit: m.vat.collected });
    return legs;
  }

  if ((acc.kind === "charge" || acc.kind === "immobilisation") && m.direction === "out") {
    const vatAcc = acc.kind === "immobilisation" ? VAT_DEDUCTIBLE_ASSETS : VAT_DEDUCTIBLE_GOODS;
    if (m.vat.reverseVat > 0) {
      legs.push({ account: acc.code, label: acc.label, debit: amount, credit: 0 });
      legs.push({ account: vatAcc.code, label: vatAcc.label, debit: m.vat.reverseVat, credit: 0 });
      legs.push({ account: VAT_REVERSE_COLLECTED.code, label: VAT_REVERSE_COLLECTED.label, debit: 0, credit: m.vat.reverseVat });
      legs.push({ account: treasury.code, label: treasury.label, debit: 0, credit: amount });
      return legs;
    }
    const vat = round2(m.vat.deductible + m.vat.deductibleAssets);
    legs.push({ account: acc.code, label: acc.label, debit: round2(amount - vat), credit: 0 });
    if (vat > 0) legs.push({ account: vatAcc.code, label: vatAcc.label, debit: vat, credit: 0 });
    legs.push({ account: treasury.code, label: treasury.label, debit: 0, credit: amount });
    return legs;
  }

  // Tout le reste (TVA payée, associé, capital, virement interne, attente,
  // remboursements) : une contrepartie simple, sans TVA.
  if (m.direction === "in") {
    legs.push({ account: treasury.code, label: treasury.label, debit: amount, credit: 0 });
    legs.push({ account: acc.code, label: acc.label, debit: 0, credit: amount });
  } else {
    legs.push({ account: acc.code, label: acc.label, debit: amount, credit: 0 });
    legs.push({ account: treasury.code, label: treasury.label, debit: 0, credit: amount });
  }
  return legs;
}

const compact = (iso: string) => iso.slice(0, 10).replace(/-/g, "");

export function buildFec(movements: Movement[], periods: PeriodRow[], exportDate: string): FecLine[] {
  const closed = new Map(periods.filter((p) => p.closed_at).map((p) => [p.month.slice(0, 7), p.closed_at!.slice(0, 10)]));
  const sorted = movements
    .filter((m) => !m.pending && m.amount > 0)
    .sort((a, b) => (a.date === b.date ? (a.key < b.key ? -1 : 1) : a.date < b.date ? -1 : 1));

  const counters = { BQ: 0, CA: 0 };
  const lines: FecLine[] = [];
  for (const m of sorted) {
    const journal = m.source === "bank" ? "BQ" : "CA";
    counters[journal] += 1;
    const num = `${journal}${String(counters[journal]).padStart(5, "0")}`;
    const validDate = closed.get(m.date.slice(0, 7)) ?? exportDate;
    const piece = m.entry?.receipt_name ? m.entry.receipt_name.slice(0, 40) : m.sourceId.slice(0, 8).toUpperCase();
    const label = (m.entry?.label || m.title).slice(0, 100);
    for (const leg of legsFor(m, m.status === "a_classer" ? null : m.account)) {
      if (leg.debit === 0 && leg.credit === 0) continue;
      lines.push({
        journal,
        num,
        date: m.date,
        account: leg.account,
        accountLabel: leg.label,
        piece,
        label,
        debit: leg.debit,
        credit: leg.credit,
        validDate,
      });
    }
  }
  return lines;
}

const money = (n: number) => (n === 0 ? "0,00" : n.toFixed(2).replace(".", ","));
// Le séparateur est la tabulation : on la retire des libellés.
const clean = (s: string) => s.replace(/[\t\r\n|]+/g, " ").trim();

export function fecText(lines: FecLine[]): string {
  const rows = lines.map((l) =>
    [
      l.journal,
      l.journal === "BQ" ? "Banque" : "Caisse",
      l.num,
      compact(l.date),
      l.account,
      clean(l.accountLabel),
      "",
      "",
      clean(l.piece),
      compact(l.date),
      clean(l.label),
      money(l.debit),
      money(l.credit),
      "",
      "",
      compact(l.validDate),
      "",
      "",
    ].join("\t"),
  );
  return [FEC_HEADER.join("\t"), ...rows].join("\r\n") + "\r\n";
}

/** Nom réglementaire : SIRENFECAAAAMMJJ.txt (date de clôture de l'exercice). */
export function fecFileName(siren: string | null, closingIso: string): string {
  return `${(siren ?? "").replace(/\D/g, "") || "000000000"}FEC${compact(closingIso)}.txt`;
}

/** Contrôle d'équilibre : débit = crédit pour chaque écriture. */
export function unbalanced(lines: FecLine[]): string[] {
  const sums = new Map<string, number>();
  for (const l of lines) sums.set(l.num, round2((sums.get(l.num) ?? 0) + l.debit - l.credit));
  return [...sums.entries()].filter(([, v]) => Math.abs(v) > 0.005).map(([k]) => k);
}
