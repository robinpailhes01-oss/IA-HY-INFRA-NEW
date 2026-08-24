// Supabase Edge Function — Rapport hebdomadaire envoyé à Robin sur Telegram
// (même bot que le Manager), chaque lundi matin.
//
// Cron : appeler ce endpoint avec header x-cron-secret le lundi.

import { createClient } from "npm:@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_OWNER_CHAT_ID = Deno.env.get("TELEGRAM_OWNER_CHAT_ID") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const PERIOD_DAYS = 7;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fmtDateFr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "unauthorized" }, 401);
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_OWNER_CHAT_ID) {
    return json({ error: "TELEGRAM_BOT_TOKEN / TELEGRAM_OWNER_CHAT_ID manquant" }, 500);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const now = new Date();
  const periodStart = new Date(now.getTime() - PERIOD_DAYS * 86_400_000);
  const periodStartIso = periodStart.toISOString();

  const [newLeadsRes, hotLeadsRes, bookedRes, convRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", periodStartIso),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("score", 7)
      .neq("status", "booked")
      .neq("status", "lost")
      .or("archived.is.null,archived.eq.false"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "booked")
      .gte("updated_at", periodStartIso),
    // Les messages sont stockés en jsonb dans chaque conversation — on ne
    // peut filtrer par date qu'après lecture, donc on ne récupère que les
    // conversations touchées depuis le début de la période.
    supabase
      .from("conversations")
      .select("messages")
      .gte("updated_at", periodStartIso)
      .returns<{ messages: Array<{ from: string; at: string }> | null }[]>(),
  ]);

  const newLeadsCount = newLeadsRes.count ?? 0;
  const hotLeadsCount = hotLeadsRes.count ?? 0;
  const bookedCount = bookedRes.count ?? 0;

  let messagesSent = 0;
  let messagesReceived = 0;
  for (const conv of convRes.data ?? []) {
    for (const m of conv.messages ?? []) {
      if (!m?.at || new Date(m.at).getTime() < periodStart.getTime()) continue;
      if (m.from === "ai") messagesSent += 1;
      else messagesReceived += 1;
    }
  }

  const text = [
    `📊 Rapport hebdo Harmonie Yacht`,
    `${fmtDateFr(periodStart.toISOString().slice(0, 10))} → ${fmtDateFr(now.toISOString().slice(0, 10))}`,
    ``,
    `🆕 Nouveaux leads : ${newLeadsCount}`,
    `🔥 Leads chauds (score ≥7, en cours) : ${hotLeadsCount}`,
    `📩 Messages reçus des clients : ${messagesReceived}`,
    `💬 Messages envoyés par Léa : ${messagesSent}`,
    `✅ Réservations confirmées cette semaine : ${bookedCount}`,
  ].join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_OWNER_CHAT_ID, text }),
    });
  } catch (e) {
    console.error("[weekly-report] Telegram send failed:", e);
    return json({ error: "telegram send failed", detail: String(e) }, 500);
  }

  return json({
    sent: true,
    period: { start: periodStartIso, end: now.toISOString() },
    newLeadsCount,
    hotLeadsCount,
    messagesSent,
    messagesReceived,
    bookedCount,
  });
});
