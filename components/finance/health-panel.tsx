import { Landmark, TriangleAlert } from "lucide-react";

import { SignaturePanel } from "@/components/dashboard/signature-panel";
import { AskLeaButton } from "@/components/finance/ask-lea-button";
import { RingGauge } from "@/components/charts/ring-gauge";
import { Sparkline } from "@/components/charts/sparkline";
import { Num } from "@/components/ui/num";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { daysBetween, decimal, plural, shortDate } from "@/components/finance/fin-utils";

// LA SANTÉ FINANCIÈRE — le panneau marine de la page Finance, là où parle
// l'agent Manager.
//
// Le score n'est PAS calculé ici : il vient de la photo quotidienne écrite par
// l'Edge Function `finance-pulse` (table financial_snapshots), la même que
// celle envoyée à Robin sur Telegram. Le tableau de bord et l'agent disent donc
// exactement la même chose. Cette page ne fait que mettre le verdict en mots,
// de façon déterministe — même photo, même phrase.
//
// Principe hérité de finance-pulse : sans banque connectée, pas de score.
// Un chiffre faux est pire que pas de chiffre (l'écart de 12 800 € venait de
// là) — le panneau l'explique au lieu d'inventer.

/** Un pilier du score, tel que stocké dans financial_snapshots.details. */
export type Pillar = {
  /** Points obtenus (null si absent de la photo). */
  score: number | null;
  max: number;
  /** La mesure sous-jacente : mois, ratio ou mois selon le pilier. */
  value: number | null;
};

export type HealthSnapshot = {
  date: string;
  capturedAt: string | null;
  score: number;
  label: string | null;
  runwayMonths: number | null;
  monthlyBurn: number | null;
  /** « bank » = charges mesurées sur les débits Qonto ; « declared » = saisie manuelle. */
  burnSource: string | null;
  pillars: { runway: Pillar; coverage: Pillar; secured: Pillar };
};

// Les cibles du barème, recopiées de supabase/functions/finance-pulse/index.ts
// (RUNWAY_TARGET_MONTHS, COVERAGE_TARGET_RATIO, SECURED_TARGET_MONTHS). Elles
// servent seulement à EXPLIQUER chaque pilier ; les points viennent de la photo.
const TARGET = { runway: 6, coverage: 1.2, secured: 2 } as const;

/** Repli si la photo est antérieure à l'ajout du libellé (même barème que finance-pulse). */
function labelFor(score: number): string {
  if (score >= 75) return "solide";
  if (score >= 55) return "correct";
  if (score >= 35) return "tendu";
  return "critique";
}

/** « correct » → « correcte » : on parle d'une situation. */
function situation(label: string): string {
  const l = label.toLowerCase();
  if (l === "correct") return "correcte";
  if (l === "tendu") return "tendue";
  return l;
}

function runwayPhrase(r: number): string {
  if (r >= 24) return "plus de deux ans";
  if (r >= 10) return `${Math.round(r)} mois`;
  return `${decimal(r)} mois`;
}

type Seg = string | { em: string };

function Sentence({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, i) => (typeof s === "string" ? <span key={i}>{s}</span> : <em key={i}>{s.em}</em>))}
    </>
  );
}

const PILLARS: Array<{
  key: keyof HealthSnapshot["pillars"];
  label: string;
  /** Ce que mesure le pilier, en une ligne — affiché quand la valeur manque. */
  what: string;
  detail: (v: number) => string;
  target: string;
}> = [
  {
    key: "runway",
    label: "Autonomie",
    what: "Combien de mois tu tiens sans aucune rentrée",
    detail: (v) => `${decimal(v)} mois de charges couverts`,
    target: `cible ${TARGET.runway} mois`,
  },
  {
    key: "coverage",
    label: "Couverture",
    what: "Le chiffre des 30 derniers jours couvre-t-il les charges ?",
    detail: (v) => `le chiffre couvre ${decimal(v)}× les charges`,
    target: `cible ${decimal(TARGET.coverage)}×`,
  },
  {
    key: "secured",
    label: "Déjà signé",
    what: "L'argent des réservations à venir, en mois de charges",
    detail: (v) => `${decimal(v)} mois de charges à encaisser`,
    target: `cible ${TARGET.secured} mois`,
  },
];

