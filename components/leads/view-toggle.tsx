"use client";

import { LayoutGrid, ListChecks, Table2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type ViewMode = "priority" | "kanban" | "table";

export function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5">
      {(
        [
          { mode: "priority" as const, label: "Priorité", Icon: ListChecks },
          { mode: "kanban" as const, label: "Kanban", Icon: LayoutGrid },
          { mode: "table" as const, label: "Tableau", Icon: Table2 },
        ]
      ).map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={view === mode}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
            view === mode
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
