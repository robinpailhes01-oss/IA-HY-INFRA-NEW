// Supabase Edge Function — Webhook WhatsApp (Meta Cloud API)
//
// Rôle volontairement FIN : ce webhook ne contient aucune logique métier.
//   1. GET  → vérification du webhook par Meta (hub.challenge).
//   2. POST → réception d'un message client : on bufferise 6s, on regroupe
//             les messages rapprochés du même numéro, puis on appelle
//             `agent-lea` (le cerveau) UNE seule fois et on renvoie sa
//             réponse au client via la Graph API WhatsApp.
//
// Toute l'intelligence (qualification, dispos, relances, CRM) vit dans
// `agent-lea`. Ici on ne fait que brancher le canal WhatsApp.
//
// Debouncing : sans ce buffer, Meta peut appeler le webhook plusieurs fois
// pour des messages rapprochés du même client. Léa était alors invoquée en
// parallèle et envoyait plusieurs réponses redondantes. Avec le buffer, le
// dernier message reçu dans la fenêtre de 6s déclenche un seul appel à Léa
// avec tous les messages non-traités concaténés.
//
// Secrets attendus (Supabase → Edge Functions → Secrets) :
//   WHATSAPP_VERIFY_TOKEN     chaîne secrète que tu choisis (config webhook Meta)
//   WHATSAPP_TOKEN            access token permanent Meta (System User)
//   WHATSAPP_PHONE_NUMBER_ID  ID du numéro WhatsApp (Meta)
//   SUPABASE_URL              (injecté) — pour appeler agent-lea + DB
//   SUPABASE_SERVICE_ROLE_KEY (injecté) — pour autoriser l'appel à agent-lea + DB
//   LEA_SHARED_SECRET         (optionnel) — si défini sur agent-lea
//   GRAPH_API_VERSION         (optionnel) défaut "v21.0"
//   WA_DEBOUNCE_MS            (optionnel) défaut 6000

import { createClient } from "npm:@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LEA_SHARED_SECRET = Deno.env.get("LEA_SHARED_SECRET") ?? "";
const GRAPH_VERSION = Deno.env.get("GRAPH_API_VERSION") ?? "v21.0";
// Mettre LEA_PAUSED=true dans les secrets Supabase pour couper toutes les réponses de Léa.
const LEA_PAUSED = Deno.env.get("LEA_PAUSED") === "true";
// 15 s : fenêtre large pour regrouper les messages tapés en plusieurs fois.
// Si le client envoie 3 messages en 20 s, ils arrivent tous dans le même lot.
const DEBOUNCE_MS = Number(Deno.env.get("WA_DEBOUNCE_MS") ?? "15000");
// Après avoir été désigné leader, on attend encore GRACE_MS avant de traiter
// pour attraper les messages qui arrivent en fin de fenêtre debounce.
const GRACE_MS = Number(Deno.env.get("WA_GRACE_MS") ?? "4000");

const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
const LEA_URL = `${SUPABASE_URL}/functions/v1/agent-lea`;

// E.164 : Meta envoie le numéro sans "+", la base le stocke avec. On harmonise
// pour que agent-lea retrouve la fiche prospect existante par téléphone.
function toE164(waFrom: string): string {
  const digits = waFrom.replace(/[^\d]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Demande à Léa (agent-lea) la réponse à envoyer au client.
async function askLea(message: string, phone: string): Promise<string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    apikey: SERVICE_ROLE_KEY,
  };
  if (LEA_SHARED_SECRET) headers["x-lea-secret"] = LEA_SHARED_SECRET;

  const res = await fetch(LEA_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, phone }),
  });
  if (!res.ok) {
    console.error("agent-lea error", res.status, await res.text());
    return "";
  }
  const data = await res.json();
  return (data.reply as string) ?? "";
}

// Envoie un message texte au client via la Graph API WhatsApp.
async function sendWhatsApp(to: string, text: string): Promise<void> {
  if (!text.trim()) return;
  const res = await fetch(GRAPH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: true, body: text },
    }),
  });
  if (!res.ok) console.error("WhatsApp send error", res.status, await res.text());
}

