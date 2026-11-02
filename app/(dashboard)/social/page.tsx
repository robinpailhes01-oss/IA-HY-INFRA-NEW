import Link from "next/link";
import { ArrowUpRight, Banknote, Eye, Heart, Megaphone, UserPlus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { sourceChannelLabel } from "@/lib/status";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/shell/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MotionCard } from "@/components/dashboard/motion-card";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Num } from "@/components/ui/num";
import type { TrendPoint } from "@/components/charts/trend-chart";
import { fetchAll } from "@/components/social/fetch-all";
import { PeriodSwitch } from "@/components/social/period-switch";
import { AgentInsights, type NextPost } from "@/components/social/agent-insights";
import { EditorialCalendar, type CalendarItem } from "@/components/social/editorial-calendar";
import { PlatformCard, type PlatformStat } from "@/components/social/platform-card";
import { TopContent, type TopItem } from "@/components/social/top-content";
import { SiteTraffic, type TrafficSource } from "@/components/social/site-traffic";
import { Acquisition, AdSpendList, type AdExpense, type AttributionRow } from "@/components/social/acquisition";
import { LeadOrigin, type LeadOriginRow } from "@/components/social/lead-origin";
import { computeInsights } from "@/components/social/insights";
import {
  CONFIRMED,
  EXCLUDED_CHANNELS,
  FORMAT_LABEL,
  PLATFORM_LABEL,
  PLATFORM_OF,
  PLATFORMS,
  SOCIAL_CHANNELS,
  SOCIAL_PERIODS,
  canalCategory,
  parsePeriod,
  pct,
  plural,
  type CanalCategory,
} from "@/components/social/model";
import {
  addDays,
  bucketer,
  dayKey,
  daysBetween,
  hourLabel,
  periodBounds,
  relativeDay,
  shortDay,
} from "@/components/social/time";

// ── Réseaux sociaux ────────────────────────────────────────────────────────
// Le cockpit des réseaux et de l'acquisition : ce que les contenus font voir,
// ce qu'ils font venir, et ce que ça rapporte. Tout est calculé ici, côté
// serveur, depuis les tables réelles — aucun chiffre écrit en dur.
//
// Sources :
// · content_marketing : le CARNET DE CONTENUS, tenu à la main. Il n'existe
//   aucune connexion directe à Instagram ou TikTok : vues, likes et leads
//   attribués sont ceux qui y sont notés. La page le dit sans détour.
// · leads.source_channel : l'origine des prospects que Léa enregistre ;
// · bookings.source_channel + revenues : l'argent, par canal. Le CA vient
//   UNIQUEMENT de la table revenues (règle de tout le tableau de bord : pas
//   de double comptage, et seul l'encaissé compte). L'ancienne page Marketing
//   lisait bookings.total_amount ; les règles d'attribution, elles, sont
//   reprises telles quelles (réservations confirmées ou terminées, site
//   internet exclu, ensembles Payant / Organique inchangés).
// · expenses (category = 'marketing') : le budget pub réel ;
// · site_traffic_daily / site_traffic_by_source : notre mesure d'audience.
//
// Toute la page suit la période choisie (?p=30|90|365|all), sauf le
// calendrier (l'avenir) et le panneau de Léa (toujours 90 jours : ce qui
// marche en ce moment).

type ContentRow = {
  id: string;
  channel: string;
  title: string | null;
  status: string | null;
  publish_date: string | null;
  publish_time: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  leads_attributed: number | null;
  url: string | null;
};
type BookingRow = { id: string; source_channel: string | null; status: string | null };
type RevenueRow = { amount: number | null; booking_id: string | null; date: string | null };
type ExpenseRow = { id: string; date: string; description: string | null; amount: number | null };
type LeadRow = { id: string; source_channel: string | null; created_at: string | null };
type TrafficDay = { day: string | null; visitors: number | null; pageviews: number | null };
type TrafficSourceRow = { day: string | null; source_label: string | null; source_group: string | null; visitors: number | null };

const interactions = (c: ContentRow) => (c.likes ?? 0) + (c.comments ?? 0) + (c.shares ?? 0);

function delta(cur: number, prev: number): { value: string; positive: boolean } | undefined {
  if (prev <= 0) return undefined;
  const d = pct(cur - prev, prev);
  return { value: `${cur >= prev ? "+" : "−"}${Math.abs(d)} %`, positive: cur >= prev };
}

