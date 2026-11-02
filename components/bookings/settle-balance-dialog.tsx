"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Wallet, X } from "lucide-react";
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
import { Num } from "@/components/ui/num";
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
import { SOURCE_OPTIONS } from "@/lib/status";
import { cn } from "@/lib/utils";

export type SettleTarget = {
  id: string;
  customerName: string;
  offerName: string | null;
  date: string;
  balanceDue: number;
  sourceChannel: string | null;
};

type Line = { method: string; amount: string };

const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCE_OPTIONS);

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
  const [channel, setChannel] = useState<string>("");

  useEffect(() => {
    if (booking && open) {
      setLines([{ method: "cb", amount: String(booking.balanceDue) }]);
      setChannel(booking.sourceChannel ?? "");
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
    if (!booking || pending) return;
    const payments = lines
      .map((l) => ({ method: l.method, amount: Number(l.amount) || 0 }))
      .filter((p) => p.amount > 0 && p.method);
    if (payments.length === 0) {
      toast.error("Saisis au moins un montant.");
      return;
    }
    startTransition(async () => {
      const res = await settleBalance(booking.id, payments, channel || null);
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
        <DialogHeader className="pr-10">
          <span className="mb-1 grid size-10 place-items-center rounded-full bg-[rgba(15,159,110,0.1)] text-success">
            <Wallet className="size-[18px]" />
          </span>
          <DialogTitle className="t-serif font-serif text-[28px] font-normal leading-tight text-foreground">
            Encaisser le solde
          </DialogTitle>
          <DialogDescription className="text-ink-2">
            {booking
              ? `${booking.offerName ?? "Sortie"} · ${booking.customerName} · ${formatDateLong(booking.date)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {/* Le solde dû, en grand : c'est le chiffre qu'on vient vérifier. */}
        <div className="vitre-inset flex items-end justify-between gap-3 rounded-[22px] px-5 py-4">
          <div>
            <p className="t-label text-ink-3">Solde dû</p>
            <Num className="n-kpi mt-1.5 block text-foreground">{formatEur(booking?.balanceDue ?? 0)}</Num>
          </div>
          <span
            className={cn(
              "pastille mb-1",
              remaining === 0
                ? "bg-[rgba(15,159,110,0.1)] text-success"
                : remaining < 0
                  ? "bg-[rgba(224,77,85,0.1)] text-danger"
                  : "bg-white text-ink-2",
            )}
          >
            {remaining > 0 ? (
              <>
                Reste <Num>{formatEur(remaining)}</Num>
              </>
            ) : remaining < 0 ? (
              <>
                Trop-perçu <Num>{formatEur(-remaining)}</Num>
              </>
            ) : (
              <>
                <Check className="size-3" /> Tout est couvert
              </>
            )}
          </span>
        </div>

        <div className="grid gap-2.5">
          <p className="t-label text-ink-2">Moyens de paiement</p>
          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={line.method}
                onValueChange={(v) => update(i, { method: (v as string) ?? "" })}
              >
                <SelectTrigger className="h-11 min-w-0 flex-1" aria-label={`Moyen de paiement ${i + 1}`}>
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
              <div className="relative w-32 shrink-0">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={line.amount}
                  onChange={(e) => update(i, { amount: e.target.value })}
                  placeholder="0"
                  aria-label={`Montant ${i + 1}`}
                  className="n-inline h-11 pr-8 text-right"
                />
                <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[13px] text-ink-3">€</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => removeLine(i)}
                disabled={lines.length <= 1}
                aria-label="Retirer ce moyen"
                className="size-11 shrink-0"
              >
                <X />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {lines.length < 4 ? (
              <Button variant="secondary" type="button" onClick={addLine} className="h-10 w-fit">
                <Plus /> Ajouter un moyen
              </Button>
            ) : (
              <span />
            )}
            <span className="text-[12.5px] text-ink-3">
              Total saisi · <Num className="n-inline text-ink-2">{formatEur(total)}</Num>
            </span>
          </div>
        </div>

        {/* Canal d'acquisition — demandé au client le jour J */}
        <div className="grid gap-1.5 border-t border-[var(--hairline)] pt-4">
          <Label className="t-label text-ink-2">
            Comment nous avez-vous connu ? <span className="font-normal text-ink-3">(optionnel)</span>
          </Label>
          <Select value={channel} onValueChange={(v) => setChannel(v ?? "")}>
            <SelectTrigger className="h-11 w-full">
              {/* Le libellé, pas la clé brute (« tiktok_organic ») de la base. */}
              <SelectValue>
                {(val) => (val ? SOURCE_LABEL[val as string] ?? (val as string) : "Demander au client…")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-11 sm:h-10" />}>Annuler</DialogClose>
          <Button onClick={handleSave} disabled={pending} className="h-11 sm:h-10 sm:px-5">
            {pending && <Loader2 className="animate-spin" />}
            Encaisser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
