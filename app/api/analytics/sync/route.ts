import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

// Synchro quotidienne : récupère la veille (jour complet, jamais la journée
// en cours) depuis l'API Web Analytics de Vercel et l'archive dans Supabase.
// Le plan Hobby ne garde que 30 jours glissants — cette route construit un
// historique permanent en empilant un instantané par jour.
//
// Déclenchée par un Cron Job Vercel (voir vercel.json), sécurisée par
// CRON_SECRET (mécanisme natif Vercel : la valeur de cette variable d'env
// est envoyée automatiquement en header Authorization par l'infra cron —
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
//
// Équivalent n8n si tu préfères centraliser ça là-bas plus tard : un nœud
// "Schedule Trigger" (1x/jour) → deux nœuds "HTTP Request" vers les mêmes
// endpoints Vercel ci-dessous (mêmes headers/paramètres) → un nœud Supabase
// "Upsert" sur analytics_daily_snapshots avec la même clé de conflit
// (vercel_project_id, snapshot_date). Le webhook CRON_SECRET est alors
// inutile : le déclenchement resterait interne à n8n.

const VERCEL_API_BASE = "https://api.vercel.com/v1/query/web-analytics";
const TOP_REFERRERS_LIMIT = 15;
const TOP_PAGES_LIMIT = 15;

type AggregateRow = Record<string, unknown> & { pageviews?: number; visitors?: number };

async function queryVercel(
  path: "visits/aggregate",
  token: string,
  params: Record<string, string>,
): Promise<{ data: AggregateRow[] } | { error: string }> {
  const url = new URL(`${VERCEL_API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { error: `Vercel ${res.status}: ${detail.slice(0, 300)}` };
  }
  const json = (await res.json()) as { data: AggregateRow[] };
  return { data: Array.isArray(json.data) ? json.data : [] };
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiToken = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!apiToken || !projectId) {
    return NextResponse.json(
      { error: "VERCEL_API_TOKEN ou VERCEL_PROJECT_ID absent des variables d'environnement" },
      { status: 500 },
    );
  }
  const teamId = process.env.VERCEL_TEAM_ID || undefined;

  // Jour précédent complet en UTC — jamais la journée en cours, forcément
  // partielle tant qu'elle n'est pas terminée.
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const since = yesterday.toISOString().slice(0, 10);
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);

  const baseParams: Record<string, string> = { projectId, since, until };
  if (teamId) baseParams.teamId = teamId;

  const [dayRes, referrersRes, pagesRes] = await Promise.all([
    queryVercel("visits/aggregate", apiToken, { ...baseParams, by: "day" }),
    queryVercel("visits/aggregate", apiToken, {
      ...baseParams,
      by: "referrerHostname",
      limit: String(TOP_REFERRERS_LIMIT),
    }),
    queryVercel("visits/aggregate", apiToken, {
      ...baseParams,
      by: "route",
      limit: String(TOP_PAGES_LIMIT),
    }),
  ]);

  if ("error" in dayRes) return NextResponse.json({ error: dayRes.error }, { status: 502 });
  if ("error" in referrersRes) return NextResponse.json({ error: referrersRes.error }, { status: 502 });
  if ("error" in pagesRes) return NextResponse.json({ error: pagesRes.error }, { status: 502 });

  const dayRow = dayRes.data[0];
  const visitors = dayRow?.visitors ?? 0;
  const pageviews = dayRow?.pageviews ?? 0;

  const topReferrers = referrersRes.data.map((r) => ({
    hostname: (r.referrerHostname as string | null) ?? "(direct)",
    visitors: r.visitors ?? 0,
    pageviews: r.pageviews ?? 0,
  }));
  const topPages = pagesRes.data.map((r) => ({
    path: (r.route as string | null) ?? "(inconnu)",
    visitors: r.visitors ?? 0,
    pageviews: r.pageviews ?? 0,
  }));

  const supabase = createAdminClient();
  const { error: upsertErr } = await supabase.from("analytics_daily_snapshots").upsert(
    {
      vercel_project_id: projectId,
      snapshot_date: since,
      visitors,
      pageviews,
      top_referrers: topReferrers,
      top_pages: topPages,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "vercel_project_id,snapshot_date" },
  );

  if (upsertErr) {
    console.error("[analytics/sync] upsert failed:", upsertErr.message);
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  console.log(
    `[analytics/sync] ${since} → ${visitors} visiteurs, ${pageviews} pages vues, ` +
      `${topReferrers.length} référents, ${topPages.length} pages.`,
  );

  return NextResponse.json({
    ok: true,
    date: since,
    visitors,
    pageviews,
    referrers: topReferrers.length,
    pages: topPages.length,
  });
}
