import { CircleAlert, HandCoins } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Num } from "@/components/ui/num";
import { BalanceAgenda } from "@/components/bookings/balance-agenda";
import { BookingsBrief } from "@/components/bookings/bookings-brief";
import { UpcomingBookingsList, type UpcomingItem } from "@/components/bookings/upcoming-bookings-list";
import type { SettleTarget } from "@/components/bookings/settle-balance-dialog";
import type { EditableBooking } from "@/components/bookings/booking-edit-dialog";
import {
  BookingsTable,
  type BookingTableItem,
} from "@/components/bookings/bookings-table";
import { AddBookingDialog } from "@/components/bookings/add-booking-dialog";
import { AddGiftCardDialog } from "@/components/bookings/add-gift-card-dialog";
import { WeekBars } from "@/components/finance/week-bars";
import { isoAddDays, shortDate } from "@/components/finance/fin-utils";
import { parsePayments } from "@/lib/payments";
import { formatEur } from "@/lib/format";

// RÉSERVATIONS — le carnet des sorties et l'argent qui va avec.
//
//   1. le point de Léa : le planning, les acomptes à réclamer, les retards ;
//   2. les sorties à venir (filtrables : solde à encaisser, acompte dû) et,
//      à côté, l'argent qui va rentrer semaine par semaine ;
//   3. les soldes passés jamais saisis, s'il y en a ;
//   4. le registre complet (à traiter / à venir / historique).

const CONFIRMED = new Set(["confirmed", "completed"]);

type BookingRow = {
  id: string;
  customer_id: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  offer_name: string | null;
  party_size: number | null;
  total_amount: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean | null;
  balance_due: number | null;
  balance_payments: unknown;
  status: string | null;
  source_channel: string | null;
  discount_amount: number | null;
  discount_reason: string | null;
  contract_signed_at: string | null;
  is_gift_card: boolean | null;
  gift_card_code: string | null;
  gift_card_recipient_name: string | null;
  customers: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "Client";
}

