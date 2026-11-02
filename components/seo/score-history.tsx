import { History } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { scoreTone } from "@/components/seo/score-ring";

// ÉVOLUTION DU SCORE — un audit, une capsule. Même grammaire que les barres
// du reste du tableau de bord (rail de glace, remplissage arrondi), teintée
// selon le seuil atteint : on voit le site sortir du rouge.

export type HistoryPoint = { id: string; score: number; date: string };

const FILL: Record<"danger" | "warning" | "success", string> = {
  danger: "bg-[linear-gradient(180deg,#f6a3a8,#e04d55)]",
  warning: "bg-[linear-gradient(180deg,#f6c98f,#d9822b)]",
  success: "bg-[linear-gradient(180deg,#7fe0bb,#0f9f6e)]",
};

export function ScoreHistory({ points }: { points: HistoryPoint[] }) {
  const first = points[0];
  const last = points[points.length - 1];
  const gain = first && last ? last.score - first.score : 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Évolution du score</CardTitle>
        <CardDescription>
          {points.length > 1
            ? `${gain >= 0 ? "+" : "−"}${Math.abs(gain)} pts en ${points.length} audits`
            : "Un point par audit, du plus ancien au plus récent"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {points.length < 2 ? (
          <EmptyState icon={<History />} title="Un seul audit pour l'instant" className="flex-1">
            La courbe se dessine dès le deuxième passage de l&apos;Auditeur.
          </EmptyState>
        ) : (
          <ol className="flex min-h-48 flex-1 items-stretch justify-between gap-1.5 pt-2 sm:gap-2.5" aria-label="Score par audit">
            {points.map((p, i) => {
              const latest = i === points.length - 1;
              const tone = scoreTone(p.score);
              return (
                <li key={p.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <span
                    className={cn(
                      "text-[12px] tabular-nums",
                      latest ? "font-semibold text-foreground" : "font-medium text-ink-2",
                    )}
                  >
                    {p.score}
                  </span>
                  <div
                    className={cn(
                      "relative min-h-28 w-full max-w-[34px] flex-1 overflow-hidden rounded-full bg-[rgba(11,37,69,0.06)] shadow-[inset_0_1px_2px_rgba(11,37,69,0.06)]",
                      latest && "ring-2 ring-white shadow-[0_6px_16px_-8px_rgba(11,37,69,0.45)]",
                    )}
                  >
                    <span
                      className={cn("animate-grow absolute inset-x-0 bottom-0 rounded-full", FILL[tone], !latest && "opacity-75")}
                      style={{ height: `${Math.max(8, p.score)}%`, animationDelay: `${80 + i * 50}ms` }}
                    />
                  </div>
                  <span className={cn("whitespace-nowrap text-[10.5px]", latest ? "font-semibold text-foreground" : "text-ink-3")}>
                    {p.date}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
