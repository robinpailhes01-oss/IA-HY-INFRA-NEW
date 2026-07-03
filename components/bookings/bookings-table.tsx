"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Gift, Pencil } from "lucide-react";

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
  date: string | null;
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
  discountAmount: number | null;
  discountReason: string | null;
  contractSigned: boolean;
  isGiftCard: boolean;
  giftCardCode: string | null;
  giftCardRecipientName: string | null;
};

function payment(b: BookingTableItem): { label: string; className: string } {
  if (b.status === "cancelled") return { label: "—", className: "text-muted-foreground" };
  if (b.depositPaid === false) return { label: "Acompte dû", className: "text-warning" };
  if ((b.balanceDue ?? 0) > 0)
    return { label: `Solde ${formatEur(b.balanceDue)}`, className: "text-info" };
  return { label: "Soldé", className: "text-success" };
}

type View = "upcoming" | "history";

export function BookingsTable({
  bookings,
  todayIso,
}: {
  bookings: BookingTableItem[];
  todayIso: string;
}) {
  const [selected, setSelected] = useState<EditableBooking | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("upcoming");

  const { upcoming, history } = useMemo(() => {
    const upcoming: BookingTableItem[] = [];
    const history: BookingTableItem[] = [];
    for (const b of bookings) {
      // Une carte cadeau sans date = toujours à traiter (en attente de
      // réservation par le bénéficiaire).
      if (b.date === null) {
        upcoming.push(b);
        continue;
      }
      const isPast = b.date < todayIso;
      const isClosed =
        b.status === "cancelled" ||
        (b.depositPaid === true && (b.balanceDue ?? 0) === 0);
      if (isPast && isClosed) history.push(b);
      else upcoming.push(b);
    }
    // À traiter : cartes cadeaux sans date en premier (à honorer), puis tri par date.
    upcoming.sort((a, b) => {
      if (a.date === null && b.date === null) return 0;
      if (a.date === null) return -1;
      if (b.date === null) return 1;
      return a.date.localeCompare(b.date);
    });
    history.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return { upcoming, history };
  }, [bookings, todayIso]);

  const rows = view === "upcoming" ? upcoming : history;

  function edit(b: BookingTableItem) {
    setSelected({
      id: b.id,
      customerName: b.customerName,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      offerName: b.offerName,
      sourceChannel: b.sourceChannel,
      partySize: b.partySize,
      totalAmount: b.amount,
      status: b.status,
      discountAmount: b.discountAmount,
      discountReason: b.discountReason,
      isGiftCard: b.isGiftCard,
      giftCardCode: b.giftCardCode,
      giftCardRecipientName: b.giftCardRecipientName,
    });
    setOpen(true);
  }

  return (
    <>
      <div className="mb-4 inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-sm">
        <ViewTab active={view === "upcoming"} onClick={() => setView("upcoming")}>
          À traiter <span className="ml-1.5 text-xs text-muted-foreground">{upcoming.length}</span>
        </ViewTab>
        <ViewTab active={view === "history"} onClick={() => setView("history")}>
          Historique <span className="ml-1.5 text-xs text-muted-foreground">{history.length}</span>
        </ViewTab>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {view === "upcoming" ? "Aucune réservation à traiter." : "Aucune réservation passée."}
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
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => {
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
                    {b.date ? (
                      <>
                        <span className="font-medium text-foreground">
                          {formatDateLong(b.date)}
                        </span>
                        {time && <span className="text-xs text-muted-foreground">{time}</span>}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                        <Gift className="size-3.5" /> Date à fixer
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-foreground">
                  <div className="flex items-center gap-1.5">
                    {b.customerName}
                    {b.isGiftCard && (
                      <span
                        className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                        title={
                          b.giftCardRecipientName
                            ? `Carte cadeau — bénéficiaire : ${b.giftCardRecipientName}${b.giftCardCode ? ` · ${b.giftCardCode}` : ""}`
                            : `Carte cadeau${b.giftCardCode ? ` · ${b.giftCardCode}` : ""}`
                        }
                      >
                        🎁 {b.giftCardCode ?? "Carte"}
                      </span>
                    )}
                    {b.contractSigned && (
                      <BadgeCheck
                        className="size-4 text-emerald-600"
                        aria-label="Contrat signé"
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{b.offerName ?? "—"}</TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {b.partySize ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <span className="font-semibold text-foreground">{formatEur(b.amount)}</span>
                    {b.discountAmount && b.discountAmount > 0 && (
                      <span
                        className="text-[11px] text-success"
                        title={b.discountReason ?? "Remise appliquée"}
                      >
                        −{formatEur(b.discountAmount)} promo
                      </span>
                    )}
                  </div>
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
      )}

      <BookingEditDialog booking={selected} open={open} onOpenChange={setOpen} />
    </>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 font-medium transition-colors",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
