// Cerveau partagé de l'agent "Manager" — même prompt, mêmes outils, même
// logique d'exécution, quel que soit le canal (Telegram, dashboard vocal...).
//
// Ne JAMAIS dupliquer ce fichier dans un canal spécifique : c'est exactement
// le genre de divergence (deux versions du même agent qui finissent par se
// contredire) qui a causé des bugs réels par le passé. Un seul canal =
// un seul fichier d'appel (ex. telegram-manager/index.ts) qui importe ce
// module et ajoute uniquement la plomberie propre au canal (parsing de la
// requête entrante, envoi de la réponse).

import type { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export type ApiMessage = { role: "user" | "assistant"; content: unknown };
// Historique persisté : uniquement le texte final de chaque tour (pas les
// blocs tool_use bruts) — suffisant pour le contexte multi-tours.
export type ChatMsg = { role: "user" | "assistant"; content: string };
type SupabaseClient = ReturnType<typeof createClient>;

export function normalizePhone(input: string | null | undefined): string | null {
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
// E.164. Un vrai numéro E.164 fait au plus 13 chiffres ; au-delà, c'est un
// LID, pas un téléphone utilisable. Même heuristique que lib/whatsapp.ts.
export function isWhatsAppLid(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return phone.replace(/[^\d]/g, "").length > 13;
}

export function dayBounds(from?: string, to?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  return { from: from ?? weekAgo, to: (to ?? today) + "T23:59:59" };
}

// ── Outils ───────────────────────────────────────────────────────────

export const TOOLS = [
  {
    name: "get_business_stats",
    description:
      "Donne les chiffres de l'entreprise : demandes traitées, messages envoyés, CA encaissé (revenus réellement collectés, datés par leur date d'encaissement — PAS la date de la sortie), réservations à venir, reste à encaisser. Sans from_date, le CA est le cumul DEPUIS LE DÉBUT (précise-le à Robin). Pour 'ce mois', 'cette semaine', etc., calcule et passe from_date/to_date.",
    input_schema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "Date de début YYYY-MM-DD pour restreindre le CA/demandes/messages à une période (omis = depuis le début)" },
        to_date: { type: "string", description: "Date de fin YYYY-MM-DD (défaut: aujourd'hui, ignoré si from_date absent)" },
      },
    },
  },
  {
    name: "list_interested_leads",
    description:
      "Liste les prospects/clients intéressés. Deux modes, à ne pas confondre : (1) from_date/to_date filtre sur QUAND ils ont contacté (défaut : les 7 derniers jours) — pour 'qui était intéressé cette semaine', 'quels prospects récents'. (2) desired_from_date/desired_to_date filtre sur LA DATE SOUHAITÉE de la sortie/nuit, quelle que soit la date du contact — pour 'qui est intéressé pour septembre', 'qui veut venir ce week-end'. Si Robin nomme un mois, calcule desired_from_date=1er du mois et desired_to_date=dernier jour du mois. Retourne nom, téléphone, offre souhaitée, date souhaitée, occasion, score.",
    input_schema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "Date de début YYYY-MM-DD, filtre sur la date de contact (défaut: il y a 7 jours) — ignoré si desired_from_date/desired_to_date est fourni" },
        to_date: { type: "string", description: "Date de fin YYYY-MM-DD, filtre sur la date de contact (défaut: aujourd'hui) — ignoré si desired_from_date/desired_to_date est fourni" },
        desired_from_date: { type: "string", description: "Filtre sur la date SOUHAITÉE de la prestation (desired_date), début de période YYYY-MM-DD — ex. '2026-09-01' pour 'qui veut venir en septembre'" },
        desired_to_date: { type: "string", description: "Filtre sur la date SOUHAITÉE de la prestation (desired_date), fin de période YYYY-MM-DD — ex. '2026-09-30' pour 'qui veut venir en septembre'" },
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
  {
    name: "add_expense",
    description:
      "Enregistre une dépense dans Finances. Utilise dès que Robin demande d'ajouter/enregistrer une dépense, un achat, une facture.",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Montant en euros" },
        category: {
          type: "string",
          enum: ["subscription", "marketing", "fuel", "maintenance", "tools", "subcontract", "fixed_monthly", "salary", "taxes", "savings", "other"],
          description: "subscription=Abonnement, marketing=Marketing, fuel=Gasoil, maintenance=Entretien, tools=Outils, subcontract=Sous-traitance, fixed_monthly=Mensualité fixe, salary=Salaire, taxes=Taxes, savings=Épargne, other=Autre",
        },
        description: { type: "string", description: "Détail optionnel de la dépense" },
        date: { type: "string", description: "Date YYYY-MM-DD (défaut : aujourd'hui)" },
      },
      required: ["amount", "category"],
    },
  },
  {
    name: "list_expenses",
    description:
      "Liste les dépenses enregistrées sur une période, avec le total et le détail par catégorie. Utilise pour toute question sur les dépenses, le budget dépensé (ex. 'combien de budget pub ce mois', 'nos dépenses de sous-traitance'). Chaque dépense retournée inclut son id — nécessaire pour delete_expense.",
    input_schema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "Date de début YYYY-MM-DD (défaut: il y a 7 jours)" },
        to_date: { type: "string", description: "Date de fin YYYY-MM-DD (défaut: aujourd'hui)" },
        category: {
          type: "string",
          enum: ["subscription", "marketing", "fuel", "maintenance", "tools", "subcontract", "fixed_monthly", "salary", "taxes", "savings", "other"],
          description: "Filtre optionnel sur une seule catégorie (ex. 'marketing' pour le budget pub)",
        },
      },
    },
  },
  {
    name: "delete_expense",
    description:
      "Supprime définitivement une dépense enregistrée par erreur ou en double. Appelle TOUJOURS list_expenses juste avant pour retrouver l'id exact de la dépense visée (ne devine jamais un id) — confirme le montant/catégorie/date à Robin avant de supprimer si plusieurs dépenses se ressemblent.",
    input_schema: {
      type: "object",
      properties: {
        expense_id: { type: "string", description: "id de la dépense à supprimer (obtenu via list_expenses)" },
      },
      required: ["expense_id"],
    },
  },
  {
    name: "get_marketing_performance",
    description:
      "Donne le budget publicité dépensé et le nombre de réservations + CA venant des pubs (Instagram Ads, TikTok Ads, Meta Ads, Google Ads) sur une période. Utilise pour toute question sur le ROI des pubs, l'efficacité de la publicité, ou 'combien de réservations grâce aux pubs'.",
    input_schema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "Date de début YYYY-MM-DD (défaut: le 1er du mois en cours)" },
        to_date: { type: "string", description: "Date de fin YYYY-MM-DD (défaut: aujourd'hui)" },
      },
    },
  },
];

