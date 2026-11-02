"use client";

import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Check, Loader2 } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { updateLeadNotes } from "@/app/(dashboard)/leads/actions";

type SaveState = "idle" | "saving" | "saved";

export function TabNotes({
  leadId,
  initialNotes,
  onSaved,
}: {
  leadId: string;
  initialNotes: string | null;
  onSaved: (notes: string) => void;
}) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const lastSaved = useRef(initialNotes ?? "");

  // Réinitialise quand on ouvre un autre lead.
  useEffect(() => {
    setValue(initialNotes ?? "");
    lastSaved.current = initialNotes ?? "";
    setState("idle");
  }, [leadId, initialNotes]);

  const save = useDebouncedCallback(async (next: string) => {
    if (next === lastSaved.current) return;
    setState("saving");
    const res = await updateLeadNotes(leadId, next);
    if (res.ok) {
      lastSaved.current = next;
      onSaved(next);
      setState("saved");
    } else {
      setState("idle");
    }
  }, 1500);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="t-card px-1 text-foreground">Notes internes</label>
        <span className="flex items-center gap-1 text-[11.5px] text-ink-3">
          {state === "saving" && (
            <>
              <Loader2 className="size-3 animate-spin" /> Enregistrement…
            </>
          )}
          {state === "saved" && (
            <>
              <Check className="size-3 text-success" /> Enregistré
            </>
          )}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
          save(e.target.value);
        }}
        onBlur={() => save.flush()}
        placeholder="Préférences, contexte, points d'attention…"
        className="min-h-[240px] resize-none rounded-[20px] leading-relaxed"
      />
      <p className="px-1 text-[11.5px] text-ink-3">
        Sauvegarde automatique après une courte pause.
      </p>
    </div>
  );
}
