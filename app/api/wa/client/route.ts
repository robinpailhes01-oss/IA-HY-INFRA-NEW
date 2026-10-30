import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Fiche client affichée à côté du fil WhatsApp : qui est en face, ce qu'il
// veut, où il en est. Sans ça, répondre à un message oblige à ouvrir la fiche
// prospect dans un autre onglet et à perdre le fil.

// Un vrai numéro E.164 fait au plus 15 chiffres, en pratique 13 ici. Au-delà,
// c'est un identifiant interne WhatsApp (confidentialité) : utilisable pour
// répondre dans le fil, inutilisable pour rappeler.
function isMaskedNumber(phone: string | null): boolean {
  if (!phone) return false;
  return phone.replace(/[^\d]/g, '').length > 13;
}

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone');
  if (!phone) return NextResponse.json({ error: 'phone requis' }, { status: 400 });

  const supabase = await createClient();

  const { data: conv } = await supabase
    .from('wa_conversations')
    .select('id, lead_id, customer_name, customer_phone, is_paused, paused_until')
    .eq('customer_phone', phone)
    .maybeSingle();

  // Le lead peut être rattaché à la conversation, sinon on retombe sur le
  // numéro — une fiche créée avant que le fil WhatsApp n'existe.
  let lead = null;
  if (conv?.lead_id) {
    const { data } = await supabase.from('leads').select('*').eq('id', conv.lead_id).maybeSingle();
    lead = data;
  }
  if (!lead) {
    const { data } = await supabase.from('leads').select('*').eq('phone', phone).maybeSingle();
    lead = data;
  }

  let bookings: unknown[] = [];
  if (lead?.id) {
    const { data } = await supabase
      .from('bookings')
      .select('id, date, offer_name, status, total_amount, balance_due, deposit_paid')
      .eq('lead_id', lead.id)
      .order('date', { ascending: false })
      .limit(10);
    bookings = data ?? [];
  }

  const { count: messageCount } = conv
    ? await supabase
        .from('wa_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
    : { count: 0 };

  return NextResponse.json({
    phone,
    masked: isMaskedNumber(phone),
    // Numéro réel résolu a posteriori pour un contact masqué, s'il existe.
    realPhone: lead?.real_phone ?? null,
    name:
      [lead?.first_name, lead?.last_name].filter(Boolean).join(' ').trim() ||
      conv?.customer_name ||
      null,
    lead: lead
      ? {
          id: lead.id,
          email: lead.email,
          score: lead.score,
          status: lead.status,
          interestedOffer: lead.interested_offer,
          occasion: lead.occasion,
          partySize: lead.party_size,
          desiredDate: lead.desired_date,
          desiredTimeSlot: lead.desired_time_slot,
          sourceChannel: lead.source_channel,
          needsHuman: lead.needs_human_intervention,
          createdAt: lead.created_at,
          notes: lead.notes,
        }
      : null,
    bookings,
    messageCount: messageCount ?? 0,
    isPaused: conv?.is_paused ?? false,
    pausedUntil: conv?.paused_until ?? null,
  });
}
