import Link from "next/link";
import { ArrowUpRight, Globe } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { TrendChart, type TrendPoint } from "@/components/charts/trend-chart";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

// LES RÉSEAUX AMÈNENT-ILS DU MONDE SUR LE SITE ?
// Source : notre propre mesure d'audience (vues site_traffic_daily et
// site_traffic_by_source, alimentées par la fonction track-pageview). Les
// « visiteurs » d'une source sur plusieurs jours sont des visiteurs-jour :
// quelqu'un qui revient trois jours compte trois fois — c'est la bonne unité
// pour comparer des sources entre elles, pas pour compter des personnes.

export type TrafficSource = { label: string; group: string; visitors: number; share: number };

const GROUP_LABEL: Record<string, string> = {
  social: "Réseau social",
  search: "Recherche",
  direct: "Direct",
  referral: "Site référent",
  paid: "Campagne payante",
};

export function SiteTraffic({
  ok,
  series,
  visitors,
  socialVisitors,
  sources,
  period,
}: {
  ok: boolean;
  series: TrendPoint[];
  visitors: number;
  socialVisitors: number;
  sources: TrafficSource[];
  period: string;
}) {
  const share = visitors > 0 ? Math.round((socialVisitors / visitors) * 100) : 0;

  // Pleine largeur au bureau : la courbe à gauche, les sources à droite —
  // deux lectures du même trafic, côte à côte plutôt qu'empilées dans une
  // colonne étroite qui étirait la rangée entière.
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Du réseau au site</CardTitle>
        <CardDescription>Visiteurs de harmonie-yacht.fr, et la part venue des réseaux · {period}</CardDescription>
        <CardAction>
          <Link
            href="/analytics"
            aria-label="Ouvrir l'audience du site"
            className="grid size-11 place-items-center rounded-full bg-white/80 text-ink-2 shadow-[var(--shadow-glass)] transition-colors hover:text-ocean lg:size-9"
          >
            <ArrowUpRight className="size-4" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {!ok || visitors === 0 ? (
          <EmptyState icon={<Globe />} title="Pas encore de mesure d'audience" className="flex-1">
            Dès que le site enregistre ses premières visites, tu verras ici combien viennent
            d&apos;Instagram, de TikTok ou de Facebook.
          </EmptyState>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-10">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <p className="t-label text-ink-2">Venus des réseaux</p>
                  <p className="mt-1.5 flex items-baseline gap-1">
                    <span className="n-kpi text-foreground">{share}</span>
                    <span className="text-lg font-medium text-ink-2">%</span>
                  </p>
                </div>
                <p className="pb-1 text-[12px] text-ink-3">
                  <Num>{formatNumber(socialVisitors)}</Num> sur <Num>{formatNumber(visitors)}</Num> visiteurs
                </p>
                <div className="flex gap-3 pb-1 text-[11.5px] text-ink-2 sm:ml-auto">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-ocean" /> Tous les visiteurs
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#9fd0f7]" /> Venus des réseaux
                  </span>
                </div>
              </div>

              <TrendChart
                data={series}
                a={{ name: "Visiteurs" }}
                b={{ name: "Venus des réseaux" }}
                height={190}
                showYAxis={false}
              />
            </div>

            <div className="flex min-w-0 flex-col border-t border-[var(--hairline)] pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
              <div className="flex items-baseline justify-between gap-3">
                <p className="t-label text-ink-2">Par source</p>
                <p className="text-[11.5px] text-ink-3">part des visiteurs</p>
              </div>
              <ul className="mt-3.5 flex flex-1 flex-col justify-between gap-2.5">
                {sources.map((s) => (
                  <li
                    key={s.label}
                    className="grid grid-cols-[minmax(0,6.5rem)_1fr_auto] items-center gap-3"
                    title={GROUP_LABEL[s.group] ?? s.group}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          s.group === "social" ? "bg-ocean" : "bg-[#b5cbe3]",
                        )}
                      />
                      <span className="truncate text-[13px] font-medium text-foreground">{s.label}</span>
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-[rgba(11,37,69,0.06)]">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          s.group === "social" ? "bg-[linear-gradient(90deg,#7cc0f5,#2f7fe0)]" : "bg-[#c9dcf0]",
                        )}
                        style={{ width: `${Math.max(3, s.share)}%` }}
                      />
                    </span>
                    <span className="n-inline w-11 whitespace-nowrap text-right text-[13px] text-foreground">
                      {s.share}&nbsp;%
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-center gap-3 text-[11.5px] text-ink-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-ocean" /> Réseau social
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-[#b5cbe3]" /> Autre source
                </span>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
