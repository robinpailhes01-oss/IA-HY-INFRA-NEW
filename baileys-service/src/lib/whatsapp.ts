import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pinoModule from 'pino';
import {
  useSupabaseAuthState,
  clearSupabaseAuthState,
  upsertConversation,
  saveMessage,
  isConversationPaused,
  pauseConversation,
  upsertLidMapping,
} from './supabase.js';
import { askLea } from './lea.js';

// pino's CJS default-import under NodeNext resolves to a namespace; unwrap .default at runtime
const pino: any = (pinoModule as any).default ?? pinoModule;
const logger = pino({ level: 'silent' });

// Même format que customerPhone plus bas : "+<digits>", quel que soit le
// suffixe d'origine (@s.whatsapp.net ou @lid).
function jidToPhone(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const digits = jid.replace(/@(s\.whatsapp\.net|lid)$/, '');
  return digits ? '+' + digits : null;
}

// IDs of messages Léa sent — used to ignore echoes
const leaSentIds = new Set<string>();

let qrCode: string | null = null;
let connected = false;
let sock: ReturnType<typeof makeWASocket> | null = null;

// ─── État de la reconnexion ───────────────────────────────────────────────
// Exposé par /health : sans ça, un service « up » et une Léa sourde se
// ressemblent exactement vus de l'extérieur.
let lastConnectedAt: number | null = null;
let lastDisconnectAt: number | null = null;
let lastDisconnectCode: number | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connecting = false;

const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 5 * 60_000;
const startedAt = Date.now();

export const getStatus = () => ({
  connected,
  waitingForQr: qrCode !== null,
  lastConnectedAt: lastConnectedAt ? new Date(lastConnectedAt).toISOString() : null,
  lastDisconnectAt: lastDisconnectAt ? new Date(lastDisconnectAt).toISOString() : null,
  lastDisconnectCode,
  reconnectAttempts,
  reconnectScheduled: reconnectTimer !== null,
  offlineSeconds:
    connected || !lastDisconnectAt ? 0 : Math.round((Date.now() - lastDisconnectAt) / 1000),
});

// Reconnexion avec recul exponentiel.
//
// Le point critique est le `.catch` : `connectToWhatsApp()` attend
// `useSupabaseAuthState()` puis `fetchLatestBaileysVersion()`, deux appels
// réseau. Si l'un échoue — coupure Supabase, DNS, CDN Baileys indisponible —
// la promesse était rejetée sans être capturée et PLUS AUCUNE tentative
// n'était programmée. Le service restait en vie, /health répondait 200, et
// Léa ne revenait jamais jusqu'au prochain déploiement. C'est le scénario
// « l'agent ne s'est pas reconnecté » le plus probable.
//
// Le recul évite l'autre travers : marteler WhatsApp toutes les 5 s quand
// c'est lui qui nous limite (codes 428/440), ce qui fait remonter le numéro
// dans leurs radars.
function scheduleReconnect(why: string): void {
  if (reconnectTimer) return;

  reconnectAttempts += 1;
  const backoff = Math.min(RECONNECT_BASE_MS * 2 ** (reconnectAttempts - 1), RECONNECT_MAX_MS);
  const delay = backoff + Math.floor(Math.random() * 3_000);
  console.log(`🔁 Reconnexion #${reconnectAttempts} dans ${Math.round(delay / 1000)}s — ${why}`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToWhatsApp().catch((err) => {
      console.error('[whatsapp] tentative de reconnexion échouée:', err);
      scheduleReconnect('la tentative précédente a échoué');
    });
  }, delay);
}

// Filet de sécurité. Un socket peut rester « à moitié ouvert » : plus rien
// n'arrive, mais Baileys n'émet jamais de 'close', donc aucune reconnexion
// n'est déclenchée et personne ne s'en aperçoit. Si on est hors ligne depuis
// plus de deux minutes sans tentative programmée, on force.
const WATCHDOG_TICK_MS = 60_000;
const MAX_OFFLINE_MS = 2 * 60_000;

