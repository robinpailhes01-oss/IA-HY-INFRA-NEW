import { cn } from "@/lib/utils";

/**
 * Anneau de score en SVG pur — pas de librairie de graphes pour un seul
 * indicateur, et ça reste net à n'importe quelle taille (capture d'écran,
 * partage, impression).
 */
export function ScoreRing({
  score,
  size = 148,
  className,
}: {
  score: number;
  size?: number;
  className?: string;
}) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circumference;

  // Seuils volontairement simples : sous 40 c'est rouge, sous 75 c'est orange.
  const tone = score < 40 ? "text-danger" : score < 75 ? "text-gold" : "text-success";

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className={cn("transition-[stroke-dasharray] duration-700", tone)}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-semibold leading-none tracking-tight tabular-nums", tone)}>
          {score}
        </span>
        <span className="mt-1 text-xs font-medium text-muted-foreground">sur 100</span>
      </div>
    </div>
  );
}
