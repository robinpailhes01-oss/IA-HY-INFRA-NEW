import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarClock, HandCoins, Receipt, Scale, TrendingUp, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Num } from "@/components/ui/num";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { AddExpenseDialog } from "@/components/finances/add-expense-dialog";
import { AddRevenueDialog } from "@/components/finances/add-revenue-dialog";
import { PeriodFilter } from "@/components/finances/period-filter";
import { HealthPanel, type HealthSnapshot, type Pillar } from "@/components/finance/health-panel";
import { TreasuryCard, type SyncSource } from "@/components/finance/treasury-card";
import { BreakdownCard, type BreakdownItem } from "@/components/finance/breakdown-card";
import { TransactionsLedger, type LedgerItem } from "@/components/finance/transactions-ledger";
import {
  EXPENSE_LABELS,
  MOIS_COURT,
  REVENUE_LABELS,
  cumulative,
  isoAddDays,
  num,
  pct,
  periodKind,
  periodLabel,
  previousPeriod,
  shortDate,
} from "@/components/finance/fin-utils";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

// FINANCE — la santé de l'entreprise en une page.
//
// Ordre de lecture, du plus important au détail :
//   1. le verdict de Léa (score de santé, autonomie) et la trésorerie réelle ;
//   2. la période choisie : CA, charges, résultat, reste à encaisser ;
//   3. l'année, mois par mois ; d'où vient l'argent, où il part ;
//   4. le journal des opérations.
//
// Règles métier reprises telles quelles (voir les commentaires d'origine) :
// · le CA vient UNIQUEMENT de la table revenues (sinon double comptage avec
//   les réservations) ;
// · le « reste à encaisser » ne compte que les sorties À VENIR non annulées —
//   même définition que la Vue d'ensemble et la page Réservations ;
// · la trésorerie = Qonto + caisse, comme finance-pulse : sans banque
//   connectée, pas de trésorerie ni de score.

type ExpenseRow = { id: string; date: string; category: string; amount: number; description: string | null };
type RevenueRow = { id: string; date: string; type: string; amount: number; note: string | null };
type AmountRow = { date: string; amount: number | null };
type FutureBookingRow = {
  status: string | null;
  deposit_amount: number | null;
  deposit_paid: boolean | null;
  balance_due: number | null;
};

// financial_snapshots, cash_balance et sumup_sync_state (migrations 0030 et
// 0031) ne sont pas encore dans les types générés : on les interroge par un
// client non typé et on décrit ici ce qu'on en lit.
type SnapshotRow = {
  date: string;
  captured_at: string | null;
  score: number | null;
  score_label: string | null;
  treasury: number | string | null;
  runway_months: number | string | null;
  monthly_burn: number | string | null;
  details: Record<string, unknown> | null;
};
type CashRow = { balance: number | string | null; last_movement_date: string | null };
type SyncRow = { last_synced_at: string | null; last_error: string | null };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function currentMonthBounds(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  return { from: `${y}-${pad2(m + 1)}-01`, to: `${y}-${pad2(m + 1)}-${pad2(last)}` };
}

const sum = (rows: Array<{ amount: number | null }>) => rows.reduce((s, r) => s + (r.amount ?? 0), 0);

