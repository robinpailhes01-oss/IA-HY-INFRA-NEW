"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  EMPTY_FILTERS,
  filterLeads,
  filtersActive,
  PRIORITY_BUCKETS,
  PRIORITY_SORTS,
  type Lead,
  type LeadFilters,
  type LeadStatus,
  type PriorityBucket,
  type PrioritySort,
} from "@/lib/leads";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bulkArchive,
  bulkUpdateStatus,
  updateLeadStatus,
} from "@/app/(dashboard)/leads/actions";
import { LeadsKanban } from "@/components/leads/leads-kanban";
import { LeadsPriority } from "@/components/leads/leads-priority";
import { LeadsTableView } from "@/components/leads/leads-table-view";
import { LeadsFilters } from "@/components/leads/leads-filters";
import { LeadsFiltersMobile } from "@/components/leads/leads-filters-mobile";
import { ViewToggle, type ViewMode } from "@/components/leads/view-toggle";
import { LeadDetailSheet } from "@/components/leads/lead-detail-sheet";
import { NewLeadSheet } from "@/components/leads/new-lead-sheet";
import { NewLeadFab } from "@/components/leads/new-lead-fab";

function rowToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    first_name: (row.first_name as string) ?? null,
    last_name: (row.last_name as string) ?? null,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    source_channel: (row.source_channel as string) ?? null,
    source_status: (row.source_status as string) ?? null,
    interested_offer: (row.interested_offer as string) ?? null,
    occasion: (row.occasion as string) ?? null,
    party_size: (row.party_size as number) ?? null,
    desired_date: (row.desired_date as string) ?? null,
    desired_time_slot: (row.desired_time_slot as string) ?? null,
    score: (row.score as number) ?? null,
    status: (row.status as string) ?? null,
    needs_human_intervention: (row.needs_human_intervention as boolean) ?? null,
    last_interaction_at: (row.last_interaction_at as string) ?? null,
    last_followup_at: (row.last_followup_at as string) ?? null,
    followup_count: (row.followup_count as number) ?? null,
    ai_memo: (row.ai_memo as string) ?? null,
    notes: (row.notes as string) ?? null,
    created_at: (row.created_at as string) ?? null,
    archived: (row.archived as boolean) ?? false,
    whatsapp_name: (row.whatsapp_name as string) ?? null,
    // Ces champs viennent de la vue `lead_last_message`, pas de la table
    // `leads` : un événement temps réel sur `leads` ne les contient jamais.
    // Ils sont donc repris depuis l'état précédent au moment de la fusion.
    last_from_me: null,
    last_message_at: null,
    site_link_sent: null,
  };
}

