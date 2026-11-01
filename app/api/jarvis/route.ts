import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE } from '@/lib/demo/mode';

// Proxy vers la fonction Edge dashboard-agent (même cerveau que le Manager
// Telegram, cf. supabase/functions/_shared/manager-agent.ts). Le secret
// partagé reste côté serveur — jamais exposé au navigateur.
export async function POST(req: NextRequest) {
  const { message } = await req.json() as { message: string };
  if (!message?.trim()) {
    return NextResponse.json({ error: 'message requis' }, { status: 400 });
  }


  if (DEMO_MODE) {
    return NextResponse.json({
      reply:
        "Mode démo — voici ce que je vois : 4 clients attendent une réponse sur WhatsApp, " +
        "dont 2 avec une date sous 7 jours. La trésorerie est à 38 427 €, soit environ 12 mois " +
        "de charges. Je te conseille de répondre d'abord à la demande de Nuit Insolite du 24 décembre.",
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.DASHBOARD_AGENT_SECRET;
  if (!supabaseUrl || !secret) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_SUPABASE_URL ou DASHBOARD_AGENT_SECRET non configuré' }, { status: 500 });
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/dashboard-agent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dashboard-secret': secret },
    body: JSON.stringify({ message }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
