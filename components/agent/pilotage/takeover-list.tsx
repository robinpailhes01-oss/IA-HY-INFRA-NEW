import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { ChannelLogo } from "@/components/leads/channel-logo";
import { ContactAvatar } from "@/components/agent/contact-avatar";

export type TakeoverItem = {
  id: string;
  name: string;
  initials: string;
  channel: string | null;
  /** « takeover » : Léa a passé la main · « awaiting » : le client a écrit en dernier. */
  reason: "takeover" | "awaiting";
  /** Phrase courte déjà formatée côté serveur (« a écrit il y a 2 h »). */
  since: string;
  detail: string | null;
  href: string;
};

/**
 * « À reprendre maintenant » : la première question de Robin en ouvrant le
 * tableau de bord — est-ce que quelqu'un attend une réponse de MOI ?
 * Escalades de Léa d'abord, puis les clients qui ont écrit en dernier, du plus
 * ancien au plus récent (celui qui attend depuis le plus longtemps en haut).
 */
export function TakeoverList({ items, total }: { items: TakeoverItem[]; total: number }) {
  return (
    <section className="vitre flex h-full flex-col rounded-[24px] p-5 sm:p-6">
      <div className="relative z-[1] flex items-start justify-between gap-3">
        <div>
          <p className="t-card text-foreground">À reprendre maintenant</p>
          <p className="t-caption mt-0.5 text-ink-3">Escalades de Léa et clients sans réponse</p>
        </div>
        <span
          className={cn(
            "grid h-9 min-w-9 place-items-center rounded-full px-2.5 text-[15px] font-semibold tabular-nums",
            total > 0 ? "bg-[rgba(224,77,85,0.1)] text-danger" : "bg-[rgba(15,159,110,0.1)] text-success",
          )}
        >
          {total}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="relative z-[1] mt-4 flex flex-1 flex-col items-center justify-center gap-2 rounded-[20px] vitre-inset px-6 py-10 text-center">
          <span className="mb-1 grid size-11 place-items-center rounded-full bg-white text-success shadow-[var(--shadow-glass)]">
            <CheckCircle2 className="size-5" />
          </span>
          <p className="text-[14px] font-semibold tracking-[-0.015em] text-foreground">Personne ne t&apos;attend</p>
          <p className="max-w-xs text-[13px] leading-relaxed text-ink-2">
            Léa a répondu à tout le monde et n&apos;a rien escaladé. Profite.
          </p>
        </div>
      ) : (
        <ul className="relative z-[1] mt-3 flex flex-1 flex-col gap-0.5">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={it.href}
                className="group flex min-h-[60px] items-center gap-3 rounded-[18px] px-2 py-2 transition-colors hover:bg-white/70"
              >
                <ContactAvatar
                  initials={it.initials}
                  size="sm"
                  badge={<ChannelLogo channel={it.channel} />}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                      {it.name}
                    </span>
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px]">
                    <span
                      className={cn(
                        "pastille shrink-0",
                        it.reason === "takeover"
                          ? "bg-[rgba(224,77,85,0.1)] text-danger"
                          : "bg-[rgba(217,130,43,0.12)] text-warning",
                      )}
                    >
                      {it.reason === "takeover" ? "Léa t'a passé la main" : it.since}
                    </span>
                    {it.detail && <span className="truncate text-ink-3">{it.detail}</span>}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ocean" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > items.length && (
        <Link
          href="/leads"
          className="relative z-[1] mt-3 inline-flex h-10 items-center justify-center gap-1.5 self-start rounded-full bg-white/75 px-4 text-[13px] font-medium text-foreground shadow-[var(--shadow-glass)] transition-colors hover:bg-white"
        >
          Voir les {total} dans Priorité
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </section>
  );
}
