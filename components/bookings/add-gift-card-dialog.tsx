"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createGiftCard, type GiftCardCreate } from "@/app/(dashboard)/bookings/actions";

type Form = {
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_email: string;
  buyer_phone: string;
  recipient_name: string;
  amount: string;
  offer_name: string;
  notes: string;
};

const EMPTY: Form = {
  buyer_first_name: "",
  buyer_last_name: "",
  buyer_email: "",
  buyer_phone: "",
  recipient_name: "",
  amount: "",
  offer_name: "",
  notes: "",
};

export function AddGiftCardDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Form>(EMPTY);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    const amount = Number(form.amount);
    if (!form.buyer_first_name.trim() || !form.buyer_last_name.trim()) {
      toast.error("Prénom et nom de l'acheteur requis.");
      return;
    }
    if (!(amount > 0)) {
      toast.error("Le montant doit être supérieur à 0.");
      return;
    }

    const payload: GiftCardCreate = {
      buyer_first_name: form.buyer_first_name,
      buyer_last_name: form.buyer_last_name,
      buyer_email: form.buyer_email.trim() || null,
      buyer_phone: form.buyer_phone.trim() || null,
      recipient_name: form.recipient_name.trim() || null,
      amount,
      offer_name: form.offer_name.trim() || null,
      notes: form.notes.trim() || null,
    };

    startTransition(async () => {
      try {
        const res = await createGiftCard(payload);
        if (!res.ok) {
          toast.error("Échec", { description: res.error ?? undefined });
          return;
        }
        toast.success(`Carte cadeau créée — code ${res.code}`, { duration: 8000 });
        setOpen(false);
        setForm(EMPTY);
        router.refresh();
      } catch (err) {
        toast.error("Erreur inattendue", {
          description: err instanceof Error ? err.message : "Veuillez réessayer.",
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Gift /> Carte cadeau
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle carte cadeau</DialogTitle>
          <DialogDescription>
            La carte est marquée payée immédiatement. Tu ajouteras la date plus
            tard quand le bénéficiaire viendra réserver.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Acheteur (qui paie)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Prénom *</Label>
                <Input
                  value={form.buyer_first_name}
                  onChange={(e) => set("buyer_first_name", e.target.value)}
                  placeholder="Alice"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Nom *</Label>
                <Input
                  value={form.buyer_last_name}
                  onChange={(e) => set("buyer_last_name", e.target.value)}
                  placeholder="Dupont"
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.buyer_email}
                  onChange={(e) => set("buyer_email", e.target.value)}
                  placeholder="alice@exemple.fr"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Téléphone</Label>
                <Input
                  type="tel"
                  value={form.buyer_phone}
                  onChange={(e) => set("buyer_phone", e.target.value)}
                  placeholder="+33 6 00 00 00 00"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <Label className="text-xs">Bénéficiaire (si différent de l&apos;acheteur)</Label>
            <Input
              value={form.recipient_name}
              onChange={(e) => set("recipient_name", e.target.value)}
              placeholder="Bob Dupont"
            />
            <p className="text-[11px] text-muted-foreground">
              Laisse vide si l&apos;acheteur garde la carte pour lui.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Montant (€) *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="400"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Prestation pré-choisie</Label>
              <Input
                value={form.offer_name}
                onChange={(e) => set("offer_name", e.target.value)}
                placeholder="Sortie 2h, libre…"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Ex. anniversaire de Bob, validité 1 an…"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Vendre la carte cadeau
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
