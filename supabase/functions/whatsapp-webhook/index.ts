// Supabase Edge Function — Webhook WhatsApp (Meta Cloud API)
//
// Rôle volontairement FIN : ce webhook ne contient aucune logique métier.
//   1. GET  → vérification du webhook par Meta (hub.challenge).
//   2. POST → réception d'un message client : on le transmet à la fonction
//             `agent-lea` (le cerveau), puis on renvoie sa réponse au client
//             via la Graph API WhatsApp.
//
// Toute l'intelligence (qualification, dispos, relances, CRM) vit dans
// `agent-lea`. Ici on ne fait que brancher le canal WhatsApp.
//
// Secrets attendus (Supabase → Edge Functions → Secrets) :
//   WHATSAPP_VERIFY_TOKEN     chaîne secrète que tu choisis (config webhook Meta)
//   WHATSAPP_TOKEN            access token permanent Meta (System User)
//   WHATSAPP_PHONE_NUMBER_ID  ID du numéro WhatsApp (Meta)
//   SUPABASE_URL              (injecté) — pour appeler agent-lea
//   SUPABASE_SERVICE_ROLE_KEY (injecté) — pour autoriser l'appel à agent-lea
//   LEA_SHARED_SECRET         (optionnel) — si défini sur agent-lea
//   GRAPH_API_VERSION         (optionnel) défaut "v21.0"

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LEA_SHARED_SECRET = Deno.env.get("LEA_SHARED_SECRET") ?? "";
const GRAPH_VERSION = Deno.env.get("GRAPH_API_VERSION") ?? "v21.0";

const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
const LEA_URL = `${SUPABASE_URL}/functions/v1/agent-lea`;

// E.164 : Meta envoie le numéro sans "+", la base le stocke avec. On harmonise
// pour que agent-lea retrouve la fiche prospect existante par téléphone.
function toE164(waFrom: string): string {
  const digits = waFrom.replace(/[^\d]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
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

// Traitement asynchrone d'un message (hors du cycle de réponse à Meta).
async function handleMessage(waFrom: string, text: string): Promise<void> {
  try {
    const phone = toE164(waFrom);
    const reply = await askLea(text, phone);
    await sendWhatsApp(waFrom, reply);
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
          if (!from || !text.trim()) continue;
          // On répond 200 tout de suite à Meta et on traite en tâche de fond
          // (l'appel à Léa + Anthropic peut dépasser le délai de Meta).
          // @ts-ignore EdgeRuntime fourni par Supabase
          EdgeRuntime.waitUntil(handleMessage(from, text));
        }
      }
    }
  } catch (e) {
    console.error("webhook parse error", e);
  }

  // Toujours acquitter rapidement pour éviter les renvois (et donc les doublons).
  return new Response("EVENT_RECEIVED", { status: 200 });
});
