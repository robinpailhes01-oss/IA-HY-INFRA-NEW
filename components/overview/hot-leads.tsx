import Link from "next/link";
import { CalendarDays, Flame, Users } from "lucide-react";

import { ChannelLogo } from "@/components/leads/channel-logo";
import { CardLink } from "@/components/overview/card-link";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { channelMeta, fullName, initials, scoreClasses } from "@/lib/leads";
import { cn } from "@/lib/utils";

// Les leads les plus chauds : ceux qui ont donné une DATE souhaitée encore à
// venir (une date, c'est une intention), déjà triés par la page — score ↓
// puis date ↑ — et sans les réservés / perdus, qui n'appellent plus d'action.
//
// Des tuiles en deux colonnes plutôt qu'un tableau : on les parcourt d'un
// coup d'œil, et chacune ouvre directement la fiche du lead.

export type HotLead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  source_channel: string | null;
  interested_offer: string | null;
  occasion: string | null;
  party_size: number | null;
  desired_date: string | null;
  score: number | null;
  /** Nom du profil WhatsApp, repli quand le prénom n'est pas encore connu. */
  whatsapp_name: string | null;
};

/** Tuiles visibles sur téléphone : « Tous les leads » mène au reste. */
const MOBILE_VISIBLE = 4;

function desiredLabel(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function HotLeads({
  leads,
  total,
  className,
}: {
  leads: HotLead[];
  /** Nombre exact de leads datés et actionnables (pas seulement les affichés). */
  total?: number;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Leads les plus chauds</CardTitle>
        <CardDescription>Une date de sortie en tête — à convertir en priorité</CardDescription>
        <CardAction>
          <CardLink href="/leads" label="Voir tous les leads" />
        </CardAction>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <EmptyState icon={<Flame />} title="Aucun lead daté pour l'instant">
            Dès qu&apos;un prospect donne une date de sortie, il apparaît ici, classé par score.
          </EmptyState>
        ) : (
          // Téléphone : les MOBILE_VISIBLE premiers (classe littérale pour Tailwind).
          <ul className="grid gap-2.5 md:grid-cols-2 max-md:[&>li:nth-child(n+5)]:hidden">
            {leads.map((l) => {
              // Le site web n'est pas un canal d'acquisition : pas de logo
              // pour lui (le lead vient d'ailleurs, on ne sait pas d'où).
              const channel = l.source_channel === "website" ? null : l.source_channel;
              return (
                <li key={l.id}>
                  <Link
                    href={`/leads?lead=${l.id}`}
                    className="vitre-inset group flex items-center gap-3 rounded-[20px] p-3 outline-none transition-colors duration-200 hover:bg-white focus-visible:ring-4 focus-visible:ring-ocean/20"
                  >
                    <span className="relative shrink-0">
                      <span
                        className={cn(
                          "grid size-10 place-items-center rounded-full text-[12px] font-semibold",
                          channelMeta(l.source_channel).className,
                        )}
                      >
                        {initials(l.first_name, l.last_name, l.whatsapp_name)}
                      </span>
                      {channel && (
                        <span className="absolute -bottom-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full bg-white shadow-[0_1px_3px_rgba(11,37,69,0.15)]">
                          <ChannelLogo channel={channel} className="size-2.5" />
                        </span>
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                          {fullName(l.first_name, l.last_name, l.whatsapp_name)}
                        </span>
                        {l.occasion && (
                          <span className="pastille shrink-0 bg-[rgba(109,124,242,0.1)] font-medium text-indigo">
                            {l.occasion}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex min-w-0 items-center gap-x-2 text-[12px] text-ink-2">
                        {l.desired_date && (
                          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-ocean">
                            <CalendarDays className="size-3" />
                            {desiredLabel(l.desired_date)}
                          </span>
                        )}
                        {l.interested_offer && (
                          <span className="min-w-0 truncate">{l.interested_offer.replace(/\s*\(.*?\)/, "")}</span>
                        )}
                        {l.party_size != null && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 text-ink-3">
                            <Users className="size-3" />
                            {l.party_size}
                          </span>
                        )}
                      </span>
                    </span>

                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums",
                        scoreClasses(l.score),
                      )}
                      title="Score de qualification sur 10"
                      aria-label={`Score ${l.score ?? "inconnu"} sur 10`}
                    >
                      {l.score ?? "—"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      {leads.length > 0 && (
        // Collé en bas (mt-auto) : quand la colonne s'étire sur bureau, la
        // carte finit sur cette ligne de contexte plutôt que sur du vide.
        <CardFooter className="mt-auto justify-between gap-3 text-[12.5px] text-ink-3">
          <span>Classés par score, puis par date souhaitée</span>
          {/* Le compte suit ce qui est réellement affiché : quatre tuiles
              sur téléphone, six au-delà. */}
          {total != null && total > Math.min(MOBILE_VISIBLE, leads.length) && (
            <span className="shrink-0 font-medium text-ink-2">
              <span className="md:hidden">
                {Math.min(MOBILE_VISIBLE, leads.length)} sur {total}
              </span>
              <span className="hidden md:inline">
                {leads.length} sur {total}
              </span>
            </span>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
