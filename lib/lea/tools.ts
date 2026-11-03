import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import { LEAD_COLUMNS, LEAD_STATUSES, type LeadStatus } from "@/lib/leads";
import {
  archiveLead,
  bulkUpdateStatus,
  createLead,
  getConversations,
  markLost,
  sendMessage,
  triggerManualFollowup,
  updateAiMemo,
  updateLeadFields,
  updateLeadNotes,
  updateLeadStatus,
  type LeadFieldsUpdate,
} from "@/app/(dashboard)/leads/actions";
import {
  cancelBooking,
  createBooking,
  settleBalance,
  updateBooking,
  type BookingUpdate,
} from "@/app/(dashboard)/bookings/actions";
import { addExpense, addRevenue } from "@/app/(dashboard)/finances/actions";
import { addEventBooking, createEvent } from "@/app/(dashboard)/events/actions";
import { askManager } from "@/lib/lea/manager";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCompta } from "@/lib/compta/data";
import { resultOf } from "@/lib/compta/ledger";
import { obligations } from "@/lib/compta/vat";
import { classifyMovement } from "@/app/(dashboard)/compta/actions";

// ═══════════════════════════════════════════════════════════════════════
// Les MAINS de Léa sur le tableau de bord.
//
// Règle d'or : chaque écriture passe par la MÊME action serveur que le bouton
// correspondant de l'interface (app/(dashboard)/*/actions.ts). Léa ne réécrit
// aucune règle métier — créer un lead, encaisser un solde ou relancer un
// prospect fait exactement ce que fait Robin à la main, avec la même session
// (donc les mêmes droits) et les mêmes rafraîchissements de pages.
//
// Ce que les outils dédiés ne couvrent pas (config de Léa, analyse financière
// fine, caisse espèces) est délégué à l'agent Manager déjà en production via
// `ask_manager` — un seul cerveau pour ces sujets, pas deux.
//
// Actions SENSIBLES (un message part chez un client, ou quelque chose
// disparaît) : elles exigent `confirmed: true` ET un « oui » explicite de
// Robin dans son DERNIER message. Le contrôle est fait ici, dans le code,
// pas seulement dans la consigne du modèle.
// ═══════════════════════════════════════════════════════════════════════

export type ToolOutcome = {
  /** Contenu renvoyé au modèle (JSON). */
  result: string;
  isError: boolean;
  /** Trace lisible pour l'interface (puce « ✓ Lead créé »). Absente pour une lecture. */
  action?: { label: string; ok: boolean };
};

const EXPENSE_CATEGORIES = ["subscription", "marketing", "fuel", "maintenance", "tools", "subcontract", "fixed_monthly", "salary", "taxes", "savings", "other"];
const REVENUE_TYPES = ["sea_trip", "unusual_night", "efoil", "other"];
const BOOKING_TYPES = ["sortie_privative", "nuit_insolite", "nuit_prestige", "efoil"];
const PAYMENT_METHODS = ["cb", "especes", "virement", "cheque"];

/** Les outils qui exigent le « oui » explicite de Robin. */
export const SENSITIVE_TOOLS = new Set([
  "send_message_to_lead",
  "relaunch_lead",
  "archive_leads",
  "cancel_booking",
]);

const CONFIRMED = { type: "boolean", description: "true UNIQUEMENT si Robin vient de dire oui à CETTE action précise, dans son dernier message." } as const;

