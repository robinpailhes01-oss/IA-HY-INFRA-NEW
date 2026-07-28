// Supabase Edge Function — Agent Manager sur Telegram
//
// Bot Telegram réservé au propriétaire (Robin) pour consulter les chiffres
// de l'entreprise, voir qui s'est montré intéressé récemment ou qui a une
// sortie à venir, et relancer un prospect par WhatsApp sur simple demande
// en langage naturel (ex: "relance-les en disant que la météo est belle").
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

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_OWNER_CHAT_ID = Deno.env.get("TELEGRAM_OWNER_CHAT_ID") ?? "";
const BAILEYS_SERVICE_URL = Deno.env.get("BAILEYS_SERVICE_URL") ?? "";
const MAX_TOOL_TURNS = 6;
const MAX_HISTORY = 30;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type ChatMsg = { role: "user" | "assistant"; content: string };
// Content peut être une string simple OU un tableau de blocs (tool_use /
// tool_result) pendant la boucle d'outils — comme dans agent-lea.
type ApiMessage = { role: "user" | "assistant"; content: unknown };

function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim().replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) return /^\+\d{6,15}$/.test(s) ? s : null;
  if (/^0\d{9}$/.test(s)) return "+33" + s.slice(1);
  if (/^33\d{9}$/.test(s)) return "+" + s;
  if (/^\d{6,15}$/.test(s)) return "+" + s;
  return null;
}

// WhatsApp privacy mode : un contact qui masque son numéro envoie son LID
// (identifiant interne, ex. "1344375111872@lid") au lieu de son vrai numéro
// E.164 — Léa le stocke tel quel faute de mieux. Un vrai numéro E.164 fait
// au plus 13 chiffres ; au-delà, c'est un LID, pas un téléphone utilisable.
// Même heuristique que lib/whatsapp.ts (isWhatsAppLid).
function isWhatsAppLid(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return phone.replace(/[^\d]/g, "").length > 13;
}

function dayBounds(from?: string, to?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  return { from: from ?? weekAgo, to: (to ?? today) + "T23:59:59" };
}

// ── Outils ───────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_business_stats",
    description:
      "Donne les chiffres globaux de l'entreprise : nombre de demandes traitées (leads), messages envoyés (WhatsApp + email), CA généré, réservations à venir, reste à encaisser. Utilise cet outil pour toute question sur 'nos chiffres', le CA, l'activité globale.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_interested_leads",
    description:
      "Liste les prospects/clients qui se sont montrés intéressés sur une période (par défaut les 7 derniers jours). Retourne nom, téléphone, offre souhaitée, date souhaitée, occasion, score. Utilise cet outil pour 'qui était intéressé cette semaine/ce mois', 'quels prospects récents'.",
    input_schema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "Date de début YYYY-MM-DD (défaut: il y a 7 jours)" },
        to_date: { type: "string", description: "Date de fin YYYY-MM-DD (défaut: aujourd'hui)" },
      },
    },
  },
  {
    name: "list_upcoming_bookings",
    description:
      "Liste les réservations confirmées à venir (clients à venir), avec nom, téléphone, date, offre, montant, solde dû. Utilise cet outil pour 'quels clients à venir', 'qui vient cette semaine'.",
    input_schema: {
      type: "object",
      properties: {
        days_ahead: { type: "number", description: "Nombre de jours à couvrir à partir d'aujourd'hui (défaut 14)" },
      },
    },
  },
  {
    name: "send_whatsapp_followup",
    description:
      "Envoie un message WhatsApp réel à un client/prospect pour le relancer. À utiliser UNIQUEMENT quand le propriétaire demande explicitement de contacter/relancer quelqu'un. Rédige un vrai message chaleureux et complet à partir de son instruction (ex: s'il dit de mentionner que la météo est belle, écris un message naturel qui le dit, pas juste ces mots).",
    input_schema: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Numéro de téléphone du destinataire" },
        message: { type: "string", description: "Texte complet du message WhatsApp à envoyer" },
      },
      required: ["phone", "message"],
    },
  },
  {
    name: "get_agent_config",
    description:
      "Lit la configuration actuelle de Léa : offres, tarifs, options, FAQ/règles de comportement, horaires. Utilise-le TOUJOURS avant de proposer un changement, pour voir la valeur exacte et la structure actuelles (ne devine jamais une clé ou un prix).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "propose_config_change",
    description:
      "Prépare un changement dans la configuration de Léa (prix, offre, règle de comportement) — NE L'APPLIQUE PAS. Le changement reste en attente de confirmation explicite de Robin. Utilise cet outil dès que Robin demande de changer une offre, un prix, une règle. Après l'appel, décris précisément ce qui va changer (ancienne valeur → nouvelle valeur) et demande à Robin de confirmer avant que ça ne s'applique réellement.",
    input_schema: {
      type: "object",
      properties: {
        column: {
          type: "string",
          enum: ["offers", "options", "faq", "business_hours", "auto_followup_enabled", "max_followups", "morning_discount_percent", "weekend_nuit_prestige_contact"],
          description: "Colonne de la configuration à modifier",
        },
        key: {
          type: "string",
          description: "Clé à l'intérieur de la colonne si elle contient plusieurs entrées (ex. le nom de l'offre dans 'offers', ou le nom de la règle dans 'faq'). Laisser vide si la colonne est une valeur simple (ex. morning_discount_percent).",
        },
        new_value: { description: "Nouvelle valeur : texte, nombre, ou objet JSON selon le champ concerné" },
        description: { type: "string", description: "Résumé humain clair et complet du changement, à présenter à Robin pour confirmation" },
      },
      required: ["column", "new_value", "description"],
    },
  },
  {
    name: "confirm_pending_change",
    description:
      "Applique réellement le dernier changement de configuration proposé et en attente. N'appelle CET OUTIL QUE si Robin vient d'écrire un message confirmant explicitement (oui, confirme, vas-y, fais-le, c'est bon...). Ne l'appelle JAMAIS de ta propre initiative.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "cancel_pending_change",
    description: "Annule le dernier changement de configuration proposé, sans l'appliquer. Utilise si Robin dit non/annule/laisse tomber/pas ça.",
    input_schema: { type: "object", properties: {} },
  },
];

