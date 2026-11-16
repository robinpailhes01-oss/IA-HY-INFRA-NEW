import type { SupabaseClient } from "@supabase/supabase-js";
import { Inbox, Mail, ReceiptText, Trash2, Users } from "lucide-react";

import { MailInbox } from "@/components/mails/mail-inbox";
import { ConnectGmail, SyncButton } from "@/components/mails/mail-controls";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { sinceLabel } from "@/components/finance/fin-utils";
import type { MailAccount, MailRow } from "@/lib/mail/types";
import { createClient } from "@/lib/supabase/server";

// BOÎTE MAIL — les mails de l'entreprise, triés par Léa. Rien n'est supprimé sans
// l'accord de Robin : la corbeille de Gmail garde les mails 30 jours.

export default async function MailsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = (await createClient()) as unknown as SupabaseClient;

  const accountRes = await supabase.from("mail_account_status").select("*").limit(1);
  // Table absente : la migration 0037 n'est pas appliquée.
  const missing = Boolean(accountRes.error);
  const account = ((accountRes.data ?? [])[0] as MailAccount | undefined) ?? null;

  const messages: MailRow[] = account
    ? (
        await supabase
          .from("mail_messages")
          .select("id, from_name, from_email, subject, snippet, received_at, has_attachment, bulk, category, proposed_action, confidence, reason, classified_by, status")
          .order("received_at", { ascending: false })
          .limit(600)
          .returns<MailRow[]>()
      ).data ?? []
    : [];

  const inbox = messages.filter((m) => m.status === "inbox");
  const counts = {
    toReview: inbox.filter((m) => m.proposed_action === "trash").length,
    clients: inbox.filter((m) => m.category === "client").length,
    invoices: messages.filter((m) => m.category === "facture").length,
    unsorted: inbox.filter((m) => m.category === "a_classer" || m.category === "autre").length,
  };

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        eyebrow="Finance · Courrier"
        title={
          <>
            Boîte <em>mail</em>
          </>
        }
        description={
          account
            ? `${account.email} · Léa trie, tu valides. Rien n'est supprimé sans ton accord (corbeille Gmail, 30 jours).`
            : "Les mails clients, les factures et le reste, triés par Léa. Rien n'est supprimé sans ton accord."
        }
        actions={account ? <SyncButton lastSync={account.last_sync_at ? sinceLabel(account.last_sync_at) : null} /> : undefined}
      />

      {params.connected && (
        <p className="rise rounded-2xl bg-[rgba(15,159,110,0.1)] px-4 py-3 text-[13px] font-medium text-success">
          Boîte connectée. Léa lit tes mails des 30 derniers jours : clique sur « Synchroniser » pour lancer le premier tri.
        </p>
      )}
      {params.error && (
        <p className="rise rounded-2xl bg-[rgba(224,77,85,0.08)] px-4 py-3 text-[13px] text-danger">Connexion impossible : {params.error}</p>
      )}
      {account?.status === "error" && (
        <p className="rise rounded-2xl bg-[rgba(217,130,43,0.12)] px-4 py-3 text-[13px] text-warning">
          {account.last_error ?? "La connexion à Gmail a échoué."} <ConnectGmail inline />
        </p>
      )}

      {missing ? (
        <EmptyState icon={<Mail />} title="La boîte mail n'est pas encore installée" className="rise">
          Applique la migration <code>0037_mailbox.sql</code> dans Supabase (SQL Editor), puis recharge cette page.
        </EmptyState>
      ) : !account ? (
        <EmptyState
          icon={<Mail />}
          title="Connecte la boîte mail de l'entreprise"
          className="rise"
          action={<ConnectGmail />}
        >
          Léa lit les en-têtes de tes mails (jamais leur contenu complet), range les clients, les factures, la banque et les
          impôts, et te propose de mettre à la corbeille les newsletters et le démarchage. Tu valides en un clic.
        </EmptyState>
      ) : (
        <>
          <section aria-label="Chiffres de la boîte mail" className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
            <KpiCard label="À valider" value={counts.toReview} accent={counts.toReview > 0 ? "warning" : "success"} icon={<Trash2 />} hint="Proposés à la corbeille" index={0} />
            <KpiCard label="Clients" value={counts.clients} accent="ocean" icon={<Users />} hint="Dans la boîte de réception" index={1} />
            <KpiCard label="Factures" value={counts.invoices} accent="navy" icon={<ReceiptText />} hint="Reçues et rangées" index={2} />
            <KpiCard label="À classer" value={counts.unsorted} accent="sky" icon={<Inbox />} hint="Léa hésite : à toi de voir" index={3} />
          </section>
          <MailInbox messages={messages} accountEmail={account.email} />
        </>
      )}
    </div>
  );
}
