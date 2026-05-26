import { UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDateRelative } from "@/lib/format";

export type RecentLead = {
  id: string;
  name: string;
  sourceChannel: string | null;
  interestedOffer: string | null;
  score: number | null;
  status: string | null;
  createdAt: string | null;
};

const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  new: { label: "Nouveau", variant: "default" },
  contacted: { label: "Contacté", variant: "secondary" },
  qualified: { label: "Qualifié", variant: "secondary" },
  quote_sent: { label: "Devis envoyé", variant: "secondary" },
  followed_up: { label: "Relancé", variant: "secondary" },
  booked: { label: "Réservé", variant: "outline" },
  lost: { label: "Perdu", variant: "destructive" },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function RecentLeads({ leads }: { leads: RecentLead[] }) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
        <UserPlus className="size-6 text-muted-foreground/60" />
        Aucun lead récent.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {leads.map((lead) => {
        const status = STATUS[lead.status ?? ""] ?? {
          label: lead.status ?? "—",
          variant: "outline" as const,
        };
        return (
          <li key={lead.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                {initials(lead.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{lead.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {lead.interestedOffer ?? "Offre non précisée"}
                {lead.sourceChannel ? ` · ${lead.sourceChannel}` : ""}
                {lead.createdAt ? ` · ${formatDateRelative(lead.createdAt)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {typeof lead.score === "number" && (
                <span className="text-xs font-semibold text-gold">{lead.score}/10</span>
              )}
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
