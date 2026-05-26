"use client";

import { useState } from "react";
import { CheckCircle2, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateRelative, formatEur } from "@/lib/format";
import {
  SettleBalanceDialog,
  type SettleTarget,
} from "@/components/bookings/settle-balance-dialog";

export function BalanceAgenda({ items }: { items: SettleTarget[] }) {
  const [selected, setSelected] = useState<SettleTarget | null>(null);
  const [open, setOpen] = useState(false);

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
        {items.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-3">
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
            <Button
              size="sm"
              onClick={() => {
                setSelected(b);
                setOpen(true);
              }}
            >
              <Wallet /> Encaisser
            </Button>
          </li>
        ))}
      </ul>

      <SettleBalanceDialog booking={selected} open={open} onOpenChange={setOpen} />
    </>
  );
}
