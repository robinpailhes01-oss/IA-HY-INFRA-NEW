import { LineChart } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { TrendChart, type TrendPoint } from "@/components/charts/trend-chart";
import { formatNumber } from "@/lib/format";
import { dec1 } from "@/components/social/model";

// CROISSANCE DU TRAFIC — visiteurs et pages vues dans le temps. Deux chiffres
// de lecture au-dessus de la courbe (moyenne par jour, pages par visite) : la
// courbe montre la forme, eux donnent l'ordre de grandeur.

export function TrafficCard({
  series,
  grain,
  perDay,
  pagesPerVisit,
}: {
  series: TrendPoint[];
  /** « par jour », « par semaine », « par mois ». */
  grain: string;
  perDay: number;
  pagesPerVisit: number | null;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Croissance du trafic</CardTitle>
        <CardDescription>Visiteurs et pages vues, {grain}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        {series.length === 0 ? (
          <EmptyState icon={<LineChart />} title="Aucune donnée sur cette période" className="flex-1">
            Choisis une période plus longue, ou attends les premières visites mesurées.
          </EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="t-label text-ink-2">Visiteurs par jour</p>
                <p className="mt-1.5 flex items-baseline gap-1.5">
                  <Num className="n-kpi text-foreground">{formatNumber(Math.round(perDay))}</Num>
                  <span className="text-[12.5px] text-ink-3">en moyenne</span>
                </p>
              </div>
              {pagesPerVisit !== null && (
                <div>
                  <p className="t-label text-ink-2">Pages par visite</p>
                  <p className="mt-1.5">
                    <Num className="n-kpi text-foreground">{dec1(pagesPerVisit)}</Num>
                  </p>
                </div>
              )}
              <div className="ml-auto flex gap-4 pb-0.5 text-[11.5px] text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-ocean" /> Visiteurs
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#9fd0f7]" /> Pages vues
                </span>
              </div>
            </div>
            <div className="mt-auto">
              <TrendChart data={series} a={{ name: "Visiteurs" }} b={{ name: "Pages vues" }} height={264} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
