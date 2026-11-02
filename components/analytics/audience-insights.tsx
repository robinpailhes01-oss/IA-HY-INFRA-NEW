import { FileText, MessageCircleQuestion, Sparkles, TrendingUp } from "lucide-react";

import { SignaturePanel } from "@/components/dashboard/signature-panel";
import { Num } from "@/components/ui/num";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { LeaPrompt } from "@/components/social/lea-prompt";
import type { SourceGroup } from "@/components/analytics/sources";

// LE PANNEAU MARINE de l'Audience du site : ce que Léa retient du trafic.
// Une phrase (combien, et dans quel sens ça va), la première porte d'entrée,
// trois constats en étiquettes, puis la preuve : d'où viennent les visites,
// par famille de source.
//
// Les constats sont des faits : écrits à plat, sans forme de bouton. Le seul
// geste du panneau est explicite — une pilule qui ouvre Léa avec la question
// que pose le chiffre du moment (pourquoi ça baisse, qu'est-ce qui marche).

export type GroupShare = { key: SourceGroup; label: string; visitors: number; share: number };

const GROUP_BAR: Record<SourceGroup, string> = {
  social: "bg-[linear-gradient(90deg,#d4ecff,#7cc0f5)]",
  search: "bg-[#4a9bf0]",
  ai: "bg-[#a9b3ff]",
  direct: "bg-white/35",
  other: "bg-white/15",
};

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="text-[#9fd0f7]">{children}</span>;
}

