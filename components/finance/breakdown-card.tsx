import { ChevronDown } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { pct } from "@/components/finance/fin-utils";

// La répartition d'un total : une ligne par poste, le montant, sa part, et
// un filet dont la longueur EST la part (pas une échelle relative au plus
// gros poste : la somme des filets fait 100 %, l'œil compare juste).
//
// Une seule teinte par carte — océan pour ce qui rentre, marine pour ce qui
// sort. Une palette arc-en-ciel ferait croire que chaque catégorie a un sens
// à elle ; ici seule la longueur compte.
//
// Au-delà de `visible` lignes, le reste se replie dans un <details> natif :
// zéro JavaScript, et la carte garde la hauteur de sa voisine.

export type BreakdownItem = { key: string; label: string; amount: number };

const TONE = {
  ocean: "bg-[linear-gradient(90deg,#2f7fe0,#7cc0f5)]",
  navy: "bg-[linear-gradient(90deg,#0b2545,#41648f)]",
} as const;

function Row({ item, total, tone }: { item: BreakdownItem; total: number; tone: keyof typeof TONE }) {
  const share = pct(item.amount, total);
  return (
    <li className="py-3 first:pt-1">
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium tracking-[-0.012em] text-foreground">
          {item.label}
        </span>
        <Num className="n-inline shrink-0 text-[14px] text-foreground">{formatEur(item.amount)}</Num>
        <span className="n-inline w-10 shrink-0 text-right text-[12.5px] text-ink-3">{share} %</span>
      </div>
      <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(11,37,69,0.05)]">
        <div
          className={cn("h-full rounded-full", TONE[tone])}
          style={{ width: `${Math.max(share, 1.5)}%` }}
        />
      </div>
    </li>
  );
}

export function BreakdownCard({
  title,
  description,
  items,
  tone,
  empty,
  action,
  visible = 6,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  items: BreakdownItem[];
  tone: keyof typeof TONE;
  empty: { icon: React.ReactNode; title: string; text: string };
  action?: React.ReactNode;
  visible?: number;
  className?: string;
}) {
  const total = items.reduce((s, i) => s + i.amount, 0);
  const shown = items.slice(0, visible);
  const rest = items.slice(visible);

  return (
    <Card className={cn("rise", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="flex-1">
        {items.length === 0 ? (
          <EmptyState icon={empty.icon} title={empty.title} className="h-full">
            {empty.text}
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-[var(--hairline)]">
              {shown.map((i) => (
                <Row key={i.key} item={i} total={total} tone={tone} />
              ))}
            </ul>
            {rest.length > 0 && (
              <details className="group/more">
                <summary className="mt-2 inline-flex h-11 cursor-pointer list-none items-center gap-1.5 rounded-full bg-white/60 px-4 text-[13px] font-medium text-ink-2 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.06)] outline-none transition-colors hover:bg-white hover:text-foreground focus-visible:ring-4 focus-visible:ring-ocean/20 sm:h-9 [&::-webkit-details-marker]:hidden">
                  <span className="group-open/more:hidden">
                    {rest.length} autre{rest.length > 1 ? "s" : ""} ·{" "}
                    <Num>{formatEur(rest.reduce((s, i) => s + i.amount, 0))}</Num>
                  </span>
                  <span className="hidden group-open/more:inline">Replier</span>
                  <ChevronDown className="size-3.5 transition-transform group-open/more:rotate-180" />
                </summary>
                <ul className="mt-1 divide-y divide-[var(--hairline)]">
                  {rest.map((i) => (
                    <Row key={i.key} item={i} total={total} tone={tone} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
