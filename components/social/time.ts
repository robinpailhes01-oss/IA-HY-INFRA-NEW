// Le temps, à l'heure de Carnon. Les dates du carnet (publish_date) et des
// vues d'audience (day) sont des jours « locaux » AAAA-MM-JJ : on compare des
// clés de jour, jamais des horodatages, sinon un serveur en UTC décalerait
// les publications de 23 h d'un jour.

export const DAY_MS = 86_400_000;

const parisDay = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Clé AAAA-MM-JJ à l'heure de Paris. */
export function dayKey(date: Date | string | number): string {
  return parisDay.format(new Date(date));
}

/** Décale une clé de jour de `n` jours (calcul à midi UTC : pas de piège d'heure d'été). */
export function addDays(key: string, n: number): string {
  const t = new Date(`${key}T12:00:00Z`).getTime() + n * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** Écart en jours entre deux clés (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / DAY_MS,
  );
}

/** 0 = lundi … 6 = dimanche. */
export function weekdayMon(key: string): number {
  return (new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7;
}

export const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
export const JOURS_COURTS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
export const JOURS_INITIALES = ["L", "M", "M", "J", "V", "S", "D"];
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 3 nov. » */
export function shortDay(key: string): string {
  const [, m, d] = key.split("-");
  return `${Number(d)} ${MOIS_COURTS[Number(m) - 1]}`;
}

/** « aujourd'hui », « demain », « jeudi », puis « jeu. 12 nov. » au-delà d'une semaine. */
export function relativeDay(key: string, today: string): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "demain";
  if (diff > 1 && diff < 7) return JOURS[weekdayMon(key)];
  return `${JOURS_COURTS[weekdayMon(key)]} ${shortDay(key)}`;
}

/** « 18:00:00 » ou « 18:00 » → « 18 h » / « 18 h 30 », en espaces
 *  insécables : « 12 h » ne doit jamais se couper en fin de ligne. */
export function hourLabel(time: string | null | undefined): string | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  const hh = Number(h);
  if (Number.isNaN(hh)) return null;
  return m && m !== "00" ? `${hh}\u00a0h\u00a0${m}` : `${hh}\u00a0h`;
}

/**
 * Bornes d'une période glissante qui se termine aujourd'hui (incluse).
 * `start` null = depuis le début. `prevStart` borne la période précédente de
 * même durée, pour les variations.
 */
export function periodBounds(
  period: "30" | "90" | "365" | "all",
  today: string,
): { start: string | null; prevStart: string | null; days: number | null } {
  if (period === "all") return { start: null, prevStart: null, days: null };
  const days = Number(period);
  const start = addDays(today, -(days - 1));
  return { start, prevStart: addDays(start, -days), days };
}

/**
 * Découpe [start, end] en `n` tranches égales et renvoie, pour une clé de
 * jour, l'indice de sa tranche (ou -1 hors bornes). Sert aux petites courbes
 * des cartes KPI : sur 30 points quotidiens à quelques unités, une courbe ne
 * serait que du bruit ; six tranches montrent une tendance.
 */
export function bucketer(start: string, end: string, n = 6): (key: string | null | undefined) => number {
  const span = Math.max(1, daysBetween(start, end) + 1);
  return (key) => {
    if (!key) return -1;
    const k = key.slice(0, 10);
    if (k < start || k > end) return -1;
    return Math.min(n - 1, Math.floor((daysBetween(start, k) / span) * n));
  };
}
