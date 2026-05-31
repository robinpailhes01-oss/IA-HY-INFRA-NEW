import { Euro, PiggyBank, Receipt, TrendingUp } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AddExpenseDialog } from "@/components/finances/add-expense-dialog";
import { AddRevenueDialog } from "@/components/finances/add-revenue-dialog";
import { PeriodFilter } from "@/components/finances/period-filter";
import { formatEur, formatDateLong } from "@/lib/format";
import { PAYMENT_METHODS, parsePayments } from "@/lib/payments";
import { cn } from "@/lib/utils";

const EXPENSE_LABELS: Record<string, string> = {
  subscription: "Abonnement",
  marketing: "Marketing",
  fuel: "Gasoil",
  maintenance: "Entretien",
  tools: "Outils",
  subcontract: "Sous traitance",
  fixed_monthly: "Mensualité fixe",
  salary: "Salaire",
  taxes: "Taxes",
  savings: "Épargne",
  other: "Autre",
};

const REVENUE_LABELS: Record<string, string> = {
  sea_trip: "Sorties en mer",
  unusual_night: "Nuits insolites",
  other: "Autre",
};

type BookingFin = {
  status: string | null;
  deposit_amount: number | null;
  deposit_paid: boolean | null;
  balance_payments: unknown;
};

type ExpenseRow = { category: string; amount: number };
type RevenueRow = { type: string; amount: number };

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function currentMonthBounds(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  return {
    from: `${y}-${pad2(m + 1)}-01`,
    to: `${y}-${pad2(m + 1)}-${pad2(last)}`,
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

  const supabase = await createClient();

  const [bookingsRes, expensesRes, revenuesRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("status, deposit_amount, deposit_paid, balance_payments")
      .gte("date", from)
      .lte("date", to)
      .returns<BookingFin[]>(),
    supabase
      .from("expenses")
      .select("category, amount")
      .gte("date", from)
      .lte("date", to)
      .returns<ExpenseRow[]>(),
    supabase
      .from("revenues")
      .select("type, amount")
      .gte("date", from)
      .lte("date", to)
      .returns<RevenueRow[]>(),
  ]);

  const revenues = revenuesRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  const revenue = revenues.reduce((s, r) => s + (r.amount ?? 0), 0);
  const opex = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);
  const netResult = revenue - opex;

  const byExpenseCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + (e.amount ?? 0);
      return acc;
    }, {}),
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const maxExpense = byExpenseCategory[0]?.amount ?? 1;

  const byRevenueType = Object.entries(
    revenues.reduce<Record<string, number>>((acc, r) => {
      acc[r.type] = (acc[r.type] ?? 0) + (r.amount ?? 0);
      return acc;
    }, {}),
  )
    .map(([type, amount]) => ({ type, amount }))
    .sort((a, b) => b.amount - a.amount);
  const maxRevenue = byRevenueType[0]?.amount ?? 1;

  const allBookings = bookingsRes.data ?? [];
  const encByMethod: Record<string, number> = {};
  let totalEncaisse = 0;
  for (const b of allBookings) {
    if (b.status === "cancelled") continue;
    if (b.deposit_paid) {
      encByMethod.virement = (encByMethod.virement ?? 0) + (b.deposit_amount ?? 0);
      totalEncaisse += b.deposit_amount ?? 0;
    }
    for (const p of parsePayments(b.balance_payments)) {
      encByMethod[p.method] = (encByMethod[p.method] ?? 0) + p.amount;
      totalEncaisse += p.amount;
    }
  }
  const encList = PAYMENT_METHODS.map((m) => ({
    label: m.label,
    amount: encByMethod[m.value] ?? 0,
  }));
  const maxEnc = Math.max(...encList.map((e) => e.amount), 1);

  const segments = [
    { label: "Dépenses opé.", value: opex, color: "bg-warning" },
    { label: "Résultat net", value: Math.max(netResult, 0), color: "bg-success" },
  ];

  return (
    <div className="space-y-6">
      <header className="enter-up space-y-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Finances
          </h1>
          <p className="text-sm text-muted-foreground">
            Période · {formatDateLong(from)} → {formatDateLong(to)}
          </p>
        </div>
        <PeriodFilter from={from} to={to} />
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Revenus" value={revenue} format="eur" icon={Euro} accent="primary" index={0} />
        <KpiCard
          label="Dépenses"
          value={opex}
          format="eur"
          icon={Receipt}
          accent="info"
          index={1}
        />
        <KpiCard
          label="Résultat net"
          value={netResult}
          format="eur"
          icon={PiggyBank}
          accent={netResult >= 0 ? "success" : "gold"}
          hint={`${pct(netResult, revenue)}% des revenus`}
          index={2}
        />
        <KpiCard
          label="Marge"
          value={pct(netResult, revenue)}
          format="int"
          icon={TrendingUp}
          accent="gold"
          hint="% Résultat / Revenus"
          index={3}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="enter-up lg:col-span-3" style={{ animationDelay: "280ms" }}>
          <CardHeader>
            <CardTitle>Compte de résultat</CardTitle>
            <CardDescription>Des revenus au résultat net</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="divide-y divide-border text-sm">
              <PnlRow label="Revenus" amount={revenue} sign="+" />
              <PnlRow label="Dépenses opérationnelles" amount={-opex} sign="−" />
              <PnlRow
                label="Résultat net"
                amount={netResult}
                emphasis
                tone={netResult >= 0 ? "success" : "danger"}
              />
            </dl>

            <div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
                {segments.map((s) => (
                  <div
                    key={s.label}
                    className={cn("h-full", s.color)}
                    style={{ width: `${pct(s.value, revenue)}%` }}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {segments.map((s) => (
                  <span key={s.label} className="inline-flex items-center gap-1.5">
                    <span className={cn("size-2 rounded-full", s.color)} />
                    {s.label} · {formatEur(s.value)}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="enter-up lg:col-span-2" style={{ animationDelay: "360ms" }}>
          <CardHeader>
            <CardTitle>Revenus par type</CardTitle>
            <CardDescription>Total {formatEur(revenue)}</CardDescription>
            <CardAction>
              <AddRevenueDialog />
            </CardAction>
          </CardHeader>
          <CardContent>
            {byRevenueType.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun revenu enregistré.</p>
            ) : (
              <ul className="space-y-3">
                {byRevenueType.map((r) => (
                  <li key={r.type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {REVENUE_LABELS[r.type] ?? r.type}
                      </span>
                      <span className="font-medium text-foreground">{formatEur(r.amount)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-success/70"
                        style={{ width: `${pct(r.amount, maxRevenue)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="enter-up" style={{ animationDelay: "440ms" }}>
        <CardHeader>
          <CardTitle>Dépenses par catégorie</CardTitle>
          <CardDescription>Total {formatEur(opex)}</CardDescription>
          <CardAction>
            <AddExpenseDialog />
          </CardAction>
        </CardHeader>
        <CardContent>
          {byExpenseCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune dépense enregistrée.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              {byExpenseCategory.map((c) => (
                <li key={c.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {EXPENSE_LABELS[c.category] ?? c.category}
                    </span>
                    <span className="font-medium text-foreground">{formatEur(c.amount)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gold/70"
                      style={{ width: `${pct(c.amount, maxExpense)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {totalEncaisse > 0 && (
        <Card className="enter-up" style={{ animationDelay: "520ms" }}>
          <CardHeader>
            <CardTitle>Encaissements par moyen de paiement</CardTitle>
            <CardDescription>
              Total perçu {formatEur(totalEncaisse)} · l&apos;acompte du site est compté en virement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {encList.map((e) => (
                <div key={e.label} className="space-y-2">
                  <span className="text-[13px] font-medium text-muted-foreground">
                    {e.label}
                  </span>
                  <div className="text-xl font-semibold tracking-tight text-foreground">
                    {formatEur(e.amount)}
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary/40"
                      style={{ width: `${pct(e.amount, maxEnc)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PnlRow({
  label,
  amount,
  sign,
  emphasis,
  tone,
}: {
  label: string;
  amount: number;
  sign?: "+" | "−";
  emphasis?: boolean;
  tone?: "success" | "danger";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt
        className={cn(
          "text-muted-foreground",
          emphasis && "font-semibold text-foreground",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "font-medium tabular-nums",
          emphasis ? cn("text-base font-semibold", toneClass) : "text-foreground",
        )}
      >
        {sign === "−"
          ? `− ${formatEur(Math.abs(amount))}`
          : sign === "+"
            ? `+ ${formatEur(amount)}`
            : formatEur(amount)}
      </dd>
    </div>
  );
}
