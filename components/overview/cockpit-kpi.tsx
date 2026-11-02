import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { MotionCard } from "@/components/dashboard/motion-card";
import { MiniBars, TrendLine } from "@/components/overview/trend-line";
import { cn } from "@/lib/utils";

// La tuile chiffre du cockpit. Même matière, mêmes teintes que <KpiCard>,
// mais une composition VERTICALE à toutes les largeurs : pastille d'icône,
// libellé, chiffre, puis la tendance sur toute la largeur en bas — la rangée
// d'ouverture du cockpit veut des courbes qui se lisent, pas des vignettes.
//
// Ce que KpiCard ne fait pas et qui justifie cette variante :
// - le cas « pas de donnée » (Qonto non relié) : on dit ce qui manque au lieu
//   d'afficher un 0 € qui ressemblerait à un compte vide ;
// - les capsules (semaines à venir) en plus de la courbe ;
// - une précision qui contient un montant (« dont 1 830 € en novembre ») :
//   elle passe par <Num>, donc en élément, pas en chaîne.
//
// Composant SERVEUR : l'animation reste dans MotionCard / AnimatedNumber, qui
// ne reçoivent que des valeurs sérialisables et des enfants déjà rendus.

export type CockpitAccent = "navy" | "ocean" | "indigo" | "aqua";

const TEINTE: Record<CockpitAccent, { chip: string; line: string; soft: string }> = {
  navy: { chip: "bg-[rgba(11,37,69,0.08)] text-navy", line: "#1f5aa6", soft: "rgba(31,90,166,0.28)" },
  ocean: { chip: "bg-[rgba(47,127,224,0.1)] text-ocean", line: "#2f7fe0", soft: "rgba(47,127,224,0.28)" },
  indigo: { chip: "bg-[rgba(109,124,242,0.12)] text-indigo", line: "#6d7cf2", soft: "rgba(109,124,242,0.3)" },
  aqua: { chip: "bg-[rgba(34,167,191,0.12)] text-aqua", line: "#22a7bf", soft: "rgba(34,167,191,0.3)" },
};

export function CockpitKpi({
  label,
  icon,
  accent = "ocean",
  value,
  format = "int",
  primary = false,
  missing,
  delta,
  hint,
  visual,
  href,
  index = 0,
}: {
  label: string;
  /** Élément icône déjà rendu, ex. `icon={<Users />}`. */
  icon: React.ReactNode;
  accent?: CockpitAccent;
  value?: number;
  format?: "int" | "eur";
  /** Un seul par écran : le chiffre passe en dégradé marine → océan. */
  primary?: boolean;
  /** Remplace le chiffre quand la source n'est pas branchée. */
  missing?: string;
  delta?: { value: string; positive: boolean };
  hint?: React.ReactNode;
  /** Tendance : une courbe (`line`) ou des capsules (`bars`). */
  visual?: { kind: "line" | "bars"; values: number[] };
  href?: string;
  index?: number;
}) {
  const teinte = TEINTE[accent];
  const showVisual = visual && visual.values.length > 1;

  const body = (
    <div
      className={cn(
        "vitre group/kpi relative flex h-full flex-col overflow-hidden rounded-[24px] p-4 sm:p-5",
        href && "transition-shadow duration-300 hover:shadow-[var(--shadow-lift)]",
      )}
    >
      <div className="relative z-[1] flex items-center justify-between gap-2">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-[17px] [&_svg]:stroke-[1.8]",
            teinte.chip,
          )}
        >
          {icon}
        </span>
        {/* Comme KpiCard : sur téléphone toute la tuile est le lien, la
            flèche n'ajoutait que du bruit à quatre tuiles serrées. */}
        {href && (
          <span className="hidden size-7 shrink-0 place-items-center rounded-full bg-white/80 text-ink-3 shadow-[var(--shadow-glass)] transition-colors group-hover/kpi:text-ocean sm:grid">
            <ArrowUpRight className="size-3.5" />
          </span>
        )}
      </div>

      <p className="t-label relative z-[1] mt-3.5 text-ink-2">{label}</p>

      <div className="relative z-[1] mt-2 min-h-[1em]">
        {missing ? (
          <span className="block text-[19px] font-medium leading-tight tracking-[-0.02em] text-ink-3 sm:text-[21px]">
            {missing}
          </span>
        ) : (
          <AnimatedNumber
            value={value ?? 0}
            format={format}
            className={cn("block", primary ? "n-kpi-lead n-gradient" : "n-kpi text-foreground")}
          />
        )}
      </div>

      <div className="relative z-[1] mt-auto">
        {showVisual &&
          (visual.kind === "line" ? (
            <TrendLine values={visual.values} color={teinte.line} className="mt-4" />
          ) : (
            <MiniBars values={visual.values} color={teinte.line} soft={teinte.soft} className="mt-4" />
          ))}
        {(delta || hint) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-3">
            {delta && (
              <span
                className={cn(
                  "pastille",
                  delta.positive
                    ? "bg-[rgba(15,159,110,0.1)] text-success"
                    : "bg-[rgba(224,77,85,0.1)] text-danger",
                )}
              >
                {delta.positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {delta.value}
              </span>
            )}
            {hint && <span className="t-caption text-ink-3">{hint}</span>}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <MotionCard index={index} className="h-full">
      {href ? (
        <Link
          href={href}
          className="block h-full rounded-[24px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ocean/20"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </MotionCard>
  );
}
