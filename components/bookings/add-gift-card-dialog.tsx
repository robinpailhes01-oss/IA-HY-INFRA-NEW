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
import { AmountField, Field, FormSection } from "@/components/finance/form-bits";
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
    if (pending) return;
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-10">
          <span className="mb-1 grid size-10 place-items-center rounded-full bg-[rgba(164,126,44,0.12)] text-gold">
            <Gift className="size-[18px]" />
          </span>
          <DialogTitle className="t-serif font-serif text-[28px] font-normal leading-tight text-foreground">
            Une carte cadeau
          </DialogTitle>
          <DialogDescription className="text-ink-2">
            Elle est marquée payée tout de suite. La date viendra plus tard, quand le bénéficiaire réservera.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <AmountField
            id="gift-amount"
            value={form.amount}
            onChange={(v) => set("amount", v)}
            onSubmit={handleSave}
            label="Montant de la carte"
          />

          <FormSection title="L'acheteur · celui qui paie">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom" required>
                <Input
                  value={form.buyer_first_name}
                  onChange={(e) => set("buyer_first_name", e.target.value)}
                  placeholder="Alice"
                  className="h-11"
                />
              </Field>
              <Field label="Nom" required>
                <Input
                  value={form.buyer_last_name}
                  onChange={(e) => set("buyer_last_name", e.target.value)}
                  placeholder="Dupont"
                  className="h-11"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Email">
                <Input
                  type="email"
                  value={form.buyer_email}
                  onChange={(e) => set("buyer_email", e.target.value)}
                  placeholder="alice@exemple.fr"
                  className="h-11"
                />
              </Field>
              <Field label="Téléphone">
                <Input
                  type="tel"
                  value={form.buyer_phone}
                  onChange={(e) => set("buyer_phone", e.target.value)}
                  placeholder="+33 6 00 00 00 00"
                  className="h-11"
                />
              </Field>
            </div>
          </FormSection>

          <div className="vitre-inset grid gap-1.5 rounded-[20px] p-4">
            <Label className="t-label text-ink-2">Bénéficiaire, si ce n&apos;est pas l&apos;acheteur</Label>
            <Input
              value={form.recipient_name}
              onChange={(e) => set("recipient_name", e.target.value)}
              placeholder="Bob Dupont"
              className="h-11 bg-white"
            />
            <p className="t-caption text-ink-3">Laisse vide si l&apos;acheteur garde la carte pour lui.</p>
          </div>

          <Field label="Prestation pré-choisie">
            <Input
              value={form.offer_name}
              onChange={(e) => set("offer_name", e.target.value)}
              placeholder="Sortie 2 h, libre…"
              className="h-11"
            />
          </Field>

          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Ex. anniversaire de Bob, validité 1 an…"
              rows={2}
            />
          </Field>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-11 sm:h-10" />}>Annuler</DialogClose>
          <Button onClick={handleSave} disabled={pending} className="h-11 sm:h-10 sm:px-5">
            {pending && <Loader2 className="animate-spin" />}
            Vendre la carte cadeau
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
