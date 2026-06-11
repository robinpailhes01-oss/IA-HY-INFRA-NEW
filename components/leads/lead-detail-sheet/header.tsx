"use client";

import { CalendarDays, Phone, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  LEAD_COLUMNS,
  STATUS_LABEL,
  channelMeta,
  fullName,
  initials,
  scoreClasses,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LeadDetailHeader({
  lead,
  onStatusChange,
}: {
  lead: Lead;
  onStatusChange: (status: LeadStatus) => void;
}) {
  const channel = channelMeta(lead.source_channel);
  const ChannelIcon = channel.Icon;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold",
            channel.className,
          )}
        >
          {initials(lead.first_name, lead.last_name, lead.whatsapp_name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-lg font-semibold text-foreground">
            {fullName(lead.first_name, lead.last_name, lead.whatsapp_name)}
          </h2>
          {lead.whatsapp_name && !lead.first_name && !lead.last_name && (
            <p className="truncate text-xs text-muted-foreground">Nom WhatsApp · à confirmer</p>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ChannelIcon className="size-3" />
              {channel.label}
            </span>
            {lead.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" />
                {lead.phone}
              </span>
            )}
          </div>
        </div>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums",
            scoreClasses(lead.score),
          )}
          title="Score"
        >
          {lead.score ?? "—"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={lead.status ?? ""}
          onValueChange={(v) => onStatusChange(v as LeadStatus)}
        >
          <SelectTrigger size="sm" className="w-auto">
            <SelectValue>
              {(value) => (value ? STATUS_LABEL[value as string] ?? (value as string) : "—")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LEAD_COLUMNS.map((c) => (
              <SelectItem key={c.status} value={c.status}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {lead.occasion && (
          <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
            {lead.occasion}
          </span>
        )}
        {lead.desired_date && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3" />
            {new Date(lead.desired_date).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })}
          </span>
        )}
        {lead.party_size != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Users className="size-3" />
            {lead.party_size}
          </span>
        )}
      </div>
    </div>
  );
}
