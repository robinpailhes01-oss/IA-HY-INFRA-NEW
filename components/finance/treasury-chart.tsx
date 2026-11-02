"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatEur } from "@/lib/format";

// La courbe de trésorerie de la carte héros.
//
// Pourquoi pas TrendChart (le kit) : sans axe vertical, recharts part de
// zéro. Une trésorerie qui passe de 52 000 à 39 000 € s'y dessinait comme
// une ligne plate collée en haut — le recul de 25 % devenait invisible. Ici
// l'échelle épouse les valeurs (min − marge → max + marge) : c'est une
// TENDANCE, le montant exact est juste au-dessus, en grand.
//
// Pas d'étiquettes d'axe : seulement la première et la dernière date sous la
// courbe. Neuf dates serrées disaient moins que deux.

export function TreasuryChart({
  data,
  height = 140,
  color = "#2f7fe0",
}: {
  data: Array<{ label: string; a: number }>;
  height?: number;
  color?: string;
}) {
  const id = useId().replace(/:/g, "");
  const values = data.map((d) => d.a);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.18, Math.abs(max) * 0.01, 1);

  return (
    <div className="w-full">
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
            <defs>
              <linearGradient id={`treso-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.24} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <YAxis hide domain={[min - pad, max + pad]} />
            <Tooltip
              cursor={{ stroke: "rgba(11,37,69,0.15)", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="vitre-strong rounded-2xl px-3.5 py-2.5 text-[12px]">
                    <p className="mb-1 font-semibold text-foreground">{label}</p>
                    <p className="font-semibold tabular-nums text-foreground">{formatEur(Number(payload[0].value ?? 0))}</p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="a"
              stroke={color}
              strokeWidth={2.2}
              fill={`url(#treso-${id})`}
              activeDot={{ r: 5, strokeWidth: 2.5, stroke: "#fff", fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex justify-between px-1.5 text-[11px] font-medium text-ink-3">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
