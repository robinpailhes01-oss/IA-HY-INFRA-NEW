import "server-only";

import { createHmac } from "node:crypto";

import { DEMO_MODE } from "@/lib/demo/mode";

// Pont vers les fonctions Edge de la boîte mail (mail-oauth, mail-sync, mail-act).
// Le secret partagé DASHBOARD_AGENT_SECRET est le même que pour l'agent Manager.

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.DASHBOARD_AGENT_SECRET;
  return url && secret ? { url, secret } : null;
}

export type FnResult = { ok: boolean; data?: Record<string, unknown>; error?: string };

export async function callMailFunction(name: "mail-sync" | "mail-act", body: unknown): Promise<FnResult> {
  if (DEMO_MODE) return { ok: true, data: { demo: true } };
  const c = config();
  if (!c) return { ok: false, error: "DASHBOARD_AGENT_SECRET manquant dans les variables du projet." };
  try {
    const res = await fetch(`${c.url}/functions/v1/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dashboard-secret": c.secret },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
    return res.ok ? { ok: true, data } : { ok: false, error: data.error ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Lien de connexion à Gmail : signé (valable 15 min), fabriqué seulement pour un utilisateur connecté. */
export function gmailConnectUrl(): string | null {
  const c = config();
  if (!c) return null;
  const ts = String(Date.now());
  const sig = createHmac("sha256", c.secret).update(ts).digest("hex");
  return `${c.url}/functions/v1/mail-oauth?state=${ts}.${sig}`;
}
