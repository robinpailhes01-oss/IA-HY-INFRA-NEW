"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { parsePayments, type BalancePayment } from "@/lib/payments";
import { syncGCal } from "@/lib/sync-gcal";

export async function settleBalance(
  bookingId: string,
  payments: BalancePayment[],
) {
  const supabase = await createClient();

  const { data, error: readErr } = await supabase
    .from("bookings")
    .select("balance_due, balance_payments")
    .eq("id", bookingId)
    .maybeSingle();

  if (readErr || !data) {
    return { ok: false as const, error: readErr?.message ?? "Réservation introuvable" };
  }

  const clean = payments
    .filter((p) => p.method && p.amount > 0)
    .map((p) => ({ method: p.method, amount: Math.round(p.amount) }));

  if (clean.length === 0) {
    return { ok: false as const, error: "Aucun montant saisi" };
  }

  const existing = parsePayments(data.balance_payments);
  const added = clean.reduce((s, p) => s + p.amount, 0);
  const newBalance = Math.max(0, (data.balance_due ?? 0) - added);
  const merged = [...existing, ...clean];

  const { error } = await supabase
    .from("bookings")
    .update({ balance_payments: merged, balance_due: newBalance })
    .eq("id", bookingId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/bookings");
  revalidatePath("/finances");
  revalidatePath("/");
  return { ok: true as const, error: null };
}

export type BookingUpdate = {
  source_channel: string | null;
  status: string | null;
  party_size: number | null;
  offer_name: string | null;
};

export async function updateBooking(id: string, values: BookingUpdate) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("bookings")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  // Sync GCal en best-effort (ne bloque pas si GCal est indisponible).
  const isCancel = values.status === "cancelled" || values.status === "refunded";
  void syncGCal(isCancel ? "delete" : "upsert", "booking", id);

  revalidatePath("/bookings");
  revalidatePath("/marketing");
  revalidatePath("/finances");
  revalidatePath("/");
  return { ok: true as const, error: null };
}
