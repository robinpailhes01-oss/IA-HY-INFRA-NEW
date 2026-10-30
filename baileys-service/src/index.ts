import express from 'express';
import qrcode from 'qrcode';
import { connectToWhatsApp, getQR, isConnected, getSock, getStatus, startWatchdog } from './lib/whatsapp.js';
import { supabase, pauseConversation, resumeConversation, saveMessage, upsertConversation } from './lib/supabase.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3001;

// Deux sondes, volontairement distinctes.
//
// /health répond toujours 200 tant que le processus vit. C'est ce que Railway
// interroge : s'il renvoyait 503 pendant l'appairage, Railway redémarrerait le
// conteneur avant que le QR ait pu être scanné — une boucle dont on ne sort pas.
// Le corps, lui, dit la vérité : « up » et « Léa entend » ne sont pas la même
// chose, et c'est précisément cette confusion qui laissait l'agent sourd sans
// que rien ne l'indique.
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.round(process.uptime()), ...getStatus() });
});

// /ready dit si Léa peut réellement répondre. 503 quand ce n'est pas le cas —
// c'est cette sonde-là qu'il faut brancher sur une alerte.
app.get('/ready', (_req, res) => {
  const status = getStatus();
  res.status(status.connected ? 200 : 503).json(status);
});

// QR code as base64 PNG (poll this from the Next.js dashboard)
app.get('/qr', async (_req, res) => {
  if (isConnected()) return res.json({ status: 'connected' });
  const qr = getQR();
  if (!qr) return res.status(202).json({ status: 'waiting' });
  const dataUrl = await qrcode.toDataURL(qr, { width: 300 });
  res.json({ status: 'pending', qr: dataUrl });
});

// Pause Léa for a conversation
app.post('/pause/:phone', async (req, res) => {
  const { phone } = req.params;
  const hours: number = req.body.hours ?? 24;
  await pauseConversation(phone, hours);
  res.json({ ok: true });
});

// Resume Léa for a conversation
app.post('/resume/:phone', async (req, res) => {
  const { phone } = req.params;
  await resumeConversation(phone);
  res.json({ ok: true });
});

// Send a manual message from the inbox (human reply)
app.post('/send', async (req, res) => {
  const { phone, message } = req.body as { phone: string; message: string };
  const sock = getSock();
  if (!sock || !isConnected()) {
    return res.status(503).json({ error: 'WhatsApp non connecté' });
  }
  const cleanPhone = phone.replace('+', '');
  try {
    // Vérifie d'abord que le numéro existe sur WhatsApp via lookup E.164.
    const exists = await sock.onWhatsApp(cleanPhone);
    const match = exists?.find((e) => e.exists);

    let jid: string;
    // Clé utilisée pour la conversation/pause — par défaut le numéro fourni,
    // mais si ce numéro est en fait le vrai numéro résolu d'un contact connu
    // par son LID (voir wa_lid_map), on reste sur l'identité LID d'origine :
    // c'est elle qui porte l'historique et l'état de pause suivis par Léa,
    // sinon on créerait une conversation en double et Léa pourrait continuer
    // à répondre en parallèle sur le fil LID pendant qu'on écrit sur l'autre.
    let identityPhone = phone;
    if (match) {
      jid = match.jid;
      const { data: mapping } = await supabase.from('wa_lid_map').select('lid').eq('phone', phone).maybeSingle();
      if (mapping?.lid) identityPhone = mapping.lid;
    } else {
      // Fallback LID (WhatsApp privacy mode) : si on a déjà une conversation
      // avec ce "phone", le numéro est un LID valide qui ne se résout pas via
      // onWhatsApp() mais sur lequel sendMessage(<digits>@lid) fonctionne quand
      // même. C'est exactement ce que fait Baileys quand le client nous écrit.
      const { data: conv } = await supabase
        .from('wa_conversations')
        .select('id')
        .eq('customer_phone', phone)
        .maybeSingle();
      if (!conv) {
        return res.status(404).json({ error: `Numéro ${phone} introuvable sur WhatsApp` });
      }
      jid = `${cleanPhone}@lid`;
    }

    const sent = await sock.sendMessage(jid, { text: message });
    // Save + pause (human is taking over)
    const conv = await upsertConversation(identityPhone);
    if (conv) {
      await saveMessage(conv.id, true, message, true, sent?.key?.id ?? undefined);
      await pauseConversation(identityPhone);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Un rejet non capturé ne doit pas laisser le processus dans un état où
// Express répond encore mais où plus rien ne tourne derrière.
process.on('unhandledRejection', (reason) => {
  console.error('[baileys] promesse rejetée non capturée:', reason);
});

app.listen(PORT, () => {
  console.log(`🚀 Baileys service on port ${PORT}`);
  startWatchdog();
  // Le .catch ne se contente plus de logger : sans nouvelle tentative, un
  // échec au tout premier démarrage (Supabase indisponible au boot, par
  // exemple) laissait le service en vie et définitivement déconnecté.
  connectToWhatsApp().catch((err) => {
    console.error('[baileys] connexion initiale échouée, le watchdog reprendra la main:', err);
  });
});
