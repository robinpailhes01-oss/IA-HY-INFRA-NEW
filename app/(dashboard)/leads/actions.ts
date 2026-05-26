"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type LeadUpdate = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source_channel: string | null;
  interested_offer: string | null;
  score: number | null;
  status: string | null;
  needs_human_intervention: boolean;
};

export async function updateLead(id: string, values: LeadUpdate) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/leads");
  revalidatePath("/");
  return { ok: true as const, error: null };
}
