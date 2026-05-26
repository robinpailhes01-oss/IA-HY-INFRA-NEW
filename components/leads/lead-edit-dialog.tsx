"use client";

import * as React from "react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateLead, type LeadUpdate } from "@/app/(dashboard)/leads/actions";
import { SOURCE_OPTIONS } from "@/lib/status";

export type EditableLead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source_channel: string | null;
  interested_offer: string | null;
  score: number | null;
  status: string | null;
  needs_human_intervention: boolean | null;
};

const STATUS_OPTIONS: [string, string][] = [
  ["new", "Nouveau"],
  ["contacted", "Contacté"],
  ["qualified", "Qualifié"],
  ["quote_sent", "Devis envoyé"],
  ["followed_up", "Relancé"],
  ["booked", "Réservé"],
  ["lost", "Perdu"],
];

const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCE_OPTIONS);
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS);

function emptyForm(): LeadUpdate {
  return {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    source_channel: "",
    interested_offer: "",
    score: null,
    status: "",
    needs_human_intervention: false,
  };
}

export function LeadEditDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: EditableLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<LeadUpdate>(emptyForm());

  useEffect(() => {
    if (lead && open) {
      setForm({
        first_name: lead.first_name ?? "",
        last_name: lead.last_name ?? "",
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        source_channel: lead.source_channel ?? "",
        interested_offer: lead.interested_offer ?? "",
        score: lead.score ?? null,
        status: lead.status ?? "",
        needs_human_intervention: lead.needs_human_intervention ?? false,
      });
    }
  }, [lead, open]);

  function set<K extends keyof LeadUpdate>(key: K, value: LeadUpdate[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    if (!lead) return;
    startTransition(async () => {
      const payload: LeadUpdate = {
        ...form,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        email: form.email || null,
        phone: form.phone || null,
        source_channel: form.source_channel || null,
        interested_offer: form.interested_offer || null,
        status: form.status || null,
      };
      const res = await updateLead(lead.id, payload);
      if (!res.ok) {
        toast.error("Échec de l'enregistrement", {
          description: res.error ?? undefined,
        });
        return;
      }
      toast.success("Lead mis à jour");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le lead</DialogTitle>
          <DialogDescription>
            Mets à jour les informations et la provenance du prospect.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <Input
                value={form.first_name ?? ""}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </Field>
            <Field label="Nom">
              <Input
                value={form.last_name ?? ""}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Téléphone">
              <Input
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
          </div>

          <Field label="D'où nous a-t-il connu ?">
            <Select
              value={form.source_channel ?? ""}
              onValueChange={(v) => set("source_channel", (v as string) ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) =>
                    value ? SOURCE_LABEL[value as string] : "Sélectionner…"
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Statut">
              <Select
                value={form.status ?? ""}
                onValueChange={(v) => set("status", (v as string) ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) =>
                      value ? STATUS_LABEL[value as string] : "Sélectionner…"
                    }
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
            </Field>
            <Field label="Score (0–10)">
              <Input
                type="number"
                min={0}
                max={10}
                value={form.score ?? ""}
                onChange={(e) =>
                  set(
                    "score",
                    e.target.value === ""
                      ? null
                      : Math.max(0, Math.min(10, Number(e.target.value))),
                  )
                }
              />
            </Field>
          </div>

          <Field label="Offre d'intérêt">
            <Input
              value={form.interested_offer ?? ""}
              onChange={(e) => set("interested_offer", e.target.value)}
            />
          </Field>

          <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <span className="text-sm font-medium text-foreground">
              À rappeler (intervention humaine)
            </span>
            <Switch
              checked={form.needs_human_intervention}
              onCheckedChange={(c) => set("needs_human_intervention", c)}
            />
          </label>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
