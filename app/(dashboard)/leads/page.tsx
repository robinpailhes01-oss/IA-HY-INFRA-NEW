import { CheckCircle2, PhoneCall, UserPlus, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { LeadsTable, type LeadListItem } from "@/components/leads/leads-table";
import { sourceChannelLabel } from "@/lib/status";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id, first_name, last_name, email, phone, source_channel, interested_offer, score, status, needs_human_intervention, created_at",
    )
    .order("created_at", { ascending: false })
    .returns<LeadListItem[]>();

  const leads = data ?? [];
  const total = leads.length;
  const nouveaux = leads.filter((l) => l.status === "new").length;
  const reserves = leads.filter((l) => l.status === "booked").length;
  const aRappeler = leads.filter((l) => l.needs_human_intervention).length;

  const bySource = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      const key = l.source_channel ?? "other";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count);
  const maxSource = bySource[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <header className="enter-up space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Leads</h1>
        <p className="text-sm text-muted-foreground">
          {total} prospect{total > 1 ? "s" : ""} dans le pipeline · clique sur une ligne pour modifier
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total leads" value={total} icon={Users} accent="primary" index={0} />
        <KpiCard label="Nouveaux" value={nouveaux} icon={UserPlus} accent="info" index={1} />
        <KpiCard label="Réservés" value={reserves} icon={CheckCircle2} accent="success" index={2} />
        <KpiCard label="À rappeler" value={aRappeler} icon={PhoneCall} accent="gold" index={3} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="enter-up" style={{ animationDelay: "240ms" }}>
          <CardHeader>
            <CardTitle>Acquisition par canal</CardTitle>
            <CardDescription>D&apos;où viennent les leads</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {bySource.map((s) => (
                <li key={s.channel} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{sourceChannelLabel(s.channel)}</span>
                    <span className="font-medium text-foreground">{s.count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gold/70"
                      style={{ width: `${Math.round((s.count / maxSource) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="enter-up lg:col-span-2" style={{ animationDelay: "320ms" }}>
          <CardHeader>
            <CardTitle>Tous les leads</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadsTable leads={leads} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
