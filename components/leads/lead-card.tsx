"use client";

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  channelMeta,
  fullName,
  initials,
  needsFollowUp,
  relativeDays,
  scoreClasses,
  type Lead,
} from "@/lib/leads";

type LeadCardProps = {
  lead: Lead;
  now: number;
  onOpen?: (lead: Lead) => void;
  dragging?: boolean;
  overlay?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

/** Carte présentationnelle (réutilisée dans le DragOverlay). */
export const LeadCard = React.forwardRef<HTMLDivElement, LeadCardProps>(
  function LeadCard({ lead, now, onOpen, dragging, overlay, className, ...rest }, ref) {
    const channel = channelMeta(lead.source_channel);
    const ChannelIcon = channel.Icon;
    const relance = needsFollowUp(lead, now);

    return (
      <div
        ref={ref}
        {...rest}
        onClick={() => onOpen?.(lead)}
        className={cn(
          "group/card relative w-full select-none rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all",
          "hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-md",
          onOpen && "cursor-grab active:cursor-grabbing",
          dragging && "opacity-40",
          overlay && "rotate-2 scale-[1.03] cursor-grabbing border-gold/50 shadow-xl",
          className,
        )}
      >
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              channel.className,
            )}
            aria-hidden
          >
            {initials(lead.first_name, lead.last_name, lead.whatsapp_name)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground">
                {fullName(lead.first_name, lead.last_name, lead.whatsapp_name)}
              </span>
              {relance && (
                <span className="relative flex size-2 shrink-0" title="À relancer (> 48h)">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning/70" />
                  <span className="relative inline-flex size-2 rounded-full bg-warning" />
                </span>
              )}
            </div>
            <span
              className={cn(
                "mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                channel.className,
              )}
            >
              <ChannelIcon className="size-3" />
              {channel.label}
            </span>
          </div>

          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums",
              scoreClasses(lead.score),
            )}
            title="Score"
          >
            {lead.score ?? "—"}
          </span>
        </div>

        {lead.interested_offer && (
          <p className="mt-2.5 truncate text-sm text-foreground/90">{lead.interested_offer}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {lead.desired_date && (
            <span className="inline-flex items-center gap-1 font-medium text-gold">
              <CalendarDays className="size-3.5" />
              {new Date(lead.desired_date).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
          {lead.party_size != null && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {lead.party_size}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
          <span>{relativeDays(lead.last_interaction_at ?? lead.created_at, now)}</span>
          {lead.needs_human_intervention && (
            <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
              Intervention
            </span>
          )}
        </div>
      </div>
    );
  },
);

/** Wrapper draggable (@dnd-kit) autour de la carte. */
export function DraggableLeadCard({
  lead,
  now,
  onOpen,
}: {
  lead: Lead;
  now: number;
  onOpen: (lead: Lead) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  return (
    <LeadCard
      ref={setNodeRef}
      lead={lead}
      now={now}
      onOpen={onOpen}
      dragging={isDragging}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      {...attributes}
      {...listeners}
    />
  );
}
