"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { SUSPENSE_ACCOUNT, VAT_RATES } from "@/lib/compta/accounts";

// Les gestes de la comptabilité. Toutes les écritures passent par
// accounting_entries (une ligne par mouvement) : les tables de synchro
// bancaire ne sont jamais touchées. Un mois clôturé est protégé par un
// déclencheur en base — l'erreur remonte telle quelle, en français.

type Result = { ok: true; error: null } | { ok: false; error: string };

const ok = (): Result => ({ ok: true, error: null });
const fail = (error: string): Result => ({ ok: false, error });

async function db(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

function done(): Result {
  revalidatePath("/compta");
  return ok();
}

function friendly(message: string): string {
  if (/does not exist|schema cache/i.test(message)) {
    return "La comptabilité n'est pas encore installée : applique la migration 0035 dans Supabase.";
  }
  return message;
}

export type MovementRef = { source: "bank" | "cash"; sourceId: string; date: string };

function validRef(ref: MovementRef): boolean {
  return (ref.source === "bank" || ref.source === "cash") && /^[0-9a-f-]{8,}$/i.test(ref.sourceId) && /^\d{4}-\d{2}-\d{2}$/.test(ref.date);
}

export async function classifyMovement(
  ref: MovementRef,
  values: {
    accountCode: string;
    vatRate: number;
    reverseCharge?: boolean;
    vatAmountOverride?: number | null;
    label?: string | null;
    note?: string | null;
    noReceiptReason?: string | null;
    /** Créer une règle : « toujours classer <pattern> ainsi ». */
    rule?: { pattern: string; side: "debit" | "credit" } | null;
  },
  by: "robin" | "lea" = "robin",
): Promise<Result> {
  if (!validRef(ref)) return fail("Mouvement introuvable.");
  if (!values.accountCode) return fail("Choisis un compte.");
  if (!(VAT_RATES as readonly number[]).includes(values.vatRate)) return fail("Taux de TVA invalide.");

  const supabase = await db();
  const row: Record<string, unknown> = {
    source: ref.source,
    source_id: ref.sourceId,
    entry_date: ref.date,
    account_code: values.accountCode,
    vat_rate: values.vatRate,
    reverse_charge: Boolean(values.reverseCharge),
    classified_by: by,
  };
  if (values.vatAmountOverride !== undefined) row.vat_amount_override = values.vatAmountOverride;
  if (values.label !== undefined) row.label = values.label;
  if (values.note !== undefined) row.note = values.note;
  if (values.noReceiptReason !== undefined) row.no_receipt_reason = values.noReceiptReason || null;

  const { error } = await supabase.from("accounting_entries").upsert(row, { onConflict: "source,source_id" });
  if (error) return fail(friendly(error.message));

  const pattern = values.rule?.pattern.trim();
  if (pattern && pattern.length >= 3) {
    await supabase.from("accounting_rules").insert({
      pattern: pattern.toLowerCase(),
      side: values.rule!.side,
      account_code: values.accountCode,
      vat_rate: values.vatRate,
      reverse_charge: Boolean(values.reverseCharge),
      no_receipt_reason: values.noReceiptReason || null,
      priority: 40,
    });
  }
  return done();
}

/** Valide d'un coup les classements proposés (règles, caisse). */
export async function acceptSuggestions(
  items: Array<MovementRef & { accountCode: string; vatRate: number; reverseCharge: boolean; noReceiptReason: string | null }>,
): Promise<Result & { count?: number }> {
  const valid = items.filter((i) => validRef(i) && i.accountCode && i.accountCode !== SUSPENSE_ACCOUNT).slice(0, 500);
  if (valid.length === 0) return fail("Aucune proposition à valider.");
  const supabase = await db();
  const { error } = await supabase.from("accounting_entries").upsert(
    valid.map((i) => ({
      source: i.source,
      source_id: i.sourceId,
      entry_date: i.date,
      account_code: i.accountCode,
      vat_rate: i.vatRate,
      reverse_charge: i.reverseCharge,
      no_receipt_reason: i.noReceiptReason,
      classified_by: "regle",
    })),
    { onConflict: "source,source_id", ignoreDuplicates: true },
  );
  if (error) return fail(friendly(error.message));
  revalidatePath("/compta");
  return { ok: true, error: null, count: valid.length };
}

/** Rattache un justificatif déjà déposé dans le bucket « justificatifs ». */
export async function attachReceipt(ref: MovementRef, file: { path: string; name: string }): Promise<Result> {
  if (!validRef(ref)) return fail("Mouvement introuvable.");
  if (!file.path || file.path.includes("..")) return fail("Fichier invalide.");
  const supabase = await db();

  const { data: existing } = await supabase
    .from("accounting_entries")
    .select("id")
    .eq("source", ref.source)
    .eq("source_id", ref.sourceId)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("accounting_entries")
        .update({ receipt_path: file.path, receipt_name: file.name.slice(0, 200), no_receipt_reason: null })
        .eq("source", ref.source)
        .eq("source_id", ref.sourceId)
    : await supabase.from("accounting_entries").insert({
        source: ref.source,
        source_id: ref.sourceId,
        entry_date: ref.date,
        // Pas encore classé : le justificatif est rangé, le classement suivra.
        account_code: SUSPENSE_ACCOUNT,
        vat_rate: 0,
        receipt_path: file.path,
        receipt_name: file.name.slice(0, 200),
      });
  if (error) return fail(friendly(error.message));
  return done();
}

export async function setNoReceipt(ref: MovementRef, reason: string): Promise<Result> {
  if (!validRef(ref)) return fail("Mouvement introuvable.");
  const text = reason.trim();
  if (text.length < 3) return fail("Indique pourquoi il n'y a pas de justificatif.");
  const supabase = await db();
  const { data, error } = await supabase
    .from("accounting_entries")
    .update({ no_receipt_reason: text.slice(0, 200) })
    .eq("source", ref.source)
    .eq("source_id", ref.sourceId)
    .select("id");
  if (error) return fail(friendly(error.message));
  if (!data || data.length === 0) return fail("Classe d'abord ce mouvement.");
  return done();
}

export async function receiptUrl(path: string): Promise<{ url: string | null; error: string | null }> {
  if (!path || path.includes("..")) return { url: null, error: "Fichier invalide." };
  const supabase = await db();
  const { data, error } = await supabase.storage.from("justificatifs").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) return { url: null, error: error?.message ?? "Lien indisponible." };
  return { url: data.signedUrl, error: null };
}

