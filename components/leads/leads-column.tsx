"use client";

import { useDroppable } from "@dnd-kit/core";

import { cn } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/lib/leads";
import { stageTone } from "@/components/agent/stages";
import { DraggableLeadCard } from "@/components/leads/lead-card";

type ColumnProps = {
  status: LeadStatus;
  leads: Lead[];
  now: number;
  onOpen: (lead: Lead) => void;
};

/**
 * Un couloir du Kanban : du verre givré, plus pâle que les cartes qu'il
 * porte — les cartes flottent dessus. Au survol d'un dépôt, le couloir
 * s'allume en océan.
 */
export function LeadsColumn({ status, leads, now, onOpen }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } });
  const tone = stageTone(status);

  return (
    <div className="flex w-[272px] shrink-0 snap-start flex-col sm:w-[284px]">
      <div className="mb-2.5 flex items-center gap-2 px-2">
        <span className="size-2 rounded-full" style={{ background: tone.color }} />
        <h3 className="text-[13.5px] font-semibold tracking-[-0.015em] text-foreground">{tone.label}</h3>
        <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-white/80 px-2 text-[11.5px] font-semibold tabular-nums text-ink-2 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.06)]">
          {leads.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[60vh] flex-1 flex-col gap-2.5 rounded-[24px] border p-2 transition-[background-color,border-color,box-shadow] duration-200",
          "border-white/70 bg-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md",
          isOver && "border-dashed border-ocean/45 bg-[rgba(47,127,224,0.07)]",
        )}
      >
        {/* Le liseré de l'étape : un trait de couleur en tête de couloir. */}
        <span
          aria-hidden
          className="mx-auto mb-0.5 h-[3px] w-10 rounded-full opacity-80"
          style={{ background: tone.color }}
        />
        {leads.map((lead) => (
          <DraggableLeadCard key={lead.id} lead={lead} now={now} onOpen={onOpen} />
        ))}

        {leads.length === 0 && (
          <div
            className={cn(
              "flex flex-1 items-center justify-center rounded-[18px] border border-dashed border-[var(--hairline-strong)] py-10 text-center text-[12px] text-ink-3 transition-colors",
              isOver && "border-ocean/50 text-ocean",
            )}
          >
            {isOver ? "Déposer ici" : "Aucun lead"}
          </div>
        )}
      </div>
    </div>
  );
}
