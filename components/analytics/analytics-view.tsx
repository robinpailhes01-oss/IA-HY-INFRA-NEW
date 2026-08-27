"use client";

import { useMemo, useState } from "react";
import { Bot, Eye, Globe, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  aggregateReferrers,
  filterByPeriod,
  isAiReferrer,
  PERIOD_OPTIONS,
  type AnalyticsPeriod,
  type AnalyticsSnapshot,
} from "@/lib/analytics";

function formatShortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">
        {label ? formatShortDate(label) : ""}
      </p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name} : <span className="font-semibold text-foreground">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function AnalyticsView({ snapshots }: { snapshots: AnalyticsSnapshot[] }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30");

  const filtered = useMemo(() => filterByPeriod(snapshots, period), [snapshots, period]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, s) => ({ visitors: acc.visitors + s.visitors, pageviews: acc.pageviews + s.pageviews }),
        { visitors: 0, pageviews: 0 },
      ),
    [filtered],
  );

  const referrers = useMemo(() => aggregateReferrers(filtered), [filtered]);
  const aiVisitors = useMemo(
    () => referrers.filter((r) => isAiReferrer(r.hostname)).reduce((sum, r) => sum + r.visitors, 0),
    [referrers],
  );

  const chartData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
        .map((s) => ({ date: s.snapshot_date, Visiteurs: s.visitors, "Pages vues": s.pageviews })),
    [filtered],
  );

  if (snapshots.length === 0) {
    return (
      <Card className="enter-up">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Globe className="size-8 text-muted-foreground" />
          <p className="font-medium text-foreground">Pas encore de données</p>
          <p className="max-w-md text-sm text-muted-foreground">
            La synchro quotidienne avec Vercel Web Analytics n&apos;a pas encore tourné —
            le premier instantané apparaîtra ici après la prochaine exécution du cron.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Visiteurs" value={totals.visitors} icon={Users} accent="primary" index={0} />
          <KpiCard label="Pages vues" value={totals.pageviews} icon={Eye} accent="info" index={1} />
          <KpiCard label="Référents distincts" value={referrers.length} icon={Globe} accent="success" index={2} />
          <KpiCard label="Visites via IA" value={aiVisitors} icon={Bot} accent="gold" index={3} />
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Select value={period} onValueChange={(v) => setPeriod(v as AnalyticsPeriod)}>
          <SelectTrigger size="sm" className="w-auto">
            <SelectValue>
              {(v) => PERIOD_OPTIONS.find((o) => o.value === v)?.label ?? "Période"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="enter-up" style={{ animationDelay: "80ms" }}>
        <CardHeader>
          <CardTitle>Croissance du trafic</CardTitle>
          <CardDescription>Visiteurs et pages vues, par jour</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucune donnée sur cette période.
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="visitorsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pageviewsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="Visiteurs"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#visitorsFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Pages vues"
                    stroke="var(--gold)"
                    strokeWidth={2}
                    fill="url(#pageviewsFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="enter-up" style={{ animationDelay: "140ms" }}>
        <CardHeader>
          <CardTitle>D&apos;où viennent les visites</CardTitle>
          <CardDescription>
            Classement des référents sur la période — les moteurs IA (ChatGPT, Perplexity,
            Gemini, Claude) sont mis en évidence séparément.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrers.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucun référent enregistré sur cette période.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Visiteurs</TableHead>
                  <TableHead className="text-right">Pages vues</TableHead>
                  <TableHead className="text-right">Part du trafic</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrers.map((r) => {
                  const ai = isAiReferrer(r.hostname);
                  const share = totals.visitors > 0 ? (r.visitors / totals.visitors) * 100 : 0;
                  return (
                    <TableRow key={r.hostname} className={cn(ai && "bg-gold/5")}>
                      <TableCell className="font-medium text-foreground">
                        <span className="flex items-center gap-2">
                          {r.hostname === "(direct)" ? (
                            <span className="text-muted-foreground">Direct / inconnu</span>
                          ) : (
                            r.hostname
                          )}
                          {ai && (
                            <Badge variant="secondary" className="gap-1 bg-gold/15 text-gold">
                              <Bot className="size-3" />
                              IA
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(r.visitors)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatNumber(r.pageviews)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {share.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
