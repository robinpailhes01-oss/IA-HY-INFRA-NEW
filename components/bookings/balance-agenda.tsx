"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { formatEur } from "@/lib/format";
import {
  SettleBalanceDialog,
  type SettleTarget,
} from "@/components/bookings/settle-balance-dialog";
import {
  BookingEditDialog,
  type EditableBooking,
} from "@/components/bookings/booking-edit-dialog";
import { BookingRow } from "@/components/bookings/booking-row";

/**
 * Des soldes à encaisser, un bouton par ligne. Sert aux soldes EN RETARD :
 * des sorties passées dont le solde n'a jamais été marqué payé — presque
 * toujours de l'argent bien perçu le jour J (espèces, terminal) mais jamais
 * saisi. Un clic pour régulariser.
 */
export function BalanceAgenda({
  items,
  todayIso,
  late = false,
  editableById = {},
}: {
  items: SettleTarget[];
  todayIso: string;
  /** Sorties passées : l'état de paiement passe au rouge. */
  late?: boolean;
  /** Données éditables par id — active le clic sur une ligne pour modifier/supprimer. */
  editableById?: Record<string, EditableBooking>;
}) {
  const [selected, setSelected] = useState<SettleTarget | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditableBooking | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  if (items.length === 0) {
    return (
      <EmptyState icon={<CheckCircle2 />} title="Tout est à jour">
        Aucun solde à encaisser.
      </EmptyState>
    );
  }

  return (
    <>
      <ul className="divide-y divide-[var(--hairline)]">
        {items.map((b) => {
          const editable = editableById[b.id];
          return (
            <BookingRow
              key={b.id}
              id={b.id}
              date={b.date}
              todayIso={todayIso}
              title={b.offerName ?? "Sortie"}
              subtitle={b.customerName}
              amount={null}
              pay={{ label: `Solde ${formatEur(b.balanceDue)}`, tone: late ? "late" : "balance" }}
              onOpen={
                editable
                  ? () => {
                      setEditing(editable);
                      setEditOpen(true);
                    }
                  : undefined
              }
              onSettle={() => {
                setSelected(b);
                setOpen(true);
              }}
            />
          );
        })}
      </ul>

      <SettleBalanceDialog booking={selected} open={open} onOpenChange={setOpen} />
      <BookingEditDialog booking={editing} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
