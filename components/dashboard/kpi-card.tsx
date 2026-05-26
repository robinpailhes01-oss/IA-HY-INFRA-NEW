import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { cn } from "@/lib/utils";

type Accent = "gold" | "primary" | "success" | "info";

const ACCENT: Record<Accent, { icon: string; bar: string }> = {
  gold: { icon: "bg-gold/12 text-gold ring-gold/20", bar: "from-gold/70" },
  primary: { icon: "bg-primary/10 text-primary ring-primary/20", bar: "from-primary/60" },
  success: { icon: "bg-success/12 text-success ring-success/20", bar: "from-success/60" },
  info: { icon: "bg-info/12 text-info ring-info/20", bar: "from-info/60" },
};

type KpiCardProps = {
  label: string;
  value: number;
  format?: "int" | "eur";
  icon: LucideIcon;
  accent?: Accent;
  delta?: { value: string; positive: boolean };
  hint?: string;
  index?: number;
};

export function KpiCard({
  label,
  value,
  format = "int",
  icon: Icon,
  accent = "primary",
  delta,
  hint,
  index = 0,
}: KpiCardProps) {
  const a = ACCENT[accent];
  return (
    <Card
      style={{ animationDelay: `${index * 70}ms` }}
      className="enter-up relative hover:-translate-y-1 hover:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-20px_rgba(16,24,40,0.28)]"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r to-transparent",
          a.bar,
        )}
      />
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <AnimatedNumber
            value={value}
            format={format}
            className="text-2xl font-semibold tracking-tight text-foreground"
          />
          {delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                delta.positive ? "text-success" : "text-danger",
              )}
            >
              {delta.positive ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <ArrowDownRight className="size-3.5" />
              )}
              {delta.value}
              {hint ? (
                <span className="ml-1 font-normal text-muted-foreground">{hint}</span>
              ) : null}
            </span>
          ) : hint ? (
            <span className="text-xs text-muted-foreground">{hint}</span>
          ) : null}
        </div>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-transform duration-300 group-hover/card:scale-110",
            a.icon,
          )}
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}
