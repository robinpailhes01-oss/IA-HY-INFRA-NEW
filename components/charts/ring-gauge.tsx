import { cn } from "@/lib/utils";

/**
 * Anneau de progression (0–100). SVG pur, composant serveur.
 * Le centre reçoit ce qu'on veut (`children`) : un chiffre, un libellé.
 * Le remplissage s'anime à l'entrée (.animate-gauge, pathLength = 1).
 */
export function RingGauge({
  value,
  size = 132,
  stroke = 11,
  color = "#2f7fe0",
  track = "rgba(11,37,69,0.07)",
  gradientTo,
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  /** Seconde couleur : l'anneau devient un dégradé `color` → `gradientTo`. */
  gradientTo?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, value)) / 100;
  const r = (size - stroke) / 2;
  const id = `ring-${Math.round(value * 10)}-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        {gradientTo && (
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={gradientTo} />
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={gradientTo ? `url(#${id})` : color}
            strokeWidth={stroke}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${v} 1`}
            className="animate-gauge"
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
