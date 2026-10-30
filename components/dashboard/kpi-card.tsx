import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { MotionCard } from "@/components/dashboard/motion-card";
import { cn } from "@/lib/utils";

// Trois lignes, rien d'autre : étiquette, chiffre, précision.
//
// Pas d'icône. Elle ne distinguait rien — quatre cartes, quatre icônes, aucune
// information en plus — et mangeait un tiers de la largeur sur iPhone, ce qui
// écrasait le chiffre qu'on vient précisément lire.
//
// Ce qui distingue les cartes, c'est maintenant LA COULEUR. Chacune porte la
// sienne : un halo diffus dans l'angle, un filet teinté, le chiffre lui-même.
// Quatre plaques de verre identiques se fondaient en un bloc gris ; quatre
// plaques teintées se lisent d'un coup d'œil.
//
// Composant SERVEUR : l'animation vit dans MotionCard, qui ne reçoit que des
// enfants déjà rendus.

type Accent = "gold" | "aqua" | "indigo" | "success" | "info" | "primary";

type Teinte = { halo: string; filet: string; chiffre: string };

const TEINTE: Record<Accent, Teinte> = {
  aqua: {
    halo: "bg-[radial-gradient(14rem_9rem_at_100%_0%,rgba(63,200,216,0.30),transparent_68%)]",
    filet: "border-[rgba(63,200,216,0.30)]",
    chiffre: "text-[#9BE9F2]",
  },
  indigo: {
    halo: "bg-[radial-gradient(14rem_9rem_at_100%_0%,rgba(123,139,255,0.30),transparent_68%)]",
    filet: "border-[rgba(123,139,255,0.30)]",
    chiffre: "text-[#BFC7FF]",
  },
  success: {
    halo: "bg-[radial-gradient(14rem_9rem_at_100%_0%,rgba(47,214,142,0.26),transparent_68%)]",
    filet: "border-[rgba(47,214,142,0.28)]",
    chiffre: "text-[#9BEFC9]",
  },
  gold: {
    halo: "bg-[radial-gradient(14rem_9rem_at_100%_0%,rgba(232,192,99,0.32),transparent_68%)]",
    filet: "border-[rgba(232,192,99,0.34)]",
    chiffre: "text-[#F4DFA8]",
  },
  info: {
    halo: "bg-[radial-gradient(14rem_9rem_at_100%_0%,rgba(74,125,255,0.28),transparent_68%)]",
    filet: "border-[rgba(74,125,255,0.30)]",
    chiffre: "text-[#B6C8FF]",
  },
  primary: {
    halo: "bg-[radial-gradient(14rem_9rem_at_100%_0%,rgba(74,125,255,0.28),transparent_68%)]",
    filet: "border-[rgba(74,125,255,0.30)]",
    chiffre: "text-[#B6C8FF]",
  },
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
  accent = "info",
  delta,
  hint,
  index = 0,
  primary = false,
}: KpiCardProps) {
  const teinte = TEINTE[accent];

  return (
    <MotionCard index={index} className="h-full">
      <div
        className={cn(
          "vitre group/kpi relative flex h-full flex-col rounded-[18px] p-4 transition-[border-color] duration-300 sm:p-5",
          teinte.filet,
        )}
      >
        {/* Le halo coloré dans l'angle opposé à la source lumineuse : la carte
            a une teinte propre sans que le fond devienne un aplat de couleur. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 opacity-80 transition-opacity duration-500 group-hover/kpi:opacity-100",
            teinte.halo,
          )}
        />

        <p className="t-label relative text-muted-foreground">{label}</p>

        <AnimatedNumber
          value={value}
          format={format}
          className={cn(
            "relative mt-3 block",
            primary ? "n-kpi-lead" : "n-kpi",
            // Seule la carte principale prend la couleur pleine ; les autres
            // restent blanches pour que la hiérarchie tienne.
            primary ? teinte.chiffre : "text-foreground",
          )}
        />

        {/* Collé au bas de la carte : les précisions s'alignent entre elles
            même quand les étiquettes n'ont pas le même nombre de lignes. */}
        {delta ? (
          <span
            className={cn(
              "pastille relative mt-auto self-start",
              delta.positive ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
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
          <p className="t-caption relative mt-auto pt-2.5 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </MotionCard>
  );
}
