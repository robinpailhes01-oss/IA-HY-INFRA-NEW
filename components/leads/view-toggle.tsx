"use client";

import { LayoutGrid, ListChecks, Table2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type ViewMode = "priority" | "kanban" | "table";

const VIEWS = [
  { mode: "priority" as const, label: "Priorité", Icon: ListChecks },
  { mode: "kanban" as const, label: "Kanban", Icon: LayoutGrid },
  { mode: "table" as const, label: "Tableau", Icon: Table2 },
];

/**
 * Bascule de vue, en contrôle segmenté (même matière que `Segmented`) : la
 * pastille blanche GLISSE d'une vue à l'autre. Icône + libellé : l'icône seule
 * obligeait à deviner ce que « la grille » voulait dire.
 */
export function ViewToggle({
  view,
  onChange,
  className,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
  className?: string;
}) {
  const index = Math.max(0, VIEWS.findIndex((v) => v.mode === view));

  return (
    <div
      role="tablist"
      aria-label="Vue des leads"
      className={cn(
        "relative inline-grid h-11 grid-cols-3 rounded-full border border-white/90 bg-[rgba(11,37,69,0.045)] p-[3px] shadow-[inset_0_1px_2px_rgba(11,37,69,0.05)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-[3px] left-[3px] rounded-full bg-white shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.08),0_4px_12px_-6px_rgba(11,37,69,0.25)] transition-transform duration-[420ms] [transition-timing-function:var(--ease-ios)]"
        style={{
          width: `calc((100% - 6px) / ${VIEWS.length})`,
          transform: `translateX(calc(${index} * 100%))`,
        }}
      />
      {VIEWS.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={view === mode}
          onClick={() => onChange(mode)}
          className={cn(
            "relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium tracking-[-0.01em] transition-colors duration-200 sm:px-4",
            view === mode ? "text-foreground" : "text-ink-2 hover:text-foreground",
          )}
        >
          <Icon className="size-[15px]" strokeWidth={1.9} />
          {label}
        </button>
      ))}
    </div>
  );
}
