"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatEur, formatEurCompact, formatNumber } from "@/lib/format";

/**
 * Le graphique du système — aire lissée ou barres arrondies, une ou deux
 * séries. Une seule façon de dessiner une tendance dans tout le tableau de
 * bord : mêmes axes, même grille, même info-bulle.
 *
 * Composant CLIENT (recharts) : il reçoit des données sérialisables et un
 * `unit` plutôt qu'une fonction de formatage, qui ne traverserait pas la
 * frontière serveur/client.
 */
export type TrendPoint = { label: string; a: number; b?: number };

export type TrendSeries = {
  /** Nom affiché dans l'info-bulle. */
  name: string;
  /** Couleur de la série. Par défaut : marine (a), ciel (b). */
  color?: string;
};

const DEFAULT_A = "#2f7fe0";
const DEFAULT_B = "#9fd0f7";

function fmt(unit: "eur" | "int", v: number, compact = false) {
  if (unit === "eur") return compact ? formatEurCompact(v) : formatEur(v);
  return formatNumber(v);
}

export function TrendChart({
  data,
  type = "area",
  unit = "int",
  a,
  b,
  height = 220,
  showYAxis = true,
}: {
  data: TrendPoint[];
  type?: "area" | "bar";
  unit?: "eur" | "int";
  a: TrendSeries;
  b?: TrendSeries;
  height?: number;
  showYAxis?: boolean;
}) {
  const colorA = a.color ?? DEFAULT_A;
  const colorB = b?.color ?? DEFAULT_B;
  const hasB = Boolean(b) && data.some((d) => d.b !== undefined);

  const axis = {
    stroke: "transparent",
    tick: { fill: "#8394ab", fontSize: 11, fontWeight: 500 },
    tickLine: false,
    axisLine: false,
  } as const;

  const tooltip = (
    <Tooltip
      cursor={type === "bar" ? { fill: "rgba(47,127,224,0.06)", radius: 10 } : { stroke: "rgba(11,37,69,0.15)", strokeDasharray: "3 3" }}
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
          <div className="vitre-strong min-w-36 rounded-2xl px-3.5 py-2.5 text-[12px]">
            <p className="mb-1.5 font-semibold text-foreground">{label}</p>
            {payload.map((p) => (
              <p key={String(p.dataKey)} className="flex items-center justify-between gap-4 text-ink-2">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: p.color }} />
                  {p.dataKey === "a" ? a.name : b?.name}
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {fmt(unit, Number(p.value ?? 0))}
                </span>
              </p>
            ))}
          </div>
        );
      }}
    />
  );

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: showYAxis ? 0 : 4 }} barGap={4}>
            <defs>
              <linearGradient id="trend-bar-a" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colorA} stopOpacity={1} />
                <stop offset="100%" stopColor={colorA} stopOpacity={0.72} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(11,37,69,0.06)" />
            <XAxis dataKey="label" {...axis} dy={6} />
            {showYAxis && (
              <YAxis {...axis} width={52} tickFormatter={(v) => fmt(unit, Number(v), true)} />
            )}
            {tooltip}
            <Bar dataKey="a" fill="url(#trend-bar-a)" radius={[8, 8, 8, 8]} maxBarSize={26} />
            {hasB && <Bar dataKey="b" fill={colorB} radius={[8, 8, 8, 8]} maxBarSize={26} />}
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: showYAxis ? 0 : 4 }}>
            <defs>
              <linearGradient id="trend-area-a" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colorA} stopOpacity={0.26} />
                <stop offset="100%" stopColor={colorA} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="trend-area-b" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colorB} stopOpacity={0.3} />
                <stop offset="100%" stopColor={colorB} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(11,37,69,0.06)" />
            <XAxis dataKey="label" {...axis} dy={6} />
            {showYAxis && (
              <YAxis {...axis} width={52} tickFormatter={(v) => fmt(unit, Number(v), true)} />
            )}
            {tooltip}
            {hasB && (
              <Area
                type="monotone"
                dataKey="b"
                stroke={colorB}
                strokeWidth={2}
                fill="url(#trend-area-b)"
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
              />
            )}
            <Area
              type="monotone"
              dataKey="a"
              stroke={colorA}
              strokeWidth={2.4}
              fill="url(#trend-area-a)"
              activeDot={{ r: 5, strokeWidth: 2.5, stroke: "#fff", fill: colorA }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
