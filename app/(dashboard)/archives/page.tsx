
import { Archive, AtSign, MailCheck, MailX } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { UploadIcsButton } from "@/components/archives/upload-ics-button";
import { ArchivesTable, type ArchiveClient } from "@/components/archives/archives-table";

const CAMPAIGN = "changement_nom_2025";

export default async function ArchivesPage() {
  const supabase = await createClient();

  const [{ data: clients }, { data: outreach }, { data: unsubscribed }] = await Promise.all([
    supabase
      .from("legacy_clients")
      .select("id, first_name, last_name, email, phone, offer_summary, event_date, event_year")
      .order("event_date", { ascending: false }),
    supabase
      .from("client_outreach")
      .select("legacy_client_id, status, sent_at, error")
      .eq("campaign", CAMPAIGN),
    supabase.from("email_unsubscribes").select("email"),
  ]);

  const outreachByClient = new Map((outreach ?? []).map((o) => [o.legacy_client_id, o]));
  const unsubscribedEmails = new Set((unsubscribed ?? []).map((u) => u.email.toLowerCase()));

  const rows: ArchiveClient[] = (clients ?? []).map((c) => {
    const o = outreachByClient.get(c.id);
    const isUnsubscribed = c.email ? unsubscribedEmails.has(c.email.toLowerCase()) : false;
    return {
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      email: c.email,
      phone: c.phone,
      offerSummary: c.offer_summary,
      eventDate: c.event_date,
      eventYear: c.event_year,
      outreachStatus: isUnsubscribed ? "unsubscribed" : (o?.status ?? null),
      outreachSentAt: o?.sent_at ?? null,
      outreachError: o?.error ?? null,
    };
  });

  const total = rows.length;
  const withEmail = rows.filter((r) => r.email).length;
  const sent = rows.filter((r) => r.outreachStatus === "sent").length;
  const failed = rows.filter((r) => r.outreachStatus === "failed").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Outils"
        title={<>Archives <em>clients</em></>}
        description="L'historique des clients 2023-2025 (ère Next Yacht), importé depuis les exports Google Calendar. Sert de base pour les campagnes de relance."
        actions={<UploadIcsButton />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        <KpiCard label="Clients archivés" value={total} accent="navy" icon={<Archive />} index={0} />
        <KpiCard label="Avec email" value={withEmail} accent="ocean" icon={<AtSign />} index={1} />
        <KpiCard label="Relance envoyée" value={sent} accent="success" icon={<MailCheck />} index={2} />
        <KpiCard label="Échecs d'envoi" value={failed} accent={failed > 0 ? "danger" : "sky"} icon={<MailX />} index={3} />
      </div>

      <Card className="rise" style={{ animationDelay: "180ms" }}>
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
