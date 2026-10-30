import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { MotionCard } from "@/components/dashboard/motion-card";
import { cn } from "@/lib/utils";

// Composant SERVEUR : c'est ce qui permet aux pages de passer `icon={Ship}`.
// Un composant Lucide n'est pas sérialisable et ne peut pas traverser la
// frontière serveur/client — l'animation vit donc dans MotionCard, qui ne
// reçoit que des enfants déjà rendus.

type Accent = "gold" | "primary" | "success" | "info";

const CHIP: Record<Accent, string> = {
  gold: "bg-gold/12 text-gold",
  primary: "bg-info/12 text-info",
  success: "bg-success/12 text-success",
  info: "bg-info/12 text-info",
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
  /** Un seul par écran : la carte prend plus de présence que ses voisines. */
  primary?: boolean;
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
  primary = false,
}: KpiCardProps) {
  return (
    <MotionCard index={index}>
      <div
        className={cn(
          "group/kpi relative overflow-hidden rounded-[22px] border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] p-5 backdrop-blur-[44px] backdrop-saturate-[1.85]",
          "shadow-[0_0.5px_0_var(--highlight)_inset,0_1px_2px_rgba(0,0,0,0.3),0_26px_56px_-30px_rgba(0,0,0,0.75)]",
        )}
      >
        {/* Halo doré réservé à la carte principale : ailleurs il deviendrait
            une décoration au lieu d'un signal. */}
        {primary && (
          <span
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 size-44 rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.22),transparent_68%)] opacity-70 transition-opacity duration-500 group-hover/kpi:opacity-100"
          />
        )}

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
            <AnimatedNumber
              value={value}
              format={format}
              className={cn(
                "numeric mt-2 block font-bold text-foreground",
                primary ? "text-[2.4rem] leading-none" : "text-[2rem] leading-none",
              )}
            />
            {delta ? (
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-0.5 font-mono text-[12.5px] font-medium",
                  delta.positive ? "text-success" : "text-danger",
                )}
              >
                {delta.positive ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {delta.value}
                {hint ? <span className="ml-1 font-sans text-muted-foreground">{hint}</span> : null}
              </span>
            ) : hint ? (
              <p className="mt-2 font-mono text-[12px] text-muted-foreground">{hint}</p>
            ) : null}
          </div>

          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-[13px] transition-transform duration-[400ms] [transition-timing-function:var(--ease-ios)] group-hover/kpi:scale-105",
              CHIP[accent],
            )}
          >
            <Icon className="size-[18px] stroke-[1.7]" />
          </span>
        </div>
      </div>
    </MotionCard>
  );
}
