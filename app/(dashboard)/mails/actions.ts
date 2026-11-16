"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { DEMO_MODE } from "@/lib/demo/mode";
import { callMailFunction, gmailConnectUrl } from "@/lib/mail/server";
import { MAIL_CATEGORIES, TRASHABLE, type MailAction, type MailCategory } from "@/lib/mail/types";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; error: null; count?: number } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

async function requireUser(): Promise<SupabaseClient | null> {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

/** Adresse de connexion à Google (via la fonction mail-oauth). */
export async function startGmailConnection(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!(await requireUser())) return { ok: false, error: "Non connecté" };
  if (DEMO_MODE) return { ok: false, error: "Indisponible dans la démonstration." };
  const url = gmailConnectUrl();
  return url ? { ok: true, url } : { ok: false, error: "DASHBOARD_AGENT_SECRET manquant dans les variables du projet." };
}

export async function syncMailsNow(): Promise<Result> {
  if (!(await requireUser())) return fail("Non connecté");
  const r = await callMailFunction("mail-sync", {});
  if (!r.ok) return fail(r.error ?? "Échec de la synchronisation");
  revalidatePath("/mails");
  const skipped = r.data?.skipped;
  if (typeof skipped === "string") return fail("Aucune boîte connectée.");
  return { ok: true, error: null, count: Number(r.data?.nouveaux ?? 0) };
}

/** Corbeille Gmail (récupérable 30 jours), étiquette Factures, garder, ou annuler la corbeille. */
export async function actOnMails(action: MailAction, ids: string[]): Promise<Result> {
  if (!(await requireUser())) return fail("Non connecté");
  if (!ids.length) return fail("Aucun mail sélectionné.");
  const r = await callMailFunction("mail-act", { action, ids: ids.slice(0, 200) });
  if (!r.ok) return fail(r.error ?? "Échec");
  revalidatePath("/mails");
  return { ok: true, error: null, count: Number(r.data?.count ?? ids.length) };
}

/** Change la catégorie d'un mail ; avec `always`, mémorise une règle pour cet expéditeur. */
export async function setMailCategory(id: string, category: MailCategory, always: { sender: string; trash: boolean } | null): Promise<Result> {
  const supabase = await requireUser();
  if (!supabase) return fail("Non connecté");
  if (!(MAIL_CATEGORIES as readonly string[]).includes(category)) return fail("Catégorie inconnue.");
  const trash = TRASHABLE.includes(category);
  const { error } = await supabase
    .from("mail_messages")
    .update({ category, proposed_action: trash ? "trash" : "keep", classified_by: "robin", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(error.message);
  if (always?.sender) {
    const { error: re } = await supabase
      .from("mail_rules")
      .upsert({ kind: "sender", pattern: always.sender.toLowerCase(), category, action: always.trash && trash ? "trash" : "keep" }, { onConflict: "kind,pattern" });
    if (re) return fail(re.message);
  }
  revalidatePath("/mails");
  return { ok: true, error: null };
}

/** « Toujours mettre à la corbeille / garder les mails de cet expéditeur ». */
export async function ruleForSender(sender: string, category: MailCategory, trash: boolean): Promise<Result> {
  const supabase = await requireUser();
  if (!supabase) return fail("Non connecté");
  if (!/^[^\s@]+@[^\s@]+$/.test(sender)) return fail("Adresse invalide.");
  const { error } = await supabase
    .from("mail_rules")
    .upsert({ kind: "sender", pattern: sender.toLowerCase(), category, action: trash && TRASHABLE.includes(category) ? "trash" : "keep" }, { onConflict: "kind,pattern" });
  if (error) return fail(error.message);
  return { ok: true, error: null };
}
