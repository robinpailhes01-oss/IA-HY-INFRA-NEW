"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import { createBooking, type BookingCreate } from "@/app/(dashboard)/bookings/actions";
import { SOURCE_OPTIONS } from "@/lib/status";
import { formatEur } from "@/lib/format";

const OFFER_OPTIONS: { value: string; label: string; type: string }[] = [
  { value: "Sortie privative 3h", label: "Sortie privative 3h", type: "sortie_privative" },
  { value: "Sortie privative 4h", label: "Sortie privative 4h", type: "sortie_privative" },
  { value: "Sortie privative 6h", label: "Sortie privative 6h", type: "sortie_privative" },
  { value: "Nuit insolite", label: "Nuit insolite", type: "nuit_insolite" },
  { value: "Nuit prestige", label: "Nuit prestige", type: "nuit_prestige" },
  { value: "__autre__", label: "Autre…", type: "sortie_privative" },
];

const STATUS_OPTIONS: [string, string][] = [
  ["confirmed", "Confirmée"],
  ["pending", "En attente"],
  ["completed", "Terminée"],
  ["cancelled", "Annulée"],
];

const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCE_OPTIONS);
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS);

type Form = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date: string;
  offer_key: string;
  offer_custom: string;
  start_time: string;
  end_time: string;
  party_size: string;
  total_amount: string;
  deposit_amount: string;
  deposit_paid: boolean;
  status: string;
  source_channel: string;
  notes: string;
};

const EMPTY: Omit<Form, "date"> = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  offer_key: "Sortie privative 4h",
  offer_custom: "",
  start_time: "",
  end_time: "",
  party_size: "",
  total_amount: "",
  deposit_amount: "",
  deposit_paid: false,
  status: "confirmed",
  source_channel: "",
  notes: "",
};

export function AddBookingDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Form>({
    ...EMPTY,
    date: new Date().toISOString().slice(0, 10),
  });

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleOfferChange(key: string | null) {
    if (!key) return;
    const opt = OFFER_OPTIONS.find((o) => o.value === key);
    const isNuit = opt?.type === "nuit_insolite" || opt?.type === "nuit_prestige";
    setForm((f) => ({
      ...f,
      offer_key: key,
      start_time: isNuit ? "17:00" : f.start_time,
      end_time: isNuit ? "12:00" : f.end_time,
    }));
  }

  const totalNum = Number(form.total_amount) || 0;
  const depositNum = Number(form.deposit_amount) || 0;
  const balanceDue = Math.max(0, totalNum - (form.deposit_paid ? depositNum : 0));

  const offerOpt = OFFER_OPTIONS.find((o) => o.value === form.offer_key);
  const offerName = form.offer_key === "__autre__" ? form.offer_custom : form.offer_key;
  const bookingType = offerOpt?.type ?? "sortie_privative";

  function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("Le prénom et le nom sont requis.");
      return;
    }
    if (!form.date) {
      toast.error("La date est requise.");
      return;
    }
    if (!(totalNum > 0)) {
      toast.error("Le montant total doit être supérieur à 0.");
      return;
    }

    const payload: BookingCreate = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      date: form.date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      offer_name: offerName.trim() || null,
      booking_type: bookingType,
      party_size: form.party_size ? Number(form.party_size) : null,
      total_amount: totalNum,
      deposit_amount: depositNum,
      deposit_paid: form.deposit_paid,
      source_channel: form.source_channel || null,
      status: form.status || "confirmed",
      notes: form.notes.trim() || null,
    };

    startTransition(async () => {
      const res = await createBooking(payload);
      if (!res.ok) {
        toast.error("Échec de la création", { description: res.error ?? undefined });
        return;
      }
      toast.success("Réservation créée !");
      setOpen(false);
      setForm({ ...EMPTY, date: new Date().toISOString().slice(0, 10) });
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> Nouvelle réservation
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle réservation</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Client */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Prénom *</Label>
              <Input
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                placeholder="Alice"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Nom *</Label>
              <Input
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
                placeholder="Dupont"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="alice@exemple.fr"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Téléphone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+33 6 00 00 00 00"
              />
            </div>
          </div>

          {/* Sortie */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Offre</Label>
              <Select value={form.offer_key} onValueChange={handleOfferChange}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(val) => {
                      const opt = OFFER_OPTIONS.find((o) => o.value === (val as string));
                      return opt?.label ?? (val as string) ?? "Choisir…";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {OFFER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.offer_key === "__autre__" && (
            <div className="grid gap-1.5">
              <Label>Nom de l&apos;offre</Label>
              <Input
                value={form.offer_custom}
                onChange={(e) => set("offer_custom", e.target.value)}
                placeholder="Ex. Sortie apéro 2h"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Heure de début</Label>
              <Input
                type="time"
                value={form.start_time}
                onChange={(e) => set("start_time", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Heure de fin</Label>
              <Input
                type="time"
                value={form.end_time}
                onChange={(e) => set("end_time", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Nb de personnes</Label>
              <Input
                type="number"
                min={1}
                value={form.party_size}
                onChange={(e) => set("party_size", e.target.value)}
                placeholder="4"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Statut</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", (v as string) ?? "confirmed")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(val) => STATUS_LABEL[val as string] ?? (val as string) ?? "Sélectionner…"}
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
          </div>

          {/* Finances */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Montant total (€) *</Label>
              <Input
                type="number"
                min={0}
                value={form.total_amount}
                onChange={(e) => set("total_amount", e.target.value)}
                placeholder="550"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Acompte (€)</Label>
              <Input
                type="number"
                min={0}
                value={form.deposit_amount}
                onChange={(e) => set("deposit_amount", e.target.value)}
                placeholder="200"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="deposit_paid"
              type="checkbox"
              checked={form.deposit_paid}
              onChange={(e) => set("deposit_paid", e.target.checked)}
              className="size-4 accent-primary"
            />
            <label htmlFor="deposit_paid" className="text-sm cursor-pointer select-none">
              Acompte encaissé
            </label>
            {totalNum > 0 && (
              <span className="ml-auto text-sm text-muted-foreground">
                Solde restant :{" "}
                <strong className={balanceDue > 0 ? "text-foreground" : "text-success"}>
                  {formatEur(balanceDue)}
                </strong>
              </span>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Canal d&apos;acquisition</Label>
            <Select
              value={form.source_channel}
              onValueChange={(v) => set("source_channel", (v as string) ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(val) =>
                    val ? SOURCE_LABEL[val as string] ?? (val as string) : "Sélectionner…"
                  }
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
            <Label>Notes (optionnel)</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Ex. anniversaire, demande spéciale…"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Créer la réservation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
