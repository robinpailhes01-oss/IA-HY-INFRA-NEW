// Le planning : une seule vue de ce qui occupe le bateau — réservations,
// blocages posés à la main, événements publics.

export type PlanningKind = "sortie" | "nuit" | "blocage" | "evenement" | "autre";

export type PlanningItem = {
  id: string;
  source: "booking" | "block" | "event";
  kind: PlanningKind;
  date: string; // AAAA-MM-JJ
  start: string | null; // HH:MM
  end: string | null;
  title: string;
  subtitle: string | null;
  people: number | null;
  total: number | null;
  balance: number | null;
  depositPaid: boolean | null;
  note: string | null;
};

export const KIND_LABEL: Record<PlanningKind, string> = {
  sortie: "Sortie en mer",
  nuit: "Nuit à bord",
  blocage: "Bloqué",
  evenement: "Événement",
  autre: "Autre",
};

/** Couleur de pastille par type — la même partout dans la page. */
export const KIND_STYLE: Record<PlanningKind, { dot: string; chip: string }> = {
  sortie: { dot: "bg-ocean", chip: "bg-[rgba(47,127,224,0.13)] text-ocean" },
  nuit: { dot: "bg-indigo", chip: "bg-[rgba(109,124,242,0.14)] text-indigo" },
  blocage: { dot: "bg-danger", chip: "bg-[rgba(224,77,85,0.12)] text-danger" },
  evenement: { dot: "bg-warning", chip: "bg-[rgba(217,130,43,0.14)] text-warning" },
  autre: { dot: "bg-ink-3", chip: "bg-[rgba(11,37,69,0.07)] text-ink-2" },
};

export function kindOfBooking(bookingType: string | null, offerName: string | null): PlanningKind {
  const t = (bookingType ?? "").toLowerCase();
  if (t.startsWith("nuit")) return "nuit";
  if (t.includes("sortie")) return "sortie";
  const n = (offerName ?? "").toLowerCase();
  if (n.includes("nuit")) return "nuit";
  if (n.includes("sortie") || n.includes("efoil")) return "sortie";
  return "autre";
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** « 2026-11 » valide, sinon le mois courant. */
export function monthParam(raw: string | undefined, todayIso: string): string {
  return raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : todayIso.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const d = parse(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** Les 6 semaines affichées (lundi → dimanche), 42 jours. */
export function gridDays(month: string): string[] {
  const first = parse(`${month}-01`);
  const dow = (first.getUTCDay() + 6) % 7; // lundi = 0
  const start = new Date(first.getTime() - dow * 86_400_000);
  return Array.from({ length: 42 }, (_, i) => isoOf(new Date(start.getTime() + i * 86_400_000)));
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const monthTitle = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${MOIS[m - 1]} ${y}`;
};
export const dayTitle = (iso: string) => {
  const d = parse(iso);
  const t = `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);
