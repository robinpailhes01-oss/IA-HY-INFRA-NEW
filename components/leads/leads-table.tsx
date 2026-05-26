"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateLong } from "@/lib/format";
import { leadStatusBadge, sourceChannelLabel } from "@/lib/status";
import {
  LeadEditDialog,
  type EditableLead,
} from "@/components/leads/lead-edit-dialog";

export type LeadListItem = EditableLead & { created_at: string | null };

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "Lead";
}

export function LeadsTable({ leads }: { leads: LeadListItem[] }) {
  const [selected, setSelected] = useState<LeadListItem | null>(null);
  const [open, setOpen] = useState(false);

  function edit(lead: LeadListItem) {
    setSelected(lead);
    setOpen(true);
  }

  if (leads.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucun lead pour le moment.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Offre</TableHead>
            <TableHead className="text-center">Score</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Reçu le</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const status = leadStatusBadge(lead.status);
            return (
              <TableRow
                key={lead.id}
                onClick={() => edit(lead)}
                className="group cursor-pointer transition-colors active:bg-muted/60"
                title="Modifier ce lead"
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {fullName(lead.first_name, lead.last_name)}
                      {lead.needs_human_intervention && (
                        <Badge variant="destructive">À rappeler</Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {lead.email ?? lead.phone ?? "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {sourceChannelLabel(lead.source_channel)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.interested_offer ?? "—"}
                </TableCell>
                <TableCell className="text-center">
                  {typeof lead.score === "number" ? (
                    <span className="font-semibold text-gold">{lead.score}/10</span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.created_at ? formatDateLong(lead.created_at) : "—"}
                </TableCell>
                <TableCell>
                  <Pencil className="size-4 text-muted-foreground/40 transition-colors group-hover:text-gold" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <LeadEditDialog lead={selected} open={open} onOpenChange={setOpen} />
    </>
  );
}
