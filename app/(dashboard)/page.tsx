import { Euro, Ship, Users, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
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
  AlertsPanel,
  type AlertItem,
} from "@/components/dashboard/alerts-panel";
import { formatDateLong, formatEur, formatEurCompact } from "@/lib/format";

const CONFIRMED = new Set(["confirmed", "completed"]);
const DAY_MS = 24 * 60 * 60 * 1000;

type BookingMetricRow = {
  total_amount: number | null;
  net_margin: number | null;
  status: string | null;
  date: string;
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
  const todayIso = new Date().toISOString().slice(0, 10);
  const ago30Iso = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [
    goalRes,
    metricsRes,
    upcomingRes,
    recentLeadsRes,
    newLeadsRes,
    attentionLeadsRes,
    weatherRes,
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("total_amount, net_margin, status, date")
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
  ]);

  const goal = goalRes.data;
  const min = goal?.target_min ?? 0;
  const medium = goal?.target_medium ?? 0;
  const strong = goal?.target_strong ?? 0;

  const metrics = metricsRes.data ?? [];
  const confirmedRevenue = metrics
    .filter((b) => CONFIRMED.has(b.status ?? ""))
    .reduce((sum, b) => sum + (b.total_amount ?? 0), 0);
  const netMargin = metrics
    .filter((b) => CONFIRMED.has(b.status ?? ""))
    .reduce((sum, b) => sum + (b.net_margin ?? 0), 0);
  const upcomingCount = metrics.filter(
    (b) => b.date >= todayIso && b.status !== "cancelled",
  ).length;

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

  const weatherDays = weatherRes.data ?? [];
  const newLeadsCount = newLeadsRes.count ?? 0;

  const alerts = buildAlerts(
    upcomingRes.data ?? [],
    attentionLeadsRes.data ?? [],
    todayIso,
  );

  return (
    <div className="space-y-6">
      <header className="enter-up space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Vue d&apos;ensemble
        </h1>
        <p className="text-sm text-muted-foreground">
          {goal
            ? `Saison en cours · ${formatDateLong(goal.period_start!)} – ${formatDateLong(goal.period_end!)}`
            : "Tableau de bord Harmonie Yacht"}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="CA confirmé"
          value={confirmedRevenue}
          format="eur"
          icon={Euro}
          accent="gold"
          hint={`objectif ${formatEurCompact(min)} – ${formatEurCompact(strong)}`}
          index={0}
        />
        <KpiCard
          label="Réservations à venir"
          value={upcomingCount}
          icon={Ship}
          accent="primary"
          hint="hors annulations"
          index={1}
        />
        <KpiCard
          label="Nouveaux leads (30 j)"
          value={newLeadsCount}
          icon={Users}
          accent="info"
          index={2}
        />
        <KpiCard
          label="Marge nette"
          value={netMargin}
          format="eur"
          icon={Wallet}
          accent="success"
          hint="sur CA confirmé"
          index={3}
        />
      </div>

      <div
        className="enter-up grid grid-cols-1 gap-6 lg:grid-cols-3"
        style={{ animationDelay: "260ms" }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Objectif chiffre d&apos;affaires</CardTitle>
            {goal && (
              <CardDescription>
                Paliers de la saison · CA confirmé
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <RevenueGauge
              current={confirmedRevenue}
              min={min}
              medium={medium}
              strong={strong}
            />
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
      </div>

      <div
        className="enter-up grid grid-cols-1 gap-6 lg:grid-cols-3"
        style={{ animationDelay: "340ms" }}
      >
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
      </div>

      <Card className="enter-up" style={{ animationDelay: "420ms" }}>
        <CardHeader>
          <CardTitle>Leads récents</CardTitle>
          <CardDescription>Derniers prospects entrés dans le pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentLeads leads={recentLeads} />
        </CardContent>
      </Card>
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
    } else if ((b.balance_due ?? 0) > 0) {
      const dueMs = b.balance_due_date
        ? new Date(b.balance_due_date).getTime()
        : null;
      const soon = dueMs !== null && dueMs - todayMs <= 7 * DAY_MS;
      alerts.push({
        id: `balance-${b.id}`,
        severity: soon ? "danger" : "info",
        title: `Solde à encaisser — ${formatEur(b.balance_due)}`,
        description: `${name}${
          b.balance_due_date ? ` · échéance ${formatDateLong(b.balance_due_date)}` : ""
        }.`,
      });
    }
  }

  return alerts.slice(0, 5);
}
