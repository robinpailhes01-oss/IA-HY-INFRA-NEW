"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, CalendarDays, Check, FileText, Gift, Loader2, Plus, RotateCcw, Trash2, Wallet, X } from "lucide-react";
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
import { Num } from "@/components/ui/num";
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
import { cn } from "@/lib/utils";
import { ChoicePills, EuroInput, Field, FormSection, ToggleRow } from "@/components/finance/form-bits";

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
    // Montants saisis dans "Paiements" mais pas encore encaissés via le bouton
    // dédié : on les inclut ici pour ne jamais les perdre silencieusement si
    // l'utilisateur clique "Enregistrer" au lieu de "Encaisser".
    const pendingPayments = newLines
      .map((l) => ({ method: l.method, amount: Number(l.amount) || 0 }))
      .filter((p) => p.amount > 0 && p.method);
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
      if (pendingPayments.length > 0) {
        const payRes = await settleBalance(booking.id, pendingPayments);
        if (!payRes.ok) {
          toast.error("Réservation enregistrée, mais l'encaissement a échoué", {
            description: payRes.error ?? "Réessaie l'encaissement depuis la fiche.",
          });
          router.refresh();
          return;
        }
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-10">
          <span
            className={cn(
              "mb-1 grid size-10 place-items-center rounded-full",
              booking?.isGiftCard ? "bg-[rgba(164,126,44,0.12)] text-gold" : "bg-[rgba(34,167,191,0.12)] text-aqua",
            )}
          >
            {booking?.isGiftCard ? <Gift className="size-[18px]" /> : <CalendarDays className="size-[18px]" />}
          </span>
          <DialogTitle className="t-serif font-serif text-[28px] font-normal leading-tight text-foreground">
            {booking?.customerName ?? "Réservation"}
          </DialogTitle>
          <DialogDescription render={<div />} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-2">
            <span>{booking?.isGiftCard ? "Carte cadeau" : "Modifier la réservation"}</span>
            {booking?.isGiftCard && booking.giftCardCode && (
              <span className="pastille bg-[rgba(164,126,44,0.12)] font-mono text-gold">{booking.giftCardCode}</span>
            )}
            {booking?.isGiftCard && booking.giftCardRecipientName && (
              <span className="basis-full text-[12.5px] text-ink-3">
                Bénéficiaire : {booking.giftCardRecipientName}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          {booking?.isGiftCard && !booking.date && (
            <div className="flex items-start gap-3 rounded-[20px] border border-[rgba(217,130,43,0.2)] bg-[rgba(217,130,43,0.08)] p-4">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="text-[13.5px] font-medium text-foreground">Carte cadeau en attente d&apos;utilisation</p>
                <p className="t-caption mt-0.5 text-ink-2">
                  Renseigne la date (et idéalement les horaires) ci-dessous pour la convertir en réservation.
                </p>
              </div>
            </div>
          )}

          <FormSection title="Le client">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom">
                <Input
                  value={form.customer_first_name ?? ""}
                  onChange={(e) => set("customer_first_name", e.target.value)}
                  className="h-11"
                />
              </Field>
              <Field label="Nom">
                <Input
                  value={form.customer_last_name ?? ""}
                  onChange={(e) => set("customer_last_name", e.target.value)}
                  className="h-11"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Email">
                <Input
                  type="email"
                  value={form.customer_email ?? ""}
                  onChange={(e) => set("customer_email", e.target.value)}
                  className="h-11"
                />
              </Field>
              <Field label="Téléphone">
                <Input
                  type="tel"
                  value={form.customer_phone ?? ""}
                  onChange={(e) => set("customer_phone", e.target.value)}
                  className="h-11"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="La sortie">
            <Field label="Offre">
              <Input value={form.offer_name ?? ""} onChange={(e) => set("offer_name", e.target.value)} className="h-11" />
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
              <Field label="Date de sortie" className="col-span-2 sm:col-span-1">
                <Input
                  type="date"
                  value={form.date ?? ""}
                  onChange={(e) => set("date", e.target.value || null)}
                  className="h-11"
                />
              </Field>
              <Field label="Début">
                <Input
                  type="time"
                  value={form.start_time ?? ""}
                  onChange={(e) => set("start_time", e.target.value || null)}
                  className="h-11"
                />
              </Field>
              <Field label="Fin">
                <Input
                  type="time"
                  value={form.end_time ?? ""}
                  onChange={(e) => set("end_time", e.target.value || null)}
                  className="h-11"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Personnes">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.party_size ?? ""}
                  onChange={(e) => set("party_size", e.target.value === "" ? null : Number(e.target.value))}
                  className="h-11"
                />
              </Field>
              <Field label="Montant">
                <EuroInput
                  value={form.total_amount == null ? "" : String(form.total_amount)}
                  onChange={(v) => set("total_amount", v === "" ? null : Number(v))}
                />
              </Field>
            </div>
            <div className="grid gap-2">
              <span className="t-label text-ink-2">Statut</span>
              <ChoicePills
                label="Statut"
                options={STATUS_OPTIONS.map(([value, label]) => ({ value, label }))}
                value={form.status ?? ""}
                onChange={(v) => set("status", v)}
              />
            </div>
          </FormSection>

          <FormSection title="Promotion appliquée">
            <div className="grid grid-cols-[8rem_1fr] gap-3">
              <Field label="Remise">
                <EuroInput
                  value={form.discount_amount == null ? "" : String(form.discount_amount)}
                  onChange={(v) => set("discount_amount", v === "" ? null : Number(v))}
                  placeholder="0"
                />
              </Field>
              <Field label="Raison">
                <Input
                  placeholder="Cliente fidèle, promo printemps…"
                  value={form.discount_reason ?? ""}
                  onChange={(e) => set("discount_reason", e.target.value)}
                  className="h-11"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Paiements">
            <div className="vitre-inset grid gap-3 rounded-[22px] p-4">
              <ToggleRow
                checked={form.deposit_paid ?? false}
                onChange={(v) => set("deposit_paid", v)}
                label="Acompte encaissé"
                aside={
                  <EuroInput
                    ariaLabel="Montant de l'acompte"
                    className="w-28"
                    value={form.deposit_amount == null ? "" : String(form.deposit_amount)}
                    onChange={(v) => set("deposit_amount", v === "" ? null : Number(v))}
                  />
                }
              />

              {payments.length > 0 && (
                <ul className="grid gap-1.5">
                  {payments.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-full bg-white/80 py-1 pr-1 pl-4 text-[13.5px] shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.05)]"
                    >
                      <span className="flex items-center gap-2 text-foreground">
                        <Check className="size-3.5 text-success" />
                        {paymentLabel(p.method)}
                        <Num className="n-inline text-ink-2">{formatEur(p.amount)}</Num>
                      </span>
                      <button
                        type="button"
                        title="Annuler ce paiement"
                        aria-label={`Annuler le paiement ${paymentLabel(p.method)} de ${formatEur(p.amount)}`}
                        onClick={() => handleRemovePayment(i)}
                        disabled={pending}
                        className="grid size-9 place-items-center rounded-full text-ink-3 transition-colors hover:bg-[rgba(224,77,85,0.1)] hover:text-danger disabled:opacity-50"
                      >
                        {removingIndex === i ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {liveBalanceDue > 0 && (
                <div className="grid gap-2 border-t border-[var(--hairline)] pt-3">
                  <span className="t-label text-ink-2">Encaisser maintenant</span>
                  {newLines.map((line, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select
                        value={line.method}
                        onValueChange={(v) => updateNewLine(i, { method: (v as string) ?? "" })}
                      >
                        <SelectTrigger className="h-11 min-w-0 flex-1 bg-white" aria-label={`Moyen de paiement ${i + 1}`}>
                          <SelectValue>{(val) => (val ? paymentLabel(val as string) : "Choisir")}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <EuroInput
                        ariaLabel={`Montant ${i + 1}`}
                        className="w-28 shrink-0"
                        value={line.amount}
                        onChange={(v) => updateNewLine(i, { amount: v })}
                        placeholder="0"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={() => removeNewLine(i)}
                        disabled={newLines.length <= 1}
                        aria-label="Retirer ce moyen"
                        className="size-11 shrink-0"
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {newLines.length < 4 ? (
                      <Button variant="ghost" type="button" onClick={addNewLine} className="h-10">
                        <Plus /> Ajouter un moyen
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Button variant="secondary" type="button" onClick={handleAddPayments} disabled={pending} className="h-10">
                      {addingPayment ? <Loader2 className="animate-spin" /> : <Wallet />}
                      Encaisser
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-baseline justify-between border-t border-[var(--hairline)] pt-3">
                <span className="t-label text-ink-2">Solde restant dû</span>
                <Num className={cn("n-inline text-[20px]", liveBalanceDue > 0 ? "text-foreground" : "text-success")}>
                  {formatEur(liveBalanceDue)}
                </Num>
              </div>
            </div>
          </FormSection>

          <Field label="D'où nous a-t-il connu ?" required>
            <Select
              value={form.source_channel ?? ""}
              onValueChange={(v) => set("source_channel", (v as string) ?? "")}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue>{(value) => (value ? SOURCE_LABEL[value as string] : "Sélectionner…")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1">
            {booking && (
              <Link
                href={`/contrats/${booking.id}`}
                target="_blank"
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-2 transition-colors hover:bg-white/70 hover:text-foreground"
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
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-success transition-colors hover:bg-[rgba(15,159,110,0.08)] disabled:opacity-50"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                Réactiver la réservation
              </button>
            )}
            {booking && booking.status !== "cancelled" && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-danger transition-colors hover:bg-[rgba(224,77,85,0.08)]"
              >
                <Trash2 className="size-4" />
                Annuler la réservation
              </button>
            )}
            {booking && confirmDelete && (
              <span className="inline-flex flex-wrap items-center gap-2 pl-2 text-[13px]">
                <span className="text-ink-2">Confirmer l&apos;annulation&nbsp;?</span>
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={pending} className="h-9">
                  {pending && <Loader2 className="animate-spin" />}
                  Oui, annuler
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={pending} className="h-9">
                  Non
                </Button>
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <DialogClose render={<Button variant="outline" className="h-11 sm:h-10" />}>Fermer</DialogClose>
            <Button onClick={handleSave} disabled={pending} className="h-11 sm:h-10 sm:px-5">
              {pending && <Loader2 className="animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
