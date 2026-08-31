import Link from "next/link";
import { Banknote, Bot, CalendarDays, Flame, Ship, TrendingUp, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { AddExpenseDialog } from "@/components/finances/add-expense-dialog";
import { AddRevenueDialog } from "@/components/finances/add-revenue-dialog";
import { AddBookingDialog } from "@/components/bookings/add-booking-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RevenueHero } from "@/components/dashboard/revenue-hero";
import { MonthlyBars } from "@/components/dashboard/monthly-bars";
import { Reveal } from "@/components/dashboard/reveal";
import { RevenueGauge } from "@/components/dashboard/revenue-gauge";
import {
  WeatherWidget,
  type WeatherDay,
} from "@/components/dashboard/weather-widget";
import {
  UpcomingBookings,
  type UpcomingBooking,
} from "@/components/dashboard/upcoming-bookings";
import {
  RecentTransactions,
  mergeTransactions,
} from "@/components/dashboard/recent-transactions";
import {
  AlertsPanel,
  type AlertItem,
} from "@/components/dashboard/alerts-panel";
import { ChannelLogo } from "@/components/leads/channel-logo";
import { channelMeta, initials, scoreClasses } from "@/lib/leads";
import { formatDateLong, formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

type BookingMetricRow = {
  status: string | null;
  date: string;
  deposit_amount: number | null;
  deposit_paid: boolean | null;
  balance_due: number | null;
};

type BookingJoinRow = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  offer_name: string | null;
  party_size: number | null;
  total_amount: number | null;
  status: string | null;
  balance_due: number | null;
  balance_due_date: string | null;
  deposit_paid: boolean | null;
  reminder_sent: boolean | null;
  customers: { first_name: string | null; last_name: string | null } | null;
};

type RevenueMetricRow = {
  amount: number | null;
  date: string;
};

type HotLeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  source_channel: string | null;
  interested_offer: string | null;
  occasion: string | null;
  party_size: number | null;
  desired_date: string | null;
  desired_time_slot: string | null;
  score: number | null;
  status: string | null;
};

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "Lead";
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

const QUALIFIED_STATUSES = new Set(["qualified", "quote_sent", "booked"]);

