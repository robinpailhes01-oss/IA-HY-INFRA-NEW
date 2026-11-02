import { CalendarClock, CalendarX2, Repeat2, Sparkles } from "lucide-react";

import { SignaturePanel } from "@/components/dashboard/signature-panel";
import { Num } from "@/components/ui/num";
import { cn } from "@/lib/utils";
import { LeaPrompt } from "@/components/social/lea-prompt";
import { dec1, plural } from "@/components/social/model";
import { timesWord, withArticle, type SocialInsights } from "@/components/social/insights";
import { JOURS, JOURS_INITIALES } from "@/components/social/time";

// LE PANNEAU MARINE de Réseaux sociaux : ce que Léa retient du carnet de
// contenus. Une phrase (la leçon), deux ou trois choses à faire, puis la
// preuve en image — la performance par jour de publication.
//
// Les pistes se touchent : chacune ouvre Léa (le vrai agent Manager) avec la
// question déjà posée — préparer le post, décliner le contenu qui a marché,
// voir la semaine. Il n'y a toujours pas de connexion Instagram : c'est Léa
// qui aide à faire, pas un bouton « publier » qui mentirait.

export type NextPost = {
  when: string; // « demain à 18 h »
  format: string; // « Reel »
  title: string;
  withinWeek: boolean;
} | null;

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="text-[#9fd0f7]">{children}</span>;
}

/** « que Instagram » → « qu'Instagram ». */
function que(label: string): string {
  return /^[aeiouyéèêàâîôûh]/i.test(label) ? `qu'${label}` : `que ${label}`;
}

