"use client";

import { useId } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

// Rangée de pilules à choix unique — filtres de période, sens des opérations.
//
// Pourquoi pas `Segmented` (le kit) : ses segments ont tous la même largeur,
// calée sur le plus long. « Mois dernier » imposait sa largeur à « Tout » et
// la rangée ne tenait plus dans un téléphone. Ici chaque pilule prend la
// largeur de son texte, et la pastille blanche GLISSE de l'une à l'autre
// (layoutId) — le mouvement dit qu'on change de vue, pas qu'on ouvre une page.
//
// Sur téléphone, la rangée défile seule (jamais la page) et chaque pilule
// fait 44 px de haut : une cible qu'on attrape au pouce.
export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  /** null : aucune pilule active (ex. période personnalisée). */
  value: T | null;
  onChange: (v: T) => void;
  /** Nom accessible du groupe. */
  label: string;
  className?: string;
}) {
  const layoutId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "no-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-white/90 bg-[rgba(11,37,69,0.045)] p-[3px] shadow-[inset_0_1px_2px_rgba(11,37,69,0.05)]",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium tracking-[-0.01em] outline-none transition-colors duration-200 focus-visible:ring-4 focus-visible:ring-ocean/20 sm:h-8 sm:px-3.5",
              active ? "text-foreground" : "text-ink-2 hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
                className="absolute inset-0 rounded-full bg-white shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.08),0_4px_12px_-6px_rgba(11,37,69,0.25)]"
              />
            )}
            <span className="relative">{o.label}</span>
            {o.count != null && (
              <span
                className={cn(
                  "n-inline relative text-[11.5px]",
                  active ? "text-ocean" : "text-ink-3",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
