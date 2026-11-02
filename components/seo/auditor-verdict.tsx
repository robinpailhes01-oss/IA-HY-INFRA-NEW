import { ArrowDownRight, ArrowUpRight, MessageCircleQuestion, ScanSearch } from "lucide-react";

import { SignaturePanel } from "@/components/dashboard/signature-panel";
import { ScoreRing, SCORE_LABEL, scoreTone } from "@/components/seo/score-ring";
import { LeaPrompt } from "@/components/social/lea-prompt";
import { cn } from "@/lib/utils";

// LE PANNEAU MARINE de Visibilité SEO : le verdict de l'Auditeur.
// L'anneau dit où on en est, la phrase dit quoi faire ensuite — toujours UN
// point précis, le premier rouge de la liste, pas « améliorez votre SEO ».
//
// Le seul geste du panneau : « Comment corriger ? » ouvre Léa avec le point
// en question et le constat de l'Auditeur — Robin n'a pas à savoir ce
// qu'est une balise, Léa le guide pas à pas.

export function AuditorVerdict({
  score,
  delta,
  critical,
  warnings,
  firstFix,
  nextWarning,
  when,
  site,
}: {
  score: number;
  /** Écart de points avec l'audit précédent, null s'il n'y en a pas. */
  delta: number | null;
  critical: number;
  warnings: number;
  /** Le premier point critique à corriger : son libellé et le constat de l'Auditeur. */
  firstFix: { label: string; detail: string } | null;
  /** Le premier réglage « à améliorer », quand plus rien n'est critique. */
  nextWarning: string | null;
  /** « le 26 oct. à 9 h 12 ». */
  when: string;
  site: string;
}) {
  const tone = scoreTone(score);

  const sentence =
    critical > 0 ? (
      <>
        <span className="text-[#9fd0f7]">
          {critical > 1 ? `${critical} points bloquent` : "Un point bloque"}
        </span>{" "}
        encore ta visibilité.
        {firstFix && (
          <>
            {" "}
            Commence par <em className="text-[#9fd0f7]">«&nbsp;{firstFix.label}&nbsp;»</em>.
          </>
        )}
      </>
    ) : warnings > 0 ? (
      <>
        Plus rien de bloquant.{" "}
        <span className="text-[#9fd0f7]">
          {warnings > 1 ? `${warnings} réglages` : "Un réglage"}
        </span>{" "}
        te {warnings > 1 ? "feraient" : "ferait"} encore gagner du terrain.
      </>
    ) : (
      <>
        Tout est en place. <em className="text-[#9fd0f7]">Je te préviens</em> si quelque chose régresse.
      </>
    );

  // La question que Léa reçoit : le point précis et ce que l'Auditeur en dit.
  const ask = firstFix
    ? {
        label: "Comment corriger ce point ?",
        question: `L'Auditeur SEO signale « ${firstFix.label} » sur ${site} : ${firstFix.detail} Comment je corrige ça, concrètement ?`,
      }
    : nextWarning
      ? {
          label: "Par quoi continuer ?",
          question: `Plus rien de bloquant sur ${site} selon l'Auditeur SEO. Il reste « ${nextWarning} » à améliorer : par quoi je commence ?`,
        }
      : null;

  return (
    <SignaturePanel className="flex h-full flex-col [&>div]:flex [&>div]:flex-1 [&>div]:flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#7cc0f5,#2f7fe0)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_20px_-8px_rgba(47,127,224,0.8)] [&_svg]:size-[18px]">
            <ScanSearch />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-white">L&apos;Auditeur · Google &amp; IA</p>
            <p className="truncate text-[12px] text-[#9fbfe2]">
              Passage {when} · {site}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex items-center gap-5">
          <ScoreRing score={score} size={140} variant="signature" />
          {/* Sur téléphone, l'état et l'écart viennent à côté de l'anneau. */}
          <div className="flex flex-col items-start gap-2 sm:hidden">
            <StateLabel tone={tone} />
            {delta !== null && delta !== 0 && (
              <>
                <DeltaPill delta={delta} />
                <span className="text-[11.5px] text-[#9fbfe2]">depuis le dernier audit</span>
              </>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="hidden items-center gap-2 sm:flex">
            <StateLabel tone={tone} />
            {delta !== null && delta !== 0 && <DeltaPill delta={delta} />}
          </div>
          <p className="t-eyebrow text-[#9fc6ee] sm:mt-5">Ce que l&apos;agent retient</p>
          <p className="t-panel mt-2.5 max-w-[34rem] text-white">{sentence}</p>
          {ask && (
            <div className="mt-5">
              <LeaPrompt question={ask.question} icon={<MessageCircleQuestion />}>
                {ask.label}
              </LeaPrompt>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto pt-6">
        <p className="border-t border-white/10 pt-4 text-[12px] leading-relaxed text-[#9fbfe2]">
          Le score est un simple ratio : contrôles réussis divisés par contrôles effectués. Rien de
          pondéré, rien de caché — tout est détaillé plus bas, ligne par ligne.
        </p>
      </div>
    </SignaturePanel>
  );
}

function StateLabel({ tone }: { tone: "danger" | "warning" | "success" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold",
        tone === "danger"
          ? "bg-[#f0646b]/15 text-[#ffb4b8]"
          : tone === "warning"
            ? "bg-[#f0a24c]/15 text-[#ffe0ae]"
            : "bg-[#36c793]/15 text-[#a8f0d2]",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "danger" ? "bg-[#f0646b]" : tone === "warning" ? "bg-[#f0a24c]" : "bg-[#36c793]",
        )}
      />
      {SCORE_LABEL[tone]}
    </span>
  );
}

function DeltaPill({ delta }: { delta: number }) {
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium",
        up ? "border-[#36c793]/25 text-[#a8f0d2]" : "border-[#f0646b]/25 text-[#ffb4b8]",
      )}
    >
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {up ? "+" : "−"}
      {Math.abs(delta)}&nbsp;pts
      <span className="hidden sm:inline">&nbsp;depuis le dernier audit</span>
    </span>
  );
}
