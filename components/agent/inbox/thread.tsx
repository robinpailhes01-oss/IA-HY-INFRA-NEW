"use client";

import { Fragment, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ContactAvatar } from "@/components/agent/contact-avatar";
import { initialsOf } from "@/components/agent/format";
import { isWhatsAppLid } from "@/lib/whatsapp";
import { authorOf, type Author, type Conversation, type Message } from "@/components/agent/inbox/types";

/**
 * Le fil d'une conversation, lu comme sur WhatsApp mais avec une lecture de
 * plus : QUI a écrit chaque message côté Harmonie.
 * · client : verre blanc, à gauche ;
 * · Léa (IA) : dégradé océan, à droite, marqué d'une étincelle ;
 * · Robin : marine, à droite, marqué « Toi ».
 * Sans cette distinction, impossible de relire ce que l'agent a promis.
 */
export function Thread({
  phone,
  conv,
  displayName,
  messages,
  loading,
  reply,
  onReply,
  onSend,
  sending,
  onTogglePause,
  onBack,
  cardOpen,
  onToggleCard,
  onShowCard,
  className,
}: {
  phone: string;
  conv: Conversation | undefined;
  displayName: string;
  messages: Message[];
  loading: boolean;
  reply: string;
  onReply: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  onTogglePause: () => void;
  onBack: () => void;
  cardOpen: boolean;
  onToggleCard: () => void;
  onShowCard: () => void;
  className?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id;
  const paused = conv?.is_paused ?? false;

  // On ne redescend en bas que lorsqu'un NOUVEAU message arrive : le sondage
  // toutes les 3 s ne doit pas arracher la lecture d'un message plus haut.
  // À l'ouverture d'un fil, on y saute sans animation ; ensuite, on glisse.
  const shownFor = useRef<string | null>(null);
  useEffect(() => {
    if (!lastId) return;
    const first = shownFor.current !== phone;
    shownFor.current = phone;
    endRef.current?.scrollIntoView({ behavior: first ? "auto" : "smooth", block: "end" });
  }, [lastId, phone]);

  const masked = isWhatsAppLid(phone);
  const groups = groupMessages(messages);

  return (
    <section className={cn("vitre flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px]", className)}>
      {/* ── En-tête du fil ───────────────────────────────────────────── */}
      <header className="relative z-[1] flex shrink-0 items-center gap-3 border-b border-[var(--hairline)] px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour à la liste"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-white/80 text-foreground shadow-[var(--shadow-glass)] transition-colors hover:bg-white lg:hidden"
        >
          <ArrowLeft className="size-[18px]" />
        </button>
        <ContactAvatar initials={initialsOf(displayName, phone)} size="md" className="hidden sm:inline-grid" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.018em] text-foreground">
            {displayName}
          </p>
          <p className="truncate text-[12px] text-ink-3">
            {masked ? "Numéro masqué par WhatsApp" : <span className="tabular-nums">{phone}</span>}
          </p>
        </div>

        <label
          title="Mettre Léa en pause sur ce fil (24 h)"
          className={cn(
            "flex h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors sm:px-3.5",
            paused
              ? "border-[rgba(217,130,43,0.25)] bg-[rgba(217,130,43,0.08)] text-warning"
              : "border-white/90 bg-white/70 text-ink-2 shadow-[inset_0_1px_0_#fff]",
          )}
        >
          {/* Le libellé complet quand la place le permet ; « Pause » sinon —
              le nom du contact passe avant. */}
          <span className="hidden md:inline xl:hidden 2xl:inline">Mettre Léa en pause</span>
          <span className="md:hidden xl:inline 2xl:hidden">Pause</span>
          <Switch checked={paused} onCheckedChange={onTogglePause} aria-label="Mettre Léa en pause" />
        </label>

        <button
          type="button"
          onClick={onShowCard}
          aria-label="Voir la fiche client"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-white/80 text-ink-2 shadow-[var(--shadow-glass)] transition-colors hover:bg-white hover:text-foreground xl:hidden"
        >
          <PanelRightOpen className="size-[18px]" />
        </button>
        <button
          type="button"
          onClick={onToggleCard}
          aria-label={cardOpen ? "Masquer la fiche client" : "Afficher la fiche client"}
          className="hidden size-11 shrink-0 place-items-center rounded-full bg-white/80 text-ink-2 shadow-[var(--shadow-glass)] transition-colors hover:bg-white hover:text-foreground xl:grid"
        >
          {cardOpen ? <PanelRightClose className="size-[18px]" /> : <PanelRightOpen className="size-[18px]" />}
        </button>
      </header>

      {paused && (
        <div className="relative z-[1] flex shrink-0 items-center gap-3 border-b border-[rgba(217,130,43,0.14)] bg-[rgba(217,130,43,0.06)] px-4 py-2.5">
          <UserRound className="size-4 shrink-0 text-warning" />
          <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-[#8a5214]">
            Léa est en pause sur ce fil{conv?.paused_until ? ` jusqu'à ${untilLabel(conv.paused_until)}` : ""} — c&apos;est toi qui réponds.
          </p>
          <Button size="xs" variant="outline" onClick={onTogglePause} className="shrink-0">
            <Sparkles />
            Réactiver Léa
          </Button>
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────────────── */}
      <div className="scroll-soft relative z-[1] min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {loading && messages.length === 0 ? (
          <div className="grid h-full place-items-center">
            <Loader2 className="size-5 animate-spin text-ink-3" />
          </div>
        ) : messages.length === 0 ? (
          <p className="grid h-full place-items-center text-center text-[13px] text-ink-2">
            Aucun message échangé pour l&apos;instant.
          </p>
        ) : (
          <div className="flex flex-col">
            {groups.map((g, gi) => (
              <Fragment key={g.messages[0].id}>
                {g.dayLabel && (
                  <div className={cn("flex justify-center", gi > 0 ? "mb-4 mt-6" : "mb-4")}>
                    <span className="rounded-full border border-white/90 bg-white/70 px-3 py-1 text-[11px] font-medium text-ink-2 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.05)]">
                      {g.dayLabel}
                    </span>
                  </div>
                )}
                <MessageGroup group={g} first={gi === 0 || Boolean(g.dayLabel)} />
              </Fragment>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* ── Composer ─────────────────────────────────────────────────── */}
      <form
        className="relative z-[1] shrink-0 border-t border-[var(--hairline)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <div className="flex items-center gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Ta réponse</span>
            <input
              value={reply}
              onChange={(e) => onReply(e.target.value)}
              placeholder={paused ? `Écrire à ${displayName}…` : "Répondre (met Léa en pause)…"}
              disabled={sending}
              className="h-12 w-full rounded-full border border-[rgba(11,37,69,0.1)] bg-white/85 px-5 text-[14.5px] text-foreground shadow-[inset_0_1px_2px_rgba(11,37,69,0.04)] outline-none transition-[box-shadow,border-color] placeholder:text-ink-3 focus-visible:border-ocean/50 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-ocean/12 disabled:opacity-60"
            />
          </label>
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            aria-label="Envoyer"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-[linear-gradient(160deg,#1d4c84,#0b2545)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_18px_-8px_rgba(11,37,69,0.6)] transition-[transform,filter,opacity] duration-200 hover:brightness-110 active:scale-95 disabled:opacity-40"
          >
            {sending ? <Loader2 className="size-[18px] animate-spin" /> : <ArrowUp className="size-5" strokeWidth={2.2} />}
          </button>
        </div>
      </form>
    </section>
  );
}

// ── Regroupement ─────────────────────────────────────────────────────────
// Messages consécutifs du même auteur à moins de 6 minutes : une seule
// « bulle-groupe », l'heure et l'auteur écrits une fois sous la dernière.
type Group = { author: Author; messages: Message[]; dayLabel: string | null };

function groupMessages(messages: Message[]): Group[] {
  const groups: Group[] = [];
  let lastDay = "";
  for (const m of messages) {
    const day = new Date(m.created_at).toDateString();
    const author = authorOf(m);
    const prev = groups.at(-1);
    const prevMsg = prev?.messages.at(-1);
    const close =
      prevMsg && new Date(m.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 6 * 60_000;
    if (prev && day === lastDay && prev.author === author && close) {
      prev.messages.push(m);
    } else {
      groups.push({ author, messages: [m], dayLabel: day !== lastDay ? dayLabel(m.created_at) : null });
    }
    lastDay = day;
  }
  return groups;
}

function MessageGroup({ group, first }: { group: Group; first: boolean }) {
  const mine = group.author !== "client";
  const last = group.messages.at(-1)!;
  return (
    <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start", !first && "mt-3.5")}>
      {group.messages.map((m, i) => {
        const tail = i === group.messages.length - 1;
        return (
          <div
            key={m.id}
            className={cn(
              "max-w-[86%] whitespace-pre-wrap break-words rounded-[20px] px-3.5 py-2 text-[14px] leading-[1.45] sm:max-w-[74%]",
              group.author === "client" &&
                "border border-white bg-white/90 text-foreground shadow-[0_1px_2px_rgba(11,37,69,0.06),0_8px_20px_-14px_rgba(11,37,69,0.3)]",
              group.author === "lea" &&
                "bg-[linear-gradient(155deg,#5da5ee_0%,#2f7fe0_55%,#2b72d6_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_20px_-12px_rgba(47,127,224,0.65)]",
              group.author === "human" &&
                "bg-[linear-gradient(160deg,#1d4c84_0%,#0b2545_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_20px_-12px_rgba(11,37,69,0.6)]",
              tail && (mine ? "rounded-br-[6px]" : "rounded-bl-[6px]"),
              m.pending && "opacity-70",
            )}
          >
            {m.body}
          </div>
        );
      })}
      <p className="flex items-center gap-1 px-1.5 text-[11px] text-ink-3">
        {group.author === "lea" && (
          <>
            <Sparkles className="size-3 text-ocean" strokeWidth={2} />
            <span className="font-medium text-ocean">Léa</span>
            <span aria-hidden>·</span>
          </>
        )}
        {group.author === "human" && (
          <>
            <UserRound className="size-3 text-navy" strokeWidth={2} />
            <span className="font-medium text-navy">Toi</span>
            <span aria-hidden>·</span>
          </>
        )}
        <span className="tabular-nums">{last.pending ? "Envoi…" : clock(last.created_at)}</span>
      </p>
    </div>
  );
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function untilLabel(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86_400_000);
  if (d.toDateString() === today.toDateString()) return time;
  if (d.toDateString() === tomorrow.toDateString()) return `demain ${time}`;
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} ${time}`;
}