export const LEA_TOOLS: Anthropic.Beta.BetaTool[] = [
  // ── Lecture ─────────────────────────────────────────────────────────
  {
    name: "search_leads",
    description: "Cherche des leads (prospects) par nom, téléphone, email ou offre, et/ou par statut. À appeler AVANT toute action sur un lead pour obtenir son id exact — ne jamais deviner un id.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Texte libre : prénom, nom, téléphone, email ou offre." },
        status: { type: "string", enum: [...LEAD_STATUSES] },
        needs_human: { type: "boolean", description: "Seulement les leads que Léa WhatsApp a escaladés." },
        limit: { type: "number", description: "Par défaut 15, max 50." },
      },
    },
  },
  {
    name: "get_lead",
    description: "Fiche complète d'un lead : coordonnées, besoin, statut, score, notes, mémo de Léa, et les derniers messages échangés.",
    input_schema: { type: "object", properties: { lead_id: { type: "string" } }, required: ["lead_id"] },
  },
  {
    name: "list_bookings",
    description: "Liste des réservations (sorties, nuits, e-foil) sur une période, avec client, montant, acompte et solde dû. Pour retrouver l'id d'une réservation.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Date de début AAAA-MM-JJ (défaut : aujourd'hui)." },
        to: { type: "string", description: "Date de fin AAAA-MM-JJ (défaut : +60 jours)." },
        query: { type: "string", description: "Filtre sur le nom du client ou l'offre." },
        include_cancelled: { type: "boolean" },
      },
    },
  },
  {
    name: "get_finance_summary",
    description: "Chiffre d'affaires, charges et résultat sur une période, solde bancaire Qonto et dernier score de santé financière.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "AAAA-MM-JJ (défaut : 1er du mois)." },
        to: { type: "string", description: "AAAA-MM-JJ (défaut : aujourd'hui)." },
      },
    },
  },
  // ── Leads ───────────────────────────────────────────────────────────
  {
    name: "create_lead",
    description: "Crée un nouveau lead (prospect). Il arrive en statut « Qualifié ». Prénom et téléphone requis.",
    input_schema: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        interested_offer: { type: "string", description: "Ex. « Sortie privative 3h », « Nuit Insolite »." },
        source_channel: { type: "string", description: "instagram_organic, whatsapp, website, google_organic, word_of_mouth, phone, email, chatgpt, other…" },
        occasion: { type: "string" },
        party_size: { type: "number" },
        desired_date: { type: "string", description: "AAAA-MM-JJ" },
        desired_time_slot: { type: "string" },
        notes: { type: "string" },
      },
      required: ["first_name", "phone"],
    },
  },
  {
    name: "update_lead",
    description: "Modifie les informations d'un lead : coordonnées, offre visée, occasion, nombre de personnes, date souhaitée, créneau, score (1-10), canal d'origine, besoin d'intervention humaine.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        interested_offer: { type: "string" },
        occasion: { type: "string" },
        party_size: { type: "number" },
        desired_date: { type: "string", description: "AAAA-MM-JJ" },
        desired_time_slot: { type: "string" },
        score: { type: "number" },
        source_channel: { type: "string" },
        needs_human_intervention: { type: "boolean" },
      },
      required: ["lead_id"],
    },
  },
  {
    name: "set_lead_status",
    description: "Change l'étape d'un ou plusieurs leads dans le pipeline (new, contacted, qualified, quote_sent, followed_up, booked, lost). Pour « lost », donner la raison.",
    input_schema: {
      type: "object",
      properties: {
        lead_ids: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: [...LEAD_STATUSES] },
        lost_reason: { type: "string" },
      },
      required: ["lead_ids", "status"],
    },
  },
  {
    name: "add_lead_note",
    description: "Ajoute une note datée à la fiche d'un lead (sans effacer les notes existantes).",
    input_schema: { type: "object", properties: { lead_id: { type: "string" }, note: { type: "string" } }, required: ["lead_id", "note"] },
  },
  {
    name: "update_lead_memo",
    description: "Remplace le mémo de Léa sur un lead (le résumé que l'agent WhatsApp relit avant de répondre).",
    input_schema: { type: "object", properties: { lead_id: { type: "string" }, memo: { type: "string" } }, required: ["lead_id", "memo"] },
  },
  {
    name: "send_message_to_lead",
    description: "SENSIBLE — envoie un vrai message au lead sur son canal (WhatsApp ou email) au nom de Robin ; Léa WhatsApp est alors mise en pause sur ce fil. Rédige un message complet et chaleureux. Montre d'abord le texte à Robin et attends son « oui ».",
    input_schema: {
      type: "object",
      properties: { lead_id: { type: "string" }, text: { type: "string" }, confirmed: CONFIRMED },
      required: ["lead_id", "text", "confirmed"],
    },
  },
  {
    name: "relaunch_lead",
    description: "SENSIBLE — déclenche la relance automatique d'un lead (WhatsApp par Léa, ou email selon son canal). Annonce d'abord qui sera relancé et attends le « oui » de Robin.",
    input_schema: {
      type: "object",
      properties: { lead_id: { type: "string" }, confirmed: CONFIRMED },
      required: ["lead_id", "confirmed"],
    },
  },
  {
    name: "archive_leads",
    description: "SENSIBLE — archive un ou plusieurs leads (ils disparaissent du pipeline). Liste-les d'abord à Robin et attends son « oui ».",
    input_schema: {
      type: "object",
      properties: { lead_ids: { type: "array", items: { type: "string" } }, confirmed: CONFIRMED },
      required: ["lead_ids", "confirmed"],
    },
  },
  // ── Réservations ────────────────────────────────────────────────────
  {
    name: "create_booking",
    description: "Crée une réservation (et sa fiche client). Récapitule les informations à Robin avant si un élément important manque (date, offre, montant).",
    input_schema: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        date: { type: "string", description: "AAAA-MM-JJ" },
        start_time: { type: "string", description: "HH:MM" },
        end_time: { type: "string", description: "HH:MM" },
        offer_name: { type: "string" },
        booking_type: { type: "string", enum: BOOKING_TYPES },
        party_size: { type: "number" },
        total_amount: { type: "number" },
        deposit_amount: { type: "number" },
        deposit_paid: { type: "boolean" },
        source_channel: { type: "string" },
        status: { type: "string", enum: ["confirmed", "pending"] },
        notes: { type: "string" },
      },
      required: ["first_name", "date", "offer_name", "booking_type", "total_amount"],
    },
  },
  {
    name: "update_booking",
    description: "Modifie une réservation : date, horaires, offre, nombre de personnes, montant, remise, acompte, statut, coordonnées du client.",
    input_schema: {
      type: "object",
      properties: {
        booking_id: { type: "string" },
        date: { type: "string" },
        start_time: { type: "string" },
        end_time: { type: "string" },
        offer_name: { type: "string" },
        party_size: { type: "number" },
        total_amount: { type: "number" },
        discount_amount: { type: "number" },
        discount_reason: { type: "string" },
        deposit_amount: { type: "number" },
        deposit_paid: { type: "boolean" },
        status: { type: "string", enum: ["confirmed", "pending", "completed"] },
        customer_first_name: { type: "string" },
        customer_last_name: { type: "string" },
        customer_email: { type: "string" },
        customer_phone: { type: "string" },
      },
      required: ["booking_id"],
    },
  },
  {
    name: "settle_balance",
    description: "Encaisse le solde (ou une partie) d'une réservation, en un ou plusieurs moyens de paiement. Crée aussi la ligne de chiffre d'affaires.",
    input_schema: {
      type: "object",
      properties: {
        booking_id: { type: "string" },
        payments: {
          type: "array",
          items: {
            type: "object",
            properties: { method: { type: "string", enum: PAYMENT_METHODS }, amount: { type: "number" } },
            required: ["method", "amount"],
          },
        },
      },
      required: ["booking_id", "payments"],
    },
  },
  {
    name: "cancel_booking",
    description: "SENSIBLE — annule une réservation (elle disparaît des listes actives et de Google Agenda). Rappelle laquelle et attends le « oui » de Robin.",
    input_schema: {
      type: "object",
      properties: { booking_id: { type: "string" }, confirmed: CONFIRMED },
      required: ["booking_id", "confirmed"],
    },
  },
  // ── Finance ─────────────────────────────────────────────────────────
  {
    name: "add_expense",
    description: "Enregistre une dépense. Une dépense par appel.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "AAAA-MM-JJ (aujourd'hui par défaut)" },
        category: { type: "string", enum: EXPENSE_CATEGORIES },
        amount: { type: "number" },
        description: { type: "string" },
      },
      required: ["category", "amount"],
    },
  },
  {
    name: "add_revenue",
    description: "Enregistre un revenu hors réservation (vente sur place, e-foil…). Pour le solde d'une réservation, utiliser settle_balance.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string" },
        type: { type: "string", enum: REVENUE_TYPES },
        amount: { type: "number" },
        note: { type: "string" },
      },
      required: ["type", "amount"],
    },
  },
  // ── Événements ──────────────────────────────────────────────────────
  {
    name: "create_event",
    description: "Crée un événement public (soirée à thème, coucher de soleil partagé…), publié immédiatement.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        theme: { type: "string" },
        description: { type: "string" },
        date: { type: "string" },
        start_time: { type: "string" },
        end_time: { type: "string" },
        price_per_person: { type: "number" },
        max_participants: { type: "number" },
      },
      required: ["title", "date"],
    },
  },
  {
    name: "add_event_booking",
    description: "Inscrit une ou plusieurs personnes à un événement public existant.",
    input_schema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        party_size: { type: "number" },
        total_paid: { type: "number" },
        payment_status: { type: "string", enum: ["paid", "pending"] },
      },
      required: ["event_id", "first_name"],
    },
  },
  // ── Comptabilité ────────────────────────────────────────────────────
  {
    name: "get_compta_status",
    description: "État de la comptabilité de l'exercice : mouvements bancaires et de caisse à classer (avec le classement proposé), justificatifs manquants, prochaine déclaration de TVA, résultat HT, et le plan de comptes disponible (codes). À appeler avant de classer.",
    input_schema: { type: "object", properties: { year: { type: "integer" } } },
  },
  {
    name: "classify_movements",
    description: "Classe un ou plusieurs mouvements en comptabilité (compte du plan comptable + taux de TVA). N'utilise que des `key` et des `account_code` renvoyés par get_compta_status. Taux autorisés : 0, 2.1, 5.5, 10, 20. reverse_charge = autoliquidation (fournisseur étranger qui facture HT : Google, Meta, logiciels US…). Si tu hésites sur un compte, ne classe pas : demande à Robin.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "Identifiant du mouvement, ex. bank:…" },
              account_code: { type: "string" },
              vat_rate: { type: "number" },
              reverse_charge: { type: "boolean" },
              no_receipt_reason: { type: "string", description: "Seulement si aucune facture n'existera (frais bancaires sur relevé, virement interne…)." },
            },
            required: ["key", "account_code", "vat_rate"],
          },
        },
      },
      required: ["items"],
    },
  },
  // ── Délégation au Manager ───────────────────────────────────────────
  {
    name: "ask_manager",
    description: "Transmet une demande à l'agent Manager (le même cerveau que sur Telegram) pour ce que tes outils ne couvrent pas : changer une offre, un prix ou une règle de comportement de Léa WhatsApp (avec sa confirmation), analyse financière détaillée, caisse espèces, performance marketing, rapport de trous de données. Reformule la demande de Robin, complète et autonome.",
    input_schema: { type: "object", properties: { request: { type: "string" } }, required: ["request"] },
  },
];

