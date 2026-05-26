import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Accent = "gold" | "primary" | "success" | "info";

const ACCENT_CLASSES: Record<Accent, string> = {
  gold: "bg-gold/10 text-gold",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
};

type KpiCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: Accent;
  delta?: { value: string; positive: boolean };
  hint?: string;
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent = "primary",
  delta,
  hint,
}: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </span>
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
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            ACCENT_CLASSES[accent],
          )}
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}
