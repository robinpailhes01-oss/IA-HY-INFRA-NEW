import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDateRelative, formatEur } from "@/lib/format";

const EXPENSE_LABELS: Record<string, string> = {
  subscription: "Abonnement",
  marketing: "Marketing",
  fuel: "Gasoil",
  maintenance: "Entretien",
  tools: "Outils",
  subcontract: "Sous-traitance",
  fixed_monthly: "Mensualité fixe",
  salary: "Salaire",
  taxes: "Taxes",
  savings: "Épargne",
  other: "Autre",
};

const REVENUE_LABELS: Record<string, string> = {
  sea_trip: "Sortie en mer",
  unusual_night: "Nuit insolite",
  other: "Autre",
};

export type Transaction = {
  id: string;
  kind: "revenue" | "expense";
  amount: number;
  date: string;
  label: string;
  description: string | null;
};

export function mergeTransactions(
  revenues: Array<{ id: string; amount: number | null; date: string; type: string | null; note: string | null }>,
  expenses: Array<{ id: string; amount: number | null; date: string; category: string | null; description: string | null }>,
  limit = 8,
): Transaction[] {
  const merged: Transaction[] = [
    ...revenues.map<Transaction>((r) => ({
      id: `r-${r.id}`,
      kind: "revenue",
      amount: r.amount ?? 0,
      date: r.date,
      label: REVENUE_LABELS[r.type ?? ""] ?? r.type ?? "Revenu",
      description: r.note,
    })),
    ...expenses.map<Transaction>((e) => ({
      id: `e-${e.id}`,
      kind: "expense",
      amount: e.amount ?? 0,
      date: e.date,
      label: EXPENSE_LABELS[e.category ?? ""] ?? e.category ?? "Dépense",
      description: e.description,
    })),
  ];
  merged.sort((a, b) => b.date.localeCompare(a.date));
  return merged.slice(0, limit);
}

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
        <Receipt className="size-6 text-muted-foreground/60" />
        Aucune transaction récente.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {transactions.map((tx) => {
        const isRevenue = tx.kind === "revenue";
        const Icon = isRevenue ? ArrowDownLeft : ArrowUpRight;
        return (
          <li
            key={tx.id}
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                isRevenue ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{tx.label}</p>
              <p className="truncate text-xs text-muted-foreground">
                {tx.description ?? (isRevenue ? "Revenu" : "Dépense")}
                {tx.date ? ` · ${formatDateRelative(tx.date)}` : ""}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums",
                isRevenue ? "text-success" : "text-warning",
              )}
            >
              {isRevenue ? "+" : "−"} {formatEur(tx.amount)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
