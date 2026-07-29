"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Loader2, RotateCcw, Trash2, X } from "lucide-react";
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
import {
  cancelBooking,
  removeBalancePayment,
  reopenBooking,
  settleBalance,
  updateBooking,
  type BookingUpdate,
} from "@/app/(dashboard)/bookings/actions";
import { SOURCE_OPTIONS } from "@/lib/status";
import { PAYMENT_METHODS, paymentLabel, type BalancePayment } from "@/lib/payments";
import { formatEur } from "@/lib/format";

type NewPaymentLine = { method: string; amount: string };

export type EditableBooking = {
  id: string;
  customerId: string | null;
  customerName: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  offerName: string | null;
  sourceChannel: string | null;
  partySize: number | null;
  totalAmount: number | null;
  depositAmount: number | null;
  depositPaid: boolean | null;
  balancePayments: BalancePayment[];
  balanceDue: number | null;
  status: string | null;
  discountAmount: number | null;
  discountReason: string | null;
  isGiftCard: boolean;
  giftCardCode: string | null;
  giftCardRecipientName: string | null;
};

const STATUS_OPTIONS: [string, string][] = [
  ["confirmed", "Confirmée"],
  ["pending", "En attente"],
  ["completed", "Terminée"],
  ["cancelled", "Annulée"],
];

const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCE_OPTIONS);
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS);

