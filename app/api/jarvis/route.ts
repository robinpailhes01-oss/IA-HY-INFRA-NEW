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
    return NextResponse.json({ reply: demoReply(message) });
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

// Réponses du mode démo (jamais en production) : de quoi montrer le widget
// Léa sans appeler le vrai agent. Aucune action n'est exécutée.
function demoReply(message: string): string {
  const m = message.toLowerCase();
  if (/relan|rappel|écri|envoie/.test(m)) {
    return "C'est fait : j'ai relancé Camille David et Hugo Blanc sur WhatsApp avec un message chaleureux qui rappelle leurs dates et le lien de réservation. (Mode démo — rien n'a réellement été envoyé.)";
  }
  if (/ajoute|dépense|gasoil|€/.test(m)) {
    return "Dépense enregistrée : 45 € de gasoil, catégorie Gasoil, datée d'aujourd'hui. Elle apparaît déjà dans Finance. (Mode démo — rien n'a réellement été enregistré.)";
  }
  if (/trésor|banque|santé|argent/.test(m)) {
    return "Trésorerie : 38 427 € sur Qonto et 1 240 € en caisse, soit environ 12 mois de charges. Le score de santé est à 64/100 (correct), en léger recul sur 30 jours — normal en basse saison. Il reste 8 088 € à encaisser sur les sorties à venir.";
  }
  if (/encaiss|ce mois|chiffre/.test(m)) {
    return "Ce mois-ci tu as encaissé 1 938 € (surtout des acomptes de Nuits Insolites). Depuis janvier : 108 382 € de chiffre d'affaires, 79 % de ton objectif de saison.";
  }
  if (/sortie|semaine|planning/.test(m)) {
    return "Cette semaine : Sortie privative 3h lundi 10 h (Camille David, 600 €) et Nuit Insolite jeudi 18 h (Amandine Guérin, 480 €). Météo idéale lundi, vent fort jeudi — je te conseille de prévenir Amandine.";
  }
  return "Voici ce que je vois : 8 clients attendent une réponse sur WhatsApp, dont 2 avec une date sous 7 jours, et 3 leads que j'ai escaladés. Je te conseille de commencer par la Nuit Insolite du 24 décembre. Tu veux que je les relance ?";
}
