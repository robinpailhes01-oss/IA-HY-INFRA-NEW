"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { LeadStatus } from "@/lib/leads";

type Result<T = null> =
  | { ok: true; error: null; data: T }
  | { ok: false; error: string; data: null };

function ok<T>(data: T): Result<T> {
  return { ok: true, error: null, data };
}

function fail(error: string): Result<never> {
  return { ok: false, error, data: null };
}

function touch(extra: Record<string, unknown> = {}) {
  return { updated_at: new Date().toISOString(), ...extra };
}

/** Déplacement Kanban : change uniquement le statut (drag & drop optimiste). */
export async function updateLeadStatus(id: string, status: LeadStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update(touch({ status }))
    .eq("id", id);

  if (error) return fail(error.message);
  revalidatePath("/leads");
  revalidatePath("/");
  return ok(null);
}

export type LeadFieldsUpdate = Partial<{
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source_channel: string | null;
  source_status: string | null;
  interested_offer: string | null;
  occasion: string | null;
  party_size: number | null;
  desired_date: string | null;
  desired_time_slot: string | null;
  score: number | null;
  status: string | null;
  needs_human_intervention: boolean;
  last_interaction_at: string | null;
}>;

/** Édition inline des champs du lead (onglet Infos). */
export async function updateLeadFields(id: string, fields: LeadFieldsUpdate) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update(touch(fields))
    .eq("id", id);

  if (error) return fail(error.message);
  revalidatePath("/leads");
  revalidatePath("/");
  return ok(null);
}

export async function updateLeadNotes(id: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update(touch({ notes: notes || null }))
    .eq("id", id);

  if (error) return fail(error.message);
  revalidatePath("/leads");
  return ok(null);
}

export async function updateAiMemo(id: string, ai_memo: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update(touch({ ai_memo: ai_memo || null }))
    .eq("id", id);

  if (error) return fail(error.message);
  revalidatePath("/leads");
  return ok(null);
}

export type CreateLeadInput = {
  first_name: string;
  phone: string;
  interested_offer?: string | null;
  source_channel?: string | null;
};

/** Création manuelle d'un lead — atterrit en « Qualifié ». */
export async function createLead(input: CreateLeadInput) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      first_name: input.first_name.trim() || null,
      phone: input.phone.trim() || null,
      interested_offer: input.interested_offer?.trim() || null,
      source_channel: input.source_channel || "other",
      source_status: "to_ask",
      status: "qualified",
      needs_human_intervention: false,
      last_interaction_at: now,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) return fail(error.message);
  revalidatePath("/leads");
  revalidatePath("/");
  return ok(data);
}

export async function markBooked(id: string) {
  return updateLeadStatus(id, "booked");
}

/**
 * Déclenche une relance manuelle pour ce lead : appelle la Edge Function
 * `lea-followups` avec un lead_id (bypass de l'intervalle). Léa génère un
 * message court dans le ton maison et l'envoie via Baileys.
 */
export async function triggerManualFollowup(leadId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/lea-followups`
    : null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return fail("Supabase non configuré côté serveur.");

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    };
    if (process.env.CRON_SECRET) headers["x-cron-secret"] = process.env.CRON_SECRET;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ lead_id: leadId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      sent?: number;
      processed?: number;
      results?: Array<{ sent: boolean; reason?: string }>;
      error?: string;
    };
    if (!res.ok || data.error) return fail(data.error ?? `Edge ${res.status}`);
    if ((data.processed ?? 0) === 0) {
      return fail("Lead introuvable ou téléphone manquant.");
    }
    const r = data.results?.[0];
    if (r && !r.sent) return fail(r.reason ?? "Envoi échoué (Baileys n'a pas accepté ce numéro)");

    revalidatePath("/leads");
    return ok(null);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

/** Marque le lead perdu ; consigne la raison dans les notes. */
export async function markLost(id: string, reason: string) {
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("leads")
    .select("notes")
    .eq("id", id)
    .single();

  const stamp = `[Perdu] ${reason.trim()}`;
  const notes = current?.notes ? `${current.notes}\n${stamp}` : stamp;

  const { error } = await supabase
    .from("leads")
    .update(touch({ status: "lost", notes, needs_human_intervention: false }))
    .eq("id", id);

  if (error) return fail(error.message);
  revalidatePath("/leads");
  revalidatePath("/");
  return ok(null);
}

/** Archive (soft-delete) — disparaît du pipeline. */
export async function archiveLead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update(touch({ archived: true }))
    .eq("id", id);

  if (error) return fail(error.message);
  revalidatePath("/leads");
  revalidatePath("/");
  return ok(null);
}

export type ConversationMessage = {
  from: "client" | "ai" | "human";
  text: string;
  at: string;
};

export type ConversationRow = {
  id: string;
  channel: string | null;
  summary: string | null;
  outcome: string | null;
  messages: ConversationMessage[];
  created_at: string | null;
  updated_at: string | null;
};

export async function getConversations(leadId: string): Promise<Result<ConversationRow[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, channel, summary, outcome, messages, created_at, updated_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });

  if (error) return fail(error.message);

  const rows: ConversationRow[] = (data ?? []).map((c) => ({
    id: c.id,
    channel: c.channel,
    summary: c.summary,
    outcome: c.outcome,
    messages: Array.isArray(c.messages) ? (c.messages as unknown as ConversationMessage[]) : [],
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));
  return ok(rows);
}

/** Mock V1 : enregistre un message manuel dans la conversation et bump l'interaction. */
export async function sendMessage(
  leadId: string,
  text: string,
): Promise<Result<ConversationMessage[]>> {
  const trimmed = text.trim();
  if (!trimmed) return fail("Message vide");

  const supabase = await createClient();
  const now = new Date().toISOString();
  const message: ConversationMessage = { from: "human", text: trimmed, at: now };

  const { data: existing } = await supabase
    .from("conversations")
    .select("id, messages, channel")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let messages: ConversationMessage[];

  if (existing) {
    const prev = Array.isArray(existing.messages)
      ? (existing.messages as unknown as ConversationMessage[])
      : [];
    messages = [...prev, message];
    const { error } = await supabase
      .from("conversations")
      .update({ messages: messages as unknown as never, updated_at: now })
      .eq("id", existing.id);
    if (error) return fail(error.message);
  } else {
    const { data: lead } = await supabase
      .from("leads")
      .select("source_channel")
      .eq("id", leadId)
      .single();
    messages = [message];
    const { error } = await supabase.from("conversations").insert({
      lead_id: leadId,
      channel: lead?.source_channel ?? null,
      messages: messages as unknown as never,
      created_at: now,
      updated_at: now,
    });
    if (error) return fail(error.message);
  }

  await supabase
    .from("leads")
    .update(touch({ last_interaction_at: now }))
    .eq("id", leadId);

  revalidatePath("/leads");
  return ok(messages);
}

/** Actions groupées (vue tableau). */
export async function bulkUpdateStatus(ids: string[], status: LeadStatus) {
  if (ids.length === 0) return ok(null);
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update(touch({ status }))
    .in("id", ids);

  if (error) return fail(error.message);
  revalidatePath("/leads");
  revalidatePath("/");
  return ok(null);
}

export async function bulkArchive(ids: string[]) {
  if (ids.length === 0) return ok(null);
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update(touch({ archived: true }))
    .in("id", ids);

  if (error) return fail(error.message);
  revalidatePath("/leads");
  revalidatePath("/");
  return ok(null);
}
