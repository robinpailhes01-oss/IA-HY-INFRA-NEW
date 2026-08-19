import { Archive, Mail, MailCheck, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { UploadIcsButton } from "@/components/archives/upload-ics-button";
import { ArchivesTable, type ArchiveClient } from "@/components/archives/archives-table";

const CAMPAIGN = "changement_nom_2025";

export default async function ArchivesPage() {
  const supabase = await createClient();

  const [{ data: clients }, { data: outreach }] = await Promise.all([
    supabase
      .from("legacy_clients")
      .select("id, first_name, last_name, email, phone, offer_summary, event_date, event_year")
      .order("event_date", { ascending: false }),
    supabase
      .from("client_outreach")
      .select("legacy_client_id, status, sent_at, error")
      .eq("campaign", CAMPAIGN),
  ]);

  const outreachByClient = new Map((outreach ?? []).map((o) => [o.legacy_client_id, o]));

  const rows: ArchiveClient[] = (clients ?? []).map((c) => {
    const o = outreachByClient.get(c.id);
    return {
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      email: c.email,
      phone: c.phone,
      offerSummary: c.offer_summary,
      eventDate: c.event_date,
      eventYear: c.event_year,
      outreachStatus: o?.status ?? null,
      outreachSentAt: o?.sent_at ?? null,
      outreachError: o?.error ?? null,
    };
  });

  const total = rows.length;
  const withEmail = rows.filter((r) => r.email).length;
  const sent = rows.filter((r) => r.outreachStatus === "sent").length;
  const failed = rows.filter((r) => r.outreachStatus === "failed").length;

  return (
    <div className="space-y-6">
      <header className="enter-up flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Archives clients
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            L&apos;historique des clients 2023-2025 (ère Next Yacht), importé depuis les exports
            Google Calendar. Sert de base pour les campagnes de relance.
          </p>
        </div>
        <UploadIcsButton />
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Clients archivés" value={total} icon={Archive} accent="primary" index={0} />
        <KpiCard label="Avec email" value={withEmail} icon={Users} accent="info" index={1} />
        <KpiCard label="Relance envoyée" value={sent} icon={MailCheck} accent="success" index={2} />
        <KpiCard label="Échecs d'envoi" value={failed} icon={Mail} accent="gold" index={3} />
      </div>

      <Card className="enter-up" style={{ animationDelay: "180ms" }}>
        <CardHeader>
          <CardTitle>Clients importés</CardTitle>
          <CardDescription>
            Sélectionne des destinataires et lance la relance &laquo; changement de nom &raquo;.
            Un client déjà relancé sur cette campagne ne peut pas être sélectionné une deuxième fois.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArchivesTable clients={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
