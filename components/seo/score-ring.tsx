import { cn } from "@/lib/utils";

/**
 * Anneau de score en SVG pur — pas de librairie de graphes pour un seul
 * indicateur, et ça reste net à n'importe quelle taille (capture d'écran,
 * partage, impression). Composant serveur : le remplissage s'anime en CSS
 * (.animate-gauge, pathLength = 1), coupé si l'utilisateur réduit les
 * animations.
 *
 * Deux matières :
 * · `signature` — posé dans le panneau marine : rail de verre clair, chiffre
 *   blanc, dégradés éclaircis pour rester lisibles sur le fond sombre ;
 * · `glass` — sur une carte claire : rail marine très pâle, chiffre marine.
 */

// Seuils volontairement simples : sous 40 c'est rouge, sous 75 c'est orange.
function toneOf(score: number): "danger" | "warning" | "success" {
  return score < 40 ? "danger" : score < 75 ? "warning" : "success";
}

const ARC: Record<"signature" | "glass", Record<"danger" | "warning" | "success", [string, string]>> = {
  signature: {
    danger: ["#ffb4b8", "#f0646b"],
    warning: ["#ffe0ae", "#f0a24c"],
    success: ["#a8f0d2", "#36c793"],
  },
  glass: {
    danger: ["#f08a90", "#e04d55"],
    warning: ["#f2b977", "#d9822b"],
    success: ["#5fd3a6", "#0f9f6e"],
  },
};

export const SCORE_LABEL: Record<"danger" | "warning" | "success", string> = {
  danger: "Presque invisible",
  warning: "En progrès",
  success: "Solide",
};

export function scoreTone(score: number) {
  return toneOf(score);
}

export function ScoreRing({
  score,
  size = 148,
  variant = "glass",
  className,
}: {
  score: number;
  size?: number;
  variant?: "signature" | "glass";
  className?: string;
}) {
  const stroke = Math.max(9, Math.round(size / 13));
  const radius = (size - stroke) / 2;
  const v = Math.min(100, Math.max(0, score)) / 100;
  const tone = toneOf(score);
  const [from, to] = ARC[variant][tone];
  const id = `seo-ring-${variant}-${tone}-${size}`;
  const dark = variant === "signature";

  return (
    <div
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Score ${score} sur 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={dark ? "rgba(255,255,255,0.09)" : "rgba(11,37,69,0.07)"}
        />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={`url(#${id})`}
            pathLength={1}
            strokeDasharray={`${v} 1`}
            className="animate-gauge"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn("leading-none font-medium tracking-[-0.045em] tabular-nums", dark ? "text-white" : "text-foreground")}
          style={{ fontSize: Math.round(size * 0.3) }}
        >
          {score}
        </span>
        <span className={cn("mt-1.5 text-[12px] font-medium", dark ? "text-[#9fbfe2]" : "text-ink-3")}>sur 100</span>
      </div>
    </div>
  );
}