export function startWatchdog(): void {
  const timer = setInterval(() => {
    if (connected || connecting || reconnectTimer) return;
    // Un QR affiché n'est pas une panne : c'est Robin qui n'a pas encore
    // scanné. Relancer ici effacerait le QR sous ses yeux.
    if (qrCode) return;
    const since = lastDisconnectAt ?? startedAt;
    if (Date.now() - since < MAX_OFFLINE_MS) return;
    console.log('🐕 Hors ligne sans reconnexion programmée → relance forcée');
    scheduleReconnect('watchdog');
  }, WATCHDOG_TICK_MS);
  timer.unref();
}

// Le socket précédent doit être détaché AVANT d'en créer un nouveau.
// Sans ça, ses écouteurs restent branchés : un « close » tardif du socket mort
// relance connectToWhatsApp() une seconde fois, et on se retrouve avec deux
// sockets vivants qui traitent chacun `messages.upsert` — Léa répond deux fois
// au même message, et le nombre de sockets double à chaque cycle.
function teardown(previous: ReturnType<typeof makeWASocket> | null): void {
  if (!previous) return;
  try {
    previous.ev.removeAllListeners('connection.update');
    previous.ev.removeAllListeners('messages.upsert');
    previous.ev.removeAllListeners('creds.update');
    previous.ev.removeAllListeners('contacts.upsert');
    previous.ev.removeAllListeners('contacts.update');
    previous.ev.removeAllListeners('chats.phoneNumberShare');
    previous.ev.removeAllListeners('messaging-history.set');
  } catch (e) {
    console.error('[whatsapp] retrait des écouteurs:', e);
  }
  try {
    previous.end(undefined);
  } catch {
    /* le socket était déjà mort — c'est le cas normal ici */
  }
}

// Un client envoie souvent sa réponse en plusieurs bulles WhatsApp rapprochées
// ("Vers le 15" / "aemp" / "Septembre"). Sans tampon, chaque bulle déclenche son
// propre appel à Léa en parallèle : le premier appel répond à une phrase encore
// incomplète (ex. "quel mois ?") pendant que la bulle suivante ("Septembre") est
// déjà arrivée — la réponse part quand même, car l'appel était déjà en cours.
// On regroupe donc les messages consécutifs d'un même client sur une courte
// fenêtre de silence avant d'appeler Léa une seule fois avec le texte combiné.
const DEBOUNCE_MS = parseInt(process.env.LEA_DEBOUNCE_MS ?? '6000', 10);

type PendingBatch = {
  texts: string[];
  jid: string;
  convId: string;
  timer: ReturnType<typeof setTimeout>;
};
const pendingBatches = new Map<string, PendingBatch>();

async function flushBatch(customerPhone: string): Promise<void> {
  const batch = pendingBatches.get(customerPhone);
  if (!batch) return;
  pendingBatches.delete(customerPhone);

  const paused = await isConversationPaused(customerPhone);
  if (paused) {
    console.log(`⏸️  ${customerPhone} en pause (au moment du batch)`);
    return;
  }

  const combined = batch.texts.join('\n');

  try {
    const reply = await askLea(combined, customerPhone);
    if (!reply.trim()) return;

    // Simule la frappe humaine : indicateur "écrit…" + délai proportionnel
    // au message (lecture + rédaction). Évite l'effet robot d'une réponse instantanée.
    //
    // Le plafond précédent (15 s) annulait l'effet sur les messages longs :
    // au-delà de ~280 caractères, tout arrivait exactement au même rythme,
    // et un paragraphe complet tombait aussi vite qu'un "oui". On table
    // désormais sur ~55 ms par caractère (≈ la vitesse de frappe réelle sur
    // téléphone) avec une base courte pour le temps de lecture, et un
    // plafond assez haut pour que les longs messages prennent visiblement
    // plus de temps que les courts.
    const baseMs = parseInt(process.env.LEA_REPLY_DELAY_MS ?? '4000', 10);
    const perCharMs = parseInt(process.env.LEA_REPLY_PER_CHAR_MS ?? '55', 10);
    const maxMs = parseInt(process.env.LEA_REPLY_DELAY_MAX_MS ?? '45000', 10);
    const jitterMs = Math.floor(Math.random() * 2000);
    const delayMs = Math.min(maxMs, baseMs + reply.length * perCharMs + jitterMs);

    try { await sock!.sendPresenceUpdate('composing', batch.jid); } catch {}
    await new Promise((r) => setTimeout(r, delayMs));
    try { await sock!.sendPresenceUpdate('paused', batch.jid); } catch {}

    const sent = await sock!.sendMessage(batch.jid, { text: reply });
    if (sent?.key?.id) leaSentIds.add(sent.key.id);
    await saveMessage(batch.convId, true, reply, false, sent?.key?.id ?? undefined);
    console.log(`🤖 Léa → ${customerPhone} (après ${delayMs}ms): ${reply.slice(0, 80)}…`);
  } catch (err) {
    console.error('[whatsapp] erreur Léa:', err);
  }
}

