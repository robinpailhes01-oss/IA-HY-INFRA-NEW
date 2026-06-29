// Supabase Edge Function — agent email "Léa"
//
// Reçoit les emails entrants via Resend Inbound Routing,
// génère une réponse avec Claude (style email, pas SMS),
// répond via l'API Resend et stocke la conversation dans le CRM.
//
// Setup Resend côté admin :
//   1. Dashboard Resend → Domains → ton domaine → activer "Inbound"
//   2. Ajouter l'enregistrement MX Resend à votre DNS
//   3. Créer une route : contact@harmonie-yacht.fr → ce webhook URL
//   URL du webhook : https://<project-ref>.supabase.co/functions/v1/email-webhook

import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const RESEND_API_KEY     = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL         = Deno.env.get("RESEND_FROM") ?? "Harmonie Yacht <reservations@harmonie-yacht.fr>";
const MODEL              = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
// Secret optionnel : Resend → webhook secret pour valider l'authenticité.
const WEBHOOK_SECRET     = Deno.env.get("EMAIL_WEBHOOK_SECRET") ?? "";

// ── Types ────────────────────────────────────────────────────────────

type ResendInboundPayload = {
  from:       string;          // "Prénom Nom <email@example.com>" ou "email@example.com"
  to:         string | string[];
  reply_to?:  string | null;
  subject?:   string;
  text?:      string;
  html?:      string;
  /** Headers indexés par nom (ex: { "Message-Id": "...", "In-Reply-To": "..." }) */
  headers?:   Record<string, string> | Array<{ name: string; value: string }>;
  attachments?: unknown[];
};

type ChatMsg = { from: "client" | "ai" | "human"; text: string; at: string };

// ── Helpers ──────────────────────────────────────────────────────────

function extractEmailParts(raw: string): { email: string; name: string } {
  const m = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { name: "", email: raw.trim().toLowerCase() };
}

function getHeader(
  headers: ResendInboundPayload["headers"],
  name: string,
): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  if (Array.isArray(headers)) {
    return headers.find((h) => h.name.toLowerCase() === lower)?.value ?? null;
  }
  // object form : try both original case and lowercase
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) return (headers as Record<string, string>)[key];
  }
  return null;
}

function cleanBodyText(text: string | undefined): string {
  if (!text) return "";
  // Supprime les citations de réponse précédente (ligne commençant par ">").
  return text
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Prompt Léa (mode email) ──────────────────────────────────────────

function buildSystem(firstName: string | null): string {
  return `Tu es Léa, l'assistante commerciale d'Harmonie Yacht — location de yacht privatif au départ de Carnon-Port (Mauguio, 34130).

Tu réponds à des emails de prospects ou clients. Adapte ton style à l'email : phrases complètes, ton professionnel mais chaleureux, paragraphes courts, pas de style SMS.

═══ OFFRES ═══
• Sorties privatives 2 h, 3 h, sunset (coucher de soleil), journée complète
• Nuit Prestige et Nuit Insolite à bord
• Cartes cadeaux (toutes occasions)
• Tarifs disponibles sur harmonie-yacht.fr ou sur demande

═══ RÈGLES ═══
1. Réponds en français, dans un style email élégant.
2. Si le client demande une disponibilité : indique que tu vas vérifier et que tu le recontactes rapidement (tu n'as pas accès au planning en temps réel par email).
3. Si le client demande un devis personnalisé : demande le nombre de personnes, la date souhaitée et l'occasion. Ensuite tu peux donner une fourchette.
4. Ne promets jamais une disponibilité que tu n'as pas vérifiée.
5. Propose toujours un contact direct pour finaliser : 📞 07 53 48 12 63.
6. Signe chaque email ainsi :
   ---
   Léa — Harmonie Yacht
   📞 07 53 48 12 63
   ✉️ reservations@harmonie-yacht.fr
   239 rue de l'étang de l'or — 34130 Mauguio (Carnon-Port)
   harmonie-yacht.fr

${firstName ? `Le prénom du client : ${firstName}` : ""}`;
}

// ── Génération de la réponse ─────────────────────────────────────────

async function generateReply(
  inboundText: string,
  history: ChatMsg[],
  firstName: string | null,
): Promise<string> {
  // On envoie l'historique complet sauf le dernier message (= déjà dans inboundText).
  const prior = history.slice(0, -1);
  const messages = [
    ...prior.map((m) => ({
      role: m.from === "client" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    })),
    { role: "user" as const, content: inboundText },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: buildSystem(firstName),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    }),
  });

  if (!res.ok) {
    console.error("Anthropic error", res.status, await res.text());
    return "";
  }

  const data = await res.json() as {
    content?: Array<{ type: string; text: string }>;
  };
  return data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";
}

// ── Envoi email via Resend ────────────────────────────────────────────

async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
}): Promise<string | null> {
  const headers: Record<string, string> = {};
  if (opts.inReplyTo) {
    headers["In-Reply-To"] = opts.inReplyTo;
    headers["References"]  = opts.inReplyTo;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [opts.to],
      subject: opts.subject,
      text:    opts.text,
      headers: Object.keys(headers).length ? headers : undefined,
    }),
  });

  if (!res.ok) {
    console.error("Resend error", res.status, await res.text());
    return null;
  }

  const data = await res.json() as { id?: string };
  // Resend génère un Message-ID sous la forme <id@resend.dev>
  return data.id ? `<${data.id}@resend.dev>` : null;
}

