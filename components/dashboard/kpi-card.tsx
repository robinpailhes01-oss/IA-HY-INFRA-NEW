import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { cn } from "@/lib/utils";

type Accent = "gold" | "primary" | "success" | "info";

const CHIP: Record<Accent, string> = {
  gold: "bg-gold/10 text-gold",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
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
  return (
    <Card
      style={{ animationDelay: `${index * 70}ms` }}
      className="enter-up hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_18px_40px_-24px_rgba(16,24,40,0.22)]"
    >
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
          <AnimatedNumber
            value={value}
            format={format}
            className="text-[1.6rem] leading-none font-semibold tracking-tight text-foreground"
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
            "flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover/card:scale-105",
            CHIP[accent],
          )}
        >
          <Icon className="size-[18px]" />
        </span>
      </CardContent>
    </Card>
  );
}
