"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, CalendarX2, ChevronRight, Gift, History, TriangleAlert, Users } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { PillGroup } from "@/components/finance/pill-group";
import { JOURS_COURT, longDate } from "@/components/finance/fin-utils";
import { DateChip } from "@/components/bookings/booking-row";
import { formatEur, formatTimeRange } from "@/lib/format";
import { bookingStatusBadge } from "@/lib/status";
import type { BalancePayment } from "@/lib/payments";
import {
  BookingEditDialog,
  type EditableBooking,
} from "@/components/bookings/booking-edit-dialog";
import { cn } from "@/lib/utils";

export type BookingTableItem = {
  id: string;
  customerId: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  offerName: string | null;
  customerName: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  partySize: number | null;
  amount: number | null;
  depositAmount: number | null;
  depositPaid: boolean | null;
  balanceDue: number | null;
  balancePayments: BalancePayment[];
  status: string | null;
  sourceChannel: string | null;
  discountAmount: number | null;
  discountReason: string | null;
  contractSigned: boolean;
  isGiftCard: boolean;
  giftCardCode: string | null;
  giftCardRecipientName: string | null;
};

function payment(b: BookingTableItem, todayIso: string): { label: string; className: string } {
  if (b.status === "cancelled") return { label: "—", className: "text-ink-3" };
  if (b.depositPaid === false) return { label: "Acompte dû", className: "text-warning" };
  // Un solde d'une sortie déjà passée est en retard : même rouge que la carte
  // « Soldes en retard », pour qu'une même ligne ne change pas de sens d'une
  // carte à l'autre.
  if ((b.balanceDue ?? 0) > 0)
    return {
      label: `Solde ${formatEur(b.balanceDue)}`,
      className: b.date !== null && b.date < todayIso ? "text-danger" : "text-ocean",
    };
  return { label: "Soldé", className: "text-success" };
}

// Le statut en pastille teintée : la couleur porte le sens (confirmée,
// à confirmer, terminée, annulée), jamais une décoration.
const STATUS_TONE: Record<string, string> = {
  confirmed: "bg-[rgba(47,127,224,0.1)] text-ocean",
  pending: "bg-[rgba(217,130,43,0.12)] text-warning",
  completed: "bg-[rgba(11,37,69,0.06)] text-ink-2",
  cancelled: "bg-[rgba(224,77,85,0.1)] text-danger",
};

function StatusPill({ status }: { status: string | null }) {
  const cfg = bookingStatusBadge(status);
  return (
    <span className={cn("pastille", STATUS_TONE[status ?? ""] ?? "bg-[rgba(11,37,69,0.06)] text-ink-2")}>
      {cfg.label}
    </span>
  );
}

function GiftTag({ b }: { b: BookingTableItem }) {
  if (!b.isGiftCard) return null;
  return (
    <span
      className="pastille bg-[rgba(164,126,44,0.12)] font-mono text-gold"
      title={
        b.giftCardRecipientName
          ? `Carte cadeau — bénéficiaire : ${b.giftCardRecipientName}${b.giftCardCode ? ` · ${b.giftCardCode}` : ""}`
          : `Carte cadeau${b.giftCardCode ? ` · ${b.giftCardCode}` : ""}`
      }
    >
      <Gift className="size-3" />
      {b.giftCardCode ?? "Carte"}
    </span>
  );
}

/** Les petits signaux à côté du nom : contrat signé, canal manquant. */
function Flags({ b }: { b: BookingTableItem }) {
  return (
    <>
      {b.contractSigned && (
        <BadgeCheck className="size-4 shrink-0 text-success" aria-label="Contrat signé" />
      )}
      {!b.sourceChannel && b.status !== "cancelled" && (
        <span title="Canal d'acquisition manquant — à renseigner" className="shrink-0">
          <TriangleAlert className="size-3.5 text-warning" aria-label="Canal d'acquisition manquant" />
        </span>
      )}
    </>
  );
}

// L'historique dépasse vite la centaine de lignes : on en montre une page,
// la suite à la demande.
const PAGE = 30;