// ── Exécution ─────────────────────────────────────────────────────────

type Input = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const today = () => new Date().toISOString().slice(0, 10);
const json = (v: unknown) => JSON.stringify(v);

function done(label: string, r: { ok: boolean; error?: string | null }, data?: unknown): ToolOutcome {
  return {
    result: json(r.ok ? { ok: true, data: data ?? null } : { ok: false, error: r.error ?? "Échec" }),
    isError: !r.ok,
    action: { label, ok: r.ok },
  };
}

function read(data: unknown): ToolOutcome {
  return { result: json(data), isError: false };
}

const STATUS_LABEL: Record<string, string> = Object.fromEntries(LEAD_COLUMNS.map((c) => [c.status, c.label]));

function frDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function fullName(first?: string | null, last?: string | null) {
  return [first, last].filter(Boolean).join(" ").trim() || "lead";
}

/** Un « oui » franc, tout seul ou en tête de message. */
export function isAffirmative(text: string): boolean {
  const t = text.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /^(oui|ouais|ok|okay|yes|go|vas[- ]y|valide|je valide|confirme|je confirme|c'?est bon|d'?accord|parfait|fais[- ]le|carrement|bien sur)\b/.test(t);
}

async function leadName(id: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("first_name, last_name").eq("id", id).maybeSingle();
  return fullName(data?.first_name, data?.last_name);
}

