import { MotionCard } from "@/components/dashboard/motion-card";
import { Num } from "@/components/ui/num";
import { PlatformGlyph } from "@/components/social/platform-glyph";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { dec1, plural, type Platform } from "@/components/social/model";

// Une plateforme, une plaque : la marque, ce qu'elle a fait voir, ce qu'elle
// a fait venir. Le glyphe porte la couleur de la marque ; tout le reste reste
// dans la gamme maritime — quatre logos de couleur suffisent, quatre
// graphiques de couleur seraient une foire.

export type PlatformStat = {
  platform: Platform;
  label: string;
  posts: number;
  views: number;
  /** Interactions / vues, en %. null si aucune vue. */
  rate: number | null;
  leads: number;
  /** Part des vues de la période, 0–100. */
  share: number;
  /** « 8 Reels · 3 posts · 1 story » */
  formats: string;
};

// Pas de badge « meilleure plateforme » ici : ce verdict appartient au
// panneau de Léa (fenêtre fixe de 90 jours). Un second classement, calculé
// sur la période choisie, désignait une autre plateforme deux cartes plus
// bas — deux voix qui se contredisent. Les cartes donnent les chiffres ;
// Léa tranche.

export function PlatformCard({ stat, index }: { stat: PlatformStat; index: number }) {
  const empty = stat.posts === 0;
  return (
    <MotionCard index={index} className="h-full">
      <div className="vitre relative flex h-full flex-col overflow-hidden rounded-[24px] p-4 sm:p-5">
        <div className="relative z-[1] flex items-start justify-between gap-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white shadow-[var(--shadow-glass)]">
            <PlatformGlyph platform={stat.platform} className="size-[19px]" />
          </span>
          {!empty ? (
            <span className="pastille bg-[rgba(11,37,69,0.05)] text-ink-2">
              <Num>{`${stat.share} %`}</Num>
              {/* .pastille espace déjà ses enfants (gap) : pas d'espace en plus. */}
              <span className="hidden sm:inline">des vues</span>
            </span>
          ) : null}
        </div>

        <p className="t-card relative z-[1] mt-3.5 truncate text-foreground">{stat.label}</p>
        <p className="relative z-[1] mt-0.5 truncate text-[12px] text-ink-3">
          {empty ? "Aucune publication sur la période" : stat.formats}
        </p>

        <div className="relative z-[1] mt-4 flex items-baseline gap-1.5">
          <Num className={cn("n-kpi", empty ? "text-ink-3/70" : "text-foreground")}>
            {formatNumber(stat.views)}
          </Num>
          <span className="text-[12.5px] font-medium text-ink-2">vues</span>
        </div>

        {/* Part des vues : la même échelle pour les quatre cartes. */}
        <div className="relative z-[1] mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(11,37,69,0.06)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#7cc0f5,#2f7fe0)]"
            style={{ width: `${Math.max(empty ? 0 : 3, stat.share)}%` }}
          />
        </div>

        <dl className="relative z-[1] mt-auto grid grid-cols-2 gap-2 pt-4">
          <div className="min-w-0">
            <dt className="text-[11.5px] text-ink-3">Engagement</dt>
            <dd className="n-inline mt-0.5 text-[15px] text-foreground">
              {stat.rate === null ? "—" : <Num>{`${dec1(stat.rate)} %`}</Num>}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11.5px] text-ink-3">Leads</dt>
            <dd className={cn("n-inline mt-0.5 text-[15px]", stat.leads > 0 ? "text-indigo" : "text-foreground")}>
              <Num>{formatNumber(stat.leads)}</Num>
              {stat.posts > 0 && (
                <span className="ml-1 text-[11.5px] font-normal text-ink-3">
                  / {stat.posts} {plural(stat.posts, "post", "posts")}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </MotionCard>
  );
}
