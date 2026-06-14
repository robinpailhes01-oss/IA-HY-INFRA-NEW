"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
  updateBooking,
  type BookingUpdate,
} from "@/app/(dashboard)/bookings/actions";
import { SOURCE_OPTIONS } from "@/lib/status";

export type EditableBooking = {
  id: string;
  customerName: string;
  date: string;
  offerName: string | null;
  sourceChannel: string | null;
  partySize: number | null;
  status: string | null;
  discountAmount: number | null;
  discountReason: string | null;
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
  const [form, setForm] = useState<BookingUpdate>({
    source_channel: "",
    status: "",
    party_size: null,
    offer_name: "",
    discount_amount: null,
    discount_reason: "",
  });

  useEffect(() => {
    if (booking && open) {
      setForm({
        source_channel: booking.sourceChannel ?? "",
        status: booking.status ?? "",
        party_size: booking.partySize ?? null,
        offer_name: booking.offerName ?? "",
        discount_amount: booking.discountAmount,
        discount_reason: booking.discountReason ?? "",
      });
    }
  }, [booking, open]);

  function set<K extends keyof BookingUpdate>(key: K, value: BookingUpdate[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    if (!booking) return;
    startTransition(async () => {
      const res = await updateBooking(booking.id, {
        source_channel: form.source_channel || null,
        status: form.status || null,
        party_size: form.party_size,
        offer_name: form.offer_name || null,
        discount_amount: form.discount_amount,
        discount_reason: form.discount_reason || null,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier la réservation</DialogTitle>
          <DialogDescription>
            {booking ? booking.customerName : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>D&apos;où nous a-t-il connu ?</Label>
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

          <div className="grid grid-cols-2 gap-3">
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

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
