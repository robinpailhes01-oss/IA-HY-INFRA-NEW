import { Num } from "@/components/ui/num";
import { formatEur } from "@/lib/format";
import { decimal } from "@/components/finance/fin-utils";
import { cn } from "@/lib/utils";

// Ce qui va rentrer, semaine par semaine — des capsules avec leur montant
// AU-DESSUS, toujours visible : sur téléphone il n'y a pas de survol, et
// c'est précisément le chiffre qu'on vient lire.
//
// Composant serveur, CSS pur. La semaine la plus chargée passe au marine.

/** 840 → « 840 € », 1 260 → « 1,3 k€ » : court, sans « 840,0 € ». */
function compact(v: number): string {
  return v >= 1000 ? `${decimal(v / 1000)} k€` : formatEur(v);
}

export function WeekBars({
  weeks,
  className,
}: {
  weeks: Array<{ label: string; amount: number; count: number }>;
  className?: string;
}) {
  const max = Math.max(...weeks.map((w) => w.amount), 1);
  const peak = weeks.reduce((best, w, i) => (w.amount > weeks[best].amount ? i : best), 0);

  return (
    <div className={cn("flex h-44 items-end gap-2 sm:gap-3", className)}>
      {weeks.map((w, i) => {
        const h = w.amount > 0 ? Math.max(8, (w.amount / max) * 100) : 0;
        const isPeak = i === peak && w.amount > 0;
        return (
          <div key={w.label} className="flex h-full min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full flex-1 flex-col items-center justify-end">
              <Num
                className={cn(
                  "n-inline mb-1.5 whitespace-nowrap text-[11px]",
                  w.amount > 0 ? (isPeak ? "text-navy" : "text-ink-2") : "text-ink-3/60",
                )}
              >
                {w.amount > 0 ? compact(w.amount) : "—"}
              </Num>
              <span
                aria-hidden
                className={cn(
                  "animate-grow block w-full max-w-9 rounded-full",
                  w.amount === 0 && "h-1.5 bg-[rgba(11,37,69,0.06)]",
                  w.amount > 0 &&
                    (isPeak
                      ? "bg-[linear-gradient(180deg,#2f7fe0,#0b2545)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_12px_26px_-8px_rgba(47,127,224,0.6)]"
                      : "bg-[linear-gradient(180deg,#bfe0fa,#8cc4f0)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"),
                )}
                style={w.amount > 0 ? { height: `${h}%`, animationDelay: `${80 + i * 50}ms` } : undefined}
              />
            </div>
            <span className="mt-2 whitespace-nowrap text-[11px] font-medium text-ink-3">{w.label}</span>
            <span className="sr-only">
              {w.count} sortie{w.count > 1 ? "s" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
