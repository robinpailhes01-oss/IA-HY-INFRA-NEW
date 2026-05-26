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

function roasText(revenue: number, budget: number): string {
  if (budget <= 0) return "—";
  return `${(revenue / budget).toFixed(1).replace(".", ",")}×`;
}

export default async function MarketingPage() {
  const supabase = await createClient();

  const [adsRes, contentRes, bookingsRes] = await Promise.all([
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
      .from("bookings")
      .select("source_channel, total_amount, status")
      .returns<{ source_channel: string | null; total_amount: number | null; status: string | null }[]>(),
  ]);

  const ads = adsRes.data ?? [];
  const content = contentRes.data ?? [];

  const caByChannel = Object.entries(
    (bookingsRes.data ?? [])
      .filter((b) => CONFIRMED.has(b.status ?? ""))
      .reduce<Record<string, number>>((acc, b) => {
        const key = b.source_channel ?? "other";
        acc[key] = (acc[key] ?? 0) + (b.total_amount ?? 0);
        return acc;
      }, {}),
  )
    .map(([channel, amount]) => ({ channel, amount }))
    .sort((a, b) => b.amount - a.amount);
  const maxChannel = caByChannel[0]?.amount ?? 1;
  const totalChannelCa = caByChannel.reduce((s, c) => s + c.amount, 0);

  const totalBudget = ads.reduce((s, a) => s + (a.budget_spent ?? 0), 0);
  const totalLeads = ads.reduce((s, a) => s + (a.leads_generated ?? 0), 0);
  const totalRevenue = ads.reduce((s, a) => s + (a.revenue_generated ?? 0), 0);
  const totalBookings = ads.reduce((s, a) => s + (a.bookings_attributed ?? 0), 0);
  const cpl = totalLeads > 0 ? Math.round(totalBudget / totalLeads) : 0;

  return (
    <div className="space-y-6">
      <header className="enter-up space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Marketing
        </h1>
        <p className="text-sm text-muted-foreground">
          Acquisition payante & contenu organique · 30 derniers jours
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Budget dépensé" value={totalBudget} format="eur" icon={Megaphone} accent="info" index={0} />
        <KpiCard label="Leads générés" value={totalLeads} icon={Users} accent="primary" index={1} />
        <KpiCard label="Coût par lead" value={cpl} format="eur" icon={Target} accent="gold" index={2} />
        <KpiCard
          label="CA attribué"
          value={totalRevenue}
          format="eur"
          icon={Euro}
          accent="success"
          hint={`ROAS ${roasText(totalRevenue, totalBudget)}`}
          index={3}
        />
      </div>

      <Card className="enter-up" style={{ animationDelay: "240ms" }}>
        <CardHeader>
          <CardTitle>CA par canal d&apos;acquisition</CardTitle>
          <CardDescription>
            D&apos;où viennent les réservations confirmées · {formatEur(totalChannelCa)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {caByChannel.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune réservation pour le moment.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {caByChannel.map((c) => (
                <li key={c.channel} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{sourceChannelLabel(c.channel)}</span>
                    <span className="font-medium text-foreground">{formatEur(c.amount)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gold/70"
                      style={{ width: `${Math.round((c.amount / maxChannel) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="enter-up" style={{ animationDelay: "320ms" }}>
        <CardHeader>
          <CardTitle>Performance par canal</CardTitle>
          <CardDescription>
            ROAS global {roasText(totalRevenue, totalBudget)} · {totalBookings} réservations attribuées
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
                      <TableCell className="text-right text-foreground">{formatEur(budget)}</TableCell>
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
