"use client";

import { CalendarDays, MessageSquareReply, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  channelMeta,
  fullName,
  groupByPriority,
  initials,
  priorityReason,
  PRIORITY_META,
  relativeDays,
  scoreClasses,
  type Lead,
} from "@/lib/leads";

/**
 * Vue « Priorité » — regroupe les leads actionnables par urgence (à reprendre,
 * relances dues, leads chauds, nouveaux, en cours). Chaque ligne permet
 * d'ouvrir la fiche ou de sauter directement sur la conversation pour répondre.
 */
export function LeadsPriority({
  leads,
  now,
  onOpen,
}: {
  leads: Lead[];
  now: number;
  /** tab optionnel : "conversations" pour répondre directement. */
  onOpen: (lead: Lead, tab?: string) => void;
}) {
  const groups = groupByPriority(leads, now);

  if (groups.length === 0) {
    return (
      <div className="enter-up flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 py-16 text-center">
        <p className="font-medium text-foreground">Rien d&apos;urgent 🎉</p>
        <p className="text-sm text-muted-foreground">
          Aucun lead actionnable — tout est à jour ou déjà traité.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ bucket, leads: bucketLeads }, gi) => {
        const meta = PRIORITY_META[bucket];
        return (
          <section
            key={bucket}
            className="enter-up flex flex-col gap-2"
            style={{ animationDelay: `${gi * 60}ms` }}
          >
            <header className="flex items-center gap-2 px-0.5">
              <span className={cn("size-2 rounded-full", meta.dot)} />
              <h2 className={cn("text-sm font-semibold", meta.accent)}>{meta.label}</h2>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {bucketLeads.length}
              </span>
              <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">
                · {meta.hint}
              </span>
            </header>

            <div className={cn("overflow-hidden rounded-xl border", meta.ring)}>
              {bucketLeads.map((lead, i) => (
                <PriorityRow
                  key={lead.id}
                  lead={lead}
                  now={now}
                  onOpen={onOpen}
                  first={i === 0}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PriorityRow({
  lead,
  now,
  onOpen,
  first,
}: {
  lead: Lead;
  now: number;
  onOpen: (lead: Lead, tab?: string) => void;
  first: boolean;
}) {
  const channel = channelMeta(lead.source_channel);
  const ChannelIcon = channel.Icon;
  const name = fullName(lead.first_name, lead.last_name, lead.whatsapp_name);

  return (
    <div
      onClick={() => onOpen(lead)}
      className={cn(
        "group flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-foreground/[0.03]",
        !first && "border-t border-border/60",
      )}
    >
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
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
              channel.className,
            )}
          >
            <ChannelIcon className="size-2.5" />
            <span className="hidden sm:inline">{channel.label}</span>
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">{priorityReason(lead, now)}</span>
          {lead.interested_offer && (
            <span className="truncate">· {lead.interested_offer}</span>
          )}
          {lead.desired_date && (
            <span className="inline-flex items-center gap-1 text-gold">
              <CalendarDays className="size-3" />
              {new Date(lead.desired_date).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
          {lead.party_size != null && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              {lead.party_size}
            </span>
          )}
        </div>
      </div>

      <span
        className={cn(
          "hidden shrink-0 items-center text-[11px] text-muted-foreground sm:inline-flex",
        )}
        title="Dernière interaction"
      >
        {relativeDays(lead.last_interaction_at ?? lead.created_at, now)}
      </span>

      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums",
          scoreClasses(lead.score),
        )}
        title="Score de qualification"
      >
        {lead.score ?? "—"}
      </span>

      <Button
        size="sm"
        variant="outline"
        className="shrink-0 gap-1.5"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(lead, "conversations");
        }}
      >
        <MessageSquareReply className="size-4" />
        <span className="hidden sm:inline">Répondre</span>
      </Button>
    </div>
  );
}
