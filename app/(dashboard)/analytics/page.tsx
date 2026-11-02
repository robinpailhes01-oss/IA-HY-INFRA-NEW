import { Bot, Eye, Share2, Users, Globe } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";
import {
  aggregatePages,
  aggregateReferrers,
  filterByPeriod,
  isAiReferrer,
  type AnalyticsSnapshot,
} from "@/lib/analytics";
import { PageHeader } from "@/components/shell/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MotionCard } from "@/components/dashboard/motion-card";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { TrendPoint } from "@/components/charts/trend-chart";
import { PeriodSwitch } from "@/components/social/period-switch";
import { fetchAll } from "@/components/social/fetch-all";
import { SOCIAL_PERIODS, parsePeriod, pct } from "@/components/social/model";
import { addDays, daysBetween, shortDay, weekdayMon } from "@/components/social/time";
import { AudienceInsights, type GroupShare } from "@/components/analytics/audience-insights";
import { TrafficCard } from "@/components/analytics/traffic-card";
import { PagesCard, SourcesCard, type PageRowView, type SourceRow } from "@/components/analytics/sources-card";
import { GROUPS, describeSource, pageName, type SourceGroup } from "@/components/analytics/sources";

// ── Audience du site ───────────────────────────────────────────────────────
// Qui vient sur harmonie-yacht.fr, d'où, et est-ce que ça monte.
//
// Source : notre propre traqueur (fonction track-pageview), pas Vercel Web
// Analytics — jamais activé côté site, et limité à 30 jours d'historique sur
// le plan actuel. La vue site_daily_snapshots expose un instantané par jour :
// visiteurs, pages vues, et les classements du jour (référents, pages).
//
// Tout est calculé ici, côté serveur : le navigateur ne reçoit que les
// chiffres affichés, pas des centaines d'instantanés JSON. La période vit dans
// l'URL (?p=30|90|365|all), comme sur Réseaux sociaux.

/** Découpe une série chronologique en `n` tranches égales (sommes). */
function buckets(values: number[], n = 10): number[] {
  if (values.length === 0) return [];
  const k = Math.min(n, values.length);
  const out = Array.from({ length: k }, () => 0);
  values.forEach((v, i) => {
    out[Math.min(k - 1, Math.floor((i * k) / values.length))] += v;
  });
  return out;
}

