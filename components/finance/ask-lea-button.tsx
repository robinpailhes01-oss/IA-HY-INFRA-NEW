"use client";

import { Sparkles } from "lucide-react";

import { askLea } from "@/components/lea/ask-lea";
import { cn } from "@/lib/utils";

// Ouvre Léa (le widget de la coque, branché sur le vrai agent Manager) avec
// une question déjà posée. Un vrai geste, pas un bouton décoratif : Léa lit
// les mêmes tables que cette page et peut répondre chiffres à l'appui.
export function AskLeaButton({
  question,
  label,
  shortLabel,
  tone = "light",
  className,
}: {
  question: string;
  label: string;
  /** Libellé sur téléphone, si `label` est trop long. */
  shortLabel?: string;
  /** « dark » : posé sur le panneau marine. */
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => askLea(question)}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full pl-3.5 pr-4 text-[13px] font-medium tracking-[-0.01em] outline-none transition-colors duration-200 sm:h-10",
        tone === "dark"
          ? "border border-white/15 bg-white/[0.08] text-[#e3effb] hover:bg-white/[0.14] focus-visible:ring-4 focus-visible:ring-white/20"
          : "border border-white/90 bg-white/70 text-foreground shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.06)] hover:bg-white focus-visible:ring-4 focus-visible:ring-ocean/20",
        className,
      )}
    >
      <Sparkles className={cn("size-4", tone === "dark" ? "text-[#9fd0f7]" : "text-ocean")} />
      {shortLabel ? (
        <>
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{shortLabel}</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}
