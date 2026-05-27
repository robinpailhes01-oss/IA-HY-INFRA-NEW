"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SOURCE_OPTIONS } from "@/lib/status";
import { createLead } from "@/app/(dashboard)/leads/actions";
import type { Lead } from "@/lib/leads";

const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCE_OPTIONS);

type FormState = {
  first_name: string;
  phone: string;
  interested_offer: string;
  source_channel: string;
};

const EMPTY: FormState = {
  first_name: "",
  phone: "",
  interested_offer: "",
  source_channel: "instagram_organic",
};

export function NewLeadSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (lead: Lead) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit() {
    if (!form.first_name.trim() || !form.phone.trim()) {
      toast.error("Le prénom et le téléphone sont requis");
      return;
    }
    startTransition(async () => {
      const res = await createLead({
        first_name: form.first_name,
        phone: form.phone,
        interested_offer: form.interested_offer || null,
        source_channel: form.source_channel,
      });
      if (!res.ok) {
        toast.error("Échec de la création", { description: res.error });
        return;
      }
      const now = new Date().toISOString();
      onCreated({
        id: res.data.id,
        first_name: form.first_name.trim(),
        last_name: null,
        email: null,
        phone: form.phone.trim(),
        source_channel: form.source_channel,
        source_status: "to_ask",
        interested_offer: form.interested_offer.trim() || null,
        occasion: null,
        party_size: null,
        desired_date: null,
        desired_time_slot: null,
        score: null,
        status: "qualified",
        needs_human_intervention: false,
        last_interaction_at: now,
        ai_memo: null,
        notes: null,
        created_at: now,
        archived: false,
      });
      toast.success("Lead créé", { description: "Ajouté dans la colonne Qualifié." });
      setForm(EMPTY);
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Nouveau lead</SheetTitle>
          <SheetDescription>Ajoute un prospect manuellement au pipeline.</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 p-4">
          <div className="grid gap-1.5">
            <Label>Prénom *</Label>
            <Input
              value={form.first_name}
              onChange={(e) => set("first_name", e.target.value)}
              placeholder="Sophie"
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Téléphone *</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+33 6 12 34 56 78"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Ce qu&apos;il recherche</Label>
            <Input
              value={form.interested_offer}
              onChange={(e) => set("interested_offer", e.target.value)}
              placeholder="Coucher de soleil, EVJF…"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Canal d&apos;acquisition</Label>
            <Select
              value={form.source_channel}
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
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Créer le lead
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
