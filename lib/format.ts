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

export function formatEurCompact(value: number | null | undefined): string {
  return eurCompact.format(value ?? 0);
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
