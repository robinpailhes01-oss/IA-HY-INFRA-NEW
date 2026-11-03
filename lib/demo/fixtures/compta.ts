/* eslint-disable @typescript-eslint/no-explicit-any */
// Fixtures du mode démo — comptabilité (migration 0035).
//
// Trois mois de relevé Qonto réaliste pour une fin de saison : virements
// SumUp et Stripe, gasoil, place de port, URSSAF, logiciels étrangers… Une
// partie classée (par règle ou à la main), une partie à classer, quelques
// justificatifs manquants, septembre clôturé : tous les états de la page
// existent à l'écran.
import { DEFAULT_ACCOUNTS } from "@/lib/compta/accounts";
import { demo } from "@/lib/demo/fixtures/core";

type Row = Record<string, any>;
const { daysFromNow, iso } = demo;

let n = 0;
const id = (p: string) => {
  n += 1;
  return `${p}${String(n).padStart(4, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
};

// [jours avant aujourd'hui, sens, montant €, contrepartie, libellé, type d'opération, classement, justificatif]
type Plan = [number, "debit" | "credit", number, string, string, string, { a: string; v: number; rc?: boolean; by?: string; nr?: string } | null, string | null];

const PLAN: Plan[] = [
  [2, "credit", 1187.4, "SumUp", "SUMUP PAYOUT", "transfer", null, null],
  [3, "debit", 312.6, "TotalEnergies Port", "CARTE TOTALENERGIES", "card", { a: "606100", v: 20, by: "regle" }, null],
  [4, "debit", 48, "Google", "GOOGLE ADS", "card", null, null],
  [5, "credit", 640, "Stripe", "STRIPE PAYOUT", "transfer", null, null],
  [6, "debit", 89.9, "Notion Labs", "NOTION", "card", null, null],
  [8, "debit", 1240, "Chantier Naval Méditerranée", "VIR ENTRETIEN COQUE", "transfer", null, null],
  [9, "debit", 7.5, "Qonto", "Frais de tenue de compte", "qonto_fee", null, null],
  [11, "credit", 2410.15, "SumUp", "SUMUP PAYOUT", "transfer", { a: "706100", v: 10, by: "regle", nr: "Ventes détaillées dans SumUp" }, null],
  [13, "debit", 186.4, "TotalEnergies Port", "CARTE TOTALENERGIES", "card", { a: "606100", v: 20, by: "regle" }, null],
  [16, "debit", 620, "Port de Saint-Laurent", "PLACE DE PORT NOVEMBRE", "direct_debit", { a: "613200", v: 20 }, "facture-port-novembre.pdf"],
  [19, "debit", 1412, "URSSAF", "PRLV URSSAF", "direct_debit", { a: "645000", v: 0, by: "regle" }, "urssaf-octobre.pdf"],
  [21, "credit", 950, "Mariage Lefèvre", "VIR ACOMPTE NUIT INSOLITE", "transfer", { a: "706200", v: 10 }, "facture-HY-2026-118.pdf"],
  [24, "debit", 214.3, "Anthropic", "ANTHROPIC CLAUDE", "card", { a: "651100", v: 20, rc: true, by: "regle" }, null],
  [26, "debit", 1800, "DGFIP", "PRLV SEPA DGFIP TVA", "direct_debit", { a: "445510", v: 0 }, null],
  [29, "credit", 3164.8, "SumUp", "SUMUP PAYOUT", "transfer", { a: "706100", v: 10, by: "regle", nr: "Ventes détaillées dans SumUp" }, null],
  [33, "debit", 412.5, "Axa Plaisance", "ASSURANCE BATEAU", "direct_debit", { a: "616000", v: 0 }, "axa-echeance.pdf"],
  [36, "debit", 268.9, "Shell Marine", "CARTE SHELL", "card", { a: "606100", v: 20, by: "regle" }, "ticket-shell.jpg"],
  [41, "debit", 520, "Skipper Julien M.", "VIR PRESTATION SKIPPER", "transfer", { a: "604000", v: 0 }, "facture-skipper-julien.pdf"],
  [44, "credit", 4820.6, "SumUp", "SUMUP PAYOUT", "transfer", { a: "706100", v: 10, by: "regle", nr: "Ventes détaillées dans SumUp" }, null],
  [47, "debit", 620, "Port de Saint-Laurent", "PLACE DE PORT OCTOBRE", "direct_debit", { a: "613200", v: 20 }, "facture-port-octobre.pdf"],
  [52, "debit", 95.2, "Vercel", "VERCEL INC", "card", { a: "651100", v: 20, rc: true, by: "regle" }, "vercel-invoice.pdf"],
  [55, "credit", 1250, "Stripe", "STRIPE PAYOUT", "transfer", { a: "706100", v: 10, by: "regle", nr: "Acomptes en ligne : détail dans Stripe" }, null],
  [58, "debit", 7.5, "Qonto", "Frais de tenue de compte", "qonto_fee", { a: "627000", v: 0, by: "regle", nr: "Frais bancaires : figurent sur le relevé Qonto" }, null],
  [61, "debit", 1412, "URSSAF", "PRLV URSSAF", "direct_debit", { a: "645000", v: 0, by: "regle" }, "urssaf-septembre.pdf"],
  [64, "credit", 6120.3, "SumUp", "SUMUP PAYOUT", "transfer", { a: "706100", v: 10, by: "regle", nr: "Ventes détaillées dans SumUp" }, null],
  [70, "debit", 380.4, "TotalEnergies Port", "CARTE TOTALENERGIES", "card", { a: "606100", v: 20, by: "regle" }, "ticket-total-0912.jpg"],
  [74, "debit", 1650, "Nautic Pro", "VIR ACHAT EFOIL BATTERIE", "transfer", { a: "215400", v: 20 }, "facture-nautic-pro.pdf"],
  [78, "credit", 5400, "SumUp", "SUMUP PAYOUT", "transfer", { a: "706100", v: 10, by: "regle", nr: "Ventes détaillées dans SumUp" }, null],
];

const bank_transactions: Row[] = [];
const accounting_entries: Row[] = [];
const sumup_daily_settlements: Row[] = [];

for (const [ago, side, amount, cp, label, op, cls, receipt] of PLAN) {
  const date = iso(daysFromNow(-ago));
  const txId = id("b");
  bank_transactions.push({
    id: txId,
    side,
    amount_cents: Math.round(amount * 100),
    status: ago <= 1 ? "pending" : "completed",
    operation_type: op,
    label,
    counterparty_name: cp,
    reference: null,
    settled_at: `${date}T10:00:00Z`,
    emitted_at: `${date}T09:00:00Z`,
  });
  if (cp === "SumUp") {
    // Commission ≈ 1,75 % de la vente : le virement est net.
    const fee = Math.round(((amount / (1 - 0.0175)) * 0.0175) * 100) / 100;
    sumup_daily_settlements.push({ date: iso(daysFromNow(-ago - 2)), currency: "EUR", net_amount: amount, fees: fee, line_count: 6 });
  }
  if (cls) {
    accounting_entries.push({
      id: id("e"),
      source: "bank",
      source_id: txId,
      entry_date: date,
      account_code: cls.a,
      vat_rate: cls.v,
      reverse_charge: Boolean(cls.rc),
      vat_amount_override: null,
      receipt_path: receipt ? `${date.slice(0, 4)}/${date.slice(5, 7)}/${receipt}` : null,
      receipt_name: receipt,
      no_receipt_reason: cls.nr ?? null,
      label: null,
      note: null,
      classified_by: cls.by ?? "robin",
    });
  }
}

const cash_movements: Row[] = [
  { id: id("c"), date: iso(daysFromNow(-7)), direction: "in", amount: 180, category: null, description: "Sortie coucher de soleil · espèces" },
  { id: id("c"), date: iso(daysFromNow(-18)), direction: "out", amount: 42.5, category: "fuel", description: "Bidon d'essence annexe" },
  { id: id("c"), date: iso(daysFromNow(-30)), direction: "deposit", amount: 600, category: null, description: null },
];

const month = (ago: number) => {
  const d = daysFromNow(-ago);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

const accounting_periods: Row[] = [
  { month: month(70), closed_at: `${iso(daysFromNow(-60))}T08:00:00Z`, vat_declared_at: `${iso(daysFromNow(-62))}T08:00:00Z`, vat_declared_amount: 640.1, note: null },
  { month: month(50), closed_at: `${iso(daysFromNow(-30))}T08:00:00Z`, vat_declared_at: `${iso(daysFromNow(-32))}T08:00:00Z`, vat_declared_amount: 412.4, note: null },
];

const accounting_settings: Row[] = [
  {
    id: true,
    company_name: "Harmonie Yacht",
    legal_form: "SAS",
    siren: null,
    vat_regime: "normal",
    vat_due_day: 19,
    fiscal_year_start_month: 1,
    previous_year_vat: 4200,
  },
];

const accounting_rules: Row[] = [
  ["", "debit", "qonto_fee", "627000", 0, false, "Frais bancaires : figurent sur le relevé Qonto", 10],
  ["sumup", "credit", null, "706100", 10, false, "Ventes détaillées dans SumUp", 20],
  ["stripe", "credit", null, "706100", 10, false, "Acomptes en ligne : détail dans Stripe", 20],
  ["urssaf", "debit", null, "645000", 0, false, null, 30],
  ["total", "debit", null, "606100", 20, false, null, 50],
  ["google", "debit", null, "623000", 20, true, null, 60],
  ["notion", "debit", null, "651100", 20, true, null, 60],
  ["anthropic", "debit", null, "651100", 20, true, null, 60],
].map(([pattern, side, operation_type, account_code, vat_rate, reverse_charge, no_receipt_reason, priority]) => ({
  id: id("r"),
  pattern,
  side,
  operation_type,
  account_code,
  vat_rate,
  reverse_charge,
  no_receipt_reason,
  priority,
}));

export const comptaFixtures: Record<string, Row[]> = {
  bank_transactions,
  accounting_entries,
  sumup_daily_settlements,
  cash_movements,
  accounting_periods,
  accounting_settings,
  accounting_rules,
  accounting_accounts: DEFAULT_ACCOUNTS,
  accounting_vat_filings: [],
};

