// Petits formats de l'espace Agent, partagés par le serveur (Pilotage) et le
// client (boîte de réception). Aucune dépendance au navigateur : ils
// fonctionnent des deux côtés de la frontière.

const DAY_MS = 86_400_000;

/** « à l'instant », « 12 min », « 3 h », « 2 j », « 5 sem ». */
export function timeAgoShort(iso: string | null | undefined, now: number): string {
  if (!iso) return "—";
  const min = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d} j`;
  return `${Math.round(d / 7)} sem`;
}

/** Version phrase : « il y a 12 min », « à l'instant ». */
export function timeAgoLong(iso: string | null | undefined, now: number): string {
  const short = timeAgoShort(iso, now);
  return short === "à l'instant" || short === "—" ? short : `il y a ${short}`;
}

/** Durée lisible : « 40 s », « 2 min », « 1 h 05 ». */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${String(rest).padStart(2, "0")}` : `${h} h`;
}

/** Initiales d'un contact : prénom + nom, sinon les deux derniers chiffres. */
export function initialsOf(name: string | null | undefined, phone?: string | null): string {
  const clean = name?.replace(/[^\p{L}\s'-]/gu, " ").trim();
  if (clean) {
    const parts = clean.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  }
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.slice(-2) || "?";
}

/** Clé de jour AAAA-MM-JJ à l'heure de Carnon, quel que soit le serveur. */
const parisDay = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function dayKeyParis(date: Date | string | number): string {
  return parisDay.format(new Date(date));
}

/** Les `n` dernières clés de jour (la plus ancienne d'abord), aujourd'hui inclus. */
export function lastDays(n: number, now: number): string[] {
  return Array.from({ length: n }, (_, i) => dayKeyParis(now - (n - 1 - i) * DAY_MS));
}

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 3 nov. » depuis une clé AAAA-MM-JJ (sans fuseau : la clé est déjà locale). */
export function shortDayLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${Number(d)} ${MOIS_COURTS[Number(m) - 1]}`;
}

/** Médiane d'une série (null si vide). */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
