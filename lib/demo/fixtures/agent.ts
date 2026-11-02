/* eslint-disable @typescript-eslint/no-explicit-any */
// Fixtures complémentaires du mode démo — espace « Agent WhatsApp ».
//
// Ce fichier fait trois choses, toutes limitées aux tables de l'agent (aucune
// autre page ne lit wa_messages, wa_conversations, hub_credit_ledger ni
// email_log — vérifié par grep au moment de l'écriture) :
//
// 1. Il donne un rythme réaliste aux fils WhatsApp de core.ts. Là-bas, les
//    messages d'un fil sont espacés d'un écart FIXE (2 à 14 min) : l'ordre
//    est bon, mais Léa y mettait autant de temps à répondre que le client à
//    écrire — le « temps de réponse médian » du Pilotage n'aurait rien
//    mesuré. On les respace ici (Léa : 1–3 min ; client : 4–26 min), dans
//    l'ordre du script, en gardant l'heure du dernier message.
// 2. Il ajoute un mois d'historique : des conversations terminées (leads
//    réservés ou perdus), pour que l'activité sur 30 jours et le temps de
//    réponse aient une vraie matière. Uniquement des leads INACTIFS : aucune
//    n'apparaît dans « à reprendre » ni dans la cloche.
// 3. Il remplit les tables de la page Résultats (crédits IA, emails).
//
// Tout reste déterministe (graine fixe, propre à ce fichier : l'ordre
// d'évaluation des autres fichiers de fixtures ne change rien ici).
import {
  conversations,
  demo,
  leads,
  OFFERS,
  wa_conversations,
  wa_messages,
} from "@/lib/demo/fixtures/core";

type Row = Record<string, any>;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(4521);
const int = (a: number, b: number) => Math.floor(a + rand() * (b - a + 1));
const MIN = 60_000;
const NOW = demo.NOW.getTime();

// ── 1. Le rythme des fils de core.ts ─────────────────────────────────────
// Léa répond en une à trois minutes ; le client, quand il veut.
for (const conv of wa_conversations) {
  const thread = wa_messages
    .filter((m) => m.conversation_id === conv.id)
    .sort((a, b) => {
      const ja = Number(String(a.wa_message_id).split("-").pop());
      const jb = Number(String(b.wa_message_id).split("-").pop());
      return ja - jb;
    });
  if (thread.length === 0) continue;
  let t = new Date(conv.last_message_at).getTime();
  for (let j = thread.length - 1; j >= 0; j--) {
    thread[j].created_at = new Date(t).toISOString();
    const current = thread[j];
    // Écart avec le message précédent : une réponse de Léa suit vite le
    // client ; une réponse humaine, moins ; le client prend son temps.
    const gap = current.from_me ? (current.is_from_human ? int(18, 55) : int(1, 3)) : int(4, 26);
    t -= gap * MIN + int(5, 50) * 1000;
  }
  conv.created_at = thread[0].created_at;
}

// ── 2. Un mois d'historique ──────────────────────────────────────────────
const withConversation = new Set(wa_conversations.map((c) => c.lead_id));
const finished = leads.filter(
  (l) => (l.status === "booked" || l.status === "lost") && !withConversation.has(l.id),
);

function priceOf(offerName: string | null): number {
  return OFFERS.find((o) => o.name === offerName)?.price ?? 600;
}

function bookedScript(l: Row): Array<{ me: boolean; human?: boolean; body: string }> {
  const who = l.first_name ? ` ${l.first_name}` : "";
  const offer = l.interested_offer ?? "Sortie privative 3h";
  return [
    { me: false, body: `Bonjour, je voudrais réserver la ${offer.toLowerCase()} pour ${l.party_size ?? 4} personnes` },
    { me: true, body: `Bonjour${who} ! Avec grand plaisir 🌊 Vous pensez à quelle date ? Le départ se fait du port de Carnon.` },
    { me: false, body: "Plutôt un samedi, en fin de journée si c'est possible" },
    { me: true, body: `Le créneau du coucher de soleil est encore libre ce samedi. La ${offer} est à ${priceOf(offer)} € pour le bateau entier, boissons fraîches incluses. Je vous envoie le lien de réservation ?` },
    { me: false, body: "Oui, parfait !" },
    { me: true, body: "Voici le lien : harmonie-yacht.fr/reserver — un acompte de 30 % bloque la date, le solde se règle le jour J." },
    { me: false, body: "C'est réservé, merci beaucoup 🙏" },
    { me: true, body: "Merci à vous ! Robin vous accueillera au ponton 15 minutes avant le départ ⛵" },
  ];
}

function lostScript(l: Row): Array<{ me: boolean; human?: boolean; body: string }> {
  const who = l.first_name ? ` ${l.first_name}` : "";
  return [
    { me: false, body: "Bonjour, c'est combien pour une sortie en mer ?" },
    { me: true, body: "Bonjour ! Une sortie privative de 2 h est à 400 € pour tout le bateau, jusqu'à 10 personnes. Le matin, nous appliquons −15 % 🌅" },
    { me: false, body: "D'accord, je vais en parler autour de moi" },
    { me: true, body: "Bien sûr ! Je reste disponible si vous avez la moindre question." },
    { me: true, body: `Bonjour${who}, je reviens vers vous pour votre projet de sortie en mer. Souhaitez-vous que je vous bloque une date ?` },
    { me: false, body: "Finalement on a choisi autre chose, merci quand même" },
    { me: true, body: "Je comprends, merci de votre retour — et à bientôt peut-être sur l'eau 😊" },
  ];
}