const MONTH_RE = /^\d{4}-\d{2}-01$/;

export async function closeMonth(month: string): Promise<Result> {
  if (!MONTH_RE.test(month)) return fail("Mois invalide.");
  const supabase = await db();
  const { error } = await supabase
    .from("accounting_periods")
    .upsert({ month, closed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "month" });
  if (error) return fail(friendly(error.message));
  return done();
}

export async function reopenMonth(month: string): Promise<Result> {
  if (!MONTH_RE.test(month)) return fail("Mois invalide.");
  const supabase = await db();
  const { error } = await supabase
    .from("accounting_periods")
    .update({ closed_at: null, updated_at: new Date().toISOString() })
    .eq("month", month);
  if (error) return fail(friendly(error.message));
  return done();
}

/** Marque une déclaration de TVA comme faite (ou l'annule avec amount = null). */
export async function markVatFiled(
  target: { kind: "ca3"; month: string } | { kind: "acompte_juillet" | "acompte_decembre" | "ca12"; year: number },
  amount: number | null,
  undo = false,
): Promise<Result> {
  const supabase = await db();
  if (target.kind === "ca3") {
    if (!MONTH_RE.test(target.month)) return fail("Mois invalide.");
    const { error } = await supabase.from("accounting_periods").upsert(
      {
        month: target.month,
        vat_declared_at: undo ? null : new Date().toISOString(),
        vat_declared_amount: undo ? null : amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "month" },
    );
    if (error) return fail(friendly(error.message));
    return done();
  }
  if (!Number.isInteger(target.year)) return fail("Année invalide.");
  const { error } = undo
    ? await supabase.from("accounting_vat_filings").delete().eq("year", target.year).eq("kind", target.kind)
    : await supabase
        .from("accounting_vat_filings")
        .upsert({ year: target.year, kind: target.kind, amount, filed_at: new Date().toISOString() }, { onConflict: "year,kind" });
  if (error) return fail(friendly(error.message));
  return done();
}

export async function saveComptaSettings(values: {
  siren: string;
  vatRegime: "normal" | "simplifie";
  vatDueDay: number;
  fiscalYearStartMonth: number;
  previousYearVat: number | null;
}): Promise<Result> {
  const siren = values.siren.replace(/\s/g, "");
  if (siren && !/^\d{9}$/.test(siren)) return fail("Le SIREN fait 9 chiffres.");
  if (values.vatRegime !== "normal" && values.vatRegime !== "simplifie") return fail("Régime de TVA invalide.");
  if (!(values.vatDueDay >= 1 && values.vatDueDay <= 31)) return fail("Jour limite invalide.");
  if (!(values.fiscalYearStartMonth >= 1 && values.fiscalYearStartMonth <= 12)) return fail("Mois de début invalide.");

  const supabase = await db();
  const { error } = await supabase.from("accounting_settings").upsert(
    {
      id: true,
      siren: siren || null,
      vat_regime: values.vatRegime,
      vat_due_day: Math.round(values.vatDueDay),
      fiscal_year_start_month: Math.round(values.fiscalYearStartMonth),
      previous_year_vat: values.previousYearVat,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) return fail(friendly(error.message));
  return done();
}

export async function deleteRule(id: string): Promise<Result> {
  if (!/^[0-9a-f-]{8,}$/i.test(id)) return fail("Règle introuvable.");
  const supabase = await db();
  const { error } = await supabase.from("accounting_rules").delete().eq("id", id);
  if (error) return fail(friendly(error.message));
  return done();
}
