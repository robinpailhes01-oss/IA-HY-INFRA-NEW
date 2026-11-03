import { Suspense } from "react";
import {
  CalendarClock,
  CircleDashed,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FileWarning,
  Landmark,
  Lock,
  Scale,
} from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SignaturePanel } from "@/components/dashboard/signature-panel";
import { AskLeaButton } from "@/components/finance/ask-lea-button";
import { longDate, plural } from "@/components/finance/fin-utils";
import { MovementList } from "@/components/compta/movement-list";
import {
  CloseMonthButton,
  ComptaTabs,
  DeleteRuleButton,
  SettingsForm,
  VatFiledButton,
  YearSwitch,
  type ComptaView,
} from "@/components/compta/controls";
import { loadCompta } from "@/lib/compta/data";
import { inMonth, resultOf, type Movement } from "@/lib/compta/ledger";
import { monthLabel, obligations, type Obligation } from "@/lib/compta/vat";
import { formatEurCents as formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

// COMPTABILITÉ — de la banque à un dossier propre.
//
// Ordre de lecture : ce qu'il reste à faire (classer, justifier, déclarer),
// puis le journal pour le faire, puis la TVA, puis la clôture et les exports
// qu'on remet à un comptable ou à l'administration.

const VIEWS: ComptaView[] = ["traiter", "tva", "cloture", "reglages"];

const STATE_LABEL: Record<Obligation["state"], { label: string; cls: string }> = {
  declaree: { label: "Déclarée", cls: "bg-[rgba(15,159,110,0.1)] text-success" },
  a_declarer: { label: "À déclarer", cls: "bg-[rgba(217,130,43,0.12)] text-warning" },
  en_retard: { label: "En retard", cls: "bg-[rgba(224,77,85,0.1)] text-danger" },
  en_cours: { label: "Mois en cours", cls: "bg-[rgba(47,127,224,0.1)] text-ocean" },
  a_venir: { label: "À venir", cls: "bg-[rgba(11,37,69,0.06)] text-ink-2" },
};

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", className)}>
      {children}
    </span>
  );
}

function vatLine(o: Obligation): string {
  if (o.amount > 0) return `${formatEur(o.amount)} à payer`;
  if (o.amount < 0) return `crédit de ${formatEur(-o.amount)}`;
  return "rien à payer";
}