function deltaOf(cur: number, prev: number | null): { value: string; positive: boolean } | undefined {
  if (prev === null || prev <= 0) return undefined;
  const d = pct(cur - prev, prev);
  return { value: `${cur >= prev ? "+" : "−"}${Math.abs(d)} %`, positive: cur >= prev };
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const period = parsePeriod((await searchParams).p);
  const periodLong = SOCIAL_PERIODS.find((p) => p.value === period)!.long;
  const supabase = await createClient();

  // Tout l'historique, paginé : « Tout » doit vraiment dire tout, et la
  // période précédente (pour les variations) doit être entièrement lue.
  const res = await fetchAll<AnalyticsSnapshot>((from, to) =>
    supabase
      .from("site_daily_snapshots")
      .select("snapshot_date, visitors, pageviews, top_referrers, top_pages")
      .order("snapshot_date", { ascending: false })
      .range(from, to)
      .returns<AnalyticsSnapshot[]>(),
  );
  const snapshots = res.rows;

  const header = (
    <PageHeader
      eyebrow="Croissance · audience du site"
      title={
        <>
          Audience du <em>site</em>
        </>
      }
      description="D'où viennent les visiteurs de harmonie-yacht.fr, et comment le trafic évolue. Mesure sans cookie ni adresse IP, conservée sans limite de durée."
      actions={snapshots.length > 0 ? <PeriodSwitch value={period} className="w-full sm:w-auto" /> : undefined}
    />
  );

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col gap-4 lg:gap-5">
        {header}
        <Card>
          <CardContent>
            <EmptyState icon={<Globe />} title="Pas encore de mesure d'audience" className="py-14">
              Le traqueur du site n&apos;a encore rien enregistré. Le premier instantané apparaîtra ici
              au lendemain des premières visites.
            </EmptyState>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Période et période précédente ──────────────────────────────────────
  // filterByPeriod (lib/analytics) fixe la règle de coupure ; la période
  // précédente est la tranche de même durée juste avant. On ne compare que si
  // elle est entièrement couverte par l'historique — sinon la variation
  // serait gonflée par des jours qui n'ont jamais été mesurés.
  const current = filterByPeriod(snapshots, period).sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  const days = period === "all" ? null : Number(period);
  // Même coupure que filterByPeriod : aujourd'hui (UTC) moins `days` jours.
  const cutoffDate = new Date();
  if (days) cutoffDate.setUTCDate(cutoffDate.getUTCDate() - days);
  const cutoff = days ? cutoffDate.toISOString().slice(0, 10) : null;
  const oldest = snapshots[snapshots.length - 1].snapshot_date;
  const prevStart = days && cutoff ? addDays(cutoff, -days) : null;
  const previous =
    prevStart && cutoff && oldest <= prevStart
      ? snapshots.filter((s) => s.snapshot_date >= prevStart && s.snapshot_date < cutoff)
      : null;

  const sum = (rows: AnalyticsSnapshot[], k: "visitors" | "pageviews") => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const visitors = sum(current, "visitors");
  const pageviews = sum(current, "pageviews");
  const prevVisitors = previous ? sum(previous, "visitors") : null;
  const prevPageviews = previous ? sum(previous, "pageviews") : null;

  // ── Sources ────────────────────────────────────────────────────────────
  const referrers = aggregateReferrers(current);
  const sourceRows: SourceRow[] = referrers.map((r) => {
    const info = describeSource(r.hostname);
    return {
      hostname: r.hostname,
      ...info,
      visitors: r.visitors,
      pageviews: r.pageviews,
      share: visitors > 0 ? (r.visitors / visitors) * 100 : 0,
    };
  });
  const aiVisitors = referrers.filter((r) => isAiReferrer(r.hostname)).reduce((s, r) => s + r.visitors, 0);

  const groupVisitors = (rows: AnalyticsSnapshot[]) => {
    const g: Record<SourceGroup, number> = { social: 0, search: 0, ai: 0, direct: 0, other: 0 };
    for (const r of aggregateReferrers(rows)) g[describeSource(r.hostname).group] += r.visitors;
    return g;
  };
  const byGroup = groupVisitors(current);
  const groupTotal = Object.values(byGroup).reduce((s, n) => s + n, 0);
  // Les parts se calculent sur TOUS les visiteurs, comme la carte « Venus des
  // réseaux » et la table des sources : avant, elles l'étaient sur la somme
  // des référents classés, et les 1 429 visiteurs des réseaux valaient 49 %
  // dans le panneau et 46 % deux cartes plus bas. Ce que les classements
  // quotidiens (limités aux premiers référents du jour) ne couvrent pas est
  // montré à part, « hors classement », plutôt que réparti en silence.
  const groups: GroupShare[] = GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    visitors: byGroup[g.key],
    share: pct(byGroup[g.key], visitors),
  }));
  const unranked = Math.max(0, visitors - groupTotal);
  const prevGroups = previous ? groupVisitors(previous) : null;
  const prevAi = previous
    ? aggregateReferrers(previous).filter((r) => isAiReferrer(r.hostname)).reduce((s, r) => s + r.visitors, 0)
    : null;

  // La première porte d'entrée : la plus grosse source nommée (le direct
  // n'en est pas une — c'est l'absence d'information).
  const top = sourceRows.find((r) => r.group !== "direct");

  // ── Pages ──────────────────────────────────────────────────────────────
  const pages: PageRowView[] = aggregatePages(current).map((p) => ({
    path: p.path,
    name: pageName(p.path),
    visitors: p.visitors,
    pageviews: p.pageviews,
    share: visitors > 0 ? (p.visitors / visitors) * 100 : 0,
  }));

  // ── Courbes ────────────────────────────────────────────────────────────
  // 30 et 90 jours : un point par jour. Un an : par semaine. Au-delà de
  // dix-huit mois d'historique : par mois — 600 points quotidiens vibrent.
  const span = current.length ? daysBetween(current[0].snapshot_date, current[current.length - 1].snapshot_date) + 1 : 0;
  const grain: "day" | "week" | "month" = period === "30" || period === "90" ? "day" : span > 540 ? "month" : "week";
  const points = new Map<string, { a: number; b: number }>();
  for (const s of current) {
    const d = s.snapshot_date;
    const key = grain === "day" ? d : grain === "week" ? addDays(d, -weekdayMon(d)) : `${d.slice(0, 7)}-01`;
    const p = points.get(key) ?? { a: 0, b: 0 };
    p.a += Number(s.visitors ?? 0);
    p.b += Number(s.pageviews ?? 0);
    points.set(key, p);
  }
  const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const series: TrendPoint[] = [...points.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, p]) => ({
      label: grain === "month" ? `${MOIS[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}` : shortDay(k),
      a: p.a,
      b: p.b,
    }));

  const visitorsTrend = buckets(current.map((s) => Number(s.visitors ?? 0)));
  const pageviewsTrend = buckets(current.map((s) => Number(s.pageviews ?? 0)));
  const socialTrend = buckets(current.map((s) => groupVisitors([s]).social));
  const aiTrend = buckets(
    current.map((s) => (s.top_referrers ?? []).filter((r) => isAiReferrer(r.hostname)).reduce((t, r) => t + r.visitors, 0)),
  );

  const best = current.reduce<AnalyticsSnapshot | null>((m, s) => (!m || s.visitors > m.visitors ? s : m), null);
  const pagesPerVisit = visitors > 0 ? pageviews / visitors : null;
  const deltaPct = prevVisitors && prevVisitors > 0 ? pct(visitors - prevVisitors, prevVisitors) : null;

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {header}

      {/* ── Ce que Léa retient ───────────────────────────────────────────── */}
      <MotionCard index={0} lift={false}>
        <AudienceInsights
          periodPhrase={period === "all" ? "depuis le début de la mesure" : `sur les ${periodLong}`}
          windowLabel={`Mesure sans cookie · ${periodLong}`}
          visitors={visitors}
          deltaPct={deltaPct}
          topSource={top ? { name: top.name, share: Math.round(top.share) } : null}
          groups={groups}
          unranked={{ visitors: unranked, share: pct(unranked, visitors) }}
          aiVisitors={aiVisitors}
          topPage={pages[0] ? { name: pages[0].name, share: Math.round(pages[0].share) } : null}
          best={best && best.visitors > 0 ? { day: shortDay(best.snapshot_date), visitors: best.visitors } : null}
        />
      </MotionCard>

      {/* ── Chiffres clés ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        <KpiCard
          label="Visiteurs"
          value={visitors}
          icon={<Users />}
          accent="ocean"
          trend={visitorsTrend}
          delta={deltaOf(visitors, prevVisitors)}
          hint={periodLong}
          primary
          index={1}
        />
        <KpiCard
          label="Pages vues"
          value={pageviews}
          icon={<Eye />}
          accent="sky"
          trend={pageviewsTrend}
          delta={deltaOf(pageviews, prevPageviews)}
          hint={pagesPerVisit !== null ? `${pagesPerVisit.toFixed(1).replace(".", ",")} par visite` : undefined}
          index={2}
        />
        <KpiCard
          label="Venus des réseaux"
          value={byGroup.social}
          icon={<Share2 />}
          accent="aqua"
          trend={socialTrend}
          delta={deltaOf(byGroup.social, prevGroups ? prevGroups.social : null)}
          hint={visitors > 0 ? `${pct(byGroup.social, visitors)} % des visiteurs` : undefined}
          href="/social"
          index={3}
        />
        <KpiCard
          label="Visites via IA"
          value={aiVisitors}
          icon={<Bot />}
          accent="indigo"
          trend={aiTrend}
          delta={deltaOf(aiVisitors, prevAi)}
          hint={aiVisitors > 0 ? "ChatGPT, Perplexity…" : "aucune sur la période"}
          index={4}
        />
      </div>

      {/* ── La courbe · les pages ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <MotionCard index={5} lift={false} className="lg:col-span-8">
          <TrafficCard
            series={series}
            grain={grain === "day" ? "par jour" : grain === "week" ? "par semaine" : "par mois"}
            perDay={current.length > 0 ? visitors / current.length : 0}
            pagesPerVisit={pagesPerVisit}
          />
        </MotionCard>
        <MotionCard index={6} lift={false} className="lg:col-span-4">
          <PagesCard rows={pages} period={periodLong} />
        </MotionCard>
      </div>

      {/* ── Les sources ────────────────────────────────────────────────── */}
      <MotionCard index={7} lift={false}>
        <SourcesCard rows={sourceRows} period={periodLong} />
      </MotionCard>

      <p className="mx-auto max-w-xl px-4 text-center text-[12px] leading-relaxed text-ink-3">
        Visiteurs comptés par jour : quelqu&apos;un qui revient trois jours compte trois fois. Sources
        et pages : les classements quotidiens du traqueur, additionnés sur{" "}
        {period === "all" ? `tout l'historique (${formatNumber(current.length)} jours mesurés)` : `les ${periodLong}`}
        {/* Le nombre de jours mesurés n'apprend quelque chose que s'il en
            manque : « 30 derniers jours (31 jours mesurés) » sonnait faux
            (la coupure de filterByPeriod inclut le jour de bord). */}
        {days && current.length < days ? ` — seulement ${formatNumber(current.length)} jours mesurés` : ""}.
      </p>
    </div>
  );
}
