import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Search,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScoreRing } from "@/components/seo/score-ring";
import { RunAuditButton } from "@/components/seo/run-audit-button";
import { formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";

type Check = {
  key: string;
  label: string;
  why: string;
  severity: "critical" | "warning";
  status: "pass" | "fail";
  detail: string;
};

type PageInfo = {
  url: string;
  status: number;
  bytes: number;
  textLength: number;
  title: string | null;
  h1Count: number;
};

type Audit = {
  id: string;
  site_url: string;
  run_at: string;
  score: number;
  checks_passed: number;
  checks_total: number;
  critical_count: number;
  warning_count: number;
  checks: Check[];
  pages: PageInfo[];
};

function asChecks(value: unknown): Check[] {
  return Array.isArray(value) ? (value as Check[]) : [];
}
function asPages(value: unknown): PageInfo[] {
  return Array.isArray(value) ? (value as PageInfo[]) : [];
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

  if (!latest) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <Card className="enter-up">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Search className="size-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aucun audit pour l&apos;instant. Lance le premier passage de l&apos;Auditeur —
              ça prend une dizaine de secondes.
            </p>
            <RunAuditButton />
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
  const uniqueTitles = new Set(reachable.map((p) => p.title).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Verdict ─────────────────────────────────────────────── */}
      <Card className="enter-up">
        <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
          <ScoreRing score={latest.score} />
          <div className="flex flex-1 flex-col gap-3 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h2 className="font-heading text-xl font-semibold text-foreground">
                {latest.checks_passed} contrôles conformes sur {latest.checks_total}
              </h2>
              {delta !== null && delta !== 0 ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    delta > 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                  )}
                >
                  {delta > 0 ? "+" : ""}
                  {delta} pts depuis le dernier audit
                </span>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Le score est un simple ratio : le nombre de contrôles réussis divisé par le
              nombre de contrôles effectués. Rien de pondéré, rien de caché — tout est
              détaillé plus bas, ligne par ligne.
            </p>
            <p className="text-xs text-muted-foreground">
              Dernier passage le {formatDateLong(latest.run_at)} sur{" "}
              <span className="font-medium text-foreground">
                {latest.site_url.replace(/^https?:\/\//, "")}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Compteurs ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CountCard
          label="Points critiques"
          value={latest.critical_count}
          hint="bloquent votre visibilité"
          icon={XCircle}
          tone="danger"
          index={0}
        />
        <CountCard
          label="À améliorer"
          value={latest.warning_count}
          hint="vous freinent sans tout bloquer"
          icon={TriangleAlert}
          tone="gold"
          index={1}
        />
        <CountCard
          label="Conformes"
          value={latest.checks_passed}
          hint="rien à faire, c'est en place"
          icon={CheckCircle2}
          tone="success"
          index={2}
        />
      </div>

      {/* Ce que voit Google ──────────────────────────────────── */}
      {home ? (
        <Card className="enter-up" style={{ animationDelay: "180ms" }}>
          <CardHeader>
            <CardTitle>Ce que voit Google en arrivant sur votre site</CardTitle>
            <CardDescription>
              Les chiffres bruts, mesurés à l&apos;instant sur la page d&apos;accueil.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <RawStat
              value={home.textLength.toLocaleString("fr-FR")}
              unit="caractères"
              label="de texte lisible sans JavaScript"
              bad={home.textLength < 500}
            />
            <RawStat
              value={String(uniqueTitles)}
              unit={uniqueTitles > 1 ? "titres" : "titre"}
              label={`pour ${reachable.length} pages analysées`}
              bad={uniqueTitles < reachable.length}
            />
            <RawStat
              value={String(reachable.reduce((s, p) => s + p.h1Count, 0))}
              unit="titres H1"
              label="sur l'ensemble des pages"
              bad={reachable.some((p) => p.h1Count === 0)}
            />
            <RawStat
              value={Math.round(home.bytes / 1024).toLocaleString("fr-FR")}
              unit="Ko"
              label="de code envoyé aux moteurs"
              bad={false}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Contrôles ───────────────────────────────────────────── */}
      {critical.length > 0 ? (
        <ChecksCard
          title="À corriger en priorité"
          description="Tant que ces points sont en rouge, le reste du travail ne peut pas produire d'effet."
          checks={critical}
          tone="danger"
          delay={240}
        />
      ) : null}

      {warnings.length > 0 ? (
        <ChecksCard
          title="À améliorer"
          description="Rien de bloquant, mais chaque point réglé vous fait gagner du terrain."
          checks={warnings}
          tone="gold"
          delay={300}
        />
      ) : null}

      {passed.length > 0 ? (
        <ChecksCard
          title="Déjà en place"
          description="Ces points sont conformes — l'Auditeur vous préviendra s'ils régressent."
          checks={passed}
          tone="success"
          delay={360}
        />
      ) : null}

      {/* Historique ──────────────────────────────────────────── */}
      {audits.length > 1 ? (
        <Card className="enter-up" style={{ animationDelay: "420ms" }}>
          <CardHeader>
            <CardTitle>Évolution du score</CardTitle>
            <CardDescription>Un point par audit, du plus ancien au plus récent.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 overflow-x-auto pb-1">
              {[...audits].reverse().map((a) => (
                <div key={a.id} className="flex min-w-12 flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {a.score}
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t-md",
                      a.score < 40 ? "bg-danger/70" : a.score < 75 ? "bg-gold/70" : "bg-success/70",
                    )}
                    style={{ height: `${Math.max(6, a.score * 1.3)}px` }}
                  />
                  <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                    {new Date(a.run_at).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/* ── Sous-composants ───────────────────────────────────────── */

function PageHeader() {
  return (
    <header className="enter-up flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Visibilité SEO &amp; IA
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          L&apos;agent Auditeur interroge votre site comme le ferait Google ou ChatGPT, et
          vérifie tout ce qui leur permet de vous comprendre.
        </p>
      </div>
      <RunAuditButton />
    </header>
  );
}

function CountCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  index,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof AlertTriangle;
  tone: "danger" | "gold" | "success";
  index: number;
}) {
  const chip = {
    danger: "bg-danger/10 text-danger",
    gold: "bg-gold/10 text-gold",
    success: "bg-success/10 text-success",
  }[tone];
  const text = { danger: "text-danger", gold: "text-gold", success: "text-success" }[tone];

  return (
    <Card className="enter-up" style={{ animationDelay: `${index * 70 + 100}ms` }}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
          <span className={cn("text-[1.6rem] font-semibold leading-none tabular-nums", text)}>
            {value}
          </span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", chip)}>
          <Icon className="size-[18px]" />
        </span>
      </CardContent>
    </Card>
  );
}

function RawStat({
  value,
  unit,
  label,
  bad,
}: {
  value: string;
  unit: string;
  label: string;
  bad: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-2xl font-semibold leading-none tabular-nums",
            bad ? "text-danger" : "text-foreground",
          )}
        >
          {value}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{unit}</span>
      </span>
      <span className="text-xs leading-snug text-muted-foreground">{label}</span>
    </div>
  );
}

function ChecksCard({
  title,
  description,
  checks,
  tone,
  delay,
}: {
  title: string;
  description: string;
  checks: Check[];
  tone: "danger" | "gold" | "success";
  delay: number;
}) {
  const dot = {
    danger: "bg-danger",
    gold: "bg-gold",
    success: "bg-success",
  }[tone];

  return (
    <Card className="enter-up" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", dot)} />
          {title}
          <span className="text-sm font-normal text-muted-foreground">({checks.length})</span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/60">
          {checks.map((c) => (
            <li key={c.key} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot)} />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">{c.label}</p>
                <p className="text-sm text-muted-foreground">{c.detail}</p>
                {tone !== "success" ? (
                  <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground/80">
                    <Bot className="mt-0.5 size-3.5 shrink-0" />
                    {c.why}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
