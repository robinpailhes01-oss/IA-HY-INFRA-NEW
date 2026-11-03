"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, Lock, LockOpen, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PillGroup } from "@/components/finance/pill-group";
import { ChoicePills, Field } from "@/components/finance/form-bits";
import {
  closeMonth,
  deleteRule,
  markVatFiled,
  reopenMonth,
  saveComptaSettings,
} from "@/app/(dashboard)/compta/actions";

export type ComptaView = "traiter" | "tva" | "cloture" | "reglages";

/** Les vues de la page, dans l'URL (?vue=…) pour qu'un lien rouvre la même. */
export function ComptaTabs({
  value,
  counts,
}: {
  value: ComptaView;
  counts: { traiter: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <PillGroup
      label="Vue de la comptabilité"
      value={value}
      onChange={(v) => {
        const next = new URLSearchParams(params.toString());
        if (v === "traiter") next.delete("vue");
        else next.set("vue", v);
        router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
      }}
      options={[
        { value: "traiter", label: "Journal", count: counts.traiter || undefined },
        { value: "tva", label: "TVA" },
        { value: "cloture", label: "Clôture et exports" },
        { value: "reglages", label: "Réglages" },
      ]}
    />
  );
}

export function YearSwitch({ year, years }: { year: number; years: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <PillGroup
      label="Exercice"
      value={String(year)}
      onChange={(v) => {
        const next = new URLSearchParams(params.toString());
        next.set("annee", v);
        router.push(`${pathname}?${next}`, { scroll: false });
      }}
      options={years.map((y) => ({ value: String(y), label: String(y) }))}
    />
  );
}

type VatTarget =
  | { kind: "ca3"; month: string }
  | { kind: "acompte_juillet" | "acompte_decembre" | "ca12"; year: number };

export function VatFiledButton({ target, amount, filed }: { target: VatTarget; amount: number; filed: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={filed ? "ghost" : "secondary"}
      size="sm"
      className="h-11 sm:h-8"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await markVatFiled(target, filed ? null : amount, filed);
          if (!res.ok) toast.error("Échec", { description: res.error });
          else {
            toast.success(filed ? "Déclaration remise à faire" : "Déclaration notée comme faite");
            router.refresh();
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : filed ? <Undo2 /> : <Check />}
      {filed ? "Annuler" : "Je l'ai déclarée"}
    </Button>
  );
}

export function CloseMonthButton({ month, closed, blocked }: { month: string; closed: boolean; blocked: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={closed ? "ghost" : "default"}
      size="sm"
      className="h-11 sm:h-8"
      disabled={pending || (!closed && blocked)}
      title={!closed && blocked ? "Classe tout et joins les justificatifs avant de clôturer." : undefined}
      onClick={() =>
        startTransition(async () => {
          if (closed && !window.confirm("Rouvrir ce mois ? Ses écritures redeviendront modifiables.")) return;
          const res = closed ? await reopenMonth(month) : await closeMonth(month);
          if (!res.ok) toast.error("Échec", { description: res.error });
          else {
            toast.success(closed ? "Mois rouvert" : "Mois clôturé");
            router.refresh();
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : closed ? <LockOpen /> : <Lock />}
      {closed ? "Rouvrir" : "Clôturer"}
    </Button>
  );
}

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export function SettingsForm({
  initial,
}: {
  initial: {
    siren: string | null;
    vat_regime: "normal" | "simplifie";
    vat_due_day: number;
    fiscal_year_start_month: number;
    previous_year_vat: number | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    siren: initial.siren ?? "",
    regime: initial.vat_regime,
    dueDay: String(initial.vat_due_day),
    start: String(initial.fiscal_year_start_month),
    prevVat: initial.previous_year_vat != null ? String(initial.previous_year_vat) : "",
  });

  function save() {
    startTransition(async () => {
      const res = await saveComptaSettings({
        siren: form.siren,
        vatRegime: form.regime,
        vatDueDay: Number(form.dueDay),
        fiscalYearStartMonth: Number(form.start),
        previousYearVat: form.prevVat.trim() === "" ? null : Number(form.prevVat.replace(",", ".")),
      });
      if (!res.ok) toast.error("Échec", { description: res.error });
      else {
        toast.success("Réglages enregistrés");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <span className="t-label text-ink-2">Régime de TVA</span>
        <ChoicePills
          label="Régime de TVA"
          value={form.regime}
          onChange={(v) => setForm((f) => ({ ...f, regime: v }))}
          options={[
            { value: "normal", label: "Réel normal · CA3 mensuelle" },
            { value: "simplifie", label: "Réel simplifié · CA12 annuelle" },
          ]}
        />
        <p className="t-caption text-ink-3">
          Ton régime est indiqué dans ton espace professionnel impots.gouv, rubrique « Mes services → Consulter mes
          obligations fiscales ».
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SIREN" hint="9 chiffres : il nomme le fichier FEC.">
          <Input inputMode="numeric" value={form.siren} onChange={(e) => setForm((f) => ({ ...f, siren: e.target.value }))} placeholder="123 456 789" />
        </Field>
        <Field label="Début de l'exercice">
          <select
            value={form.start}
            onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
            className="h-9 w-full rounded-full border border-[rgba(11,37,69,0.1)] bg-white/80 px-4 text-[14px] outline-none focus-visible:ring-4 focus-visible:ring-ocean/20 max-sm:h-11"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        {form.regime === "normal" ? (
          <Field label="Jour limite de la CA3" hint="Entre le 15 et le 24, selon ton espace pro.">
            <Input inputMode="numeric" value={form.dueDay} onChange={(e) => setForm((f) => ({ ...f, dueDay: e.target.value }))} />
          </Field>
        ) : (
          <Field label="TVA due l'an dernier (€)" hint="Base des acomptes de juillet (55 %) et décembre (40 %).">
            <Input inputMode="decimal" value={form.prevVat} onChange={(e) => setForm((f) => ({ ...f, prevVat: e.target.value }))} />
          </Field>
        )}
      </div>
      <Button onClick={save} disabled={pending} className="justify-self-start">
        {pending ? <Loader2 className="animate-spin" /> : <Check />}
        Enregistrer
      </Button>
    </div>
  );
}

export function DeleteRuleButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Supprimer la règle"
      className="max-sm:size-11"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await deleteRule(id);
          if (!res.ok) toast.error("Échec", { description: res.error });
          else router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}
