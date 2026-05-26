"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { settleBalance } from "@/app/(dashboard)/bookings/actions";
import { PAYMENT_LABEL, PAYMENT_METHODS } from "@/lib/payments";
import { formatDateLong, formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SettleTarget = {
  id: string;
  customerName: string;
  offerName: string | null;
  date: string;
  balanceDue: number;
};

type Line = { method: string; amount: string };

export function SettleBalanceDialog({
  booking,
  open,
  onOpenChange,
}: {
  booking: SettleTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<Line[]>([{ method: "cb", amount: "" }]);

  useEffect(() => {
    if (booking && open) {
      setLines([{ method: "cb", amount: String(booking.balanceDue) }]);
    }
  }, [booking, open]);

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const remaining = (booking?.balanceDue ?? 0) - total;

  function update(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((ls) => (ls.length >= 4 ? ls : [...ls, { method: "especes", amount: "" }]));
  }
  function removeLine(i: number) {
    setLines((ls) => (ls.length <= 1 ? ls : ls.filter((_, idx) => idx !== i)));
  }

  function handleSave() {
    if (!booking) return;
    const payments = lines
      .map((l) => ({ method: l.method, amount: Number(l.amount) || 0 }))
      .filter((p) => p.amount > 0 && p.method);
    if (payments.length === 0) {
      toast.error("Saisis au moins un montant.");
      return;
    }
    startTransition(async () => {
      const res = await settleBalance(booking.id, payments);
      if (!res.ok) {
        toast.error("Échec de l'encaissement", { description: res.error ?? undefined });
        return;
      }
      toast.success("Encaissement enregistré");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Encaisser le solde</DialogTitle>
          <DialogDescription>
            {booking
              ? `${booking.offerName ?? "Sortie"} · ${booking.customerName} · ${formatDateLong(booking.date)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
          <span className="text-muted-foreground">Solde dû</span>
          <span className="font-semibold text-foreground">
            {formatEur(booking?.balanceDue ?? 0)}
          </span>
        </div>

        <div className="grid gap-3">
          {lines.map((line, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="grid flex-1 gap-1.5">
                {i === 0 && <Label>Moyen de paiement</Label>}
                <Select
                  value={line.method}
                  onValueChange={(v) => update(i, { method: (v as string) ?? "" })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(val) => (val ? PAYMENT_LABEL[val as string] : "Choisir")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid w-28 gap-1.5">
                {i === 0 && <Label>Montant</Label>}
                <Input
                  type="number"
                  min={0}
                  value={line.amount}
                  onChange={(e) => update(i, { amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                onClick={() => removeLine(i)}
                disabled={lines.length <= 1}
                aria-label="Retirer ce moyen"
              >
                <X />
              </Button>
            </div>
          ))}
          {lines.length < 4 && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={addLine}
              className="w-fit"
            >
              <Plus /> Ajouter un moyen
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total saisi · {formatEur(total)}</span>
          <span
            className={cn(
              "font-medium",
              remaining === 0
                ? "text-success"
                : remaining < 0
                  ? "text-danger"
                  : "text-muted-foreground",
            )}
          >
            {remaining > 0
              ? `Reste ${formatEur(remaining)}`
              : remaining < 0
                ? `Trop-perçu ${formatEur(-remaining)}`
                : "Soldé ✓"}
          </span>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Encaisser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
