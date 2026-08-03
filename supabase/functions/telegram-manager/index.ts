// Supabase Edge Function — Agent Manager sur Telegram
//
// Bot Telegram réservé au propriétaire (Robin) pour consulter les chiffres
// de l'entreprise, voir qui s'est montré intéressé récemment ou qui a une
// sortie à venir, et relancer un prospect par WhatsApp sur simple demande
// en langage naturel (ex: "relance-les en disant que la météo est belle").
//
// Le "cerveau" (prompt, outils, boucle d'exécution) vit dans
// ../_shared/manager-agent.ts, partagé avec le Jarvis vocal du dashboard
// (dashboard-agent) — ce fichier ne contient QUE la plomberie propre à
// Telegram (parsing du webhook, envoi de la réponse, persistance).
//
// Setup :
//   1. Créer le bot via @BotFather sur Telegram → récupérer le token.
//   2. Envoyer un premier message au bot, puis récupérer le chat_id via
//      https://api.telegram.org/bot<TOKEN>/getUpdates
//   3. Secrets Supabase (Edge Functions → Secrets) :
//        TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_CHAT_ID
//        ANTHROPIC_API_KEY, BAILEYS_SERVICE_URL (déjà partagés avec agent-lea)
//   4. Configurer le webhook :
//        https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<project-ref>.supabase.co/functions/v1/telegram-manager

import { createClient } from "npm:@supabase/supabase-js@2";
import { type ApiMessage, type ChatMsg, runAgentTurn } from "../_shared/manager-agent.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_OWNER_CHAT_ID = Deno.env.get("TELEGRAM_OWNER_CHAT_ID") ?? "";
const BAILEYS_SERVICE_URL = Deno.env.get("BAILEYS_SERVICE_URL") ?? "";
const MAX_HISTORY = 30;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function sendTelegram(chatId: string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!TELEGRAM_BOT_TOKEN || !ANTHROPIC_API_KEY) {
    return json({ error: "TELEGRAM_BOT_TOKEN ou ANTHROPIC_API_KEY manquant" }, 500);
  }

  let update: { message?: { chat?: { id?: number }; text?: string } };
  try {
    update = await req.json();
  } catch {
    return json({ ok: true });
  }

  const chatId = update.message?.chat?.id?.toString();
  const text = update.message?.text?.trim();
  if (!chatId || !text) return json({ ok: true });

  // Bot strictement réservé au propriétaire — toute autre personne est ignorée.
  if (!TELEGRAM_OWNER_CHAT_ID || chatId !== TELEGRAM_OWNER_CHAT_ID) {
    console.warn(`telegram-manager: message ignoré, chat_id non autorisé (${chatId})`);
    return json({ ok: true });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: convo } = await supabase
    .from("telegram_manager_conversations")
    .select("id, messages")
    .eq("chat_id", chatId)
    .maybeSingle();

  const history: ChatMsg[] = Array.isArray(convo?.messages) ? (convo.messages as ChatMsg[]) : [];
  const messages: ApiMessage[] = [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: text }];

  let finalText: string;
  try {
    finalText = await runAgentTurn(supabase, messages, {
      apiKey: ANTHROPIC_API_KEY,
      model: MODEL,
      channel: "telegram",
      chatId,
      baileysServiceUrl: BAILEYS_SERVICE_URL,
    });
  } catch (e) {
    console.error("telegram-manager error", e);
    finalText = "Désolé, une erreur technique est survenue. Réessaie dans un instant.";
  }

  await sendTelegram(chatId, finalText);

  // Persistance : uniquement le texte final (comme agent-lea), pas les blocs
  // tool_use bruts — suffisant pour le contexte multi-tours ("relance-les").
  const newHistory: ChatMsg[] = [...history, { role: "user", content: text }, { role: "assistant", content: finalText }].slice(
    -MAX_HISTORY,
  );

  if (convo) {
    await supabase
      .from("telegram_manager_conversations")
      .update({ messages: newHistory, updated_at: new Date().toISOString() })
      .eq("id", convo.id);
  } else {
    await supabase.from("telegram_manager_conversations").insert({ chat_id: chatId, messages: newHistory });
  }

  return json({ ok: true });
});