export function LeadsView({ initialLeads, now }: { initialLeads: Lead[]; now: number }) {
  const router = useRouter();
  const search = useSearchParams();

  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [filters, setFilters] = useState<LeadFilters>(() => ({
    q: search.get("q") ?? "",
    channels: search.get("canal")?.split(",").filter(Boolean) ?? [],
    offer: search.get("offre") ?? "",
    minScore: Number(search.get("score") ?? 0) || 0,
    followUpOnly: search.get("relance") === "1",
  }));
  const [view, setView] = useState<ViewMode>(() => {
    const v = search.get("view");
    if (v === "table" || v === "kanban") return v;
    return "priority";
  });
  const [prioritySort, setPrioritySort] = useState<PrioritySort>(() => {
    const t = search.get("tri");
    return t === "contact_new" || t === "score" || t === "desired_date" ? t : "contact_old";
  });
  const [bucket, setBucket] = useState<PriorityBucket | null>(() => {
    const b = search.get("bucket");
    return (PRIORITY_BUCKETS as string[]).includes(b ?? "") ? (b as PriorityBucket) : null;
  });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<string>("infos");
  const [createOpen, setCreateOpen] = useState(false);

  // ── Realtime ────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("leads-kanban")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string }).id;
            if (id) setLeads((prev) => prev.filter((l) => l.id !== id));
            return;
          }
          const lead = rowToLead(payload.new as Record<string, unknown>);
          setLeads((prev) => {
            if (lead.archived) return prev.filter((l) => l.id !== lead.id);
            const idx = prev.findIndex((l) => l.id === lead.id);
            if (idx === -1) return [lead, ...prev];
            const next = [...prev];
            // On conserve l'engagement déjà chargé : sans ça, une simple
            // mise à jour de statut ferait sortir le lead de « En attente de
            // vous » ou « Silence après le site » jusqu'au prochain refresh.
            const prevLead = prev[idx];
            next[idx] = {
              ...lead,
              last_from_me: prevLead.last_from_me,
              last_message_at: prevLead.last_message_at,
              site_link_sent: prevLead.site_link_sent,
            };
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── URL sync (shareable) ────────────────────────────────────
  const mounted = useRef(false);
  const syncUrl = useDebouncedCallback(
    (f: LeadFilters, v: ViewMode, sort: PrioritySort, b: PriorityBucket | null) => {
      const params = new URLSearchParams();
      if (f.q.trim()) params.set("q", f.q.trim());
      if (f.channels.length) params.set("canal", f.channels.join(","));
      if (f.offer) params.set("offre", f.offer);
      if (f.minScore > 0) params.set("score", String(f.minScore));
      if (f.followUpOnly) params.set("relance", "1");
      if (v !== "priority") params.set("view", v);
      if (v === "priority" && sort !== "contact_old") params.set("tri", sort);
      if (v === "priority" && b) params.set("bucket", b);
      const qs = params.toString();
      router.replace(qs ? `/leads?${qs}` : "/leads", { scroll: false });
    },
    400,
  );

  useEffect(() => {
    if (mounted.current) syncUrl(filters, view, prioritySort, bucket);
    else mounted.current = true;
  }, [filters, view, prioritySort, bucket, syncUrl]);

  // ── Ouverture directe d'une fiche via ?lead=<id> (depuis le dashboard) ──
  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (openedFromUrl.current) return;
    const id = search.get("lead");
    if (!id) return;
    const lead = initialLeads.find((l) => l.id === id);
    if (lead) {
      openedFromUrl.current = true;
      openLead(lead);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Optimistic mutations ────────────────────────────────────
  const patchLead = useCallback((id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setSelectedLead((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const removeLead = useCallback((id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const moveLead = useCallback((id: string, status: LeadStatus) => {
    let previous: string | null = null;
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        previous = l.status;
        return { ...l, status };
      }),
    );
    updateLeadStatus(id, status).then((res) => {
      if (!res.ok) {
        toast.error("Déplacement échoué", { description: res.error });
        if (previous !== null) {
          setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: previous } : l)));
        }
      }
    });
  }, []);

  function openLead(lead: Lead, tab: string = "infos") {
    setSelectedLead(lead);
    setDetailTab(tab);
    setDetailOpen(true);
  }

  function handleCreated(lead: Lead) {
    setLeads((prev) => (prev.some((l) => l.id === lead.id) ? prev : [lead, ...prev]));
  }

  function handleBulkStatus(ids: string[], status: LeadStatus) {
    setLeads((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, status } : l)));
    bulkUpdateStatus(ids, status).then((res) => {
      if (!res.ok) toast.error("Action groupée échouée", { description: res.error });
    });
    toast.success(`${ids.length} lead(s) mis à jour`);
  }

  function handleBulkArchive(ids: string[]) {
    setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
    bulkArchive(ids).then((res) => {
      if (!res.ok) toast.error("Archivage échoué", { description: res.error });
    });
    toast.success(`${ids.length} lead(s) archivé(s)`);
  }

  // ── Derived ─────────────────────────────────────────────────
  const filtered = useMemo(() => filterLeads(leads, filters, now), [leads, filters, now]);

  const availableChannels = useMemo(
    () => [...new Set(leads.map((l) => l.source_channel).filter(Boolean) as string[])].sort(),
    [leads],
  );
  const availableOffers = useMemo(
    () => [...new Set(leads.map((l) => l.interested_offer).filter(Boolean) as string[])].sort(),
    [leads],
  );

  const filterProps = {
    filters,
    onChange: (patch: Partial<LeadFilters>) => setFilters((f) => ({ ...f, ...patch })),
    availableChannels,
    availableOffers,
    resultCount: filtered.length,
    totalCount: leads.length,
  };

  const escalatedLeads = leads.filter((l) => l.needs_human_intervention && !l.archived);

  return (
    <div className="flex flex-col gap-4">
      {escalatedLeads.length > 0 && (
        <div className="enter-up flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/8 px-4 py-3 text-sm">
          <span className="inline-flex size-2 shrink-0 animate-pulse rounded-full bg-warning" />
          <p className="flex-1 text-warning-foreground/90">
            <strong className="text-warning">{escalatedLeads.length} lead{escalatedLeads.length > 1 ? "s" : ""}</strong>
            {" "}à reprendre — Léa a escaladé ces conversations vers vous.
          </p>
        </div>
      )}

      <header className="enter-up flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {leads.length} prospect{leads.length > 1 ? "s" : ""} dans le pipeline
            {view === "priority"
              ? " · triés par urgence, les plus chauds en haut"
              : view === "kanban"
                ? " · glisse une carte pour changer son statut"
                : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view === "priority" && (
            <Select value={prioritySort} onValueChange={(v) => setPrioritySort(v as PrioritySort)}>
              <SelectTrigger size="sm" className="w-auto">
                <SelectValue>
                  {(v) => PRIORITY_SORTS.find((s) => s.value === v)?.label ?? "Trier"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <ViewToggle view={view} onChange={setView} />
          <Button onClick={() => setCreateOpen(true)} className="hidden md:inline-flex">
            <Plus />
            Nouveau lead
          </Button>
        </div>
      </header>

      <LeadsFilters {...filterProps} />
      <LeadsFiltersMobile {...filterProps} />

      {leads.length === 0 ? (
        <EmptyState
          title="Aucun lead pour le moment"
          subtitle="Les nouvelles demandes apparaîtront ici automatiquement."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun lead ne correspond aux filtres"
          subtitle="Essaie d'élargir ta recherche."
          action={
            filtersActive(filters) ? (
              <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                Réinitialiser les filtres
              </Button>
            ) : undefined
          }
        />
      ) : view === "priority" ? (
        <LeadsPriority
          leads={filtered}
          now={now}
          onOpen={openLead}
          sort={prioritySort}
          bucket={bucket}
          onBucketChange={setBucket}
        />
      ) : view === "kanban" ? (
        <LeadsKanban leads={filtered} now={now} onOpen={openLead} onMove={moveLead} />
      ) : (
        <LeadsTableView
          leads={filtered}
          now={now}
          onOpen={openLead}
          onBulkStatus={handleBulkStatus}
          onBulkArchive={handleBulkArchive}
        />
      )}

      <LeadDetailSheet
        lead={selectedLead}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onPatch={patchLead}
        onRemove={removeLead}
        initialTab={detailTab}
      />
      <NewLeadSheet open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />
      <NewLeadFab onClick={() => setCreateOpen(true)} />
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="enter-up flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Users className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
