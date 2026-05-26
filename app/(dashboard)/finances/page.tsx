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
import { formatEur } from "@/lib/format";
import { PAYMENT_METHODS, parsePayments } from "@/lib/payments";
import { cn } from "@/lib/utils";

const CONFIRMED = new Set(["confirmed", "completed"]);

const EXPENSE_LABELS: Record<string, string> = {
  port: "Place de port",
  insurance: "Assurance",
  fuel: "Carburant",
  cleaning: "Nettoyage",
  maintenance: "Entretien",
  advertising_meta: "Publicité Meta",
  advertising_tiktok: "Publicité TikTok",
  food_options: "Restauration & options",
  equipment: "Équipement",
  salary_bonus: "Primes équipage",
  other: "Autre",
};

type BookingFin = {
  total_amount: number | null;
  costs: number | null;
  net_margin: number | null;
  status: string | null;
  deposit_amount: number | null;
  deposit_paid: boolean | null;
  balance_payments: unknown;
};

type ExpenseRow = { category: string; amount: number };

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export default async function FinancesPage() {
  const supabase = await createClient();

  const [bookingsRes, expensesRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "total_amount, costs, net_margin, status, deposit_amount, deposit_paid, balance_payments",
      )
      .returns<BookingFin[]>(),
    supabase.from("expenses").select("category, amount").returns<ExpenseRow[]>(),
  ]);

  const confirmed = (bookingsRes.data ?? []).filter((b) =>
    CONFIRMED.has(b.status ?? ""),
  );
  const revenue = confirmed.reduce((s, b) => s + (b.total_amount ?? 0), 0);
  const directCosts = confirmed.reduce((s, b) => s + (b.costs ?? 0), 0);
  const grossMargin = confirmed.reduce((s, b) => s + (b.net_margin ?? 0), 0);

  const expenses = expensesRes.data ?? [];
  const opex = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);
  const netResult = grossMargin - opex;

  const byCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + (e.amount ?? 0);
      return acc;
    }, {}),
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const maxCategory = byCategory[0]?.amount ?? 1;

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
    { label: "Coûts directs", value: directCosts, color: "bg-slate-400" },
    { label: "Dépenses opé.", value: opex, color: "bg-warning" },
    { label: "Résultat net", value: Math.max(netResult, 0), color: "bg-success" },
  ];

  return (
    <div className="space-y-6">
      <header className="enter-up space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Finances
        </h1>
        <p className="text-sm text-muted-foreground">
          Saison été 2026 · résultat sur le chiffre d&apos;affaires confirmé
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="CA confirmé" value={revenue} format="eur" icon={Euro} accent="primary" index={0} />
        <KpiCard
          label="Marge brute"
          value={grossMargin}
          format="eur"
          icon={TrendingUp}
          accent="success"
          hint={`${pct(grossMargin, revenue)}% du CA`}
          index={1}
        />
        <KpiCard label="Dépenses" value={opex} format="eur" icon={Receipt} accent="info" index={2} />
        <KpiCard
          label="Résultat net"
          value={netResult}
          format="eur"
          icon={PiggyBank}
          accent="gold"
          hint={`${pct(netResult, revenue)}% du CA`}
          index={3}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="enter-up lg:col-span-3" style={{ animationDelay: "280ms" }}>
          <CardHeader>
            <CardTitle>Compte de résultat</CardTitle>
            <CardDescription>Du chiffre d&apos;affaires au résultat net</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="divide-y divide-border text-sm">
              <PnlRow label="Chiffre d'affaires confirmé" amount={revenue} sign="+" />
              <PnlRow label="Coûts directs des sorties" amount={-directCosts} sign="−" />
              <PnlRow label="Marge brute" amount={grossMargin} emphasis tone="success" />
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
            <CardTitle>Dépenses par catégorie</CardTitle>
            <CardDescription>Total {formatEur(opex)}</CardDescription>
            <CardAction>
              <AddExpenseDialog />
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {byCategory.map((c) => (
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
                      style={{ width: `${pct(c.amount, maxCategory)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="enter-up" style={{ animationDelay: "440ms" }}>
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
