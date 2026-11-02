"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/leads";
import { LeadCard } from "@/components/leads/lead-card";
import { LeadsColumn } from "@/components/leads/leads-column";

export function LeadsKanban({
  leads,
  now,
  onOpen,
  onMove,
}: {
  leads: Lead[];
  now: number;
  onOpen: (lead: Lead) => void;
  onMove: (id: string, status: LeadStatus) => void;
}) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Au doigt, un appui bref fait défiler ; un appui maintenu saisit la carte.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const s of LEAD_STATUSES) map[s] = [];
    for (const lead of leads) {
      if (lead.status && map[lead.status]) map[lead.status].push(lead);
    }
    // Chaque couloir trié par date souhaitée croissante (sans date = en bas).
    for (const s of LEAD_STATUSES) {
      map[s].sort((a, b) => {
        if (!a.desired_date && !b.desired_date) return 0;
        if (!a.desired_date) return 1;
        if (!b.desired_date) return -1;
        return Date.parse(a.desired_date) - Date.parse(b.desired_date);
      });
    }
    return map;
  }, [leads]);

  function handleDragStart(event: DragStartEvent) {
    setActiveLead((event.active.data.current?.lead as Lead) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const lead = event.active.data.current?.lead as Lead | undefined;
    const target = event.over?.id as LeadStatus | undefined;
    setActiveLead(null);
    if (!lead || !target) return;
    if (lead.status === target) return;
    onMove(lead.id, target);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveLead(null)}
    >
      {/* Les couloirs défilent seuls, jamais la page : -mx/px pour que les
          ombres des cartes ne soient pas rognées au bord. */}
      <div className="scroll-soft -mx-3 flex snap-x snap-mandatory scroll-px-3 gap-3 overflow-x-auto px-3 pb-4 sm:-mx-1 sm:snap-none sm:px-1 lg:gap-4">
        {LEAD_STATUSES.map((status) => (
          <LeadsColumn
            key={status}
            status={status}
            leads={byStatus[status] ?? []}
            now={now}
            onOpen={onOpen}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }}>
        {activeLead ? (
          <LeadCard lead={activeLead} now={now} overlay className="w-[272px] sm:w-[284px]" />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
