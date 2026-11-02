import { UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateRelative } from "@/lib/format";
import { leadStatusBadge } from "@/lib/status";

// Derniers leads arrivés, en verre clair. La teinte indigo est celle des
// leads dans tout le tableau de bord (docs/DESIGN.md §4).

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
      <EmptyState icon={<UserPlus />} title="Aucun lead récent">
        Les nouveaux prospects apparaissent ici dès que Léa les enregistre.
      </EmptyState>
    );
  }

  return (
    <ul>
      {leads.map((lead) => {
        const status = leadStatusBadge(lead.status);
        return (
          <li
            key={lead.id}
            className="flex items-center gap-3 border-b border-[var(--hairline)] py-3 last:border-b-0"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[rgba(109,124,242,0.12)] text-[12px] font-semibold text-indigo">
              {initials(lead.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium tracking-[-0.012em] text-foreground">{lead.name}</p>
              <p className="truncate text-[12px] text-ink-3">
                {lead.interestedOffer ?? "Offre non précisée"}
                {lead.sourceChannel ? ` · ${lead.sourceChannel}` : ""}
                {lead.createdAt ? ` · ${formatDateRelative(lead.createdAt)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {typeof lead.score === "number" && (
                <span className="text-[12px] font-semibold tabular-nums text-indigo">{lead.score}/10</span>
              )}
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
