"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, Plus } from "lucide-react";
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
import { addExpense } from "@/app/(dashboard)/finances/actions";

// Les mêmes clés que la colonne expenses.category.
const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "subscription", label: "Abonnement" },
  { value: "fuel", label: "Gasoil" },
  { value: "maintenance", label: "Entretien" },
  { value: "marketing", label: "Marketing" },
  { value: "fixed_monthly", label: "Mensualité fixe" },
  { value: "tools", label: "Outils" },
  { value: "subcontract", label: "Sous-traitance" },
  { value: "salary", label: "Salaire" },
  { value: "taxes", label: "Taxes" },
  { value: "savings", label: "Épargne" },
  { value: "other", label: "Autre" },
];

export function AddExpenseDialog({
  variant = "outline",
  className,
}: {
  /** Matière du bouton : verre (défaut, la Vue d'ensemble) ou marine. */
  variant?: "default" | "outline";
  className?: string;
} = {}) {
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
    if (pending) return;
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
      <DialogTrigger render={<Button variant={variant} size="sm" className={className} />}>
        <Plus /> Dépense
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-10">
          <span className="mb-1 grid size-10 place-items-center rounded-full bg-[rgba(11,37,69,0.06)] text-navy">
            <ArrowUpRight className="size-[18px]" />
          </span>
          <DialogTitle className="t-serif font-serif text-[28px] font-normal leading-tight text-foreground">
            Une dépense
          </DialogTitle>
          <DialogDescription className="text-ink-2">
            Les rentrées (acomptes et soldes) arrivent toutes seules — ne saisis ici que ce qui sort.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <AmountField
            id="expense-amount"
            value={form.amount}
            onChange={(v) => set("amount", v)}
            onSubmit={handleSave}
          />

          <div className="grid gap-2">
            <Label className="t-label text-ink-2">Catégorie</Label>
            <ChoicePills
              label="Catégorie"
              options={CATEGORIES}
              value={form.category}
              onChange={(v) => set("category", v)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10.5rem_1fr]">
            <div className="grid gap-1.5">
              <Label htmlFor="expense-date" className="t-label text-ink-2">
                Date
              </Label>
              <Input
                id="expense-date"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="expense-description" className="t-label text-ink-2">
                Description <span className="font-normal text-ink-3">(optionnel)</span>
              </Label>
              <Input
                id="expense-description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Ex. plein de gasoil"
                className="h-11"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-11 sm:h-10" />}>Annuler</DialogClose>
          <Button onClick={handleSave} disabled={pending} className="h-11 sm:h-10 sm:px-5">
            {pending && <Loader2 className="animate-spin" />}
            Ajouter la dépense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