export function AudienceInsights({
  periodPhrase,
  windowLabel,
  visitors,
  deltaPct,
  topSource,
  groups,
  unranked,
  aiVisitors,
  topPage,
  best,
}: {
  /** « sur les 30 derniers jours », « depuis le début ». */
  periodPhrase: string;
  windowLabel: string;
  visitors: number;
  /** Variation vs la période précédente, en %, ou null si elle n'est pas entièrement mesurée. */
  deltaPct: number | null;
  topSource: { name: string; share: number } | null;
  /** Parts calculées sur tous les visiteurs de la période. */
  groups: GroupShare[];
  /** Visiteurs que les classements quotidiens ne rattachent à aucune source. */
  unranked: { visitors: number; share: number };
  aiVisitors: number;
  topPage: { name: string; share: number } | null;
  best: { day: string; visitors: number } | null;
}) {
  const sentence =
    visitors === 0 ? (
      <>
        Aucune visite mesurée {periodPhrase}.{" "}
        <em className="text-[#9fd0f7]">Dès les premières visites</em>, je te dirai d&apos;où vient ton
        trafic.
      </>
    ) : (
      <>
        <Highlight>
          <Num>{formatNumber(visitors)}</Num>&nbsp;visiteurs
        </Highlight>{" "}
        {periodPhrase}
        {deltaPct !== null && deltaPct !== 0 ? (
          <>
            ,{" "}
            <em className="text-[#9fd0f7]">
              <Num>{`${deltaPct > 0 ? "+" : "−"}${Math.abs(deltaPct)} %`}</Num>
            </em>{" "}
            par rapport à la période d&apos;avant.
          </>
        ) : (
          <>.</>
        )}
        {topSource && (
          <>
            {" "}
            {topSource.name} est ta première porte d&apos;entrée :{" "}
            <Highlight>
              <Num>{`${topSource.share} %`}</Num>
            </Highlight>{" "}
            des visites.
          </>
        )}
      </>
    );

  const chips: Array<{ icon: React.ReactNode; text: React.ReactNode; key: string }> = [];
  if (visitors > 0) {
    chips.push({
      key: "ai",
      icon: <Sparkles />,
      text:
        aiVisitors > 0 ? (
          <>
            Les IA t&apos;ont envoyé <Num>{formatNumber(aiVisitors)}</Num>&nbsp;{aiVisitors > 1 ? "visiteurs" : "visiteur"}
          </>
        ) : (
          "Pas encore de visite venue des IA"
        ),
    });
    if (topPage) {
      chips.push({
        key: "page",
        icon: <FileText />,
        text: <>Page la plus vue : {topPage.name}</>,
      });
    }
    if (best) {
      chips.push({
        key: "best",
        icon: <TrendingUp />,
        text: (
          <>
            Record : <Num>{formatNumber(best.visitors)}</Num>&nbsp;visiteurs le {best.day}
          </>
        ),
      });
    }
  }

  const shown = groups.filter((g) => g.visitors > 0);
  // Sous 1 %, le reste hors classement n'apprend rien : on ne l'affiche pas.
  const showUnranked = unranked.share >= 1;

  // La question que pose le chiffre du moment — c'est elle que Léa reçoit.
  const ask =
    deltaPct !== null && deltaPct < 0
      ? {
          label: "Pourquoi cette baisse ?",
          question: `Le trafic du site a baissé de ${Math.abs(deltaPct)} % ${periodPhrase} (${formatNumber(visitors)} visiteurs). Qu'est-ce qui l'explique, et qu'est-ce que je peux faire ?`,
        }
      : deltaPct !== null && deltaPct > 0
        ? {
            label: "Qu'est-ce qui fait monter le trafic ?",
            question: `Le trafic du site a progressé de ${deltaPct} % ${periodPhrase}. Qu'est-ce qui marche, et comment l'amplifier ?`,
          }
        : {
            label: "Comment avoir plus de visites ?",
            question: "Qu'est-ce qui amène du monde sur harmonie-yacht.fr en ce moment, et que faire pour en avoir plus ?",
          };

  return (
    <SignaturePanel className="h-full">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10">
        {/* La voix : qui parle, ce qu'elle retient, trois constats. */}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#7cc0f5,#2f7fe0)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_20px_-8px_rgba(47,127,224,0.8)] [&_svg]:size-[18px]">
              <Sparkles />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-white">Léa · audience du site</p>
              <p className="truncate text-[12px] text-[#9fbfe2]">{windowLabel}</p>
            </div>
          </div>

          <p className="t-eyebrow mt-7 text-[#9fc6ee]">Ce que l&apos;agent retient</p>
          <p className="t-panel mt-2.5 max-w-[36rem] text-white">{sentence}</p>

          {chips.length > 0 && (
            <ul className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6" aria-label="Constats">
              {chips.map((c) => (
                <li
                  key={c.key}
                  className="flex items-center gap-2 text-[12.5px] leading-snug text-[#cfe2f7] [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-[#9fd0f7]"
                >
                  {c.icon}
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5">
            <LeaPrompt question={ask.question} icon={<MessageCircleQuestion />}>
              {ask.label}
            </LeaPrompt>
          </div>
        </div>

        {/* La preuve : d'où viennent les visites, par famille. */}
        {shown.length > 0 && (
          <div className="flex min-w-0 flex-col justify-end border-t border-white/10 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
            <div className="flex items-end justify-between gap-3">
              <p className="t-label text-[#9fbfe2]">D&apos;où viennent les visites</p>
              <p className="text-[11.5px] text-[#9fbfe2]/80">par famille de source</p>
            </div>
            <div className="mt-4 flex h-3 w-full gap-1 overflow-hidden rounded-full" aria-hidden>
              {shown.map((g) => (
                <span
                  key={g.key}
                  className={cn("h-full rounded-full", GROUP_BAR[g.key])}
                  style={{ width: `${Math.max(2, g.share)}%` }}
                />
              ))}
              {showUnranked && (
                <span
                  className="h-full rounded-full bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.22)_0_3px,rgba(255,255,255,0.06)_3px_6px)]"
                  style={{ width: `${unranked.share}%` }}
                />
              )}
            </div>
            {/* Une famille à zéro n'apprend rien ici (l'absence d'IA est déjà
                dite dans les constats) : seules les familles présentes. */}
            <ul className="mt-4 flex flex-col">
              {shown.map((g) => (
                <li
                  key={g.key}
                  className="flex items-center gap-3 border-t border-white/[0.07] py-2 first:border-t-0"
                >
                  <span className={cn("size-2 shrink-0 rounded-full", GROUP_BAR[g.key])} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[#cfe2f7]">{g.label}</span>
                  <Num className="text-[12px] text-[#9fbfe2]">{`${formatNumber(g.visitors)} vis.`}</Num>
                  <Num
                    className={cn(
                      "n-inline w-12 text-right text-[15px]",
                      g.visitors > 0 ? "text-white" : "text-[#9fbfe2]/50",
                    )}
                  >
                    {`${g.share} %`}
                  </Num>
                </li>
              ))}
              {showUnranked && (
                <li className="flex items-center gap-3 border-t border-white/[0.07] py-2">
                  <span className="size-2 shrink-0 rounded-full bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.5)_0_2px,rgba(255,255,255,0.15)_2px_4px)]" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[#9fbfe2]">Hors classement</span>
                  <Num className="text-[12px] text-[#9fbfe2]/80">{`${formatNumber(unranked.visitors)} vis.`}</Num>
                  <Num className="n-inline w-12 text-right text-[15px] text-[#9fbfe2]">{`${unranked.share} %`}</Num>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </SignaturePanel>
  );
}
