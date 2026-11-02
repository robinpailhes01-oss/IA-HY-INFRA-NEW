import { ArrowUpRight, Clapperboard } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { PlatformGlyph } from "@/components/social/platform-glyph";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { dec1, plural, type Platform } from "@/components/social/model";

// MEILLEURS CONTENUS — classés par leads, puis par vues. Un Reel à 40 000 vues
// qui n'a fait venir personne compte moins qu'une story à 900 vues qui a
// déclenché deux demandes : l'objectif n'est pas d'être vu, c'est de remplir
// le bateau.

export type TopItem = {
  id: string;
  title: string;
  platform: Platform | null;
  format: string;
  date: string; // « 12 oct. »
  views: number;
  rate: number | null;
  leads: number;
  url: string | null;
};

export function TopContent({ items }: { items: TopItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState icon={<Clapperboard />} title="Aucune publication sur la période">
        Les contenus publiés et leurs statistiques apparaîtront ici dès qu&apos;ils seront notés
        dans le carnet.
      </EmptyState>
    );
  }
  const maxViews = Math.max(1, ...items.map((i) => i.views));

  return (
    <ol className="flex flex-col">
      {items.map((it, i) => {
        const body = (
          <>
            <span
              className={cn(
                "hidden size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums sm:grid",
                i === 0 ? "bg-[linear-gradient(180deg,#183f6d,#0b2545)] text-white" : "bg-[rgba(11,37,69,0.05)] text-ink-2",
              )}
            >
              {i + 1}
            </span>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white shadow-[var(--shadow-glass)]">
              {it.platform && <PlatformGlyph platform={it.platform} className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[13.5px] font-medium text-foreground">
                {/* Deux lignes au téléphone : « EVJF : la journée parfaite en … »
                    ne disait pas de quel contenu il s'agissait. */}
                <span className="line-clamp-2 sm:line-clamp-none sm:truncate">{it.title}</span>
                {it.url && <ArrowUpRight className="size-3.5 shrink-0 text-ink-3 transition-colors group-hover/row:text-ocean" />}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="truncate text-[12px] text-ink-3">
                  {it.format}
                  {/* Sur téléphone, les vues remplacent la date dans la ligne
                      de détail : une colonne de plus écraserait le titre. */}
                  <span className="hidden sm:inline"> · {it.date}</span>
                  <span className="sm:hidden">
                    {" · "}
                    <Num>{formatNumber(it.views)}</Num> vues
                  </span>
                </span>
                <span className="hidden h-1 w-16 shrink-0 overflow-hidden rounded-full bg-[rgba(11,37,69,0.06)] sm:block">
                  <span
                    className="block h-full rounded-full bg-sky"
                    style={{ width: `${Math.max(4, (it.views / maxViews) * 100)}%` }}
                  />
                </span>
              </div>
            </div>
            <div className="hidden w-20 shrink-0 text-right sm:block">
              <p className="text-[11px] text-ink-3">Engagement</p>
              <p className="n-inline text-[13px] text-ink-2">{it.rate === null ? "—" : <Num>{`${dec1(it.rate)} %`}</Num>}</p>
            </div>
            <div className="hidden w-[68px] shrink-0 text-right sm:block">
              <p className="text-[11px] text-ink-3">Vues</p>
              <p className="n-inline text-[13.5px] text-foreground">
                <Num>{formatNumber(it.views)}</Num>
              </p>
            </div>
            <span
              className={cn(
                "pastille w-[66px] shrink-0 justify-center",
                it.leads > 0 ? "bg-[rgba(109,124,242,0.12)] text-indigo" : "bg-[rgba(11,37,69,0.04)] text-ink-3",
              )}
            >
              {it.leads > 0 ? `${it.leads} ${plural(it.leads, "lead", "leads")}` : "0 lead"}
            </span>
          </>
        );
        return (
          <li key={it.id} className="border-t border-[var(--hairline)] first:border-t-0">
            {it.url ? (
              <a
                href={it.url}
                target="_blank"
                rel="noreferrer"
                className="group/row -mx-2 flex min-h-14 items-center gap-3 rounded-[16px] px-2 py-2.5 transition-colors hover:bg-white/60"
              >
                {body}
              </a>
            ) : (
              <div className="flex min-h-14 items-center gap-3 py-2.5">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
