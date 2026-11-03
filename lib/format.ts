import { format, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eurCompact = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 1,
});

export function formatEur(value: number | null | undefined): string {
  return eur.format(value ?? 0);
}

const eurCents = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Montant au centime — la comptabilité ne s'arrondit pas. */
export function formatEurCents(value: number | null | undefined): string {
  return eurCents.format(value ?? 0);
}

export function formatEurCompact(value: number | null | undefined): string {
  // Sous le millier, la notation compacte n'abrège rien et affichait
  // « 840,0 € » : on rend le montant entier.
  const v = value ?? 0;
  if (Math.abs(v) < 1000) return eur.format(v);
  return eurCompact.format(v);
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("fr-FR").format(value ?? 0);
}

/** Date longue, ex. "12 juin 2026". */
export function formatDateLong(date: string | Date): string {
  return format(new Date(date), "d MMMM yyyy", { locale: fr });
}

/** Date courte avec libellé relatif pour aujourd'hui/demain. */
export function formatDateRelative(date: string | Date): string {
  const d = new Date(date);
  if (isToday(d)) return "Aujourd'hui";
  if (isTomorrow(d)) return "Demain";
  return format(d, "EEE d MMM", { locale: fr });
}

export function formatTimeRange(
  start: string | null,
  end: string | null,
): string | null {
  const trim = (t: string | null) => (t ? t.slice(0, 5) : null);
  const s = trim(start);
  const e = trim(end);
  if (s && e) return `${s} – ${e}`;
  return s ?? e ?? null;
}
