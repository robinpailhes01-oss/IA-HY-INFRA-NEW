"use client";

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, MessageCircle, Phone, Mail, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  fullName,
  initials,
  needsFollowUp,
  relativeDays,
  type Lead,
} from "@/lib/leads";
import { ChannelLogo } from "@/components/leads/channel-logo";
import { channelLabel } from "@/components/agent/channels";
import { ContactAvatar } from "@/components/agent/contact-avatar";
import { ScoreChip } from "@/components/agent/score-meter";

type LeadCardProps = {
  lead: Lead;
  now: number;
  onOpen?: (lead: Lead) => void;
  dragging?: boolean;
  overlay?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

/**
 * Carte de lead du Kanban : une plaque de verre blanc posée dans un couloir
 * givré. Qui (avatar + canal), à quel point il est chaud (score), ce qu'il
 * veut, quand — et s'il faut le relancer. Réutilisée dans le DragOverlay.
 */
export const LeadCard = React.forwardRef<HTMLDivElement, LeadCardProps>(
  function LeadCard({ lead, now, onOpen, dragging, overlay, className, ...rest }, ref) {
    const relance = needsFollowUp(lead, now);
    const name = fullName(lead.first_name, lead.last_name, lead.whatsapp_name);
    const isWhatsapp = lead.source_channel === "whatsapp";

    return (
      <div
        ref={ref}
        {...rest}
        onClick={() => onOpen?.(lead)}
        className={cn(
          "group/card relative w-full touch-manipulation select-none rounded-[18px] border border-white bg-white/88 p-3.5 text-left",
          "shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.05),0_10px_24px_-16px_rgba(11,37,69,0.35)]",
          "transition-[transform,box-shadow] duration-300 [transition-timing-function:var(--ease-ios)]",
          "hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_#fff,0_2px_4px_rgba(11,37,69,0.05),0_18px_34px_-18px_rgba(11,37,69,0.42)]",
          onOpen && "cursor-grab active:cursor-grabbing",
          dragging && "opacity-35",
          overlay && "rotate-[1.5deg] scale-[1.03] cursor-grabbing shadow-[var(--shadow-lift)] ring-2 ring-ocean/25",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <ContactAvatar
            size="sm"
            initials={initials(lead.first_name, lead.last_name, lead.whatsapp_name)}
            badge={<ChannelLogo channel={lead.source_channel} />}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                {name}
              </span>
              {relance && (
                <span className="relative flex size-2 shrink-0" title="À relancer (plus de 48 h sans échange)">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning/60" />
                  <span className="relative inline-flex size-2 rounded-full bg-warning" />
                </span>
              )}
            </div>
            <span className="mt-0.5 block truncate text-[12px] text-ink-3">{channelLabel(lead.source_channel)}</span>
          </div>
          <ScoreChip score={lead.score} size="sm" />
        </div>

        {lead.interested_offer && (
          <p className="mt-3 line-clamp-2 text-[13px] font-medium leading-snug text-foreground/85">
            {lead.interested_offer}
          </p>
        )}

        {(lead.desired_date || lead.party_size != null) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {lead.desired_date && (
              <span className="pastille bg-[rgba(47,127,224,0.09)] text-ocean">
                <CalendarDays className="size-3" />
                {new Date(lead.desired_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </span>
            )}
            {lead.party_size != null && (
              <span className="pastille bg-[rgba(11,37,69,0.05)] text-ink-2">
                <Users className="size-3" />
                {lead.party_size}
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--hairline)] pt-2.5">
          {lead.phone ? (
            <a
              href={isWhatsapp ? `https://wa.me/${lead.phone.replace(/\D/g, "")}` : `tel:${lead.phone}`}
              target={isWhatsapp ? "_blank" : undefined}
              rel={isWhatsapp ? "noopener noreferrer" : undefined}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex min-w-0 items-center gap-1 truncate text-[11.5px] text-ink-3 transition-colors hover:text-ocean"
            >
              {isWhatsapp ? <MessageCircle className="size-3 shrink-0" /> : <Phone className="size-3 shrink-0" />}
              <span className="truncate tabular-nums">{lead.phone}</span>
            </a>
          ) : lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex min-w-0 items-center gap-1 truncate text-[11.5px] text-ink-3 transition-colors hover:text-ocean"
            >
              <Mail className="size-3 shrink-0" />
              <span className="truncate">{lead.email}</span>
            </a>
          ) : (
            <span className="text-[11.5px] text-ink-3">{relativeDays(lead.last_interaction_at ?? lead.created_at, now)}</span>
          )}
          {lead.needs_human_intervention ? (
            <span className="pastille shrink-0 bg-[rgba(224,77,85,0.1)] text-danger">À reprendre</span>
          ) : (
            (lead.phone || lead.email) && (
              <span className="shrink-0 text-[11px] text-ink-3">
                {relativeDays(lead.last_interaction_at ?? lead.created_at, now)}
              </span>
            )
          )}
        </div>
      </div>
    );
  },
);

/** Enveloppe déplaçable (@dnd-kit) autour de la carte. */
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
