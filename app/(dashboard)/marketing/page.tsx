import { Euro, Eye, Heart, Megaphone, TrendingDown, TrendingUp, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { formatDateLong, formatEur, formatNumber } from "@/lib/format";
import { sourceChannelLabel } from "@/lib/status";

const CONFIRMED = new Set(["confirmed", "completed"]);

// Classification des canaux pour distinguer Payant / Organique / Autre
const PAID_CHANNELS = new Set([
  "instagram_ads",
  "tiktok_ads",
  "meta_ads",
  "google",
  "google_ads",
]);
const ORGANIC_CHANNELS = new Set([
  "instagram_organic",
  "tiktok_organic",
  "facebook_organic",
  "word_of_mouth",
]);

// Le site internet n'est PAS une source d'acquisition : tout le monde réserve
// via le site. On l'exclut donc de toutes les statistiques marketing.
const EXCLUDED_CHANNELS = new Set(["website"]);

type CanalCategory = "paid" | "organic" | "other";
function canalCategory(channel: string | null): CanalCategory {
  if (!channel) return "other";
  if (PAID_CHANNELS.has(channel)) return "paid";
  if (ORGANIC_CHANNELS.has(channel)) return "organic";
  return "other";
}

const CONTENT_CHANNEL: Record<string, string> = {
  instagram_reel: "Reel",
  instagram_post: "Post",
  instagram_story: "Story",
  tiktok: "TikTok",
  facebook: "Facebook",
  whatsapp_status: "WhatsApp",
};

const CONTENT_STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  published: { label: "Publié", variant: "outline" },
  scheduled: { label: "Programmé", variant: "secondary" },
  in_progress: { label: "En cours", variant: "secondary" },
  idea: { label: "Idée", variant: "secondary" },
};

type AdExpenseRow = {
  id: string;
  date: string;
  description: string | null;
  amount: number | null;
};

type ContentRow = {
  id: string;
  channel: string;
  title: string | null;
  status: string | null;
  publish_date: string | null;
  views: number | null;
  likes: number | null;
  leads_attributed: number | null;
};

type BookingAttrRow = {
  source_channel: string | null;
  status: string | null;
  total_amount: number | null;
};

function roasText(revenue: number, budget: number): string {
  if (budget <= 0) return "—";
  return `${(revenue / budget).toFixed(1).replace(".", ",")}×`;
}

function pct(n: number, total: number): string {
  if (total === 0 || n === 0) return "0 %";
  return `${Math.round((n / total) * 100)} %`;
}

