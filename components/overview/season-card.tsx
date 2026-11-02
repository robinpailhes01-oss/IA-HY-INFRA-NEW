import { Target } from "lucide-react";

import { CapsuleChart } from "@/components/dashboard/capsule-chart";
import { RevenueGauge } from "@/components/dashboard/revenue-gauge";
import { CardLink } from "@/components/overview/card-link";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { formatEur } from "@/lib/format";

// La saison en une carte : à gauche le chiffre d'affaires mois par mois, à
// droite où on en est de l'objectif. Le total de l'année est déjà dans la
// rangée de chiffres au-dessus — on ne le répète pas ici, on le DÉCOMPOSE.

export type SeasonGoal = {
  min: number;
  medium: number;
  strong: number;
  /** CA encaissé entre le début et la fin de la période de l'objectif. */
  current: number;
  /** « 1 avr. – 31 oct. » */
  periodLabel: string;
};

export function SeasonCard({
  year,
  months,
  caMonth,
  monthLabel,
  outstanding,
  closed = false,
  goal,
  className,
}: {
  year: number;
  /** Janvier → mois courant ; `display` déjà formaté côté serveur. */
  months: Array<{ label: string; value: number; display: string }>;
  caMonth: number;
  monthLabel: string;
  outstanding: number;
  /** La période de l'objectif est terminée : le cadran devient un bilan. */
  closed?: boolean;
  goal: SeasonGoal | null;
  className?: string;
}) {
  const best = months.reduce<(typeof months)[number] | null>(
    (b, m) => (m.value > 0 && (!b || m.value > b.value) ? m : b),
    null,
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Saison {year}</CardTitle>
        <CardDescription>
          Chiffre d&apos;affaires encaissé, mois par mois
          {goal ? ` · objectif du ${goal.periodLabel}` : ""}
        </CardDescription>
        <CardAction>
          <CardLink href="/finances" label="Ouvrir la Finance" />
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_212px] md:gap-8">
          <div className="min-w-0">
            <dl className="grid grid-cols-3 gap-3 sm:flex sm:flex-wrap sm:gap-x-10 sm:gap-y-3">
              <div className="min-w-0">
                <dt className="t-label truncate text-ink-3">En {monthLabel}</dt>
                <dd>
                  <Num className="n-inline mt-1 block text-[17px] text-foreground sm:text-[19px]">{formatEur(caMonth)}</Num>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="t-label truncate text-ink-3">À encaisser</dt>
                <dd>
                  <Num className="n-inline mt-1 block text-[17px] text-foreground sm:text-[19px]">{formatEur(outstanding)}</Num>
                </dd>
              </div>
              {best && (
                <div className="min-w-0">
                  <dt className="t-label truncate text-ink-3">Record · {best.label}</dt>
                  <dd>
                    <Num className="n-inline mt-1 block text-[17px] text-foreground sm:text-[19px]">{best.display}</Num>
                  </dd>
                </div>
              )}
            </dl>
            {months.some((m) => m.value > 0) ? (
              <CapsuleChart data={months} className="mb-7 mt-9" />
            ) : (
              <EmptyState title="Pas encore de chiffre d'affaires cette année" className="mt-6 py-8">
                Les revenus enregistrés dessineront ici la saison, mois par mois.
              </EmptyState>
            )}
          </div>

          <div className="border-t border-[var(--hairline)] pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
            {goal ? (
              <RevenueGauge
                current={goal.current}
                min={goal.min}
                medium={goal.medium}
                strong={goal.strong}
                closed={closed}
              />
            ) : (
              <EmptyState icon={<Target />} title="Pas d'objectif de saison" className="h-full py-8">
                Fixe tes trois paliers — minimum, moyen, fort — pour suivre la saison ici.
              </EmptyState>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
