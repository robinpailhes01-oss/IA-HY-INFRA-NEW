import type { SupabaseClient } from "@supabase/supabase-js";

import { PlanningCalendar } from "@/components/planning/planning-calendar";
import { PageHeader } from "@/components/shell/page-header";
import { createClient } from "@/lib/supabase/server";
import { gridDays, hhmm, isoOf, kindOfBooking, monthParam, type PlanningItem } from "@/lib/planning";

// PLANNING — ce qui occupe le bateau, jour par jour. La source, c'est la base :
// la page marche même si Google est coupé. Google ne sert qu'à recopier ce
// planning dans l'agenda du téléphone.

type BookingRow = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  offer_name: string | null;
  booking_type: string | null;
  status: string | null;
  party_size: number | null;
  total_amount: number | string | null;
  balance_due: number | string | null;
  deposit_paid: boolean | null;
  notes: string | null;
  customers: { first_name: string | null; last_name: string | null } | null;
};
type BlockRow = { id: string; date: string; start_time: string | null; end_time: string | null; reason: string | null; notes: string | null };
type EventRow = { id: string; date: string; start_time: string | null; end_time: string | null; title: string | null; status: string | null; max_participants: number | null; current_bookings: number | null };

const num = (v: number | string | null | undefined) => (v == null ? null : Number(v));

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const params = await searchParams;
  const todayIso = isoOf(new Date());
  const month = monthParam(params.m, todayIso);
  const days = gridDays(month);
  const from = days[0];
  const to = days[days.length - 1];

  const supabase = (await createClient()) as unknown as SupabaseClient;
  const [bookingsRes, blocksRes, eventsRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, date, start_time, end_time, offer_name, booking_type, status, party_size, total_amount, balance_due, deposit_paid, notes, customers(first_name, last_name)")
      .gte("date", from)
      .lte("date", to)
      .order("start_time", { ascending: true })
      .returns<BookingRow[]>(),
    supabase.from("blocked_dates").select("id, date, start_time, end_time, reason, notes").gte("date", from).lte("date", to).returns<BlockRow[]>(),
    supabase
      .from("events_public")
      .select("id, date, start_time, end_time, title, status, max_participants, current_bookings")
      .gte("date", from)
      .lte("date", to)
      .returns<EventRow[]>(),
  ]);

  const items: PlanningItem[] = [];
  for (const b of bookingsRes.data ?? []) {
    if (b.status === "cancelled") continue;
    const who = [b.customers?.first_name, b.customers?.last_name].filter(Boolean).join(" ") || null;
    items.push({
      id: b.id,
      source: "booking",
      kind: kindOfBooking(b.booking_type, b.offer_name),
      date: b.date,
      start: hhmm(b.start_time),
      end: hhmm(b.end_time),
      title: b.offer_name ?? "Réservation",
      subtitle: who,
      people: b.party_size,
      total: num(b.total_amount),
      balance: num(b.balance_due),
      depositPaid: b.deposit_paid,
      note: b.notes,
    });
  }
  for (const k of blocksRes.data ?? []) {
    items.push({
      id: k.id,
      source: "block",
      kind: "blocage",
      date: k.date,
      start: hhmm(k.start_time),
      end: hhmm(k.end_time),
      title: k.reason || "Bloqué",
      subtitle: null,
      people: null,
      total: null,
      balance: null,
      depositPaid: null,
      note: k.notes,
    });
  }
  for (const e of eventsRes.data ?? []) {
    if (e.status === "cancelled") continue;
    items.push({
      id: e.id,
      source: "event",
      kind: "evenement",
      date: e.date,
      start: hhmm(e.start_time),
      end: hhmm(e.end_time),
      title: e.title ?? "Événement",
      subtitle: e.max_participants ? `${e.current_bookings ?? 0} / ${e.max_participants} inscrits` : null,
      people: null,
      total: null,
      balance: null,
      depositPaid: null,
      note: null,
    });
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        eyebrow="Finance · Agenda"
        title={
          <>
            Plan<em>ning</em>
          </>
        }
        description="Les sorties, les nuits et les jours bloqués. Un jour bloqué n'est plus proposé à la réservation sur le site."
      />
      <PlanningCalendar key={month} month={month} todayIso={todayIso} days={days} items={items} />
    </div>
  );
}
