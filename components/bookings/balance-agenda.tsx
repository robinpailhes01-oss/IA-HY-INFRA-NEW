"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, Wallet } from "lucide-react";

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

export function BalanceAgenda({
  items,
  editableById = {},
}: {
  items: SettleTarget[];
  /** Données éditables par id — active le clic sur une ligne pour modifier/supprimer. */
  editableById?: Record<string, EditableBooking>;
}) {
  const [selected, setSelected] = useState<SettleTarget | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditableBooking | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
        <CheckCircle2 className="size-6 text-success/70" />
        Aucun solde à encaisser. Tout est à jour. ⚓
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border/60">
        {items.map((b) => {
          const editable = editableById[b.id];
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
              <p className="truncate text-sm font-medium text-foreground">
                {b.offerName ?? "Sortie"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {b.customerName} · solde{" "}
                <span className="font-medium text-foreground">{formatEur(b.balanceDue)}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5">
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
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(b);
                  setOpen(true);
                }}
              >
                <Wallet /> Encaisser
              </Button>
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
