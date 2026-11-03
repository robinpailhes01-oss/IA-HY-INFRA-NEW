// Le calendrier de TVA — les deux régimes, pour qu'un changement de régime
// ne demande qu'un réglage.
//
// · Réel normal : une CA3 par mois, à déposer le mois suivant avant le jour
//   limite indiqué dans l'espace professionnel (entre le 15 et le 24).
// · Réel simplifié : une CA12 annuelle (début mai de l'année suivante pour un
//   exercice calé sur l'année civile) + deux acomptes calculés sur la TVA de
//   l'année précédente : 55 % en juillet, 40 % en décembre. Pas d'acompte si
//   cette TVA était inférieure à 1 000 €.
//
// Les dates exactes sont celles de l'espace professionnel impots.gouv : ce
// calendrier sert de rappel, il ne fait pas foi.

import { inMonth, round2, vatTotals, type Movement, type VatTotals } from "@/lib/compta/ledger";

export type VatRegime = "normal" | "simplifie";

export type Settings = {
  company_name: string;
  legal_form: string;
  siren: string | null;
  vat_regime: VatRegime;
  vat_due_day: number;
  fiscal_year_start_month: number;
  previous_year_vat: number | string | null;
};

export const DEFAULT_SETTINGS: Settings = {
  company_name: "Harmonie Yacht",
  legal_form: "SAS",
  siren: null,
  vat_regime: "normal",
  vat_due_day: 19,
  fiscal_year_start_month: 1,
  previous_year_vat: null,
};

export type PeriodRow = {
  month: string;
  closed_at: string | null;
  vat_declared_at: string | null;
  vat_declared_amount: number | string | null;
};

export type FilingRow = { year: number; kind: "acompte_juillet" | "acompte_decembre" | "ca12" | "ca3"; amount: number | string | null; filed_at: string };

export type Obligation = {
  id: string;
  kind: "ca3" | "acompte_juillet" | "acompte_decembre" | "ca12";
  label: string;
  /** Mois concerné (CA3) ou année (CA12, acomptes). */
  period: string;
  due: string;
  amount: number;
  totals: VatTotals | null;
  state: "declaree" | "a_declarer" | "en_retard" | "en_cours" | "a_venir";
  declaredAmount: number | null;
};

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${MOIS[m - 1]} ${y}`;
};

const pad = (n: number) => String(n).padStart(2, "0");

function nextMonthDay(month: string, day: number): string {
  const [y, m] = month.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(day, last))}`;
}

function stateFor(declared: boolean, due: string, todayIso: string, periodEnded: boolean): Obligation["state"] {
  if (declared) return "declaree";
  if (!periodEnded) return "en_cours";
  if (todayIso > due) return "en_retard";
  return "a_declarer";
}

export function obligations({
  settings,
  year,
  movements,
  periods,
  filings,
  todayIso,
  since,
}: {
  /** Premier mois suivi par le tableau de bord (avant : hors de sa vue). */
  since?: string | null;
  settings: Settings;
  year: number;
  movements: Movement[];
  periods: PeriodRow[];
  filings: FilingRow[];
  todayIso: string;
}): Obligation[] {
  const out: Obligation[] = [];
  const currentMonth = `${todayIso.slice(0, 7)}-01`;

  if (settings.vat_regime === "normal") {
    for (let m = 1; m <= 12; m++) {
      const month = `${year}-${pad(m)}-01`;
      if (month > currentMonth) break;
      if (since && month < since) continue;
      const totals = vatTotals(inMonth(movements, month));
      const p = periods.find((x) => x.month === month);
      const due = nextMonthDay(month, settings.vat_due_day);
      out.push({
        id: `ca3-${month}`,
        kind: "ca3",
        label: `CA3 · ${monthLabel(month)}`,
        period: month,
        due,
        amount: totals.net,
        totals,
        state: stateFor(Boolean(p?.vat_declared_at), due, todayIso, month < currentMonth),
        declaredAmount: p?.vat_declared_amount != null ? Number(p.vat_declared_amount) : null,
      });
    }
    return out.reverse();
  }

  // Réel simplifié
  const prev = Number(settings.previous_year_vat ?? 0) || 0;
  const filed = (k: FilingRow["kind"]) => filings.find((f) => f.year === year && f.kind === k) ?? null;
  const yearMovements = movements.filter((m) => m.date.startsWith(String(year)));
  const yearTotals = vatTotals(yearMovements);

  const acomptes = prev >= 1000;
  const juillet = acomptes ? round2(prev * 0.55) : 0;
  const decembre = acomptes ? round2(prev * 0.4) : 0;

  if (acomptes) {
    const dueJ = `${year}-07-${pad(Math.min(settings.vat_due_day, 31))}`;
    const fj = filed("acompte_juillet");
    out.push({
      id: `acompte-juillet-${year}`,
      kind: "acompte_juillet",
      label: `Acompte de juillet ${year} (55 %)`,
      period: String(year),
      due: dueJ,
      amount: juillet,
      totals: null,
      state: stateFor(Boolean(fj), dueJ, todayIso, todayIso >= `${year}-07-01`),
      declaredAmount: fj?.amount != null ? Number(fj.amount) : null,
    });
    const dueD = `${year}-12-${pad(Math.min(settings.vat_due_day, 31))}`;
    const fd = filed("acompte_decembre");
    out.push({
      id: `acompte-decembre-${year}`,
      kind: "acompte_decembre",
      label: `Acompte de décembre ${year} (40 %)`,
      period: String(year),
      due: dueD,
      amount: decembre,
      totals: null,
      state: stateFor(Boolean(fd), dueD, todayIso, todayIso >= `${year}-12-01`),
      declaredAmount: fd?.amount != null ? Number(fd.amount) : null,
    });
  }

  // CA12 : le deuxième jour ouvré qui suit le 1er mai de l'année suivante —
  // approximé au 3 mai, à confirmer dans l'espace professionnel.
  const dueCa12 = `${year + 1}-05-03`;
  const fc = filed("ca12");
  out.push({
    id: `ca12-${year}`,
    kind: "ca12",
    label: `CA12 · année ${year}`,
    period: String(year),
    due: dueCa12,
    amount: round2(yearTotals.net - juillet - decembre),
    totals: yearTotals,
    state: stateFor(Boolean(fc), dueCa12, todayIso, todayIso >= `${year + 1}-01-01`),
    declaredAmount: fc?.amount != null ? Number(fc.amount) : null,
  });

  return out;
}
