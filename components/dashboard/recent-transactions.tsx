import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
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
  efoil: "E-foil",
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

// Les derniers mouvements saisis. Une entrée d'argent est verte (c'est un
// sens : ça rentre) ; une dépense reste à l'encre — sortir de l'argent n'est
// pas une alerte, c'est la vie d'une entreprise.
//
// `columns` : sur grand écran, la liste se répartit en deux colonnes pour ne
// pas dérouler huit lignes sur toute la largeur.
export function RecentTransactions({
  transactions,
  columns = 1,
}: {
  transactions: Transaction[];
  columns?: 1 | 2;
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState icon={<Receipt />} title="Aucun mouvement récent">
        Les revenus et dépenses enregistrés apparaîtront ici.
      </EmptyState>
    );
  }

  return (
    <ul
      className={cn(
        "grid grid-cols-1",
        // En deux colonnes (le cockpit) : cinq lignes suffisent sur téléphone.
        columns === 2 &&
          "lg:grid-cols-2 lg:gap-x-10 max-lg:[&>li:nth-child(5)]:border-b-0 max-lg:[&>li:nth-child(n+6)]:hidden",
      )}
    >
      {transactions.map((tx) => {
        const isRevenue = tx.kind === "revenue";
        const Icon = isRevenue ? ArrowDownLeft : ArrowUpRight;
        return (
          <li
            key={tx.id}
            className="flex items-center gap-3 border-b border-[var(--hairline)] py-3 last:border-b-0 lg:[&:nth-last-child(2)]:border-b-0"
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full",
                isRevenue ? "bg-[rgba(15,159,110,0.1)] text-success" : "bg-[rgba(11,37,69,0.06)] text-ink-2",
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium tracking-[-0.012em] text-foreground">{tx.label}</p>
              <p className="truncate text-[12px] text-ink-3">
                {tx.description ?? (isRevenue ? "Revenu" : "Dépense")}
                {tx.date ? ` · ${formatDateRelative(tx.date)}` : ""}
              </p>
            </div>
            <Num
              className={cn(
                "n-inline shrink-0 text-[14px]",
                isRevenue ? "text-success" : "text-foreground",
              )}
            >
              {`${isRevenue ? "+" : "−"} ${formatEur(tx.amount)}`}
            </Num>
          </li>
        );
      })}
    </ul>
  );
}
