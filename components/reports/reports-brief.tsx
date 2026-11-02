import { Compass } from "lucide-react";

import { SignaturePanel } from "@/components/dashboard/signature-panel";
import { Num } from "@/components/ui/num";
import { AskLeaButton } from "@/components/finance/ask-lea-button";
import { BriefTile } from "@/components/finance/brief-tile";
import { formatEur, formatNumber } from "@/lib/format";
import { plural } from "@/components/finance/fin-utils";

// LA LECTURE DE LÉA sur les rapports — le panneau marine de la page.
//
// Des faits, pas une analyse : le canal qui amène le plus de clients sur
// douze mois (la phrase), puis trois repères — la valeur des sorties sur
// l'année glissante, le meilleur mois, et la part des réservations dont on
// connaît l'origine (ce qui dit si le classement est fiable). Tout est
// calculé à partir des mêmes séries que les graphiques en dessous : le
// panneau ne peut pas les contredire.

/** 145 280 € → « 145 k€ » : une tuile n'a pas la place d'un montant exact. */
function compactEur(v: number): string {
  return v >= 10_000 ? `${formatNumber(Math.round(v / 1000))}\u00a0k€` : formatEur(v);
}

export function ReportsBrief({
  topChannel,
  runnersUp,
  bestMonth,
  year,
  knownCount,
  unknownCount,
  className,
}: {
  /** Canal n° 1 sur 12 mois (hors site web et hors « inconnu »). */
  topChannel: { label: string; count: number; share: number } | null;
  /** Les canaux n° 2 et 3, pour la phrase d'appui. */
  runnersUp: string[];
  /** Le meilleur des 12 derniers mois : « août » et sa valeur. */
  bestMonth: { short: string; revenue: number } | null;
  /** Valeur et nombre des sorties sur les 12 mois glissants (site web compris). */
  year: { revenue: number; count: number };
  /** Réservations des 12 mois (hors site web) dont le canal est renseigné. */
  knownCount: number;
  /** Réservations des 12 mois dont le canal n'est pas renseigné. */
  unknownCount: number;
  className?: string;
}) {
  const traced = knownCount + unknownCount;
  const tracedShare = traced > 0 ? Math.round((knownCount / traced) * 100) : null;

  return (
    <SignaturePanel
      className={className}
      eyebrow={
        <span className="inline-flex items-center gap-2">
          <span className="grid size-[22px] place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#7cc0f5_0%,#2f7fe0_55%,#13355e_100%)] shadow-[0_0_0_3px_rgba(124,192,245,0.14),0_4px_12px_-4px_rgba(47,127,224,0.8)]">
            <Compass className="size-3 text-white" strokeWidth={2} />
          </span>
          La lecture de Léa
        </span>
      }
      action={
        <AskLeaButton
          tone="dark"
          question="D'après mes réservations par canal, quel canal dois-je renforcer cette saison, et pourquoi ?"
          label="Quel canal renforcer ?"
          shortLabel="Conseil"
        />
      }
    >
      <h2 className="sr-only">Lecture des rapports</h2>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end lg:gap-8">
        <div className="min-w-0">
          {topChannel ? (
            <p className="t-panel max-w-[40rem] text-white [&_em]:text-[#9fd0f7]">
              Sur douze mois, <em>{topChannel.label}</em> t&apos;amène le plus de clients :{" "}
              {topChannel.count} {plural(topChannel.count, "réservation", "réservations")}, soit{" "}
              <em>{topChannel.share} %</em> de celles dont on connaît l&apos;origine.
            </p>
          ) : (
            <p className="t-panel max-w-[40rem] text-white [&_em]:text-[#9fd0f7]">
              Pas encore assez de réservations <em>renseignées</em> pour dire d&apos;où viennent les clients.
            </p>
          )}
          {unknownCount > 0 ? (
            <p className="t-body mt-3 max-w-[36rem] text-[#f7d3a6]">
              {unknownCount} {plural(unknownCount, "réservation", "réservations")} sans canal renseigné : complète-les
              depuis Réservations pour que ce classement reste juste.
            </p>
          ) : runnersUp.length > 0 ? (
            <p className="t-body mt-3 max-w-[36rem] text-[#a9c3e0]">
              Viennent ensuite {runnersUp.join(" et ")}.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <BriefTile
            label="Sur 12 mois"
            shortLabel="12 mois"
            value={<Num>{compactEur(year.revenue)}</Num>}
            detail={`${year.count} ${plural(year.count, "sortie", "sorties")}`}
          />
          <BriefTile
            label="Meilleur mois"
            shortLabel="Record"
            value={<span className="capitalize">{bestMonth && bestMonth.revenue > 0 ? bestMonth.short : "—"}</span>}
            detail={bestMonth && bestMonth.revenue > 0 ? <Num>{formatEur(bestMonth.revenue)}</Num> : "pas encore"}
          />
          {/* La part des réservations dont on sait d'où elles viennent : en
              dessous de 100 %, le classement des canaux est incomplet — la
              tuile mène là où on le complète. */}
          <BriefTile
            label="Origine connue"
            shortLabel="Origine"
            value={tracedShare != null ? `${tracedShare} %` : "—"}
            detail={unknownCount > 0 ? `${unknownCount} à compléter` : traced > 0 ? "tout est renseigné" : "aucune réservation"}
            alert={unknownCount > 0}
            href={unknownCount > 0 ? "/bookings" : undefined}
          />
        </div>
      </div>
    </SignaturePanel>
  );
}
