import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { MotionCard } from "@/components/dashboard/motion-card";
import { cn } from "@/lib/utils";

// Trois lignes, rien d'autre : étiquette, chiffre, précision.
//
// L'icône a été retirée. C'était une décoration — elle ne distinguait rien
// (quatre cartes, quatre icônes différentes, aucune information en plus) et
// elle coûtait un tiers de la largeur sur un iPhone, ce qui écrasait le
// chiffre qu'on vient précisément lire. Aucun des tableaux de bord pris en
// référence n'en met. La carte est plus calme et le chiffre plus grand.
//
// Composant SERVEUR : l'animation vit dans MotionCard, qui ne reçoit que des
// enfants déjà rendus.

type Accent = "gold" | "primary" | "success" | "info";

// L'accent ne colore plus un bloc d'icône mais le filet et le fond de la carte
// principale. Une seule carte par écran y a droit.
const HALO: Record<Accent, string> = {
  gold: "border-gold/30 bg-gold/[0.055]",
  primary: "border-info/30 bg-info/[0.055]",
  success: "border-success/30 bg-success/[0.055]",
  info: "border-info/30 bg-info/[0.055]",
};

type KpiCardProps = {
  label: string;
  value: number;
  format?: "int" | "eur";
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
          "group/kpi relative flex h-full flex-col rounded-[18px] border-[0.5px] p-4 transition-colors duration-200 sm:p-5",
          primary
            ? HALO[accent]
            : "border-[var(--hairline)] bg-[var(--plaque)] hover:border-[var(--highlight)]",
        )}
      >
        <p className="t-label text-muted-foreground">{label}</p>

        <AnimatedNumber
          value={value}
          format={format}
          className={cn("mt-3 block text-foreground", primary ? "n-kpi-lead" : "n-kpi")}
        />

        {/* Collé au bas de la carte : les précisions s'alignent entre elles
            même quand les étiquettes n'ont pas le même nombre de lignes. */}
        {delta ? (
          <span
            className={cn(
              "pastille mt-auto self-start",
              delta.positive ? "bg-success/12 text-success" : "bg-danger/12 text-danger",
            )}
          >
            {delta.positive ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {delta.value}
            {hint ? <span className="text-muted-foreground">{hint}</span> : null}
          </span>
        ) : hint ? (
          <p className="t-caption mt-auto pt-2.5 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </MotionCard>
  );
}