export default async function ComptaPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string; annee?: string }>;
}) {
  const params = await searchParams;
  const view: ComptaView = VIEWS.includes(params.vue as ComptaView) ? (params.vue as ComptaView) : "traiter";
  const todayIso = new Date().toISOString().slice(0, 10);
  const thisYear = Number(todayIso.slice(0, 4));
  const year = Number(params.annee) >= 2020 && Number(params.annee) <= thisYear ? Number(params.annee) : thisYear;

  const data = await loadCompta(year);
  const { movements, settings } = data;

  const todo = movements.filter((m) => m.status === "a_classer").length;
  const missing = movements.filter((m) => m.status === "justificatif").length;
  const result = resultOf(movements);
  // Le tableau de bord ne voit que ce que la banque lui a transmis : avant le
  // premier mouvement importé, il n'a rien à dire (ni retard, ni clôture).
  const since = movements.length > 0 ? `${movements[movements.length - 1].date.slice(0, 7)}-01` : null;
  const obs = obligations({
    since,
    settings,
    year,
    movements,
    periods: data.periods,
    filings: data.filings,
    todayIso,
  });
  const next =
    obs.find((o) => o.state === "en_retard") ??
    [...obs].filter((o) => o.state === "a_declarer").sort((a, b) => (a.due < b.due ? -1 : 1))[0] ??
    obs.find((o) => o.state === "en_cours") ??
    null;

  const closedMonths = data.periods.filter((p) => p.closed_at).map((p) => p.month);
  const years = [thisYear - 2, thisYear - 1, thisYear].filter((y) => y >= 2024);

  // Le brief de Léa : la chose la plus urgente d'abord.
  const brief: string[] = [];
  if (next && (next.state === "en_retard" || next.state === "a_declarer")) {
    brief.push(
      `${next.label} : ${vatLine(next)}, ${next.state === "en_retard" ? "échéance dépassée depuis le" : "avant le"} ${longDate(next.due, thisYear)}.`,
    );
  }
  if (todo > 0) brief.push(`${todo} ${plural(todo, "mouvement", "mouvements")} à classer.`);
  if (missing > 0) brief.push(`${missing} ${plural(missing, "justificatif manque", "justificatifs manquent")} — sans facture, la TVA n'est pas déductible.`);
  if (brief.length === 0) brief.push("Tout est classé et justifié. Rien à déclarer pour l'instant.");

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        eyebrow={`Finance · Exercice ${year} · ${settings.legal_form}`}
        title={
          <>
            Comptabilité <em>en règle</em>
          </>
        }
        description="Chaque mouvement de banque et de caisse classé, justifié et prêt pour la TVA et le bilan."
        actions={
          <Suspense>
            <YearSwitch year={year} years={years} />
          </Suspense>
        }
      />

      {!data.ready ? (
        <EmptyState icon={<Landmark />} title="La comptabilité n'est pas encore installée" className="rise">
          Applique la migration <code>0035_comptabilite.sql</code> dans Supabase (SQL Editor), puis recharge cette
          page. Les mouvements Qonto déjà importés seront classés automatiquement.
        </EmptyState>
      ) : (
        <>
          <SignaturePanel
            className="rise"
            eyebrow="Léa · ta comptable de bord"
            title={brief.length === 1 && todo + missing === 0 && !next?.state.match(/a_declarer|en_retard/) ? "Dossier à jour" : "À faire"}
            action={
              <AskLeaButton
                tone="dark"
                question="Classe les mouvements que tu peux en compta et dis-moi ce qu'il me reste à justifier."
                label="Léa, classe ce que tu peux"
                shortLabel="Léa, classe"
              />
            }
          >
            <ul className="space-y-1.5 text-[14.5px] leading-relaxed text-[#dbe8f6]">
              {brief.map((b) => (
                <li key={b} className="flex gap-2">
                  <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[#9fd0f7]" />
                  {b}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] text-[#9fc6ee]">
              Régime {settings.vat_regime === "normal" ? "réel normal (CA3 mensuelle)" : "réel simplifié (CA12 annuelle)"} · TVA sur les
              encaissements · {data.bankSyncedAt ? `banque synchronisée le ${longDate(data.bankSyncedAt.slice(0, 10), thisYear)}` : "banque pas encore synchronisée"}
            </p>
          </SignaturePanel>

          <section aria-label="Indicateurs comptables" className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
            <KpiCard label="À classer" value={todo} accent={todo > 0 ? "warning" : "success"} icon={<CircleDashed />} hint={todo > 0 ? "Choisis un compte" : "Tout est classé"} index={0} />
            <KpiCard label="Justificatifs manquants" value={missing} accent={missing > 0 ? "danger" : "success"} icon={<FileWarning />} hint={missing > 0 ? "Photo ou PDF de la facture" : "Tout est justifié"} index={1} />
            <KpiCard
              label={next ? (next.kind === "ca3" ? `TVA · ${monthLabel(next.period)}` : next.label) : "TVA"}
              value={next ? Math.abs(next.amount) : 0}
              format="eur"
              accent="navy"
              icon={<Landmark />}
              hint={next ? (next.amount < 0 ? "Crédit de TVA" : `Échéance ${longDate(next.due, thisYear)}`) : "Aucune échéance"}
              index={2}
            />
            <KpiCard
              label={`Résultat HT ${year}`}
              value={result.result}
              format="eur"
              accent={result.result >= 0 ? "success" : "danger"}
              icon={<Scale />}
              hint={`Ventes ${formatEur(result.sales)} · charges ${formatEur(result.charges)}`}
              index={3}
            />
          </section>

          <Suspense>
            <ComptaTabs value={view} counts={{ traiter: todo + missing }} />
          </Suspense>

          {view === "traiter" && (
            <Card className="rise">
              <CardHeader>
                <CardTitle>Journal · {year}</CardTitle>
                <CardDescription>
                  {movements.length} {plural(movements.length, "mouvement", "mouvements")} de banque et de caisse. Touche une
                  ligne pour la classer ou joindre sa facture.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MovementList movements={movements} accounts={data.accounts} closedMonths={closedMonths} />
              </CardContent>
            </Card>
          )}

          {view === "tva" && <VatView obs={obs} year={year} regime={settings.vat_regime} since={since} />}

          {view === "cloture" && (
            <ClosingView
              movements={movements}
              year={year}
              todayIso={todayIso}
              closedMonths={closedMonths}
              obs={obs}
              siren={settings.siren}
              since={since}
            />
          )}

          {view === "reglages" && (
            <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
              <Card className="rise lg:col-span-7">
                <CardHeader>
                  <CardTitle>Réglages de la société</CardTitle>
                  <CardDescription>{settings.company_name} · {settings.legal_form}</CardDescription>
                </CardHeader>
                <CardContent>
                  <SettingsForm
                    initial={{
                      siren: settings.siren,
                      vat_regime: settings.vat_regime,
                      vat_due_day: settings.vat_due_day,
                      fiscal_year_start_month: settings.fiscal_year_start_month,
                      previous_year_vat: settings.previous_year_vat != null ? Number(settings.previous_year_vat) : null,
                    }}
                  />
                </CardContent>
              </Card>
              <Card className="rise lg:col-span-5">
                <CardHeader>
                  <CardTitle>Règles automatiques</CardTitle>
                  <CardDescription>Chaque nouveau mouvement Qonto qui correspond est classé tout seul.</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.rules.length === 0 ? (
                    <p className="text-[13px] text-ink-3">Aucune règle. Crée-en une depuis la fiche d&apos;un mouvement.</p>
                  ) : (
                    <ul className="divide-y divide-[rgba(11,37,69,0.06)]">
                      {data.rules.map((r) => (
                        <li key={r.id} className="flex items-center gap-3 py-2.5">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold text-foreground">
                              {r.pattern ? `« ${r.pattern} »` : r.operation_type === "qonto_fee" ? "Frais Qonto" : "Tout"}
                              <span className="font-normal text-ink-3">
                                {" "}
                                · {r.side === "credit" ? "entrée" : r.side === "debit" ? "sortie" : "les deux"}
                              </span>
                            </span>
                            <span className="block truncate text-[12px] text-ink-3">
                              {data.accountsByCode.get(r.account_code)?.label ?? r.account_code}
                              {Number(r.vat_rate) > 0 ? ` · TVA ${String(r.vat_rate).replace(".", ",")} %` : ""}
                              {r.reverse_charge ? " · autoliquidation" : ""}
                            </span>
                          </span>
                          <DeleteRuleButton id={r.id} />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VatView({ obs, year, regime, since }: { obs: Obligation[]; year: number; regime: "normal" | "simplifie"; since: string | null }) {
  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
      <Card className="rise lg:col-span-8">
        <CardHeader>
          <CardTitle>{regime === "normal" ? `Déclarations CA3 · ${year}` : `TVA · ${year}`}</CardTitle>
          <CardDescription>
            Les montants à reporter sur impots.gouv (Espace professionnel → Déclarer → TVA).
            {since ? ` Suivi depuis ${monthLabel(since)}, premier mois importé de la banque.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {obs.length === 0 ? (
            <EmptyState icon={<CalendarClock />} title="Aucune déclaration sur cet exercice" />
          ) : (
            <ul className="grid gap-3">
              {obs.map((o) => {
                const st = STATE_LABEL[o.state];
                return (
                  <li key={o.id} className="vitre-inset rounded-[22px] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold tracking-[-0.015em] text-foreground">{o.label}</p>
                        <p className="mt-0.5 text-[12.5px] text-ink-3">
                          Échéance {longDate(o.due)} · <Pill className={st.cls}>{st.label}</Pill>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-right">
                          <Num className={cn("n-inline block text-[17px]", o.amount < 0 ? "text-success" : "text-foreground")}>
                            {formatEur(Math.abs(o.amount))}
                          </Num>
                          <span className="block text-[11.5px] text-ink-3">{o.amount < 0 ? "crédit de TVA" : "à payer"}</span>
                        </span>
                        {o.state !== "en_cours" && (
                          <VatFiledButton
                            target={o.kind === "ca3" ? { kind: "ca3", month: o.period } : { kind: o.kind, year }}
                            amount={o.amount}
                            filed={o.state === "declaree"}
                          />
                        )}
                      </div>
                    </div>
                    {o.totals && (
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-4">
                        {[
                          ["Ventes HT", o.totals.salesBase],
                          ["TVA collectée", o.totals.collected],
                          ["TVA déductible", o.totals.deductible + o.totals.deductibleAssets],
                          ["Autoliquidation", o.totals.reverseVat],
                        ].map(([k, v]) => (
                          <div key={k as string}>
                            <dt className="text-ink-3">{k}</dt>
                            <dd>
                              <Num className="n-inline text-foreground">{formatEur(v as number)}</Num>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {o.totals && o.totals.unclassified > 0 && (
                      <p className="mt-2 text-[12px] text-warning">
                        {o.totals.unclassified} {plural(o.totals.unclassified, "mouvement non classé", "mouvements non classés")} : le
                        montant n&apos;est pas encore définitif.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card className="rise lg:col-span-4">
        <CardHeader>
          <CardTitle>Comment c&apos;est calculé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-[13px] leading-relaxed text-ink-2">
          <p>
            <strong className="text-foreground">TVA sur les encaissements</strong> : pour des prestations de services, la TVA
            est due quand le client paie — c&apos;est donc la banque et la caisse qui font foi.
          </p>
          <p>
            <strong className="text-foreground">SumUp</strong> : un virement arrive net de commission. La vente déclarée est le
            virement plus la commission, et la commission devient une charge.
          </p>
          <p>
            <strong className="text-foreground">Autoliquidation</strong> : Google, Meta, logiciels étrangers facturent HT. La
            TVA est à déclarer en collectée et en déductible : elle s&apos;annule, mais doit apparaître.
          </p>
          <p>
            <strong className="text-foreground">Taux par défaut</strong> : sorties en mer et nuits 10 %, eFoil 20 %. Fais
            confirmer ces taux une fois par un comptable ou ton service des impôts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ClosingView({
  movements,
  year,
  todayIso,
  closedMonths,
  obs,
  siren,
  since,
}: {
  since: string | null;
  movements: Movement[];
  year: number;
  todayIso: string;
  closedMonths: string[];
  obs: Obligation[];
  siren: string | null;
}) {
  const current = `${todayIso.slice(0, 7)}-01`;
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`)
    .filter((m) => m <= current && (!since || m >= since))
    .reverse();

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
      <Card className="rise lg:col-span-7">
        <CardHeader>
          <CardTitle>Clôture mensuelle</CardTitle>
          <CardDescription>Un mois clôturé ne peut plus être modifié : c&apos;est ce qui rend le journal fiable.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-[rgba(11,37,69,0.06)]">
            {months.map((m) => {
              const list = inMonth(movements, m);
              const todo = list.filter((x) => x.status === "a_classer").length;
              const missing = list.filter((x) => x.status === "justificatif").length;
              const closed = closedMonths.includes(m);
              const vat = obs.find((o) => o.kind === "ca3" && o.period === m);
              const running = m === current;
              const checks = [
                { ok: todo === 0, text: todo === 0 ? "Tout classé" : `${todo} à classer` },
                { ok: missing === 0, text: missing === 0 ? "Justifié" : `${missing} justificatif${missing > 1 ? "s" : ""}` },
                ...(vat ? [{ ok: vat.state === "declaree", text: vat.state === "declaree" ? "TVA déclarée" : "TVA à déclarer" }] : []),
              ];
              return (
                <li key={m} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[14px] font-semibold capitalize text-foreground">
                      {closed && <Lock className="size-3.5 text-success" />}
                      {monthLabel(m)}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {checks.map((c) => (
                        <Pill key={c.text} className={c.ok ? "bg-[rgba(15,159,110,0.1)] text-success" : "bg-[rgba(217,130,43,0.12)] text-warning"}>
                          {c.text}
                        </Pill>
                      ))}
                      <Pill className="bg-[rgba(11,37,69,0.05)] text-ink-2">{list.length} mvt</Pill>
                    </span>
                  </span>
                  {running ? (
                    <span className="text-[12px] text-ink-3">Mois en cours</span>
                  ) : (
                    <CloseMonthButton month={m} closed={closed} blocked={todo + missing > 0} />
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="grid content-start gap-4 lg:col-span-5 lg:gap-5">
        <Card className="rise">
          <CardHeader>
            <CardTitle>Exports</CardTitle>
            <CardDescription>Pour un comptable, un logiciel comptable ou un contrôle fiscal.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              {
                href: `/api/compta/fec?annee=${year}`,
                icon: <FileText />,
                title: "FEC de l'exercice",
                text: siren ? "Fichier des écritures comptables, format officiel" : "Ajoute ton SIREN dans Réglages pour nommer le fichier",
              },
              { href: `/api/compta/journal?annee=${year}`, icon: <FileSpreadsheet />, title: "Journal (Excel / CSV)", text: "Un mouvement par ligne, avec TVA et justificatif" },
              { href: `/api/compta/justificatifs?annee=${year}`, icon: <FileArchive />, title: "Tous les justificatifs (ZIP)", text: "Rangés par mois, avec un index" },
            ].map((e) => (
              <a
                key={e.href}
                href={e.href}
                className="flex items-center gap-3 rounded-[20px] border border-white/90 bg-white/60 p-3 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.05)] transition-colors hover:bg-white"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[rgba(47,127,224,0.1)] text-ocean [&_svg]:size-[18px]">
                  {e.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-foreground">{e.title}</span>
                  <span className="block truncate text-[12px] text-ink-3">{e.text}</span>
                </span>
                <Download className="size-4 text-ink-3" />
              </a>
            ))}
          </CardContent>
        </Card>

        <Card className="rise">
          <CardHeader>
            <CardTitle>Les obligations d&apos;une SAS</CardTitle>
            <CardDescription>Ce que le tableau de bord prépare, et ce qui reste à faire chaque année.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-[13px] leading-relaxed text-ink-2">
              {[
                "Tenir le journal au fil de l'eau, chaque pièce justifiée (conservation 10 ans).",
                "Déclarer et payer la TVA à chaque échéance.",
                "Établir bilan, compte de résultat et annexe à la clôture de l'exercice.",
                "Déposer la liasse fiscale et la déclaration d'impôt sur les sociétés (2065), puis payer l'IS.",
                "Faire approuver les comptes dans les 6 mois et les déposer au greffe.",
                "Payer la CFE en décembre.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden className="mt-[8px] size-1.5 shrink-0 rounded-full bg-ocean" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-ink-3">
              Le bilan et la liasse fiscale demandent un logiciel ou un expert-comptable : remets-lui le FEC et le ZIP des
              justificatifs.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
