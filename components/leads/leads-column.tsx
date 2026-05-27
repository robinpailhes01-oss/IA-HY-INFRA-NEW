"use client";

import { useDroppable } from "@dnd-kit/core";

import { cn } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/lib/leads";
import { DraggableLeadCard } from "@/components/leads/lead-card";

type ColumnProps = {
  status: LeadStatus;
  label: string;
  tint: string;
  accent: string;
  dot: string;
  leads: Lead[];
  now: number;
  onOpen: (lead: Lead) => void;
};

export function LeadsColumn({
  status,
  label,
  tint,
  accent,
  dot,
  leads,
  now,
  onOpen,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } });

  return (
    <div className="flex w-[270px] shrink-0 flex-col sm:w-[280px]">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn("size-2 rounded-full", dot)} />
        <h3 className={cn("text-sm font-semibold", accent)}>{label}</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {leads.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[60vh] flex-1 flex-col gap-2.5 rounded-2xl border border-transparent p-2 transition-colors",
          tint,
          isOver && "border-dashed border-gold/60 bg-gold/8",
        )}
      >
        {leads.map((lead) => (
          <DraggableLeadCard key={lead.id} lead={lead} now={now} onOpen={onOpen} />
        ))}

        {leads.length === 0 && (
          <div
            className={cn(
              "flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground/70 transition-colors",
              isOver && "border-gold/50 text-gold",
            )}
          >
            {isOver ? "Déposer ici" : "Aucun lead"}
          </div>
        )}
      </div>
    </div>
  );
}
