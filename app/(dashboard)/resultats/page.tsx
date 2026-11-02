import { Coins, Inbox, Euro, Send } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { SignaturePanel } from "@/components/dashboard/signature-panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MotionCard } from "@/components/dashboard/motion-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { TrendChart } from "@/components/charts/trend-chart";
import { RingGauge } from "@/components/charts/ring-gauge";
import { ChannelLogo } from "@/components/leads/channel-logo";
import { fetchAll } from "@/components/agent/fetch-all";
import { formatNumber } from "@/lib/format";

// ── Résultats de Léa ───────────────────────────────────────────────────────
// Le bilan depuis le début : demandes traitées, messages envoyés, chiffre
// d'affaires, crédits IA consommés. Mêmes sources et mêmes calculs qu'avant
// la refonte ; seules la mise en page et la pagination (au-delà de 1 000
// lignes) changent.

// Les crédits IA réels (hub_credit_ledger) sont affichés multipliés par ce
// facteur — valeur d'usage retail, pas le coût brut payé au fournisseur.
const CREDIT_DISPLAY_MULTIPLIER = 25;

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp_baileys: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
};
// Le logo à afficher pour un `channel_type` du journal des crédits.
const CHANNEL_LOGO: Record<string, string> = {
  whatsapp_baileys: "whatsapp",
  instagram: "instagram",
};

const MOIS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Clé AAAA-MM à l'heure de Paris. */
const parisMonth = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" });
function monthKey(d: Date | string): string {
  return parisMonth.format(new Date(d)).slice(0, 7);
}

