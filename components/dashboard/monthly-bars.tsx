import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function MonthlyBars({
  values,
  currentMonth,
}: {
  values: number[];
  currentMonth: number;
}) {
  const max = Math.max(...values, 1);

  return (
    <div className="flex h-44 items-stretch gap-1.5">
      {values.map((value, i) => {
        const isCurrent = i === currentMonth;
        const heightPct = Math.round((value / max) * 100);
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex min-h-0 w-full flex-1 items-end" title={formatEur(value)}>
              <div
                className={cn(
                  "w-full rounded-md transition-[height] duration-700 ease-out",
                  value === 0 ? "bg-border" : isCurrent ? "bg-gold" : "bg-primary/15",
                )}
                style={{ height: value === 0 ? "3px" : `${Math.max(heightPct, 5)}%` }}
              />
            </div>
            <span
              className={cn(
                "text-[10px]",
                isCurrent ? "font-semibold text-gold" : "text-muted-foreground",
              )}
            >
              {MONTHS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
