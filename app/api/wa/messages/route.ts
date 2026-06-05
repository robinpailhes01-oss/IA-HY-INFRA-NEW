import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone');
  if (!phone) return NextResponse.json({ error: 'phone requis' }, { status: 400 });

  const supabase = await createClient();

  const { data: conv } = await supabase
    .from('wa_conversations')
    .select('id')
    .eq('customer_phone', phone)
    .single();

  if (!conv) return NextResponse.json([]);

  const { data, error } = await supabase
    .from('wa_messages')
    .select('*')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
