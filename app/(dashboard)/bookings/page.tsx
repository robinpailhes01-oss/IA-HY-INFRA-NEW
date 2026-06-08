import { CalendarClock, Ship, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { BalanceAgenda } from "@/components/bookings/balance-agenda";
import type { SettleTarget } from "@/components/bookings/settle-balance-dialog";
import {
  BookingsTable,
  type BookingTableItem,
} from "@/components/bookings/bookings-table";
import { AddBookingDialog } from "@/components/bookings/add-booking-dialog";

const CONFIRMED = new Set(["confirmed", "completed"]);

type BookingRow = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  offer_name: string | null;
  party_size: number | null;
  total_amount: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean | null;
  balance_due: number | null;
  status: string | null;
  source_channel: string | null;
  customers: { first_name: string | null; last_name: string | null } | null;
};

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "Client";
}

export default async function BookingsPage() {
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, date, start_time, end_time, offer_name, party_size, total_amount, deposit_amount, deposit_paid, balance_due, status, source_channel, customers(first_name, last_name)",
    )
    .order("date", { ascending: true })
    .returns<BookingRow[]>();

  const bookings = data ?? [];
  const confirmees = bookings.filter((b) => CONFIRMED.has(b.status ?? "")).length;
  const aVenir = bookings.filter(
    (b) => b.date >= todayIso && b.status !== "cancelled",
  ).length;
  const resteAEncaisser = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce(
      (sum, b) =>
        sum + (b.deposit_paid ? 0 : b.deposit_amount ?? 0) + (b.balance_due ?? 0),
      0,
    );

  const toCollect: SettleTarget[] = bookings
    .filter(
      (b) => b.status !== "cancelled" && b.date >= todayIso && (b.balance_due ?? 0) > 0,
    )
    .map((b) => ({
      id: b.id,
      customerName: fullName(
        b.customers?.first_name ?? null,
        b.customers?.last_name ?? null,
      ),
      offerName: b.offer_name,
      date: b.date,
      balanceDue: b.balance_due ?? 0,
      sourceChannel: b.source_channel,
    }));

  const tableItems: BookingTableItem[] = bookings.map((b) => ({
    id: b.id,
    date: b.date,
    startTime: b.start_time,
    endTime: b.end_time,
    offerName: b.offer_name,
    customerName: fullName(
      b.customers?.first_name ?? null,
      b.customers?.last_name ?? null,
    ),
    partySize: b.party_size,
    amount: b.total_amount,
    depositPaid: b.deposit_paid,
    balanceDue: b.balance_due,
    status: b.status,
    sourceChannel: b.source_channel,
  }));

  return (
    <div className="space-y-6">
      <header className="enter-up flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Réservations
          </h1>
          <p className="text-sm text-muted-foreground">
            {bookings.length} sortie{bookings.length > 1 ? "s" : ""} enregistrée
            {bookings.length > 1 ? "s" : ""} · clique sur une ligne pour modifier
          </p>
        </div>
        <AddBookingDialog />
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Confirmées" value={confirmees} icon={Ship} accent="primary" index={0} />
        <KpiCard label="À venir" value={aVenir} icon={CalendarClock} accent="info" index={1} />
        <KpiCard
          label="Reste à encaisser"
          value={resteAEncaisser}
          format="eur"
          icon={Wallet}
          accent="success"
          index={2}
        />
      </div>

      <Card className="enter-up" style={{ animationDelay: "260ms" }}>
        <CardHeader>
          <CardTitle>Soldes à encaisser</CardTitle>
          <CardDescription>
            Sorties à venir avec un solde à percevoir le jour J
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BalanceAgenda items={toCollect} />
        </CardContent>
      </Card>

      <Card className="enter-up" style={{ animationDelay: "340ms" }}>
        <CardHeader>
          <CardTitle>Toutes les réservations</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingsTable bookings={tableItems} />
        </CardContent>
      </Card>
    </div>
  );
}
