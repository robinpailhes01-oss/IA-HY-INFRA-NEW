import { CalendarRange, Euro, Ship, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ReportsView, type ChannelStat, type TimeBucket } from "@/components/reports/reports-view";

type BookingRow = {
  date: string | null;
  total_amount: number | null;
  status: string | null;
  source_channel: string | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
/** Lundi de la semaine contenant `d`. */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // 0 = lundi
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

const WEEKS = 12;
const MONTHS = 12;

export default async function ReportsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select("date, total_amount, status, source_channel")
    .not("date", "is", null)
    .neq("status", "cancelled")
    .returns<BookingRow[]>();

  const bookings = data ?? [];
  const now = new Date();

  // ── Séries hebdomadaires (12 dernières semaines) ──────────────────
  const curWeek = startOfWeek(now);
  const weeks: (TimeBucket & { key: string })[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const ws = new Date(curWeek);
    ws.setDate(ws.getDate() - i * 7);
    weeks.push({
      key: ymd(ws),
      label: ws.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      revenue: 0,
      count: 0,
      isCurrent: i === 0,
    });
  }
  const weekIdx = new Map(weeks.map((w, i) => [w.key, i]));

  // ── Séries mensuelles (12 derniers mois) ──────────────────────────
  const months: (TimeBucket & { key: string })[] = [];
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("fr-FR", { month: "short" });
    months.push({
      key: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`,
      label: d.getMonth() === 0 ? `${label} ${String(d.getFullYear()).slice(2)}` : label,
      revenue: 0,
      count: 0,
      isCurrent: i === 0,
    });
  }
  const monthIdx = new Map(months.map((m, i) => [m.key, i]));

  const thisMonthKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const yearFromKey = months[0].key; // borne des 12 mois glissants
  const yearFromDate = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1), 1);
  const yearFromYmd = ymd(yearFromDate);

  // Agrégats par canal sur 3 périodes.
  const chanMonth = new Map<string, { count: number; revenue: number }>();
  const chanYear = new Map<string, { count: number; revenue: number }>();
  const chanAll = new Map<string, { count: number; revenue: number }>();
  const bump = (m: Map<string, { count: number; revenue: number }>, ch: string, amt: number) => {
    const cur = m.get(ch) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += amt;
    m.set(ch, cur);
  };

  for (const b of bookings) {
    if (!b.date) continue;
    const amt = Number(b.total_amount) || 0;
    const ch = b.source_channel ?? "unknown";

    // Séries temporelles
    const wk = ymd(startOfWeek(new Date(`${b.date}T00:00:00`)));
    const wi = weekIdx.get(wk);
    if (wi != null) {
      weeks[wi].revenue += amt;
      weeks[wi].count += 1;
    }
    const mk = b.date.slice(0, 7);
    const mi = monthIdx.get(mk);
    if (mi != null) {
      months[mi].revenue += amt;
      months[mi].count += 1;
    }

    // Canaux — on écarte « site internet » (tout le monde réserve via le site) ;
    // son CA reste compté dans les séries temporelles et les KPIs ci-dessus.
    if (b.source_channel !== "website") {
      bump(chanAll, ch, amt);
      if (b.date >= yearFromYmd) bump(chanYear, ch, amt);
      if (mk === thisMonthKey) bump(chanMonth, ch, amt);
    }
  }
  void yearFromKey;

  const toStats = (m: Map<string, { count: number; revenue: number }>): ChannelStat[] =>
    [...m.entries()]
      .map(([channel, v]) => ({ channel, count: v.count, revenue: v.revenue }))
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue);

  const weekly = weeks.map(({ key, ...rest }) => { void key; return rest; });
  const monthly = months.map(({ key, ...rest }) => { void key; return rest; });

  // ── KPIs ──────────────────────────────────────────────────────────
  const caWeek = weeks[weeks.length - 1].revenue;
  const caMonth = months[months.length - 1].revenue;
  const countMonth = months[months.length - 1].count;
  const avgBasket = countMonth > 0 ? Math.round(caMonth / countMonth) : 0;

  return (
    <div className="space-y-6">
      <header className="enter-up space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Rapports</h1>
        <p className="text-sm text-muted-foreground">
          Chiffre d&apos;affaires et réservations par canal · vue d&apos;ensemble
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="CA cette semaine" value={caWeek} format="eur" icon={Wallet} accent="gold" index={0} />
        <KpiCard label="CA ce mois" value={caMonth} format="eur" icon={Euro} accent="primary" index={1} />
        <KpiCard label="Réservations ce mois" value={countMonth} format="int" icon={Ship} accent="info" index={2} />
        <KpiCard label="Panier moyen" value={avgBasket} format="eur" icon={CalendarRange} accent="success" hint="ce mois-ci" index={3} />
      </div>

      <ReportsView
        weekly={weekly}
        monthly={monthly}
        channels={{ month: toStats(chanMonth), year: toStats(chanYear), all: toStats(chanAll) }}
      />
    </div>
  );
}