/** Un pilier du score tel que finance-pulse l'écrit dans `details`. */
function readPillar(details: Record<string, unknown> | null, key: string, valueKey: string, fallbackMax: number): Pillar {
  const raw = (details?.[key] ?? null) as Record<string, unknown> | null;
  return {
    score: num(raw?.score),
    max: num(raw?.max) ?? fallbackMax,
    value: num(raw?.[valueKey]),
  };
}

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const defaults = currentMonthBounds();
  const from = params.from ?? defaults.from;
  const to = params.to ?? defaults.to;

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const prev = previousPeriod(from, to, todayIso);

  const supabase = await createClient();
  const untyped = supabase as unknown as SupabaseClient;
  const empty = Promise.resolve({ data: [] as AmountRow[] });

  const [
    expensesRes,
    revenuesRes,
    prevRevenuesRes,
    yearRevenuesRes,
    yearExpensesRes,
    futureRes,
    bankRes,
    cashRes,
    snapshotsRes,
    qontoRes,
    sumupRes,
  ] = await Promise.all([
    // ── La période choisie ──
    supabase
      .from("expenses")
      .select("id, date, category, amount, description")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
      .returns<ExpenseRow[]>(),
    supabase
      .from("revenues")
      .select("id, date, type, amount, note")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
      .returns<RevenueRow[]>(),
    // ── La période de comparaison, à date égale ──
    prev
      ? supabase.from("revenues").select("date, amount").gte("date", prev.from).lte("date", prev.to).returns<AmountRow[]>()
      : empty,
    // ── L'année en cours, pour le graphique mois par mois ──
    supabase.from("revenues").select("date, amount").gte("date", `${year}-01-01`).lte("date", `${year}-12-31`).returns<AmountRow[]>(),
    supabase.from("expenses").select("date, amount").gte("date", `${year}-01-01`).lte("date", `${year}-12-31`).returns<AmountRow[]>(),
    // ── Reste à encaisser : sorties à venir (annulées filtrées plus bas) ──
    supabase
      .from("bookings")
      .select("status, deposit_amount, deposit_paid, balance_due")
      .gte("date", todayIso)
      .returns<FutureBookingRow[]>(),
    // ── Solde bancaire réel, alimenté par la synchro Qonto ──
    supabase
      .from("bank_accounts")
      .select("balance_cents, balance_updated_at")
      .neq("status", "closed")
      .returns<{ balance_cents: number | null; balance_updated_at: string | null }[]>(),
    untyped.from("cash_balance").select("balance, last_movement_date").maybeSingle<CashRow>(),
    // ── Photos quotidiennes de finance-pulse (score, trésorerie) ──
    untyped
      .from("financial_snapshots")
      .select("date, captured_at, score, score_label, treasury, runway_months, monthly_burn, details")
      .order("date", { ascending: false })
      .limit(120)
      .returns<SnapshotRow[]>(),
    supabase.from("qonto_sync_state").select("last_synced_at, last_error").maybeSingle<SyncRow>(),
    untyped.from("sumup_sync_state").select("last_synced_at, last_error").maybeSingle<SyncRow>(),
  ]);

  // ── La période ──────────────────────────────────────────────────────
  const revenues = revenuesRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const revenue = sum(revenues);
  const opex = sum(expenses);
  const netResult = revenue - opex;
  const margin = pct(netResult, revenue);

  const prevRevenue = prev ? sum(prevRevenuesRes.data ?? []) : 0;
  const caDelta = prev && prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;

  // Cumuls jour après jour : la pente dit le rythme de la période.
  const caTrend = cumulative(revenues, from, to, todayIso);
  const opexTrend = cumulative(expenses, from, to, todayIso);
  const netTrend = caTrend.map((v, i) => v - (opexTrend[i] ?? 0));

  // ── Reste à encaisser ───────────────────────────────────────────────
  // Même définition que la Vue d'ensemble et la page Réservations : le reste
  // à encaisser ne compte QUE les sorties à venir. Les sorties passées non
  // soldées relèvent d'une régularisation, pas d'argent à attendre.
  const future = (futureRes.data ?? []).filter((b) => b.status !== "cancelled");
  const outstanding = future.reduce(
    (s, b) => s + (b.deposit_paid ? 0 : b.deposit_amount ?? 0) + (b.balance_due ?? 0),
    0,
  );
  const awaitingCount = future.filter((b) => (b.deposit_paid ? 0 : b.deposit_amount ?? 0) + (b.balance_due ?? 0) > 0).length;

  // ── Trésorerie ──────────────────────────────────────────────────────
  const accounts = bankRes.data ?? [];
  const bank = accounts.length > 0 ? accounts.reduce((s, a) => s + (a.balance_cents ?? 0), 0) / 100 : null;
  const cash = num(cashRes.data?.balance) ?? 0;
  const bankUpdatedAt =
    accounts
      .map((a) => a.balance_updated_at)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ?? null;

  // ── Photos de santé financière ──────────────────────────────────────
  const snapshots = (snapshotsRes.data ?? []).filter((s) => s.score != null);
  const latest = snapshots[0] ?? null;
  const health: HealthSnapshot | null = latest
    ? {
        date: latest.date,
        capturedAt: latest.captured_at,
        score: latest.score as number,
        label: latest.score_label,
        runwayMonths: num(latest.runway_months),
        monthlyBurn: num(latest.monthly_burn),
        burnSource: typeof latest.details?.burn_source === "string" ? latest.details.burn_source : null,
        // Barème de finance-pulse : 50 / 25 / 25 points.
        pillars: {
          runway: readPillar(latest.details, "runway", "months", 50),
          coverage: readPillar(latest.details, "coverage", "ratio", 25),
          secured: readPillar(latest.details, "secured", "months", 25),
        },
      }
    : null;
  // La photo d'il y a ~30 jours : la première au moins 30 jours plus tôt.
  const monthAgoIso = latest ? isoAddDays(latest.date, -30) : null;
  const monthAgo = monthAgoIso ? snapshots.find((s) => s.date <= monthAgoIso) ?? null : null;
  const window90 = latest ? isoAddDays(latest.date, -89) : todayIso;
  const recent = snapshots.filter((s) => s.date >= window90).reverse();
  const scoreTrend = recent.map((s) => s.score as number);
  const treasuryTrend = recent
    .map((s) => ({ label: shortDate(s.date), a: num(s.treasury) }))
    .filter((p): p is { label: string; a: number } => p.a !== null);

  // L'écart sur 30 jours compare le solde EN DIRECT à la photo d'il y a un
  // mois : c'est bien « combien j'ai de plus ou de moins qu'il y a 30 jours ».
  const monthAgoTreasury = monthAgo ? num(monthAgo.treasury) : null;
  const delta30 = bank !== null && monthAgoTreasury !== null ? bank + cash - monthAgoTreasury : null;

  const syncs: SyncSource[] = [
    {
      name: "Qonto",
      syncedAt: qontoRes.data?.last_synced_at ?? bankUpdatedAt,
      error: qontoRes.data?.last_error ?? null,
    },
  ];
  // SumUp n'apparaît qu'une fois branché : une ligne « jamais synchronisé »
  // pour un service qu'on n'utilise pas serait une fausse alerte.
  if (sumupRes.data?.last_synced_at || sumupRes.data?.last_error) {
    syncs.push({ name: "SumUp", syncedAt: sumupRes.data.last_synced_at, error: sumupRes.data.last_error });
  }

  // ── L'année, mois par mois ──────────────────────────────────────────
  // Le graphique s'arrête au mois courant : des mois futurs à zéro écraseraient
  // les mois réalisés et feraient croire à une chute.
  const caByMonth = Array<number>(12).fill(0);
  const opexByMonth = Array<number>(12).fill(0);
  for (const r of yearRevenuesRes.data ?? []) caByMonth[Number(r.date.slice(5, 7)) - 1] += r.amount ?? 0;
  for (const e of yearExpensesRes.data ?? []) opexByMonth[Number(e.date.slice(5, 7)) - 1] += e.amount ?? 0;
  const monthly = caByMonth
    .slice(0, monthIdx + 1)
    .map((a, i) => ({ label: MOIS_COURT[i], a, b: opexByMonth[i] }));
  const caYear = caByMonth.reduce((s, v) => s + v, 0);
  const opexYear = opexByMonth.reduce((s, v) => s + v, 0);

  // ── Répartitions ────────────────────────────────────────────────────
  const group = <T,>(rows: T[], key: (r: T) => string, amount: (r: T) => number) =>
    Object.entries(
      rows.reduce<Record<string, number>>((acc, r) => {
        acc[key(r)] = (acc[key(r)] ?? 0) + amount(r);
        return acc;
      }, {}),
    )
      .map(([k, v]) => ({ key: k, amount: v }))
      .filter((r) => r.amount > 0)
      .sort((a, b) => b.amount - a.amount);

  const byRevenueType: BreakdownItem[] = group(revenues, (r) => r.type, (r) => r.amount ?? 0).map((r) => ({
    ...r,
    label: REVENUE_LABELS[r.key] ?? r.key,
  }));
  const byExpenseCategory: BreakdownItem[] = group(expenses, (e) => e.category, (e) => e.amount ?? 0).map((e) => ({
    ...e,
    label: EXPENSE_LABELS[e.key] ?? e.key,
  }));

  // ── Journal ─────────────────────────────────────────────────────────
  const ledger: LedgerItem[] = [
    ...revenues.map((r) => ({
      id: r.id,
      kind: "revenue" as const,
      date: r.date,
      label: REVENUE_LABELS[r.type] ?? r.type,
      note: r.note,
      amount: r.amount ?? 0,
    })),
    ...expenses.map((e) => ({
      id: e.id,
      kind: "expense" as const,
      date: e.date,
      label: EXPENSE_LABELS[e.category] ?? e.category,
      note: e.description,
      amount: e.amount ?? 0,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const kind = periodKind(from, to);
  const periodName = periodLabel(from, to);
  const periodShort = kind === "all" ? "depuis le début" : kind === "month" || kind === "year" ? `en ${periodName}` : periodName;

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        eyebrow={`Finance · ${periodName}`}
        title={
          <>
            Santé <em>financière</em>
          </>
        }
        description="Ce que tu as en banque, ce que tu as gagné, et ce qu'il reste à encaisser."
        actions={
          // Téléphone : deux pilules côte à côte, 44 px de haut. La dépense
          // est l'action principale (marine) : les rentrées arrivent seules.
          <div className="grid w-full grid-cols-2 gap-2 [&>button]:h-11 [&>button]:px-4 sm:flex sm:w-auto sm:[&>button]:h-10">
            <AddRevenueDialog />
            <AddExpenseDialog variant="default" />
          </div>
        }
      />

      <PeriodFilter from={from} to={to} className="rise" />

      {/* ── 1. Le verdict et la trésorerie ────────────────────────────── */}
      <div className="grid gap-4 lg:gap-5 xl:grid-cols-12">
        <HealthPanel
          snapshot={health}
          previous={monthAgo && monthAgo.score != null ? { date: monthAgo.date, score: monthAgo.score } : null}
          scoreTrend={scoreTrend}
          bankConnected={bank !== null}
          todayIso={todayIso}
          className="xl:col-span-7"
        />
        <TreasuryCard
          bank={bank}
          cash={cash}
          cashLastDate={cashRes.data?.last_movement_date ?? null}
          trend={treasuryTrend}
          delta30={delta30}
          syncs={syncs}
          className="xl:col-span-5"
        />
      </div>

      {/* ── 2. La période ─────────────────────────────────────────────── */}
      <section aria-label={`Chiffres ${periodShort}`} className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        <KpiCard
          label="Chiffre d'affaires"
          value={revenue}
          format="eur"
          accent="ocean"
          icon={<TrendingUp />}
          trend={caTrend}
          delta={caDelta !== null ? { value: `${caDelta > 0 ? "+" : ""}${caDelta} %`, positive: caDelta >= 0 } : undefined}
          hint={
            caDelta !== null
              ? prev?.label
              : revenues.length === 0
                ? "Aucun encaissement"
                : `${revenues.length} encaissement${revenues.length > 1 ? "s" : ""}`
          }
          index={0}
        />
        <KpiCard
          label="Charges"
          value={opex}
          format="eur"
          accent="navy"
          icon={<Receipt />}
          trend={opexTrend}
          hint={
            expenses.length === 0
              ? "Aucune dépense saisie"
              : `${expenses.length} dépense${expenses.length > 1 ? "s" : ""} saisie${expenses.length > 1 ? "s" : ""}`
          }
          index={1}
        />
        <KpiCard
          label="Résultat net"
          value={netResult}
          format="eur"
          accent={netResult >= 0 ? "success" : "danger"}
          icon={<Scale />}
          trend={netTrend}
          hint={revenue > 0 ? `Marge ${margin} %` : "Aucun revenu sur la période"}
          index={2}
        />
        <KpiCard
          label="Reste à encaisser"
          value={outstanding}
          format="eur"
          accent="aqua"
          icon={<HandCoins />}
          hint={
            awaitingCount > 0
              ? `${awaitingCount} sortie${awaitingCount > 1 ? "s" : ""} à venir`
              : "Tout est encaissé"
          }
          href="/bookings"
          index={3}
        />
      </section>

      {/* ── 3. L'année, le journal, et la répartition de la période ──────
          Deux colonnes INDÉPENDANTES sur bureau : en grille à rangées, la
          carte « D'où vient l'argent » (trois lignes) s'étirait à la hauteur
          du graphique et montrait surtout du vide. Sur téléphone, les
          colonnes s'effacent (display: contents) et l'ordre devient : le
          graphique, les deux répartitions, puis le journal — le plus long
          en dernier. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
        <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-5">
          <Card className="rise order-1 lg:order-none">
            <CardHeader>
              <CardTitle>Chiffre d&apos;affaires et charges · {year}</CardTitle>
              <CardDescription>Mois par mois, depuis janvier</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-3 gap-3 sm:max-w-md">
                {[
                  { label: "Encaissé", value: caYear, dot: "bg-ocean" },
                  { label: "Dépensé", value: opexYear, dot: "bg-[#9fd0f7]" },
                  { label: "Résultat", value: caYear - opexYear, dot: null },
                ].map((s) => (
                  <div key={s.label} className="min-w-0">
                    <dt className="t-label flex items-center gap-1.5 text-ink-3">
                      {s.dot && <span aria-hidden className={cn("size-2 rounded-full", s.dot)} />}
                      {s.label}
                    </dt>
                    <dd className="mt-1">
                      <Num
                        className={cn(
                          "n-inline block truncate text-[15px] sm:text-[17px]",
                          s.dot === null && s.value < 0 ? "text-danger" : "text-foreground",
                        )}
                      >
                        {formatEur(s.value)}
                      </Num>
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 -mx-1">
                <TrendChart
                  data={monthly}
                  type="bar"
                  unit="eur"
                  a={{ name: "Chiffre d'affaires", color: "#2f7fe0" }}
                  b={{ name: "Charges", color: "#9fd0f7" }}
                  height={240}
                />
              </div>
            </CardContent>
          </Card>
          <Card className="rise order-4 lg:order-none">
            <CardHeader>
              <CardTitle>Opérations</CardTitle>
              <CardDescription>
                {ledger.length > 0
                  ? `${ledger.length} opération${ledger.length > 1 ? "s" : ""} ${periodShort}`
                  : `Rien d'enregistré ${periodShort}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionsLedger items={ledger} todayIso={todayIso} />
            </CardContent>
          </Card>
        </div>
        {/* Les répartitions restent à l'écran pendant qu'on parcourt le
            journal (sticky) : la colonne courte ne laisse plus un vide. */}
        <div className="contents lg:sticky lg:top-5 lg:col-span-5 lg:flex lg:flex-col lg:gap-5">
          <BreakdownCard
            className="order-2 lg:order-none"
            title="D'où vient l'argent"
            description={
              <>
                <Num>{formatEur(revenue)}</Num> {periodShort}
              </>
            }
            items={byRevenueType}
            tone="ocean"
            empty={{
              icon: <Wallet />,
              title: "Rien d'encaissé sur la période",
              text: "Les acomptes et les soldes des réservations apparaissent ici dès qu'ils sont payés.",
            }}
          />
          <BreakdownCard
            className="order-3 lg:order-none"
            title="Où part l'argent"
            description={
              <>
                <Num>{formatEur(opex)}</Num> de charges {periodShort}
              </>
            }
            items={byExpenseCategory}
            tone="navy"
            visible={7}
            empty={{
              icon: <CalendarClock />,
              title: "Aucune dépense sur la période",
              text: "Ajoute une dépense avec le bouton en haut de page : place de port, gasoil, entretien…",
            }}
          />
        </div>
      </div>
    </div>
  );
}