export default async function MarketingPage() {
  const supabase = await createClient();

  const [adExpensesRes, contentRes, bookingsRes] = await Promise.all([
    // Budget pub réel : on lit les dépenses catégorisées "marketing".
    // (Avant on lisait `ad_stats` mais cette table demandait une saisie
    // manuelle dédiée que personne ne faisait. Maintenant le coût pub
    // vient directement de tes dépenses, sans double saisie.)
    supabase
      .from("expenses")
      .select("id, date, description, amount")
      .eq("category", "marketing")
      .order("date", { ascending: false })
      .returns<AdExpenseRow[]>(),
    supabase
      .from("content_marketing")
      .select("id, channel, title, status, publish_date, views, likes, leads_attributed")
      .order("publish_date", { ascending: false })
      .returns<ContentRow[]>(),
    supabase
      .from("bookings")
      .select("source_channel, status, total_amount")
      .returns<BookingAttrRow[]>(),
  ]);

  const adExpenses = adExpensesRes.data ?? [];
  const content = contentRes.data ?? [];
  const bookings = bookingsRes.data ?? [];

  // ── Attribution : UNIQUEMENT bookings.source_channel (renseigné par toi) ──
  // On écarte le canal « site internet » (tout le monde réserve via le site).
  const confirmedBookings = bookings.filter(
    (b) => CONFIRMED.has(b.status ?? "") && !EXCLUDED_CHANNELS.has(b.source_channel ?? ""),
  );
  const taggedBookings = confirmedBookings.filter((b) => b.source_channel);
  const untaggedCount = confirmedBookings.length - taggedBookings.length;

  type ChannelStat = { count: number; revenue: number };
  const byChannel: Record<string, ChannelStat> = {};
  for (const b of taggedBookings) {
    const ch = b.source_channel!;
    if (!byChannel[ch]) byChannel[ch] = { count: 0, revenue: 0 };
    byChannel[ch].count++;
    byChannel[ch].revenue += b.total_amount ?? 0;
  }

  const attribution = Object.entries(byChannel)
    .map(([channel, s]) => ({
      channel,
      category: canalCategory(channel),
      count: s.count,
      revenue: s.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalAttrRevenue = attribution.reduce((s, r) => s + r.revenue, 0);

  // Agrégats par catégorie (Payant vs Organique)
  const catAgg: Record<CanalCategory, ChannelStat> = {
    paid: { count: 0, revenue: 0 },
    organic: { count: 0, revenue: 0 },
    other: { count: 0, revenue: 0 },
  };
  for (const r of attribution) {
    catAgg[r.category].count += r.count;
    catAgg[r.category].revenue += r.revenue;
  }

  // ── Budget pub réel (depuis tes dépenses category=marketing) ──
  const totalAdSpend = adExpenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const paidAdsRevenue = catAgg.paid.revenue;
  const paidAdsBookings = catAgg.paid.count;
  const netAdMargin = paidAdsRevenue - totalAdSpend;
  const cpa = paidAdsBookings > 0 ? Math.round(totalAdSpend / paidAdsBookings) : 0;

  return (
    <div className="space-y-6">
      <header className="enter-up space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Marketing</h1>
        <p className="text-sm text-muted-foreground">
          Sources de trafic & performance des campagnes
        </p>
      </header>

      {/* ── KPI synthèse : Payant vs Organique ─────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="CA Payant"
          value={catAgg.paid.revenue}
          format="eur"
          icon={TrendingUp}
          accent="info"
          hint={`${catAgg.paid.count} réservation${catAgg.paid.count !== 1 ? "s" : ""}`}
          index={0}
        />
        <KpiCard
          label="CA Organique"
          value={catAgg.organic.revenue}
          format="eur"
          icon={Heart}
          accent="success"
          hint={`${catAgg.organic.count} réservation${catAgg.organic.count !== 1 ? "s" : ""}`}
          index={1}
        />
        <KpiCard
          label="Sans source"
          value={untaggedCount}
          icon={Users}
          accent="gold"
          hint="Réservations à étiqueter"
          index={2}
        />
      </div>

      {/* ── D'où viennent nos clients ? ──────────────────────────── */}
      <Card className="enter-up" style={{ animationDelay: "160ms" }}>
        <CardHeader>
          <CardTitle>D&apos;où viennent nos clients ?</CardTitle>
          <CardDescription>
            Basé sur le canal renseigné dans chaque réservation confirmée ·{" "}
            {formatEur(totalAttrRevenue)} de CA attribué
            {untaggedCount > 0 && (
              <>
                {" "}· <span className="text-warning">{untaggedCount} sans canal renseigné</span>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attribution.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune réservation avec source renseignée. Édite tes réservations pour indiquer le
              canal d&apos;acquisition (Instagram Ads, organique, bouche à oreille…).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Réservations</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                  <TableHead className="text-right">Panier moyen</TableHead>
                  <TableHead className="text-right">% du CA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attribution.map((r) => (
                  <TableRow key={r.channel}>
                    <TableCell className="font-medium text-foreground">
                      {sourceChannelLabel(r.channel)}
                    </TableCell>
                    <TableCell>
                      {r.category === "paid" ? (
                        <Badge className="bg-info/15 text-info hover:bg-info/15">Payant</Badge>
                      ) : r.category === "organic" ? (
                        <Badge className="bg-success/15 text-success hover:bg-success/15">
                          Organique
                        </Badge>
                      ) : (
                        <Badge variant="outline">Autre</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {r.count}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {formatEur(r.revenue)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.count > 0 ? formatEur(Math.round(r.revenue / r.count)) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {pct(r.revenue, totalAttrRevenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── KPI publicité (dépenses réelles vs CA payant) ─────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Budget pub dépensé"
          value={totalAdSpend}
          format="eur"
          icon={Megaphone}
          accent="info"
          hint={`${adExpenses.length} dépense${adExpenses.length !== 1 ? "s" : ""} marketing`}
          index={0}
        />
        <KpiCard
          label="CA généré par la pub"
          value={paidAdsRevenue}
          format="eur"
          icon={Euro}
          accent="success"
          hint={`${paidAdsBookings} réservation${paidAdsBookings !== 1 ? "s" : ""}`}
          index={1}
        />
        <KpiCard
          label="Coût par réservation"
          value={cpa}
          format="eur"
          icon={TrendingUp}
          accent="gold"
          hint={
            totalAdSpend > 0
              ? `ROAS ${roasText(paidAdsRevenue, totalAdSpend)}`
              : "Aucune dépense pub"
          }
          index={2}
        />
        <KpiCard
          label="Marge nette pub"
          value={netAdMargin}
          format="eur"
          icon={netAdMargin >= 0 ? TrendingUp : TrendingDown}
          accent={netAdMargin >= 0 ? "success" : "gold"}
          hint="CA payant − budget pub"
          index={3}
        />
      </div>

      {/* ── Détail des dépenses pub ───────────────────────────────── */}
      <Card className="enter-up" style={{ animationDelay: "320ms" }}>
        <CardHeader>
          <CardTitle>Détail des dépenses publicitaires</CardTitle>
          <CardDescription>
            Tirées de tes dépenses (catégorie « Marketing »).{" "}
            {totalAdSpend > 0 && paidAdsRevenue > 0 ? (
              <>
                Chaque € investi a rapporté{" "}
                <strong className="text-foreground">
                  {(paidAdsRevenue / totalAdSpend).toFixed(2).replace(".", ",")} €
                </strong>{" "}
                de CA.
              </>
            ) : (
              "Ajoute tes pubs dans /finances avec la catégorie Marketing."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {adExpenses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune dépense marketing enregistrée.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adExpenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDateLong(e.date)}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {e.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {formatEur(e.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Contenus organiques ───────────────────────────────────── */}
      <Card className="enter-up" style={{ animationDelay: "360ms" }}>
        <CardHeader>
          <CardTitle>Contenus</CardTitle>
          <CardDescription>Publications organiques récentes & programmées</CardDescription>
        </CardHeader>
        <CardContent>
          {content.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun contenu pour le moment.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {content.map((c) => {
                const status = CONTENT_STATUS[c.status ?? ""] ?? {
                  label: c.status ?? "—",
                  variant: "secondary" as const,
                };
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <Badge variant="secondary" className="shrink-0">
                      {CONTENT_CHANNEL[c.channel] ?? c.channel}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.title ?? "Sans titre"}
                      </p>
                      <p className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="size-3.5" />
                          {formatNumber(c.views)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Heart className="size-3.5" />
                          {formatNumber(c.likes)}
                        </span>
                        <span>{c.leads_attributed ?? 0} leads</span>
                        {c.publish_date && <span>· {formatDateLong(c.publish_date)}</span>}
                      </p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