// Trois vues qui, ensemble, couvrent TOUTES les réservations :
//   · À traiter — les cartes cadeaux sans date (à honorer) et les sorties
//     passées pas encore soldées ;
//   · À venir — les sorties datées d'aujourd'hui ou plus tard (annulées
//     comprises, barrées : on doit pouvoir les rouvrir) ;
//   · Historique — les sorties passées et closes (soldées ou annulées).
// L'ancien onglet « À traiter » contenait aussi toutes les sorties à venir :
// sur la page, il répétait mot pour mot la liste « À venir » juste au-dessus
// (15 lignes, deux fois, au pouce). La vue par défaut est donc ce qui demande un geste
// s'il y en a, sinon l'historique — ce que le reste de la page ne montre pas.
type View = "todo" | "upcoming" | "history";

export function BookingsTable({
  bookings,
  todayIso,
}: {
  bookings: BookingTableItem[];
  todayIso: string;
}) {
  const [selected, setSelected] = useState<EditableBooking | null>(null);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const { todo, upcoming, history } = useMemo(() => {
    const todo: BookingTableItem[] = [];
    const upcoming: BookingTableItem[] = [];
    const history: BookingTableItem[] = [];
    for (const b of bookings) {
      // Une carte cadeau sans date = toujours à traiter (en attente de
      // réservation par le bénéficiaire).
      if (b.date === null) {
        todo.push(b);
        continue;
      }
      if (b.date >= todayIso) {
        upcoming.push(b);
        continue;
      }
      const isClosed =
        b.status === "cancelled" ||
        (b.depositPaid === true && (b.balanceDue ?? 0) === 0);
      if (isClosed) history.push(b);
      else todo.push(b);
    }
    // À traiter : cartes cadeaux sans date en premier (à honorer), puis
    // les sorties passées, de la plus ancienne à la plus récente.
    todo.sort((a, b) => {
      if (a.date === null && b.date === null) return 0;
      if (a.date === null) return -1;
      if (b.date === null) return 1;
      return a.date.localeCompare(b.date);
    });
    upcoming.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    history.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return { todo, upcoming, history };
  }, [bookings, todayIso]);

  const [view, setView] = useState<View>(() => (todo.length > 0 ? "todo" : "history"));

  const all = view === "todo" ? todo : view === "upcoming" ? upcoming : history;
  const rows = all.slice(0, limit);

  function edit(b: BookingTableItem) {
    setSelected({
      id: b.id,
      customerId: b.customerId,
      customerName: b.customerName,
      customerFirstName: b.customerFirstName,
      customerLastName: b.customerLastName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      offerName: b.offerName,
      sourceChannel: b.sourceChannel,
      partySize: b.partySize,
      totalAmount: b.amount,
      depositAmount: b.depositAmount,
      depositPaid: b.depositPaid,
      balancePayments: b.balancePayments,
      balanceDue: b.balanceDue,
      status: b.status,
      discountAmount: b.discountAmount,
      discountReason: b.discountReason,
      isGiftCard: b.isGiftCard,
      giftCardCode: b.giftCardCode,
      giftCardRecipientName: b.giftCardRecipientName,
    });
    setOpen(true);
  }

  return (
    <>
      <PillGroup
        label="Réservations"
        value={view}
        onChange={(v) => {
          setView(v);
          setLimit(PAGE);
        }}
        // « À traiter » ne s'affiche que s'il y a quelque chose à traiter
        // (ou si on y est) : un onglet à zéro ne dit rien, et trois pilules
        // ne tiennent pas toujours sur un téléphone.
        options={[
          ...(todo.length > 0 || view === "todo"
            ? [{ value: "todo" as const, label: "À traiter", count: todo.length }]
            : []),
          { value: "upcoming", label: "À venir", count: upcoming.length },
          { value: "history", label: "Historique", count: history.length },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={view === "history" ? <History /> : view === "todo" ? <BadgeCheck /> : <CalendarX2 />}
          title={
            view === "todo" ? "Rien à traiter" : view === "upcoming" ? "Aucune sortie à venir" : "Aucune réservation passée"
          }
          className="mt-4"
        >
          {view === "todo"
            ? "Toutes les sorties passées sont soldées et chaque carte cadeau a sa date."
            : view === "upcoming"
              ? "Les prochaines réservations apparaîtront ici dès qu'elles seront saisies."
              : "Les sorties terminées et soldées, et les annulations, viendront se ranger ici."}
        </EmptyState>
      ) : (
        <>
          {/* ── Bureau : le tableau ─────────────────────────────────────── */}
          <div className="mt-4 hidden md:block">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-[var(--hairline)] text-left">
                  {["Date", "Client", "Offre", "Pers.", "Montant", "Paiement", "Statut", ""].map((h, i) => (
                    <th
                      key={i}
                      className={cn(
                        "t-label pb-2.5 font-medium text-ink-3",
                        i === 3 && "text-center",
                        i === 4 && "text-right",
                        i < 7 && "pr-4",
                        i === 7 && "w-6",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const time = formatTimeRange(b.startTime, b.endTime);
                  const pay = payment(b, todayIso);
                  return (
                    <tr
                      key={b.id}
                      onClick={() => edit(b)}
                      title="Modifier cette réservation"
                      className={cn(
                        "group/tr cursor-pointer border-b border-[var(--hairline)] transition-colors last:border-b-0 hover:bg-white/70",
                        b.status === "cancelled" && "text-ink-3",
                      )}
                    >
                      <td className="py-3 pr-4 pl-2">
                        {b.date ? (
                          <div className="flex flex-col">
                            <span className={cn("font-medium", b.status === "cancelled" ? "text-ink-3 line-through" : "text-foreground")}>
                              {JOURS_COURT[new Date(`${b.date}T12:00:00Z`).getUTCDay()]} {longDate(b.date, Number(todayIso.slice(0, 4)))}
                            </span>
                            {time && <span className="text-[12px] text-ink-3">{time}</span>}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-medium text-gold">
                            <Gift className="size-3.5" /> Date à fixer
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">{b.customerName}</span>
                          <GiftTag b={b} />
                          <Flags b={b} />
                        </div>
                      </td>
                      <td className="max-w-[16rem] truncate py-3 pr-4 text-ink-2">{b.offerName ?? "—"}</td>
                      <td className="py-3 pr-4 text-center text-ink-2">{b.partySize ?? "—"}</td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex flex-col items-end">
                          <Num className="n-inline text-foreground">{formatEur(b.amount)}</Num>
                          {b.discountAmount != null && b.discountAmount > 0 && (
                            <span className="text-[11px] text-success" title={b.discountReason ?? "Remise appliquée"}>
                              −<Num>{formatEur(b.discountAmount)}</Num> promo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={cn("font-medium", pay.className)}>{pay.label}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusPill status={b.status} />
                      </td>
                      <td className="py-3 pr-2">
                        <ChevronRight className="size-4 text-ink-3/50 transition-colors group-hover/tr:text-ocean" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Téléphone : une carte par ligne, sans défilement horizontal ── */}
          <ul className="mt-2 divide-y divide-[var(--hairline)] md:hidden">
            {rows.map((b) => {
              const pay = payment(b, todayIso);
              return (
                <li
                  key={b.id}
                  onClick={() => edit(b)}
                  className="relative isolate flex cursor-pointer items-center gap-3 py-3 before:pointer-events-none before:absolute before:-inset-x-2.5 before:inset-y-1 before:-z-10 before:rounded-[18px] before:transition-colors active:before:bg-white/80"
                >
                  {b.date ? (
                    <DateChip iso={b.date} todayIso={todayIso} />
                  ) : (
                    <span className="grid h-[58px] w-12 shrink-0 place-items-center rounded-[16px] bg-[rgba(164,126,44,0.1)] text-gold">
                      <Gift className="size-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[14px] font-medium tracking-[-0.012em] text-foreground">
                      <span className={cn("truncate", b.status === "cancelled" && "text-ink-3 line-through")}>
                        {b.customerName}
                      </span>
                      <Flags b={b} />
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-ink-3">
                      <span className="truncate">{b.date ? b.offerName ?? "Sortie" : "Carte cadeau · date à fixer"}</span>
                      {b.partySize != null && (
                        <span className="inline-flex shrink-0 items-center gap-0.5">
                          <Users className="size-3" />
                          {b.partySize}
                        </span>
                      )}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusPill status={b.status} />
                      <GiftTag b={b} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Num className="n-inline text-[14px] text-foreground">{formatEur(b.amount)}</Num>
                    <span className={cn("text-[12px] font-medium", pay.className)}>{pay.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>

          {all.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE * 2)}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-white/60 px-4 text-[13px] font-medium text-ink-2 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.06)] outline-none transition-colors hover:bg-white hover:text-foreground focus-visible:ring-4 focus-visible:ring-ocean/20 sm:h-10"
            >
              Afficher la suite · {all.length - limit} réservation{all.length - limit > 1 ? "s" : ""}
            </button>
          )}
        </>
      )}

      <BookingEditDialog booking={selected} open={open} onOpenChange={setOpen} />
    </>
  );
}
