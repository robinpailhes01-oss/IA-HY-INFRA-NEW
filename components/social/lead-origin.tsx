import Link from "next/link";
import { ArrowUpRight, Search, Sparkles, UserRoundSearch } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { ChannelLogo } from "@/components/leads/channel-logo";
import { PlatformGlyph } from "@/components/social/platform-glyph";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

// D'OÙ VIENNENT LES LEADS — l'origine que Léa note sur chaque prospect
// (leads.source_channel). C'est le chaînon entre « vu sur Instagram » et
// « a réservé » : un réseau qui fait des vues sans faire de leads ne
// remplit pas le bateau.
//
// Le site internet est exclu, comme partout en marketing : tout le monde
// finit par passer par le site, ce n'est pas une source.

export type LeadOriginRow = { channel: string | null; label: string; count: number; share: number; social: boolean };

/** Le glyphe de marque quand il existe, sinon l'icône générique du canal. */
function SourceGlyph({ channel }: { channel: string | null }) {
  const c = channel ?? "";
  if (c.startsWith("tiktok")) return <PlatformGlyph platform="tiktok" className="size-4" />;
  if (c === "meta_ads" || c.startsWith("facebook")) return <PlatformGlyph platform="facebook" className="size-4" />;
  // Recherche et IA : pas de logo de marque ici, une icône sobre qui dit la
  // famille (la loupe pour Google, l'étincelle pour ChatGPT & co).
  if (c.startsWith("google")) return <Search className="size-4 text-ocean" />;
  if (c === "chatgpt" || c === "perplexity" || c === "ai_other") return <Sparkles className="size-4 text-indigo" />;
  return <ChannelLogo channel={channel} className="size-4 text-ink-2" />;
}

export function LeadOrigin({ rows, total, period }: { rows: LeadOriginRow[]; total: number; period: string }) {
  const shown = rows.slice(0, 6);
  const rest = rows.slice(6).reduce((s, r) => s + r.count, 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>D&apos;où viennent les leads</CardTitle>
        <CardDescription>Origine notée par Léa · {period}</CardDescription>
        <CardAction>
          <Link
            href="/leads"
            aria-label="Ouvrir les leads"
            className="grid size-11 place-items-center rounded-full bg-white/80 text-ink-2 shadow-[var(--shadow-glass)] transition-colors hover:text-ocean lg:size-9"
          >
            <ArrowUpRight className="size-4" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {total === 0 ? (
          <EmptyState icon={<UserRoundSearch />} title="Aucun lead sur la période" className="flex-1 py-8">
            Dès que Léa enregistre un prospect avec son origine, tu verras ici quels canaux font
            vraiment venir du monde.
          </EmptyState>
        ) : (
          <>
            {/* La liste occupe la hauteur de la carte (elle s'aligne sur
                « Meilleurs contenus ») : les lignes s'espacent, la légende
                reste en pied. */}
            <ul className="flex flex-1 flex-col justify-between gap-3">
              {shown.map((r) => (
                <li key={r.channel ?? "none"} className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white shadow-[var(--shadow-glass)]">
                    <SourceGlyph channel={r.channel} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">{r.label}</span>
                      <span className="shrink-0 text-[12px] text-ink-3">
                        <Num className="n-inline text-[13px] text-foreground">{formatNumber(r.count)}</Num>
                        <span className="ml-1.5 inline-block w-9 text-right tabular-nums">{r.share}&nbsp;%</span>
                      </span>
                    </div>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[rgba(11,37,69,0.06)]">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          r.social ? "bg-[linear-gradient(90deg,#9aa6f7,#6d7cf2)]" : "bg-[#c9dcf0]",
                        )}
                        style={{ width: `${Math.max(3, r.share)}%` }}
                      />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-4 text-[11.5px] text-ink-3">
              <span className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-indigo" /> Réseaux sociaux
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#c9dcf0]" /> Autres canaux
                </span>
              </span>
              <span>Site exclu{rest > 0 ? ` · ${rest} ailleurs` : ""}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
