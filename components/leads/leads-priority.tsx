"use client";

import type * as React from "react";

import { CalendarDays, CheckCircle2, MessageSquareReply, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChannelLogo } from "@/components/leads/channel-logo";
import { ContactAvatar } from "@/components/agent/contact-avatar";
import { ScoreChip } from "@/components/agent/score-meter";
import {
  fullName,
  groupByPriority,
  initials,
  priorityReason,
  relativeDays,
  type Lead,
  type PriorityBucket,
  type PrioritySort,
} from "@/lib/leads";

// La teinte de chaque seau d'urgence, dans la gamme du tableau de bord.
// Rouge = c'est NOUS qui bloquons (escalade, client sans réponse) ; ambre =
// une échéance ou une relance ; vert/bleu = du potentiel ; gris = pas
// prioritaire. L'ORDRE des seaux reste celui de lib/leads (groupByPriority) ;
// ici, seulement les libellés (tutoyés, comme le reste de l'interface) et
// les teintes.
const BUCKET: Record<PriorityBucket, { label: string; hint: string; dot: string; chip: string }> = {
  takeover: { label: "À reprendre", hint: "Léa a escaladé — reprends la main", dot: "#e04d55", chip: "bg-[rgba(224,77,85,0.1)] text-danger" },
  unanswered: { label: "En attente de toi", hint: "Le client a écrit, personne n'a répondu", dot: "#e04d55", chip: "bg-[rgba(224,77,85,0.1)] text-danger" },
  imminent: { label: "Sortie imminente", hint: "Date souhaitée dans les 7 jours", dot: "#d9822b", chip: "bg-[rgba(217,130,43,0.12)] text-warning" },
  site_sent: { label: "Silence après le site", hint: "Site envoyé, aucune nouvelle depuis", dot: "#d9822b", chip: "bg-[rgba(217,130,43,0.12)] text-warning" },
  hot: { label: "Leads chauds", hint: "Score élevé — à traiter vite", dot: "#0f9f6e", chip: "bg-[rgba(15,159,110,0.11)] text-success" },
  new: { label: "Nouveaux", hint: "Jamais contactés", dot: "#7cc0f5", chip: "bg-[rgba(124,192,245,0.2)] text-[#2b74b8]" },
  active: { label: "En cours", hint: "Suivi en cours", dot: "#2f7fe0", chip: "bg-[rgba(47,127,224,0.1)] text-ocean" },
  curious: { label: "Curieux", hint: "Ni date ni intention claire — pas prioritaire", dot: "#8394ab", chip: "bg-[rgba(11,37,69,0.06)] text-ink-2" },
};

/**
 * Vue « Priorité » — chaque lead actionnable rangé dans un seau d'urgence
 * (à reprendre, sans réponse, sortie imminente…), du plus urgent au moins
 * urgent. Chaque ligne ouvre la fiche, ou saute directement à la
 * conversation pour répondre.
 *
 * Les pastilles du haut isolent une seule catégorie (ex. depuis un lien du
 * Pilotage) — sans elles, il faut défiler parmi jusqu'à 8 sections.
 */
