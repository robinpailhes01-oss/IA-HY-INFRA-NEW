"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, FileText, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateRelative, formatEur } from "@/lib/format";
import {
  SettleBalanceDialog,
  type SettleTarget,
} from "@/components/bookings/settle-balance-dialog";
import {
  BookingEditDialog,
  type EditableBooking,
} from "@/components/bookings/booking-edit-dialog";

export type UpcomingItem = {
  id: string;
  date: string;
  offerName: string | null;
  customerName: string;
  partySize: number | null;
  amount: number | null;
  balanceDue: number | null;
  depositPaid: boolean | null;
  sourceChannel: string | null;
};

/**
 * Toutes les sorties à venir, payées ou non — contrairement à « Soldes à
 * encaisser » (BalanceAgenda) qui ne montre que celles avec un reste à
 * percevoir. Vue d'ensemble de ce qui arrive, pas seulement de ce qu'il
 * reste à faire côté paiement.
 */
export function UpcomingBookingsList({
  items,
  editableById = {},
}: {
  items: UpcomingItem[];
  editableById?: Record<string, EditableBooking>;
}) {
  const [selected, setSelected] = useState<SettleTarget | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditableBooking | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
        <CalendarCheck className="size-6 text-muted-foreground/70" />
        Aucune réservation à venir.
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border/60">
        {items.map((b) => {
          const editable = editableById[b.id];
          const due = b.balanceDue ?? 0;
          const payLabel = b.depositPaid === false ? "Acompte dû" : due > 0 ? `Solde ${formatEur(due)}` : "Soldé";
          const payClass = b.depositPaid === false ? "text-warning" : due > 0 ? "text-info" : "text-success";
          return (
            <li
              key={b.id}
              onClick={editable ? () => { setEditing(editable); setEditOpen(true); } : undefined}
              title={editable ? "Modifier cette réservation" : undefined}
              className={cn(
                "flex items-center gap-3 py-3",
                editable && "-mx-2 cursor-pointer rounded-lg px-2 transition-colors hover:bg-muted/50",
              )}
            >
              <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-center">
                <span className="text-[10px] font-medium capitalize leading-none text-muted-foreground">
                  {formatDateRelative(b.date).split(" ")[0]}
                </span>
                <span className="text-sm font-semibold leading-tight text-foreground">
                  {new Date(b.date).getDate()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{b.offerName ?? "Sortie"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {b.customerName}
                  {b.partySize != null ? ` · ${b.partySize} pers.` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-sm font-semibold text-foreground">{formatEur(b.amount)}</span>
                <span className={cn("text-xs font-medium", payClass)}>{payLabel}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  href={`/contrats/${b.id}`}
                  target="_blank"
                  title="Voir le contrat de location"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <FileText className="size-4" />
                  <span className="sr-only">Contrat</span>
                </Link>
                {due > 0 && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected({
                        id: b.id,
                        customerName: b.customerName,
                        offerName: b.offerName,
                        date: b.date,
                        balanceDue: due,
                        sourceChannel: b.sourceChannel,
                      });
                      setOpen(true);
                    }}
                  >
                    <Wallet /> Encaisser
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <SettleBalanceDialog booking={selected} open={open} onOpenChange={setOpen} />
      <BookingEditDialog booking={editing} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