export default async function BookingsPage() {
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, customer_id, date, start_time, end_time, offer_name, party_size, total_amount, deposit_amount, deposit_paid, balance_due, balance_payments, status, source_channel, discount_amount, discount_reason, contract_signed_at, is_gift_card, gift_card_code, gift_card_recipient_name, customers(first_name, last_name, email, phone)",
    )
    .order("date", { ascending: true })
    .returns<BookingRow[]>();

  const bookings = data ?? [];
  const confirmees = bookings.filter((b) => CONFIRMED.has(b.status ?? "")).length;
  // À venir : on exclut les cartes cadeaux sans date (= en attente de réservation).
  const aVenir = bookings.filter(
    (b) => b.date !== null && b.date >= todayIso && b.status !== "cancelled",
  ).length;
  const resteDe = (b: BookingRow) =>
    (b.deposit_paid ? 0 : b.deposit_amount ?? 0) + (b.balance_due ?? 0);
  const nonAnnulees = bookings.filter((b) => b.status !== "cancelled");
  // « Reste à encaisser » = uniquement l'argent pas encore perçu sur des sorties
  // À VENIR. Y mélanger les sorties passées rendait le chiffre illisible : il
  // affichait 1 919 € quand seuls ~500 € concernaient vraiment des sorties à
  // venir, le reste étant des soldes déjà perçus sur place mais jamais marqués.
  // Une date absente (carte cadeau pas encore planifiée) compte comme à venir —
  // la sortie n'a pas eu lieu, l'argent reste attendu.
  const resteAEncaisser = nonAnnulees
    .filter((b) => b.date === null || b.date >= todayIso)
    .reduce((sum, b) => sum + resteDe(b), 0);
  // Les sorties passées non soldées ne disparaissent pas pour autant : elles
  // sortent de ce total mais restent listées plus bas (« Soldes en retard »,
  // et l'onglet « À traiter » du registre).

  // (L'ancienne liste « Soldes à encaisser » — sorties à venir avec un solde
  // dû — est désormais le filtre « Solde à encaisser » de la liste À venir :
  // mêmes lignes, même bouton, sans les afficher deux fois.)

  // Sorties déjà passées dont le solde n'a jamais été marqué comme encaissé.
  // Presque toujours de l'argent bien perçu le jour J (espèces ou terminal)
  // mais jamais enregistré — d'où l'intérêt de pouvoir le solder en un clic.
  const enRetard: SettleTarget[] = bookings
    .filter(
      (b) =>
        b.status !== "cancelled" &&
        b.date !== null &&
        b.date < todayIso &&
        (b.balance_due ?? 0) > 0,
    )
    .map((b) => ({
      id: b.id,
      customerName: fullName(
        b.customers?.first_name ?? null,
        b.customers?.last_name ?? null,
      ),
      offerName: b.offer_name,
      date: b.date!,
      balanceDue: b.balance_due ?? 0,
      sourceChannel: b.source_channel,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Toutes les sorties à venir, payées ou non — contrairement à toCollect
  // (ci-dessus) qui ne garde que celles avec un solde à percevoir.
  const upcomingAll: UpcomingItem[] = bookings
    .filter((b) => b.status !== "cancelled" && b.date !== null && b.date >= todayIso)
    .map((b) => ({
      id: b.id,
      date: b.date!,
      offerName: b.offer_name,
      customerName: fullName(
        b.customers?.first_name ?? null,
        b.customers?.last_name ?? null,
      ),
      partySize: b.party_size,
      amount: b.total_amount,
      balanceDue: b.balance_due,
      depositPaid: b.deposit_paid,
      sourceChannel: b.source_channel,
      isGiftCard: Boolean(b.is_gift_card),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Les réservations annulées restent visibles (onglet Historique) — on doit
  // toujours pouvoir les rouvrir ou vérifier ce qui s'est passé.
  const tableItems: BookingTableItem[] = bookings.map((b) => ({
    id: b.id,
    customerId: b.customer_id,
    date: b.date,
    startTime: b.start_time,
    endTime: b.end_time,
    offerName: b.offer_name,
    customerName: fullName(
      b.customers?.first_name ?? null,
      b.customers?.last_name ?? null,
    ),
    customerFirstName: b.customers?.first_name ?? null,
    customerLastName: b.customers?.last_name ?? null,
    customerEmail: b.customers?.email ?? null,
    customerPhone: b.customers?.phone ?? null,
    partySize: b.party_size,
    amount: b.total_amount,
    depositAmount: b.deposit_amount,
    depositPaid: b.deposit_paid,
    balanceDue: b.balance_due,
    balancePayments: parsePayments(b.balance_payments),
    status: b.status,
    sourceChannel: b.source_channel,
    discountAmount: b.discount_amount,
    discountReason: b.discount_reason,
    contractSigned: Boolean(b.contract_signed_at),
    isGiftCard: Boolean(b.is_gift_card),
    giftCardCode: b.gift_card_code,
    giftCardRecipientName: b.gift_card_recipient_name,
  }));

  // Données éditables indexées par id — permet d'ouvrir l'édition depuis
  // « Soldes à encaisser » (clic sur une ligne) comme depuis la table.
  const editableById: Record<string, EditableBooking> = Object.fromEntries(
    tableItems.map((b) => [
      b.id,
      {
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
      },
    ]),
  );

  // ── Ce qui va rentrer, par tranches de 7 jours à partir d'aujourd'hui ─
  // Des fenêtres glissantes plutôt que des semaines calendaires : un
  // dimanche, « cette semaine » n'aurait compté que la journée en cours.
  // Même définition que le reste à encaisser (acompte non payé + solde dû
  // des sorties à venir non annulées) : la somme des capsules, plus ce qui
  // tombe au-delà de six semaines et les cartes cadeaux sans date, redonne
  // exactement le total.
  const futureDated = nonAnnulees.filter((b) => b.date !== null && b.date >= todayIso);
  const weeks = Array.from({ length: 6 }, (_, w) => {
    const from = isoAddDays(todayIso, w * 7);
    const to = isoAddDays(todayIso, w * 7 + 7);
    const inWeek = futureDated.filter((b) => b.date! >= from && b.date! < to);
    return {
      label: w === 0 ? "7 jours" : shortDate(from),
      amount: inWeek.reduce((sum, b) => sum + resteDe(b), 0),
      count: inWeek.length,
    };
  });
  const thisWeekCount = weeks[0].count;

  const upcomingOpen = nonAnnulees.filter((b) => b.date === null || b.date >= todayIso);
  const balancesToCollect = upcomingOpen.reduce((sum, b) => sum + (b.balance_due ?? 0), 0);
  const unpaidDeposits = upcomingOpen.filter((b) => !b.deposit_paid && (b.deposit_amount ?? 0) > 0);
  const depositsDue = {
    count: unpaidDeposits.length,
    amount: unpaidDeposits.reduce((sum, b) => sum + (b.deposit_amount ?? 0), 0),
  };
  const next = upcomingAll[0] ?? null;
  const nextRow = next ? bookings.find((b) => b.id === next.id) : null;

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        eyebrow="Finance · Réservations"
        title={
          <>
            Les <em>réservations</em>
          </>
        }
        description={`${confirmees} sortie${confirmees > 1 ? "s" : ""} confirmée${confirmees > 1 ? "s" : ""} ou terminée${confirmees > 1 ? "s" : ""} depuis le début. Touche une ligne pour la modifier.`}
        actions={
          // Même gabarit que la Vue d'ensemble : 44 px au pouce, l'action
          // principale (marine) à droite.
          <div className="grid w-full grid-cols-2 gap-2 [&>button]:h-11 [&>button]:px-4 sm:flex sm:w-auto sm:[&>button]:h-10">
            <AddGiftCardDialog />
            <AddBookingDialog />
          </div>
        }
      />

      <BookingsBrief
        upcomingCount={aVenir}
        thisWeekCount={thisWeekCount}
        next={
          next
            ? {
                date: next.date,
                startTime: nextRow?.start_time ?? null,
                offerName: next.offerName,
                customerName: next.customerName,
              }
            : null
        }
        depositsDue={depositsDue}
        // La tuile « En retard » compte les lignes de la carte « Soldes en
        // retard » : son montant est donc la somme de CES soldes — y ajouter
        // les acomptes passés jamais payés affichait un total que la carte
        // ne permet pas de retrouver.
        late={{ count: enRetard.length, amount: enRetard.reduce((sum, b) => sum + b.balanceDue, 0) }}
      />

      {/* Deux colonnes indépendantes sur bureau ; sur téléphone
          (display: contents + order) : l'argent à venir d'abord, puis les
          soldes en retard — courts, et ce sont eux qui demandent un geste —,
          la longue liste des sorties à venir en dernier. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
        <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-5">
          <Card className="rise order-3 lg:order-none">
            <CardHeader>
              <CardTitle>À venir</CardTitle>
              <CardDescription>Toutes les sorties confirmées à venir, payées ou non</CardDescription>
            </CardHeader>
            <CardContent>
              <UpcomingBookingsList items={upcomingAll} todayIso={todayIso} editableById={editableById} />
            </CardContent>
          </Card>
        </div>

        <div className="contents lg:sticky lg:top-5 lg:col-span-5 lg:flex lg:flex-col lg:gap-5">
          <Card className="rise order-1 lg:order-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-[rgba(34,167,191,0.12)] text-aqua">
                  <HandCoins className="size-4" />
                </span>
                Reste à encaisser
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Num className="n-hero n-gradient block w-fit pb-1">{formatEur(resteAEncaisser)}</Num>
              <p className="t-caption mt-1 text-ink-3">Sur les sorties à venir · par tranches de 7 jours</p>
              <WeekBars weeks={weeks} className="mt-6" />
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--hairline)] pt-4">
                <div className="min-w-0">
                  <dt className="t-label text-ink-3">Soldes le jour J</dt>
                  <dd className="mt-1">
                    <Num className="n-inline text-[16px] text-foreground">{formatEur(balancesToCollect)}</Num>
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="t-label text-ink-3">Acomptes à réclamer</dt>
                  <dd className="mt-1">
                    <Num className={depositsDue.amount > 0 ? "n-inline text-[16px] text-warning" : "n-inline text-[16px] text-foreground"}>
                      {formatEur(depositsDue.amount)}
                    </Num>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Les soldes passés jamais marqués payés : ils sortent du « reste
              à encaisser » mais restent ici, à régulariser en un clic. */}
          {enRetard.length > 0 && (
            <Card className="rise order-2 lg:order-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-full bg-[rgba(224,77,85,0.1)] text-danger">
                    <CircleAlert className="size-4" />
                  </span>
                  Soldes en retard
                </CardTitle>
                <CardDescription>
                  Des sorties passées dont le solde n&apos;a jamais été marqué payé. Si l&apos;argent a bien été
                  perçu le jour J, encaisse-le ici pour que les chiffres redeviennent justes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BalanceAgenda items={enRetard} todayIso={todayIso} late editableById={editableById} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card className="rise">
        <CardHeader>
          <CardTitle>Toutes les réservations</CardTitle>
          <CardDescription>
            {tableItems.length} enregistrée{tableItems.length > 1 ? "s" : ""} · annulées comprises, barrées
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BookingsTable bookings={tableItems} todayIso={todayIso} />
        </CardContent>
      </Card>
    </div>
  );
}