const AD_CHANNELS = ["instagram_ads", "tiktok_ads", "meta_ads", "google_ads"];
const AD_CHANNEL_LABELS: Record<string, string> = {
  instagram_ads: "Instagram Ads",
  tiktok_ads: "TikTok Ads",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

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

export async function runTool(
  supabase: SupabaseClient,
  name: string,
  input: Record<string, unknown>,
  chatId: string,
  baileysServiceUrl: string,
): Promise<string> {
  if (name === "get_business_stats") {
    const from = input.from_date ? String(input.from_date) : null;
    const to = input.to_date ? String(input.to_date) : new Date().toISOString().slice(0, 10);

    let leadsQuery = supabase.from("leads").select("*", { count: "exact", head: true });
    let waQuery = supabase.from("wa_messages").select("*", { count: "exact", head: true }).eq("from_me", true);
    let emailQuery = supabase.from("email_log").select("*", { count: "exact", head: true });
    let revenuesQuery = supabase.from("revenues").select("amount");
    if (from) {
      leadsQuery = leadsQuery.gte("created_at", from).lte("created_at", to + "T23:59:59");
      waQuery = waQuery.gte("created_at", from).lte("created_at", to + "T23:59:59");
      emailQuery = emailQuery.gte("sent_at", from).lte("sent_at", to + "T23:59:59");
      revenuesQuery = revenuesQuery.gte("date", from).lte("date", to);
    }

    const [leadsRes, waRes, emailRes, revenuesRes, bookingsRes] = await Promise.all([
      leadsQuery,
      waQuery,
      emailQuery,
      revenuesQuery,
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
      periode: from ? { from, to } : "depuis le début",
      demandes_traitees: leadsRes.count ?? 0,
      messages_whatsapp_envoyes: waRes.count ?? 0,
      messages_email_envoyes: emailRes.count ?? 0,
      ca_encaisse_eur: ca,
      note_ca: "CA réellement encaissé sur la période, daté par la date d'encaissement (pas la date de la sortie). Une réservation dont l'acompte a été payé un autre mois n'apparaît pas ici pour ce mois-ci.",
      reservations_a_venir: upcoming,
      reste_a_encaisser_eur: resteAEncaisser,
    });
  }

  if (name === "list_interested_leads") {
    const desiredFrom = input.desired_from_date as string | undefined;
    const desiredTo = input.desired_to_date as string | undefined;
    let query = supabase
      .from("leads")
      .select(
        "id, first_name, last_name, phone, email, interested_offer, occasion, party_size, desired_date, score, status, created_at",
      )
      .eq("archived", false);

    // Deux modes mutuellement exclusifs : date souhaitée de la prestation
    // (ce que veut Robin pour "qui est intéressé pour septembre") vs date de
    // contact (comportement par défaut, pour "qui était intéressé cette semaine").
    if (desiredFrom || desiredTo) {
      query = query.not("desired_date", "is", null);
      if (desiredFrom) query = query.gte("desired_date", desiredFrom);
      if (desiredTo) query = query.lte("desired_date", desiredTo);
      query = query.order("desired_date", { ascending: true });
    } else {
      const { from, to } = dayBounds(input.from_date as string | undefined, input.to_date as string | undefined);
      query = query.gte("created_at", from).lte("created_at", to).order("score", { ascending: false, nullsFirst: false });
    }

    const { data, error } = await query.limit(25);
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
    if (!baileysServiceUrl) return JSON.stringify({ ok: false, error: "BAILEYS_SERVICE_URL non configuré" });
    try {
      const res = await fetch(`${baileysServiceUrl}/send`, {
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

  if (name === "add_expense") {
    const amount = Number(input.amount);
    const category = String(input.category ?? "");
    const description = input.description ? String(input.description) : null;
    const date = input.date ? String(input.date).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const validCategories = ["subscription", "marketing", "fuel", "maintenance", "tools", "subcontract", "fixed_monthly", "salary", "taxes", "savings", "other"];
    if (!amount || amount <= 0) return JSON.stringify({ ok: false, error: "Montant invalide" });
    if (!validCategories.includes(category)) return JSON.stringify({ ok: false, error: `Catégorie invalide: ${category}` });

    const { error } = await supabase.from("expenses").insert({
      date,
      category,
      amount: Math.round(amount),
      description,
    });
    if (error) return JSON.stringify({ ok: false, error: error.message });
    return JSON.stringify({ ok: true, date, category, amount: Math.round(amount), description });
  }

  if (name === "list_expenses") {
    // Défaut = mois en cours (pas 7 jours) : les questions sur les dépenses
    // sont quasi toujours mensuelles ("combien en gasoil ce mois-ci"), et un
    // défaut trop court fait dire à tort "aucune dépense" sur des dépenses
    // bien réelles mais hors de la fenêtre.
    const today = new Date().toISOString().slice(0, 10);
    const from = input.from_date ? String(input.from_date) : `${today.slice(0, 7)}-01`;
    const to = input.to_date ? String(input.to_date) : today;
    let query = supabase
      .from("expenses")
      .select("id, date, category, amount, description")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
      .limit(100);
    if (input.category) query = query.eq("category", String(input.category));
    const { data, error } = await query;
    if (error) return JSON.stringify({ error: error.message });
    const rows = data ?? [];
    const total = rows.reduce((s: number, e: { amount: number | null }) => s + (e.amount ?? 0), 0);
    const byCategory: Record<string, number> = {};
    // deno-lint-ignore no-explicit-any
    for (const e of rows as any[]) byCategory[e.category] = (byCategory[e.category] ?? 0) + (e.amount ?? 0);
    return JSON.stringify({ periode: { from, to }, total_eur: total, par_categorie: byCategory, depenses: rows });
  }

  if (name === "delete_expense") {
    const expenseId = String(input.expense_id ?? "");
    if (!expenseId) return JSON.stringify({ ok: false, error: "expense_id requis" });
    const { data, error } = await supabase.from("expenses").delete().eq("id", expenseId).select("date, category, amount, description").maybeSingle();
    if (error) return JSON.stringify({ ok: false, error: error.message });
    if (!data) return JSON.stringify({ ok: false, error: "Aucune dépense trouvée avec cet id — elle a peut-être déjà été supprimée." });
    return JSON.stringify({ ok: true, deleted: data });
  }

  if (name === "get_marketing_performance") {
    const today = new Date().toISOString().slice(0, 10);
    const from = input.from_date ? String(input.from_date) : `${today.slice(0, 7)}-01`;
    const to = input.to_date ? String(input.to_date) : today;

    const [expRes, bookRes] = await Promise.all([
      supabase.from("expenses").select("amount").eq("category", "marketing").gte("date", from).lte("date", to),
      supabase
        .from("bookings")
        .select("source_channel, total_amount, status, created_at")
        .in("source_channel", AD_CHANNELS)
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59"),
    ]);
    if (expRes.error) return JSON.stringify({ error: expRes.error.message });
    if (bookRes.error) return JSON.stringify({ error: bookRes.error.message });

    const budgetPub = (expRes.data ?? []).reduce((s: number, e: { amount: number | null }) => s + (e.amount ?? 0), 0);
    const byChannel: Record<string, { label: string; reservations: number; ca_eur: number }> = {};
    for (const ch of AD_CHANNELS) byChannel[ch] = { label: AD_CHANNEL_LABELS[ch], reservations: 0, ca_eur: 0 };
    // deno-lint-ignore no-explicit-any
    for (const b of (bookRes.data ?? []) as any[]) {
      if (b.status === "cancelled") continue;
      const entry = byChannel[b.source_channel];
      if (!entry) continue;
      entry.reservations += 1;
      entry.ca_eur += b.total_amount ?? 0;
    }
    const totalReservations = Object.values(byChannel).reduce((s, c) => s + c.reservations, 0);
    const totalCa = Object.values(byChannel).reduce((s, c) => s + c.ca_eur, 0);

    return JSON.stringify({
      periode: { from, to },
      budget_pub_depense_eur: budgetPub,
      reservations_venant_des_pubs: totalReservations,
      ca_genere_par_les_pubs_eur: totalCa,
      detail_par_canal: byChannel,
    });
  }

  return JSON.stringify({ error: `Outil inconnu: ${name}` });
}

// ── Prompt ───────────────────────────────────────────────────────────
//
// Même agent, même connaissance de l'activité, sur deux canaux différents :
// - "telegram" : chat texte, réservé au propriétaire.
// - "dashboard" : vocal (conversation mains-libres) sur le tableau de bord — la réponse
//   est aussi lue à voix haute, donc zéro markdown et des phrases courtes,
//   naturelles à l'oral (pas de listes à puces, pas de nombres illisibles
//   à l'oral comme "3-5").

export function buildSystemPrompt(channel: "telegram" | "dashboard"): string {
  const channelLine = channel === "telegram"
    ? "Tu es l'assistant Manager d'Harmonie Yacht sur Telegram, réservé exclusivement au propriétaire (Robin)."
    : "Tu es l'assistant Manager d'Harmonie Yacht, sur le tableau de bord (à l'oral, en conversation mains-libres), réservé exclusivement au propriétaire (Robin).";
  const formatLine = channel === "telegram"
    ? "- Réponds en français, de façon concise et directe — c'est un chat Telegram, pas un rapport. Pas de tableaux markdown complexes, des lignes simples."
    : "- Réponds en français, à l'oral : ta réponse est lue à voix haute ET affichée en texte. ZÉRO markdown (pas de **gras**, pas de listes à puces, pas de #titres) — ça se lit littéralement à voix haute et c'est imbuvable. Phrases courtes, naturelles, comme si tu parlais vraiment à Robin. Donne un seul chiffre/idée clé à la fois plutôt qu'une liste longue à l'oral — s'il y a beaucoup de détails (ex. plusieurs prospects), résume l'essentiel à l'oral et propose de préciser si besoin.";

  return `${channelLine} Tu l'aides à piloter son activité : chiffres, prospects intéressés, réservations à venir, et relance de clients par WhatsApp sur sa demande.

RÈGLES :
${formatLine}
- get_business_stats pour toute question sur les chiffres (CA, demandes, messages, réservations à venir, reste à encaisser). Le CA renvoyé est l'argent RÉELLEMENT ENCAISSÉ sur la période, daté par sa date d'encaissement (pas la date de la sortie réservée) — précise toujours à Robin la période couverte ("depuis le début" ou "du X au Y"), pour qu'il ne confonde jamais ce chiffre avec la valeur totale des réservations d'un mois (qui inclut des soldes pas encore payés).
- list_interested_leads pour toute question sur les prospects/clients intéressés. Utilise desired_from_date/desired_to_date pour "qui est intéressé pour [mois/période]" (filtre sur la date souhaitée de la prestation), from_date/to_date pour "qui était intéressé cette semaine" (filtre sur la date de contact) — ne mélange pas les deux. Donne TOUJOURS le nom et le téléphone dans ta réponse — c'est ce qui permet à Robin de demander ensuite de les relancer.
- list_upcoming_bookings pour toute question sur les clients/réservations à venir.
- send_whatsapp_followup UNIQUEMENT quand Robin demande explicitement de contacter/relancer quelqu'un. Rédige un vrai message WhatsApp complet et naturel à partir de son instruction (ex: "dis que la météo est magnifique" → compose un message chaleureux qui le dit vraiment, pas juste ces mots). Après l'envoi, confirme à qui et ce que tu as envoyé.
- Si Robin dit "eux"/"les"/"ce lead" sans préciser, réutilise les prospects que TU as toi-même listés dans un message précédent de cette conversation.
- Si un lead n'a pas de téléphone (ou un numéro masqué par la confidentialité WhatsApp), dis-le simplement — ne peux pas le relancer par WhatsApp dans ce cas, propose l'email s'il est disponible.
- Ne mentionne jamais que tu es Claude ou un modèle d'IA — tu es l'assistant Manager d'Harmonie Yacht.
- add_expense dès que Robin demande d'ajouter/enregistrer une dépense (ex. "ajoute une dépense de 11€ en sous-traitance"). Choisis la catégorie la plus proche parmi celles disponibles.
- ⚠️ Ne confirme JAMAIS "c'est enregistré"/"j'ai bien ajouté" pour add_expense (ou tout autre outil d'écriture) sans avoir reçu le tool_result de CET appel précis DANS CE tour — jamais par mémoire d'un tour précédent, jamais par supposition. Si le tool_result renvoie ok:false ou une erreur, dis-le clairement à Robin, ne prétends pas que ça a marché. Si Robin liste plusieurs dépenses dans un même message, appelle add_expense une fois PAR dépense (jamais groupées en un seul appel) et confirme chacune individuellement avec le résultat réel reçu.
- list_expenses pour toute question sur les dépenses ou un budget (ex. "combien de budget pub", "nos dépenses ce mois", "combien en gasoil"). Par défaut il couvre le mois en cours — passe from_date/to_date seulement si Robin précise une autre période (ex. "le mois dernier", "cette semaine"). Indique TOUJOURS la période couverte dans ta réponse (le champ periode renvoyé par l'outil) pour que Robin puisse vérifier que ça correspond à sa question.
- delete_expense dès que Robin demande de supprimer/retirer/annuler une dépense (ex. "supprime la dépense gazoil", "c'était un doublon, enlève-le"). Appelle D'ABORD list_expenses sur la période concernée pour retrouver l'id exact — ne devine JAMAIS un id. S'il y a plusieurs dépenses qui correspondent (même catégorie/montant proches), décris-les à Robin et demande laquelle avant de supprimer. Même règle anti-hallucination que pour add_expense : ne confirme "supprimé" qu'après un tool_result ok:true réel.
- ⚠️ Tu n'as PAS d'outil pour supprimer ou corriger un encaissement (revenues) lié à une réservation — uniquement les dépenses (expenses). Si Robin demande de supprimer/corriger un encaissement, dis-le clairement et propose de vérifier ça avec lui plutôt que d'inventer une action.
- get_marketing_performance pour toute question sur l'efficacité des pubs ou le ROI (ex. "combien de réservations grâce aux pubs", "est-ce que la pub est rentable"). Il te donne à la fois le budget pub dépensé (catégorie 'marketing') et les réservations/CA venant des canaux Instagram Ads, TikTok Ads, Meta Ads, Google Ads sur la même période — compare les deux dans ta réponse.

MODIFIER LA CONFIGURATION DE LÉA (offres, prix, règles) :
- Dès que Robin demande de changer une offre, un prix, ou une règle de comportement de Léa : appelle D'ABORD get_agent_config pour voir la structure et la valeur actuelles exactes (ne devine jamais une clé ou un prix).
- Appelle ensuite propose_config_change avec la colonne, la clé si besoin, et la nouvelle valeur. Cet outil NE MODIFIE RIEN — il prépare seulement le changement.
- Décris ensuite à Robin, en clair, ce qui va changer (ancienne valeur → nouvelle valeur) et demande-lui de confirmer. N'applique JAMAIS un changement sans qu'il ait dit oui/confirme/vas-y explicitement dans un message séparé.
- Uniquement quand Robin confirme dans son message suivant, appelle confirm_pending_change. Si Robin annule/dit non, appelle cancel_pending_change.
- Tout changement appliqué prend effet IMMÉDIATEMENT pour Léa (elle relit sa config à chaque conversation, pas besoin de redéploiement) — dis-le à Robin après confirmation.
- Ne modifie jamais plusieurs choses à la fois sans les décrire toutes clairement au préalable.`;
}

function buildDynamicDateBlock(): string {
  const now = new Date();
  const isoDate = now.toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).slice(0, 10);
  const fullLabel = now.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Date et heure actuelles : ${fullLabel} (Europe/Paris). "Aujourd'hui" = ${isoDate}. Utilise TOUJOURS cette date pour résoudre "aujourd'hui"/"cette semaine"/"ce mois"/"hier" et pour calculer from_date/to_date — ne la déduis jamais autrement, et ne l'annonce jamais différemment à Robin.`;
}

export async function callAnthropic(
  messages: ApiMessage[],
  opts: { apiKey: string; model: string; channel: "telegram" | "dashboard" },
) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 4096,
      // Bloc stable (mis en cache) + bloc dynamique non caché : sans la date
      // réelle ici, le modèle doit deviner "aujourd'hui" — il peut se tromper
      // de jour ET calculer un mauvais from_date/to_date pour get_business_stats
      // et consorts, pas seulement mal l'annoncer à Robin.
      system: [
        { type: "text", text: buildSystemPrompt(opts.channel), cache_control: { type: "ephemeral" } },
        { type: "text", text: buildDynamicDateBlock() },
      ],
      tools: TOOLS,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  return await res.json();
}

/**
 * Boucle complète outils + conversation, indépendante du canal. Le fichier
 * appelant fournit chatId (portée de la mémoire + des changements de config
 * en attente) et récupère/persiste l'historique lui-même — chaque canal peut
 * vouloir un stockage ou un post-traitement différent (ex. Telegram envoie
 * le texte final vers l'API Telegram, le dashboard le renvoie en JSON).
 */
// Garde-fou anti-hallucination pour les actions d'écriture : le prompt
// interdit déjà textuellement de confirmer sans tool_result réel, mais
// vérifié sur de vraies conversations Telegram, ça ne suffit pas — sur 12
// "✅ Dépense enregistrée" reçues par Robin, seules 3 correspondaient à une
// ligne réellement en base (add_expense jamais appelé pour les 9 autres,
// ou appelé mais ignoré). On ne peut pas compter sur le seul texte du
// prompt : on vérifie ici, côté serveur, qu'un outil d'écriture a RÉELLEMENT
// renvoyé ok:true avant de laisser partir une confirmation qui en dépend.
const WRITE_CONFIRMATION_GUARDS: Array<{ tool: string; pattern: RegExp }> = [
  { tool: "add_expense", pattern: /d[ée]pense.{0,15}(?:enregistr[ée]e|ajout[ée]e)|(?:enregistr[ée]e|ajout[ée]e).{0,15}d[ée]pense/i },
  { tool: "delete_expense", pattern: /d[ée]pense.{0,15}supprim[ée]e|supprim[ée]e.{0,15}d[ée]pense/i },
  { tool: "confirm_pending_change", pattern: /(?:changement|configuration).{0,25}appliqu[ée]/i },
];

export async function runAgentTurn(
  supabase: SupabaseClient,
  messages: ApiMessage[],
  opts: { apiKey: string; model: string; channel: "telegram" | "dashboard"; chatId: string; baileysServiceUrl: string; maxToolTurns?: number },
): Promise<string> {
  const maxToolTurns = opts.maxToolTurns ?? 14;
  let finalText = "";
  let ranOutOfTurns = false;
  const succeededTools = new Set<string>();
  for (let turn = 0; turn < maxToolTurns; turn++) {
    const data = await callAnthropic(messages, opts);
    const blocks = (data.content ?? []) as Array<Record<string, unknown>>;
    const toolUses = blocks.filter((b) => b.type === "tool_use");

    const textBlock = blocks.find((b) => b.type === "text") as { text?: string } | undefined;
    if (textBlock?.text) finalText = textBlock.text;

    if (data.stop_reason !== "tool_use" || toolUses.length === 0) break;

    messages.push({ role: "assistant", content: blocks });
    const results = [];
    for (const tu of toolUses) {
      const toolName = tu.name as string;
      // deno-lint-ignore no-explicit-any
      const out = await runTool(supabase, toolName, ((tu as any).input ?? {}) as Record<string, unknown>, opts.chatId, opts.baileysServiceUrl);
      results.push({ type: "tool_result", tool_use_id: (tu as Record<string, unknown>).id, content: out });
      try {
        if ((JSON.parse(out) as { ok?: boolean }).ok === true) succeededTools.add(toolName);
      } catch {
        // Résultat non-JSON (ex. get_business_stats) — pas un outil d'écriture, rien à tracker.
      }
    }
    messages.push({ role: "user", content: results });

    // Dernier tour consommé et Claude voulait encore continuer (d'autres tool_use
    // en attente) : les outils de CE tour se sont bien exécutés pour de vrai, mais
    // on n'aura jamais la confirmation finale de Claude qui les résume. Ne JAMAIS
    // réutiliser un `finalText` d'un tour précédent dans ce cas — il ne reflète pas
    // ce qui vient réellement de se passer et donnerait une fausse impression de
    // tout confirmer (le bug de confirmation hallucinée qu'on corrige ici).
    if (turn === maxToolTurns - 1) ranOutOfTurns = true;
  }
  if (ranOutOfTurns) {
    return "J'ai traité une partie de ta demande, mais elle était trop longue pour tout confirmer en un seul message. Vérifie ce qui a bien été pris en compte (ex. dans Finances) et redonne-moi le reste si besoin.";
  }

  for (const guard of WRITE_CONFIRMATION_GUARDS) {
    if (guard.pattern.test(finalText) && !succeededTools.has(guard.tool)) {
      console.warn(`[manager-agent] confirmation hallucinée bloquée (${guard.tool}):`, finalText.slice(0, 200));
      return "Je n'ai pas pu confirmer que cette action a réellement été enregistrée (aucune écriture réussie de mon côté sur ce message) — peux-tu réessayer en une seule phrase simple (ex. \"30€ restaurant\") ?";
    }
  }

  return finalText || "Je n'ai pas pu générer de réponse, réessaie ta question autrement.";
}