function PillarTile({
  label,
  pillar,
  detail,
  target,
  what,
  weakest,
}: {
  label: string;
  pillar: Pillar | null;
  detail: string | null;
  target: string;
  what: string;
  weakest: boolean;
}) {
  const ratio = pillar?.score != null && pillar.max > 0 ? Math.max(0, Math.min(1, pillar.score / pillar.max)) : null;
  // Téléphone : trois rangées dans une seule plaque (voir PillarList) ;
  // à partir de sm, trois tuiles côte à côte.
  return (
    <div
      className={cn(
        "px-4 py-3.5 sm:rounded-[20px] sm:border sm:p-4",
        weakest
          ? "bg-[rgba(217,130,43,0.1)] sm:border-[rgba(247,194,127,0.28)]"
          : "sm:border-white/10 sm:bg-white/[0.05]",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="t-label text-[#cfe2f7]">{label}</p>
        {pillar?.score != null ? (
          <p className="n-inline text-[15px] text-white">
            {Math.round(pillar.score)}
            <span className="text-[12px] text-[#86a3c4]">/{pillar.max}</span>
          </p>
        ) : (
          <p className="n-inline text-[15px] text-[#86a3c4]">—</p>
        )}
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        {ratio != null && (
          <div
            className={cn(
              "h-full rounded-full",
              weakest ? "bg-[linear-gradient(90deg,#f7c27f,#ffd9a8)]" : "bg-[linear-gradient(90deg,#7cc0f5,#e8f3fd)]",
            )}
            style={{ width: `${Math.max(4, ratio * 100)}%` }}
          />
        )}
      </div>
      <p className="t-caption mt-2.5 text-[#a9c3e0] first-letter:uppercase">
        {detail ?? what}
        {detail && <span className="text-[#86a3c4]"> · {target}</span>}
      </p>
    </div>
  );
}

/**
 * Les trois piliers. Sur téléphone, une seule plaque découpée en rangées :
 * trois tuiles encadrées empilées faisaient du panneau marine un écran
 * entier à lui seul, avant même la trésorerie.
 */
function PillarList({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 divide-y divide-white/10 overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.05] sm:grid sm:grid-cols-3 sm:gap-3 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent">
      {children}
    </div>
  );
}

export function HealthPanel({
  snapshot,
  previous,
  bankConnected,
  todayIso,
  scoreTrend = [],
  className,
}: {
  snapshot: HealthSnapshot | null;
  /** Scores des photos quotidiennes, du plus ancien au plus récent. */
  scoreTrend?: number[];
  /** Photo d'il y a ~30 jours, pour la tendance. */
  previous: { date: string; score: number } | null;
  bankConnected: boolean;
  todayIso: string;
  className?: string;
}) {
  const eyebrow = (
    <span className="inline-flex items-center gap-2">
      <span className="grid size-[22px] place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#7cc0f5_0%,#2f7fe0_55%,#13355e_100%)] shadow-[0_0_0_3px_rgba(124,192,245,0.14),0_4px_12px_-4px_rgba(47,127,224,0.8)]">
        <Landmark className="size-3 text-white" strokeWidth={2} />
      </span>
      Le verdict de Léa
      {snapshot && <span className="hidden sm:inline">&nbsp;· {shortDate(snapshot.date)}</span>}
    </span>
  );

  // Léa (le widget de la coque) est branchée sur le vrai agent Manager :
  // elle lit les mêmes tables et peut détailler le score. Un vrai geste.
  const action = (
    <AskLeaButton
      tone="dark"
      question="Explique-moi mon score de santé financière : qu'est-ce qui le tire vers le bas, et que faire ?"
      label="Demander à Léa"
      shortLabel="Léa"
    />
  );

  // ── Pas encore de photo : on explique, on n'invente rien ──────────────
  if (!snapshot) {
    return (
      <SignaturePanel eyebrow={eyebrow} action={action} className={cn("rise", className)}>
        <h2 className="sr-only">Santé financière</h2>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <RingGauge value={0} size={132} stroke={12} track="rgba(255,255,255,0.1)" className="shrink-0">
            <span className="n-kpi text-[#86a3c4]">—</span>
          </RingGauge>
          <div className="min-w-0">
            <p className="t-panel text-white [&_em]:text-[#9fd0f7]">
              {bankConnected ? (
                <>
                  Léa n&apos;a pas encore rendu son <em>verdict</em>.
                </>
              ) : (
                <>
                  Pas de banque, <em>pas de score</em>.
                </>
              )}
            </p>
            <p className="t-body mt-3 max-w-[36rem] text-[#a9c3e0]">
              {bankConnected
                ? "Elle calcule le score chaque matin à partir du solde Qonto et de la caisse espèces. La première photo apparaîtra ici après sa prochaine tournée."
                : "Le score se calcule chaque matin à partir du solde Qonto, jamais de la seule saisie manuelle : un chiffre faux est pire que pas de chiffre. Dès que Qonto est connecté, Léa le calcule toute seule."}
            </p>
          </div>
        </div>
        <PillarList>
          {PILLARS.map((p) => (
            <PillarTile key={p.key} label={p.label} pillar={null} detail={null} target={p.target} what={p.what} weakest={false} />
          ))}
        </PillarList>
      </SignaturePanel>
    );
  }

  const s = snapshot;
  const label = s.label ?? labelFor(s.score);
  const delta = previous ? s.score - previous.score : null;
  const staleDays = daysBetween(s.date, todayIso);

  // Le pilier qui pèse le plus sur le score : le plus faible en proportion de
  // ses points. Signalé seulement s'il est franchement en retrait.
  const ranked = PILLARS.map((p) => {
    const pl = s.pillars[p.key];
    const ratio = pl.score != null && pl.max > 0 ? pl.score / pl.max : null;
    return { ...p, pl, ratio };
  })
    .filter((p) => p.ratio != null)
    .sort((a, b) => (a.ratio ?? 1) - (b.ratio ?? 1));
  const weakest = ranked[0] && (ranked[0].ratio ?? 1) < 0.6 ? ranked[0] : null;

  // ── La phrase ──────────────────────────────────────────────────────────
  const first: Seg[] = ["Situation ", { em: situation(label) }];
  const r = s.runwayMonths;
  if (r != null && Number.isFinite(r) && r > 0) {
    first.push(" : ta trésorerie tient ", { em: runwayPhrase(r) }, " sans aucune rentrée.");
  } else if (r == null) {
    first.push(" : aucune charge observée sur 90 jours.");
  } else {
    first.push(" : la trésorerie ne couvre plus les charges.");
  }

  const second: Seg[] | null =
    delta == null
      ? null
      : delta < 0
        ? ["Le score a perdu ", { em: `${-delta} ${plural(-delta, "point", "points")}` }, " en 30 jours."]
        : delta > 0
          ? ["Il a gagné ", { em: `${delta} ${plural(delta, "point", "points")}` }, " en 30 jours."]
          : ["Il est stable sur 30 jours."];

  const support = weakest
    ? `Ce qui pèse le plus : ${weakest.label.toLowerCase()} — ${weakest.pl.value != null ? weakest.detail(weakest.pl.value) : weakest.what.toLowerCase()}.`
    : "Les trois piliers tiennent : autonomie, couverture des charges et encaissements déjà signés.";

  const capturedTime = s.capturedAt
    ? new Date(s.capturedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
    : null;

  return (
    <SignaturePanel eyebrow={eyebrow} action={action} className={cn("rise", className)}>
      <h2 className="sr-only">Santé financière</h2>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
        {/* L'anneau : le score sur 100, et son mot. */}
        <div className="flex items-center gap-5">
          <RingGauge
            value={s.score}
            size={136}
            stroke={12}
            color="#7cc0f5"
            gradientTo="#eaf5fe"
            track="rgba(255,255,255,0.1)"
            className="shrink-0 drop-shadow-[0_10px_24px_rgba(47,127,224,0.35)]"
          >
            <span className="flex flex-col items-center">
              <span className="flex items-baseline">
                <span className="n-kpi-lead text-white">{s.score}</span>
                <span className="ml-0.5 text-[13px] font-medium text-[#86a3c4]">/100</span>
              </span>
              <span className="mt-1 text-[12px] font-medium capitalize text-[#9fd0f7]">{label}</span>
            </span>
          </RingGauge>
          {/* Téléphone : la courbe du score sur 90 jours, à côté de l'anneau,
              là où il reste de la place. Sur bureau, la phrase occupe ce rôle. */}
          {scoreTrend.length > 1 && (
            <div className="min-w-0 flex-1 sm:hidden">
              <p className="t-caption text-[#a9c3e0]">Score sur {scoreTrend.length} jours</p>
              <Sparkline values={scoreTrend} color="#9fd0f7" className="mt-2 h-12 w-full" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="t-panel text-white [&_em]:text-[#9fd0f7]">
            <Sentence segs={first} />
            {second && (
              <>
                {" "}
                <Sentence segs={second} />
              </>
            )}
          </p>
          <p className="t-body mt-3 max-w-[38rem] text-[#a9c3e0]">{support}</p>
          {s.burnSource === "declared" && (
            <p className="t-caption mt-3 flex items-start gap-2 rounded-[16px] bg-[rgba(217,130,43,0.14)] px-3 py-2 text-[#f7d3a6]">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              Charges calculées sur la saisie manuelle : aucun débit bancaire importé, elles sont sans doute sous-estimées.
            </p>
          )}
        </div>
      </div>

      <PillarList>
        {PILLARS.map((p) => {
          const pl = s.pillars[p.key];
          return (
            <PillarTile
              key={p.key}
              label={p.label}
              pillar={pl}
              detail={pl.value != null ? p.detail(pl.value) : null}
              target={p.target}
              what={p.what}
              weakest={weakest?.key === p.key}
            />
          );
        })}
      </PillarList>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-[#86a3c4]">
        <span>
          Calculé chaque matin depuis Qonto et la caisse
          {capturedTime ? ` · photo de ${capturedTime}` : ""}
        </span>
        {s.monthlyBurn != null && s.monthlyBurn > 0 && (
          <span className="pastille bg-white/[0.08] text-[#cfe2f7]">
            <span>
              Charges <Num>{formatEur(s.monthlyBurn)}</Num>&nbsp;/&nbsp;mois
            </span>
          </span>
        )}
        {staleDays > 1 && (
          <span className="pastille bg-[rgba(217,130,43,0.2)] text-[#f7c27f]">
            <TriangleAlert className="size-3" />
            Dernière photo le {shortDate(s.date)}
          </span>
        )}
      </div>
    </SignaturePanel>
  );
}
