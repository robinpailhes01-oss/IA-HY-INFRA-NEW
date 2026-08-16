import { createClient } from "@/lib/supabase/server";
import { LeadsView } from "@/components/leads/leads-view";
import type { Lead } from "@/lib/leads";

export default async function LeadsPage() {
  const supabase = await createClient();

  // Deux requêtes plutôt qu'une jointure : la vue `lead_last_message` agrège le
  // dernier message de chaque conversation (qui a parlé, quand, lien du site
  // envoyé ou non). C'est ce qui permet de distinguer « il attend notre
  // réponse » de « il ne répond plus » dans la vue Priorité.
  const [{ data }, { data: engagement }] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, first_name, last_name, email, phone, source_channel, source_status, interested_offer, occasion, party_size, desired_date, desired_time_slot, score, status, needs_human_intervention, last_interaction_at, ai_memo, notes, created_at, archived, wa_conversations(customer_name)",
      )
      .eq("archived", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_last_message")
      .select("lead_id, last_message_at, last_from_me, site_link_sent"),
  ]);

  const engagementByLead = new Map(
    (engagement ?? [])
      .filter((e): e is typeof e & { lead_id: string } => e.lead_id !== null)
      .map((e) => [e.lead_id, e]),
  );

  // Le pushName WhatsApp du contact (conversation liée via FK) — sert de nom
  // affiché quand on n'a pas encore renseigné prénom/nom à la main.
  type LeadRow = Omit<Lead, "whatsapp_name" | "last_from_me" | "last_message_at" | "site_link_sent"> & {
    wa_conversations: { customer_name: string | null } | { customer_name: string | null }[] | null;
  };
  const leads: Lead[] = ((data ?? []) as unknown as LeadRow[]).map((row) => {
    const conv = Array.isArray(row.wa_conversations) ? row.wa_conversations[0] : row.wa_conversations;
    const { wa_conversations, ...lead } = row;
    void wa_conversations;
    const eng = engagementByLead.get(row.id);
    return {
      ...lead,
      whatsapp_name: conv?.customer_name ?? null,
      last_from_me: eng?.last_from_me ?? null,
      last_message_at: eng?.last_message_at ?? null,
      site_link_sent: eng?.site_link_sent ?? null,
    };
  });

  return <LeadsView initialLeads={leads} now={Date.now()} />;
}
