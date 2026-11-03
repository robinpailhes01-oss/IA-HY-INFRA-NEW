import "server-only";

import { DEMO_MODE } from "@/lib/demo/mode";

// Pont vers l'agent Manager déjà en production (fonction Edge
// `dashboard-agent`, cerveau partagé avec Telegram) — pour ce que les outils
// du tableau de bord ne couvrent pas : config de Léa WhatsApp, analyse
// financière fine, caisse espèces, performance marketing.
export async function askManager(message: string): Promise<{ ok: boolean; reply?: string; error?: string }> {
  if (DEMO_MODE) {
    return { ok: true, reply: "(Mode démo) Le Manager aurait traité : « " + message + " »." };
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.DASHBOARD_AGENT_SECRET;
  if (!supabaseUrl || !secret) return { ok: false, error: "Agent Manager non configuré (DASHBOARD_AGENT_SECRET)." };
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/dashboard-agent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dashboard-secret": secret },
      body: JSON.stringify({ message }),
    });
    const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
    return res.ok && data.reply ? { ok: true, reply: data.reply } : { ok: false, error: data.error ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
