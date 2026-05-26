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
          <div key={i} className="group/bar flex flex-1 flex-col items-center gap-2">
            <div className="flex min-h-0 w-full flex-1 items-end" title={formatEur(value)}>
              <div
                className={cn(
                  "animate-grow w-full rounded-md bg-gradient-to-t transition-[filter] duration-200 group-hover/bar:brightness-105",
                  value === 0
                    ? "from-border to-border"
                    : isCurrent
                      ? "from-gold/80 to-gold shadow-[0_4px_12px_-4px_rgba(201,168,76,0.6)]"
                      : "from-primary/10 to-primary/30",
                )}
                style={{
                  height: value === 0 ? "3px" : `${Math.max(heightPct, 5)}%`,
                  animationDelay: `${i * 45}ms`,
                }}
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
