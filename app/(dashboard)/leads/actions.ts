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
 * Relance manuelle SENSIBLE AU CANAL :
 *   - lead email  → envoie un email de relance via Resend (threadé)
 *   - lead WhatsApp/téléphone → Edge Function `lea-followups` (Léa via Baileys)
 * Le canal réel est déterminé par la dernière conversation (channel), avec
 * repli sur source_channel.
 */
export async function triggerManualFollowup(leadId: string) {
  const supabase = await createClient();

  const [{ data: lead }, { data: conv }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, first_name, source_channel, email, phone, interested_offer, desired_date, followup_count")
      .eq("id", leadId)
      .maybeSingle(),
    supabase
      .from("conversations")
      .select("id, channel, messages")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!lead) return fail("Lead introuvable.");

  const contactChannel = (conv?.channel as string | null) ?? lead.source_channel;
  const isEmail = contactChannel === "email" && !!lead.email;

  // ── Relance email (Resend) ────────────────────────────────────────
  if (isEmail) {
    return sendEmailFollowup(supabase, lead as EmailFollowupLead, conv);
  }

  // ── Relance WhatsApp (Edge Function lea-followups → Baileys) ───────
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

type EmailFollowupLead = {
  id: string;
  first_name: string | null;
  email: string | null;
  interested_offer: string | null;
  desired_date: string | null;
  followup_count: number | null;
};

/** Compose et envoie une relance email chaleureuse via Resend, puis persiste. */
async function sendEmailFollowup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lead: EmailFollowupLead,
  conv: { id: string; channel: string | null; messages: unknown } | null,
) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM ?? "Harmonie Yacht <reservations@harmonie-yacht.fr>";
  if (!resendKey) return fail("Resend non configuré (RESEND_API_KEY absent).");
  if (!lead.email) return fail("Ce lead n'a pas d'adresse email.");

  const now = new Date().toISOString();
  const prenom = lead.first_name ? ` ${lead.first_name}` : "";
  const offre = lead.interested_offer ? ` concernant ${lead.interested_offer}` : " concernant votre sortie en mer";
  const dateNote = lead.desired_date
    ? ` Nous avons encore des disponibilités autour du ${new Date(`${lead.desired_date}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.`
    : "";

  const text =
    `Bonjour${prenom},\n\n` +
    `Je me permets de revenir vers vous${offre} avec Harmonie Yacht.${dateNote}\n\n` +
    `Êtes-vous toujours intéressé·e ? Je reste à votre entière disposition pour organiser cela ou répondre à vos questions.\n\n` +
    `Très belle journée,\n\n` +
    `---\n` +
    `Léa — Harmonie Yacht\n` +
    `📞 07 53 48 12 63\n` +
    `✉️ reservations@harmonie-yacht.fr\n` +
    `harmonie-yacht.fr`;

  // Threading : reprendre le dernier Message-ID sortant pour rester dans le fil.
  let inReplyTo: string | null = null;
  let subject = "Votre sortie avec Harmonie Yacht";
  if (conv) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: thread } = await (supabase as any)
      .from("email_threads")
      .select("last_outbound_message_id, subject")
      .eq("conversation_id", conv.id)
      .maybeSingle();
    inReplyTo = (thread as { last_outbound_message_id: string | null } | null)?.last_outbound_message_id ?? null;
    const s = (thread as { subject: string | null } | null)?.subject;
    if (s) subject = s.toLowerCase().startsWith("re:") ? s : `Re: ${s}`;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [lead.email],
        subject,
        text,
        headers: inReplyTo ? { "In-Reply-To": inReplyTo, References: inReplyTo } : undefined,
      }),
    });
    if (!res.ok) return fail(`Resend ${res.status} — email non envoyé.`);
    const data = (await res.json()) as { id?: string };

    await supabase.from("email_log").insert({
      lead_id: lead.id,
      to_email: lead.email,
      subject,
      source: "followup",
    });

    // Persiste le message dans la conversation + met à jour le fil email.
    const aiMsg: ConversationMessage = { from: "ai", text, at: now };
    if (conv) {
      const prev = Array.isArray(conv.messages) ? (conv.messages as ConversationMessage[]) : [];
      await supabase
        .from("conversations")
        .update({ messages: [...prev, aiMsg] as unknown as never, updated_at: now })
        .eq("id", conv.id);
      if (data.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("email_threads")
          .update({ last_outbound_message_id: `<${data.id}@resend.dev>`, updated_at: now })
          .eq("conversation_id", conv.id);
      }
    } else {
      await supabase.from("conversations").insert({
        lead_id: lead.id,
        channel: "email",
        messages: [aiMsg] as unknown as never,
        created_at: now,
        updated_at: now,
      });
    }

    await supabase
      .from("leads")
      .update(
        touch({
          status: "followed_up",
          last_interaction_at: now,
          last_followup_at: now,
          followup_count: (lead.followup_count ?? 0) + 1,
        }),
      )
      .eq("id", lead.id);

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

/** Résultat d'un envoi manuel : les messages + si le message a réellement quitté le CRM. */
export type SendOutcome = {
  messages: ConversationMessage[];
  /** true si le message a réellement été transmis (WhatsApp/Baileys ou email/Resend). */
  delivered: boolean;
  channel: string | null;
};

/** Envoie un message WhatsApp via le service Baileys (Railway). */
async function sendViaBaileys(phone: string, text: string): Promise<boolean> {
  const base = process.env.BAILEYS_SERVICE_URL;
  if (!base) return false;
  try {
    const res = await fetch(`${base}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, message: text }),
    });
    return res.ok;
  } catch (e) {
    console.error("Baileys send error", e);
    return false;
  }
}

