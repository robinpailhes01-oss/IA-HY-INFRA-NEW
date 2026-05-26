import { UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDateRelative } from "@/lib/format";
import { leadStatusBadge } from "@/lib/status";

export type RecentLead = {
  id: string;
  name: string;
  sourceChannel: string | null;
  interestedOffer: string | null;
  score: number | null;
  status: string | null;
  createdAt: string | null;
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
        const status = leadStatusBadge(lead.status);
        return (
          <li
            key={lead.id}
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
          >
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
