"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addRevenue } from "@/app/(dashboard)/finances/actions";

const TYPES: [string, string][] = [
  ["sea_trip", "Sortie en mer"],
  ["unusual_night", "Nuit insolite"],
  ["other", "Autre"],
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPES);

export function AddRevenueDialog() {
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
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus /> Revenu
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un revenu</DialogTitle>
          <DialogDescription>
            Pour l&apos;historique. Les vraies réservations (site &amp; GCal) seront
            automatiques.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Montant (€)</Label>
              <Input
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => set("type", (v as string) ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(val) => (val ? TYPE_LABEL[val as string] : "Choisir")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TYPES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Note (optionnel)</Label>
            <Input
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Ex. sortie 3h Léa Dupont"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
