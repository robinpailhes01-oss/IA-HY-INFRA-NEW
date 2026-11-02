/* eslint-disable @typescript-eslint/no-explicit-any */
// Fixtures complémentaires du mode démo — espace « finance ».
// Ajoute ici les tables propres à cet espace (elles s'AJOUTENT aux lignes de
// core.ts pour une table déjà définie). Outils : `demo` dans ./core.
//
// Le cœur (core.ts) fournit déjà la banque (bank_accounts), la caisse
// (cash_balance) et l'historique du score (financial_snapshots). Il manque
// l'état des synchronisations : c'est lui qui permet à la page Finance de dire
// « Qonto synchronisé il y a 1 h » plutôt que d'afficher un solde sans date.
import { demo } from "@/lib/demo/fixtures/core";

type Row = Record<string, any>;
const { minutesAgo, iso, daysFromNow } = demo;

// Une seule ligne par table (contrainte `id = true`, migrations 0029 et 0031).
const qonto_sync_state: Row[] = [
  {
    id: true,
    last_synced_at: minutesAgo(95),
    last_run_at: minutesAgo(95),
    last_error: null,
    transactions_synced: 412,
  },
];

const sumup_sync_state: Row[] = [
  {
    id: true,
    last_synced_at: minutesAgo(190),
    last_payout_date: iso(daysFromNow(-2)),
    last_run_at: minutesAgo(190),
    last_error: null,
    transactions_synced: 138,
    payouts_synced: 61,
  },
];

// ── Les cas qui demandent un geste ──────────────────────────────────────
// Le cœur ne génère que des sorties passées soldées : la carte « Soldes en
// retard », l'onglet « À traiter » du registre et la ligne « Date à fixer »
// d'une carte cadeau n'apparaissaient donc jamais en démo. Dans la vraie
// base, ils existent toujours : un solde encaissé au terminal le jour J et
// jamais marqué, une carte cadeau offerte dont le bénéficiaire n'a pas
// encore choisi sa date.
function booking(over: Row): Row {
  return {
    start_time: "14:00:00",
    end_time: "17:00:00",
    duration_hours: 3,
    booking_type: "sea_trip",
    balance_payments: [],
    reminder_sent: true,
    customer_id: null,
    lead_id: null,
    payment_method: "sumup",
    options: null,
    discount_amount: null,
    discount_reason: null,
    is_gift_card: false,
    gift_card_code: null,
    gift_card_recipient_name: null,
    google_calendar_event_id: null,
    stripe_session_id: null,
    contract_signed_at: null,
    contract_signed_by_name: null,
    review_received: false,
    review_requested: true,
    notes: null,
    ...over,
  };
}

const bookings: Row[] = [
  booking({
    id: "b00cf1a0-0000-4000-8000-000000000001",
    date: iso(daysFromNow(-5)),
    offer_name: "Sortie privative 3h",
    party_size: 6,
    total_amount: 600,
    deposit_amount: 180,
    deposit_paid: true,
    balance_due: 420,
    balance_due_date: iso(daysFromNow(-5)),
    status: "confirmed",
    source_channel: "instagram_organic",
    customers: { first_name: "Hugo", last_name: "Perrin", email: "hugo.perrin@gmail.com", phone: "+33 6 12 48 90 31" },
    costs: 108,
    net_margin: 492,
    created_at: daysFromNow(-26).toISOString(),
    updated_at: daysFromNow(-5).toISOString(),
  }),
  booking({
    id: "b00cf1a0-0000-4000-8000-000000000002",
    date: iso(daysFromNow(-12)),
    start_time: "18:00:00",
    end_time: "08:00:00",
    duration_hours: 14,
    booking_type: "unusual_night",
    offer_name: "Nuit Insolite (avec sortie en mer)",
    party_size: 2,
    total_amount: 480,
    deposit_amount: 144,
    deposit_paid: true,
    balance_due: 336,
    balance_due_date: iso(daysFromNow(-12)),
    status: "confirmed",
    source_channel: "google_organic",
    payment_method: "cash",
    customers: { first_name: "Camille", last_name: "Vidal", email: "camille.vidal@outlook.fr", phone: "+33 7 81 22 54 09" },
    costs: 86,
    net_margin: 394,
    created_at: daysFromNow(-40).toISOString(),
    updated_at: daysFromNow(-12).toISOString(),
  }),
  // Carte cadeau payée en entier, date pas encore choisie.
  booking({
    id: "b00cf1a0-0000-4000-8000-000000000003",
    date: null,
    start_time: null,
    end_time: null,
    duration_hours: 16,
    booking_type: "unusual_night",
    offer_name: "Nuit Prestige",
    party_size: 2,
    total_amount: 950,
    deposit_amount: 950,
    deposit_paid: true,
    balance_due: 0,
    balance_due_date: null,
    status: "confirmed",
    source_channel: "word_of_mouth",
    payment_method: "stripe",
    is_gift_card: true,
    gift_card_code: "HY-NUIT-4417",
    gift_card_recipient_name: "Élodie Marchand",
    customers: { first_name: "Thomas", last_name: "Marchand", email: "t.marchand@gmail.com", phone: "+33 6 45 17 63 28" },
    review_requested: false,
    costs: 171,
    net_margin: 779,
    created_at: daysFromNow(-9).toISOString(),
    updated_at: daysFromNow(-9).toISOString(),
  }),
];

export const financeFixtures: Record<string, Row[]> = {
  qonto_sync_state,
  sumup_sync_state,
  bookings,
};
