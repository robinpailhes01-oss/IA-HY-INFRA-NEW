import { NextResponse } from 'next/server';

export async function GET() {
  const serviceUrl = process.env.BAILEYS_SERVICE_URL;
  if (!serviceUrl) return NextResponse.json({ error: 'BAILEYS_SERVICE_URL non configuré' }, { status: 500 });

  try {
    const res = await fetch(`${serviceUrl}/qr`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  }
}