export default async function OverviewPage() {
  const supabase = await createClient();
  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const todayIso = now.toISOString().slice(0, 10);
  const ago30Iso = new Date(now.getTime() - 30 * DAY_MS).toISOString();

  const [
    goalRes,
    metricsRes,
    upcomingRes,
    newLeadsRes,
    attentionLeadsRes,
    weatherRes,
    revenuesRes,
    expensesRes,
    conversationsRes,
    leadsStatusRes,
    hotLeadsRes,
    awaitingReplyRes,
    bankAccountsRes,
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("status, date, deposit_amount, deposit_paid, balance_due")
      .returns<BookingMetricRow[]>(),
    supabase
      .from("bookings")
      .select(
        "id, date, start_time, end_time, offer_name, party_size, total_amount, status, balance_due, balance_due_date, deposit_paid, reminder_sent, customers(first_name, last_name)",
      )
      .gte("date", todayIso)
      .neq("status", "cancelled")
      .order("date", { ascending: true })
      .limit(6)
      .returns<BookingJoinRow[]>(),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", ago30Iso),
    supabase
      .from("leads")
      .select("id, first_name, last_name")
      .eq("needs_human_intervention", true)
      .limit(4),
    supabase
      .from("weather_cache")
      .select(
        "date, rating, wind_speed_kmh, wind_direction, wave_height_m, water_temp_c, swell_m",
      )
      .gte("date", todayIso)
      .order("date", { ascending: true })
      .limit(5)
      .returns<WeatherDay[]>(),
    supabase
      .from("revenues")
      .select("id, amount, date, type, note")
      .order("date", { ascending: false })
      .returns<(RevenueMetricRow & { id: string; type: string | null; note: string | null })[]>(),
    supabase
      .from("expenses")
      .select("id, amount, date, category, description")
      .order("date", { ascending: false })
      .returns<{ id: string; amount: number | null; date: string; category: string | null; description: string | null }[]>(),
    // ── Léa multicanal : chaque conversation porte son canal (whatsapp/email…) ──
    supabase
      .from("conversations")
      .select("lead_id, channel")
      .returns<{ lead_id: string | null; channel: string | null }[]>(),
    // Statut de chaque lead → pour calculer le taux de qualification par canal.
    supabase
      .from("leads")
      .select("id, status")
      .returns<{ id: string; status: string | null }[]>(),
    // ── Leads les plus chauds = ceux qui ont une date souhaitée ──
    supabase
      .from("leads")
      .select(
        "id, first_name, last_name, source_channel, interested_offer, occasion, party_size, desired_date, desired_time_slot, score, status",
      )
      .eq("archived", false)
      .gte("desired_date", todayIso)
      .order("score", { ascending: false, nullsFirst: false })
      .order("desired_date", { ascending: true })
      .limit(30)
      .returns<HotLeadRow[]>(),
    // ── Clients dont le dernier message attend encore une réponse ──
    // Signal le plus fort de perte de prospect : ils ont écrit, personne n'a
    // répondu. Rien à voir avec un score — c'est nous qui bloquons.
    supabase
      .from("lead_last_message")
      .select("lead_id")
      .eq("last_from_me", false),
    // ── Solde bancaire réel, alimenté par la synchro Qonto ──
    supabase
      .from("bank_accounts")
      .select("balance_cents, balance_updated_at")
      .neq("status", "closed")
      .returns<{ balance_cents: number | null; balance_updated_at: string | null }[]>(),
  ]);

  const goal = goalRes.data;
  const min = goal?.target_min ?? 0;
  const medium = goal?.target_medium ?? 0;
  const strong = goal?.target_strong ?? 0;
  const periodStart = goal?.period_start ?? `${year}-06-01`;
  const periodEnd = goal?.period_end ?? `${year}-08-31`;

  const metrics = metricsRes.data ?? [];
  const inYear = (d: string) => d.slice(0, 4) === String(year);
  const inCurrentMonth = (d: string) =>
    inYear(d) && Number(d.slice(5, 7)) - 1 === monthIdx;

  // CA & marge : uniquement depuis la table revenues (évite le double-comptage).
  const revenuesData = revenuesRes.data ?? [];
  const caYtd = revenuesData
    .filter((r) => inYear(r.date))
    .reduce((s, r) => s + (r.amount ?? 0), 0);
  const caMonth = revenuesData
    .filter((r) => inCurrentMonth(r.date))
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  const expensesData = expensesRes.data ?? [];
  const opexYtd = expensesData
    .filter((e) => inYear(e.date))
    .reduce((s, e) => s + (e.amount ?? 0), 0);
  const ytdMargin = caYtd - opexYtd;

  // Trésorerie réelle : somme des soldes bancaires remontés par qonto-sync.
  // null tant qu'aucun compte n'a été synchronisé — on affiche alors « Qonto
  // non connecté » plutôt qu'un 0 € qui ressemblerait à un compte vide.
  const bankAccounts = bankAccountsRes.data ?? [];
  const treasury = bankAccounts.length
    ? bankAccounts.reduce((s, a) => s + (a.balance_cents ?? 0), 0) / 100
    : null;
  const lastBalanceAt = bankAccounts
    .map((a) => a.balance_updated_at)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const treasuryUpdatedLabel = lastBalanceAt
    ? `maj ${formatDateLong(lastBalanceAt.slice(0, 10))}`
    : "jamais synchronisé";

  const outstandingOf = (b: BookingMetricRow) =>
    (b.deposit_paid ? 0 : b.deposit_amount ?? 0) + (b.balance_due ?? 0);
  const outstanding = metrics
    .filter((b) => b.status !== "cancelled")
    .reduce((s, b) => s + outstandingOf(b), 0);
  const upcomingCount = metrics.filter(
    (b) => b.date >= todayIso && b.status !== "cancelled",
  ).length;

  const monthly = Array<number>(12).fill(0);
  for (const r of revenuesData) {
    if (inYear(r.date)) monthly[Number(r.date.slice(5, 7)) - 1] += r.amount ?? 0;
  }

  const upcoming: UpcomingBooking[] = (upcomingRes.data ?? []).map((b) => ({
    id: b.id,
    date: b.date,
    startTime: b.start_time,
    endTime: b.end_time,
    offerName: b.offer_name,
    customerName: fullName(b.customers?.first_name ?? null, b.customers?.last_name ?? null),
    partySize: b.party_size,
    amount: b.total_amount,
    status: b.status,
  }));

  const recentTransactions = mergeTransactions(revenuesData, expensesData, 8);
  const weatherDays = weatherRes.data ?? [];
  const newLeadsCount = newLeadsRes.count ?? 0;
  const alerts = buildAlerts(upcomingRes.data ?? [], attentionLeadsRes.data ?? [], todayIso);

  // ── Stats agent Léa par canal (source de vérité : conversations.channel) ──
  const statusById = new Map((leadsStatusRes.data ?? []).map((l) => [l.id, l.status]));
  type Agg = { conversations: number; leads: Set<string>; qualified: Set<string> };
  const perChannel = new Map<string, Agg>();
  const allLeads = new Set<string>();
  const allQualified = new Set<string>();
  let totalConversations = 0;
  for (const c of conversationsRes.data ?? []) {
    const ch = c.channel || "autre";
    const a = perChannel.get(ch) ?? { conversations: 0, leads: new Set(), qualified: new Set() };
    a.conversations += 1;
    totalConversations += 1;
    if (c.lead_id) {
      a.leads.add(c.lead_id);
      allLeads.add(c.lead_id);
      if (QUALIFIED_STATUSES.has(statusById.get(c.lead_id) ?? "")) {
        a.qualified.add(c.lead_id);
        allQualified.add(c.lead_id);
      }
    }
    perChannel.set(ch, a);
  }
  const agentChannels = [...perChannel.entries()]
    .map(([channel, a]) => ({
      channel,
      conversations: a.conversations,
      leads: a.leads.size,
      qualified: a.qualified.size,
    }))
    .sort((a, b) => b.conversations - a.conversations);
  const agentTotals = {
    conversations: totalConversations,
    leads: allLeads.size,
    qualified: allQualified.size,
  };

  // ── Leads les plus chauds (déjà triés score ↓ puis date ↑) ──
  const actionableHotLeads = (hotLeadsRes.data ?? []).filter(
    (l) => l.status !== "booked" && l.status !== "lost",
  );
  const hotLeads = actionableHotLeads.slice(0, 6);

  // ── Deux alertes, par ordre d'urgence réelle ──────────────────────
  // 1. Des clients attendent une réponse : c'est nous le point de blocage.
  // 2. Une sortie approche : l'échéance rend le lead périssable.
  // Le score seul ne dit rien de l'urgence — il est descendu en 3ᵉ rideau
  // dans la vue Priorité, plus dans la bannière.
  const activeLeadIds = new Set(
    (leadsStatusRes.data ?? [])
      .filter((l) => l.status !== "booked" && l.status !== "lost")
      .map((l) => l.id),
  );
  const awaitingReplyCount = (awaitingReplyRes.data ?? []).filter(
    (r) => r.lead_id && activeLeadIds.has(r.lead_id),
  ).length;

  const in7DaysIso = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const imminentCount = actionableHotLeads.filter(
    (l) => l.desired_date && l.desired_date <= in7DaysIso,
  ).length;

  return (
    <div className="space-y-6">
      {awaitingReplyCount > 0 && (
        <Link
          href="/leads?view=priority&bucket=unanswered"
          className="enter-up flex items-center gap-3 rounded-xl border border-danger/40 bg-danger/8 px-4 py-3 text-sm transition-colors hover:bg-danger/12"
        >
          <span className="inline-flex size-2 shrink-0 animate-pulse rounded-full bg-danger" />
          <p className="flex-1 text-foreground/90">
            <strong className="text-danger">
              {awaitingReplyCount} client{awaitingReplyCount > 1 ? "s" : ""}
            </strong>
            {awaitingReplyCount > 1 ? " attendent" : " attend"} votre réponse — ils ont écrit,
            personne n&apos;a répondu.
          </p>
        </Link>
      )}

      {imminentCount > 0 && (
        <Link
          href="/leads?view=priority&bucket=imminent"
          className="enter-up flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/8 px-4 py-3 text-sm transition-colors hover:bg-gold/12"
        >
          <span className="inline-flex size-2 shrink-0 animate-pulse rounded-full bg-gold" />
          <p className="flex-1 text-foreground/90">
            <strong className="text-gold">
              {imminentCount} sortie{imminentCount > 1 ? "s" : ""} souhaitée
              {imminentCount > 1 ? "s" : ""} sous 7 jours
            </strong>
            {" "}— à confirmer avant que la date ne passe.
          </p>
        </Link>
      )}

      <header className="enter-up flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Vue d&apos;ensemble
          </h1>
          <p className="text-sm text-muted-foreground">
            {goal
              ? `Saison en cours · ${formatDateLong(periodStart)} – ${formatDateLong(periodEnd)}`
              : "Tableau de bord Harmonie Yacht"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddBookingDialog />
          <AddExpenseDialog />
          <AddRevenueDialog />
        </div>
      </header>

      {(attentionLeadsRes.data?.length ?? 0) > 0 && (
        <Link
          href="/leads?view=priority&bucket=takeover"
          className="enter-up flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/8 px-4 py-3 text-sm transition-colors hover:bg-warning/12"
        >
          <span className="inline-flex size-2 shrink-0 animate-pulse rounded-full bg-warning" />
          <p className="flex-1 text-warning-foreground/90">
            <strong className="text-warning">
              {attentionLeadsRes.data?.length} lead
              {(attentionLeadsRes.data?.length ?? 0) > 1 ? "s" : ""} à reprendre
            </strong>
            {" "}— Léa a escaladé ces conversations vers vous.
          </p>
          <span className="text-xs text-warning-foreground/70">Voir les leads →</span>
        </Link>
      )}

      {/* ── 1. Chiffre d'affaires vs objectifs ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueHero year={year} caYtd={caYtd} caMonth={caMonth} outstanding={outstanding} />
        </div>
        <Card className="enter-up" style={{ animationDelay: "120ms" }}>
          <CardHeader>
            <CardTitle>Objectif chiffre d&apos;affaires</CardTitle>
            <CardDescription>CA {year} vs objectifs de saison</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueGauge current={caYtd} min={min} medium={medium} strong={strong} />
          </CardContent>
        </Card>
      </div>

      {/* ── 2. Leads les plus chauds ───────────────────────────────── */}
      <Card className="enter-up" style={{ animationDelay: "160ms" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Flame className="size-4 text-gold" />
              Leads les plus chauds
            </CardTitle>
            <CardDescription>Prospects dont la sortie souhaitée est à venir — à convertir en priorité</CardDescription>
          </div>
          <Link href="/leads" className="text-sm font-medium text-gold hover:underline">
            Tous les leads →
          </Link>
        </CardHeader>
        <CardContent>
          <HotLeads leads={hotLeads} />
        </CardContent>
      </Card>

      {/* ── 3. Performance de Léa — tous canaux ────────────────────── */}
      <Card className="enter-up" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="size-4 text-gold" />
            Performance de Léa — tous canaux
          </CardTitle>
          <CardDescription>
            {agentTotals.conversations} conversation{agentTotals.conversations !== 1 ? "s" : ""} ·{" "}
            {agentTotals.leads} lead{agentTotals.leads !== 1 ? "s" : ""} ·{" "}
            {pct(agentTotals.qualified, agentTotals.leads)}% qualifiés
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentChannelStats channels={agentChannels} totals={agentTotals} />
        </CardContent>
      </Card>

      {/* ── KPIs ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Réservations à venir" value={upcomingCount} icon={Ship} accent="primary" hint="hors annulations" index={0} />
        <KpiCard label="Nouveaux leads (30 j)" value={newLeadsCount} icon={Users} accent="info" index={1} />
        <KpiCard label={`Marge nette ${year}`} value={ytdMargin} format="eur" icon={TrendingUp} accent={ytdMargin >= 0 ? "success" : "gold"} hint="comptable · pas la trésorerie" index={2} />
        {/* Solde bancaire réel (Qonto). La marge nette ci-contre est un résultat
            comptable : elle ignore tout ce qui sort du compte sans être saisi
            (charges sociales, prélèvements, échéances). Les deux côte à côte
            évitent de lire l'une pour l'autre. */}
        {treasury === null ? (
          <KpiCard label="Trésorerie réelle" value={0} format="eur" icon={Banknote} accent="gold" hint="Qonto non connecté" index={3} />
        ) : (
          <KpiCard label="Trésorerie réelle" value={treasury} format="eur" icon={Banknote} accent="gold" hint={`solde Qonto · ${treasuryUpdatedLabel}`} index={3} />
        )}
      </div>

      {/* ── Secondaire ─────────────────────────────────────────────── */}
      <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenus par mois</CardTitle>
            <CardDescription>CA confirmé {year}</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyBars values={monthly} currentMonth={monthIdx} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertes</CardTitle>
            <CardDescription>Actions à traiter</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertsPanel alerts={alerts} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Réservations à venir</CardTitle>
            <CardDescription>Les 6 prochaines sorties</CardDescription>
          </CardHeader>
          <CardContent>
            <UpcomingBookings bookings={upcoming} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Météo marine — Carnon</CardTitle>
            <CardDescription>Prévisions des 5 prochains jours</CardDescription>
          </CardHeader>
          <CardContent>
            <WeatherWidget days={weatherDays} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Transactions récentes</CardTitle>
            <CardDescription>Derniers revenus et dépenses enregistrés</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentTransactions transactions={recentTransactions} />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

function buildAlerts(
  bookings: BookingJoinRow[],
  attentionLeads: { id: string; first_name: string | null; last_name: string | null }[],
  todayIso: string,
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const todayMs = new Date(todayIso).getTime();

  for (const lead of attentionLeads) {
    alerts.push({
      id: `lead-${lead.id}`,
      severity: "danger",
      title: `Lead à rappeler — ${fullName(lead.first_name, lead.last_name)}`,
      description: "Intervention humaine requise.",
    });
  }

  for (const b of bookings) {
    const name = fullName(b.customers?.first_name ?? null, b.customers?.last_name ?? null);
    if (b.deposit_paid === false) {
      alerts.push({
        id: `deposit-${b.id}`,
        severity: "warning",
        title: `Acompte en attente — ${b.offer_name ?? "réservation"}`,
        description: `${name} · sortie du ${formatDateLong(b.date)}.`,
      });
      continue;
    }
    if ((b.balance_due ?? 0) > 0 && b.balance_due_date) {
      const daysLeft = (new Date(b.balance_due_date).getTime() - todayMs) / DAY_MS;
      if (daysLeft <= 10) {
        alerts.push({
          id: `balance-${b.id}`,
          severity: daysLeft <= 3 ? "danger" : "warning",
          title: `Solde à encaisser — ${formatEur(b.balance_due)}`,
          description: `${name} · le jour de la sortie (${formatDateLong(b.balance_due_date)}).`,
        });
      }
    }
  }

  return alerts.slice(0, 5);
}

// ── Leads les plus chauds (date souhaitée connue) ──────────────────
function HotLeads({ leads }: { leads: HotLeadRow[] }) {
  if (leads.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Aucun lead avec une date souhaitée à venir pour l&apos;instant.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {leads.map((l) => {
        const label = l.source_channel === "website" ? null : l.source_channel;
        const desired = l.desired_date
          ? new Date(`${l.desired_date}T00:00:00`).toLocaleDateString("fr-FR", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })
          : null;
        return (
          <li key={l.id}>
            <Link
              href={`/leads?lead=${l.id}`}
              className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-foreground/[0.03]"
            >
              <span className="relative shrink-0">
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-xs font-semibold",
                    channelMeta(l.source_channel).className,
                  )}
                >
                  {initials(l.first_name, l.last_name)}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-background ring-1 ring-border">
                  <ChannelLogo channel={label} className="size-2.5" />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {fullName(l.first_name, l.last_name)}
                  </span>
                  {l.occasion && (
                    <span className="shrink-0 rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] font-medium text-gold">
                      {l.occasion}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
                  {desired && (
                    <span className="inline-flex items-center gap-1 font-medium text-gold">
                      <CalendarDays className="size-3" />
                      {desired}
                    </span>
                  )}
                  {l.interested_offer && <span className="truncate">· {l.interested_offer}</span>}
                  {l.party_size != null && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" />
                      {l.party_size}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums",
                  scoreClasses(l.score),
                )}
                title="Score de qualification"
              >
                {l.score ?? "—"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ── Performance de Léa par canal ───────────────────────────────────
function AgentChannelStats({
  channels,
  totals,
}: {
  channels: { channel: string; conversations: number; leads: number; qualified: number }[];
  totals: { conversations: number; leads: number; qualified: number };
}) {
  if (channels.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Léa n&apos;a pas encore de conversation enregistrée.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="pb-2 pr-4 text-left font-medium">Canal</th>
            <th className="pb-2 pr-4 text-right font-medium">Conversations</th>
            <th className="pb-2 pr-4 text-right font-medium">Leads</th>
            <th className="pb-2 pr-4 text-right font-medium">Qualifiés</th>
            <th className="pb-2 text-right font-medium">Taux</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {channels.map((c) => {
            const chLabel = c.channel === "autre" ? "Autre" : channelMeta(c.channel).label;
            return (
              <tr key={c.channel}>
                <td className="py-2.5 pr-4">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <ChannelLogo channel={c.channel === "autre" ? null : c.channel} className="size-4" />
                    {chLabel}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-foreground">{c.conversations}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-foreground">{c.leads}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-foreground">{c.qualified}</td>
                <td className="py-2.5 text-right tabular-nums font-medium text-success">
                  {pct(c.qualified, c.leads)}%
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border font-semibold">
            <td className="pt-2.5 pr-4 text-foreground">Total</td>
            <td className="pt-2.5 pr-4 text-right tabular-nums text-foreground">{totals.conversations}</td>
            <td className="pt-2.5 pr-4 text-right tabular-nums text-foreground">{totals.leads}</td>
            <td className="pt-2.5 pr-4 text-right tabular-nums text-foreground">{totals.qualified}</td>
            <td className="pt-2.5 text-right tabular-nums text-success">
              {pct(totals.qualified, totals.leads)}%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
