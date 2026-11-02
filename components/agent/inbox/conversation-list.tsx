"use client";

import { Search, Sparkles, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { Segmented } from "@/components/dashboard/segmented";
import { ContactAvatar } from "@/components/agent/contact-avatar";
import { initialsOf, timeAgoShort } from "@/components/agent/format";
import type { Conversation } from "@/components/agent/inbox/types";

export type ListFilter = "all" | "unread" | "paused";

/**
 * La colonne des fils : recherche, filtre, puis une ligne par contact.
 *
 * Chaque ligne répond à trois questions sans ouvrir le fil : qui, de quoi on
 * parlait (le dernier message), et qui tient la conversation — Léa (point
 * océan) ou toi (point ambre, Léa en pause).
 */
export function ConversationList({
  conversations,
  loaded,
  selectedPhone,
  onSelect,
  query,
  onQuery,
  filter,
  onFilter,
  now,
  className,
}: {
  conversations: Conversation[];
  loaded: boolean;
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
  query: string;
  onQuery: (q: string) => void;
  filter: ListFilter;
  onFilter: (f: ListFilter) => void;
  now: number;
  className?: string;
}) {
  const q = query.trim().toLowerCase();
  const visible = conversations.filter((c) => {
    if (filter === "unread" && !((c.unread_count ?? 0) > 0)) return false;
    if (filter === "paused" && !c.is_paused) return false;
    if (!q) return true;
    return `${c.customer_name ?? ""} ${c.customer_phone} ${c.last_message?.body ?? ""}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <aside className={cn("vitre flex min-h-0 flex-col overflow-hidden rounded-[24px]", className)}>
      <div className="relative z-[1] flex flex-col gap-3 p-3 pb-2.5">
        <label className="relative block">
          <span className="sr-only">Rechercher une conversation</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Nom, numéro, message…"
            className="vitre-inset h-11 w-full rounded-full pl-10 pr-4 text-[14px] text-foreground outline-none transition-shadow placeholder:text-ink-3 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-ocean/12"
          />
        </label>
        <Segmented
          value={filter}
          onChange={onFilter}
          className="w-full"
          options={[
            { value: "all", label: "Toutes" },
            { value: "unread", label: "Non lues" },
            { value: "paused", label: "En pause" },
          ]}
        />
      </div>

      <div className="scroll-soft relative z-[1] min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {!loaded ? (
          <ListSkeleton />
        ) : visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] leading-relaxed text-ink-2">
            {q
              ? "Aucune conversation ne correspond à ta recherche."
              : filter === "unread"
                ? "Tout est lu. Léa a répondu à chacun."
                : filter === "paused"
                  ? "Léa tient toutes les conversations."
                  : "Aucune conversation pour le moment — elles arrivent ici dès le premier message WhatsApp."}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {visible.map((c) => (
              <li key={c.id}>
                <Row conv={c} active={c.customer_phone === selectedPhone} onSelect={onSelect} now={now} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function Row({
  conv,
  active,
  onSelect,
  now,
}: {
  conv: Conversation;
  active: boolean;
  onSelect: (phone: string) => void;
  now: number;
}) {
  const unread = conv.unread_count ?? 0;
  const last = conv.last_message;
  // Léa en pause et le client a écrit en dernier : c'est à Robin de répondre.
  const yourTurn = conv.is_paused && last && !last.from_me;
  const prefix = last?.from_me ? (last.is_from_human ? "Toi : " : "Léa : ") : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(conv.customer_phone)}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group flex w-full items-start gap-3 rounded-[18px] px-2.5 py-2.5 text-left transition-[background-color,box-shadow] duration-200",
        active
          ? "bg-white shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.06),0_10px_24px_-14px_rgba(11,37,69,0.35)]"
          : "hover:bg-white/60",
      )}
    >
      <ContactAvatar
        initials={initialsOf(conv.customer_name, conv.customer_phone)}
        tone={active ? "navy" : "ice"}
        badge={
          <span
            className={cn("size-2 rounded-full", conv.is_paused ? "bg-warning" : "bg-ocean")}
            aria-hidden
          />
        }
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-[14px] tracking-[-0.015em] text-foreground",
              unread > 0 || yourTurn ? "font-semibold" : "font-medium",
            )}
          >
            {conv.customer_name ?? conv.customer_phone}
          </span>
          <span
            className={cn(
              "shrink-0 text-[11.5px] tabular-nums",
              unread > 0 ? "font-semibold text-ocean" : "text-ink-3",
            )}
          >
            {timeAgoShort(conv.last_message_at, now)}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span
            className={cn(
              "line-clamp-1 min-w-0 flex-1 text-[12.5px] leading-snug",
              unread > 0 ? "text-foreground" : "text-ink-2",
            )}
          >
            {last ? (
              <>
                {prefix && <span className="text-ink-3">{prefix}</span>}
                {last.body}
              </>
            ) : (
              <span className="text-ink-3">—</span>
            )}
          </span>
          {unread > 0 && (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-ocean px-1.5 text-[10.5px] font-semibold tabular-nums text-white">
              {unread}
            </span>
          )}
        </span>
        <span className="mt-1 flex items-center gap-1 text-[11px] font-medium">
          {conv.is_paused ? (
            <span className={cn("inline-flex items-center gap-1", yourTurn ? "text-warning" : "text-ink-2")}>
              <UserRound className="size-3" strokeWidth={2} />
              {yourTurn ? "À toi de répondre" : "Toi · Léa en pause"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-ocean">
              <Sparkles className="size-3" strokeWidth={2} />
              Léa répond
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function ListSkeleton() {
  return (
    <ul className="flex flex-col gap-1 px-1 pt-1" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-1.5 py-2.5">
          <span className="size-11 shrink-0 animate-pulse rounded-full bg-[rgba(11,37,69,0.06)]" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-2/3 animate-pulse rounded-full bg-[rgba(11,37,69,0.07)]" />
            <span className="block h-2.5 w-full animate-pulse rounded-full bg-[rgba(11,37,69,0.05)]" />
          </span>
        </li>
      ))}
    </ul>
  );
}
