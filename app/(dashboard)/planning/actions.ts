"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { DEMO_MODE } from "@/lib/demo/mode";
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

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bloque des jours entiers (maintenance, congé, réservation hors système…).
 * Le site lit ces blocages : ces jours ne sont plus proposés à la réservation.
 */
export async function addBlocks(from: string, to: string, reason: string): Promise<Result> {
  const supabase = await requireUser();
  if (!supabase) return fail("Non connecté");
  if (DEMO_MODE) return fail("Indisponible dans la démonstration.");
  if (!ISO.test(from) || !ISO.test(to)) return fail("Dates invalides.");
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return fail("La fin doit être après le début.");
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > 62) return fail("Deux mois maximum à la fois.");

  const rows = Array.from({ length: days }, (_, i) => ({
    date: new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10),
    reason: reason.trim().slice(0, 120) || "Bloqué",
  }));
  const { error } = await supabase.from("blocked_dates").insert(rows);
  if (error) return fail(error.message);
  revalidatePath("/planning");
  return { ok: true, error: null, count: days };
}

export async function removeBlock(id: string): Promise<Result> {
  const supabase = await requireUser();
  if (!supabase) return fail("Non connecté");
  if (DEMO_MODE) return fail("Indisponible dans la démonstration.");
  const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/planning");
  return { ok: true, error: null };
}
