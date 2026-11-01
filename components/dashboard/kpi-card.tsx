import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { MotionCard } from "@/components/dashboard/motion-card";
import { Sparkline } from "@/components/charts/sparkline";
import { cn } from "@/lib/utils";

// Une carte KPI : une pastille d'icône teintée, un libellé, LE chiffre, puis
// une précision (variation ou contexte). Une courbe discrète en option.
//
// Ce qui distingue les cartes entre elles, c'est la TEINTE de la pastille et
// de la courbe — pas le fond. Quatre plaques de verre identiques restent
// lisibles parce que chacune porte sa couleur au même endroit.
//
// Composant SERVEUR : l'animation vit dans MotionCard / AnimatedNumber, qui
// ne reçoivent que des valeurs sérialisables et des enfants déjà rendus.

export type KpiAccent = "ocean" | "sky" | "navy" | "aqua" | "indigo" | "success" | "gold" | "warning" | "danger" | "info" | "primary" | "whatsapp";

const TEINTE: Record<KpiAccent, { chip: string; line: string }> = {
  ocean: { chip: "bg-[rgba(47,127,224,0.1)] text-ocean", line: "#2f7fe0" },
  info: { chip: "bg-[rgba(47,127,224,0.1)] text-ocean", line: "#2f7fe0" },
  sky: { chip: "bg-[rgba(124,192,245,0.18)] text-[#2b7fc9]", line: "#5aaef0" },
  navy: { chip: "bg-[rgba(11,37,69,0.08)] text-navy", line: "#0b2545" },
  primary: { chip: "bg-[rgba(11,37,69,0.08)] text-navy", line: "#0b2545" },
  aqua: { chip: "bg-[rgba(34,167,191,0.12)] text-aqua", line: "#22a7bf" },
  indigo: { chip: "bg-[rgba(109,124,242,0.12)] text-indigo", line: "#6d7cf2" },
  success: { chip: "bg-[rgba(15,159,110,0.11)] text-success", line: "#0f9f6e" },
  gold: { chip: "bg-[rgba(164,126,44,0.12)] text-gold", line: "#a47e2c" },
  warning: { chip: "bg-[rgba(217,130,43,0.12)] text-warning", line: "#d9822b" },
  danger: { chip: "bg-[rgba(224,77,85,0.11)] text-danger", line: "#e04d55" },
  whatsapp: { chip: "bg-[rgba(31,174,91,0.12)] text-whatsapp", line: "#1fae5b" },
};

type KpiCardProps = {
  label: string;
  value: number;
  format?: "int" | "eur";
  /** Suffixe collé au chiffre (« % », « h »…). */
  suffix?: string;
  accent?: KpiAccent;
  /** Élément icône lucide déjà rendu, ex. `icon={<Users />}`. */
  icon?: React.ReactNode;
  delta?: { value: string; positive: boolean };
  hint?: string;
  /** Série courte (6 à 30 points) dessinée en bas à droite. */
  trend?: number[];
  href?: string;
  index?: number;
  /** Un seul par écran : le chiffre passe en dégradé marine → océan. */
  primary?: boolean;
  className?: string;
};

export function KpiCard({
  label,
  value,
  format = "int",
  suffix,
  accent = "ocean",
  icon,
  delta,
  hint,
  trend,
  href,
  index = 0,
  primary = false,
  className,
}: KpiCardProps) {
  const teinte = TEINTE[accent];

  const body = (
    <div
      className={cn(
        "vitre group/kpi relative flex h-full flex-col overflow-hidden rounded-[24px] p-4 sm:p-5",
        href && "transition-shadow duration-300 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <div className="relative z-[1] flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-[17px] [&_svg]:stroke-[1.8]",
                teinte.chip,
              )}
            >
              {icon}
            </span>
          )}
          <p className="t-label min-w-0 text-ink-2">{label}</p>
        </div>
        {href && (
          <span className="hidden size-7 shrink-0 place-items-center rounded-full bg-white/80 text-ink-3 shadow-[var(--shadow-glass)] transition-colors group-hover/kpi:text-ocean sm:grid">
            <ArrowUpRight className="size-3.5" />
          </span>
        )}
      </div>

      {/* Sur téléphone, la courbe passe SOUS le chiffre : en grille 2 × 2, à
          côté, elle écrasait le montant (« 38 4… »). */}
      <div className="relative z-[1] mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <span className="flex items-baseline gap-0.5">
          <AnimatedNumber
            value={value}
            format={format}
            className={cn(
              "block",
              primary ? "n-kpi-lead n-gradient" : "n-kpi text-foreground",
            )}
          />
          {suffix && (
            <span className={cn("font-medium text-ink-2", primary ? "text-xl" : "text-lg")}>{suffix}</span>
          )}
        </span>
        {trend && trend.length > 1 && (
          <Sparkline values={trend} color={teinte.line} className="h-8 w-full shrink-0 sm:h-9 sm:w-24" />
        )}
      </div>

      {(delta || hint) && (
        <div className="relative z-[1] mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3">
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
  );

  return (
    <MotionCard index={index} className="h-full">
      {href ? (
        <Link href={href} className="block h-full rounded-[24px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ocean/20">
          {body}
        </Link>
      ) : (
        body
      )}
    </MotionCard>
  );
}
