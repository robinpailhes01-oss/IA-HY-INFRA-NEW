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
import { addExpense } from "@/app/(dashboard)/finances/actions";

const CATEGORIES: [string, string][] = [
  ["subscription", "Abonnement"],
  ["marketing", "Marketing"],
  ["fuel", "Gasoil"],
  ["maintenance", "Entretien"],
  ["tools", "Outils"],
  ["subcontract", "Sous traitance"],
  ["fixed_monthly", "Mensualité fixe"],
  ["salary", "Salaire"],
  ["taxes", "Taxes"],
  ["savings", "Épargne"],
  ["other", "Autre"],
];
const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES);

export function AddExpenseDialog() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    date: today,
    category: "subscription",
    amount: "",
    description: "",
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
      const res = await addExpense({
        date: form.date,
        category: form.category,
        amount,
        description: form.description || null,
      });
      if (!res.ok) {
        toast.error("Échec de l'ajout", { description: res.error ?? undefined });
        return;
      }
      toast.success("Dépense ajoutée");
      setOpen(false);
      setForm({ date: today, category: "subscription", amount: "", description: "" });
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus /> Dépense
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une dépense</DialogTitle>
          <DialogDescription>
            Les rentrées (acomptes & soldes) sont automatiques — saisis seulement les dépenses.
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
            <Label>Catégorie</Label>
            <Select value={form.category} onValueChange={(v) => set("category", (v as string) ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(val) => (val ? CAT_LABEL[val as string] : "Choisir")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Description (optionnel)</Label>
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Ex. plein de carburant"
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
