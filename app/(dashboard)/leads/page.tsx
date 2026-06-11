import { createClient } from "@/lib/supabase/server";
import { LeadsView } from "@/components/leads/leads-view";
import type { Lead } from "@/lib/leads";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id, first_name, last_name, email, phone, source_channel, source_status, interested_offer, occasion, party_size, desired_date, desired_time_slot, score, status, needs_human_intervention, last_interaction_at, ai_memo, notes, created_at, archived, wa_conversations(customer_name)",
    )
    .eq("archived", false)
    .order("created_at", { ascending: false });

  // Le pushName WhatsApp du contact (conversation liée via FK) — sert de nom
  // affiché quand on n'a pas encore renseigné prénom/nom à la main.
  const leads: Lead[] = (data ?? []).map((row: any) => {
    const conv = Array.isArray(row.wa_conversations) ? row.wa_conversations[0] : row.wa_conversations;
    const { wa_conversations: _wa, ...lead } = row;
    return { ...lead, whatsapp_name: conv?.customer_name ?? null };
  });

  return <LeadsView initialLeads={leads} now={Date.now()} />;
}