export function BookingEditDialog({
  booking,
  open,
  onOpenChange,
}: {
  booking: EditableBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Miroir local des paiements — mis à jour immédiatement après un retrait,
  // sans attendre que le `booking` (état du parent) se resynchronise via
  // router.refresh().
  const [payments, setPayments] = useState<BalancePayment[]>([]);
  const [newLines, setNewLines] = useState<NewPaymentLine[]>([{ method: "cb", amount: "" }]);
  const [addingPayment, setAddingPayment] = useState(false);
  const [form, setForm] = useState<BookingUpdate>({
    source_channel: "",
    status: "",
    party_size: null,
    offer_name: "",
    total_amount: null,
    discount_amount: null,
    discount_reason: "",
    date: null,
    start_time: null,
    end_time: null,
    deposit_amount: null,
    deposit_paid: null,
    customer_first_name: "",
    customer_last_name: "",
    customer_email: "",
    customer_phone: "",
  });

  useEffect(() => {
    if (booking && open) {
      setConfirmDelete(false);
      setPayments(booking.balancePayments ?? []);
      setNewLines([{ method: "cb", amount: "" }]);
      setForm({
        source_channel: booking.sourceChannel ?? "",
        status: booking.status ?? "",
        party_size: booking.partySize ?? null,
        offer_name: booking.offerName ?? "",
        total_amount: booking.totalAmount ?? null,
        discount_amount: booking.discountAmount,
        discount_reason: booking.discountReason ?? "",
        date: booking.date,
        start_time: booking.startTime,
        end_time: booking.endTime,
        deposit_amount: booking.depositAmount,
        deposit_paid: booking.depositPaid,
        customer_first_name: booking.customerFirstName ?? "",
        customer_last_name: booking.customerLastName ?? "",
        customer_email: booking.customerEmail ?? "",
        customer_phone: booking.customerPhone ?? "",
      });
    }
  }, [booking, open]);

  function set<K extends keyof BookingUpdate>(key: K, value: BookingUpdate[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    if (!booking) return;
    if (!form.source_channel) {
      toast.error("Canal d'acquisition requis", {
        description: "Choisissez la source ou « Je ne sais pas ».",
      });
      return;
    }
    startTransition(async () => {
      const res = await updateBooking(booking.id, {
        source_channel: form.source_channel || null,
        status: form.status || null,
        party_size: form.party_size,
        offer_name: form.offer_name || null,
        discount_amount: form.discount_amount,
        discount_reason: form.discount_reason || null,
        date: form.date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        total_amount: form.total_amount,
        deposit_amount: form.deposit_amount,
        deposit_paid: form.deposit_paid,
        customer_first_name: form.customer_first_name || null,
        customer_last_name: form.customer_last_name ?? "",
        customer_email: form.customer_email ?? "",
        customer_phone: form.customer_phone ?? "",
      });
      if (!res.ok) {
        toast.error("Échec de l'enregistrement", { description: res.error ?? undefined });
        return;
      }
      toast.success("Réservation mise à jour");
      onOpenChange(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!booking) return;
    startTransition(async () => {
      const res = await cancelBooking(booking.id);
      if (!res.ok) {
        toast.error("Échec de l'annulation", { description: res.error ?? undefined });
        return;
      }
      toast.success("Réservation annulée", {
        description: "Retirée de Google Agenda. Toujours visible dans l'historique.",
      });
      setConfirmDelete(false);
      onOpenChange(false);
      router.refresh();
    });
  }

  function handleReopen() {
    if (!booking) return;
    startTransition(async () => {
      const res = await reopenBooking(booking.id);
      if (!res.ok) {
        toast.error("Échec de la réactivation", { description: res.error ?? undefined });
        return;
      }
      toast.success("Réservation réactivée", { description: "Remise sur Google Agenda." });
      onOpenChange(false);
      router.refresh();
    });
  }

  function handleRemovePayment(index: number) {
    if (!booking) return;
    setRemovingIndex(index);
    startTransition(async () => {
      const res = await removeBalancePayment(booking.id, index);
      setRemovingIndex(null);
      if (!res.ok) {
        toast.error("Échec de l'annulation du paiement", { description: res.error ?? undefined });
        return;
      }
      setPayments((p) => p.filter((_, i) => i !== index));
      toast.success("Paiement annulé", { description: "Le solde dû a été recalculé." });
      router.refresh();
    });
  }

  function updateNewLine(i: number, patch: Partial<NewPaymentLine>) {
    setNewLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addNewLine() {
    setNewLines((ls) => (ls.length >= 4 ? ls : [...ls, { method: "especes", amount: "" }]));
  }
  function removeNewLine(i: number) {
    setNewLines((ls) => (ls.length <= 1 ? ls : ls.filter((_, idx) => idx !== i)));
  }

  function handleAddPayments() {
    if (!booking) return;
    const clean = newLines
      .map((l) => ({ method: l.method, amount: Number(l.amount) || 0 }))
      .filter((p) => p.amount > 0 && p.method);
    if (clean.length === 0) {
      toast.error("Saisis au moins un montant.");
      return;
    }
    setAddingPayment(true);
    startTransition(async () => {
      const res = await settleBalance(booking.id, clean);
      setAddingPayment(false);
      if (!res.ok) {
        toast.error("Échec de l'encaissement", { description: res.error ?? undefined });
        return;
      }
      setPayments((p) => [...p, ...clean]);
      setNewLines([{ method: "cb", amount: "" }]);
      toast.success("Paiement(s) encaissé(s)", { description: "Le solde dû a été recalculé." });
      router.refresh();
    });
  }

  // Solde restant recalculé en direct (montant total − acompte encaissé − paiements
  // restants) pour refléter immédiatement un retrait de paiement à l'écran.
  const depositCollected = form.deposit_paid ? (form.deposit_amount ?? 0) : 0;
  const paymentsCollected = payments.reduce((s, p) => s + p.amount, 0);
  const liveBalanceDue = Math.max(
    0,
    (form.total_amount ?? 0) - depositCollected - paymentsCollected,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {booking?.isGiftCard ? "Carte cadeau" : "Modifier la réservation"}
          </DialogTitle>
          <DialogDescription>
            {booking ? booking.customerName : ""}
            {booking?.isGiftCard && booking.giftCardCode && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                🎁 {booking.giftCardCode}
              </span>
            )}
            {booking?.isGiftCard && booking.giftCardRecipientName && (
              <span className="block text-xs text-muted-foreground">
                Bénéficiaire : {booking.giftCardRecipientName}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {booking?.isGiftCard && !booking.date && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Carte cadeau en attente d&apos;utilisation</p>
              <p className="mt-1 text-xs">
                Renseigne la date (et idéalement les horaires) ci-dessous pour la
                convertir en réservation.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Prénom</Label>
              <Input
                value={form.customer_first_name ?? ""}
                onChange={(e) => set("customer_first_name", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Nom</Label>
              <Input
                value={form.customer_last_name ?? ""}
                onChange={(e) => set("customer_last_name", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.customer_email ?? ""}
                onChange={(e) => set("customer_email", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Téléphone</Label>
              <Input
                type="tel"
                value={form.customer_phone ?? ""}
                onChange={(e) => set("customer_phone", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Date de sortie</Label>
              <Input
                type="date"
                value={form.date ?? ""}
                onChange={(e) => set("date", e.target.value || null)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Début</Label>
              <Input
                type="time"
                value={form.start_time ?? ""}
                onChange={(e) => set("start_time", e.target.value || null)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Fin</Label>
              <Input
                type="time"
                value={form.end_time ?? ""}
                onChange={(e) => set("end_time", e.target.value || null)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>D&apos;où nous a-t-il connu ? *</Label>
            <Select
              value={form.source_channel ?? ""}
              onValueChange={(v) => set("source_channel", (v as string) ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) => (value ? SOURCE_LABEL[value as string] : "Sélectionner…")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Offre</Label>
            <Input
              value={form.offer_name ?? ""}
              onChange={(e) => set("offer_name", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Statut</Label>
              <Select
                value={form.status ?? ""}
                onValueChange={(v) => set("status", (v as string) ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) => (value ? STATUS_LABEL[value as string] : "Sélectionner…")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Personnes</Label>
              <Input
                type="number"
                min={1}
                value={form.party_size ?? ""}
                onChange={(e) =>
                  set("party_size", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Montant (€)</Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={form.total_amount ?? ""}
                onChange={(e) =>
                  set("total_amount", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Promotion appliquée
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Remise (€)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={form.discount_amount ?? ""}
                  onChange={(e) =>
                    set("discount_amount", e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </div>
              <div className="col-span-2 grid gap-1.5">
                <Label className="text-xs">Raison</Label>
                <Input
                  placeholder="Cliente fidèle, promo printemps…"
                  value={form.discount_reason ?? ""}
                  onChange={(e) => set("discount_reason", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Paiements
            </p>

            <label className="mb-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={form.deposit_paid ?? false}
                onChange={(e) => set("deposit_paid", e.target.checked)}
              />
              Acompte encaissé
              <Input
                type="number"
                min={0}
                step="1"
                className="ml-auto w-24"
                value={form.deposit_amount ?? ""}
                onChange={(e) =>
                  set("deposit_amount", e.target.value === "" ? null : Number(e.target.value))
                }
              />
              <span className="text-muted-foreground">€</span>
            </label>

            {payments.length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {payments.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md bg-background px-2.5 py-1.5 text-sm"
                  >
                    <span className="text-foreground">
                      {paymentLabel(p.method)} · {formatEur(p.amount)}
                    </span>
                    <button
                      type="button"
                      title="Annuler ce paiement"
                      onClick={() => handleRemovePayment(i)}
                      disabled={pending}
                      className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      {removingIndex === i ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {liveBalanceDue > 0 && (
              <div className="mb-3 space-y-2 border-t border-border pt-3">
                {newLines.map((line, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="grid flex-1 gap-1.5">
                      {i === 0 && <Label className="text-xs">Moyen de paiement</Label>}
                      <Select
                        value={line.method}
                        onValueChange={(v) => updateNewLine(i, { method: (v as string) ?? "" })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(val) => (val ? paymentLabel(val as string) : "Choisir")}
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
                    <div className="grid w-24 gap-1.5">
                      {i === 0 && <Label className="text-xs">Montant</Label>}
                      <Input
                        type="number"
                        min={0}
                        value={line.amount}
                        onChange={(e) => updateNewLine(i, { amount: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      type="button"
                      onClick={() => removeNewLine(i)}
                      disabled={newLines.length <= 1}
                      aria-label="Retirer ce moyen"
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  {newLines.length < 4 ? (
                    <Button variant="outline" size="sm" type="button" onClick={addNewLine}>
                      + Ajouter un moyen
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button size="sm" type="button" onClick={handleAddPayments} disabled={pending}>
                    {addingPayment && <Loader2 className="animate-spin" />}
                    Encaisser
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Solde restant dû</span>
              <span className="font-semibold text-foreground">{formatEur(liveBalanceDue)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {booking && (
              <Link
                href={`/contrats/${booking.id}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <FileText className="size-4" />
                Contrat
              </Link>
            )}
            {booking && booking.status === "cancelled" && (
              <button
                type="button"
                onClick={handleReopen}
                disabled={pending}
                className="inline-flex items-center gap-1.5 text-sm text-success transition-colors hover:underline disabled:opacity-50"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                Réactiver la réservation
              </button>
            )}
            {booking && booking.status !== "cancelled" && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-sm text-destructive transition-colors hover:underline"
              >
                <Trash2 className="size-4" />
                Annuler la réservation
              </button>
            )}
            {booking && confirmDelete && (
              <span className="inline-flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Confirmer l&apos;annulation&nbsp;?</span>
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  Oui, annuler
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={pending}>
                  Non
                </Button>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <DialogClose render={<Button variant="outline" />}>Fermer</DialogClose>
            <Button onClick={handleSave} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
