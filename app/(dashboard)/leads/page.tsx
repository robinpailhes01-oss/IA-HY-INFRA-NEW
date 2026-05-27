import { createClient } from "@/lib/supabase/server";
import { LeadsView } from "@/components/leads/leads-view";
import type { Lead } from "@/lib/leads";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id, first_name, last_name, email, phone, source_channel, source_status, interested_offer, occasion, party_size, desired_date, desired_time_slot, score, status, needs_human_intervention, last_interaction_at, ai_memo, notes, created_at, archived",
    )
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .returns<Lead[]>();

  return <LeadsView initialLeads={data ?? []} now={Date.now()} />;
}