const CONFIG_COLUMNS = [
  "offers",
  "options",
  "faq",
  "business_hours",
  "auto_followup_enabled",
  "max_followups",
  "morning_discount_percent",
  "weekend_nuit_prestige_contact",
];

async function runTool(
  supabase: ReturnType<typeof createClient>,
  name: string,
  input: Record<string, unknown>,
  chatId: string,
): Promise<string> {
  if (name === "get_business_stats") {
    const [leadsRes, waRes, emailRes, revenuesRes, bookingsRes] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("wa_messages").select("*", { count: "exact", head: true }).eq("from_me", true),
      supabase.from("email_log").select("*", { count: "exact", head: true }),
      supabase.from("revenues").select("amount"),
      supabase
        .from("bookings")
        .select("date, status, balance_due, deposit_paid, deposit_amount")
        .neq("status", "cancelled"),
    ]);
    const ca = (revenuesRes.data ?? []).reduce((s: number, r: { amount: number | null }) => s + (r.amount ?? 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const bookings = bookingsRes.data ?? [];
    // deno-lint-ignore no-explicit-any
    const upcoming = bookings.filter((b: any) => b.date && b.date >= today).length;
    const resteAEncaisser = bookings.reduce(
      // deno-lint-ignore no-explicit-any
      (s: number, b: any) => s + (b.deposit_paid ? 0 : b.deposit_amount ?? 0) + (b.balance_due ?? 0),
      0,
    );
    return JSON.stringify({
      demandes_traitees: leadsRes.count ?? 0,
      messages_whatsapp_envoyes: waRes.count ?? 0,
      messages_email_envoyes: emailRes.count ?? 0,
      ca_genere_eur: ca,
      reservations_a_venir: upcoming,
      reste_a_encaisser_eur: resteAEncaisser,
    });
  }

  if (name === "list_interested_leads") {
    const { from, to } = dayBounds(input.from_date as string | undefined, input.to_date as string | undefined);
    const { data, error } = await supabase
      .from("leads")
      .select(
        "id, first_name, last_name, phone, email, interested_offer, occasion, party_size, desired_date, score, status, created_at",
      )
      .eq("archived", false)
      .gte("created_at", from)
      .lte("created_at", to)
      .order("score", { ascending: false, nullsFirst: false })
      .limit(25);
    if (error) return JSON.stringify({ error: error.message });
    // deno-lint-ignore no-explicit-any
    const cleaned = (data ?? []).map((l: any) =>
      isWhatsAppLid(l.phone)
        ? { ...l, phone: null, phone_note: "Numéro masqué (confidentialité WhatsApp) — relance impossible par WhatsApp, propose l'email si disponible." }
        : l,
    );
    return JSON.stringify(cleaned);
  }

  if (name === "list_upcoming_bookings") {
    const days = Number(input.days_ahead) || 14;
    const today = new Date();
    const future = new Date(today.getTime() + days * 86_400_000);
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id, date, start_time, offer_name, party_size, total_amount, balance_due, deposit_paid, status, customers(first_name, last_name, phone)",
      )
      .gte("date", today.toISOString().slice(0, 10))
      .lte("date", future.toISOString().slice(0, 10))
      .neq("status", "cancelled")
      .order("date", { ascending: true })
      .limit(30);
    if (error) return JSON.stringify({ error: error.message });
    // deno-lint-ignore no-explicit-any
    const cleaned = (data ?? []).map((b: any) => {
      if (b.customers && isWhatsAppLid(b.customers.phone)) {
        return { ...b, customers: { ...b.customers, phone: null, phone_note: "Numéro masqué (confidentialité WhatsApp)" } };
      }
      return b;
    });
    return JSON.stringify(cleaned);
  }

  if (name === "send_whatsapp_followup") {
    const rawPhone = String(input.phone ?? "");
    if (isWhatsAppLid(rawPhone)) {
      return JSON.stringify({
        ok: false,
        error: "Ce contact a masqué son numéro (confidentialité WhatsApp) — impossible de lui envoyer un message directement, ce n'est pas un vrai numéro.",
      });
    }
    const phone = normalizePhone(rawPhone);
    const message = String(input.message ?? "").trim();
    if (!phone) return JSON.stringify({ ok: false, error: "Numéro de téléphone invalide" });
    if (!message) return JSON.stringify({ ok: false, error: "Message vide" });
    if (!BAILEYS_SERVICE_URL) return JSON.stringify({ ok: false, error: "BAILEYS_SERVICE_URL non configuré" });
    try {
      const res = await fetch(`${BAILEYS_SERVICE_URL}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, message }),
      });
      return JSON.stringify({ ok: res.ok, phone, error: res.ok ? undefined : `Baileys ${res.status}` });
    } catch (e) {
      return JSON.stringify({ ok: false, error: String(e) });
    }
  }

  if (name === "get_agent_config") {
    const { data, error } = await supabase
      .from("agent_config")
      .select("offers, options, faq, business_hours, auto_followup_enabled, max_followups, morning_discount_percent, weekend_nuit_prestige_contact")
      .limit(1)
      .single();
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify(data);
  }

  if (name === "propose_config_change") {
    const column = String(input.column ?? "");
    const key = input.key ? String(input.key) : null;
    const newValue = input.new_value;
    const description = String(input.description ?? "");
    if (!CONFIG_COLUMNS.includes(column)) {
      return JSON.stringify({ ok: false, error: `Colonne non autorisée: ${column}` });
    }
    if (newValue === undefined || !description) {
      return JSON.stringify({ ok: false, error: "new_value et description sont requis" });
    }

    const { data: cfg, error: cfgErr } = await supabase.from("agent_config").select(column).limit(1).single();
    if (cfgErr) return JSON.stringify({ ok: false, error: cfgErr.message });
    // deno-lint-ignore no-explicit-any
    const columnValue = (cfg as any)[column];
    const oldValue = key ? columnValue?.[key] ?? null : columnValue;

    // Un seul changement en attente à la fois par conversation.
    await supabase
      .from("agent_config_pending_changes")
      .update({ status: "cancelled" })
      .eq("chat_id", chatId)
      .eq("status", "pending");

    const { data: pending, error } = await supabase
      .from("agent_config_pending_changes")
      .insert({
        chat_id: chatId,
        column_name: column,
        key_name: key,
        old_value: oldValue,
        new_value: newValue,
        description,
      })
      .select("id")
      .single();
    if (error) return JSON.stringify({ ok: false, error: error.message });

    return JSON.stringify({
      ok: true,
      pending_id: pending.id,
      old_value: oldValue,
      new_value: newValue,
      description,
      note: "Changement PAS ENCORE appliqué — attends la confirmation explicite de Robin avant d'appeler confirm_pending_change.",
    });
  }

  if (name === "confirm_pending_change") {
    const { data: pending } = await supabase
      .from("agent_config_pending_changes")
      .select("*")
      .eq("chat_id", chatId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pending) return JSON.stringify({ ok: false, error: "Aucun changement en attente à confirmer." });

    const { data: cfgRow, error: cfgErr } = await supabase
      .from("agent_config")
      .select(`id, ${pending.column_name}`)
      .limit(1)
      .single();
    if (cfgErr || !cfgRow) return JSON.stringify({ ok: false, error: cfgErr?.message ?? "Config introuvable" });

    let newColumnValue: unknown;
    if (pending.key_name) {
      // deno-lint-ignore no-explicit-any
      const current = ((cfgRow as any)[pending.column_name] as Record<string, unknown>) ?? {};
      newColumnValue = { ...current, [pending.key_name]: pending.new_value };
    } else {
      newColumnValue = pending.new_value;
    }

    const { error: updErr } = await supabase
      .from("agent_config")
      .update({ [pending.column_name]: newColumnValue, updated_at: new Date().toISOString() })
      // deno-lint-ignore no-explicit-any
      .eq("id", (cfgRow as any).id);
    if (updErr) return JSON.stringify({ ok: false, error: updErr.message });

    await supabase.from("agent_config_pending_changes").update({ status: "applied" }).eq("id", pending.id);
    await supabase.from("agent_config_history").insert({
      column_name: pending.column_name,
      key_name: pending.key_name,
      old_value: pending.old_value,
      new_value: pending.new_value,
      description: pending.description,
    });

    return JSON.stringify({ ok: true, applied: pending.description });
  }

  if (name === "cancel_pending_change") {
    const { data: pending } = await supabase
      .from("agent_config_pending_changes")
      .select("id, description")
      .eq("chat_id", chatId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pending) return JSON.stringify({ ok: false, error: "Aucun changement en attente à annuler." });
    await supabase.from("agent_config_pending_changes").update({ status: "cancelled" }).eq("id", pending.id);
    return JSON.stringify({ ok: true, cancelled: pending.description });
  }

  return JSON.stringify({ error: `Outil inconnu: ${name}` });
}

// ── Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es l'assistant Manager d'Harmonie Yacht sur Telegram, réservé exclusivement au propriétaire (Robin). Tu l'aides à piloter son activité : chiffres, prospects intéressés, réservations à venir, et relance de clients par WhatsApp sur sa demande.

RÈGLES :
- Réponds en français, de façon concise et directe — c'est un chat Telegram, pas un rapport. Pas de tableaux markdown complexes, des lignes simples.
- get_business_stats pour toute question sur les chiffres globaux (CA, demandes, messages, réservations à venir, reste à encaisser).
- list_interested_leads pour toute question sur les prospects/clients intéressés sur une période. Donne TOUJOURS le nom et le téléphone dans ta réponse — c'est ce qui permet à Robin de demander ensuite de les relancer.
- list_upcoming_bookings pour toute question sur les clients/réservations à venir.
- send_whatsapp_followup UNIQUEMENT quand Robin demande explicitement de contacter/relancer quelqu'un. Rédige un vrai message WhatsApp complet et naturel à partir de son instruction (ex: "dis que la météo est magnifique" → compose un message chaleureux qui le dit vraiment, pas juste ces mots). Après l'envoi, confirme à qui et ce que tu as envoyé.
- Si Robin dit "eux"/"les"/"ce lead" sans préciser, réutilise les prospects que TU as toi-même listés dans un message précédent de cette conversation.
- Si un lead n'a pas de téléphone (ou un numéro masqué par la confidentialité WhatsApp), dis-le simplement — ne peux pas le relancer par WhatsApp dans ce cas, propose l'email s'il est disponible.
- Ne mentionne jamais que tu es Claude ou un modèle d'IA — tu es l'assistant Manager d'Harmonie Yacht.

MODIFIER LA CONFIGURATION DE LÉA (offres, prix, règles) :
- Dès que Robin demande de changer une offre, un prix, ou une règle de comportement de Léa : appelle D'ABORD get_agent_config pour voir la structure et la valeur actuelles exactes (ne devine jamais une clé ou un prix).
- Appelle ensuite propose_config_change avec la colonne, la clé si besoin, et la nouvelle valeur. Cet outil NE MODIFIE RIEN — il prépare seulement le changement.
- Décris ensuite à Robin, en clair, ce qui va changer (ancienne valeur → nouvelle valeur) et demande-lui de confirmer. N'applique JAMAIS un changement sans qu'il ait dit oui/confirme/vas-y explicitement dans un message séparé.
- Uniquement quand Robin confirme dans son message suivant, appelle confirm_pending_change. Si Robin annule/dit non, appelle cancel_pending_change.
- Tout changement appliqué prend effet IMMÉDIATEMENT pour Léa (elle relit sa config à chaque conversation, pas besoin de redéploiement) — dis-le à Robin après confirmation.
- Ne modifie jamais plusieurs choses à la fois sans les décrire toutes clairement au préalable.`;

async function callAnthropic(messages: ApiMessage[]) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1536,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function sendTelegram(chatId: string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
  });
}

// ── Handler ──────────────────────────────────────────────────────────

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

  let finalText = "";
  try {
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const data = await callAnthropic(messages);
      const blocks = (data.content ?? []) as Array<Record<string, unknown>>;
      const toolUses = blocks.filter((b) => b.type === "tool_use");

      const textBlock = blocks.find((b) => b.type === "text") as { text?: string } | undefined;
      if (textBlock?.text) finalText = textBlock.text;

      if (data.stop_reason !== "tool_use" || toolUses.length === 0) break;

      messages.push({ role: "assistant", content: blocks });
      const results = [];
      for (const tu of toolUses) {
        const out = await runTool(supabase, tu.name as string, (tu.input ?? {}) as Record<string, unknown>, chatId);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    console.error("telegram-manager error", e);
    finalText = "Désolé, une erreur technique est survenue. Réessaie dans un instant.";
  }

  if (!finalText) finalText = "Je n'ai pas pu générer de réponse, réessaie ta question autrement.";

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
