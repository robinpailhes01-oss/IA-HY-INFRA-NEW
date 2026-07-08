"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Loader2, Trash2 } from "lucide-react";
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
  updateBooking,
  type BookingUpdate,
} from "@/app/(dashboard)/bookings/actions";
import { SOURCE_OPTIONS } from "@/lib/status";

export type EditableBooking = {
  id: string;
  customerName: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  offerName: string | null;
  sourceChannel: string | null;
  partySize: number | null;
  totalAmount: number | null;
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
  const [confirmDelete, setConfirmDelete] = useState(false);
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
  });

  useEffect(() => {
    if (booking && open) {
      setConfirmDelete(false);
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
        toast.error("Échec de la suppression", { description: res.error ?? undefined });
        return;
      }
      toast.success("Réservation supprimée", {
        description: "Retirée de Google Agenda.",
      });
      setConfirmDelete(false);
      onOpenChange(false);
      router.refresh();
    });
  }

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
            {booking && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-sm text-destructive transition-colors hover:underline"
              >
                <Trash2 className="size-4" />
                Supprimer
              </button>
            )}
            {booking && confirmDelete && (
              <span className="inline-flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Confirmer&nbsp;?</span>
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  Oui, supprimer
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
