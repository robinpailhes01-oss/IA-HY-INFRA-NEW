"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Loader2,
  Mail,
  PartyPopper,
  Ship,
  Sparkles,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatEur } from "@/lib/format";
import { channelLabel } from "@/components/agent/channels";
import { Num } from "@/components/ui/num";
import { ContactAvatar } from "@/components/agent/contact-avatar";
import { ScoreMeter } from "@/components/agent/score-meter";
import { initialsOf } from "@/components/agent/format";
import { stageTone } from "@/components/agent/stages";
import type { ClientCard } from "@/components/agent/inbox/types";

function dateFr(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * La fiche client, à côté du fil : qui est en face, ce qu'il veut, où il en
 * est — et ce que Léa a retenu de lui. Sans elle, répondre obligeait à ouvrir
 * la fiche prospect dans un autre onglet et à perdre le fil.
 */
export function ClientPanel({
  client,
  onClose,
  className,
}: {
  client: ClientCard | null;
  /** Sous xl, la fiche remplace le fil : ce bouton y ramène. */
  onClose: () => void;
  className?: string;
}) {
  if (!client) {
    return (
      // flex (et non grid) : la classe d'affichage passée par l'appelant
      // (« flex » sur téléphone) remplaçait « grid » et décentrait le loader.
      <aside className={cn("vitre flex min-h-0 items-center justify-center rounded-[24px]", className)}>
        <Loader2 className="size-5 animate-spin text-ink-3" aria-label="Chargement de la fiche" />
      </aside>
    );
  }

  const l = client.lead;
  const memo = l?.aiMemo?.trim() || null;
  const facts: Array<{ icon: React.ReactNode; label: string; value: string }> = [];
  if (l?.interestedOffer) facts.push({ icon: <Ship />, label: "Offre visée", value: l.interestedOffer });
  if (l?.occasion) facts.push({ icon: <PartyPopper />, label: "Occasion", value: l.occasion });
  if (l?.partySize) facts.push({ icon: <Users />, label: "Personnes", value: String(l.partySize) });
  const desired = dateFr(l?.desiredDate ?? null);
  if (desired) facts.push({ icon: <CalendarDays />, label: "Date souhaitée", value: desired });
  if (l?.desiredTimeSlot) facts.push({ icon: <Clock3 />, label: "Créneau", value: l.desiredTimeSlot });
  if (l?.email) facts.push({ icon: <Mail />, label: "Email", value: l.email });

  return (
    <aside className={cn("vitre flex min-h-0 flex-col overflow-hidden rounded-[24px]", className)}>
      <div className="scroll-soft relative z-[1] min-h-0 flex-1 overflow-y-auto">
        {/* ── Identité ─────────────────────────────────────────────── */}
        <div className="flex flex-col items-center px-5 pb-5 pt-4 text-center">
          <div className="mb-1 flex w-full justify-start xl:hidden">
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 items-center gap-1.5 rounded-full bg-white/80 px-4 text-[13px] font-medium text-foreground shadow-[var(--shadow-glass)] transition-colors hover:bg-white"
            >
              <ArrowLeft className="size-4" />
              Retour au fil
            </button>
          </div>
          <ContactAvatar initials={initialsOf(client.name, client.phone)} size="lg" tone="navy" />
          <p className="mt-3 text-[17px] font-semibold tracking-[-0.022em] text-foreground">
            {client.name ?? "Contact inconnu"}
          </p>
          <p className="mt-0.5 text-[12.5px] tabular-nums text-ink-3">
            {client.realPhone ?? (client.masked ? "Numéro masqué" : client.phone)}
          </p>
          {l && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {l.status && (
                <span className={cn("pastille", stageTone(l.status).pill)}>
                  <span className="size-1.5 rounded-full" style={{ background: stageTone(l.status).color }} />
                  {stageTone(l.status).label}
                </span>
              )}
              {l.sourceChannel && (
                <span className="pastille bg-[rgba(11,37,69,0.05)] text-ink-2">
                  via {channelLabel(l.sourceChannel)}
                </span>
              )}
            </div>
          )}
          {l && (
            <Link
              href={`/leads?lead=${l.id}`}
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-white/80 px-4 text-[13px] font-medium text-foreground shadow-[var(--shadow-glass)] transition-colors hover:bg-white"
            >
              Ouvrir la fiche lead
              <ArrowUpRight className="size-3.5" />
            </Link>
          )}
        </div>

        <div className="space-y-4 px-4 pb-5">
          {l?.needsHuman && (
            <p className="rounded-[16px] border border-[rgba(224,77,85,0.18)] bg-[rgba(224,77,85,0.06)] px-3.5 py-2.5 text-[12.5px] font-medium leading-snug text-danger">
              Léa t&apos;a passé la main — ce contact attend une réponse de toi.
            </p>
          )}
          {client.masked && !client.realPhone && (
            <p className="rounded-[16px] border border-[rgba(217,130,43,0.2)] bg-[rgba(217,130,43,0.07)] px-3.5 py-2.5 text-[12.5px] leading-snug text-[#8a5214]">
              Numéro masqué par WhatsApp : tu peux répondre ici, pas le rappeler. Son vrai numéro
              reste visible sur ton téléphone.
            </p>
          )}

          {l?.score != null && (
            <div className="vitre-inset flex items-center justify-between gap-3 rounded-[16px] px-3.5 py-3">
              <span className="t-label text-ink-2">Intérêt</span>
              <ScoreMeter score={l.score} />
            </div>
          )}

          {/* Ce que Léa a retenu : la mémoire de l'agent sur ce contact. */}
          {memo && (
            <div className="rounded-[18px] border border-[rgba(47,127,224,0.16)] bg-[linear-gradient(160deg,rgba(47,127,224,0.08),rgba(124,192,245,0.06))] p-3.5">
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-ocean">
                <Sparkles className="size-3.5" strokeWidth={2} />
                Ce que Léa a retenu
              </p>
              <p className="text-[13px] leading-relaxed text-foreground">{memo}</p>
            </div>
          )}

          {l ? (
            facts.length > 0 && (
              <dl className="divide-y divide-[var(--hairline)]">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-center gap-3 py-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[rgba(47,127,224,0.08)] text-ocean [&_svg]:size-[15px]">
                      {f.icon}
                    </span>
                    <dt className="t-label shrink-0 text-ink-2">{f.label}</dt>
                    <dd className="min-w-0 flex-1 truncate text-right text-[13px] font-medium text-foreground">
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )
          ) : (
            <p className="vitre-inset rounded-[16px] px-3.5 py-3 text-[13px] leading-relaxed text-ink-2">
              Aucune fiche prospect rattachée à ce numéro pour l&apos;instant.
            </p>
          )}

          {client.bookings.length > 0 && (
            <div>
              <p className="t-label mb-2 text-ink-2">
                Réservations · {client.bookings.length}
              </p>
              <ul className="space-y-2">
                {client.bookings.map((b) => (
                  <li key={b.id} className="vitre-inset rounded-[16px] px-3.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {b.offer_name ?? "Réservation"}
                      </span>
                      <Num className="n-inline shrink-0 text-[13px] text-foreground">
                        {formatEur(b.total_amount ?? 0)}
                      </Num>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[11.5px]">
                      <span className="text-ink-3">{dateFr(b.date) ?? "Date à définir"}</span>
                      {(b.balance_due ?? 0) > 0 ? (
                        <span className="font-medium text-warning">
                          reste <Num>{formatEur(b.balance_due ?? 0)}</Num>
                        </span>
                      ) : (
                        <span className="font-medium text-success">soldé</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {l?.notes && (
            <div>
              <p className="t-label mb-2 text-ink-2">Notes</p>
              <p className="vitre-inset rounded-[16px] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-foreground">
                {l.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-[1] flex shrink-0 items-center gap-3 border-t border-[var(--hairline)] px-4 py-3.5">
        <span className="text-[12px] text-ink-3">
          {client.messageCount} message{client.messageCount > 1 ? "s" : ""} échangé
          {client.messageCount > 1 ? "s" : ""}
        </span>
      </div>
    </aside>
  );
}
