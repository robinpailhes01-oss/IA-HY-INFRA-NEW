// Domaines des moteurs IA génératifs — distingués du reste des référents
// pour suivre la contribution du travail GEO (visibilité dans les réponses
// IA) séparément du référencement classique.
export const AI_REFERRER_DOMAINS = new Set([
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "claude.ai",
  "copilot.microsoft.com",
]);

export function isAiReferrer(hostname: string): boolean {
  return AI_REFERRER_DOMAINS.has(hostname.toLowerCase());
}

export type ReferrerRow = { hostname: string; visitors: number; pageviews: number };
export type PageRow = { path: string; visitors: number; pageviews: number };

export type AnalyticsSnapshot = {
  snapshot_date: string;
  visitors: number;
  pageviews: number;
  top_referrers: ReferrerRow[];
  top_pages: PageRow[];
};

export type AnalyticsPeriod = "30" | "90" | "365" | "all";

export const PERIOD_OPTIONS: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "365", label: "1 an" },
  { value: "all", label: "Tout l'historique" },
];

export function filterByPeriod(
  snapshots: AnalyticsSnapshot[],
  period: AnalyticsPeriod,
): AnalyticsSnapshot[] {
  if (period === "all") return snapshots;
  const days = Number(period);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return snapshots.filter((s) => s.snapshot_date >= cutoffStr);
}

/** Agrège les référents/pages de plusieurs jours en un classement unique. */
function aggregateRows<T extends { visitors: number; pageviews: number }>(
  rows: T[],
  key: (row: T) => string,
): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const k = key(row);
    const existing = map.get(k);
    if (existing) {
      existing.visitors += row.visitors;
      existing.pageviews += row.pageviews;
    } else {
      map.set(k, { ...row });
    }
  }
  return [...map.values()].sort((a, b) => b.visitors - a.visitors);
}

export function aggregateReferrers(snapshots: AnalyticsSnapshot[]): ReferrerRow[] {
  return aggregateRows(
    snapshots.flatMap((s) => s.top_referrers ?? []),
    (r) => r.hostname,
  );
}

export function aggregatePages(snapshots: AnalyticsSnapshot[]): PageRow[] {
  return aggregateRows(
    snapshots.flatMap((s) => s.top_pages ?? []),
    (p) => p.path,
  );
}
