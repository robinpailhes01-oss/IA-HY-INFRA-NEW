import { Euro, Eye, Heart, Megaphone, Target, Users } from "lucide-react";

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

const CHANNEL_LABELS: Record<string, string> = {
  meta_ads: "Meta Ads",
  google: "Google Ads",
  instagram_ads: "Instagram Ads",
  tiktok_ads: "TikTok Ads",
};

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

type AdRow = {
  channel: string;
  campaign_name: string | null;
  budget_spent: number | null;
  impressions: number | null;
  clicks: number | null;
  leads_generated: number | null;
  bookings_attributed: number | null;
  revenue_generated: number | null;
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

type LeadRow = {
  id: string;
  source_channel: string | null;
  status: string | null;
};

type BookingAttrRow = {
  id: string;
  source_channel: string | null;
  lead_id: string | null;
  status: string | null;
  total_amount: number | null;
};

type AttributionRow = {
  channel: string;
  leadCount: number;
  bookingCount: number;
  revenue: number;
  convRate: number | null;
};

function roasText(revenue: number, budget: number): string {
  if (budget <= 0) return "—";
  return `${(revenue / budget).toFixed(1).replace(".", ",")}×`;
}

function pct(n: number, total: number): string {
  if (total === 0 || n === 0) return "—";
  return `${Math.round((n / total) * 100)} %`;
}

export default async function MarketingPage() {
  const supabase = await createClient();

  const [adsRes, contentRes, leadsRes, bookingsAttrRes] = await Promise.all([
    supabase
      .from("ad_stats")
      .select(
        "channel, campaign_name, budget_spent, impressions, clicks, leads_generated, bookings_attributed, revenue_generated",
      )
      .order("budget_spent", { ascending: false })
      .returns<AdRow[]>(),
    supabase
      .from("content_marketing")
      .select("id, channel, title, status, publish_date, views, likes, leads_attributed")
      .order("publish_date", { ascending: false })
      .returns<ContentRow[]>(),
    supabase
      .from("leads")
      .select("id, source_channel, status")
      .eq("archived", false)
      .returns<LeadRow[]>(),
    supabase
      .from("bookings")
      .select("id, source_channel, lead_id, status, total_amount")
      .returns<BookingAttrRow[]>(),
  ]);

  const ads = adsRes.data ?? [];
  const content = contentRes.data ?? [];
  const leads = leadsRes.data ?? [];
  const bookingsRaw = bookingsAttrRes.data ?? [];

  // ── Attribution: resolve each booking's source, fallback to lead's ──
  const leadSourceMap = new Map<string, string | null>(
    leads.map((l) => [l.id, l.source_channel]),
  );

  const confirmedBookings = bookingsRaw.filter((b) => CONFIRMED.has(b.status ?? ""));

  const leadsBySource: Record<string, number> = {};
  for (const l of leads) {
    const ch = l.source_channel ?? "other";
    leadsBySource[ch] = (leadsBySource[ch] ?? 0) + 1;
  }

  const bookingsBySource: Record<string, { count: number; revenue: number }> = {};
  for (const b of confirmedBookings) {
    const ch =
      b.source_channel ??
      (b.lead_id ? (leadSourceMap.get(b.lead_id) ?? "other") : "other");
    if (!bookingsBySource[ch]) bookingsBySource[ch] = { count: 0, revenue: 0 };
    bookingsBySource[ch].count++;
    bookingsBySource[ch].revenue += b.total_amount ?? 0;
  }

  const allChannels = new Set([
    ...Object.keys(leadsBySource),
    ...Object.keys(bookingsBySource),
  ]);

  const attribution: AttributionRow[] = [...allChannels]
    .map((ch) => {
      const lc = leadsBySource[ch] ?? 0;
      const bc = bookingsBySource[ch]?.count ?? 0;
      const convRate = lc > 0 && bc <= lc ? bc / lc : lc > 0 ? 1 : null;
      return {
        channel: ch,
        leadCount: lc,
        bookingCount: bc,
        revenue: bookingsBySource[ch]?.revenue ?? 0,
        convRate,
      };
    })
    .sort((a, b) => b.bookingCount - a.bookingCount || b.leadCount - a.leadCount);

  const totalAttrRevenue = attribution.reduce((s, r) => s + r.revenue, 0);
  const totalBookingsConfirmed = confirmedBookings.length;
  const totalLeadCount = leads.length;

  // ── Ads aggregates ────────────────────────────────────────────────
  const totalBudget = ads.reduce((s, a) => s + (a.budget_spent ?? 0), 0);
  const totalAdsLeads = ads.reduce((s, a) => s + (a.leads_generated ?? 0), 0);
  const totalRevenue = ads.reduce((s, a) => s + (a.revenue_generated ?? 0), 0);
  const totalAdsBookings = ads.reduce((s, a) => s + (a.bookings_attributed ?? 0), 0);
  const cpl = totalAdsLeads > 0 ? Math.round(totalBudget / totalAdsLeads) : 0;

  return (
    <div className="space-y-6">
      <header className="enter-up space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Marketing</h1>
        <p className="text-sm text-muted-foreground">
          Attribution des réservations & performance des campagnes
        </p>
      </header>

      {/* ── D'où viennent nos clients ? ──────────────────────────── */}
      <Card className="enter-up" style={{ animationDelay: "80ms" }}>
        <CardHeader>
          <CardTitle>D&apos;où viennent nos clients ?</CardTitle>
          <CardDescription>
            {totalBookingsConfirmed} réservation{totalBookingsConfirmed !== 1 ? "s" : ""}{" "}
            confirmée{totalBookingsConfirmed !== 1 ? "s" : ""} · {totalLeadCount} lead
            {totalLeadCount !== 1 ? "s" : ""} en pipeline · {formatEur(totalAttrRevenue)} de CA total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attribution.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune donnée pour le moment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Réservations</TableHead>
                  <TableHead className="text-right">Taux de conv.</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                  <TableHead className="text-right">% du CA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attribution.map((r) => (
                  <TableRow key={r.channel}>
                    <TableCell className="font-medium text-foreground">
                      {sourceChannelLabel(r.channel)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.leadCount}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {r.bookingCount > 0 ? r.bookingCount : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.convRate !== null
                        ? `${Math.round(r.convRate * 100)} %`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {r.revenue > 0 ? formatEur(r.revenue) : "—"}
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

      {/* ── KPI campagnes payantes ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Budget pub dépensé"
          value={totalBudget}
          format="eur"
          icon={Megaphone}
          accent="info"
          index={0}
        />
        <KpiCard label="Leads (pub)" value={totalAdsLeads} icon={Users} accent="primary" index={1} />
        <KpiCard
          label="Coût par lead"
          value={cpl}
          format="eur"
          icon={Target}
          accent="gold"
          index={2}
        />
        <KpiCard
          label="CA attribué (pub)"
          value={totalRevenue}
          format="eur"
          icon={Euro}
          accent="success"
          hint={`ROAS ${roasText(totalRevenue, totalBudget)}`}
          index={3}
        />
      </div>

      {/* ── Performance campagnes ─────────────────────────────────── */}
      <Card className="enter-up" style={{ animationDelay: "320ms" }}>
        <CardHeader>
          <CardTitle>Performance des campagnes</CardTitle>
          <CardDescription>
            ROAS global {roasText(totalRevenue, totalBudget)} · {totalAdsBookings} réservations attribuées
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ads.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune campagne pour le moment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Clics</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead className="text-right">CA attribué</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((a) => {
                  const leads = a.leads_generated ?? 0;
                  const budget = a.budget_spent ?? 0;
                  const adCpl = leads > 0 ? Math.round(budget / leads) : 0;
                  return (
                    <TableRow key={`${a.channel}-${a.campaign_name}`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {CHANNEL_LABELS[a.channel] ?? a.channel}
                          </span>
                          {a.campaign_name && (
                            <span className="text-xs text-muted-foreground">
                              {a.campaign_name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-foreground">
                        {formatEur(budget)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatNumber(a.impressions)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatNumber(a.clicks)}
                      </TableCell>
                      <TableCell className="text-right text-foreground">{leads}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatEur(adCpl)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground">
                        {formatEur(a.revenue_generated)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-success">
                        {roasText(a.revenue_generated ?? 0, budget)}
                      </TableCell>
                    </TableRow>
                  );
                })}
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
