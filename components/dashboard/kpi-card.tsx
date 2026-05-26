import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { cn } from "@/lib/utils";

type Accent = "gold" | "primary" | "success" | "info";

const ACCENT: Record<Accent, { chip: string; glow: string }> = {
  gold: { chip: "from-gold to-[#b8923a]", glow: "bg-gold/25" },
  primary: { chip: "from-[#2a5a8c] to-primary", glow: "bg-primary/20" },
  success: { chip: "from-success to-[#0e9f6e]", glow: "bg-success/20" },
  info: { chip: "from-info to-[#2563eb]", glow: "bg-info/25" },
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
      className="enter-up relative hover:-translate-y-1 hover:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_28px_56px_-20px_rgba(16,24,40,0.30)]"
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-10 -right-8 size-28 rounded-full opacity-70 blur-2xl transition-opacity duration-300 group-hover/card:opacity-100",
          a.glow,
        )}
      />
      <CardContent className="relative flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <AnimatedNumber
            value={value}
            format={format}
            className="text-[1.7rem] leading-tight font-semibold tracking-tight text-foreground"
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
            "flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm transition-transform duration-300 group-hover/card:scale-110",
            a.chip,
          )}
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}
