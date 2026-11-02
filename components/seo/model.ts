// La forme d'un passage de l'Auditeur (table seo_audits, écrite par l'Edge
// Function `seo-audit`). Les colonnes JSON `checks` et `pages` arrivent non
// typées : on les relit prudemment, une ligne mal formée ne doit pas faire
// tomber la page.

export type Check = {
  key: string;
  label: string;
  why: string;
  severity: "critical" | "warning";
  status: "pass" | "fail";
  detail: string;
};

export type PageInfo = {
  url: string;
  status: number;
  bytes: number;
  textLength: number;
  title: string | null;
  h1Count: number;
};

export type Audit = {
  id: string;
  site_url: string;
  run_at: string;
  score: number;
  checks_passed: number;
  checks_total: number;
  critical_count: number;
  warning_count: number;
  checks: Check[];
  pages: PageInfo[];
};

export function asChecks(value: unknown): Check[] {
  return Array.isArray(value) ? (value as Check[]) : [];
}

export function asPages(value: unknown): PageInfo[] {
  return Array.isArray(value) ? (value as PageInfo[]) : [];
}

/** « https://harmonie-yacht.fr/nuit-insolite » → « /nuit-insolite ». */
export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname || "/";
  } catch {
    return url.replace(/^https?:\/\/[^/]+/, "") || "/";
  }
}

/** Sous ce seuil, une page est vide aux yeux d'un moteur ou d'une IA. */
export const MIN_READABLE = 500;
