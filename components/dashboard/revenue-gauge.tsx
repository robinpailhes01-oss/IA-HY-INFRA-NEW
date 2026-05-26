import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tier = {
  label: string;
  value: number;
};

type RevenueGaugeProps = {
  current: number;
  min: number;
  medium: number;
  strong: number;
};

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 88;
const STROKE = 16;
const START_ANGLE = 135;
const SWEEP = 270;

function polar(angleDeg: number, radius = RADIUS): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [CENTER + radius * Math.cos(a), CENTER + radius * Math.sin(a)];
}

function arcPath(fromFraction: number, toFraction: number): string {
  const from = START_ANGLE + SWEEP * fromFraction;
  const to = START_ANGLE + SWEEP * toFraction;
  const [x1, y1] = polar(from);
  const [x2, y2] = polar(to);
  const largeArc = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export function RevenueGauge({ current, min, medium, strong }: RevenueGaugeProps) {
  const max = Math.max(strong, current, 1);
  const fraction = Math.min(current / max, 1);

  const tiers: Tier[] = [
    { label: "Min", value: min },
    { label: "Moyen", value: medium },
    { label: "Fort", value: strong },
  ];

  const reached =
    current >= strong
      ? { label: "Objectif fort atteint", tone: "success" as const }
      : current >= medium
        ? { label: "Palier moyen atteint", tone: "success" as const }
        : current >= min
          ? { label: "Palier minimum atteint", tone: "warning" as const }
          : { label: "Sous le palier minimum", tone: "muted" as const };

  const nextTier = tiers.find((t) => current < t.value);
  const remaining = nextTier ? nextTier.value - current : 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Chiffre d'affaires ${formatEur(current)} sur objectif fort ${formatEur(strong)}`}
        >
          <path
            d={arcPath(0, 1)}
            fill="none"
            stroke="var(--secondary)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {fraction > 0 && (
            <path
              d={arcPath(0, fraction)}
              fill="none"
              stroke="var(--gold)"
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          )}
          {tiers.map((tier) => {
            const f = Math.min(tier.value / max, 1);
            const [tx, ty] = polar(f, RADIUS);
            return (
              <circle
                key={tier.label}
                cx={tx}
                cy={ty}
                r={3.5}
                fill="var(--background)"
                stroke="var(--primary)"
                strokeWidth={2}
              />
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-semibold tracking-tight text-foreground">
            {formatEur(current)}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            {Math.round((current / strong) * 100)}% de l&apos;objectif fort
          </span>
        </div>
      </div>

      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
          reached.tone === "success" && "bg-success/10 text-success",
          reached.tone === "warning" && "bg-warning/10 text-warning",
          reached.tone === "muted" && "bg-muted text-muted-foreground",
        )}
      >
        {reached.label}
      </span>

      <div className="grid w-full grid-cols-3 gap-2 border-t border-border pt-4">
        {tiers.map((tier) => {
          const done = current >= tier.value;
          return (
            <div key={tier.label} className="flex flex-col items-center gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {tier.label}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  done ? "text-success" : "text-foreground",
                )}
              >
                {formatEur(tier.value)}
              </span>
            </div>
          );
        })}
      </div>

      {nextTier && (
        <p className="text-center text-xs text-muted-foreground">
          Encore <span className="font-semibold text-gold">{formatEur(remaining)}</span>{" "}
          pour le palier {nextTier.label.toLowerCase()}.
        </p>
      )}
    </div>
  );
}
