// Outils partagés de l'espace Finance (pages Finance, Réservations, Rapports).
// Fichier SANS JSX ni hook : importable aussi bien par un composant serveur
// que par un composant client.

export const MOIS_COURT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
export const MOIS_ABBR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const JOURS_COURT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
export const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export const DAY_MS = 86_400_000;

/** Midi UTC : le jour affiché ne bascule pas avec le fuseau du serveur. */
export function noonUtc(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`);
}

/** « 2026-10-12 » → « 12 oct. » */
export function shortDate(iso: string): string {
  const d = noonUtc(iso);
  return `${d.getUTCDate()} ${MOIS_ABBR[d.getUTCMonth()]}`;
}

/** « 2026-10-12 » → « 12 octobre 2026 » (l'année seulement si différente de `year`). */
export function longDate(iso: string, year?: number): string {
  const d = noonUtc(iso);
  const y = d.getUTCFullYear();
  return `${d.getUTCDate()} ${MOIS_LONG[d.getUTCMonth()]}${year != null && y === year ? "" : ` ${y}`}`;
}

/** Écart en jours entre deux dates ISO (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((noonUtc(b).getTime() - noonUtc(a).getTime()) / DAY_MS);
}

/** Ancienneté lisible d'un horodatage : « à l'instant », « il y a 2 h », « le 12 oct. ». */
export function sinceLabel(iso: string, now: Date = new Date()): string {
  const min = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 2) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60) return `il y a ${Math.round(min / 60)} h`;
  if (min < 48 * 60) return "hier";
  return `le ${shortDate(iso)}`;
}

/** Ancienneté en heures (Infinity si inconnue) — pour colorer un état de synchro. */
export function hoursSince(iso: string | null | undefined, now: Date = new Date()): number {
  if (!iso) return Infinity;
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000;
}

/** 12.4 → « 12,4 » (une décimale au plus, virgule française). */
export function decimal(n: number, digits = 1): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function plural(n: number, one: string, many: string): string {
  return Math.abs(n) > 1 ? many : one;
}

/** Les numeric Postgres arrivent en nombre OU en chaîne selon leur taille. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Part entière en pourcentage, 0 si le tout est nul. */
export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** « Nuit Insolite (avec sortie en mer) » → « Nuit Insolite ». */
export function cleanOffer(raw: string | null | undefined): string | null {
  const clean = raw?.replace(/\s*\(.*?\)\s*/g, " ").trim();
  return clean || null;
}

// ── Libellés métier ─────────────────────────────────────────────────────
// Les mêmes clés que les tables `expenses.category` et `revenues.type`.

export const EXPENSE_LABELS: Record<string, string> = {
  subscription: "Abonnements",
  marketing: "Marketing",
  fuel: "Gasoil",
  maintenance: "Entretien",
  tools: "Outils",
  subcontract: "Sous-traitance",
  fixed_monthly: "Mensualités fixes",
  salary: "Salaires",
  taxes: "Taxes",
  savings: "Épargne",
  other: "Autre",
};

export const REVENUE_LABELS: Record<string, string> = {
  sea_trip: "Sorties en mer",
  unusual_night: "Nuits insolites",
  efoil: "E-Foil",
  other: "Autre",
};

// ── Périodes ────────────────────────────────────────────────────────────
// Le filtre de période vit dans l'URL (?from=…&to=…). Ces outils la lisent
// pour la nommer et pour trouver la période à laquelle la comparer.

/** Bornes du filtre « Tout » — gardées identiques à components/finances/period-filter.tsx. */
export const ALL_TIME_FROM = "2020-01-01";
export const ALL_TIME_TO = "2099-12-31";

/** « 2026-10-30 » + 3 → « 2026-11-02 », sans dépendre du fuseau. */
export function isoAddDays(iso: string, days: number): string {
  return new Date(noonUtc(iso).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Dernier jour du mois (1–12). */
function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export type PeriodKind = "all" | "month" | "year" | "range";

export function periodKind(from: string, to: string): PeriodKind {
  if (from <= ALL_TIME_FROM && to >= ALL_TIME_TO) return "all";
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (fy === ty && fd === 1 && fm === 1 && tm === 12 && td === 31) return "year";
  if (fy === ty && fm === tm && fd === 1 && td === lastDay(ty, tm)) return "month";
  return "range";
}

/** Le nom de la période, pour un sur-titre : « novembre 2026 », « 2026 », « depuis le début ». */
export function periodLabel(from: string, to: string): string {
  const kind = periodKind(from, to);
  if (kind === "all") return "depuis le début";
  if (kind === "year") return from.slice(0, 4);
  if (kind === "month") {
    const d = noonUtc(from);
    return `${MOIS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  return `du ${shortDate(from)} au ${shortDate(to)}`;
}

/**
 * La période de comparaison, À DATE ÉGALE.
 *
 * Le 1er novembre, comparer « ce mois » (un jour écoulé) à tout octobre
 * afficherait −95 % : une chute qui n'existe pas. On compare donc la part
 * écoulée de la période à la même part de la précédente — même logique que
 * le CA « à date égale l'an dernier » de la Vue d'ensemble.
 *
 * null pour « Tout » : il n'y a rien avant le début.
 */
export function previousPeriod(
  from: string,
  to: string,
  todayIso: string,
): { from: string; to: string; label: string } | null {
  const kind = periodKind(from, to);
  if (kind === "all" || from > todayIso) return null;
  const effectiveTo = to < todayIso ? to : todayIso;
  const partial = effectiveTo < to;
  const elapsed = daysBetween(from, effectiveTo);

  let prevFrom: string;
  let prevEnd: string;
  let name: string;
  if (kind === "month") {
    const d = noonUtc(from);
    const y = d.getUTCMonth() === 0 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
    const m = d.getUTCMonth() === 0 ? 12 : d.getUTCMonth();
    prevFrom = `${y}-${String(m).padStart(2, "0")}-01`;
    prevEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay(y, m)).padStart(2, "0")}`;
    name = MOIS_LONG[m - 1];
  } else if (kind === "year") {
    const y = Number(from.slice(0, 4)) - 1;
    prevFrom = `${y}-01-01`;
    prevEnd = `${y}-12-31`;
    name = String(y);
  } else {
    const span = daysBetween(from, to) + 1;
    prevFrom = isoAddDays(from, -span);
    prevEnd = isoAddDays(from, -1);
    name = `les ${span} jours d'avant`;
  }
  const capped = isoAddDays(prevFrom, elapsed);
  const prevTo = capped < prevEnd ? capped : prevEnd;
  const label =
    kind === "range" ? `vs ${name}` : partial ? `vs ${name} à date égale` : `vs ${name}`;
  return { from: prevFrom, to: prevTo, label };
}

/**
 * Cumul jour après jour d'une série de montants datés, de `from` jusqu'à
 * `to` (borné à aujourd'hui : on ne dessine pas l'avenir à plat). Au-delà
 * de 40 jours, les points sont regroupés pour garder ~24 points lisibles.
 */
export function cumulative(
  rows: Array<{ date: string; amount: number | null }>,
  from: string,
  to: string,
  todayIso: string,
): number[] {
  const end = to < todayIso ? to : todayIso;
  if (end < from) return [];
  const days = daysBetween(from, end) + 1;
  const perDay = new Array<number>(days).fill(0);
  for (const r of rows) {
    if (r.date < from || r.date > end) continue;
    perDay[daysBetween(from, r.date)] += r.amount ?? 0;
  }
  const step = days > 40 ? Math.ceil(days / 24) : 1;
  const out: number[] = [];
  let run = 0;
  for (let i = 0; i < days; i++) {
    run += perDay[i];
    if ((i + 1) % step === 0 || i === days - 1) out.push(run);
  }
  return out;
}
