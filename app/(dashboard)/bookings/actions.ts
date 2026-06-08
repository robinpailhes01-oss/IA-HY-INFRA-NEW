"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { parsePayments, type BalancePayment } from "@/lib/payments";

export type BookingCreate = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  offer_name: string | null;
  booking_type: string;
  party_size: number | null;
  total_amount: number;
  deposit_amount: number;
  deposit_paid: boolean;
  source_channel: string | null;
  status: string;
  notes: string | null;
};

export async function createBooking(values: BookingCreate) {
  const supabase = await createClient();

  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .insert({
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email || null,
      phone: values.phone || null,
    })
    .select("id")
    .single();

  if (custErr || !customer) {
    return { ok: false as const, error: custErr?.message ?? "Erreur lors de la création du client" };
  }

  const balanceDue = Math.max(
    0,
    values.total_amount - (values.deposit_paid ? values.deposit_amount : 0),
  );

  const { error: bookErr } = await supabase.from("bookings").insert({
    customer_id: customer.id,
    date: values.date,
    start_time: values.start_time || null,
    end_time: values.end_time || null,
    offer_name: values.offer_name || null,
    booking_type: values.booking_type,
    party_size: values.party_size,
    total_amount: values.total_amount,
    deposit_amount: values.deposit_amount,
    deposit_paid: values.deposit_paid,
    balance_due: balanceDue,
    balance_due_date: values.date,
    status: values.status,
    source_channel: values.source_channel || null,
    notes: values.notes || null,
  });

  if (bookErr) {
    return { ok: false as const, error: bookErr.message };
  }

  revalidatePath("/bookings");
  revalidatePath("/finances");
  revalidatePath("/");
  return { ok: true as const, error: null };
}

export async function settleBalance(
  bookingId: string,
  payments: BalancePayment[],
  sourceChannel: string | null = null,
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

  const baseUpdate = { balance_payments: merged, balance_due: newBalance };
  const { error } = await supabase
    .from("bookings")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(sourceChannel ? { ...baseUpdate, source_channel: sourceChannel } : baseUpdate as any)
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

  // La synchronisation Google Calendar est gérée par le trigger Postgres
  // `trg_bookings_sync_gcal` — elle s'exécute automatiquement après l'UPDATE.

  revalidatePath("/bookings");
  revalidatePath("/marketing");
  revalidatePath("/finances");
  revalidatePath("/");
  return { ok: true as const, error: null };
}
