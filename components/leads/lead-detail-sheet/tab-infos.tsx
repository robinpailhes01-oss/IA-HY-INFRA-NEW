"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { SOURCE_OPTIONS } from "@/lib/status";
import {
  LEAD_COLUMNS,
  SOURCE_STATUS_LABEL,
  STATUS_LABEL,
  type Lead,
} from "@/lib/leads";
import {
  updateLeadFields,
  type LeadFieldsUpdate,
} from "@/app/(dashboard)/leads/actions";

const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCE_OPTIONS);

export function TabInfos({
  lead,
  onPatch,
}: {
  lead: Lead;
  onPatch: (patch: Partial<Lead>) => void;
}) {
  const [form, setForm] = useState(lead);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setForm(lead);
  }, [lead]);

  async function commit(patch: LeadFieldsUpdate & Partial<Lead>) {
    setStatus("saving");
    const res = await updateLeadFields(lead.id, patch);
    if (!res.ok) {
      setStatus("idle");
      toast.error("Échec de l'enregistrement", { description: res.error });
      return;
    }
    onPatch(patch);
    setStatus("saved");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setStatus("idle"), 1600);
  }

  function setField<K extends keyof Lead>(key: K, value: Lead[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Valide un champ texte au blur s'il a changé. */
  function commitText(key: keyof Lead, raw: string) {
    const value = raw.trim() === "" ? null : raw.trim();
    if (value === (lead[key] ?? null)) return;
    commit({ [key]: value } as LeadFieldsUpdate);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-4 items-center justify-end text-xs text-muted-foreground">
        {status === "saving" && (
          <span className="flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" /> Enregistrement…
          </span>
        )}
        {status === "saved" && (
          <span className="flex items-center gap-1 text-success">
            <Check className="size-3" /> Enregistré
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom">
          <Input
            value={form.first_name ?? ""}
            onChange={(e) => setField("first_name", e.target.value)}
            onBlur={(e) => commitText("first_name", e.target.value)}
          />
        </Field>
        <Field label="Nom">
          <Input
            value={form.last_name ?? ""}
            onChange={(e) => setField("last_name", e.target.value)}
            onBlur={(e) => commitText("last_name", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Téléphone">
          <Input
            value={form.phone ?? ""}
            onChange={(e) => setField("phone", e.target.value)}
            onBlur={(e) => commitText("phone", e.target.value)}
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={form.email ?? ""}
            onChange={(e) => setField("email", e.target.value)}
            onBlur={(e) => commitText("email", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Canal">
          <Select
            value={form.source_channel ?? ""}
            onValueChange={(v) => {
              setField("source_channel", v as string);
              commit({ source_channel: v as string });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value) => (value ? SOURCE_LABEL[value as string] : "—")}
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
        <Field label="Statut du contact">
          <Select
            value={form.source_status ?? ""}
            onValueChange={(v) => {
              setField("source_status", v as string);
              commit({ source_status: v as string });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value) =>
                  value ? SOURCE_STATUS_LABEL[value as string] ?? (value as string) : "—"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SOURCE_STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Offre d'intérêt">
        <Input
          value={form.interested_offer ?? ""}
          onChange={(e) => setField("interested_offer", e.target.value)}
          onBlur={(e) => commitText("interested_offer", e.target.value)}
        />
      </Field>

      <Field label="Occasion">
        <Input
          value={form.occasion ?? ""}
          onChange={(e) => setField("occasion", e.target.value)}
          onBlur={(e) => commitText("occasion", e.target.value)}
          placeholder="Anniversaire, EVJF, séminaire…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date souhaitée">
          <Input
            type="date"
            value={form.desired_date ?? ""}
            onChange={(e) => {
              const value = e.target.value || null;
              setField("desired_date", value);
              commit({ desired_date: value });
            }}
          />
        </Field>
        <Field label="Créneau">
          <Input
            value={form.desired_time_slot ?? ""}
            onChange={(e) => setField("desired_time_slot", e.target.value)}
            onBlur={(e) => commitText("desired_time_slot", e.target.value)}
            placeholder="Coucher de soleil…"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre de personnes">
          <Input
            type="number"
            min={1}
            value={form.party_size ?? ""}
            onChange={(e) => setField("party_size", e.target.value === "" ? null : Number(e.target.value))}
            onBlur={(e) => {
              const value = e.target.value === "" ? null : Number(e.target.value);
              if (value === (lead.party_size ?? null)) return;
              commit({ party_size: value });
            }}
          />
        </Field>
        <Field label="Score (0–10)">
          <Input
            type="number"
            min={0}
            max={10}
            value={form.score ?? ""}
            onChange={(e) =>
              setField(
                "score",
                e.target.value === "" ? null : Math.max(0, Math.min(10, Number(e.target.value))),
              )
            }
            onBlur={(e) => {
              const value =
                e.target.value === ""
                  ? null
                  : Math.max(0, Math.min(10, Number(e.target.value)));
              if (value === (lead.score ?? null)) return;
              commit({ score: value });
            }}
          />
        </Field>
      </div>

      <Field label="Statut (colonne)">
        <Select
          value={form.status ?? ""}
          onValueChange={(v) => {
            setField("status", v as string);
            commit({ status: v as string });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(value) => (value ? STATUS_LABEL[value as string] ?? (value as string) : "—")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LEAD_COLUMNS.map((c) => (
              <SelectItem key={c.status} value={c.status}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <span className="text-sm font-medium text-foreground">Intervention humaine requise</span>
        <Switch
          checked={form.needs_human_intervention ?? false}
          onCheckedChange={(c) => {
            setField("needs_human_intervention", c);
            commit({ needs_human_intervention: c });
          }}
        />
      </label>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
