"use client";

import { useMemo, useState } from "react";
import { Archive, ArrowDown, ArrowUp, ChevronsUpDown, Download } from "lucide-react";

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
  channelMeta,
  fullName,
  needsFollowUp,
  relativeDays,
  scoreClasses,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";

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
    key: "last",
    dir: "desc",
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
        case "desired_date":
          return dir * (Date.parse(a.desired_date ?? "") || 0) - dir * (Date.parse(b.desired_date ?? "") || 0);
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
        channelMeta(l.source_channel).label,
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
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/40 bg-gold/5 px-3 py-2">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}
          </span>
          <Select onValueChange={(v) => { onBulkStatus(selectedIds, v as LeadStatus); clearSelection(); }}>
            <SelectTrigger size="sm" className="ml-2">
              <SelectValue>{() => "Changer le statut"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LEAD_COLUMNS.map((c) => (
                <SelectItem key={c.status} value={c.status}>
                  {c.label}
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
          <Button size="sm" variant="ghost" onClick={clearSelection} className="ml-auto text-muted-foreground">
            Désélectionner
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  className="size-4 cursor-pointer accent-gold"
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
              const channel = channelMeta(lead.source_channel);
              const ChannelIcon = channel.Icon;
              const relance = needsFollowUp(lead, now);
              return (
                <TableRow
                  key={lead.id}
                  className="group cursor-pointer"
                  onClick={() => onOpen(lead)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggleOne(lead.id)}
                      className="size-4 cursor-pointer accent-gold"
                      aria-label="Sélectionner"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {fullName(lead.first_name, lead.last_name, lead.whatsapp_name)}
                      </span>
                      {relance && (
                        <span className="size-2 shrink-0 rounded-full bg-warning" title="À relancer" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {lead.phone ?? lead.email ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <ChannelIcon className="size-3.5" />
                      {channel.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.interested_offer ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "inline-flex size-7 items-center justify-center rounded-lg text-xs font-bold tabular-nums",
                        scoreClasses(lead.score),
                      )}
                    >
                      {lead.score ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">
                      {STATUS_LABEL[lead.status ?? ""] ?? lead.status ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.desired_date
                      ? new Date(lead.desired_date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {relativeDays(lead.last_interaction_at ?? lead.created_at, now)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            Précédent
          </Button>
          <span className="text-muted-foreground">
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
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
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
