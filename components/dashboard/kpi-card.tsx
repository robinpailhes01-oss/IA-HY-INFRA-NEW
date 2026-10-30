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
    <MotionCard index={index} className="h-full">
      <div
        className={cn(
          "group/kpi relative flex h-full flex-col overflow-hidden rounded-[20px] border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] p-4 backdrop-blur-[44px] backdrop-saturate-[1.85] sm:rounded-[22px] sm:p-5",
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

        {/* Le libellé et l'icône partagent la première ligne, le chiffre
            récupère ensuite TOUTE la largeur de la carte. Sur un iPhone, où
            deux cartes se partagent 390 px, c'est la différence entre un
            chiffre lisible et un chiffre coupé en deux.
            La hauteur minimale de deux lignes aligne les quatre chiffres entre
            eux ; au-delà de `lg` les libellés tiennent sur une ligne et la
            réserve n'a plus lieu d'être. */}
        <div className="relative flex items-start justify-between gap-2">
          <p className="t-label min-h-[2.5em] text-balance text-muted-foreground lg:min-h-0">
            {label}
          </p>
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-[10px] transition-transform duration-[400ms] [transition-timing-function:var(--ease-ios)] group-hover/kpi:scale-105 sm:size-9 sm:rounded-xl",
              CHIP[accent],
            )}
          >
            <Icon className="size-4 stroke-[1.7] sm:size-[17px]" />
          </span>
        </div>

        <AnimatedNumber
          value={value}
          format={format}
          className={cn(
            "relative mt-2.5 block text-foreground",
            primary ? "n-kpi-lead" : "n-kpi",
          )}
        />

        {/* Collé au bas de la carte : les précisions s'alignent entre elles
            même quand les libellés n'ont pas le même nombre de lignes. */}
        {delta ? (
          <span
            className={cn(
              "relative mt-auto inline-flex items-baseline gap-0.5 pt-2 text-[12px] font-medium",
              delta.positive ? "text-success" : "text-danger",
            )}
          >
            {delta.positive ? (
              <ArrowUpRight className="size-3.5 self-center" />
            ) : (
              <ArrowDownRight className="size-3.5 self-center" />
            )}
            {delta.value}
            {hint ? <span className="ml-1 font-normal text-muted-foreground">{hint}</span> : null}
          </span>
        ) : hint ? (
          <p className="t-caption relative mt-auto pt-2 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </MotionCard>
  );
}
