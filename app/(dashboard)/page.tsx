import Link from "next/link";
import { Banknote, Bot, MessageCircle, Ship, TrendingUp, Users } from "lucide-react";

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
  RecentLeads,
  type RecentLead,
} from "@/components/dashboard/recent-leads";
import {
  RecentTransactions,
  mergeTransactions,
} from "@/components/dashboard/recent-transactions";
import {
  AlertsPanel,
  type AlertItem,
} from "@/components/dashboard/alerts-panel";
import { formatDateLong, formatEur } from "@/lib/format";

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

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  source_channel: string | null;
  interested_offer: string | null;
  score: number | null;
  status: string | null;
  created_at: string | null;
};

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "Client";
}

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
    recentLeadsRes,
    newLeadsRes,
    attentionLeadsRes,
    weatherRes,
    revenuesRes,
    expensesRes,
    leaTotalRes,
    leaQualifiedRes,
    leaFollowupsRes,
    leaConvsRes,
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select(
        "status, date, deposit_amount, deposit_paid, balance_due",
      )
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
      .select(
        "id, first_name, last_name, source_channel, interested_offer, score, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<LeadRow[]>(),
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
    // ── Stats Léa : compteurs sur leads WhatsApp ──
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("source_channel", "whatsapp"),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("source_channel", "whatsapp")
      .in("status", ["qualified", "quote_sent", "booked"]),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("source_channel", "whatsapp")
      .gte("followup_count", 1),
    supabase
      .from("wa_conversations")
      .select("*", { count: "exact", head: true }),
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

  // Le CA et la marge se calculent UNIQUEMENT depuis la table revenues
  // (alimentée par le trigger bookings_to_revenues + entrées manuelles via
  // AddRevenueDialog). Évite tout double-comptage avec bookings.total_amount.
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

  const outstandingOf = (b: BookingMetricRow) =>
    (b.deposit_paid ? 0 : b.deposit_amount ?? 0) + (b.balance_due ?? 0);
  const outstanding = metrics
    .filter((b) => b.status !== "cancelled" && b.date >= todayIso)
    .reduce((s, b) => s + outstandingOf(b), 0);
  // « Déjà encaissé » = ce qui est entré dans la caisse cette année.
  const collected = caYtd;

  const upcomingCount = metrics.filter(
    (b) => b.date >= todayIso && b.status !== "cancelled",
  ).length;

  const monthly = Array<number>(12).fill(0);
  for (const r of revenuesData) {
    if (inYear(r.date)) {
      monthly[Number(r.date.slice(5, 7)) - 1] += r.amount ?? 0;
    }
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

  const recentLeads: RecentLead[] = (recentLeadsRes.data ?? []).map((l) => ({
    id: l.id,
    name: fullName(l.first_name, l.last_name),
    sourceChannel: l.source_channel,
    interestedOffer: l.interested_offer,
    score: l.score,
    status: l.status,
    createdAt: l.created_at,
  }));

  const recentTransactions = mergeTransactions(
    revenuesData.map((r: any) => ({ id: r.id, amount: r.amount, date: r.date, type: r.type, note: r.note })),
    expensesData.map((e: any) => ({ id: e.id, amount: e.amount, date: e.date, category: e.category, description: e.description })),
    8,
  );

  const weatherDays = weatherRes.data ?? [];
  const newLeadsCount = newLeadsRes.count ?? 0;
  const alerts = buildAlerts(
    upcomingRes.data ?? [],
    attentionLeadsRes.data ?? [],
    todayIso,
  );

  return (
    <div className="space-y-6">
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
          href="/leads"
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueHero
            year={year}
            caYtd={caYtd}
            caMonth={caMonth}
            outstanding={outstanding}
          />
        </div>
        <Card className="enter-up" style={{ animationDelay: "120ms" }}>
          <CardHeader>
            <CardTitle>Revenus par mois</CardTitle>
            <CardDescription>CA confirmé {year}</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyBars values={monthly} currentMonth={monthIdx} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Réservations à venir" value={upcomingCount} icon={Ship} accent="primary" hint="hors annulations" index={0} />
        <KpiCard label="Nouveaux leads (30 j)" value={newLeadsCount} icon={Users} accent="info" index={1} />
        <KpiCard label={`Marge nette ${year}`} value={ytdMargin} format="eur" icon={TrendingUp} accent={ytdMargin >= 0 ? "success" : "gold"} hint="revenus − dépenses" index={2} />
        <KpiCard label="Déjà encaissé" value={collected} format="eur" icon={Banknote} accent="gold" hint="revenus + soldes perçus" index={3} />
      </div>

      <Card className="enter-up">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4 text-gold" />
              Performance Léa
            </CardTitle>
            <CardDescription>Agent WhatsApp — depuis l&apos;activation</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <LeaStat label="Conversations" value={leaConvsRes.count ?? 0} icon={MessageCircle} />
            <LeaStat label="Leads créés" value={leaTotalRes.count ?? 0} icon={Users} />
            <LeaStat
              label="Qualifiés / réservés"
              value={leaQualifiedRes.count ?? 0}
              subline={
                (leaTotalRes.count ?? 0) > 0
                  ? `${Math.round(((leaQualifiedRes.count ?? 0) / (leaTotalRes.count ?? 1)) * 100)}% de conversion`
                  : "—"
              }
              icon={TrendingUp}
            />
            <LeaStat label="Relances envoyées" value={leaFollowupsRes.count ?? 0} icon={Bot} />
          </div>
        </CardContent>
      </Card>

      <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Objectif chiffre d&apos;affaires</CardTitle>
            <CardDescription>CA {year} · cumul depuis le 1ᵉʳ janvier</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueGauge current={caYtd} min={min} medium={medium} strong={strong} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Météo marine — Carnon</CardTitle>
            <CardDescription>Prévisions des 5 prochains jours</CardDescription>
          </CardHeader>
          <CardContent>
            <WeatherWidget days={weatherDays} />
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
            <CardTitle>Alertes</CardTitle>
            <CardDescription>Actions à traiter</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertsPanel alerts={alerts} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Leads récents</CardTitle>
            <CardDescription>Derniers prospects entrés dans le pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentLeads leads={recentLeads} />
          </CardContent>
        </Card>

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
    const name = fullName(
      b.customers?.first_name ?? null,
      b.customers?.last_name ?? null,
    );
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


// ── Petit bloc de stats Léa (utilisé dans le panneau Performance) ──
function LeaStat({
  label,
  value,
  subline,
  icon: Icon,
}: {
  label: string;
  value: number;
  subline?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/40 p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {subline && <span className="text-xs text-muted-foreground">{subline}</span>}
    </div>
  );
}

