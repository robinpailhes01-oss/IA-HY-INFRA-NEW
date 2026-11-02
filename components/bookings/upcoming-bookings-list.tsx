"use client";

import { useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PillGroup } from "@/components/finance/pill-group";
import { formatEur } from "@/lib/format";
import {
  SettleBalanceDialog,
  type SettleTarget,
} from "@/components/bookings/settle-balance-dialog";
import {
  BookingEditDialog,
  type EditableBooking,
} from "@/components/bookings/booking-edit-dialog";
import { BookingRow, type PayState } from "@/components/bookings/booking-row";

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
  isGiftCard?: boolean;
};

type Filter = "all" | "balance" | "deposit";

function payState(b: UpcomingItem): PayState {
  const due = b.balanceDue ?? 0;
  if (b.depositPaid === false) return { label: "Acompte dû", tone: "due" };
  if (due > 0) return { label: `Solde ${formatEur(due)}`, tone: "balance" };
  return { label: "Soldé", tone: "paid" };
}

/**
 * Toutes les sorties à venir, payées ou non, avec un filtre pour ne garder
 * que celles où il reste un solde à percevoir (l'ancienne liste « Soldes à
 * encaisser », qui répétait les mêmes lignes une seconde fois) ou un acompte
 * pas encore payé.
 */
export function UpcomingBookingsList({
  items,
  todayIso,
  editableById = {},
}: {
  items: UpcomingItem[];
  todayIso: string;
  editableById?: Record<string, EditableBooking>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<SettleTarget | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditableBooking | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const counts = useMemo(
    () => ({
      all: items.length,
      balance: items.filter((b) => (b.balanceDue ?? 0) > 0).length,
      deposit: items.filter((b) => b.depositPaid === false).length,
    }),
    [items],
  );
  const rows =
    filter === "balance"
      ? items.filter((b) => (b.balanceDue ?? 0) > 0)
      : filter === "deposit"
        ? items.filter((b) => b.depositPaid === false)
        : items;

  if (items.length === 0) {
    return (
      <EmptyState icon={<CalendarCheck />} title="Aucune sortie à venir">
        Les prochaines réservations — du site, de WhatsApp ou saisies à la main — apparaîtront ici.
      </EmptyState>
    );
  }

  return (
    <>
      <PillGroup
        label="Filtrer les sorties à venir"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Toutes", count: counts.all },
          { value: "balance", label: "Solde dû", count: counts.balance },
          { value: "deposit", label: "Acompte dû", count: counts.deposit },
        ]}
      />

      {rows.length === 0 ? (
        <p className="t-body mt-4 rounded-[18px] bg-white/50 px-4 py-6 text-center text-ink-3">
          {filter === "deposit" ? "Tous les acomptes sont payés." : "Aucun solde à encaisser. Tout est à jour."}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--hairline)]">
          {rows.map((b) => {
            const editable = editableById[b.id];
            const due = b.balanceDue ?? 0;
            return (
              <BookingRow
                key={b.id}
                id={b.id}
                date={b.date}
                todayIso={todayIso}
                title={b.offerName ?? "Sortie"}
                subtitle={b.customerName}
                partySize={b.partySize}
                amount={b.amount}
                pay={payState(b)}
                isGiftCard={b.isGiftCard}
                onOpen={
                  editable
                    ? () => {
                        setEditing(editable);
                        setEditOpen(true);
                      }
                    : undefined
                }
                onSettle={
                  due > 0
                    ? () => {
                        setSelected({
                          id: b.id,
                          customerName: b.customerName,
                          offerName: b.offerName,
                          date: b.date,
                          balanceDue: due,
                          sourceChannel: b.sourceChannel,
                        });
                        setOpen(true);
                      }
                    : undefined
                }
              />
            );
          })}
        </ul>
      )}

      <SettleBalanceDialog booking={selected} open={open} onOpenChange={setOpen} />
      <BookingEditDialog booking={editing} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
