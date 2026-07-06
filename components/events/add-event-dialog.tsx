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
import { Textarea } from "@/components/ui/textarea";
import { createEvent } from "@/app/(dashboard)/events/actions";

export function AddEventDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    title: "",
    theme: "",
    description: "",
    date: today,
    start_time: "",
    end_time: "",
    price_per_person: "",
    max_participants: "",
    sumup_payment_link: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    if (!form.title.trim()) {
      toast.error("Le titre est requis.");
      return;
    }
    if (!form.date) {
      toast.error("La date est requise.");
      return;
    }
    startTransition(async () => {
      const res = await createEvent({
        title: form.title.trim(),
        theme: form.theme.trim() || null,
        description: form.description.trim() || null,
        date: form.date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        price_per_person: form.price_per_person ? Number(form.price_per_person) : null,
        max_participants: form.max_participants ? Number(form.max_participants) : null,
        sumup_payment_link: form.sumup_payment_link.trim() || null,
      });
      if (!res.ok) {
        toast.error("Échec de la création", { description: res.error });
        return;
      }
      toast.success("Événement créé !");
      setOpen(false);
      setForm({ title: "", theme: "", description: "", date: today, start_time: "", end_time: "", price_per_person: "", max_participants: "", sumup_payment_link: "" });
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> Nouvel événement
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvel événement</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Titre *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Soirée DJ – Sunset" />
          </div>

          <div className="grid gap-1.5">
            <Label>Thème / sous-titre</Label>
            <Input value={form.theme} onChange={(e) => set("theme", e.target.value)} placeholder="DJ Set · Sunset · Boissons incluses" />
          </div>

          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Détails de l'événement…" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Début</Label>
              <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Fin</Label>
              <Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Prix / personne (€)</Label>
              <Input type="number" min={0} value={form.price_per_person} onChange={(e) => set("price_per_person", e.target.value)} placeholder="80" />
            </div>
            <div className="grid gap-1.5">
              <Label>Capacité max</Label>
              <Input type="number" min={1} value={form.max_participants} onChange={(e) => set("max_participants", e.target.value)} placeholder="20" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Lien de paiement SumUp (optionnel)</Label>
            <Input value={form.sumup_payment_link} onChange={(e) => set("sumup_payment_link", e.target.value)} placeholder="https://pay.sumup.com/…" />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