export async function runLeaTool(name: string, input: Input, lastUserText: string): Promise<ToolOutcome> {
  // Garde-fou côté serveur : une action sensible n'est exécutée que si Robin
  // vient de dire oui — quoi que le modèle ait mis dans `confirmed`.
  if (SENSITIVE_TOOLS.has(name) && !(input.confirmed === true && isAffirmative(lastUserText))) {
    return {
      result: json({
        ok: false,
        needs_confirmation: true,
        error: "Action sensible non exécutée : décris-la précisément à Robin et attends son « oui » explicite dans son prochain message.",
      }),
      isError: false,
    };
  }

  const supabase = await createClient();

  switch (name) {
    // ── Lecture ──
    case "search_leads": {
      const limit = Math.min(50, num(input.limit) ?? 15);
      let q = supabase
        .from("leads")
        .select("id, first_name, last_name, phone, email, status, score, interested_offer, occasion, party_size, desired_date, source_channel, needs_human_intervention, last_interaction_at")
        .eq("archived", false)
        .order("last_interaction_at", { ascending: false, nullsFirst: false })
        .limit(limit);
      // « Camille Martin » : la base cherche sur le mot le plus long, puis on
      // garde les fiches qui contiennent TOUS les mots (prénom + nom réunis).
      const tokens = (str(input.query) ?? "")
        .replace(/[,()%"]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1);
      if (tokens.length) {
        const p = `"%${[...tokens].sort((a, b) => b.length - a.length)[0]}%"`;
        q = q.or(`first_name.ilike.${p},last_name.ilike.${p},phone.ilike.${p},email.ilike.${p},interested_offer.ilike.${p}`);
      }
      if (str(input.status)) q = q.eq("status", str(input.status)!);
      if (input.needs_human === true) q = q.eq("needs_human_intervention", true);
      const { data, error } = await q;
      if (error) return { result: json({ ok: false, error: error.message }), isError: true };
      const norm = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const leads = tokens.length > 1
        ? (data ?? []).filter((l) => {
            const hay = norm(`${l.first_name} ${l.last_name} ${l.phone} ${l.email} ${l.interested_offer}`);
            return tokens.every((t) => hay.includes(norm(t)));
          })
        : data;
      return read({ ok: true, leads });
    }
    case "get_lead": {
      const id = str(input.lead_id);
      if (!id) return { result: json({ ok: false, error: "lead_id requis" }), isError: true };
      const [{ data: lead }, convs] = await Promise.all([
        supabase.from("leads").select("*").eq("id", id).maybeSingle(),
        getConversations(id),
      ]);
      if (!lead) return { result: json({ ok: false, error: "Lead introuvable" }), isError: true };
      const messages = (convs.ok ? convs.data : []).flatMap((c) => c.messages).slice(-12);
      return read({ ok: true, lead, recent_messages: messages });
    }
    case "list_bookings": {
      const from = str(input.from) ?? today();
      const to = str(input.to) ?? new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
      let q = supabase
        .from("bookings")
        .select("id, date, start_time, end_time, offer_name, party_size, total_amount, deposit_amount, deposit_paid, balance_due, status, is_gift_card, notes, customers(first_name, last_name, phone, email)")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true })
        .limit(60);
      if (input.include_cancelled !== true) q = q.neq("status", "cancelled");
      const { data, error } = await q;
      if (error) return { result: json({ ok: false, error: error.message }), isError: true };
      const query = str(input.query)?.toLowerCase();
      type Row = { offer_name: string | null; customers: { first_name: string | null; last_name: string | null } | null };
      const rows = query
        ? (data as unknown as Row[]).filter((b) =>
            `${b.offer_name ?? ""} ${b.customers?.first_name ?? ""} ${b.customers?.last_name ?? ""}`.toLowerCase().includes(query),
          )
        : data;
      return read({ ok: true, bookings: rows });
    }
    case "get_finance_summary": {
      const d = new Date();
      const from = str(input.from) ?? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const to = str(input.to) ?? today();
      const [rev, exp, bank] = await Promise.all([
        supabase.from("revenues").select("amount, type").gte("date", from).lte("date", to),
        supabase.from("expenses").select("amount, category").gte("date", from).lte("date", to),
        supabase.from("bank_accounts").select("name, balance_cents, balance_updated_at").neq("status", "closed"),
      ]);
      const { data: snap } = await (supabase as unknown as {
        from: (t: string) => { select: (c: string) => { order: (c: string, o: object) => { limit: (n: number) => { maybeSingle: () => Promise<{ data: unknown }> } } } };
      })
        .from("financial_snapshots")
        .select("date, score, score_label, treasury, runway_months, monthly_burn, outstanding")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      const revenue = (rev.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const expenses = (exp.data ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0);
      return read({
        ok: true,
        period: { from, to },
        revenue,
        expenses,
        net: revenue - expenses,
        bank_balance_eur: (bank.data ?? []).reduce((s, a) => s + (a.balance_cents ?? 0), 0) / 100,
        latest_health_snapshot: snap ?? null,
      });
    }

    // ── Leads ──
    case "create_lead": {
      const first = str(input.first_name) ?? "";
      const r = await createLead({
        first_name: first,
        phone: str(input.phone) ?? "",
        interested_offer: str(input.interested_offer) ?? null,
        source_channel: str(input.source_channel) ?? null,
      });
      if (!r.ok || !r.data) return done(`Création du lead ${first}`, r);
      const id = r.data.id as string;
      const extra: LeadFieldsUpdate = {};
      if (str(input.last_name)) extra.last_name = str(input.last_name)!;
      if (str(input.email)) extra.email = str(input.email)!;
      if (str(input.occasion)) extra.occasion = str(input.occasion)!;
      if (num(input.party_size)) extra.party_size = num(input.party_size)!;
      if (str(input.desired_date)) extra.desired_date = str(input.desired_date)!;
      if (str(input.desired_time_slot)) extra.desired_time_slot = str(input.desired_time_slot)!;
      if (Object.keys(extra).length) await updateLeadFields(id, extra);
      if (str(input.notes)) await updateLeadNotes(id, str(input.notes)!);
      return done(`Lead créé : ${fullName(first, str(input.last_name))}`, { ok: true }, { lead_id: id });
    }
    case "update_lead": {
      const id = str(input.lead_id);
      if (!id) return { result: json({ ok: false, error: "lead_id requis" }), isError: true };
      const fields: LeadFieldsUpdate = {};
      for (const k of ["first_name", "last_name", "email", "phone", "interested_offer", "occasion", "desired_date", "desired_time_slot", "source_channel"] as const) {
        if (str(input[k]) !== undefined) fields[k] = str(input[k])!;
      }
      if (num(input.party_size) !== undefined) fields.party_size = num(input.party_size)!;
      if (num(input.score) !== undefined) fields.score = Math.max(1, Math.min(10, Math.round(num(input.score)!)));
      if (typeof input.needs_human_intervention === "boolean") fields.needs_human_intervention = input.needs_human_intervention;
      if (Object.keys(fields).length === 0) return { result: json({ ok: false, error: "Aucun champ à modifier" }), isError: true };
      return done(`Fiche de ${await leadName(id)} mise à jour`, await updateLeadFields(id, fields));
    }
    case "set_lead_status": {
      const ids = Array.isArray(input.lead_ids) ? (input.lead_ids as unknown[]).map(String).filter(Boolean) : [];
      const status = str(input.status) as LeadStatus | undefined;
      if (!ids.length || !status || !LEAD_STATUSES.includes(status)) {
        return { result: json({ ok: false, error: "lead_ids et statut valide requis" }), isError: true };
      }
      if (status === "lost") {
        const reason = str(input.lost_reason) ?? "Raison non précisée";
        const results = await Promise.all(ids.map((id) => markLost(id, reason)));
        const failed = results.find((r) => !r.ok);
        return done(`${ids.length} lead${ids.length > 1 ? "s" : ""} marqué${ids.length > 1 ? "s" : ""} perdu${ids.length > 1 ? "s" : ""}`, failed ?? { ok: true });
      }
      const r = ids.length === 1 ? await updateLeadStatus(ids[0], status) : await bulkUpdateStatus(ids, status);
      const label = ids.length === 1
        ? `${await leadName(ids[0])} → ${STATUS_LABEL[status] ?? status}`
        : `${ids.length} leads → ${STATUS_LABEL[status] ?? status}`;
      return done(label, r);
    }
    case "add_lead_note": {
      const id = str(input.lead_id);
      const note = str(input.note);
      if (!id || !note) return { result: json({ ok: false, error: "lead_id et note requis" }), isError: true };
      const { data } = await supabase.from("leads").select("notes, first_name, last_name").eq("id", id).maybeSingle();
      const stamp = `[${new Date().toLocaleDateString("fr-FR")} · Léa] ${note}`;
      const notes = data?.notes ? `${data.notes}\n${stamp}` : stamp;
      return done(`Note ajoutée à ${fullName(data?.first_name, data?.last_name)}`, await updateLeadNotes(id, notes));
    }
    case "update_lead_memo": {
      const id = str(input.lead_id);
      if (!id) return { result: json({ ok: false, error: "lead_id requis" }), isError: true };
      return done(`Mémo de ${await leadName(id)} mis à jour`, await updateAiMemo(id, str(input.memo) ?? ""));
    }
    case "send_message_to_lead": {
      const id = str(input.lead_id);
      const text = str(input.text);
      if (!id || !text) return { result: json({ ok: false, error: "lead_id et text requis" }), isError: true };
      const r = await sendMessage(id, text);
      return done(`Message envoyé à ${await leadName(id)}`, r, r.ok ? { delivered: r.data?.delivered, channel: r.data?.channel } : undefined);
    }
    case "relaunch_lead": {
      const id = str(input.lead_id);
      if (!id) return { result: json({ ok: false, error: "lead_id requis" }), isError: true };
      return done(`Relance lancée : ${await leadName(id)}`, await triggerManualFollowup(id));
    }
    case "archive_leads": {
      const ids = Array.isArray(input.lead_ids) ? (input.lead_ids as unknown[]).map(String).filter(Boolean) : [];
      if (!ids.length) return { result: json({ ok: false, error: "lead_ids requis" }), isError: true };
      const results = await Promise.all(ids.map((id) => archiveLead(id)));
      return done(`${ids.length} lead${ids.length > 1 ? "s" : ""} archivé${ids.length > 1 ? "s" : ""}`, results.find((r) => !r.ok) ?? { ok: true });
    }

    // ── Réservations ──
    case "create_booking": {
      const total = num(input.total_amount) ?? 0;
      const r = await createBooking({
        first_name: str(input.first_name) ?? "",
        last_name: str(input.last_name) ?? "",
        email: str(input.email) ?? null,
        phone: str(input.phone) ?? null,
        date: str(input.date) ?? today(),
        start_time: str(input.start_time) ?? null,
        end_time: str(input.end_time) ?? null,
        offer_name: str(input.offer_name) ?? null,
        booking_type: str(input.booking_type) ?? "sortie_privative",
        party_size: num(input.party_size) ?? null,
        total_amount: total,
        deposit_amount: num(input.deposit_amount) ?? Math.round(total * 0.3),
        deposit_paid: input.deposit_paid === true,
        source_channel: str(input.source_channel) ?? null,
        status: str(input.status) ?? "confirmed",
        notes: str(input.notes) ?? null,
      });
      return done(`Réservation créée : ${str(input.offer_name)} le ${frDate(str(input.date))} (${fullName(str(input.first_name), str(input.last_name))})`, r);
    }
    case "update_booking": {
      const id = str(input.booking_id);
      if (!id) return { result: json({ ok: false, error: "booking_id requis" }), isError: true };
      // updateBooking attend la fiche complète : on part de l'existant et on
      // n'écrase que ce que Robin a demandé de changer.
      const { data: cur } = await supabase
        .from("bookings")
        .select("source_channel, status, party_size, offer_name, total_amount, discount_amount, discount_reason")
        .eq("id", id)
        .maybeSingle();
      if (!cur) return { result: json({ ok: false, error: "Réservation introuvable" }), isError: true };
      const values: BookingUpdate = {
        source_channel: cur.source_channel,
        status: str(input.status) ?? cur.status,
        party_size: num(input.party_size) ?? cur.party_size,
        offer_name: str(input.offer_name) ?? cur.offer_name,
        total_amount: num(input.total_amount) ?? cur.total_amount,
        discount_amount: num(input.discount_amount) ?? cur.discount_amount,
        discount_reason: str(input.discount_reason) ?? cur.discount_reason,
      };
      if (str(input.date)) values.date = str(input.date)!;
      if (str(input.start_time)) values.start_time = str(input.start_time)!;
      if (str(input.end_time)) values.end_time = str(input.end_time)!;
      if (num(input.deposit_amount) !== undefined) values.deposit_amount = num(input.deposit_amount)!;
      if (typeof input.deposit_paid === "boolean") values.deposit_paid = input.deposit_paid;
      for (const k of ["customer_first_name", "customer_last_name", "customer_email", "customer_phone"] as const) {
        if (str(input[k])) values[k] = str(input[k])!;
      }
      return done("Réservation modifiée", await updateBooking(id, values));
    }
    case "settle_balance": {
      const id = str(input.booking_id);
      const payments = Array.isArray(input.payments)
        ? (input.payments as Input[]).map((p) => ({ method: String(p.method ?? ""), amount: Number(p.amount ?? 0) }))
        : [];
      if (!id || !payments.length) return { result: json({ ok: false, error: "booking_id et paiements requis" }), isError: true };
      const total = payments.reduce((s, p) => s + p.amount, 0);
      return done(`Solde encaissé : ${total} €`, await settleBalance(id, payments));
    }
    case "cancel_booking": {
      const id = str(input.booking_id);
      if (!id) return { result: json({ ok: false, error: "booking_id requis" }), isError: true };
      return done("Réservation annulée", await cancelBooking(id));
    }

    // ── Finance ──
    case "add_expense": {
      const amount = num(input.amount) ?? 0;
      const r = await addExpense({
        date: str(input.date) ?? today(),
        category: str(input.category) ?? "other",
        amount,
        description: str(input.description) ?? null,
      });
      return done(`Dépense : ${amount} € (${str(input.description) ?? str(input.category)})`, r);
    }
    case "add_revenue": {
      const amount = num(input.amount) ?? 0;
      const r = await addRevenue({
        date: str(input.date) ?? today(),
        type: str(input.type) ?? "other",
        amount,
        note: str(input.note) ?? null,
      });
      return done(`Revenu : ${amount} €`, r);
    }

    // ── Événements ──
    case "create_event": {
      const r = await createEvent({
        title: str(input.title) ?? "",
        theme: str(input.theme) ?? null,
        description: str(input.description) ?? null,
        date: str(input.date) ?? today(),
        start_time: str(input.start_time) ?? null,
        end_time: str(input.end_time) ?? null,
        price_per_person: num(input.price_per_person) ?? null,
        max_participants: num(input.max_participants) ?? null,
        sumup_payment_link: null,
      });
      return done(`Événement créé : ${str(input.title)}`, { ok: r.ok, error: "error" in r ? r.error : null });
    }
    case "add_event_booking": {
      const r = await addEventBooking({
        event_id: str(input.event_id) ?? "",
        first_name: str(input.first_name) ?? "",
        last_name: str(input.last_name) ?? null,
        email: str(input.email) ?? null,
        phone: str(input.phone) ?? null,
        party_size: num(input.party_size) ?? 1,
        total_paid: num(input.total_paid) ?? null,
        payment_status: str(input.payment_status) ?? "pending",
      });
      return done(`Inscription : ${fullName(str(input.first_name), str(input.last_name))}`, { ok: r.ok, error: "error" in r ? (r.error as string) : null });
    }

    // ── Comptabilité ──
    case "get_compta_status": {
      const year = num(input.year) ?? new Date().getFullYear();
      const data = await loadCompta(year, supabase as unknown as SupabaseClient);
      if (!data.ready) return read({ ok: false, error: "La comptabilité n'est pas installée (migration 0035 à appliquer dans Supabase)." });
      const label = (code: string) => data.accountsByCode.get(code)?.label ?? code;
      const todo = data.movements.filter((m) => m.status === "a_classer");
      const missing = data.movements.filter((m) => m.status === "justificatif");
      const obs = obligations({ settings: data.settings, year, movements: data.movements, periods: data.periods, filings: data.filings, todayIso: today() });
      const nextVat = obs.find((o) => o.state === "en_retard" || o.state === "a_declarer") ?? null;
      const brief = (m: (typeof todo)[number]) => ({
        key: m.key,
        date: m.date,
        libelle: m.title,
        detail: m.detail,
        sens: m.direction === "in" ? "entrée" : "sortie",
        montant: m.amount,
        source: m.source === "bank" ? "Qonto" : "caisse",
        propose: m.suggestion ? { account_code: m.suggestion.account, compte: label(m.suggestion.account), vat_rate: m.suggestion.vatRate, reverse_charge: m.suggestion.reverseCharge } : null,
      });
      return read({
        exercice: year,
        regime_tva: data.settings.vat_regime,
        a_classer: todo.length,
        justificatifs_manquants: missing.length,
        resultat_ht: resultOf(data.movements),
        prochaine_tva: nextVat ? { declaration: nextVat.label, montant: nextVat.amount, echeance: nextVat.due, etat: nextVat.state } : null,
        mouvements_a_classer: todo.slice(0, 40).map(brief),
        sans_justificatif: missing.slice(0, 30).map((m) => ({ ...brief(m), compte: m.account?.label })),
        plan_de_comptes: data.accounts.filter((a) => a.active).map((a) => ({ code: a.code, compte: a.label, type: a.kind, tva_par_defaut: a.default_vat_rate })),
      });
    }
    case "classify_movements": {
      const items = Array.isArray(input.items) ? (input.items as Input[]).slice(0, 60) : [];
      if (items.length === 0) return { result: json({ ok: false, error: "items requis" }), isError: true };
      const data = await loadCompta(new Date().getFullYear(), supabase as unknown as SupabaseClient);
      const prev = await loadCompta(new Date().getFullYear() - 1, supabase as unknown as SupabaseClient);
      const byKey = new Map([...prev.movements, ...data.movements].map((m) => [m.key, m]));
      const results: Array<{ key: string; ok: boolean; error?: string }> = [];
      for (const it of items) {
        const m = byKey.get(String(it.key ?? ""));
        const code = str(it.account_code);
        if (!m || !code || !data.accountsByCode.has(code)) {
          results.push({ key: String(it.key), ok: false, error: !m ? "mouvement inconnu" : "compte inconnu" });
          continue;
        }
        const r = await classifyMovement(
          { source: m.source, sourceId: m.sourceId, date: m.date },
          {
            accountCode: code,
            vatRate: num(it.vat_rate) ?? 0,
            reverseCharge: it.reverse_charge === true,
            ...(str(it.no_receipt_reason) ? { noReceiptReason: str(it.no_receipt_reason) } : {}),
          },
          "lea",
        );
        results.push({ key: m.key, ok: r.ok, ...(r.ok ? {} : { error: r.error ?? "échec" }) });
      }
      const okCount = results.filter((r) => r.ok).length;
      return {
        result: json({ ok: okCount > 0, classes: okCount, echecs: results.filter((r) => !r.ok) }),
        isError: okCount === 0,
        action: { label: `${okCount} mouvement${okCount > 1 ? "s" : ""} classé${okCount > 1 ? "s" : ""} en compta`, ok: okCount > 0 },
      };
    }

    // ── Manager ──
    case "ask_manager": {
      const request = str(input.request);
      if (!request) return { result: json({ ok: false, error: "request requis" }), isError: true };
      const r = await askManager(request);
      return { result: json(r), isError: !r.ok };
    }
  }

  return { result: json({ ok: false, error: `Outil inconnu : ${name}` }), isError: true };
}
