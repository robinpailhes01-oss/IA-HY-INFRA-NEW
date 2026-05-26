import { CheckCircle2, PhoneCall, UserPlus, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
import { formatDateLong } from "@/lib/format";
import { leadStatusBadge, sourceChannelLabel } from "@/lib/status";

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source_channel: string | null;
  interested_offer: string | null;
  score: number | null;
  status: string | null;
  needs_human_intervention: boolean | null;
  created_at: string | null;
};

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "Lead";
}

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id, first_name, last_name, email, phone, source_channel, interested_offer, score, status, needs_human_intervention, created_at",
    )
    .order("created_at", { ascending: false })
    .returns<LeadRow[]>();

  const leads = data ?? [];
  const total = leads.length;
  const nouveaux = leads.filter((l) => l.status === "new").length;
  const reserves = leads.filter((l) => l.status === "booked").length;
  const aRappeler = leads.filter((l) => l.needs_human_intervention).length;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Leads</h1>
        <p className="text-sm text-muted-foreground">
          {total} prospect{total > 1 ? "s" : ""} dans le pipeline
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total leads" value={String(total)} icon={Users} accent="primary" />
        <KpiCard label="Nouveaux" value={String(nouveaux)} icon={UserPlus} accent="info" />
        <KpiCard label="Réservés" value={String(reserves)} icon={CheckCircle2} accent="success" />
        <KpiCard label="À rappeler" value={String(aRappeler)} icon={PhoneCall} accent="gold" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tous les leads</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun lead pour le moment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Offre</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Reçu le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const status = leadStatusBadge(lead.status);
                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="flex items-center gap-2 font-medium text-foreground">
                            {fullName(lead.first_name, lead.last_name)}
                            {lead.needs_human_intervention && (
                              <Badge variant="destructive">À rappeler</Badge>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {lead.email ?? lead.phone ?? "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sourceChannelLabel(lead.source_channel)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.interested_offer ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {typeof lead.score === "number" ? (
                          <span className="font-semibold text-gold">{lead.score}/10</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.created_at ? formatDateLong(lead.created_at) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
