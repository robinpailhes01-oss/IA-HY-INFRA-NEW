"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarRange, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PillGroup } from "@/components/finance/pill-group";
import { ALL_TIME_FROM, ALL_TIME_TO, shortDate } from "@/components/finance/fin-utils";
import { cn } from "@/lib/utils";

// Le filtre de période de la page Finance. La période vit dans l'URL
// (?from=…&to=…) : la page reste un composant serveur, un lien partagé
// rouvre la même vue, et le bouton « précédent » du navigateur marche.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function monthBounds(year: number, monthIdx: number): { from: string; to: string } {
  const last = new Date(year, monthIdx + 1, 0).getDate();
  return {
    from: `${year}-${pad(monthIdx + 1)}-01`,
    to: `${year}-${pad(monthIdx + 1)}-${pad(last)}`,
  };
}

type Preset = "month" | "prev_month" | "30d" | "year" | "all";

function presetBounds(p: Preset, now: Date): { from: string; to: string } {
  if (p === "month") return monthBounds(now.getFullYear(), now.getMonth());
  if (p === "prev_month") {
    const idx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const yr = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return monthBounds(yr, idx);
  }
  if (p === "30d") {
    return {
      from: new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
  }
  if (p === "year") return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
  return { from: ALL_TIME_FROM, to: ALL_TIME_TO };
}

const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: "month", label: "Ce mois" },
  { value: "prev_month", label: "Mois dernier" },
  { value: "30d", label: "30 jours" },
  { value: "year", label: "Année" },
  { value: "all", label: "Tout" },
];

function detectPreset(from: string, to: string): Preset | null {
  const now = new Date();
  for (const p of PRESETS) {
    const b = presetBounds(p.value, now);
    if (b.from === from && b.to === to) return p.value;
  }
  return null;
}

export function PeriodFilter({ from, to, className }: { from: string; to: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const active = detectPreset(from, to);

  // Les dates personnalisées s'éditent dans un tiroir, puis s'appliquent
  // d'un geste : un champ date natif émet un changement à chaque segment
  // tapé, naviguer à chaque frappe rechargeait la page trois fois.
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });

  function navigate(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(search.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  function applyPreset(p: Preset) {
    const b = presetBounds(p, new Date());
    setDraft(b);
    setOpen(false);
    navigate(b.from, b.to);
  }

  const validDraft = Boolean(draft.from && draft.to && draft.from <= draft.to);
  const customLabel = active === null ? `${shortDate(from)} → ${shortDate(to)}` : "Dates";

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {/* Téléphone : une seule rangée qui défile jusqu'au bord de l'écran
          (-mx-3 px-3, la gouttière de la coque) — la pilule coupée par le bord dit « il y a la suite »,
          là où une rangée qui passe à la ligne cachait « Tout ». */}
      <div className="no-scrollbar -mx-3 flex items-center gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <PillGroup label="Période" options={PRESETS} value={active} onChange={applyPreset} className="max-w-none shrink-0 overflow-x-visible" />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setDraft({ from, to });
            setOpen((o) => !o);
          }}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-medium tracking-[-0.01em] outline-none transition-colors duration-200 focus-visible:ring-4 focus-visible:ring-ocean/20 sm:h-9",
            active === null || open
              ? "border-white bg-white text-foreground shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.08),0_6px_16px_-10px_rgba(11,37,69,0.3)]"
              : "border-white/90 bg-white/55 text-ink-2 hover:bg-white/80 hover:text-foreground",
          )}
        >
          <CalendarRange className={cn("size-4", active === null ? "text-ocean" : "text-ink-3")} />
          {customLabel}
        </button>
        {pending && <Loader2 aria-label="Chargement" className="size-4 shrink-0 animate-spin text-ink-3" />}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!validDraft) return;
                setOpen(false);
                navigate(draft.from, draft.to);
              }}
              className="vitre-inset flex flex-col gap-3 rounded-[22px] p-3 sm:inline-flex sm:flex-row sm:items-end"
            >
              <label className="grid gap-1.5">
                <span className="t-label pl-1 text-ink-3">Du</span>
                <Input
                  type="date"
                  value={draft.from}
                  max={draft.to || undefined}
                  onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                  className="h-11 sm:h-9 sm:w-44"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="t-label pl-1 text-ink-3">Au</span>
                <Input
                  type="date"
                  value={draft.to}
                  min={draft.from || undefined}
                  onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                  className="h-11 sm:h-9 sm:w-44"
                />
              </label>
              <Button type="submit" disabled={!validDraft} className="h-11 sm:h-9">
                Afficher
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
