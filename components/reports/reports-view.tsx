"use client";

import { useState } from "react";
import { BarChart3, Compass } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { PillGroup } from "@/components/finance/pill-group";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { channelMeta } from "@/lib/leads";
import { ChannelLogo } from "@/components/leads/channel-logo";

export type TimeBucket = {
  label: string;
  revenue: number;
  count: number;
  isCurrent: boolean;
};

export type ChannelStat = {
  channel: string;
  count: number;
  revenue: number;
};

type Gran = "week" | "month";
type ChanPeriod = "month" | "year" | "all";

export function ReportsView({
  weekly,
  monthly,
  channels,
}: {
  weekly: TimeBucket[];
  monthly: TimeBucket[];
  channels: { month: ChannelStat[]; year: ChannelStat[]; all: ChannelStat[] };
}) {
  const [gran, setGran] = useState<Gran>("week");
  const [chanPeriod, setChanPeriod] = useState<ChanPeriod>("year");

  const series = gran === "week" ? weekly : monthly;
  const total = series.reduce((s, b) => s + b.revenue, 0);
  const chanStats = channels[chanPeriod];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start lg:gap-5">
      {/* ── La valeur des sorties dans le temps ── */}
      <Card className="rise lg:col-span-7">
        <CardHeader>
          <CardTitle>Valeur des sorties</CardTitle>
          <CardDescription>
            {gran === "week" ? "12 dernières semaines" : "12 derniers mois"} · total <Num>{formatEur(total)}</Num>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PillGroup
            label="Granularité"
            value={gran}
            onChange={setGran}
            options={[
              { value: "week", label: "Par semaine" },
              { value: "month", label: "Par mois" },
            ]}
          />
          {/* `key` : la lecture revient sur la période en cours quand on
              change de granularité. */}
          <RevenueBars key={gran} series={series} unit={gran} />
        </CardContent>
      </Card>

      {/* ── Réservations par canal ── */}
      <Card className="rise lg:col-span-5">
        <CardHeader>
          <CardTitle>D&apos;où viennent les clients</CardTitle>
          <CardDescription>Réservations par canal d&apos;acquisition · hors site web</CardDescription>
        </CardHeader>
        <CardContent>
          <PillGroup
            label="Période"
            value={chanPeriod}
            onChange={setChanPeriod}
            options={[
              { value: "month", label: "Ce mois" },
              { value: "year", label: "12 mois" },
              { value: "all", label: "Tout" },
            ]}
          />
          <ChannelBreakdown stats={chanStats} />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Barres verticales en capsules — une seule série (la valeur dans le temps).
 *
 * La lecture (montant + nombre de réservations) s'affiche AU-DESSUS du
 * graphique pour la barre survolée ou touchée, et par défaut pour la
 * période en cours : sur téléphone il n'y a pas de survol, l'info ne doit
 * pas en dépendre.
 */
function RevenueBars({ series, unit }: { series: TimeBucket[]; unit: Gran }) {
  const currentIdx = Math.max(0, series.findIndex((b) => b.isCurrent));
  const [active, setActive] = useState<number>(currentIdx);
  const max = Math.max(...series.map((b) => b.revenue), 1);

  if (series.every((b) => b.revenue === 0)) {
    return (
      <EmptyState icon={<BarChart3 />} title="Aucune réservation sur la période" className="mt-4">
        Les sorties apparaîtront ici à leur date, dès qu&apos;elles seront réservées.
      </EmptyState>
    );
  }

  // Étiquettes gardées sur téléphone : une sur deux, plus la période en
  // cours — et si elle tombe sur une position masquée, ses voisines cèdent
  // la place plutôt que de se chevaucher.
  const labelled = new Set<number>();
  for (let i = 0; i < series.length; i += 2) labelled.add(i);
  if (!labelled.has(currentIdx)) {
    labelled.add(currentIdx);
    labelled.delete(currentIdx - 1);
    labelled.delete(currentIdx + 1);
  }

  const sel = series[active] ?? series[currentIdx];
  const selLabel =
    active === currentIdx ? (unit === "week" ? "Cette semaine" : "Ce mois-ci") : unit === "week" ? `Semaine du ${sel.label}` : sel.label;

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
        <span className="t-label text-ink-3 first-letter:uppercase">{selLabel}</span>
        <Num className="n-kpi text-foreground">{formatEur(sel.revenue)}</Num>
        <span className="t-caption text-ink-3">
          {sel.count} réservation{sel.count !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-5 flex h-52 items-stretch gap-1.5 sm:gap-2.5" onMouseLeave={() => setActive(currentIdx)}>
        {series.map((b, i) => {
          const heightPct = Math.round((b.revenue / max) * 100);
          const isActive = i === active;
          return (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-label={`${b.label} : ${formatEur(b.revenue)}, ${b.count} réservation${b.count !== 1 ? "s" : ""}`}
              aria-pressed={isActive}
              className="group/bar relative flex min-w-0 flex-1 flex-col items-center gap-2 rounded-[12px] outline-none focus-visible:ring-4 focus-visible:ring-ocean/20"
            >
              <span className="flex min-h-0 w-full flex-1 items-end justify-center">
                <span
                  className={cn(
                    "animate-grow block w-full max-w-8 rounded-full transition-[filter,box-shadow] duration-200",
                    b.revenue === 0
                      ? "bg-[rgba(11,37,69,0.07)]"
                      : b.isCurrent
                        ? "bg-[linear-gradient(180deg,#2f7fe0,#0b2545)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_12px_26px_-8px_rgba(47,127,224,0.6)]"
                        : "bg-[linear-gradient(180deg,#bfe0fa,#8cc4f0)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
                    isActive && !b.isCurrent && b.revenue > 0 && "brightness-[0.92] shadow-[0_0_0_3px_rgba(47,127,224,0.18)]",
                  )}
                  style={{
                    height: b.revenue === 0 ? "6px" : `${Math.max(heightPct, 4)}%`,
                    animationDelay: `${i * 40}ms`,
                  }}
                />
              </span>
              <span
                className={cn(
                  // Pas de troncature : l'étiquette déborde de sa colonne,
                  // centrée (sa voisine est masquée sur téléphone).
                  "whitespace-nowrap text-center text-[10.5px] font-medium",
                  b.isCurrent ? "text-ocean" : isActive ? "text-foreground" : "text-ink-3",
                  // Douze étiquettes ne tiennent pas à 390 px : une sur
                  // deux, la période en cours toujours visible.
                  !labelled.has(i) && "max-sm:invisible",
                )}
              >
                {b.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Barres horizontales par canal — la longueur est la part, le logo l'identité. */
function ChannelBreakdown({ stats }: { stats: ChannelStat[] }) {
  const totalCount = stats.reduce((s, c) => s + c.count, 0);

  if (stats.length === 0 || totalCount === 0) {
    return (
      <EmptyState icon={<Compass />} title="Aucune réservation sur la période" className="mt-4">
        Renseigne le canal de chaque réservation pour savoir ce qui t&apos;amène des clients.
      </EmptyState>
    );
  }

  return (
    <ul className="mt-3 divide-y divide-[var(--hairline)]">
      {stats.map((c) => {
        const label = c.channel === "unknown" ? "Inconnu" : channelMeta(c.channel).label;
        const share = Math.round((c.count / totalCount) * 100);
        return (
          <li key={c.channel} className="py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.08)]">
                <ChannelLogo channel={c.channel === "unknown" ? null : c.channel} className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium tracking-[-0.012em] text-foreground">
                {label}
              </span>
              <span className="shrink-0 text-right">
                <Num className="n-inline block text-[14px] text-foreground">{formatEur(c.revenue)}</Num>
                <span className="block text-[11.5px] text-ink-3">
                  {c.count} résa · {share} %
                </span>
              </span>
            </div>
            <div aria-hidden className="mt-2 ml-[42px] h-1.5 overflow-hidden rounded-full bg-[rgba(11,37,69,0.05)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#2f7fe0,#7cc0f5)]"
                style={{ width: `${Math.max(share, 2)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