/**
 * Enregistre un message manuel (équipe humaine) dans la conversation et le
 * transmet réellement au client :
 *   - canal whatsapp → service Baileys (si BAILEYS_SERVICE_URL configuré)
 *   - canal email    → Resend (avec threading In-Reply-To)
 * Répondre depuis le dashboard = « reprendre la main » : Léa est mise en pause
 * sur cette conversation et l'indicateur d'escalade est levé.
 */
export async function sendMessage(
  leadId: string,
  text: string,
): Promise<Result<SendOutcome>> {
  const trimmed = text.trim();
  if (!trimmed) return fail("Message vide");

  const supabase = await createClient();
  const now = new Date().toISOString();
  const message: ConversationMessage = { from: "human", text: trimmed, at: now };

  // Récupère la conversation la plus récente + le lead pour savoir le canal.
  const [{ data: existing }, { data: lead }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, messages, channel")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("leads")
      .select("source_channel, email, phone, first_name, last_name")
      .eq("id", leadId)
      .single(),
  ]);

  const channel = (existing?.channel ?? lead?.source_channel) ?? null;
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
    messages = [message];
    const { error } = await supabase.from("conversations").insert({
      lead_id: leadId,
      channel,
      messages: messages as unknown as never,
      created_at: now,
      updated_at: now,
    });
    if (error) return fail(error.message);
  }

  // Indique si le message a réellement quitté le CRM (Baileys / Resend).
  let delivered = false;

  // ── Envoi WhatsApp réel via Baileys ───────────────────────────────
  if (channel === "whatsapp" && lead?.phone) {
    delivered = await sendViaBaileys(lead.phone, trimmed);
  }

  // ── Envoi email réel si le canal est "email" ──────────────────────
  const isEmail = channel === "email";
  if (isEmail && lead?.email) {
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM ?? "Harmonie Yacht <reservations@harmonie-yacht.fr>";

    if (resendKey) {
      // Cherche le dernier Message-ID sortant pour le header In-Reply-To.
      let inReplyTo: string | null = null;
      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: thread } = await (supabase as any)
          .from("email_threads")
          .select("last_outbound_message_id, subject")
          .eq("conversation_id", existing.id)
          .maybeSingle();
        inReplyTo = (thread as { last_outbound_message_id: string | null } | null)?.last_outbound_message_id ?? null;
      }

      const headers: Record<string, string> = {};
      if (inReplyTo) {
        headers["In-Reply-To"] = inReplyTo;
        headers["References"]  = inReplyTo;
      }

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from:    fromEmail,
            to:      [lead.email],
            subject: inReplyTo ? "Re: Harmonie Yacht" : "Message de l'équipe Harmonie Yacht",
            text:    trimmed,
            headers: Object.keys(headers).length ? headers : undefined,
          }),
        });

        if (res.ok) {
          delivered = true;
          const data = await res.json() as { id?: string };
          await supabase.from("email_log").insert({
            lead_id: leadId,
            to_email: lead.email,
            subject: inReplyTo ? "Re: Harmonie Yacht" : "Message de l'équipe Harmonie Yacht",
            source: "manual_dashboard",
          });
          if (data.id && existing) {
            const newMsgId = `<${data.id}@resend.dev>`;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
              .from("email_threads")
              .update({ last_outbound_message_id: newMsgId, updated_at: now })
              .eq("conversation_id", existing.id);
          }
        }
      } catch (e) {
        console.error("Resend send error", e);
        // Non bloquant : le message est déjà dans le CRM.
      }
    }
  }

  // ── Reprendre la main : mettre Léa en pause + lever l'escalade ─────
  // Répondre depuis le dashboard signifie que l'humain gère la conversation.
  // On coupe les réponses automatiques de Léa pour 8 h (reprise auto ensuite)
  // et on retire l'indicateur d'escalade pour sortir le lead de « À reprendre ».
  if (channel === "whatsapp" && lead?.phone) {
    const pausedUntil = new Date(Date.now() + 8 * 3_600_000).toISOString();
    await supabase
      .from("wa_conversations")
      .update({ is_paused: true, paused_until: pausedUntil })
      .eq("customer_phone", lead.phone);
  }

  await supabase
    .from("leads")
    .update(touch({ last_interaction_at: now, needs_human_intervention: false }))
    .eq("id", leadId);

  revalidatePath("/leads");
  revalidatePath("/");
  return ok({ messages, delivered, channel });
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
