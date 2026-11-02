// Formes des données de la boîte de réception (réponses de /api/wa/* et du
// flux /agent/conversations/feed).

export type LastMessage = {
  body: string;
  from_me: boolean;
  is_from_human: boolean;
  created_at: string | null;
};

export interface Conversation {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  is_paused: boolean;
  paused_until: string | null;
  last_message_at: string | null;
  lead_id: string | null;
  unread_count: number | null;
  last_message: LastMessage | null;
}

export interface Message {
  id: string;
  from_me: boolean;
  is_from_human: boolean;
  body: string;
  created_at: string;
  /** Message envoyé depuis ici, pas encore revenu du service WhatsApp. */
  pending?: boolean;
}

export interface ClientBooking {
  id: string;
  date: string | null;
  offer_name: string | null;
  status: string | null;
  total_amount: number | null;
  balance_due: number | null;
  deposit_paid: boolean | null;
}

export interface ClientCard {
  phone: string;
  masked: boolean;
  realPhone: string | null;
  name: string | null;
  messageCount: number;
  isPaused: boolean;
  pausedUntil: string | null;
  bookings: ClientBooking[];
  lead: {
    id: string;
    email: string | null;
    score: number | null;
    status: string | null;
    interestedOffer: string | null;
    occasion: string | null;
    partySize: number | null;
    desiredDate: string | null;
    desiredTimeSlot: string | null;
    sourceChannel: string | null;
    needsHuman: boolean | null;
    createdAt: string | null;
    notes: string | null;
    /** Le mémo de Léa : ce qu'elle a retenu de l'échange (leads.ai_memo). */
    aiMemo: string | null;
  } | null;
}

export type ConnectionState = {
  status: "connected" | "pending" | "waiting" | "error";
  qr?: string;
};

/** Qui a écrit un message : le client, Léa (IA) ou Robin (humain). */
export type Author = "client" | "lea" | "human";

export function authorOf(m: { from_me: boolean; is_from_human: boolean }): Author {
  if (!m.from_me) return "client";
  return m.is_from_human ? "human" : "lea";
}