export const getQR = () => qrCode;
export const isConnected = () => connected;
export const getSock = () => sock;

export async function connectToWhatsApp(): Promise<void> {
  // Deux appels simultanés créeraient deux sockets concurrents. Ça arrive dès
  // que le watchdog et un « close » tombent en même temps.
  if (connecting) {
    console.log('⏭️  Connexion déjà en cours — appel ignoré');
    return;
  }
  connecting = true;

  teardown(sock);
  sock = null;

  try {
    const { state, saveCreds } = await useSupabaseAuthState();
    const { version } = await fetchLatestBaileysVersion();
    await openSocket(state, saveCreds, version);
  } finally {
    connecting = false;
  }
}

type AuthState = Awaited<ReturnType<typeof useSupabaseAuthState>>;

async function openSocket(
  state: AuthState['state'],
  saveCreds: AuthState['saveCreds'],
  version: Awaited<ReturnType<typeof fetchLatestBaileysVersion>>['version'],
): Promise<void> {
  sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: true,
    browser: ['Léa Agent', 'Chrome', '3.0'],
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrCode = qr;
      connected = false;
      console.log('📱 QR Code prêt — scannez depuis /qr');
    }
    if (connection === 'close') {
      connected = false;
      qrCode = null;
      lastDisconnectAt = Date.now();
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode ?? null;
      lastDisconnectCode = code;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`🔌 Connexion fermée (code ${code}) — loggedOut: ${loggedOut}`);
      if (loggedOut) {
        // L'humain a déconnecté l'appareil lié dans WhatsApp Business. Les credentials
        // sont invalides — on les efface et on relance pour générer un nouveau QR.
        console.log('🧹 Session WhatsApp invalidée → nettoyage auth Supabase + nouveau QR');
        clearSupabaseAuthState()
          .catch((e) => console.error('[whatsapp] clearAuthState:', e))
          .finally(() => scheduleReconnect('session invalidée, nouveau QR à scanner'));
      } else {
        scheduleReconnect(`fermeture code ${code}`);
      }
    }
    if (connection === 'open') {
      connected = true;
      qrCode = null;
      lastConnectedAt = Date.now();
      // Le compteur ne redescend qu'ici : sinon le recul repart de zéro à
      // chaque tentative et on retombe sur un martèlement toutes les 5 s.
      reconnectAttempts = 0;
      console.log('✅ WhatsApp connecté !');
    }
  });

  // Résolution LID → numéro réel — voir migration wa_lid_phone_mapping.
  // Trois sources possibles, toutes réellement émises par Baileys (vérifié
  // dans son code source, pas une supposition) :
  //  - 'chats.phoneNumberShare' : le client partage explicitement son numéro
  //    (WhatsApp envoie {lid, jid} directement, cas le plus fiable).
  //  - 'contacts.upsert'/'contacts.update' : sync des contacts du compte —
  //    un Contact peut porter à la fois .lid et .jid quand WhatsApp connaît
  //    déjà la correspondance pour ce compte (ex. contact enregistré côté
  //    téléphone principal de Robin, qui LUI montre le vrai numéro).
  //  - 'messaging-history.set' : sync initiale/périodique des chats, où
  //    chaque chat peut porter .lid en plus de son id.
  sock.ev.on('chats.phoneNumberShare', ({ lid, jid }) => {
    const lidPhone = jidToPhone(lid);
    const realPhone = jidToPhone(jid);
    if (lidPhone && realPhone) {
      console.log(`🔓 Numéro partagé explicitement : ${lidPhone} → ${realPhone}`);
      upsertLidMapping(lidPhone, realPhone, 'phone_share').catch((e) => console.error('[whatsapp] upsertLidMapping:', e));
    }
  });

  const handleContacts = (contacts: Array<{ id?: string; lid?: string; jid?: string }>) => {
    for (const c of contacts) {
      const lidCandidate = c.lid ?? (c.id?.endsWith('@lid') ? c.id : null);
      const phoneCandidate = c.jid ?? (c.id?.endsWith('@s.whatsapp.net') ? c.id : null);
      const lidPhone = jidToPhone(lidCandidate);
      const realPhone = jidToPhone(phoneCandidate);
      if (lidPhone && realPhone) {
        console.log(`🔓 Contact résolu : ${lidPhone} → ${realPhone}`);
        upsertLidMapping(lidPhone, realPhone, 'contact_sync').catch((e) => console.error('[whatsapp] upsertLidMapping:', e));
      }
    }
  };
  sock.ev.on('contacts.upsert', handleContacts);
  sock.ev.on('contacts.update', handleContacts);

  sock.ev.on('messaging-history.set', ({ chats }) => {
    for (const chat of chats as Array<{ id?: string; lidJid?: string }>) {
      const lidPhone = jidToPhone(chat.lidJid);
      const realPhone = jidToPhone(chat.id);
      if (lidPhone && realPhone) {
        console.log(`🔓 Chat historique résolu : ${lidPhone} → ${realPhone}`);
        upsertLidMapping(lidPhone, realPhone, 'history_sync').catch((e) => console.error('[whatsapp] upsertLidMapping:', e));
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    console.log(`📨 messages.upsert reçu (type=${type}, count=${messages.length})`);
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;

      const jid = msg.key.remoteJid ?? '';
      if (isJidBroadcast(jid)) continue;
      if (jid.endsWith('@g.us')) continue; // ignore groups

      // WhatsApp donne soit "<phone>@s.whatsapp.net" (contact normal), soit
      // "<lid>@lid" (privacy mode). On strip les deux pour avoir un identifiant clean.
      const customerPhone = '+' + jid.replace(/@(s\.whatsapp\.net|lid)$/, '');
      const msgId = msg.key.id ?? '';
      const body =
        msg.message.conversation ??
        msg.message.extendedTextMessage?.text ??
        msg.message.ephemeralMessage?.message?.extendedTextMessage?.text ??
        '';

      if (!body.trim()) continue;

      // Message sent by the business phone (fromMe)
      if (msg.key.fromMe) {
        if (leaSentIds.has(msgId)) {
          leaSentIds.delete(msgId);
          continue; // Léa's own echo — ignore
        }
        // Human replied from phone → pause Léa for 24h
        console.log(`👤 Réponse humaine vers ${customerPhone} → pause 24h`);
        const conv = await upsertConversation(customerPhone);
        if (conv) {
          await saveMessage(conv.id, true, body, true, msgId);
          await pauseConversation(customerPhone);
        }
        continue;
      }

      // Incoming message from customer
      console.log(`📩 ${customerPhone}: ${body}`);
      const conv = await upsertConversation(customerPhone, msg.pushName ?? undefined);
      if (!conv) continue;

      await saveMessage(conv.id, false, body, false, msgId);

      const paused = await isConversationPaused(customerPhone);
      if (paused) {
        console.log(`⏸️  ${customerPhone} en pause`);
        continue;
      }

      // Bufferise ce message avec ceux déjà en attente du même client, et repousse
      // le déclenchement — s'il envoie une nouvelle bulle avant la fin de la fenêtre,
      // on attend encore. Léa n'est appelée qu'une fois le silence obtenu.
      const existing = pendingBatches.get(customerPhone);
      if (existing) {
        clearTimeout(existing.timer);
        existing.texts.push(body);
        existing.jid = jid;
        existing.convId = conv.id;
        existing.timer = setTimeout(() => {
          flushBatch(customerPhone).catch((err) => console.error('[whatsapp] erreur flushBatch:', err));
        }, DEBOUNCE_MS);
      } else {
        const timer = setTimeout(() => {
          flushBatch(customerPhone).catch((err) => console.error('[whatsapp] erreur flushBatch:', err));
        }, DEBOUNCE_MS);
        pendingBatches.set(customerPhone, { texts: [body], jid, convId: conv.id, timer });
      }
    }
  });
}