const extraConversations: Row[] = [];
const extraMessages: Row[] = [];
const extraLastMessages: Row[] = [];

finished.slice(0, 22).forEach((lead, i) => {
  const script = lead.status === "booked" ? bookedScript(lead) : lostScript(lead);
  // Un fil sur quatre : Robin prend la main pour confirmer lui-même.
  if (lead.status === "booked" && i % 4 === 0) {
    script.push({ me: true, human: true, body: "Bonjour, c'est Robin, le capitaine. Je confirme pour samedi — à très vite à bord !" });
  }
  // Dernière activité répartie sur les 30 jours.
  const endAt = NOW - (1.2 + i * 1.3) * 86_400_000 - int(30, 600) * MIN;
  const convId = demo.uid("c0a70000");
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null;

  // Construit le fil à rebours depuis la fin, avec un saut d'un jour avant
  // la relance de Léa (script « perdu »).
  const stamps: number[] = [];
  let t = endAt;
  for (let j = script.length - 1; j >= 0; j--) {
    stamps[j] = t;
    const cur = script[j];
    const prev = script[j - 1];
    const relaunch = cur.me && prev?.me && !cur.human;
    const gap = relaunch ? int(20, 30) * 60 : cur.me ? (cur.human ? int(25, 70) : int(1, 3)) : int(5, 90);
    t -= gap * MIN + int(5, 50) * 1000;
  }

  extraConversations.push({
    id: convId,
    customer_phone: lead.phone,
    customer_name: name ?? `+33 6 ${String(40 + i).padStart(2, "0")} •• •• ••`,
    is_paused: false,
    paused_until: null,
    last_message_at: new Date(endAt).toISOString(),
    lead_id: lead.id,
    unread_count: 0,
    created_at: new Date(stamps[0]).toISOString(),
  });
  script.forEach((m, j) => {
    extraMessages.push({
      id: demo.uid("3e550000"),
      conversation_id: convId,
      wa_message_id: `demo-${convId}-${j}`,
      from_me: m.me,
      is_from_human: Boolean(m.human),
      body: m.body,
      created_at: new Date(stamps[j]).toISOString(),
    });
  });
  const last = script[script.length - 1];
  extraLastMessages.push({
    lead_id: lead.id,
    last_message_at: new Date(endAt).toISOString(),
    last_from_me: last.me,
    last_is_from_human: Boolean(last.human),
    site_link_sent: lead.status === "booked",
  });
  lead.wa_conversations = { customer_name: name };
});

// Le journal multicanal (`conversations`) porte aussi le fil, au format de la
// fiche lead (from: client | ai | human). core.ts le laisse vide : on le
// recopie depuis WhatsApp pour que l'onglet Conversations de la fiche montre
// de vraies bulles en démo.
const allWaConversations = [...wa_conversations, ...extraConversations];
const allWaMessages = [...wa_messages, ...extraMessages];
for (const row of conversations) {
  if (row.messages || row.channel !== "whatsapp") continue;
  const conv = allWaConversations.find((c) => c.lead_id === row.lead_id);
  if (!conv) continue;
  row.messages = allWaMessages
    .filter((m) => m.conversation_id === conv.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => ({
      from: m.from_me ? (m.is_from_human ? "human" : "ai") : "client",
      text: m.body,
      at: m.created_at,
    }));
}

// ── 3. Page Résultats ────────────────────────────────────────────────────
// Crédits IA : un événement par réponse générée, sur six mois.
const hub_credit_ledger: Row[] = Array.from({ length: 460 }, (_, i) => {
  const r = rand();
  const channel = r < 0.78 ? "whatsapp_baileys" : r < 0.93 ? "instagram" : "facebook";
  const daysAgo = Math.floor(Math.pow(rand(), 1.4) * 180);
  const tokensIn = int(900, 4200);
  const tokensOut = int(80, 420);
  return {
    id: demo.uid("c4ed0000"),
    agent_id: "lea",
    workspace_id: "harmonie-yacht",
    channel_type: channel,
    conversation_id: null,
    event_type: i % 9 === 0 ? "followup" : "reply",
    credits: +(0.4 + rand() * 1.8).toFixed(2),
    tokens_input: tokensIn,
    tokens_output: tokensOut,
    occurred_at: new Date(NOW - daysAgo * 86_400_000 - int(0, 1_400) * MIN).toISOString(),
  };
});

// Emails envoyés par Léa (devis, relances) aux leads qui ont laissé une adresse.
const withEmail = leads.filter((l) => l.email);
const email_log: Row[] = Array.from({ length: 74 }, (_, i) => {
  const lead = withEmail[i % withEmail.length];
  const kind = i % 3 === 0 ? "followup" : i % 3 === 1 ? "quote" : "reply";
  return {
    id: demo.uid("e3a10000"),
    lead_id: lead?.id ?? null,
    to_email: lead?.email ?? "client@example.com",
    source: kind === "followup" ? "lea-followups" : kind === "quote" ? "lea-quote" : "dashboard",
    subject:
      kind === "followup"
        ? "Votre sortie en mer — on vous garde une date ?"
        : kind === "quote"
          ? "Votre devis Harmonie Yacht"
          : "Re: Votre demande",
    sent_at: new Date(NOW - int(1, 170) * 86_400_000).toISOString(),
  };
});

export const agentFixtures: Record<string, Row[]> = {
  wa_conversations: extraConversations,
  wa_messages: extraMessages,
  lead_last_message: extraLastMessages,
  hub_credit_ledger,
  email_log,
};
