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

import { LEAD_COLUMNS, type Lead, type LeadStatus } from "@/lib/leads";
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
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const col of LEAD_COLUMNS) map[col.status] = [];
    for (const lead of leads) {
      if (lead.status && map[lead.status]) map[lead.status].push(lead);
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
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
        {LEAD_COLUMNS.map((col) => (
          <LeadsColumn
            key={col.status}
            status={col.status}
            label={col.label}
            tint={col.tint}
            accent={col.accent}
            dot={col.dot}
            leads={byStatus[col.status] ?? []}
            now={now}
            onOpen={onOpen}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeLead ? (
          <LeadCard lead={activeLead} now={now} overlay className="w-[270px] sm:w-[280px]" />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