// ── Handler principal ─────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Validation du secret webhook optionnel.
  if (WEBHOOK_SECRET) {
    const incomingSecret = req.headers.get("x-webhook-secret") ?? req.headers.get("svix-signature") ?? "";
    if (!incomingSecret.includes(WEBHOOK_SECRET)) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: ResendInboundPayload;
  try {
    payload = await req.json() as ResendInboundPayload;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { email: fromEmail, name: fromName } = extractEmailParts(payload.from);
  if (!fromEmail.includes("@")) {
    return new Response("Invalid sender", { status: 400 });
  }

  // Ignore les emails envoyés par nous-mêmes (boucle infinie).
  if (fromEmail.includes("harmonie-yacht.fr") || fromEmail.includes("resend.dev")) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
  }

  const subject   = payload.subject?.trim() || "(pas d'objet)";
  const bodyText  = cleanBodyText(payload.text);
  const messageId = getHeader(payload.headers, "message-id") ?? `<${crypto.randomUUID()}@email-webhook>`;
  const inReplyTo = getHeader(payload.headers, "in-reply-to");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();

  // ── 1. Trouver ou créer le lead ─────────────────────────────────────
  const { data: existingLead } = await supabase
    .from("leads")
    .select("id, first_name, last_name, status, score")
    .eq("email", fromEmail)
    .limit(1)
    .maybeSingle();

  let leadId: string;

  if (existingLead) {
    leadId = existingLead.id;
    await supabase.from("leads").update({ last_interaction_at: now, updated_at: now }).eq("id", leadId);
  } else {
    // Nouveau prospect par email.
    const parts = fromName.split(/\s+/);
    const { data: newLead, error: leadErr } = await supabase
      .from("leads")
      .insert({
        first_name:              parts[0] || null,
        last_name:               parts.slice(1).join(" ") || null,
        email:                   fromEmail,
        source_channel:          "email",
        source_status:           "to_ask",
        status:                  "new",
        needs_human_intervention: false,
        last_interaction_at:     now,
        created_at:              now,
        updated_at:              now,
      })
      .select("id")
      .single();

    if (leadErr || !newLead) {
      console.error("Lead creation failed", leadErr);
      return new Response("Lead error", { status: 500 });
    }
    leadId = newLead.id;
  }

  const firstName = existingLead?.first_name ?? (fromName.split(/\s+/)[0] || null);

  // ── 2. Trouver ou créer la conversation (thread) ────────────────────
  let conversationId: string | null = null;

  // Si c'est une réponse à un email précédent, chercher la conversation existante.
  if (inReplyTo) {
    const { data: thread } = await supabase
      .from("email_threads")
      .select("conversation_id")
      .eq("last_outbound_message_id", inReplyTo)
      .maybeSingle();
    if (thread) conversationId = thread.conversation_id;
  }

  // Sinon, chercher un thread existant avec ce lead (même sujet ou premier contact).
  if (!conversationId) {
    const { data: existingThread } = await supabase
      .from("email_threads")
      .select("conversation_id")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // N'attacher à un thread existant que si l'objet correspond (Re: …)
    const isReply = subject.toLowerCase().startsWith("re:");
    if (isReply && existingThread) {
      conversationId = existingThread.conversation_id;
    }
  }

  if (!conversationId) {
    // Nouveau thread → nouvelle conversation CRM.
    const { data: newConv, error: convErr } = await supabase
      .from("conversations")
      .insert({
        lead_id:    leadId,
        channel:    "email",
        messages:   [],
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (convErr || !newConv) {
      console.error("Conversation creation failed", convErr);
      return new Response("Conversation error", { status: 500 });
    }
    conversationId = newConv.id;

    await supabase.from("email_threads").insert({
      conversation_id: conversationId,
      lead_id:         leadId,
      from_email:      fromEmail,
      subject,
      created_at:      now,
      updated_at:      now,
    });
  }

  // ── 3. Récupérer l'historique existant ──────────────────────────────
  const { data: convRow } = await supabase
    .from("conversations")
    .select("messages")
    .eq("id", conversationId)
    .single();

  const history: ChatMsg[] = Array.isArray(convRow?.messages)
    ? (convRow.messages as unknown as ChatMsg[])
    : [];

  // Ajouter le message entrant.
  const inboundMsg: ChatMsg = { from: "client", text: bodyText, at: now };
  history.push(inboundMsg);

  // ── 4. Générer la réponse IA ─────────────────────────────────────────
  const aiReply = await generateReply(bodyText, history, firstName);

  // ── 5. Envoyer l'email de réponse via Resend ──────────────────────────
  let outboundMessageId: string | null = null;
  if (aiReply) {
    const replySubject = subject.startsWith("Re:") || subject.startsWith("RE:")
      ? subject
      : `Re: ${subject}`;

    outboundMessageId = await sendEmail({
      to:         fromEmail,
      subject:    replySubject,
      text:       aiReply,
      inReplyTo:  messageId,
    });

    if (outboundMessageId) {
      history.push({ from: "ai", text: aiReply, at: new Date().toISOString() });
    }
  }

  // ── 6. Persister la conversation et le thread ──────────────────────────
  await supabase
    .from("conversations")
    .update({ messages: history as unknown as never, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (outboundMessageId) {
    await supabase
      .from("email_threads")
      .update({ last_outbound_message_id: outboundMessageId, updated_at: new Date().toISOString() })
      .eq("conversation_id", conversationId);
  }

  // Bump last_interaction_at du lead.
  await supabase
    .from("leads")
    .update({ last_interaction_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", leadId);

  console.log(`Email processed: lead=${leadId} conv=${conversationId} replied=${!!aiReply}`);

  return new Response(
    JSON.stringify({ ok: true, lead_id: leadId, replied: !!aiReply }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
