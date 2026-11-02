"use client";

import Link from "next/link";
import { CalendarDays, Mail, MessageCircle, MessagesSquare, Phone, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { ChannelLogo } from "@/components/leads/channel-logo";
import { channelLabel } from "@/components/agent/channels";
import { ContactAvatar } from "@/components/agent/contact-avatar";
import { ScoreChip } from "@/components/agent/score-meter";
import { stageTone } from "@/components/agent/stages";
import {
  LEAD_COLUMNS,
  fullName,
  initials,
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

/**
 * En-tête de la fiche lead : le nom en serif (la fiche est une page à part
 * entière), le canal, les moyens de le joindre, puis l'étape du pipeline —
 * modifiable sur place — et les faits qui décident d'une réponse (occasion,
 * date, taille du groupe).
 */
export function LeadDetailHeader({
  lead,
  onStatusChange,
}: {
  lead: Lead;
  onStatusChange: (status: LeadStatus) => void;
}) {
  const isWhatsapp = lead.source_channel === "whatsapp";
  const tone = stageTone(lead.status);
  const name = fullName(lead.first_name, lead.last_name, lead.whatsapp_name);

  return (
    <div className="flex flex-col gap-4">
      {/* pr-10 : la croix de fermeture du panneau occupe le coin. */}
      <div className="flex items-start gap-3.5 pr-10">
        <ContactAvatar
          size="lg"
          tone="navy"
          initials={initials(lead.first_name, lead.last_name, lead.whatsapp_name)}
          badge={<ChannelLogo channel={lead.source_channel} />}
        />
        <div className="min-w-0 flex-1">
          <h2 className="t-serif truncate text-[28px] leading-[1.1] text-foreground">{name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-3">
            via {channelLabel(lead.source_channel)}
            {lead.whatsapp_name && !lead.first_name && !lead.last_name && (
              <span>· nom WhatsApp, à confirmer</span>
            )}
          </p>
        </div>
        <ScoreChip score={lead.score} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {lead.phone && isWhatsapp && (
          <Link
            href={`/agent/conversations?phone=${encodeURIComponent(lead.phone)}`}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[linear-gradient(160deg,#1d4c84,#0b2545)] px-3.5 text-[12.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_6px_14px_-8px_rgba(11,37,69,0.6)] transition-[filter] hover:brightness-110 sm:h-9"
          >
            <MessagesSquare className="size-3.5" />
            Ouvrir le fil
          </Link>
        )}
        {lead.phone &&
          (isWhatsapp ? (
            <a
              href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[rgba(31,174,91,0.22)] bg-[rgba(31,174,91,0.08)] px-3.5 text-[12.5px] font-medium text-[#127a42] transition-colors hover:bg-[rgba(31,174,91,0.14)] sm:h-9"
            >
              <MessageCircle className="size-3.5" />
              WhatsApp
            </a>
          ) : (
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white/90 bg-white/70 px-3.5 text-[12.5px] font-medium text-foreground shadow-[inset_0_1px_0_#fff] transition-colors hover:bg-white sm:h-9"
            >
              <Phone className="size-3.5" />
              <span className="tabular-nums">{lead.phone}</span>
            </a>
          ))}
        {lead.email && (
          <a
            href={`mailto:${lead.email}`}
            className="inline-flex h-11 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-white/90 bg-white/70 px-3.5 text-[12.5px] font-medium text-foreground shadow-[inset_0_1px_0_#fff] transition-colors hover:bg-white sm:h-9"
          >
            <Mail className="size-3.5 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={lead.status ?? ""} onValueChange={(v) => onStatusChange(v as LeadStatus)}>
          <SelectTrigger size="sm" className={cn("h-11! w-auto border-transparent font-medium sm:h-9!", tone.pill)}>
            <span className="size-2 rounded-full" style={{ background: tone.color }} />
            <SelectValue>{(value) => (value ? stageTone(value as string).label : "—")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LEAD_COLUMNS.map((c) => (
              <SelectItem key={c.status} value={c.status}>
                {stageTone(c.status).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {lead.occasion && (
          <span className="inline-flex h-11 items-center rounded-full bg-[rgba(164,126,44,0.1)] px-3.5 text-[12.5px] font-medium text-gold sm:h-9">{lead.occasion}</span>
        )}
        {lead.desired_date && (
          <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[rgba(47,127,224,0.09)] px-3.5 text-[12.5px] font-medium text-ocean sm:h-9">
            <CalendarDays className="size-3.5" />
            {new Date(lead.desired_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
          </span>
        )}
        {lead.party_size != null && (
          <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[rgba(11,37,69,0.05)] px-3.5 text-[12.5px] font-medium text-ink-2 sm:h-9">
            <Users className="size-3.5" />
            {lead.party_size} pers.
          </span>
        )}
      </div>
    </div>
  );
}
