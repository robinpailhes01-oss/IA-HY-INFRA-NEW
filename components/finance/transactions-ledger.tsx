"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { PillGroup } from "@/components/finance/pill-group";
import { daysBetween, JOURS, MOIS_LONG, noonUtc } from "@/components/finance/fin-utils";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

// Le journal des opérations de la période, groupé par jour comme un relevé
// bancaire : on retrouve une ligne par sa date, pas en lisant chaque ligne.
//
// Le vert dit « ça rentre ». Une dépense reste à l'encre : sortir de
// l'argent n'est pas une alerte, c'est la vie d'une entreprise.

export type LedgerItem = {
  id: string;
  kind: "revenue" | "expense";
  date: string;
  label: string;
  note: string | null;
  amount: number;
};

type Filter = "all" | "revenue" | "expense";

const PAGE = 12;

function dayLabel(iso: string, todayIso: string): string {
  const diff = daysBetween(iso, todayIso);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  const d = noonUtc(iso);
  const sameYear = iso.slice(0, 4) === todayIso.slice(0, 4);
  const label = `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS_LONG[d.getUTCMonth()]}${sameYear ? "" : ` ${d.getUTCFullYear()}`}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function TransactionsLedger({ items, todayIso }: { items: LedgerItem[]; todayIso: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);

  const counts = useMemo(
    () => ({
      all: items.length,
      revenue: items.filter((i) => i.kind === "revenue").length,
      expense: items.filter((i) => i.kind === "expense").length,
    }),
    [items],
  );

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.kind === filter)),
    [items, filter],
  );
  const visible = filtered.slice(0, limit);

  // Regroupement par jour, dans l'ordre (les lignes arrivent déjà triées).
  const groups: Array<{ date: string; rows: LedgerItem[] }> = [];
  for (const row of visible) {
    const last = groups[groups.length - 1];
    if (last && last.date === row.date) last.rows.push(row);
    else groups.push({ date: row.date, rows: [row] });
  }

  if (items.length === 0) {
    return (
      <EmptyState icon={<Receipt />} title="Aucune opération sur cette période">
        Les revenus et les dépenses enregistrés apparaîtront ici, jour par jour.
      </EmptyState>
    );
  }

  return (
    <div>
      <PillGroup
        label="Sens des opérations"
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setLimit(PAGE);
        }}
        options={[
          { value: "all", label: "Tout", count: counts.all },
          { value: "revenue", label: "Rentrées", count: counts.revenue },
          { value: "expense", label: "Sorties", count: counts.expense },
        ]}
      />

      {filtered.length === 0 ? (
        <p className="t-body mt-4 rounded-[18px] bg-white/50 px-4 py-6 text-center text-ink-3">
          {filter === "revenue" ? "Aucune rentrée" : "Aucune sortie"} sur cette période.
        </p>
      ) : (
        <div className="mt-3">
          {groups.map((g) => {
            const net = g.rows.reduce((s, r) => s + (r.kind === "revenue" ? r.amount : -r.amount), 0);
            return (
              <section key={g.date} className="pt-3">
                <header className="flex items-baseline justify-between gap-3 pb-1">
                  <h3 className="t-label text-ink-3">{dayLabel(g.date, todayIso)}</h3>
                  {g.rows.length > 1 && (
                    <Num className="n-inline text-[12px] text-ink-3">
                      {`${net >= 0 ? "+" : "−"} ${formatEur(Math.abs(net))}`}
                    </Num>
                  )}
                </header>
                <ul>
                  {g.rows.map((tx) => {
                    const isRevenue = tx.kind === "revenue";
                    const Icon = isRevenue ? ArrowDownLeft : ArrowUpRight;
                    return (
                      <li
                        key={`${tx.kind}-${tx.id}`}
                        className="flex items-center gap-3 border-b border-[var(--hairline)] py-2.5 last:border-b-0"
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
                          <p className="truncate text-[14px] font-medium tracking-[-0.012em] text-foreground">
                            {tx.label}
                          </p>
                          <p className="truncate text-[12px] text-ink-3">
                            {tx.note ?? (isRevenue ? "Revenu" : "Dépense")}
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
              </section>
            );
          })}

          {filtered.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE * 2)}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-white/60 px-4 text-[13px] font-medium text-ink-2 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.06)] outline-none transition-colors hover:bg-white hover:text-foreground focus-visible:ring-4 focus-visible:ring-ocean/20 sm:h-10"
            >
              Afficher la suite · {filtered.length - limit} opération{filtered.length - limit > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
