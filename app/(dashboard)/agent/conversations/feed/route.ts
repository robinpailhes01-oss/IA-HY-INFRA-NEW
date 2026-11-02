import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Le flux de la boîte de réception : les conversations WhatsApp (comme
// /api/wa/conversations) ENRICHIES de leur dernier message. Sans cet aperçu,
// la liste ne disait que des noms — il fallait ouvrir chaque fil pour savoir
// qui avait parlé en dernier et de quoi.
//
// Interrogé toutes les 5 s par la boîte de réception : deux requêtes légères,
// pas de jointure. Le dernier message n'est cherché que pour les 80 fils les
// plus récents, parmi leurs 600 derniers messages ; un fil très ancien peut
// donc arriver sans aperçu — la liste affiche alors simplement son état.
export const dynamic = "force-dynamic";

const PREVIEW_CONVERSATIONS = 80;
const PREVIEW_MESSAGES = 600;

export async function GET() {
  const supabase = await createClient();

  const { data: conversations, error } = await supabase
    .from("wa_conversations")
    .select("id, customer_phone, customer_name, is_paused, paused_until, last_message_at, lead_id, unread_count")
    .order("last_message_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = conversations ?? [];
  const ids = rows.slice(0, PREVIEW_CONVERSATIONS).map((c) => c.id);
  const last = new Map<string, { body: string; from_me: boolean; is_from_human: boolean; created_at: string | null }>();

  if (ids.length > 0) {
    const { data: messages } = await supabase
      .from("wa_messages")
      .select("conversation_id, body, from_me, is_from_human, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(PREVIEW_MESSAGES);
    for (const m of messages ?? []) {
      if (m.conversation_id && !last.has(m.conversation_id)) {
        last.set(m.conversation_id, {
          body: m.body,
          from_me: m.from_me,
          is_from_human: m.is_from_human,
          created_at: m.created_at,
        });
      }
    }
  }

  return NextResponse.json(rows.map((c) => ({ ...c, last_message: last.get(c.id) ?? null })));
}
