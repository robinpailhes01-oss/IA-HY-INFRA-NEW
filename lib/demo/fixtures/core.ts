/* eslint-disable @typescript-eslint/no-explicit-any */
// Données fictives du mode démo — le cœur partagé par toutes les pages :
// clients, leads, conversations WhatsApp, réservations, revenus, dépenses,
// banque, objectifs, météo.
//
// Tout est DÉTERMINISTE (générateur pseudo-aléatoire à graine fixe) et daté
// RELATIVEMENT à aujourd'hui : la démo a toujours l'air vivante, et deux
// rechargements donnent la même chose. Aucune donnée réelle ici.

type Row = Record<string, any>;

// ── Hasard reproductible ────────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261101);
const int = (a: number, b: number) => Math.floor(a + rand() * (b - a + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
let seq = 0;
const uid = (prefix: string) => {
  seq += 1;
  const hex = seq.toString(16).padStart(12, "0");
  return `${prefix.padEnd(8, "0").slice(0, 8)}-0000-4000-8000-${hex}`;
};

// ── Temps ───────────────────────────────────────────────────────────────
const NOW = new Date();
const DAY = 86_400_000;
export const TODAY_ISO = NOW.toISOString().slice(0, 10);
const YEAR = NOW.getUTCFullYear();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY);
const at = (date: string, hh: number, mm = 0) =>
  new Date(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`).toISOString();
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

// ── Référentiels ────────────────────────────────────────────────────────
const FIRST = ["Camille", "Julien", "Sophie", "Thomas", "Lina", "Nicolas", "Manon", "Antoine", "Chloé", "Maxime", "Sarah", "Hugo", "Inès", "Romain", "Clara", "Lucas", "Émilie", "Alexandre", "Pauline", "Mathieu", "Margaux", "Guillaume", "Anaïs", "Benjamin", "Juliette", "Florian", "Océane", "Kevin", "Laura", "Damien", "Elsa", "Quentin", "Marion", "Yann", "Lucie", "Arthur", "Charlotte", "Victor", "Amandine", "Paul"] as const;
const LAST = ["Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Simon", "Michel", "Lefèvre", "Leroy", "Roux", "David", "Bertrand", "Morel", "Fournier", "Girard", "Bonnet", "Dupont", "Lambert", "Fontaine", "Rousseau", "Vincent", "Muller", "Faure", "André", "Mercier", "Blanc", "Guérin", "Boyer", "Garnier", "Chevalier"] as const;

export const OFFERS = [
  { name: "Sortie privative 2h", price: 400, type: "sea_trip", hours: 2 },
  { name: "Sortie privative 3h", price: 600, type: "sea_trip", hours: 3 },
  { name: "Sortie privative 4h", price: 800, type: "sea_trip", hours: 4 },
  { name: "Nuit Insolite (avec sortie en mer)", price: 480, type: "unusual_night", hours: 14 },
  { name: "Nuit Prestige", price: 950, type: "unusual_night", hours: 16 },
] as const;

const OCCASIONS = ["Anniversaire", "EVJF", "Demande en mariage", "Coucher de soleil", "Séminaire", "Entre amis", "Fête des pères", "Saint-Valentin"] as const;
const SLOTS = ["Matinée", "Après-midi", "Coucher de soleil", "Soirée"] as const;

// ── Profil ──────────────────────────────────────────────────────────────
const profiles: Row[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    email: "robin@harmonie-yacht.fr",
    first_name: "Robin",
    role: "admin",
    permissions: null,
    notification_preferences: null,
    created_at: "2025-01-01T00:00:00Z",
  },
];

// ── Clients ─────────────────────────────────────────────────────────────
const customers: Row[] = Array.from({ length: 70 }, (_, i) => {
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7) % LAST.length];
  return {
    id: uid("c0570000"),
    first_name: first,
    last_name: last,
    email: `${first.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${last.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@gmail.com`,
    phone: `+33 6 ${int(10, 99)} ${int(10, 99)} ${int(10, 99)} ${int(10, 99)}`,
    acquisition_channel: pick(["whatsapp", "instagram_organic", "website", "google_organic", "word_of_mouth"]),
    bookings_count: int(1, 3),
    total_spent: 0,
    tier: chance(0.2) ? "gold" : "standard",
    member_number: 1000 + i,
    created_at: daysFromNow(-int(10, 300)).toISOString(),
    updated_at: null,
    lead_id: null,
    ai_memo: null,
    birthday: null,
    instagram_handle: null,
    last_booking_at: null,
    member_card_issued: false,
    member_page_slug: null,
    preferences: null,
    referral_code: null,
    referred_by: null,
  };
});

// ── Leads ───────────────────────────────────────────────────────────────
// Répartition réaliste d'un mois de novembre : la saison est finie, les
// demandes portent sur les fêtes de fin d'année et le printemps.
const LEAD_PLAN: Array<[string, number]> = [
  ["new", 2],
  ["contacted", 3],
  ["qualified", 3],
  ["quote_sent", 3],
  ["followed_up", 2],
  ["booked", 17],
  ["lost", 12],
];
const CHANNELS = ["whatsapp", "whatsapp", "whatsapp", "whatsapp", "instagram_organic", "instagram_organic", "instagram_organic", "website", "google_organic", "tiktok_organic", "chatgpt", "word_of_mouth", "meta_ads"] as const;

const MEMOS = [
  "Anniversaire de sa femme, 6 pers. Veut le coucher de soleil. Très chaud — envoyer le lien de réservation.",
  "EVJF au printemps, 9 personnes. Compare avec une autre activité : insister sur la privatisation complète.",
  "Demande en mariage — veut une surprise discrète, champagne à bord. Prévoir l'option décoration.",
  "Séminaire d'équipe (10 pers.), facture au nom de l'entreprise. Attend un devis formel.",
  "Nuit Insolite pour Noël. A demandé si le chauffage est inclus à bord — oui.",
  "Sensible au prix : lui proposer la réduction matinée (−15 %).",
  "Hésite entre 3 h et 4 h. Recommande 3 h coucher de soleil, meilleur rapport.",
  "A réservé l'an dernier, revient pour l'anniversaire de mariage. Client fidèle.",
];

export const leads: Row[] = [];
let leadIndex = 0;
for (const [status, n] of LEAD_PLAN) {
  for (let k = 0; k < n; k++) {
    const first = FIRST[(leadIndex * 3 + 5) % FIRST.length];
    const last = LAST[(leadIndex * 11 + 3) % LAST.length];
    const active = status !== "booked" && status !== "lost";
    // Hors saison (novembre) : peu de nouvelles demandes. Les pistes actives
    // datent du dernier mois ; les réservées et perdues, de la haute saison.
    const createdAgo = active ? int(0, 29) : int(35, 210);
    const created = daysFromNow(-createdAgo);
    const offer = pick(OFFERS);
    const desiredAhead =
      leadIndex % 9 === 0 ? int(2, 6) : leadIndex % 4 === 0 ? int(40, 70) : int(10, 180);
    const channel = CHANNELS[leadIndex % CHANNELS.length];
    leads.push({
      id: uid("1ead0000"),
      first_name: chance(0.85) ? first : null,
      last_name: chance(0.7) ? last : null,
      email: chance(0.5) ? `${first.toLowerCase()}.${leadIndex}@gmail.com` : null,
      phone: `+3367${String(1000000 + leadIndex * 7919).slice(-7)}`,
      real_phone: null,
      instagram_handle: channel.startsWith("instagram") ? `@${first.toLowerCase()}_${leadIndex}` : null,
      source_channel: channel,
      source_status: null,
      interested_offer: offer.name,
      occasion: chance(0.75) ? pick(OCCASIONS) : null,
      party_size: int(2, 12),
      desired_date: active || status === "booked" ? iso(daysFromNow(desiredAhead)) : iso(daysFromNow(-int(5, 60))),
      desired_time_slot: pick(SLOTS),
      budget_range: null,
      score:
        status === "booked" ? int(8, 10) :
        status === "quote_sent" || status === "qualified" ? int(6, 9) :
        status === "lost" ? int(1, 4) : int(3, 8),
      status,
      needs_human_intervention: active && (leadIndex === 4 || leadIndex === 9),
      last_interaction_at: active ? minutesAgo(int(45, 60 * 24 * 12)) : created.toISOString(),
      last_followup_at: status === "followed_up" ? daysFromNow(-int(1, 5)).toISOString() : null,
      followup_count: status === "followed_up" ? int(1, 2) : 0,
      ai_memo: chance(0.8) ? MEMOS[leadIndex % MEMOS.length] : null,
      notes: chance(0.25) ? "Rappeler en fin de journée, préfère les messages vocaux." : null,
      assigned_to: null,
      archived: false,
      created_at: created.toISOString(),
      updated_at: created.toISOString(),
    });
    leadIndex += 1;
  }
}

// ── Conversations WhatsApp ──────────────────────────────────────────────
const SCRIPTS: string[][] = [
  [
    "Bonjour ! Je voudrais organiser une sortie en mer pour l'anniversaire de ma femme, on serait 6 😊",
    "Bonjour et merci pour votre message 🌊 Avec grand plaisir ! Vous pensez à quelle date ? Nous proposons des sorties privatives de 2 h, 3 h ou 4 h au départ du port de Carnon.",
    "Plutôt un samedi en fin d'après-midi",
    "Le créneau 17 h – 20 h est idéal : c'est l'heure du coucher de soleil face à la Grande-Motte. La sortie 3 h est à 600 € pour le bateau entier, jusqu'à 10 personnes, boissons fraîches incluses.",
    "Super, comment on réserve ?",
    "Je vous envoie le lien de réservation : un acompte de 30 % bloque la date, le solde se règle le jour J. Souhaitez-vous l'option décoration anniversaire (ballons, fleurs) ?",
  ],
  [
    "Bonsoir, la nuit à bord est disponible pour le 24 décembre ?",
    "Bonsoir ! Oui, le 24 décembre est encore libre pour la Nuit Insolite ✨ Le bateau est chauffé, literie hôtelière et petit-déjeuner servi à bord. Vous seriez combien ?",
    "Deux, c'est une surprise pour mon copain",
    "Quelle belle idée 🎄 La Nuit Insolite avec sortie en mer au coucher du soleil est à 480 € pour deux. Je peux vous la bloquer 24 h le temps que vous vous organisiez ?",
  ],
  [
    "Salut ! On est 9 filles pour un EVJF en mai, c'est possible de privatiser le bateau ?",
    "Bonjour ! Oui, le bateau est entièrement privatisé pour votre groupe 🥂 Jusqu'à 12 personnes. Vous avez une date précise en mai ?",
    "Le samedi 22 mai si possible, l'après-midi",
    "Le 22 mai après-midi est disponible. Pour un EVJF je vous conseille la sortie 4 h (800 €) avec escale baignade à la plage de la Maguelone. On peut prévoir enceinte, glacière et décoration.",
    "Ça a l'air top ! Je vois avec les filles et je reviens vers vous",
  ],
  [
    "Combien coûte une sortie de 2h ?",
    "Bonjour ! Une sortie privative de 2 h est à 400 € pour tout le bateau (jusqu'à 10 personnes). Le matin, nous appliquons une réduction de 15 % 🌅",
    "Et c'est possible d'amener notre pique-nique ?",
    "Bien sûr, vous pouvez apporter ce que vous voulez à bord. Nous fournissons glacière, verres et eau fraîche.",
  ],
  [
    "Bonjour, nous cherchons une activité pour un séminaire d'équipe de 10 personnes au printemps",
    "Bonjour ! Avec plaisir. Pour un séminaire, la sortie 3 h ou 4 h fonctionne très bien, avec possibilité d'un apéritif traiteur à bord. Avez-vous des dates en tête ?",
    "Début avril, et il nous faudrait une facture au nom de la société",
    "Aucun souci pour la facture entreprise. Je transmets votre demande à Robin pour un devis sur mesure, il revient vers vous rapidement.",
  ],
  [
    "Et en cas de mauvais temps, comment ça se passe ?",
    "Bonne question ! Si la météo ne permet pas de sortir en sécurité, nous reportons la sortie sans frais à la date de votre choix, ou nous remboursons l'acompte. Robin vérifie la météo marine la veille.",
    "Parfait, merci pour la réponse rapide",
    "Avec plaisir ! N'hésitez pas si vous avez d'autres questions 😊",
  ],
  [
    "Bonjour, vous faites des cartes cadeaux ? Ce serait pour Noël",
    "Bonjour ! Oui 🎁 La carte cadeau est valable 1 an, au montant de la sortie de votre choix : 2 h (400 €), 3 h (600 €) ou 4 h (800 €). Je peux vous envoyer le lien pour la commander.",
    "Parfait, je prends celle de 3 h",
    "Excellent choix ! Voici le lien : harmonie-yacht.fr/carte-cadeau — vous la recevez par e-mail tout de suite, prête à offrir 🎁",
  ],
  [
    "Bonjour, vous êtes ouverts en ce moment ? On cherche une sortie avant la fin du mois",
    "Bonjour ! Oui, nous naviguons encore par beau temps jusqu'à mi-décembre ☀️ La mer est calme et les couchers de soleil sont superbes en cette saison. Vous seriez combien ?",
    "Juste nous deux, un dimanche",
    "Dimanche à 14 h 30 est disponible : sortie 2 h à 400 € pour tout le bateau. Je vous envoie le lien de réservation ?",
  ],
  [
    "Bonjour, ma mère a reçu une carte cadeau pour son anniversaire, comment on choisit la date ?",
    "Bonjour ! Avec plaisir. Donnez-moi le code de la carte (il commence par HY-) et la date qui vous arrange, je regarde les disponibilités 🙂",
    "HY-4821, plutôt au printemps",
    "Merci, votre carte est valide ! Au printemps les week-ends partent vite : je peux vous proposer dès avril. Quel mois vous conviendrait le mieux ?",
  ],
  [
    "Bonjour, on prépare un EVJF pour fin juin, vous avez des disponibilités ?",
    "Bonjour ! Félicitations à la future mariée 🥂 Fin juin, il nous reste quelques samedis. Vous seriez combien ?",
    "On est 8",
    "Parfait, 8 personnes tiennent largement à bord (jusqu'à 12). La sortie 4 h avec baignade est à 800 €. Je vous envoie le détail et les dates libres ?",
  ],
];

// Une fiche sans nom de famille fait « factice » en vitrine : on complète
// de façon déterministe (sans toucher au tirage aléatoire des autres données).
leads.forEach((l, i) => {
  if (l.first_name && !l.last_name) l.last_name = LAST[(i * 7 + 3) % LAST.length];
});


// Ce que la fiche affiche (offre, occasion, personnes, date, mémo) doit dire la
// même chose que la conversation : sinon une vitrine montre un EVJF de 9
// personnes dans le fil et « demande en mariage, 4 personnes » dans la fiche.
const sundayAfter = (days: number) => {
  const d = daysFromNow(days);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return iso(d);
};
// Un élément par script de SCRIPTS (même ordre).
const SCRIPT_META: Array<{ offer: string; occasion: string; party: number; date: string; slot: string; memo: string }> = [
  { offer: "Sortie privative 3h", occasion: "Anniversaire", party: 6, date: `${YEAR + 1}-03-14`, slot: "Coucher de soleil", memo: MEMOS[0] },
  { offer: "Nuit Insolite (avec sortie en mer)", occasion: "Noël en amoureux", party: 2, date: `${YEAR}-12-24`, slot: "Soirée", memo: MEMOS[4] },
  { offer: "Sortie privative 4h", occasion: "EVJF", party: 9, date: `${YEAR + 1}-05-22`, slot: "Après-midi", memo: MEMOS[1] },
  { offer: "Sortie privative 2h", occasion: "Entre amis", party: 4, date: `${YEAR + 1}-04-17`, slot: "Matinée", memo: MEMOS[5] },
  { offer: "Sortie privative 3h", occasion: "Séminaire", party: 10, date: `${YEAR + 1}-04-08`, slot: "Après-midi", memo: MEMOS[3] },
  { offer: "Sortie privative 3h", occasion: "Entre amis", party: 6, date: `${YEAR + 1}-06-05`, slot: "Après-midi", memo: MEMOS[6] },
  { offer: "Carte cadeau 3h", occasion: "Cadeau de Noël", party: 2, date: `${YEAR + 1}-03-20`, slot: "Après-midi", memo: "Veut offrir une carte cadeau 3 h pour Noël. Lien envoyé, attend le paiement." },
  { offer: "Sortie privative 2h", occasion: "Couple", party: 2, date: sundayAfter(9), slot: "Après-midi", memo: "Cherche une sortie avant la fin du mois, dimanche 14 h 30. Lien de réservation proposé." },
  { offer: "Sortie privative 3h", occasion: "Carte cadeau offerte", party: 4, date: `${YEAR + 1}-04-11`, slot: "Après-midi", memo: "A reçu une carte cadeau (HY-4821). Veut une date dès avril." },
  { offer: "Sortie privative 4h", occasion: "EVJF", party: 8, date: `${YEAR + 1}-06-26`, slot: "Après-midi", memo: "EVJF fin juin, 8 personnes. Attend le détail des dates libres." },
];

// Hors saison : une dizaine de fils seulement. Les pistes actives d'abord
// (les plus récentes en tête de liste), puis deux fils de clients déjà passés.
const isActiveLead = (l: Row) => l.status !== "booked" && l.status !== "lost";
const waLeads = [
  ...leads.filter(isActiveLead).slice(0, 8),
  ...leads.filter((l) => !isActiveLead(l) && l.status === "booked").slice(0, 2),
];
// Quel script pour quel fil : 0 et 2 sont ceux qui attendent une réponse,
// 3 est repris par Robin, les autres se sont terminés avec Léa.
const SCRIPT_ORDER = [1, 5, 2, 3, 7, 0, 6, 4, 9, 8];
// Le prénom doit coller à ce que dit la personne (« ma femme », « on est 9
// filles ») : un EVJF organisé par « Hugo » ferait faux en vitrine.
const SCRIPT_PEOPLE: Array<[string, string]> = [
  ["Julien", "Rousseau"], // 0 · anniversaire de sa femme
  ["Chloé", "David"], // 1 · Nuit Insolite, surprise pour son copain
  ["Camille", "Lefèvre"], // 2 · EVJF de 9 filles
  ["Antoine", "Fournier"], // 3 · prix 2 h, pique-nique
  ["Sophie", "Girard"], // 4 · séminaire d'équipe
  ["Thomas", "Garnier"], // 5 · météo
  ["Émilie", "Roux"], // 6 · carte cadeau de Noël
  ["Maxime", "Faure"], // 7 · sortie en couple avant fin novembre
  ["Pauline", "Mercier"], // 8 · carte cadeau reçue
  ["Inès", "Dubois"], // 9 · EVJF fin juin
];
function leadIndexOf(l: Row) {
  return leads.indexOf(l);
}

export const wa_conversations: Row[] = [];
export const wa_messages: Row[] = [];
export const lead_last_message: Row[] = [];

waLeads.forEach((lead, i) => {
  const active = lead.status !== "booked" && lead.status !== "lost";
  // Quatre clients attendent une réponse : ils ont écrit en dernier.
  const awaiting = active && (i === 0 || i === 2);
  const paused = active && i === 3;
  const minutesBack =
    i === 0 ? int(40, 70) :
    i === 1 ? int(110, 170) :
    i === 2 ? int(300, 380) :
    i === 3 ? int(60 * 26, 60 * 30) :
    i < 8 ? int(60 * 24 * 2, 60 * 24 * 9) :
    int(60 * 24 * 12, 60 * 24 * 21);
  const lastAt = new Date(NOW.getTime() - minutesBack * 60_000);
  const scriptIndex = SCRIPT_ORDER[i % SCRIPT_ORDER.length];
  const script = SCRIPTS[scriptIndex];
  const meta = SCRIPT_META[scriptIndex];
  const [firstName, lastName] = SCRIPT_PEOPLE[scriptIndex];
  lead.first_name = firstName;
  lead.last_name = lastName;
  const slug = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (lead.email) lead.email = `${slug(firstName)}.${slug(lastName)}@gmail.com`;
  if (lead.instagram_handle) lead.instagram_handle = `@${slug(firstName)}_${slug(lastName)}`;
  lead.interested_offer = meta.offer;
  lead.occasion = meta.occasion;
  lead.party_size = meta.party;
  lead.desired_time_slot = meta.slot;
  lead.ai_memo = meta.memo;
  if (lead.status !== "lost") lead.desired_date = meta.date;
  const lines = awaiting && script.length % 2 === 0 ? script.slice(0, -1) : script;
  const convId = uid("c0a70000");
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null;

  wa_conversations.push({
    id: convId,
    customer_phone: lead.phone,
    customer_name: name ?? `+33 6 ${String(i).padStart(2, "0")} •• •• ••`,
    is_paused: paused,
    paused_until: paused ? daysFromNow(1).toISOString() : null,
    last_message_at: lastAt.toISOString(),
    lead_id: lead.id,
    unread_count: awaiting ? int(1, 2) : 0,
    created_at: new Date(lastAt.getTime() - lines.length * 9 * 60_000).toISOString(),
  });

  // Un écart fixe par conversation : les messages restent dans l'ordre.
  const gap = int(2, 14) * 60_000;
  lines.forEach((body, j) => {
    const fromMe = j % 2 === 1;
    const t = new Date(lastAt.getTime() - (lines.length - 1 - j) * gap);
    wa_messages.push({
      id: uid("3e550000"),
      conversation_id: convId,
      wa_message_id: `demo-${convId}-${j}`,
      from_me: fromMe,
      is_from_human: fromMe && paused && j === lines.length - 1,
      body,
      created_at: t.toISOString(),
    });
  });

  const last = lines.length - 1;
  lead_last_message.push({
    lead_id: lead.id,
    last_message_at: lastAt.toISOString(),
    last_from_me: last % 2 === 1,
    last_is_from_human: false,
    site_link_sent: i % 3 === 0,
  });
});

// Le nom WhatsApp (pushName) est joint aux leads par la page Leads.
for (const lead of leads) {
  const conv = wa_conversations.find((c) => c.lead_id === lead.id);
  lead.wa_conversations = conv ? { customer_name: conv.customer_name } : null;
}

// Journal multicanal de Léa (une ligne par conversation, tous canaux).
export const conversations: Row[] = leads.map((l) => ({
  id: uid("c0b00000"),
  lead_id: l.id,
  customer_id: null,
  channel: l.source_channel === "whatsapp" ? "whatsapp" : l.source_channel?.startsWith("instagram") ? "instagram" : l.source_channel === "website" ? "website" : chance(0.5) ? "whatsapp" : "email",
  summary: l.ai_memo,
  outcome: l.status === "booked" ? "booked" : l.status === "lost" ? "lost" : null,
  escalation_reason: l.needs_human_intervention ? "Demande de devis sur mesure" : null,
  messages: null,
  created_at: l.created_at,
  updated_at: l.last_interaction_at,
}));

// ── Réservations ────────────────────────────────────────────────────────
// Saisonnalité d'un loueur de bateau méditerranéen : quasi rien l'hiver,
// un pic juillet–août.
const PER_MONTH = [2, 1, 4, 9, 17, 27, 37, 41, 19, 9, 0, 0];

export const bookings: Row[] = [];
function pushBooking(dateIso: string, status: string, opts: Partial<Row> = {}) {
  const offer = opts.offer ?? pick(OFFERS);
  const customer = pick(customers);
  const optionsAmount = chance(0.35) ? pick([50, 80, 120, 150]) : 0;
  const total = offer.price + optionsAmount;
  const deposit = Math.round(total * 0.3);
  const future = dateIso >= TODAY_ISO;
  const depositPaid = future ? chance(0.8) : true;
  const balanceDue = future ? total - deposit : 0;
  const startH = offer.type === "unusual_night" ? 18 : pick([9, 10, 14, 15, 17, 18]);
  const linkedLead = status !== "cancelled" ? leads.find((l) => l.status === "booked" && !bookings.some((b) => b.lead_id === l.id)) : undefined;
  const createdAt = new Date(new Date(`${dateIso}T12:00:00Z`).getTime() - int(6, 60) * DAY);
  const row: Row = {
    id: uid("b00c0000"),
    date: dateIso,
    start_time: `${String(startH).padStart(2, "0")}:00:00`,
    end_time: `${String((startH + Math.min(offer.hours, 5)) % 24).padStart(2, "0")}:00:00`,
    duration_hours: offer.hours,
    offer_name: offer.name,
    booking_type: offer.type,
    party_size: int(2, 10),
    total_amount: total,
    deposit_amount: deposit,
    deposit_paid: depositPaid,
    balance_due: balanceDue,
    balance_due_date: future ? dateIso : null,
    balance_payments: [],
    status,
    reminder_sent: future ? chance(0.3) : true,
    customer_id: customer.id,
    customers: { first_name: customer.first_name, last_name: customer.last_name, email: customer.email, phone: customer.phone },
    lead_id: future && linkedLead ? linkedLead.id : (linkedLead && chance(0.4) ? linkedLead.id : null),
    source_channel: pick(["whatsapp", "instagram_organic", "website", "google_organic", "word_of_mouth", "meta_ads", "tiktok_organic"]),
    payment_method: pick(["stripe", "sumup", "cash", "transfer"]),
    options: optionsAmount ? [{ name: "Décoration", price: optionsAmount }] : null,
    costs: Math.round(total * 0.18),
    net_margin: Math.round(total * 0.82),
    discount_amount: null,
    discount_reason: null,
    is_gift_card: false,
    gift_card_code: null,
    gift_card_recipient_name: null,
    google_calendar_event_id: null,
    stripe_session_id: null,
    contract_signed_at: null,
    contract_signed_by_name: null,
    review_received: !future && chance(0.4),
    review_requested: !future,
    notes: chance(0.15) ? "Champagne à prévoir à bord." : null,
    created_at: createdAt.toISOString(),
    updated_at: createdAt.toISOString(),
    ...opts,
  };
  delete row.offer;
  if (row.lead_id) customer.lead_id = row.lead_id;
  customer.total_spent = (customer.total_spent ?? 0) + total;
  customer.last_booking_at = dateIso;
  bookings.push(row);
  return row;
}

const currentMonth = NOW.getUTCMonth();
for (let m = 0; m <= 11; m++) {
  for (let k = 0; k < PER_MONTH[m]; k++) {
    const day = int(1, 28);
    const date = `${YEAR}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (date >= TODAY_ISO) continue;
    const peak = m >= 5 && m <= 7;
    pushBooking(date, chance(0.04) ? "cancelled" : "completed", {
      offer: peak ? pick(OFFERS.slice(0, 3)) : pick(OFFERS),
    });
  }
}
// À venir : l'hiver (fêtes, nuits à bord) puis les premières réservations du printemps.
const UPCOMING: Array<[number, number]> = [
  [2, 1], [5, 3], [9, 0], [13, 4], [20, 3], [23, 4], [30, 4], [41, 3], [53, 4], [60, 4], [118, 2], [150, 1], [176, 2], [190, 1],
];
UPCOMING.forEach(([ahead, offerIdx], i) => {
  pushBooking(iso(daysFromNow(ahead)), i % 5 === 2 ? "pending" : "confirmed", { offer: OFFERS[offerIdx] });
});
// Une carte cadeau vendue pour Noël.
pushBooking(iso(daysFromNow(64)), "confirmed", {
  offer: OFFERS[1],
  is_gift_card: true,
  gift_card_code: "HY-NOEL-2731",
  gift_card_recipient_name: "Mathilde",
});
void currentMonth;

// ── Revenus ─────────────────────────────────────────────────────────────
export const revenues: Row[] = [];
for (const b of bookings) {
  if (b.status === "cancelled") continue;
  const type = b.booking_type === "unusual_night" ? "unusual_night" : "sea_trip";
  if (b.date < TODAY_ISO) {
    revenues.push({ id: uid("4e000000"), date: b.date, type, amount: b.total_amount, note: b.offer_name, booking_id: b.id, payment_kind: "full", created_at: at(b.date, 19) });
  } else if (b.deposit_paid) {
    const d = b.created_at.slice(0, 10) > TODAY_ISO ? TODAY_ISO : b.created_at.slice(0, 10);
    revenues.push({ id: uid("4e000000"), date: d, type, amount: b.deposit_amount, note: `Acompte — ${b.offer_name}`, booking_id: b.id, payment_kind: "deposit", created_at: at(d, 11) });
  }
}
// E-foil en saison.
for (let m = 5; m <= 8; m++) {
  for (let k = 0; k < 6; k++) {
    const date = `${YEAR}-${String(m + 1).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`;
    if (date < TODAY_ISO) revenues.push({ id: uid("4e000000"), date, type: "efoil", amount: pick([90, 120, 150]), note: "Session e-foil", booking_id: null, payment_kind: "full", created_at: at(date, 16) });
  }
}

// ── Dépenses ────────────────────────────────────────────────────────────
export const expenses: Row[] = [];
function pushExpense(date: string, category: string, amount: number, description: string, recurring = false) {
  if (date > TODAY_ISO) return;
  expenses.push({ id: uid("e0000000"), date, category, amount, description, is_recurring: recurring, recurrence_period: recurring ? "monthly" : null, created_at: at(date, 9), created_by: null, bank_transaction_id: null, linked_booking_id: null, linked_event_id: null, receipt_url: null });
}
for (let m = 0; m <= 11; m++) {
  const mm = String(m + 1).padStart(2, "0");
  const season = PER_MONTH[m];
  pushExpense(`${YEAR}-${mm}-03`, "fixed_monthly", 780, "Place de port — Carnon", true);
  pushExpense(`${YEAR}-${mm}-05`, "fixed_monthly", 214, "Assurance navigation", true);
  pushExpense(`${YEAR}-${mm}-08`, "subscription", 129, "Logiciels (Supabase, Vercel, Claude)", true);
  if (season > 0) pushExpense(`${YEAR}-${mm}-${String(int(10, 27)).padStart(2, "0")}`, "fuel", Math.round(40 * season + int(-40, 60)), "Gasoil");
  if (m >= 3 && m <= 8) pushExpense(`${YEAR}-${mm}-12`, "marketing", int(240, 820), pick(["Campagne Meta — Reels été", "Boost Instagram", "Campagne Google Ads"]));
  if (m >= 5 && m <= 7) pushExpense(`${YEAR}-${mm}-28`, "salary", 2350, "Skipper saisonnier");
  if (m % 3 === 2) pushExpense(`${YEAR}-${mm}-15`, "taxes", int(900, 1500), "URSSAF trimestrielle");
  if (chance(0.45)) pushExpense(`${YEAR}-${mm}-${String(int(1, 27)).padStart(2, "0")}`, "maintenance", int(120, 1400), pick(["Révision moteur", "Antifouling", "Pièces accastillage", "Nettoyage coque"]));
  if (chance(0.3)) pushExpense(`${YEAR}-${mm}-${String(int(1, 27)).padStart(2, "0")}`, "tools", int(30, 260), pick(["Matériel de pont", "Gilets de sauvetage", "Enceinte étanche"]));
}

// ── Objectif de saison ──────────────────────────────────────────────────
const goals: Row[] = [
  {
    id: uid("90a10000"),
    period_start: `${YEAR}-04-01`,
    period_end: `${YEAR}-10-31`,
    period_type: "season",
    target_min: 90000,
    target_medium: 110000,
    target_strong: 135000,
    current_revenue: null,
    notes: null,
    created_at: `${YEAR}-01-10T10:00:00Z`,
  },
];

// ── Banque (Qonto) & santé financière ───────────────────────────────────
const bank_accounts: Row[] = [
  {
    id: "qonto-main",
    name: "Compte principal",
    iban: "FR76 •••• •••• •••• 4821",
    currency: "EUR",
    is_main: true,
    status: "active",
    balance_cents: 3_842_650,
    authorized_balance_cents: 3_842_650,
    balance_updated_at: minutesAgo(95),
    created_at: `${YEAR - 1}-03-01T10:00:00Z`,
    updated_at: minutesAgo(95),
  },
];

const financial_snapshots: Row[] = Array.from({ length: 90 }, (_, i) => {
  const ago = 89 - i;
  const treasury = Math.round(52_000 - i * 150 + Math.sin(i / 6) * 900);
  const burn = 3_100 + Math.round(Math.cos(i / 9) * 180);
  const runway = +(treasury / burn).toFixed(1);
  const outstanding = 6_400 + Math.round(i * 20);
  const revenue30 = Math.max(1_800, Math.round(26_000 - i * 260));
  const expenses30 = Math.round(burn * 1.05);
  // Même barème que supabase/functions/finance-pulse (50 / 25 / 25).
  const scaled = (v: number, target: number, points: number) => Math.min(1, Math.max(0, v / target)) * points;
  const runwayScore = scaled(runway, 6, 50);
  const coverageRatio = +(revenue30 / expenses30).toFixed(2);
  const coverageScore = scaled(coverageRatio, 1.2, 25);
  const securedMonths = +(outstanding / burn).toFixed(1);
  const securedScore = scaled(securedMonths, 2, 25);
  const score = Math.round(runwayScore + coverageScore + securedScore);
  return {
    id: uid("f1550000"),
    date: iso(daysFromNow(-ago)),
    captured_at: daysFromNow(-ago).toISOString(),
    bank_balance: treasury - 1240,
    cash_balance: 1240,
    treasury,
    monthly_burn: burn,
    runway_months: runway,
    outstanding,
    revenue_30d: revenue30,
    expenses_30d: expenses30,
    score,
    score_label: score >= 75 ? "solide" : score >= 55 ? "correct" : score >= 35 ? "tendu" : "critique",
    details: {
      runway: { months: runway, score: Math.round(runwayScore), max: 50 },
      coverage: { ratio: coverageRatio, score: Math.round(coverageScore), max: 25 },
      secured: { months: securedMonths, score: Math.round(securedScore), max: 25 },
    },
    created_at: daysFromNow(-ago).toISOString(),
  };
});

const cash_balance: Row[] = [{ balance: 1240, last_movement_date: iso(daysFromNow(-6)), movement_count: 23 }];

// ── Météo marine (Carnon) ───────────────────────────────────────────────
const weather_cache: Row[] = Array.from({ length: 7 }, (_, i) => {
  const wind = [12, 18, 31, 24, 9, 14, 22][i];
  return {
    id: uid("3ea70000"),
    date: iso(daysFromNow(i)),
    rating: wind < 16 ? "ideal" : wind < 26 ? "acceptable" : "discouraged",
    wind_speed_kmh: wind,
    wind_direction: ["N", "NE", "SE", "S", "NO", "O", "E"][i],
    wave_height_m: +(wind / 40).toFixed(1),
    swell_m: +(wind / 55).toFixed(1),
    water_temp_c: 17 - i * 0.2,
    fetched_at: minutesAgo(40),
  };
});

export const coreFixtures: Record<string, Row[]> = {
  profiles,
  customers,
  leads,
  wa_conversations,
  wa_messages,
  lead_last_message,
  conversations,
  bookings,
  revenues,
  expenses,
  goals,
  bank_accounts,
  financial_snapshots,
  cash_balance,
  weather_cache,
};

// Outils partagés pour les fichiers de fixtures des autres espaces.
export const demo = { rand, int, pick, chance, uid, iso, daysFromNow, minutesAgo, at, NOW, DAY, YEAR, TODAY_ISO, FIRST, LAST };
