"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EventCreate = {
  title: string;
  theme: string | null;
  description: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  price_per_person: number | null;
  max_participants: number | null;
  sumup_payment_link: string | null;
};

export async function createEvent(values: EventCreate) {
  const supabase = await createClient();
  const { error } = await supabase.from("events_public").insert({
    ...values,
    status: "published",
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/events");
  return { ok: true as const };
}

export type EventUpdate = Partial<EventCreate> & { status?: string };

export async function updateEvent(id: string, values: EventUpdate) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("events_public").update(values as any).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/events");
  return { ok: true as const };
}

export type EventBookingCreate = {
  event_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  party_size: number;
  total_paid: number | null;
  payment_status: string;
};

export async function addEventBooking(values: EventBookingCreate) {
  if (!values.first_name.trim()) {
    return { ok: false as const, error: "Le prénom est requis" };
  }
  if (values.party_size < 1) {
    return { ok: false as const, error: "Nombre de personnes invalide" };
  }
  const supabase = await createClient();

  const { error } = await supabase.from("event_bookings").insert({
    event_id: values.event_id,
    first_name: values.first_name.trim(),
    last_name: values.last_name?.trim() || null,
    email: values.email?.trim() || null,
    phone: values.phone?.trim() || null,
    party_size: values.party_size,
    total_paid: values.total_paid,
    payment_status: values.payment_status,
  });
  if (error) return { ok: false as const, error: error.message };

  // Recalculer current_bookings et total_revenue depuis event_bookings
  const { data: agg } = await supabase
    .from("event_bookings")
    .select("party_size, total_paid")
    .eq("event_id", values.event_id);

  if (agg) {
    const seats = agg.reduce((s, b) => s + (b.party_size ?? 1), 0);
    const revenue = agg.reduce((s, b) => s + (Number(b.total_paid) || 0), 0);
    await supabase
      .from("events_public")
      .update({ current_bookings: seats, total_revenue: revenue })
      .eq("id", values.event_id);
  }

  revalidatePath("/events");
  return { ok: true as const };
}
