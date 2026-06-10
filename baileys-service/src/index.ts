import express from 'express';
import qrcode from 'qrcode';
import { connectToWhatsApp, getQR, isConnected, getSock } from './lib/whatsapp.js';
import { supabase, pauseConversation, resumeConversation, saveMessage, upsertConversation } from './lib/supabase.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3001;

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, connected: isConnected() });
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
    if (match) {
      jid = match.jid;
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
    const conv = await upsertConversation(phone);
    if (conv) {
      await saveMessage(conv.id, true, message, true, sent?.key?.id ?? undefined);
      await pauseConversation(phone);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Baileys service on port ${PORT}`);
  connectToWhatsApp().catch(console.error);
});
