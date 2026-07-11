"use client";

import { useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* ── Chiffre d'affaires dans le temps ── */}
      <Card className="enter-up lg:col-span-3" style={{ animationDelay: "120ms" }}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Chiffre d&apos;affaires</CardTitle>
              <CardDescription>
                {gran === "week" ? "12 dernières semaines" : "12 derniers mois"} · total{" "}
                {formatEur(total)}
              </CardDescription>
            </div>
            <SegToggle
              value={gran}
              onChange={(v) => setGran(v as Gran)}
              options={[
                { value: "week", label: "Semaine" },
                { value: "month", label: "Mois" },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent>
          <RevenueBars series={series} />
        </CardContent>
      </Card>

      {/* ── Réservations par canal ── */}
      <Card className="enter-up lg:col-span-2" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Réservations par canal</CardTitle>
              <CardDescription>D&apos;où viennent les clients</CardDescription>
            </div>
            <SegToggle
              value={chanPeriod}
              onChange={(v) => setChanPeriod(v as ChanPeriod)}
              options={[
                { value: "month", label: "Mois" },
                { value: "year", label: "12 mois" },
                { value: "all", label: "Tout" },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent>
          <ChannelBreakdown stats={chanStats} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Barres verticales du CA — une seule série (magnitude dans le temps). */
function RevenueBars({ series }: { series: TimeBucket[] }) {
  const max = Math.max(...series.map((b) => b.revenue), 1);

  if (series.every((b) => b.revenue === 0)) {
    return <EmptyChart>Aucune réservation sur la période.</EmptyChart>;
  }

  return (
    <div className="flex h-56 items-stretch gap-1.5 overflow-visible">
      {series.map((b, i) => {
        const heightPct = Math.round((b.revenue / max) * 100);
        return (
          <div key={i} className="group/bar relative flex flex-1 flex-col items-center gap-2">
            {/* Tooltip au survol */}
            <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-center opacity-0 shadow-md transition-opacity duration-150 group-hover/bar:opacity-100">
              <div className="text-xs font-semibold text-foreground">{formatEur(b.revenue)}</div>
              <div className="text-[10px] text-muted-foreground">
                {b.count} réservation{b.count !== 1 ? "s" : ""}
              </div>
            </div>

            <div className="flex min-h-0 w-full flex-1 items-end">
              <div
                className={cn(
                  "animate-grow w-full rounded-t-md bg-gradient-to-t transition-[filter] duration-200 group-hover/bar:brightness-110",
                  b.revenue === 0
                    ? "from-border to-border"
                    : b.isCurrent
                      ? "from-gold/80 to-gold shadow-[0_4px_12px_-4px_rgba(201,168,76,0.6)]"
                      : "from-primary/15 to-primary/40",
                )}
                style={{
                  height: b.revenue === 0 ? "3px" : `${Math.max(heightPct, 4)}%`,
                  animationDelay: `${i * 40}ms`,
                }}
              />
            </div>
            <span
              className={cn(
                "truncate text-[10px]",
                b.isCurrent ? "font-semibold text-gold" : "text-muted-foreground",
              )}
            >
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Barres horizontales par canal — magnitude par catégorie, identité par logo. */
function ChannelBreakdown({ stats }: { stats: ChannelStat[] }) {
  const totalCount = stats.reduce((s, c) => s + c.count, 0);
  const maxCount = Math.max(...stats.map((c) => c.count), 1);

  if (stats.length === 0 || totalCount === 0) {
    return <EmptyChart>Aucune réservation sur la période.</EmptyChart>;
  }

  return (
    <ul className="space-y-3.5">
      {stats.map((c) => {
        const label = c.channel === "unknown" ? "Inconnu" : channelMeta(c.channel).label;
        const share = Math.round((c.count / totalCount) * 100);
        return (
          <li key={c.channel} className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <ChannelLogo channel={c.channel === "unknown" ? null : c.channel} className="size-4" />
              <span className="font-medium text-foreground">{label}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                {c.count} résa · <span className="font-medium text-foreground">{formatEur(c.revenue)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="animate-grow h-full rounded-full bg-primary/60"
                  style={{ width: `${Math.max(Math.round((c.count / maxCount) * 100), 3)}%` }}
                />
              </div>
              <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                {share}%
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SegToggle({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-md px-2.5 py-1 font-medium transition-colors",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