// Traitement debouncé d'un message :
//   1. Insert dans wa_inbox (dédup sur wa_message_id : si Meta renvoie le
//      même message, on no-op)
//   2. Sleep DEBOUNCE_MS
//   3. Si on est encore le DERNIER message non-traité pour ce numéro → on est
//      "leader", on prend tous les messages non-traités, on les concatène,
//      on appelle Léa, on répond. Sinon, un message plus récent prendra le
//      relais (et nous traitera dans son lot).
async function handleMessage(
  waFrom: string,
  text: string,
  msgId: string,
  receivedAtMs: number,
): Promise<void> {
  try {
    const phone = toE164(waFrom);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const receivedAtIso = new Date(receivedAtMs).toISOString();
    const { data: inserted, error: insErr } = await supabase
      .from("wa_inbox")
      .insert({ wa_message_id: msgId, phone, text, received_at: receivedAtIso })
      .select("id")
      .single();
    if (insErr) {
      // Code 23505 = unique_violation → Meta a renvoyé le même message, on ignore.
      if ((insErr as { code?: string }).code === "23505") return;
      console.error("[wa_inbox insert]", insErr);
      return;
    }
    const myId = inserted.id as number;

    await sleep(DEBOUNCE_MS);

    const { data: pending, error: selErr } = await supabase
      .from("wa_inbox")
      .select("id, text, received_at")
      .eq("phone", phone)
      .is("processed_at", null)
      .order("received_at", { ascending: true });
    if (selErr) {
      console.error("[wa_inbox select]", selErr);
      return;
    }
    if (!pending || pending.length === 0) return; // déjà traité par un autre

    const last = pending[pending.length - 1];
    if (last.id !== myId) {
      // Un message plus récent prendra le relais dans son propre lot.
      return;
    }

    // ── Queue de grâce : on est leader mais on attend GRACE_MS de plus ──
    // Cas typique : client a tapé 2e message juste APRÈS notre debounce.
    // En attendant encore un peu on peut l'attraper avant d'envoyer.
    await sleep(GRACE_MS);

    // Re-lire les messages en attente (de nouveaux ont peut-être rejoint la file).
    const { data: freshPending } = await supabase
      .from("wa_inbox")
      .select("id, text, received_at")
      .eq("phone", phone)
      .is("processed_at", null)
      .order("received_at", { ascending: true });

    const toProcess = freshPending && freshPending.length > 0 ? freshPending : pending;
    const freshLast = toProcess[toProcess.length - 1];
    if (freshLast.id !== myId) {
      // Un message plus récent est arrivé pendant la queue de grâce ;
      // son handler sera le leader et nous inclura dans son lot.
      return;
    }

    const ids = toProcess.map((p) => p.id as number);
    const { error: updErr } = await supabase
      .from("wa_inbox")
      .update({ processed_at: new Date().toISOString() })
      .in("id", ids);
    if (updErr) {
      console.error("[wa_inbox update]", updErr);
      return;
    }

    const combined = toProcess.map((p) => (p.text as string).trim()).filter(Boolean).join("\n");
    if (!combined) return;

    // Pause globale (LEA_PAUSED=true dans les secrets) ou pause individuelle.
    if (LEA_PAUSED) {
      console.log(`[pause] Léa en pause globale — message ignoré pour ${phone}`);
      return;
    }
    const { data: waConv } = await supabase
      .from("wa_conversations")
      .select("is_paused, paused_until")
      .eq("customer_phone", phone)
      .maybeSingle();
    if (waConv?.is_paused) {
      const pausedUntil = waConv.paused_until ? new Date(waConv.paused_until as string) : null;
      if (!pausedUntil || pausedUntil > new Date()) {
        console.log(`[pause] Conversation en pause pour ${phone} — message ignoré`);
        return;
      }
      // Délai expiré : reprendre automatiquement.
      await supabase.from("wa_conversations").update({ is_paused: false, paused_until: null }).eq("customer_phone", phone);
    }

    const reply = await askLea(combined, phone);
    if (reply) await sendWhatsApp(waFrom, reply);
  } catch (e) {
    console.error("handleMessage failed", e);
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1) Vérification du webhook (Meta appelle en GET au moment de la config).
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // 2) Extraction des messages texte entrants. On ignore les autres événements
  //    (accusés de réception, statuts de livraison, etc.).
  try {
    const entries = body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        const messages = value?.messages ?? [];
        for (const msg of messages) {
          if (msg?.type !== "text") continue; // MVP : texte uniquement
          const from: string = msg.from;
          const text: string = msg.text?.body ?? "";
          const msgId: string = msg.id ?? `${from}-${Date.now()}-${Math.random()}`;
          // Meta envoie msg.timestamp en secondes Unix (string) ; fallback now.
          const tsRaw = msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now();
          const receivedAtMs = Number.isFinite(tsRaw) ? tsRaw : Date.now();
          if (!from || !text.trim()) continue;
          // On répond 200 tout de suite à Meta et on traite en tâche de fond
          // (debounce 6s + appel Léa + envoi WhatsApp peut dépasser le délai).
          // @ts-ignore EdgeRuntime fourni par Supabase
          EdgeRuntime.waitUntil(handleMessage(from, text, msgId, receivedAtMs));
        }
      }
    }
  } catch (e) {
    console.error("webhook parse error", e);
  }

  // Toujours acquitter rapidement pour éviter les renvois (et donc les doublons).
  return new Response("EVENT_RECEIVED", { status: 200 });
});
