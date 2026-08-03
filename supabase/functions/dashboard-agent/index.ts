// Supabase Edge Function — Jarvis du dashboard (le Manager, en vocal)
//
// Même agent que telegram-manager (cerveau partagé dans
// ../_shared/manager-agent.ts) — juste un canal d'accès différent : appelé
// par le dashboard Next.js (app/api/jarvis/route.ts), lui-même appelé par
// la page /jarvis en push-to-talk. Un seul propriétaire (Robin), déjà
// authentifié côté dashboard — la route Next.js ajoute un secret partagé
// pour que cette fonction ne soit pas appelable depuis l'extérieur.
//
// Secrets attendus (Supabase → Edge Functions → Secrets) :
//   ANTHROPIC_API_KEY, BAILEYS_SERVICE_URL  (déjà partagés avec telegram-manager)
//   DASHBOARD_AGENT_SECRET                  vérifié via header x-dashboard-secret

import { createClient } from "npm:@supabase/supabase-js@2";
import { type ApiMessage, type ChatMsg, runAgentTurn } from "../_shared/manager-agent.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
const BAILEYS_SERVICE_URL = Deno.env.get("BAILEYS_SERVICE_URL") ?? "";
const DASHBOARD_AGENT_SECRET = Deno.env.get("DASHBOARD_AGENT_SECRET") ?? "";
const MAX_HISTORY = 30;
// Conversation dédiée au dashboard — distincte de celle de Telegram, pour ne
// pas mélanger les échanges vocaux avec le fil texte du bot Telegram (les
// changements de config en attente restent aussi scopés séparément par canal).
const DASHBOARD_CHAT_ID = "dashboard";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-dashboard-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY manquant" }, 500);
  if (!DASHBOARD_AGENT_SECRET || req.headers.get("x-dashboard-secret") !== DASHBOARD_AGENT_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON invalide" }, 400);
  }

  const text = body.message?.trim();
  if (!text) return json({ error: "message requis" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: convo } = await supabase
    .from("telegram_manager_conversations")
    .select("id, messages")
    .eq("chat_id", DASHBOARD_CHAT_ID)
    .maybeSingle();

  const history: ChatMsg[] = Array.isArray(convo?.messages) ? (convo.messages as ChatMsg[]) : [];
  const messages: ApiMessage[] = [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: text }];

  let finalText: string;
  try {
    finalText = await runAgentTurn(supabase, messages, {
      apiKey: ANTHROPIC_API_KEY,
      model: MODEL,
      channel: "dashboard",
      chatId: DASHBOARD_CHAT_ID,
      baileysServiceUrl: BAILEYS_SERVICE_URL,
    });
  } catch (e) {
    console.error("dashboard-agent error", e);
    finalText = "Désolé, une erreur technique est survenue. Réessaie dans un instant.";
  }

  const newHistory: ChatMsg[] = [...history, { role: "user", content: text }, { role: "assistant", content: finalText }].slice(
    -MAX_HISTORY,
  );

  if (convo) {
    await supabase
      .from("telegram_manager_conversations")
      .update({ messages: newHistory, updated_at: new Date().toISOString() })
      .eq("id", convo.id);
  } else {
    await supabase.from("telegram_manager_conversations").insert({ chat_id: DASHBOARD_CHAT_ID, messages: newHistory });
  }

  return json({ reply: finalText });
});