export default async function SocialPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const period = parsePeriod((await searchParams).p);
  const periodLong = SOCIAL_PERIODS.find((p) => p.value === period)!.long;
  const supabase = await createClient();
  const now = Date.now();
  const today = dayKey(now);
  const { start, prevStart } = periodBounds(period, today);

  // Bornes de lecture : la période + la précédente (pour les variations).
  const readFrom = prevStart ?? undefined;

  const [content, bookings, revenues, expensesRes, leads, trafficDays, trafficSources] = await Promise.all([
    fetchAll<ContentRow>((from, to) =>
      supabase
        .from("content_marketing")
        .select("id, channel, title, status, publish_date, publish_time, views, likes, comments, shares, leads_attributed, url")
        .order("publish_date", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, to)
        .returns<ContentRow[]>(),
    ),
    // Toutes les réservations confirmées : l'attribution se fait ensuite par
    // l'argent encaissé sur la période (revenues.date), pas par la date de
    // création — les réservations importées de Google Agenda portent la date
    // d'import, pas celle de la vente.
    fetchAll<BookingRow>((from, to) =>
      supabase
        .from("bookings")
        .select("id, source_channel, status")
        .in("status", [...CONFIRMED])
        .order("id", { ascending: true })
        .range(from, to)
        .returns<BookingRow[]>(),
    ),
    fetchAll<RevenueRow>((from, to) => {
      let q = supabase.from("revenues").select("amount, booking_id, date").not("booking_id", "is", null);
      if (readFrom) q = q.gte("date", readFrom);
      return q.order("id", { ascending: true }).range(from, to).returns<RevenueRow[]>();
    }),
    // Budget pub réel : les dépenses catégorisées « marketing » (pas de
    // saisie dédiée — l'ancienne table ad_stats n'était jamais remplie).
    supabase
      .from("expenses")
      .select("id, date, description, amount")
      .eq("category", "marketing")
      .order("date", { ascending: false })
      .returns<ExpenseRow[]>(),
    fetchAll<LeadRow>((from, to) => {
      let q = supabase.from("leads").select("id, source_channel, created_at");
      if (readFrom) q = q.gte("created_at", `${readFrom}T00:00:00`);
      return q.order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to).returns<LeadRow[]>();
    }),
    fetchAll<TrafficDay>((from, to) => {
      let q = supabase.from("site_traffic_daily").select("day, visitors, pageviews");
      if (start) q = q.gte("day", start);
      return q.order("day", { ascending: true }).range(from, to).returns<TrafficDay[]>();
    }),
    fetchAll<TrafficSourceRow>((from, to) => {
      let q = supabase.from("site_traffic_by_source").select("day, source_label, source_group, visitors");
      if (start) q = q.gte("day", start);
      return q
        .order("day", { ascending: true })
        .order("source_label", { ascending: true })
        .order("source_group", { ascending: true })
        .range(from, to)
        .returns<TrafficSourceRow[]>();
    }),
  ]);

  const inPeriod = (k: string | null | undefined) => Boolean(k) && (!start || k!.slice(0, 10) >= start) && k!.slice(0, 10) <= today;
  const inPrev = (k: string | null | undefined) =>
    Boolean(k && start && prevStart) && k!.slice(0, 10) >= prevStart! && k!.slice(0, 10) < start!;

  // ── Le carnet : publications de la période ─────────────────────────────
  const published = content.rows.filter((c) => c.status === "published" && c.publish_date && PLATFORM_OF[c.channel]);
  const posts = published.filter((c) => inPeriod(c.publish_date));
  const prevPosts = published.filter((c) => inPrev(c.publish_date));

  // Le début réel de la période (« Tout » = la plus ancienne donnée) sert
  // aux tranches des petites courbes.
  const firstKey = start ?? published.map((c) => c.publish_date!).filter((d) => d <= today).sort()[0] ?? addDays(today, -29);
  const bucket = bucketer(firstKey, today);
  const six = () => Array.from({ length: 6 }, () => 0);

  const views = posts.reduce((s, c) => s + (c.views ?? 0), 0);
  const prevViews = prevPosts.reduce((s, c) => s + (c.views ?? 0), 0);
  const viewsTrend = six();
  const engViews = six();
  const engInter = six();
  for (const c of posts) {
    const b = bucket(c.publish_date);
    if (b < 0) continue;
    viewsTrend[b] += c.views ?? 0;
    engViews[b] += c.views ?? 0;
    engInter[b] += interactions(c);
  }
  const engagedPosts = posts.filter((c) => (c.views ?? 0) > 0);
  const engViewsTotal = engagedPosts.reduce((s, c) => s + (c.views ?? 0), 0);
  const engInterTotal = engagedPosts.reduce((s, c) => s + interactions(c), 0);
  const rate = engViewsTotal > 0 ? (engInterTotal / engViewsTotal) * 100 : null;
  const rateTenths = rate === null ? 0 : Math.round(rate * 10);
  const engTrend = engViews.map((v, i) => (v > 0 ? (engInter[i] / v) * 100 : 0));

  // ── Leads venus des réseaux (pipeline de Léa) ──────────────────────────
  const leadDay = (l: LeadRow) => (l.created_at ? dayKey(l.created_at) : null);
  const periodLeads = leads.rows.filter((l) => inPeriod(leadDay(l)));
  const socialLeads = periodLeads.filter((l) => SOCIAL_CHANNELS.has(l.source_channel ?? ""));
  const prevSocialLeads = leads.rows.filter((l) => inPrev(leadDay(l)) && SOCIAL_CHANNELS.has(l.source_channel ?? "")).length;
  const leadsTrend = six();
  for (const l of socialLeads) {
    const b = bucket(leadDay(l));
    if (b >= 0) leadsTrend[b] += 1;
  }

  // L'origine de tous les leads de la période, site internet exclu (ce n'est
  // pas une source : tout le monde finit par y passer).
  const originCount = new Map<string | null, number>();
  for (const l of periodLeads) {
    const ch = l.source_channel || null;
    if (ch && EXCLUDED_CHANNELS.has(ch)) continue;
    originCount.set(ch, (originCount.get(ch) ?? 0) + 1);
  }
  const originTotal = [...originCount.values()].reduce((s, n) => s + n, 0);
  const leadOrigin: LeadOriginRow[] = [...originCount.entries()]
    .map(([channel, count]) => ({
      channel,
      label: channel ? sourceChannelLabel(channel) : "Non renseigné",
      count,
      share: pct(count, originTotal),
      social: SOCIAL_CHANNELS.has(channel ?? ""),
    }))
    // « Non renseigné » ferme la marche, quel que soit son volume.
    .sort((a, b) => Number(a.channel === null) - Number(b.channel === null) || b.count - a.count);

  // ── L'argent, par canal ────────────────────────────────────────────────
  // Une réservation compte si elle est confirmée/terminée et que son canal
  // n'est pas le site internet. Son CA = ce qu'elle a réellement encaissé
  // pendant la période.
  const bookingById = new Map(
    bookings.rows.filter((b) => !EXCLUDED_CHANNELS.has(b.source_channel ?? "")).map((b) => [b.id, b]),
  );
  const byChannel = new Map<string, { bookings: Set<string>; revenue: number }>();
  const untaggedIds = new Set<string>();
  let socialRevenue = 0;
  let prevSocialRevenue = 0;
  const socialBookingIds = new Set<string>();
  const revenueTrend = six();
  for (const r of revenues.rows) {
    const b = r.booking_id ? bookingById.get(r.booking_id) : undefined;
    if (!b) continue;
    const amount = Number(r.amount ?? 0);
    const social = SOCIAL_CHANNELS.has(b.source_channel ?? "");
    if (inPrev(r.date) && social) prevSocialRevenue += amount;
    if (!inPeriod(r.date)) continue;
    if (!b.source_channel) {
      untaggedIds.add(b.id);
      continue;
    }
    const agg = byChannel.get(b.source_channel) ?? { bookings: new Set<string>(), revenue: 0 };
    agg.bookings.add(b.id);
    agg.revenue += amount;
    byChannel.set(b.source_channel, agg);
    if (social) {
      socialRevenue += amount;
      socialBookingIds.add(b.id);
      const k = bucket(r.date);
      if (k >= 0) revenueTrend[k] += amount;
    }
  }
  const attribution: AttributionRow[] = [...byChannel.entries()]
    .map(([channel, a]) => ({ channel, category: canalCategory(channel), count: a.bookings.size, revenue: a.revenue }))
    .sort((a, b) => b.revenue - a.revenue);
  const byCategory: Record<CanalCategory, { count: number; revenue: number }> = {
    paid: { count: 0, revenue: 0 },
    organic: { count: 0, revenue: 0 },
    other: { count: 0, revenue: 0 },
  };
  for (const r of attribution) {
    byCategory[r.category].count += r.count;
    byCategory[r.category].revenue += r.revenue;
  }

  const adExpenses: AdExpense[] = (expensesRes.data ?? [])
    .filter((e) => inPeriod(e.date))
    .map((e) => ({
      id: e.id,
      date: relativeDay(e.date, today).replace(/^./, (c) => c.toUpperCase()),
      label: e.description?.trim() || "Dépense marketing",
      amount: Number(e.amount ?? 0),
    }));
  const adSpend = adExpenses.reduce((s, e) => s + e.amount, 0);
  // Les dernières dépenses pub connues, toutes périodes confondues : hors
  // saison, « rien sur 30 jours » est normal — encore faut-il savoir depuis
  // quand, et pour combien. Plus le budget des douze derniers mois.
  const pastAds = (expensesRes.data ?? []).filter((e) => e.date <= today);
  const recentAds: AdExpense[] = pastAds.slice(0, 4).map((e) => ({
    id: e.id,
    date: shortDay(e.date),
    label: e.description?.trim() || "Dépense marketing",
    amount: Number(e.amount ?? 0),
  }));
  const yearFrom = addDays(today, -364);
  const yearAds = pastAds.filter((e) => e.date >= yearFrom);
  const yearSpend = { total: yearAds.reduce((s, e) => s + Number(e.amount ?? 0), 0), count: yearAds.length };

  // ── Par plateforme ─────────────────────────────────────────────────────
  const totalViews = Math.max(0, views);
  const platformStats: PlatformStat[] = PLATFORMS.map((platform) => {
    const ps = posts.filter((c) => PLATFORM_OF[c.channel] === platform);
    const v = ps.reduce((s, c) => s + (c.views ?? 0), 0);
    const withViews = ps.filter((c) => (c.views ?? 0) > 0);
    const vv = withViews.reduce((s, c) => s + (c.views ?? 0), 0);
    const formats = new Map<string, number>();
    for (const c of ps) formats.set(c.channel, (formats.get(c.channel) ?? 0) + 1);
    const FORMAT_PLURAL: Record<string, [string, string]> = {
      instagram_reel: ["Reel", "Reels"],
      instagram_post: ["post", "posts"],
      instagram_story: ["story", "stories"],
      tiktok: ["vidéo", "vidéos"],
      facebook: ["post", "posts"],
      whatsapp_status: ["statut", "statuts"],
    };
    const formatText = [...formats.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([ch, n]) => `${n} ${plural(n, ...(FORMAT_PLURAL[ch] ?? ["contenu", "contenus"]))}`)
      .join(" · ");
    return {
      platform,
      label: PLATFORM_LABEL[platform],
      posts: ps.length,
      views: v,
      rate: vv > 0 ? (withViews.reduce((s, c) => s + interactions(c), 0) / vv) * 100 : null,
      leads: ps.reduce((s, c) => s + (c.leads_attributed ?? 0), 0),
      share: totalViews > 0 ? Math.round((v / totalViews) * 100) : 0,
      formats: formatText,
    };
  });

  // ── Meilleurs contenus ─────────────────────────────────────────────────
  const top: TopItem[] = [...posts]
    .sort((a, b) => (b.leads_attributed ?? 0) - (a.leads_attributed ?? 0) || (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 6)
    .map((c) => ({
      id: c.id,
      title: c.title?.trim() || "Sans titre",
      platform: PLATFORM_OF[c.channel] ?? null,
      format: FORMAT_LABEL[c.channel] ?? c.channel,
      date: shortDay(c.publish_date!),
      views: c.views ?? 0,
      rate: (c.views ?? 0) > 0 ? (interactions(c) / (c.views ?? 1)) * 100 : null,
      leads: c.leads_attributed ?? 0,
      url: c.url && /^https?:\/\//.test(c.url) ? c.url : null,
    }));

  // ── Calendrier éditorial ───────────────────────────────────────────────
  const planned = content.rows.filter((c) => c.status === "scheduled" || c.status === "in_progress" || c.status === "idea");
  const calendar: CalendarItem[] = planned
    // Les idées datées du passé ne sont plus un plan, ce sont des idées.
    .map((c) => ({
      id: c.id,
      date: c.status === "idea" && c.publish_date && c.publish_date < today ? null : c.publish_date,
      time: c.publish_time,
      title: c.title?.trim() || "Sans titre",
      platform: PLATFORM_OF[c.channel] ?? null,
      format: FORMAT_LABEL[c.channel] ?? c.channel,
      status: c.status!,
    }));
  const next = planned
    .filter((c) => c.status !== "idea" && c.publish_date && c.publish_date >= today)
    .sort((a, b) => (a.publish_date! + (a.publish_time ?? "")).localeCompare(b.publish_date! + (b.publish_time ?? "")))[0];
  const nextPost: NextPost = next
    ? {
        when: `${relativeDay(next.publish_date!, today)}${hourLabel(next.publish_time) ? ` à ${hourLabel(next.publish_time)}` : ""}`,
        format: FORMAT_LABEL[next.channel] ?? next.channel,
        title: next.title ?? "",
        withinWeek: daysBetween(today, next.publish_date!) < 7,
      }
    : null;

  const insights = computeInsights(content.rows, today);

  // ── Audience du site ───────────────────────────────────────────────────
  // 30 et 90 jours : un point par jour. Au-delà, un point par semaine —
  // 365 points quotidiens ne se lisent plus, ils vibrent.
  const weekly = period === "365" || period === "all";
  const socialByDay = new Map<string, number>();
  const bySource = new Map<string, { group: string; visitors: number }>();
  for (const r of trafficSources.rows) {
    if (!r.day || !inPeriod(r.day)) continue;
    const v = Number(r.visitors ?? 0);
    if (r.source_group === "social") socialByDay.set(r.day, (socialByDay.get(r.day) ?? 0) + v);
    const label = r.source_label || "Inconnu";
    const s = bySource.get(label) ?? { group: r.source_group ?? "direct", visitors: 0 };
    s.visitors += v;
    bySource.set(label, s);
  }
  const days = trafficDays.rows.filter((d) => d.day && inPeriod(d.day));
  const siteVisitors = days.reduce((s, d) => s + Number(d.visitors ?? 0), 0);
  const sourceTotal = [...bySource.values()].reduce((s, x) => s + x.visitors, 0);
  const socialVisitors = [...bySource.values()].filter((s) => s.group === "social").reduce((s, x) => s + x.visitors, 0);
  const sources: TrafficSource[] = [...bySource.entries()]
    .map(([label, s]) => ({ label, group: s.group, visitors: s.visitors, share: pct(s.visitors, sourceTotal) }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 6);
  const points = new Map<string, { a: number; b: number }>();
  for (const d of days) {
    const key = weekly ? addDays(d.day!, -((new Date(`${d.day}T12:00:00Z`).getUTCDay() + 6) % 7)) : d.day!;
    const p = points.get(key) ?? { a: 0, b: 0 };
    p.a += Number(d.visitors ?? 0);
    p.b += socialByDay.get(d.day!) ?? 0;
    points.set(key, p);
  }
  const series: TrendPoint[] = [...points.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, p]) => ({ label: shortDay(k), a: p.a, b: p.b }));

  const shareOfLeads = pct(socialLeads.length, periodLeads.length);

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <PageHeader
        eyebrow="Croissance · réseaux sociaux"
        title={
          <>
            Réseaux <em>sociaux</em>
          </>
        }
        description="Ce que tes contenus font voir, ce qu'ils font venir — et ce que ça rapporte vraiment."
        actions={<PeriodSwitch value={period} className="w-full sm:w-auto" />}
      />

      {/* ── Léa retient · ce qui sort ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <MotionCard index={0} lift={false} className="lg:col-span-7">
          <AgentInsights insights={insights} nextPost={nextPost} />
        </MotionCard>
        <MotionCard index={1} lift={false} className="lg:col-span-5">
          <EditorialCalendar items={calendar} today={today} />
        </MotionCard>
      </div>

      {/* ── Chiffres clés ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        <KpiCard
          label="Vues des contenus"
          value={views}
          icon={<Eye />}
          accent="ocean"
          trend={viewsTrend}
          delta={delta(views, prevViews)}
          hint={`${posts.length} ${plural(posts.length, "publication", "publications")}`}
          primary
          index={2}
        />
        <KpiCard
          label="Engagement"
          // Une décimale compte ici (6,2 % n'est pas 6 %) : l'entier s'anime,
          // la décimale suit en retrait, dans la taille du suffixe.
          value={Math.floor(rateTenths / 10)}
          suffix={rate === null ? undefined : `,${rateTenths % 10}\u00a0%`}
          icon={<Heart />}
          accent="sky"
          trend={engTrend}
          hint={rate === null ? "aucune vue notée" : `${formatNumber(engInterTotal)} interactions`}
          index={3}
        />
        <KpiCard
          label="Leads des réseaux"
          value={socialLeads.length}
          icon={<UserPlus />}
          accent="indigo"
          trend={leadsTrend}
          delta={delta(socialLeads.length, prevSocialLeads)}
          hint={periodLeads.length > 0 ? `${shareOfLeads} % de tous tes leads` : "aucun lead sur la période"}
          href="/leads"
          index={4}
        />
        <KpiCard
          label="CA attribué aux réseaux"
          value={Math.round(socialRevenue)}
          format="eur"
          icon={<Banknote />}
          accent="aqua"
          trend={revenueTrend}
          delta={delta(socialRevenue, prevSocialRevenue)}
          hint={`${socialBookingIds.size} ${plural(socialBookingIds.size, "réservation", "réservations")} · encaissé`}
          index={5}
        />
      </div>

      {/* ── Par plateforme ─────────────────────────────────────────────── */}
      <section aria-labelledby="platforms-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
          <h2 id="platforms-title" className="t-card text-foreground">
            Par plateforme
          </h2>
          <p className="text-[12px] text-ink-3">Statistiques du carnet de contenus · {periodLong}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
          {platformStats.map((s, i) => (
            <PlatformCard key={s.platform} stat={s} index={6 + i} />
          ))}
        </div>
      </section>

      {/* ── Ce qui fait venir : les contenus, puis l'origine des leads ──── */}
      {/* L'ordre de la page suit l'entonnoir : vu (plateformes) → venu
          (contenus, leads) → passé sur le site → a payé (acquisition). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <MotionCard index={10} lift={false} className="lg:col-span-7">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Meilleurs contenus</CardTitle>
              <CardDescription>Classés par leads, puis par vues · {periodLong}</CardDescription>
            </CardHeader>
            <CardContent>
              <TopContent items={top} />
            </CardContent>
          </Card>
        </MotionCard>
        <MotionCard index={11} lift={false} className="lg:col-span-5">
          <LeadOrigin rows={leadOrigin} total={originTotal} period={periodLong} />
        </MotionCard>
      </div>

      {/* ── Du réseau au site ──────────────────────────────────────────── */}
      <MotionCard index={12} lift={false}>
        <SiteTraffic
          ok={trafficDays.ok && trafficSources.ok}
          series={series}
          visitors={siteVisitors}
          socialVisitors={socialVisitors}
          sources={sources}
          period={periodLong}
        />
      </MotionCard>

      {/* ── Acquisition & rentabilité · budget pub ─────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <MotionCard index={13} lift={false} className="lg:col-span-8">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Acquisition &amp; rentabilité</CardTitle>
              <CardDescription>
                Encaissé sur la période, par canal d&apos;origine du client · site internet exclu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Acquisition
                rows={attribution}
                byCategory={byCategory}
                adSpend={adSpend}
                untagged={untaggedIds.size}
              />
            </CardContent>
          </Card>
        </MotionCard>
        <MotionCard index={14} lift={false} className="lg:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Dépenses publicitaires</CardTitle>
              <CardDescription>Catégorie « Marketing » · {periodLong}</CardDescription>
              <CardAction>
                <Link
                  href="/finances"
                  aria-label="Gérer les dépenses dans Finance"
                  className="grid size-11 place-items-center rounded-full bg-white/80 text-ink-2 shadow-[var(--shadow-glass)] transition-colors hover:text-ocean lg:size-9"
                >
                  <ArrowUpRight className="size-4" />
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <AdSpendList items={adExpenses} total={adSpend} recent={recentAds} year={yearSpend} />
            </CardContent>
          </Card>
        </MotionCard>
      </div>

      <p className="mx-auto max-w-xl px-4 text-center text-[12px] leading-relaxed text-ink-3">
        <Megaphone className="mr-1.5 inline size-3.5 -translate-y-px align-middle" />
        Vues et interactions : <Num>{formatNumber(content.rows.length)}</Num> entrées du carnet de contenus, tenu à la
        main — aucune connexion directe aux plateformes.
      </p>
    </div>
  );
}
