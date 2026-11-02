"use client";

import Link from "next/link";
import { FileText, Gift, Users, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Num } from "@/components/ui/num";
import { daysBetween, JOURS_COURT, MOIS_ABBR, noonUtc } from "@/components/finance/fin-utils";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

// Une sortie dans une liste : la pastille de date (lue d'abord), l'offre et
// le client, le montant et l'état du paiement, puis les gestes.
//
// La ligne entière ouvre la fiche (si `onOpen`) ; les boutons arrêtent la
// propagation pour ne pas l'ouvrir en même temps. Quand la place manque
// (téléphone, colonne étroite), « Encaisser » devient un cercle de 44 px, le
// contrat passe dans la fiche, et le montant
// et l'état du paiement descendent sur une troisième ligne : en colonne à
// droite, ils réduisaient l'offre et le client à « Sortie privative … »,
// « Juliette Garni… » — précisément ce qu'on vient lire.

export type PayState = { label: string; tone: "due" | "balance" | "paid" | "late" };

const PAY_TONE: Record<PayState["tone"], string> = {
  due: "bg-[rgba(217,130,43,0.12)] text-warning",
  balance: "bg-[rgba(47,127,224,0.1)] text-ocean",
  paid: "bg-[rgba(15,159,110,0.1)] text-success",
  late: "bg-[rgba(224,77,85,0.1)] text-danger",
};

export function DateChip({ iso, todayIso }: { iso: string; todayIso: string }) {
  const d = noonUtc(iso);
  const diff = daysBetween(todayIso, iso);
  const soon = diff >= 0 && diff <= 1;
  return (
    <span
      className={cn(
        "flex w-12 shrink-0 flex-col items-center rounded-[16px] py-1.5 text-center leading-none",
        soon
          ? "bg-[linear-gradient(180deg,#183f6d,#0b2545)] text-white shadow-[0_8px_18px_-10px_rgba(11,37,69,0.7)]"
          : "border border-white bg-white/80 text-foreground shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.06)]",
      )}
    >
      <span className={cn("text-[10px] font-medium", soon ? "text-[#9fd0f7]" : "text-ink-3")}>
        {diff === 0 ? "auj." : diff === 1 ? "dem." : JOURS_COURT[d.getUTCDay()]}
      </span>
      <span className="n-inline mt-1 text-[17px] font-semibold">{d.getUTCDate()}</span>
      <span className={cn("mt-0.5 text-[10px]", soon ? "text-[#9fd0f7]" : "text-ink-3")}>
        {MOIS_ABBR[d.getUTCMonth()]}
      </span>
    </span>
  );
}

export function BookingRow({
  id,
  date,
  todayIso,
  title,
  subtitle,
  partySize,
  amount,
  pay,
  isGiftCard,
  onOpen,
  onSettle,
}: {
  id: string;
  date: string;
  todayIso: string;
  title: string;
  subtitle: string;
  partySize?: number | null;
  /** Montant affiché à droite (total de la sortie, ou solde dû). */
  amount: number | null;
  pay: PayState | null;
  isGiftCard?: boolean;
  onOpen?: () => void;
  onSettle?: () => void;
}) {
  return (
    <li
      onClick={onOpen}
      title={onOpen ? "Modifier cette réservation" : undefined}
      className={cn(
        // La ligne est son propre conteneur (@container) : elle se met en
        // page selon la place que lui laisse SA carte, pas selon l'écran.
        // Dans la colonne étroite du bureau (« Soldes en retard »), le
        // gabarit large coupait l'offre en « Sortie privati… ».
        "@container group/row relative isolate flex items-center gap-3 py-3",
        // Le fond de survol vit sur un pseudo-élément qui déborde de la
        // ligne : arrondir la ligne elle-même courbait aussi son filet.
        onOpen &&
          "cursor-pointer before:pointer-events-none before:absolute before:-inset-x-2.5 before:inset-y-1 before:-z-10 before:rounded-[18px] before:transition-colors hover:before:bg-white/70 active:before:bg-white/80",
      )}
    >
      <DateChip iso={date} todayIso={todayIso} />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[14px] font-medium tracking-[-0.012em] text-foreground">
          <span className="truncate">{title}</span>
          {isGiftCard && <Gift aria-label="Carte cadeau" className="size-3.5 shrink-0 text-gold" />}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-ink-3">
          <span className="truncate">{subtitle}</span>
          {partySize != null && (
            <span className="inline-flex shrink-0 items-center gap-0.5">
              <Users className="size-3" />
              {partySize}
            </span>
          )}
        </p>
        {/* Place étroite : le montant et le paiement, sous le client. */}
        {(amount != null || pay) && (
          <p className="mt-1.5 flex items-center gap-2 @lg:hidden">
            {amount != null && <Num className="n-inline text-[13.5px] text-foreground">{formatEur(amount)}</Num>}
            {pay && <span className={cn("pastille", PAY_TONE[pay.tone])}>{pay.label}</span>}
          </p>
        )}
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1 @lg:flex">
        {amount != null && <Num className="n-inline text-[14px] text-foreground">{formatEur(amount)}</Num>}
        {pay && <span className={cn("pastille", PAY_TONE[pay.tone])}>{pay.label}</span>}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href={`/contrats/${id}`}
          target="_blank"
          title="Voir le contrat de location"
          onClick={(e) => e.stopPropagation()}
          className="hidden size-9 place-items-center rounded-full text-ink-3 transition-colors hover:bg-white hover:text-foreground @sm:grid"
        >
          <FileText className="size-4" />
          <span className="sr-only">Contrat</span>
        </Link>
        {onSettle && (
          <Button
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onSettle();
            }}
            aria-label="Encaisser le solde"
            className="size-11 px-0 @sm:h-9 @sm:w-auto @sm:px-3.5"
          >
            <Wallet />
            <span className="hidden @sm:inline">Encaisser</span>
          </Button>
        )}
      </div>
    </li>
  );
}
