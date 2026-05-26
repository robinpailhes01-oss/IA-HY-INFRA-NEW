import { CalendarClock, Euro, Ship, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  BalanceAgenda,
} from "@/components/bookings/balance-agenda";
import type { SettleTarget } from "@/components/bookings/settle-balance-dialog";
import { formatDateLong, formatEur, formatTimeRange } from "@/lib/format";
import { bookingStatusBadge } from "@/lib/status";

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
  customers: { first_name: string | null; last_name: string | null } | null;
};

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "Client";
}

function paymentLabel(b: BookingRow): { label: string; className: string } {
  if (b.status === "cancelled") return { label: "—", className: "text-muted-foreground" };
  if (b.deposit_paid === false) return { label: "Acompte dû", className: "text-warning" };
  if ((b.balance_due ?? 0) > 0)
    return { label: `Solde ${formatEur(b.balance_due)}`, className: "text-info" };
  return { label: "Soldé", className: "text-success" };
}

export default async function BookingsPage() {
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, date, start_time, end_time, offer_name, party_size, total_amount, deposit_amount, deposit_paid, balance_due, status, customers(first_name, last_name)",
    )
    .order("date", { ascending: true })
    .returns<BookingRow[]>();

  const bookings = data ?? [];
  const confirmees = bookings.filter((b) => CONFIRMED.has(b.status ?? "")).length;
  const caConfirme = bookings
    .filter((b) => CONFIRMED.has(b.status ?? ""))
    .reduce((sum, b) => sum + (b.total_amount ?? 0), 0);
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
    }));

  return (
    <div className="space-y-6">
      <header className="enter-up space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Réservations
        </h1>
        <p className="text-sm text-muted-foreground">
          {bookings.length} sortie{bookings.length > 1 ? "s" : ""} enregistrée
          {bookings.length > 1 ? "s" : ""}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Confirmées" value={confirmees} icon={Ship} accent="primary" index={0} />
        <KpiCard label="CA confirmé" value={caConfirme} format="eur" icon={Euro} accent="gold" index={1} />
        <KpiCard label="À venir" value={aVenir} icon={CalendarClock} accent="info" index={2} />
        <KpiCard
          label="Reste à encaisser"
          value={resteAEncaisser}
          format="eur"
          icon={Wallet}
          accent="success"
          index={3}
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
          {bookings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune réservation pour le moment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Offre</TableHead>
                  <TableHead className="text-center">Pers.</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => {
                  const status = bookingStatusBadge(b.status);
                  const time = formatTimeRange(b.start_time, b.end_time);
                  const payment = paymentLabel(b);
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {formatDateLong(b.date)}
                          </span>
                          {time && (
                            <span className="text-xs text-muted-foreground">{time}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {fullName(b.customers?.first_name ?? null, b.customers?.last_name ?? null)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {b.offer_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {b.party_size ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {formatEur(b.total_amount)}
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium ${payment.className}`}>
                          {payment.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
