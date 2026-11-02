"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import { createBooking, type BookingCreate } from "@/app/(dashboard)/bookings/actions";
import { SOURCE_OPTIONS } from "@/lib/status";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChoicePills, EuroInput, Field, FormSection, ToggleRow } from "@/components/finance/form-bits";

const OFFER_OPTIONS: { value: string; label: string; type: string }[] = [
  { value: "Sortie privative 3h", label: "Sortie privative 3h", type: "sortie_privative" },
  { value: "Sortie privative 4h", label: "Sortie privative 4h", type: "sortie_privative" },
  { value: "Sortie privative 6h", label: "Sortie privative 6h", type: "sortie_privative" },
  { value: "Nuit insolite", label: "Nuit insolite", type: "nuit_insolite" },
  { value: "Nuit prestige", label: "Nuit prestige", type: "nuit_prestige" },
  { value: "E-Foil 1h", label: "E-Foil 1h", type: "efoil" },
  { value: "E-Foil 2h", label: "E-Foil 2h", type: "efoil" },
  { value: "__autre__", label: "Autre…", type: "sortie_privative" },
];

const STATUS_OPTIONS: [string, string][] = [
  ["confirmed", "Confirmée"],
  ["pending", "En attente"],
  ["completed", "Terminée"],
  ["cancelled", "Annulée"],
];

const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCE_OPTIONS);

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
    if (pending) return;
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
    if (!form.source_channel) {
      toast.error("Le canal d'acquisition est requis.", {
        description: "Choisissez la source ou « Je ne sais pas ».",
      });
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="pr-10">
          <span className="mb-1 grid size-10 place-items-center rounded-full bg-[rgba(34,167,191,0.12)] text-aqua">
            <CalendarPlus className="size-[18px]" />
          </span>
          <DialogTitle className="t-serif font-serif text-[28px] font-normal leading-tight text-foreground">
            Nouvelle réservation
          </DialogTitle>
          <DialogDescription className="text-ink-2">
            Le client, la sortie, le paiement — dans cet ordre.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          <FormSection title="Le client">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom" required>
                <Input
                  value={form.first_name}
                  onChange={(e) => set("first_name", e.target.value)}
                  placeholder="Alice"
                  className="h-11"
                />
              </Field>
              <Field label="Nom" required>
                <Input
                  value={form.last_name}
                  onChange={(e) => set("last_name", e.target.value)}
                  placeholder="Dupont"
                  className="h-11"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="alice@exemple.fr"
                  className="h-11"
                />
              </Field>
              <Field label="Téléphone">
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+33 6 00 00 00 00"
                  className="h-11"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="La sortie">
            <div className="grid gap-2">
              <span className="t-label text-ink-2">Offre</span>
              <ChoicePills
                label="Offre"
                options={OFFER_OPTIONS}
                value={form.offer_key}
                onChange={(v) => handleOfferChange(v)}
              />
            </div>
            {form.offer_key === "__autre__" && (
              <Field label="Nom de l'offre">
                <Input
                  value={form.offer_custom}
                  onChange={(e) => set("offer_custom", e.target.value)}
                  placeholder="Ex. Sortie apéro 2h"
                  className="h-11"
                />
              </Field>
            )}
            {/* Téléphone : date + personnes, puis début + fin. Bureau : une
                seule rangée, la date d'abord. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.4fr_1fr_1fr_0.9fr]">
              <Field label="Date" required>
                <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="h-11" />
              </Field>
              <Field label="Personnes" className="sm:order-last">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.party_size}
                  onChange={(e) => set("party_size", e.target.value)}
                  placeholder="4"
                  className="h-11"
                />
              </Field>
              <Field label="Début">
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => set("start_time", e.target.value)}
                  className="h-11"
                />
              </Field>
              <Field label="Fin">
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => set("end_time", e.target.value)}
                  className="h-11"
                />
              </Field>
            </div>
            <div className="grid gap-2">
              <span className="t-label text-ink-2">Statut</span>
              <ChoicePills
                label="Statut"
                options={STATUS_OPTIONS.map(([value, label]) => ({ value, label }))}
                value={form.status}
                onChange={(v) => set("status", v)}
              />
            </div>
          </FormSection>

          <FormSection title="Le paiement">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Montant total" required>
                <EuroInput
                  value={form.total_amount}
                  onChange={(v) => set("total_amount", v)}
                  placeholder="550"
                />
              </Field>
              <Field label="Acompte">
                <EuroInput
                  value={form.deposit_amount}
                  onChange={(v) => set("deposit_amount", v)}
                  placeholder="200"
                />
              </Field>
            </div>
            <ToggleRow
              checked={form.deposit_paid}
              onChange={(v) => set("deposit_paid", v)}
              label="Acompte encaissé"
              aside={
                totalNum > 0 ? (
                  <span className="text-[12.5px] text-ink-3">
                    Solde restant
                    <Num
                      className={cn(
                        "n-inline block text-[15px]",
                        balanceDue > 0 ? "text-foreground" : "text-success",
                      )}
                    >
                      {formatEur(balanceDue)}
                    </Num>
                  </span>
                ) : undefined
              }
            />
            <Field label="Canal d'acquisition" required>
              <Select
                value={form.source_channel}
                onValueChange={(v) => set("source_channel", (v as string) ?? "")}
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue>
                    {(val) =>
                      val ? SOURCE_LABEL[val as string] ?? (val as string) : "Comment t'a-t-il trouvé ?"
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
            </Field>
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Ex. anniversaire, demande spéciale…"
                rows={2}
              />
            </Field>
          </FormSection>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-11 sm:h-10" />}>Annuler</DialogClose>
          <Button onClick={handleSave} disabled={pending} className="h-11 sm:h-10 sm:px-5">
            {pending && <Loader2 className="animate-spin" />}
            Créer la réservation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