export function LeadsPriority({
  leads,
  now,
  onOpen,
  sort = "contact_old",
  bucket = null,
  onBucketChange,
  sortControl,
}: {
  leads: Lead[];
  now: number;
  /** tab optionnel : "conversations" pour répondre directement. */
  onOpen: (lead: Lead, tab?: string) => void;
  sort?: PrioritySort;
  /** Catégorie isolée, ou null pour tout afficher. */
  bucket?: PriorityBucket | null;
  onBucketChange?: (bucket: PriorityBucket | null) => void;
  /** Le sélecteur de tri, posé au bout de la rangée de pastilles. */
  sortControl?: React.ReactNode;
}) {
  const allGroups = groupByPriority(leads, now, sort);
  const groups = bucket ? allGroups.filter((g) => g.bucket === bucket) : allGroups;
  const actionable = allGroups.reduce((s, g) => s + g.leads.length, 0);

  if (allGroups.length === 0) {
    return (
      <EmptyState icon={<CheckCircle2 />} title="Rien d'urgent">
        Aucun lead actionnable : tout est à jour ou déjà traité.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {(onBucketChange || sortControl) && (
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
          {onBucketChange && (
            <div className="no-scrollbar -mx-3 flex flex-1 gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
              <Pill active={bucket === null} onClick={() => onBucketChange(null)} label="Tout" count={actionable} />
              {allGroups.map(({ bucket: b, leads: bucketLeads }) => (
                <Pill
                  key={b}
                  active={bucket === b}
                  onClick={() => onBucketChange(bucket === b ? null : b)}
                  label={BUCKET[b].label}
                  count={bucketLeads.length}
                  dot={BUCKET[b].dot}
                />
              ))}
            </div>
          )}
          {sortControl && <div className="shrink-0">{sortControl}</div>}
        </div>
      )}

      {groups.length === 0 && (
        <EmptyState
          icon={<CheckCircle2 />}
          title="Rien dans cette catégorie"
          action={
            onBucketChange && (
              <Button variant="outline" size="sm" onClick={() => onBucketChange(null)}>
                Voir tout
              </Button>
            )
          }
        />
      )}

      {groups.map(({ bucket: b, leads: bucketLeads }, gi) => {
        const meta = BUCKET[b];
        return (
          <section
            key={b}
            className="vitre enter-up overflow-hidden rounded-[24px]"
            style={{ animationDelay: `${gi * 60}ms` }}
          >
            <header className="relative z-[1] flex items-center gap-2.5 px-4 pb-2 pt-4 sm:px-5">
              <span className="size-2.5 rounded-full" style={{ background: meta.dot }} />
              <h2 className="t-card text-foreground">{meta.label}</h2>
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[rgba(11,37,69,0.06)] px-2 text-[11.5px] font-semibold tabular-nums text-ink-2">
                {bucketLeads.length}
              </span>
              <span className="ml-1 hidden truncate text-[12.5px] text-ink-3 sm:inline">{meta.hint}</span>
            </header>
            <ul className="relative z-[1] px-2 pb-2">
              {bucketLeads.map((lead) => (
                <li key={lead.id}>
                  <PriorityRow lead={lead} now={now} onOpen={onOpen} chip={meta.chip} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Pill({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200",
        active
          ? "border-transparent bg-[linear-gradient(160deg,#1d4c84,#0b2545)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_6px_14px_-8px_rgba(11,37,69,0.6)]"
          : "border-white/90 bg-white/60 text-ink-2 shadow-[inset_0_1px_0_#fff] hover:bg-white hover:text-foreground",
      )}
    >
      {dot && <span className="size-2 rounded-full" style={{ background: dot }} />}
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
          active ? "bg-white/15 text-white" : "bg-[rgba(11,37,69,0.06)] text-ink-2",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function PriorityRow({
  lead,
  now,
  onOpen,
  chip,
}: {
  lead: Lead;
  now: number;
  onOpen: (lead: Lead, tab?: string) => void;
  chip: string;
}) {
  const name = fullName(lead.first_name, lead.last_name, lead.whatsapp_name);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(lead)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(lead);
      }}
      className="group flex cursor-pointer items-center gap-3 rounded-[18px] px-2.5 py-2.5 transition-colors hover:bg-white/70 focus-visible:bg-white/70 focus-visible:outline-none sm:px-3"
    >
      <ContactAvatar
        size="sm"
        initials={initials(lead.first_name, lead.last_name, lead.whatsapp_name)}
        badge={<ChannelLogo channel={lead.source_channel} />}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold tracking-[-0.015em] text-foreground">{name}</span>
          {/* .pastille fixe display:inline-flex hors des couches Tailwind :
              on masque l'enveloppe, pas la pastille. */}
          <span className="hidden shrink-0 sm:inline-flex">
            <span className={cn("pastille", chip)}>{priorityReason(lead, now)}</span>
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink-3">
          <span className="inline-flex shrink-0 sm:hidden">
            <span className={cn("pastille", chip)}>{priorityReason(lead, now)}</span>
          </span>
          {lead.interested_offer && <span className="truncate text-ink-2">{lead.interested_offer}</span>}
          {lead.desired_date && (
            <span className="inline-flex items-center gap-1 text-ocean">
              <CalendarDays className="size-3" />
              {new Date(lead.desired_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </span>
          )}
          {lead.party_size != null && (
            <span className="hidden items-center gap-1 sm:inline-flex">
              <Users className="size-3" />
              {lead.party_size}
            </span>
          )}
        </div>
      </div>

      <span className="hidden shrink-0 text-[11.5px] text-ink-3 md:inline" title="Dernière interaction">
        {relativeDays(lead.last_interaction_at ?? lead.created_at, now)}
      </span>

      <ScoreChip score={lead.score} />

      <button
        type="button"
        aria-label={`Répondre à ${name}`}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(lead, "conversations");
        }}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-white/80 text-ink-2 shadow-[var(--shadow-glass)] transition-colors hover:bg-white hover:text-ocean sm:flex sm:h-10 sm:w-auto sm:gap-1.5 sm:px-4 sm:text-[13px] sm:font-medium"
      >
        <MessageSquareReply className="size-4" />
        <span className="hidden sm:inline">Répondre</span>
      </button>
    </div>
  );
}
