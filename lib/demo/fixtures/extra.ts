/* eslint-disable @typescript-eslint/no-explicit-any */
// Fixtures complémentaires du mode démo — les outils : événements publics,
// archives clients (relances), désinscriptions.
import { demo } from "@/lib/demo/fixtures/core";

type Row = Record<string, any>;
const { int, pick, uid, iso, daysFromNow, FIRST, LAST } = demo;

const EVENTS: Array<[number, string, string, number, number, number]> = [
  // [dans N jours, titre, thème, prix/pers, places max, inscrits]
  [12, "Coucher de soleil & huîtres", "Dégustation au mouillage", 59, 12, 9],
  [26, "Soirée vin chaud de Noël", "Marché de Noël sur l'eau", 45, 12, 5],
  [60, "Lever de soleil du Nouvel An", "Premier lever de soleil de l'année", 39, 12, 2],
  [-34, "Fête des vendanges en mer", "Vins de Saint-Christol", 55, 12, 12],
];

const events_public: Row[] = [];
const event_bookings: Row[] = [];
EVENTS.forEach(([ahead, title, theme, price, max, seats], i) => {
  const id = uid("e7e00000");
  events_public.push({
    id,
    title,
    theme,
    description: null,
    date: iso(daysFromNow(ahead)),
    start_time: ahead > 50 ? "07:30:00" : "17:00:00",
    end_time: ahead > 50 ? "09:30:00" : "19:30:00",
    price_per_person: price,
    max_participants: max,
    current_bookings: seats,
    total_revenue: seats * price,
    status: "published",
    sumup_payment_link: null,
    cost_estimate: null,
    net_margin: null,
    google_calendar_event_id: null,
    whatsapp_message_template: null,
    created_at: daysFromNow(-40).toISOString(),
    updated_at: null,
  });
  let left = seats;
  let k = 0;
  while (left > 0) {
    const party = Math.min(left, int(1, 3));
    left -= party;
    event_bookings.push({
      id: uid("eb000000"),
      event_id: id,
      first_name: FIRST[(i * 5 + k * 3) % FIRST.length],
      last_name: LAST[(i * 7 + k) % LAST.length],
      email: null,
      phone: null,
      party_size: party,
      total_paid: party * price,
      payment_status: "paid",
      customer_id: null,
      is_member_priority: false,
      sumup_transaction_id: null,
      created_at: daysFromNow(-int(1, 20)).toISOString(),
    });
    k += 1;
  }
});

const legacy_clients: Row[] = Array.from({ length: 36 }, (_, i) => {
  const first = FIRST[(i * 7 + 2) % FIRST.length];
  const last = LAST[(i * 5 + 1) % LAST.length];
  const year = 2023 + (i % 3);
  return {
    id: uid("1e9a0000"),
    first_name: first,
    last_name: last,
    email: i % 5 === 0 ? null : `${first.toLowerCase()}.${last.toLowerCase()}@orange.fr`.normalize("NFD").replace(/[̀-ͯ]/g, ""),
    phone: null,
    offer_summary: pick(["Sortie 2h", "Sortie 3h coucher de soleil", "Nuit à bord", "EVJF 4h"]),
    event_date: `${year}-0${int(5, 9)}-${String(int(1, 28)).padStart(2, "0")}`,
    event_year: year,
    ics_uid: `demo-${i}`,
    raw_description: null,
    source_file: `export-${year}.ics`,
    created_at: daysFromNow(-90).toISOString(),
  };
});

const client_outreach: Row[] = legacy_clients
  .filter((c, i) => c.email && i % 3 === 0)
  .map((c, i) => ({
    id: uid("0e7a0000"),
    legacy_client_id: c.id,
    campaign: "changement_nom_2025",
    status: i % 6 === 5 ? "failed" : "sent",
    sent_at: daysFromNow(-int(5, 40)).toISOString(),
    error: i % 6 === 5 ? "Adresse refusée par le serveur" : null,
    provider: "resend",
    provider_message_id: null,
    email_subject: null,
    email_body_html: null,
    created_at: daysFromNow(-41).toISOString(),
    updated_at: daysFromNow(-5).toISOString(),
  }));

export const extraFixtures: Record<string, Row[]> = {
  events_public,
  event_bookings,
  legacy_clients,
  client_outreach,
  email_unsubscribes: [],
};