export default async function ResultatsPage() {
  const supabase = await createClient();

  const [leadsRes, waSentRes, waLeaRes, emailLogRes, revenues, ledger] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("wa_messages").select("*", { count: "exact", head: true }).eq("from_me", true),
    // Les seuls messages WhatsApp écrits par Léa elle-même (pas par Robin) :
    // c'est ce chiffre, et lui seul, qui peut dire « à ta place ».
    supabase
      .from("wa_messages")
      .select("*", { count: "exact", head: true })
      .eq("from_me", true)
      .eq("is_from_human", false),
    supabase.from("email_log").select("*", { count: "exact", head: true }),
    fetchAll<{ amount: number | null }>((from, to) =>
      supabase.from("revenues").select("amount").order("id", { ascending: true }).range(from, to),
    ),
    fetchAll<{ channel_type: string | null; credits: number | null; occurred_at: string | null }>((from, to) =>
      supabase
        .from("hub_credit_ledger")
        .select("channel_type, credits, occurred_at")
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const demandesTraitees = leadsRes.count ?? 0;
  const messagesWhatsapp = waSentRes.count ?? 0;
  const messagesEmail = emailLogRes.count ?? 0;
  const messagesTotal = messagesWhatsapp + messagesEmail;
  // « Messages envoyés » garde sa définition historique (tout ce qui est
  // parti : WhatsApp de Léa ET de Robin, emails automatiques et manuels).
  // La phrase de Léa, elle, ne revendique que ce qu'elle a écrit.
  const leaWhatsapp = waLeaRes.count ?? 0;
  const leaShare = pct(leaWhatsapp, messagesWhatsapp);

  const caGenere = revenues.reduce((s, r) => s + (r.amount ?? 0), 0);

  const creditsBase = ledger.reduce((s, r) => s + Number(r.credits ?? 0), 0);
  const creditsAffiches = creditsBase * CREDIT_DISPLAY_MULTIPLIER;

  const byChannel = Object.entries(
    ledger.reduce<Record<string, number>>((acc, r) => {
      const key = r.channel_type ?? "autre";
      acc[key] = (acc[key] ?? 0) + Number(r.credits ?? 0) * CREDIT_DISPLAY_MULTIPLIER;
      return acc;
    }, {}),
  )
    .map(([channel, credits]) => ({ channel, credits }))
    .sort((a, b) => b.credits - a.credits);
  const maxChannelCredits = byChannel[0]?.credits ?? 1;

  // Crédits par mois sur les six derniers mois (mois en cours inclus).
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 15));
    return { key: monthKey(d), label: MOIS[d.getUTCMonth()] };
  });
  const perMonth = new Map(months.map((m) => [m.key, 0]));
  for (const r of ledger) {
    if (!r.occurred_at) continue;
    const k = monthKey(r.occurred_at);
    if (perMonth.has(k)) perMonth.set(k, perMonth.get(k)! + Number(r.credits ?? 0) * CREDIT_DISPLAY_MULTIPLIER);
  }
  const monthly = months.map((m) => ({ label: m.label, a: Math.round(perMonth.get(m.key) ?? 0) }));

  const waShare = pct(messagesWhatsapp, messagesTotal);
  const perRequest = demandesTraitees > 0 ? messagesTotal / demandesTraitees : 0;
  const creditsPerRequest = demandesTraitees > 0 ? creditsAffiches / demandesTraitees : 0;

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <PageHeader
        eyebrow="Agent WhatsApp · bilan"
        title={
          <>
            Ce que Léa a <em>accompli</em>
          </>
        }
        description="Depuis son arrivée : chaque demande traitée, chaque message envoyé à ta place, et ce que ça a consommé en crédits IA."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <MotionCard index={0} lift={false} className="lg:col-span-5">
          <SignaturePanel
            eyebrow="Depuis le début"
            className="flex h-full flex-col [&>div:last-child]:flex [&>div:last-child]:flex-1 [&>div:last-child]:flex-col"
          >
            <p className="t-panel mb-6 text-white">
              {demandesTraitees === 0 ? (
                <>Léa n&apos;a pas encore reçu de demande. Elle répondra dès le premier message.</>
              ) : (
                <>
                  Léa a traité <Num className="text-[#9fd0f7]">{formatNumber(demandesTraitees)}</Num>{" "}
                  {demandesTraitees > 1 ? "demandes" : "demande"} et écrit{" "}
                  <Num className="text-[#9fd0f7]">{formatNumber(leaWhatsapp)}</Num> messages WhatsApp{" "}
                  <em className="text-[#bfe0fb]">à ta place.</em>
                </>
              )}
            </p>
            {/* Sous-grille : libellés, chiffres et jauges sur trois rangées
                communes — un libellé sur deux lignes ne décale plus son chiffre. */}
            <dl className="mt-auto grid grid-cols-3 grid-rows-[auto_auto_auto] gap-x-3 border-t border-white/10 pt-5 sm:gap-x-6">
              <div className="row-span-3 grid min-w-0 grid-rows-subgrid">
                <dt className="t-label self-end text-[#9fbfe2]">Part de Léa</dt>
                <dd className="n-kpi mt-1.5 text-white">
                  {messagesWhatsapp === 0 ? "—" : <Num>{`${leaShare}\u00a0%`}</Num>}
                </dd>
                {messagesWhatsapp > 0 && (
                  <dd aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/12">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#7cc0f5,#2f7fe0)]"
                      style={{ width: `${leaShare}%` }}
                    />
                  </dd>
                )}
              </div>
              <div className="row-span-3 grid min-w-0 grid-rows-subgrid">
                <dt className="t-label self-end text-[#9fbfe2]">Messages par demande</dt>
                <dd className="n-kpi mt-1.5 text-white">
                  <Num>{perRequest.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</Num>
                </dd>
              </div>
              <div className="row-span-3 grid min-w-0 grid-rows-subgrid">
                <dt className="t-label self-end text-[#9fbfe2]">Crédits par demande</dt>
                <dd className="n-kpi mt-1.5 text-white">
                  <Num>{formatNumber(Math.round(creditsPerRequest))}</Num>
                </dd>
              </div>
            </dl>
          </SignaturePanel>
        </MotionCard>

        <div className="grid grid-cols-2 gap-4 lg:col-span-7 lg:gap-5">
          <KpiCard
            label="Demandes traitées"
            value={demandesTraitees}
            icon={<Inbox />}
            accent="indigo"
            hint="leads créés depuis le début"
            primary
            index={1}
          />
          <KpiCard
            label="Messages envoyés"
            value={messagesTotal}
            icon={<Send />}
            accent="ocean"
            hint={`${formatNumber(messagesWhatsapp)} WhatsApp · ${formatNumber(messagesEmail)} email`}
            index={2}
          />
          <KpiCard
            label="Chiffre d'affaires"
            value={caGenere}
            format="eur"
            icon={<Euro />}
            accent="success"
            hint="toutes sources · depuis le début"
            index={3}
          />
          <KpiCard
            label="Crédits IA"
            value={Math.round(creditsAffiches)}
            icon={<Coins />}
            accent="sky"
            hint="valeur d'usage consommée"
            index={4}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <MotionCard index={5} lift={false} className="lg:col-span-7">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Crédits IA</CardTitle>
              <CardDescription>
                <Num>{formatNumber(Math.round(creditsAffiches))}</Num> crédits au total · six derniers mois et
                répartition par canal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {byChannel.length === 0 ? (
                <EmptyState icon={<Coins />} title="Aucune donnée d'usage pour le moment">
                  Les crédits apparaîtront ici dès les premières réponses générées par Léa.
                </EmptyState>
              ) : (
                <div className="grid gap-6 md:grid-cols-[1.25fr_1fr] md:items-end">
                  <TrendChart data={monthly} type="bar" a={{ name: "Crédits" }} height={200} />
                  <ul className="space-y-4">
                    {byChannel.map((c) => (
                      <li key={c.channel}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                          <span className="flex items-center gap-2 font-medium text-foreground">
                            <span className="grid size-7 place-items-center rounded-full bg-white text-ink-2 shadow-[var(--shadow-glass)]">
                              <ChannelLogo channel={CHANNEL_LOGO[c.channel] ?? null} className="size-3.5" />
                            </span>
                            {CHANNEL_LABELS[c.channel] ?? c.channel}
                          </span>
                          <Num className="n-inline text-foreground">{formatNumber(Math.round(c.credits))}</Num>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[rgba(11,37,69,0.06)]">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#7cc0f5,#2f7fe0)]"
                            style={{ width: `${pct(c.credits, maxChannelCredits)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </MotionCard>

        <MotionCard index={6} lift={false} className="lg:col-span-5">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Messages par canal</CardTitle>
              <CardDescription>Tout ce qui est parti, depuis le début</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 items-center">
              {messagesTotal === 0 ? (
                <EmptyState icon={<Send />} title="Aucun message envoyé" className="w-full">
                  Le premier message de Léa apparaîtra ici.
                </EmptyState>
              ) : (
                <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:justify-center">
                  <RingGauge value={waShare} size={148} stroke={12} color="#1fae5b" track="rgba(11,37,69,0.07)">
                    <span className="flex flex-col items-center">
                      <Num className="n-kpi text-foreground">{`${waShare}\u00a0%`}</Num>
                      <span className="t-caption text-ink-3">sur WhatsApp</span>
                    </span>
                  </RingGauge>
                  <ul className="w-full max-w-[220px] space-y-3">
                    <li className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="flex items-center gap-2 text-ink-2">
                        <span className="size-2.5 rounded-full bg-whatsapp" />
                        WhatsApp
                      </span>
                      <Num className="n-inline text-foreground">{formatNumber(messagesWhatsapp)}</Num>
                    </li>
                    <li className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="flex items-center gap-2 text-ink-2">
                        <span className="size-2.5 rounded-full bg-[rgba(11,37,69,0.15)]" />
                        Email
                      </span>
                      <Num className="n-inline text-foreground">{formatNumber(messagesEmail)}</Num>
                    </li>
                    <li className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] pt-3 text-[13px] font-semibold">
                      <span className="text-foreground">Total</span>
                      <Num className="n-inline text-foreground">{formatNumber(messagesTotal)}</Num>
                    </li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </MotionCard>
      </div>
    </div>
  );
}
