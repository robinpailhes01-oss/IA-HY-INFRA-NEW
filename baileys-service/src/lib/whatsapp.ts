import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import {
  useSupabaseAuthState,
  upsertConversation,
  saveMessage,
  isConversationPaused,
  pauseConversation,
} from './supabase.js';
import { askLea } from './lea.js';

const logger = pino({ level: 'silent' });

// IDs of messages Léa sent — used to ignore echoes
const leaSentIds = new Set<string>();

let qrCode: string | null = null;
let connected = false;
let sock: ReturnType<typeof makeWASocket> | null = null;

export const getQR = () => qrCode;
export const isConnected = () => connected;
export const getSock = () => sock;

export async function connectToWhatsApp(): Promise<void> {
  const { state, saveCreds } = await useSupabaseAuthState();
  const { version } = await fetchLatestBaileysVersion();

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
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const reconnect = code !== DisconnectReason.loggedOut;
      console.log(`🔌 Connexion fermée (code ${code}) — reconnexion: ${reconnect}`);
      if (reconnect) setTimeout(() => connectToWhatsApp(), 5_000);
    }
    if (connection === 'open') {
      connected = true;
      qrCode = null;
      console.log('✅ WhatsApp connecté !');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;

      const jid = msg.key.remoteJid ?? '';
      if (isJidBroadcast(jid)) continue;
      if (jid.endsWith('@g.us')) continue; // ignore groups

      const customerPhone = '+' + jid.replace('@s.whatsapp.net', '');
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

      // Call Léa
      try {
        const reply = await askLea(body, customerPhone);
        if (!reply.trim()) continue;

        const sent = await sock!.sendMessage(jid, { text: reply });
        if (sent?.key?.id) leaSentIds.add(sent.key.id);
        await saveMessage(conv.id, true, reply, false, sent?.key?.id);
        console.log(`🤖 Léa → ${customerPhone}: ${reply.slice(0, 80)}…`);
      } catch (err) {
        console.error('[whatsapp] erreur Léa:', err);
      }
    }
  });
}
