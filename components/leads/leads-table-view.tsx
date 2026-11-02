"use client";

import { useMemo, useState } from "react";
import { Archive, ArrowDown, ArrowUp, ChevronsUpDown, Download, MessageCircle, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LEAD_COLUMNS,
  STATUS_LABEL,
  fullName,
  initials,
  needsFollowUp,
  relativeDays,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";
import { ChannelLogo } from "@/components/leads/channel-logo";
import { channelLabel } from "@/components/agent/channels";
import { ContactAvatar } from "@/components/agent/contact-avatar";
import { ScoreChip } from "@/components/agent/score-meter";
import { stageTone } from "@/components/agent/stages";

type SortKey = "name" | "channel" | "score" | "status" | "desired_date" | "last";
const PAGE_SIZE = 50;

export function LeadsTableView({
  leads,
  now,
  onOpen,
  onBulkStatus,
  onBulkArchive,
}: {
  leads: Lead[];
  now: number;
  onOpen: (lead: Lead) => void;
  onBulkStatus: (ids: string[], status: LeadStatus) => void;
  onBulkArchive: (ids: string[]) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "desired_date",
    dir: "asc",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const arr = [...leads];
    const dir = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort.key) {
        case "name":
          return dir * fullName(a.first_name, a.last_name, a.whatsapp_name).localeCompare(fullName(b.first_name, b.last_name, b.whatsapp_name));
        case "channel":
          return dir * (a.source_channel ?? "").localeCompare(b.source_channel ?? "");
        case "score":
          return dir * ((a.score ?? -1) - (b.score ?? -1));
        case "status":
          return dir * (a.status ?? "").localeCompare(b.status ?? "");
        case "desired_date": {
          if (!a.desired_date && !b.desired_date) return 0;
          if (!a.desired_date) return 1;
          if (!b.desired_date) return -1;
          return dir * (Date.parse(a.desired_date) - Date.parse(b.desired_date));
        }
        case "last":
        default:
          return (
            dir *
            ((Date.parse(a.last_interaction_at ?? a.created_at ?? "") || 0) -
              (Date.parse(b.last_interaction_at ?? b.created_at ?? "") || 0))
          );
      }
    });
    return arr;
  }, [leads, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((l) => selected.has(l.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageRows.forEach((l) => next.delete(l.id));
      else pageRows.forEach((l) => next.add(l.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function exportCsv() {
    const rows = sorted.filter((l) => selected.has(l.id));
    const target = rows.length > 0 ? rows : sorted;
    const header = ["Nom", "Téléphone", "Email", "Canal", "Offre", "Occasion", "Score", "Statut", "Date souhaitée"];
    const lines = target.map((l) =>
      [
        fullName(l.first_name, l.last_name, l.whatsapp_name),
        l.phone ?? "",
        l.email ?? "",
        channelLabel(l.source_channel),
        l.interested_offer ?? "",
        l.occasion ?? "",
        l.score ?? "",
        STATUS_LABEL[l.status ?? ""] ?? l.status ?? "",
        l.desired_date ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedIds = [...selected];

  return (
    <div className="flex flex-col gap-3">
      {selectedIds.length > 0 && (
        <div className="vitre-strong sticky top-3 z-20 flex flex-wrap items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5">
          <span className="text-[13px] font-semibold text-foreground">
            {selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}
          </span>
          <Select onValueChange={(v) => { onBulkStatus(selectedIds, v as LeadStatus); clearSelection(); }}>
            <SelectTrigger size="sm" className="ml-1">
              <SelectValue>{() => "Changer le statut"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LEAD_COLUMNS.map((c) => (
                <SelectItem key={c.status} value={c.status}>
                  {stageTone(c.status).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => { onBulkArchive(selectedIds); clearSelection(); }}>
            <Archive />
            Archiver
          </Button>
          <Button size="sm" variant="ghost" onClick={exportCsv}>
            <Download />
            Exporter CSV
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={clearSelection} className="ml-auto" aria-label="Désélectionner">
            <X />
          </Button>
        </div>
      )}

      <div className="vitre overflow-hidden rounded-[24px]">
        <div className="relative z-[1] overflow-x-auto px-2 pb-1 pt-1">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-3">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  className="size-4 cursor-pointer rounded accent-ocean"
                  aria-label="Tout sélectionner"
                />
              </TableHead>
              <SortHead label="Lead" k="name" sort={sort} setSort={setSort} />
              <SortHead label="Canal" k="channel" sort={sort} setSort={setSort} />
              <TableHead>Offre</TableHead>
              <SortHead label="Score" k="score" sort={sort} setSort={setSort} className="text-center" />
              <SortHead label="Statut" k="status" sort={sort} setSort={setSort} />
              <SortHead label="Date souhaitée" k="desired_date" sort={sort} setSort={setSort} />
              <SortHead label="Interaction" k="last" sort={sort} setSort={setSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((lead) => {
              const relance = needsFollowUp(lead, now);
              const tone = stageTone(lead.status);
              const name = fullName(lead.first_name, lead.last_name, lead.whatsapp_name);
              return (
                <TableRow
                  key={lead.id}
                  data-state={selected.has(lead.id) ? "selected" : undefined}
                  className="group cursor-pointer border-[var(--hairline)] hover:bg-white/60 data-[state=selected]:bg-[rgba(47,127,224,0.06)]"
                  onClick={() => onOpen(lead)}
                >
                  <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggleOne(lead.id)}
                      className="size-4 cursor-pointer rounded accent-ocean"
                      aria-label={`Sélectionner ${name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ContactAvatar size="sm" initials={initials(lead.first_name, lead.last_name, lead.whatsapp_name)} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold tracking-[-0.012em] text-foreground">{name}</span>
                          {relance && (
                            <span className="size-2 shrink-0 rounded-full bg-warning" title="À relancer" />
                          )}
                          {lead.source_channel === "whatsapp" && lead.phone && (
                            <a
                              href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Ouvrir WhatsApp"
                              className="text-whatsapp/60 transition-colors hover:text-whatsapp"
                            >
                              <MessageCircle className="size-3.5" />
                            </a>
                          )}
                        </div>
                        {lead.phone ? (
                          <a
                            href={`tel:${lead.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[12px] tabular-nums text-ink-3 transition-colors hover:text-ocean"
                          >
                            {lead.phone}
                          </a>
                        ) : lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[12px] text-ink-3 transition-colors hover:text-ocean"
                          >
                            {lead.email}
                          </a>
                        ) : (
                          <span className="text-[12px] text-ink-3">—</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
                      <ChannelLogo channel={lead.source_channel} className="size-3.5" />
                      {channelLabel(lead.source_channel)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-[13px] text-ink-2">
                    {lead.interested_offer ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-grid place-items-center">
                      <ScoreChip score={lead.score} size="sm" />
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn("pastille", tone.pill)}>
                      <span className="size-1.5 rounded-full" style={{ background: tone.color }} />
                      {STATUS_LABEL[lead.status ?? ""] ? tone.label : lead.status ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-[13px] tabular-nums text-ink-2">
                    {lead.desired_date
                      ? new Date(lead.desired_date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-[13px] text-ink-3">
                    {relativeDays(lead.last_interaction_at ?? lead.created_at, now)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-[13px]">
          <Button size="sm" variant="outline" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            Précédent
          </Button>
          <span className="px-1 tabular-nums text-ink-2">
            Page {safePage + 1} / {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}

function SortHead({
  label,
  k,
  sort,
  setSort,
  className,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  setSort: (s: { key: SortKey; dir: "asc" | "desc" }) => void;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => setSort({ key: k, dir: active && sort.dir === "asc" ? "desc" : "asc" })}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-full text-[12.5px] font-medium transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-ink-3",
        )}
      >
        {label}
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ChevronsUpDown className="size-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}
