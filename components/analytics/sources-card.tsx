import { ChevronDown, Compass, FileText } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { SourceGlyph } from "@/components/analytics/source-glyph";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { dec1 } from "@/components/social/model";
import type { SourceGlyphKind, SourceGroup } from "@/components/analytics/sources";

// D'OÙ VIENNENT LES VISITES — le classement des référents sur la période,
// et les pages qui retiennent. Une table de verre : des lignes séparées par
// un filet, pas de grille, des chiffres alignés à droite en chasse fixe.
//
// Les moteurs IA (ChatGPT, Perplexity, Gemini, Claude…) portent une pastille :
// c'est le travail GEO qu'on veut voir progresser à part du SEO classique.

export type SourceRow = {
  hostname: string;
  name: string;
  group: SourceGroup;
  glyph: SourceGlyphKind;
  visitors: number;
  pageviews: number;
  /** Part des visiteurs de la période, en % (une décimale). */
  share: number;
};

const BAR: Record<SourceGroup, string> = {
  social: "bg-[linear-gradient(90deg,#7cc0f5,#2f7fe0)]",
  search: "bg-[linear-gradient(90deg,#5aaef0,#0b2545)]",
  ai: "bg-[linear-gradient(90deg,#b3bcff,#6d7cf2)]",
  direct: "bg-[#c9dcf0]",
  other: "bg-[#c9dcf0]",
};

/** La part en texte : « 26 % », « 0,8 % » — pas de décimale au-delà de 10 %. */
function shareText(n: number): string {
  return n >= 10 ? `${Math.round(n)} %` : `${dec1(n)} %`;
}

function SourceLine({ r, max }: { r: SourceRow; max: number }) {
  const caption =
    r.group === "direct" || r.name.toLowerCase() === r.hostname.replace(/^www\./, "").toLowerCase() ? null : r.hostname;
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-[var(--hairline)] py-2.5 first:border-t-0 sm:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_4.5rem_5rem_3.5rem] sm:gap-4">
      <SourceGlyph kind={r.glyph} />
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13.5px] font-medium text-foreground">{r.name}</span>
          {r.group === "ai" && <span className="pastille shrink-0 bg-[rgba(109,124,242,0.12)] text-indigo">IA</span>}
        </p>
        {caption && <p className="truncate text-[11.5px] text-ink-3">{caption}</p>}
      </div>
      {/* Téléphone : visiteurs et part empilés à droite. */}
      <div className="text-right sm:hidden">
        <Num className="n-inline block text-[13.5px] text-foreground">{formatNumber(r.visitors)}</Num>
        <span className="text-[11.5px] tabular-nums text-ink-3">{shareText(r.share)}</span>
      </div>
      <span className="hidden h-1.5 max-w-80 overflow-hidden rounded-full bg-[rgba(11,37,69,0.06)] sm:block">
        <span
          className={cn("block h-full rounded-full", BAR[r.group])}
          style={{ width: `${Math.max(3, (r.visitors / max) * 100)}%` }}
        />
      </span>
      <Num className="n-inline hidden text-right text-[13.5px] text-foreground sm:block">{formatNumber(r.visitors)}</Num>
      <Num className="n-inline hidden text-right text-[13px] text-ink-2 sm:block">{formatNumber(r.pageviews)}</Num>
      <span className="hidden text-right text-[13px] tabular-nums text-ink-2 sm:block">{shareText(r.share)}</span>
    </li>
  );
}

export function SourcesCard({ rows, period }: { rows: SourceRow[]; period: string }) {
  const head = rows.slice(0, 8);
  const tail = rows.slice(8);
  const max = Math.max(1, ...rows.map((r) => r.visitors));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>D&apos;où viennent les visites</CardTitle>
        <CardDescription>
          {rows.length > 0
            ? `${rows.length} ${rows.length > 1 ? "sources" : "source"} · ${period} · les moteurs IA sont signalés à part`
            : period}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {rows.length === 0 ? (
          <EmptyState icon={<Compass />} title="Aucun référent sur la période" className="flex-1">
            Les sites, réseaux et moteurs qui t&apos;envoient des visiteurs apparaîtront ici dès les
            premières visites mesurées.
          </EmptyState>
        ) : (
          <>
            <div className="hidden grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_4.5rem_5rem_3.5rem] gap-4 pb-2 text-[11.5px] font-medium text-ink-3 sm:grid">
              <span className="w-9" />
              <span>Source</span>
              <span />
              <span className="text-right">Visiteurs</span>
              <span className="text-right">Pages vues</span>
              <span className="text-right">Part</span>
            </div>
            <ul className="flex flex-col">
              {head.map((r) => (
                <SourceLine key={r.hostname} r={r} max={max} />
              ))}
            </ul>
            {tail.length > 0 && (
              // <details> natif : aucune donnée cachée derrière du JavaScript, et
              // ça marche au doigt comme au clavier.
              <details className="group/more mt-1">
                <summary className="mx-auto mt-2 flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-ocean transition-colors hover:bg-white/70 lg:min-h-9 [&::-webkit-details-marker]:hidden">
                  <span className="group-open/more:hidden">
                    Voir les {tail.length} autres {tail.length > 1 ? "sources" : "source"}
                  </span>
                  <span className="hidden group-open/more:inline">Replier</span>
                  <ChevronDown className="size-4 transition-transform group-open/more:rotate-180" />
                </summary>
                <ul className="mt-2 flex flex-col border-t border-[var(--hairline)]">
                  {tail.map((r) => (
                    <SourceLine key={r.hostname} r={r} max={max} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export type PageRowView = { path: string; name: string; visitors: number; pageviews: number; share: number };

export function PagesCard({ rows, period }: { rows: PageRowView[]; period: string }) {
  const shown = rows.slice(0, 7);
  const max = Math.max(1, ...shown.map((r) => r.visitors));
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Pages les plus vues</CardTitle>
        <CardDescription>Classées par visiteurs · {period}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {shown.length === 0 ? (
          <EmptyState icon={<FileText />} title="Aucune page mesurée sur la période" className="flex-1">
            Les pages de harmonie-yacht.fr les plus consultées apparaîtront ici.
          </EmptyState>
        ) : (
          <ol className="flex flex-col gap-3.5">
            {shown.map((r, i) => (
              <li key={r.path} className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums",
                    i === 0 ? "bg-[linear-gradient(180deg,#183f6d,#0b2545)] text-white" : "bg-[rgba(11,37,69,0.05)] text-ink-2",
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13.5px] font-medium text-foreground">{r.name}</span>
                    <span className="shrink-0 text-[12px] text-ink-3">
                      <Num className="n-inline text-[13.5px] text-foreground">{formatNumber(r.visitors)}</Num>
                      <span className="ml-1.5 inline-block w-11 text-right tabular-nums">{shareText(r.share)}</span>
                    </span>
                  </div>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[rgba(11,37,69,0.06)]">
                    <span
                      className="block h-full rounded-full bg-[linear-gradient(90deg,#7cc0f5,#2f7fe0)]"
                      style={{ width: `${Math.max(3, (r.visitors / max) * 100)}%` }}
                    />
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
