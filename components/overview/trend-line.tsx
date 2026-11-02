import { cn } from "@/lib/utils";

// Deux mini-visuels pour le bas des tuiles du cockpit — composants SERVEUR.
//
// Pourquoi pas <Sparkline> ? Elle a une largeur de dessin fixe : étirée sur
// toute la largeur d'une tuile (de 143 px sur iPhone à 230 px sur bureau), son
// point final se déforme en ellipse. Ici la courbe s'étire librement
// (preserveAspectRatio="none" + trait non mis à l'échelle) et le point final
// est un vrai disque HTML posé par-dessus, en pourcentage : il reste rond à
// toutes les largeurs.

const W = 100;
const H = 36;
const PAD = 4;

/** Catmull-Rom → Bézier : une courbe se lit comme une tendance, une ligne
 *  brisée sur huit points se lit comme du bruit. */
function smoothPath(points: Array<[number, number]>): string {
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

function gradientId(values: number[], color: string): string {
  let h = 0;
  for (const c of values.join(",") + color) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `trend-${(h >>> 0).toString(36)}`;
}

/** Courbe de tendance pleine largeur, point final = aujourd'hui. */
export function TrendLine({
  values,
  color,
  className,
}: {
  values: number[];
  color: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts: Array<[number, number]> = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    PAD + (1 - (v - min) / span) * (H - PAD * 2),
  ]);
  const line = smoothPath(pts);
  const id = gradientId(values, color);
  const last = pts[pts.length - 1];

  return (
    <div className={cn("relative h-9 w-full", className)} aria-hidden>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white shadow-[0_1px_3px_rgba(11,37,69,0.18)]"
        style={{ left: "100%", top: `${(last[1] / H) * 100}%`, borderColor: color }}
      />
    </div>
  );
}

/** Petites capsules (semaines à venir) : la première, la semaine en cours,
 *  porte la couleur pleine ; les suivantes restent en retrait. Une semaine
 *  vide garde un trait minimal pour qu'on voie qu'elle existe. */
export function MiniBars({
  values,
  color,
  soft,
  className,
}: {
  values: number[];
  color: string;
  soft: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  return (
    <div className={cn("flex h-9 w-full items-end gap-1", className)} aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-full"
          style={{
            height: v > 0 ? `${Math.max(18, (v / max) * 100)}%` : "4px",
            background: v > 0 ? (i === 0 ? color : soft) : "rgba(11,37,69,0.07)",
          }}
        />
      ))}
    </div>
  );
}
