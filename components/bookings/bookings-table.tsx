"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateLong, formatEur, formatTimeRange } from "@/lib/format";
import { bookingStatusBadge } from "@/lib/status";
import {
  BookingEditDialog,
  type EditableBooking,
} from "@/components/bookings/booking-edit-dialog";
import { cn } from "@/lib/utils";

export type BookingTableItem = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  offerName: string | null;
  customerName: string;
  partySize: number | null;
  amount: number | null;
  depositPaid: boolean | null;
  balanceDue: number | null;
  status: string | null;
  sourceChannel: string | null;
};

function payment(b: BookingTableItem): { label: string; className: string } {
  if (b.status === "cancelled") return { label: "—", className: "text-muted-foreground" };
  if (b.depositPaid === false) return { label: "Acompte dû", className: "text-warning" };
  if ((b.balanceDue ?? 0) > 0)
    return { label: `Solde ${formatEur(b.balanceDue)}`, className: "text-info" };
  return { label: "Soldé", className: "text-success" };
}

export function BookingsTable({ bookings }: { bookings: BookingTableItem[] }) {
  const [selected, setSelected] = useState<EditableBooking | null>(null);
  const [open, setOpen] = useState(false);

  if (bookings.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucune réservation pour le moment.
      </p>
    );
  }

  function edit(b: BookingTableItem) {
    setSelected({
      id: b.id,
      customerName: b.customerName,
      date: b.date,
      offerName: b.offerName,
      sourceChannel: b.sourceChannel,
      partySize: b.partySize,
      status: b.status,
    });
    setOpen(true);
  }

  return (
    <>
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
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((b) => {
            const status = bookingStatusBadge(b.status);
            const time = formatTimeRange(b.startTime, b.endTime);
            const pay = payment(b);
            return (
              <TableRow
                key={b.id}
                onClick={() => edit(b)}
                className="group cursor-pointer transition-colors active:bg-muted/60"
                title="Modifier cette réservation"
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {formatDateLong(b.date)}
                    </span>
                    {time && <span className="text-xs text-muted-foreground">{time}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-foreground">{b.customerName}</TableCell>
                <TableCell className="text-muted-foreground">{b.offerName ?? "—"}</TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {b.partySize ?? "—"}
                </TableCell>
                <TableCell className="text-right font-semibold text-foreground">
                  {formatEur(b.amount)}
                </TableCell>
                <TableCell>
                  <span className={cn("text-sm font-medium", pay.className)}>{pay.label}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  <Pencil className="size-4 text-muted-foreground/40 transition-colors group-hover:text-gold" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <BookingEditDialog booking={selected} open={open} onOpenChange={setOpen} />
    </>
  );
}
