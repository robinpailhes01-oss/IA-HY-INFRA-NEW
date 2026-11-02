"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, Loader2, Plus } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { AmountField, ChoicePills } from "@/components/finance/form-bits";
import { addRevenue } from "@/app/(dashboard)/finances/actions";

// Les mêmes clés que la colonne revenues.type.
const TYPES: Array<{ value: string; label: string }> = [
  { value: "sea_trip", label: "Sortie en mer" },
  { value: "unusual_night", label: "Nuit insolite" },
  { value: "efoil", label: "E-Foil" },
  { value: "other", label: "Autre" },
];

export function AddRevenueDialog({
  variant = "outline",
  className,
}: {
  variant?: "default" | "outline";
  className?: string;
} = {}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    date: today,
    type: "sea_trip",
    amount: "",
    note: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    if (pending) return;
    const amount = Number(form.amount) || 0;
    if (!(amount > 0)) {
      toast.error("Saisis un montant valide.");
      return;
    }
    startTransition(async () => {
      const res = await addRevenue({
        date: form.date,
        type: form.type,
        amount,
        note: form.note || null,
      });
      if (!res.ok) {
        toast.error("Échec de l'ajout", { description: res.error ?? undefined });
        return;
      }
      toast.success("Revenu ajouté");
      setOpen(false);
      setForm({ date: today, type: "sea_trip", amount: "", note: "" });
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} size="sm" className={className} />}>
        <Plus /> Revenu
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-10">
          <span className="mb-1 grid size-10 place-items-center rounded-full bg-[rgba(15,159,110,0.1)] text-success">
            <ArrowDownLeft className="size-[18px]" />
          </span>
          <DialogTitle className="t-serif font-serif text-[28px] font-normal leading-tight text-foreground">
            Un revenu
          </DialogTitle>
          <DialogDescription className="text-ink-2">
            Pour l&apos;historique : les réservations du site et de l&apos;agenda arrivent toutes seules.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <AmountField
            id="revenue-amount"
            value={form.amount}
            onChange={(v) => set("amount", v)}
            onSubmit={handleSave}
          />

          <div className="grid gap-2">
            <Label className="t-label text-ink-2">Type</Label>
            <ChoicePills label="Type de revenu" options={TYPES} value={form.type} onChange={(v) => set("type", v)} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10.5rem_1fr]">
            <div className="grid gap-1.5">
              <Label htmlFor="revenue-date" className="t-label text-ink-2">
                Date
              </Label>
              <Input
                id="revenue-date"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="revenue-note" className="t-label text-ink-2">
                Note <span className="font-normal text-ink-3">(optionnel)</span>
              </Label>
              <Input
                id="revenue-note"
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                placeholder="Ex. sortie 3 h, famille Dupont"
                className="h-11"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-11 sm:h-10" />}>Annuler</DialogClose>
          <Button onClick={handleSave} disabled={pending} className="h-11 sm:h-10 sm:px-5">
            {pending && <Loader2 className="animate-spin" />}
            Ajouter le revenu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
