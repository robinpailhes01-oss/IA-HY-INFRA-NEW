import { CheckCircle2, FileText, ScanSearch, TriangleAlert, XCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MotionCard } from "@/components/dashboard/motion-card";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RunAuditButton } from "@/components/seo/run-audit-button";
import { AuditorVerdict } from "@/components/seo/auditor-verdict";
import { ScoreHistory } from "@/components/seo/score-history";
import { ChecksCard, PassedCard } from "@/components/seo/checks-list";
import { PagesTable } from "@/components/seo/pages-table";
import { MIN_READABLE, asChecks, asPages, type Audit } from "@/components/seo/model";
import { dayKey, hourLabel, shortDay } from "@/components/social/time";

// ── Visibilité SEO & IA ────────────────────────────────────────────────────
// L'agent Auditeur (Edge Function `seo-audit`) interroge le site comme le
// ferait Google ou ChatGPT, et note chaque contrôle réussi ou raté dans
// seo_audits. Cette page lit les douze derniers passages : le verdict du
// dernier, l'évolution, puis le détail ligne par ligne.
//
// Le score est un simple ratio (contrôles réussis ÷ contrôles effectués),
// calculé par l'Auditeur — la page ne le recalcule pas, elle l'affiche.

const PARIS_TIME = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** « le 26 oct. à 9 h 12 », à l'heure de Carnon. */
function whenText(iso: string): string {
  const d = new Date(iso);
  return `le ${shortDay(dayKey(d))} à ${hourLabel(PARIS_TIME.format(d))}`;
}

export default async function SeoPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("seo_audits")
    .select(
      "id, site_url, run_at, score, checks_passed, checks_total, critical_count, warning_count, checks, pages",
    )
    .order("run_at", { ascending: false })
    .limit(12);

  const audits = (data ?? []).map((a) => ({
    ...a,
    checks: asChecks(a.checks),
    pages: asPages(a.pages),
  })) as Audit[];

  const latest = audits[0] ?? null;
  const previous = audits[1] ?? null;
  const delta = latest && previous ? latest.score - previous.score : null;

  const header = (
    <PageHeader
      eyebrow="Croissance · visibilité"
      title={
        <>
          Visibilité <em>SEO</em> &amp; IA
        </>
      }
      description="L'agent Auditeur interroge ton site comme le ferait Google ou ChatGPT, et vérifie tout ce qui leur permet de te comprendre."
      actions={<RunAuditButton className="w-full sm:w-auto" />}
    />
  );

  if (!latest) {
    return (
      <div className="flex flex-col gap-4 lg:gap-5">
        {header}
        <Card>
          <CardContent>
            <EmptyState icon={<ScanSearch />} title="Aucun audit pour l'instant" className="py-14">
              Lance le premier passage de l&apos;Auditeur — ça prend une dizaine de secondes. Il
              vérifiera tout ce que Google et les IA lisent de ton site.
            </EmptyState>
          </CardContent>
        </Card>
      </div>
    );
  }

  const critical = latest.checks.filter((c) => c.status === "fail" && c.severity === "critical");
  const warnings = latest.checks.filter((c) => c.status === "fail" && c.severity === "warning");
  const passed = latest.checks.filter((c) => c.status === "pass");

  const home = latest.pages[0];
  const reachable = latest.pages.filter((p) => p.status === 200);

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {header}

      {/* ── Le verdict · l'évolution ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <MotionCard index={0} lift={false} className="lg:col-span-7">
          <AuditorVerdict
            score={latest.score}
            delta={delta}
            critical={latest.critical_count}
            warnings={latest.warning_count}
            firstFix={critical[0] ? { label: critical[0].label, detail: critical[0].detail } : null}
            nextWarning={warnings[0]?.label ?? null}
            when={whenText(latest.run_at)}
            site={latest.site_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          />
        </MotionCard>
        <MotionCard index={1} lift={false} className="lg:col-span-5">
          <ScoreHistory
            points={[...audits].reverse().map((a) => ({ id: a.id, score: a.score, date: shortDay(dayKey(a.run_at)) }))}
          />
        </MotionCard>
      </div>

      {/* ── Compteurs ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        <KpiCard
          label="Points critiques"
          value={latest.critical_count}
          icon={<XCircle />}
          accent="danger"
          hint="bloquent ta visibilité"
          index={2}
        />
        <KpiCard
          label="À améliorer"
          value={latest.warning_count}
          icon={<TriangleAlert />}
          accent="warning"
          hint="freinent sans tout bloquer"
          index={3}
        />
        <KpiCard
          label="Conformes"
          value={latest.checks_passed}
          suffix={`\u00a0/\u00a0${latest.checks_total}`}
          icon={<CheckCircle2 />}
          accent="success"
          hint="rien à faire, c'est en place"
          index={4}
        />
        {home ? (
          <KpiCard
            label="Texte lisible par les IA"
            value={home.textLength}
            icon={<FileText />}
            accent={home.textLength < MIN_READABLE ? "danger" : "ocean"}
            hint="caractères sur l'accueil"
            index={5}
          />
        ) : (
          <KpiCard
            label="Pages qui répondent"
            value={reachable.length}
            suffix={`\u00a0/\u00a0${latest.pages.length}`}
            icon={<FileText />}
            accent="ocean"
            hint="au dernier passage"
            index={5}
          />
        )}
      </div>

      {/* ── Les contrôles ──────────────────────────────────────────────── */}
      {/* Les deux cartes à la même hauteur : alignées en haut, l'une finissait
          150 px avant l'autre et laissait un trou dans la grille. */}
      {(critical.length > 0 || warnings.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
          {critical.length > 0 && (
            <MotionCard index={6} lift={false} className={warnings.length === 0 ? "lg:col-span-2" : undefined}>
              <ChecksCard
                title="À corriger en priorité"
                description="Tant que ces points sont en rouge, le reste du travail ne peut pas produire d'effet."
                checks={critical}
                tone="danger"
                firstLabel="En premier"
              />
            </MotionCard>
          )}
          {warnings.length > 0 && (
            <MotionCard index={7} lift={false} className={critical.length === 0 ? "lg:col-span-2" : undefined}>
              <ChecksCard
                title="À améliorer"
                description="Rien de bloquant, mais chaque point réglé te fait gagner du terrain."
                checks={warnings}
                tone="warning"
              />
            </MotionCard>
          )}
        </div>
      )}

      {passed.length > 0 && (
        <MotionCard index={8} lift={false}>
          <PassedCard checks={passed} />
        </MotionCard>
      )}

      {/* ── Ce que voit Google, page par page ──────────────────────────── */}
      {latest.pages.length > 0 && (
        <MotionCard index={9} lift={false}>
          <PagesTable pages={latest.pages} />
        </MotionCard>
      )}
    </div>
  );
}
