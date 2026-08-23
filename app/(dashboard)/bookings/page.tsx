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
import { UpcomingBookingsList, type UpcomingItem } from "@/components/bookings/upcoming-bookings-list";
import type { SettleTarget } from "@/components/bookings/settle-balance-dialog";
import type { EditableBooking } from "@/components/bookings/booking-edit-dialog";
import {
  BookingsTable,
  type BookingTableItem,
} from "@/components/bookings/bookings-table";
import { AddBookingDialog } from "@/components/bookings/add-booking-dialog";
import { AddGiftCardDialog } from "@/components/bookings/add-gift-card-dialog";
import { parsePayments } from "@/lib/payments";

const CONFIRMED = new Set(["confirmed", "completed"]);

type BookingRow = {
  id: string;
  customer_id: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  offer_name: string | null;
  party_size: number | null;
  total_amount: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean | null;
  balance_due: number | null;
  balance_payments: unknown;
  status: string | null;
  source_channel: string | null;
  discount_amount: number | null;
  discount_reason: string | null;
  contract_signed_at: string | null;
  is_gift_card: boolean | null;
  gift_card_code: string | null;
  gift_card_recipient_name: string | null;
  customers: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
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
      "id, customer_id, date, start_time, end_time, offer_name, party_size, total_amount, deposit_amount, deposit_paid, balance_due, balance_payments, status, source_channel, discount_amount, discount_reason, contract_signed_at, is_gift_card, gift_card_code, gift_card_recipient_name, customers(first_name, last_name, email, phone)",
    )
    .order("date", { ascending: true })
    .returns<BookingRow[]>();

  const bookings = data ?? [];
  const confirmees = bookings.filter((b) => CONFIRMED.has(b.status ?? "")).length;
  // À venir : on exclut les cartes cadeaux sans date (= en attente de réservation).
  const aVenir = bookings.filter(
    (b) => b.date !== null && b.date >= todayIso && b.status !== "cancelled",
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
      (b) =>
        b.status !== "cancelled" &&
        b.date !== null &&
        b.date >= todayIso &&
        (b.balance_due ?? 0) > 0,
    )
    .map((b) => ({
      id: b.id,
      customerName: fullName(
        b.customers?.first_name ?? null,
        b.customers?.last_name ?? null,
      ),
      offerName: b.offer_name,
      date: b.date!,
      balanceDue: b.balance_due ?? 0,
      sourceChannel: b.source_channel,
    }));

  // Toutes les sorties à venir, payées ou non — contrairement à toCollect
  // (ci-dessus) qui ne garde que celles avec un solde à percevoir.
  const upcomingAll: UpcomingItem[] = bookings
    .filter((b) => b.status !== "cancelled" && b.date !== null && b.date >= todayIso)
    .map((b) => ({
      id: b.id,
      date: b.date!,
      offerName: b.offer_name,
      customerName: fullName(
        b.customers?.first_name ?? null,
        b.customers?.last_name ?? null,
      ),
      partySize: b.party_size,
      amount: b.total_amount,
      balanceDue: b.balance_due,
      depositPaid: b.deposit_paid,
      sourceChannel: b.source_channel,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Les réservations annulées restent visibles (onglet Historique) — on doit
  // toujours pouvoir les rouvrir ou vérifier ce qui s'est passé.
  const tableItems: BookingTableItem[] = bookings.map((b) => ({
    id: b.id,
    customerId: b.customer_id,
    date: b.date,
    startTime: b.start_time,
    endTime: b.end_time,
    offerName: b.offer_name,
    customerName: fullName(
      b.customers?.first_name ?? null,
      b.customers?.last_name ?? null,
    ),
    customerFirstName: b.customers?.first_name ?? null,
    customerLastName: b.customers?.last_name ?? null,
    customerEmail: b.customers?.email ?? null,
    customerPhone: b.customers?.phone ?? null,
    partySize: b.party_size,
    amount: b.total_amount,
    depositAmount: b.deposit_amount,
    depositPaid: b.deposit_paid,
    balanceDue: b.balance_due,
    balancePayments: parsePayments(b.balance_payments),
    status: b.status,
    sourceChannel: b.source_channel,
    discountAmount: b.discount_amount,
    discountReason: b.discount_reason,
    contractSigned: Boolean(b.contract_signed_at),
    isGiftCard: Boolean(b.is_gift_card),
    giftCardCode: b.gift_card_code,
    giftCardRecipientName: b.gift_card_recipient_name,
  }));

  // Données éditables indexées par id — permet d'ouvrir l'édition depuis
  // « Soldes à encaisser » (clic sur une ligne) comme depuis la table.
  const editableById: Record<string, EditableBooking> = Object.fromEntries(
    tableItems.map((b) => [
      b.id,
      {
        id: b.id,
        customerId: b.customerId,
        customerName: b.customerName,
        customerFirstName: b.customerFirstName,
        customerLastName: b.customerLastName,
        customerEmail: b.customerEmail,
        customerPhone: b.customerPhone,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        offerName: b.offerName,
        sourceChannel: b.sourceChannel,
        partySize: b.partySize,
        totalAmount: b.amount,
        depositAmount: b.depositAmount,
        depositPaid: b.depositPaid,
        balancePayments: b.balancePayments,
        balanceDue: b.balanceDue,
        status: b.status,
        discountAmount: b.discountAmount,
        discountReason: b.discountReason,
        isGiftCard: b.isGiftCard,
        giftCardCode: b.giftCardCode,
        giftCardRecipientName: b.giftCardRecipientName,
      },
    ]),
  );

  return (
    <div className="space-y-6">
      <header className="enter-up flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Réservations
          </h1>
          <p className="text-sm text-muted-foreground">
            {tableItems.length} sortie{tableItems.length > 1 ? "s" : ""} enregistrée
            {tableItems.length > 1 ? "s" : ""} · clique sur une ligne pour modifier
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddGiftCardDialog />
          <AddBookingDialog />
        </div>
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
          <BalanceAgenda items={toCollect} editableById={editableById} />
        </CardContent>
      </Card>

      <Card className="enter-up" style={{ animationDelay: "300ms" }}>
        <CardHeader>
          <CardTitle>Réservations à venir</CardTitle>
          <CardDescription>
            Toutes les sorties confirmées à venir, payées ou non
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UpcomingBookingsList items={upcomingAll} editableById={editableById} />
        </CardContent>
      </Card>

      <Card className="enter-up" style={{ animationDelay: "340ms" }}>
        <CardHeader>
          <CardTitle>Toutes les réservations</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingsTable bookings={tableItems} todayIso={todayIso} />
        </CardContent>
      </Card>
    </div>
  );
}