/** 5 → « 5 », 1,44 → « 1,4 » : pas de « ,0 » qui ferait faux-précis. */
function ratioText(r: number): string {
  return Math.abs(r - Math.round(r)) < 0.05 ? String(Math.round(r)) : dec1(r);
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export function AgentInsights({ insights, nextPost }: { insights: SocialInsights; nextPost: NextPost }) {
  const { bestPlatform, runnerUp, bestDay, bestHour, star, analysed, totalLeads } = insights;
  const enough = analysed >= 3;

  // ── La phrase ───────────────────────────────────────────────────────────
  let sentence: React.ReactNode;
  if (!enough) {
    sentence = (
      <>
        Pas encore assez de publications pour tirer des leçons.{" "}
        <em className="text-[#9fd0f7]">Dès trois contenus au carnet</em>, je te dirai ce qui marche.
      </>
    );
  } else {
    const platformPart = bestPlatform ? (
      <>
        Sur {bestPlatform.label}, chaque publication t&apos;amène{" "}
        <Highlight>
          <Num>{ratioText(bestPlatform.ratio)}</Num>&nbsp;{plural(bestPlatform.ratio, "lead", "leads")}
        </Highlight>
        {runnerUp && runnerUp.ratio > 0 && timesWord(bestPlatform.ratio / runnerUp.ratio) ? (
          <> — {timesWord(bestPlatform.ratio / runnerUp.ratio)} plus {que(runnerUp.label)}.</>
        ) : runnerUp && runnerUp.ratio === 0 ? (
          <> ; {runnerUp.label} n&apos;en a amené aucun.</>
        ) : (
          <>.</>
        )}
      </>
    ) : (
      <>
        <Highlight>
          <Num>{String(analysed)}</Num> publications
        </Highlight>{" "}
        en {insights.windowDays} jours, mais aucun lead encore attribué à un contenu.
      </>
    );
    const slotPart =
      bestDay || bestHour ? (
        <>
          {" "}
          Publie{" "}
          <em className="text-[#9fd0f7]">
            {bestDay ? `le ${JOURS[bestDay.day]}` : ""}
            {bestDay && bestHour ? " vers " : bestHour ? "vers " : ""}
            {bestHour ? bestHour.label : ""}
          </em>{" "}
          : c&apos;est là que tes contenus portent le plus loin.
        </>
      ) : null;
    sentence = (
      <>
        {platformPart}
        {slotPart}
      </>
    );
  }

  // ── À faire ─────────────────────────────────────────────────────────────
  // Chaque piste porte la question que Robin poserait à Léa, avec les
  // chiffres du carnet dedans : elle n'a pas à les redemander.
  const chips: Array<{ icon: React.ReactNode; text: string; question: string; tone?: "warn" }> = [];
  if (enough && bestPlatform && (bestDay || bestHour)) {
    const when = [bestDay ? JOURS[bestDay.day] : null, bestHour ? `à ${bestHour.label}` : null]
      .filter(Boolean)
      .join(" ");
    chips.push({
      icon: <Sparkles />,
      text: `Programmer ${withArticle(bestPlatform.format)} ${when}`,
      question: `Aide-moi à préparer ${withArticle(bestPlatform.format)} pour ${when} : sur ${bestPlatform.label}, chaque publication m'amène ${ratioText(bestPlatform.ratio)} ${plural(bestPlatform.ratio, "lead", "leads")}. Qu'est-ce que je publie ?`,
    });
  }
  if (enough && star) {
    chips.push({
      icon: <Repeat2 />,
      // Espaces insécables dans les guillemets et avant le compte : au
      // téléphone, la ligne ne doit pas repartir sur « » · 7 leads ».
      text: `Décliner «\u00a0${truncate(star.title, 32)}\u00a0»\u00a0·\u00a0${star.leads}\u00a0${plural(star.leads, "lead", "leads")}`,
      question: `« ${star.title} » (${star.format}) m'a amené ${star.leads} ${plural(star.leads, "lead", "leads")}. Comment le décliner en nouveaux contenus ?`,
    });
  }
  if (nextPost?.withinWeek) {
    chips.push({
      icon: <CalendarClock />,
      text: `Prochain post ${nextPost.when}`,
      question: "Qu'est-ce qui est prévu sur les réseaux cette semaine, et est-ce que ça suffit ?",
    });
  } else {
    chips.push({
      icon: <CalendarX2 />,
      text: "Rien de programmé cette semaine",
      question: "Rien n'est programmé sur les réseaux cette semaine : qu'est-ce que je devrais publier ?",
      tone: "warn",
    });
  }

  // ── La preuve : performance par jour ────────────────────────────────────
  const values = insights.byWeekday;
  const max = Math.max(1, ...values.map((v) => v ?? 0));

  return (
    <SignaturePanel className="flex h-full flex-col [&>div]:flex [&>div]:flex-1 [&>div]:flex-col">
      {/* Qui parle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#7cc0f5,#2f7fe0)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_20px_-8px_rgba(47,127,224,0.8)] [&_svg]:size-[18px]">
            <Sparkles />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-white">Léa · analyse des réseaux</p>
            <p className="truncate text-[12px] text-[#9fbfe2]">Carnet de contenus · {insights.windowDays} derniers jours</p>
          </div>
        </div>
        {enough && (
          <span className="hidden shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11.5px] font-medium text-[#cfe2f7] sm:inline-flex">
            <Num>{String(analysed)}</Num>&nbsp;publications · <Num>{String(totalLeads)}</Num>&nbsp;leads
          </span>
        )}
      </div>

      <p className="t-eyebrow mt-7 text-[#9fc6ee]">Ce que l&apos;agent retient</p>
      <p className="t-panel mt-2.5 max-w-[38rem] text-white">{sentence}</p>

      {/* Les pistes : chacune ouvre Léa avec sa question. */}
      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Pistes à creuser avec Léa">
        {chips.map((c) => (
          <li key={c.text} className="max-w-full">
            <LeaPrompt question={c.question} icon={c.icon} tone={c.tone}>
              {c.text}
            </LeaPrompt>
          </li>
        ))}
      </ul>

      {/* Performance par jour de publication */}
      <div className="mt-auto pt-7">
        <div className="flex items-end justify-between gap-3 border-t border-white/10 pt-5">
          <p className="t-label text-[#9fbfe2]">Vues selon le jour de publication</p>
          <p className="text-[11.5px] text-[#9fbfe2]/80">par rapport à la moyenne du format</p>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2 sm:gap-3" role="list">
          {values.map((v, i) => {
            const best = bestDay?.day === i;
            const thin = v !== null && insights.weekdayPosts[i] < insights.minPosts;
            const h = v === null ? 0 : Math.max(12, (v / max) * 100);
            const label =
              v === null ? "aucune publication" : `${v >= 1 ? "+" : "−"}${Math.round(Math.abs(v - 1) * 100)} %`;
            return (
              <div
                key={i}
                role="listitem"
                className="flex flex-col items-center gap-2"
                aria-label={`${JOURS[i]} : ${label}${thin ? " (une seule publication)" : ""}`}
              >
                <span
                  className={cn(
                    "text-[11px] font-medium tabular-nums",
                    v === null ? "text-transparent" : best ? "text-white" : thin ? "text-[#9fbfe2]/50" : "text-[#9fbfe2]",
                  )}
                >
                  {v === null ? "·" : label}
                </span>
                <div className="relative h-20 w-full max-w-[38px] sm:h-24 overflow-hidden rounded-full bg-white/[0.07] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]">
                  {v !== null && (
                    <span
                      className={cn(
                        "animate-grow absolute inset-x-0 bottom-0 rounded-full",
                        best
                          ? "bg-[linear-gradient(180deg,#bfe3ff,#4a9bf0)] shadow-[0_0_18px_rgba(124,192,245,0.6)]"
                          : thin
                            ? "bg-[repeating-linear-gradient(135deg,rgba(124,192,245,0.35)_0_3px,rgba(124,192,245,0.12)_3px_6px)]"
                            : "bg-[linear-gradient(180deg,#7cc0f5,#2f7fe0)] opacity-70",
                      )}
                      style={{ height: `${h}%`, animationDelay: `${120 + i * 50}ms` }}
                    />
                  )}
                </div>
                <span className={cn("text-[11px] font-semibold", best ? "text-white" : "text-[#9fbfe2]")}>
                  {JOURS_INITIALES[i]}
                </span>
              </div>
            );
          })}
        </div>
        {insights.weekdayPosts.some((n, i) => values[i] !== null && n < insights.minPosts) && (
          <p className="mt-3 flex items-center gap-2 text-[11.5px] text-[#9fbfe2]/80">
            <span className="h-2.5 w-4 shrink-0 rounded-full bg-[repeating-linear-gradient(135deg,rgba(124,192,245,0.45)_0_3px,rgba(124,192,245,0.15)_3px_6px)]" />
            Hachuré : une seule publication ce jour-là, pas de quoi conclure.
          </p>
        )}
      </div>
    </SignaturePanel>
  );
}
