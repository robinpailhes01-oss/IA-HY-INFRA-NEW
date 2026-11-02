import { Check } from "lucide-react";

import { Num } from "@/components/ui/num";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

// L'objectif de saison : un arc de 270° (le cadran d'un compas plutôt qu'un
// anneau fermé), avec les trois paliers posés dessus — minimum, moyen, fort.
// On voit d'un coup où on en est ET ce qui reste avant la marche suivante.
//
// Composant SERVEUR (SVG pur). Le remplissage s'anime à l'entrée via
// .animate-gauge (pathLength = 1), coupé si prefers-reduced-motion.

type RevenueGaugeProps = {
  current: number;
  min: number;
  medium: number;
  strong: number;
  /** Diamètre du cadran, en px. */
  size?: number;
  /** Période terminée : on dresse le bilan (« il a manqué ») au lieu de
   *  pousser vers un palier qu'on ne peut plus atteindre. */
  closed?: boolean;
};

const START = 135;
const SWEEP = 270;

export function RevenueGauge({ current, min, medium, strong, size = 188, closed = false }: RevenueGaugeProps) {
  const stroke = 12;
  const center = size / 2;
  const radius = center - stroke / 2 - 6;

  const polar = (deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [center + radius * Math.cos(a), center + radius * Math.sin(a)];
  };
  const [x1, y1] = polar(START);
  const [x2, y2] = polar(START + SWEEP);
  const arc = `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${x2} ${y2}`;

  // Au-delà de l'objectif fort, l'échelle s'étire jusqu'au réalisé : les
  // paliers reculent sur le cadran au lieu de déborder.
  const max = Math.max(strong, current, 1);
  const fraction = Math.min(current / max, 1);
  const pct = strong > 0 ? Math.round((current / strong) * 100) : 0;

  const tiers = [
    { label: "Minimum", value: min },
    { label: "Moyen", value: medium },
    { label: "Fort", value: strong },
  ];
  const next = tiers.find((t) => current < t.value);

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative" style={{ width: size, height: size * 0.86 }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${pct} % de l'objectif fort : ${formatEur(current)} sur ${formatEur(strong)}`}
          className="absolute inset-x-0 top-0"
        >
          <defs>
            <linearGradient id="hy-season-gauge" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#7cc0f5" />
              <stop offset="55%" stopColor="#2f7fe0" />
              <stop offset="100%" stopColor="#0b2545" />
            </linearGradient>
          </defs>
          <path d={arc} fill="none" stroke="rgba(11,37,69,0.07)" strokeWidth={stroke} strokeLinecap="round" />
          {fraction > 0 && (
            <path
              d={arc}
              fill="none"
              stroke="url(#hy-season-gauge)"
              strokeWidth={stroke}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={`${fraction} 1`}
              className="animate-gauge"
            />
          )}
          {tiers.map((t) => {
            const [tx, ty] = polar(START + SWEEP * Math.min(t.value / max, 1));
            const reached = current >= t.value;
            return (
              <circle
                key={t.label}
                cx={tx}
                cy={ty}
                r={3.2}
                fill="#ffffff"
                stroke={reached ? "#0b2545" : "rgba(11,37,69,0.35)"}
                strokeWidth={1.6}
              />
            );
          })}
          {fraction > 0.02 &&
            (() => {
              const [ex, ey] = polar(START + SWEEP * fraction);
              return (
                <circle
                  cx={ex}
                  cy={ey}
                  r={7.5}
                  fill="#ffffff"
                  stroke="#2f7fe0"
                  strokeWidth={3}
                  style={{ filter: "drop-shadow(0 3px 6px rgba(47,127,224,0.45))" }}
                />
              );
            })()}
        </svg>

        <div className="absolute inset-x-0 top-0 grid place-items-center text-center" style={{ height: size }}>
          <div>
            <Num className="n-kpi-lead block text-foreground">{`${pct} %`}</Num>
            <span className="t-caption mt-1 block text-ink-3">de l&apos;objectif fort</span>
          </div>
        </div>
      </div>

      <ul className="mt-1 w-full space-y-1">
        {tiers.map((t) => {
          const reached = current >= t.value;
          const isNext = t === next;
          return (
            <li
              key={t.label}
              className={cn(
                "flex items-center justify-between gap-3 rounded-full px-3 py-2",
                isNext && "vitre-inset",
              )}
            >
              <span className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
                <span
                  className={cn(
                    "grid size-[18px] place-items-center rounded-full",
                    reached ? "bg-success text-white" : "border border-[var(--hairline-strong)] bg-white/70",
                  )}
                >
                  {reached && <Check className="size-3" strokeWidth={2.6} />}
                </span>
                {t.label}
              </span>
              <Num className={cn("n-inline text-[13.5px]", reached ? "text-ink-2" : "text-foreground")}>
                {formatEur(t.value)}
              </Num>
            </li>
          );
        })}
      </ul>

      <p className="t-caption mt-3 text-center text-ink-2">
        {next ? (
          <>
            {closed ? "Il a manqué " : "Encore "}
            <Num className="font-semibold text-foreground">{formatEur(next.value - current)}</Num> pour le palier{" "}
            {next.label.toLowerCase()}.
          </>
        ) : (
          "Objectif fort atteint — tous les paliers sont franchis."
        )}
      </p>
    </div>
  );
}
