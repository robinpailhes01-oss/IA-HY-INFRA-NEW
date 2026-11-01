import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE } from '@/lib/demo/mode';

export async function POST(req: NextRequest) {
  if (DEMO_MODE) return NextResponse.json({ ok: true, demo: true });
  const { phone, action } = await req.json() as { phone: string; action: 'pause' | 'resume' };
  const serviceUrl = process.env.BAILEYS_SERVICE_URL;
  if (!serviceUrl) return NextResponse.json({ error: 'BAILEYS_SERVICE_URL non configuré' }, { status: 500 });

  const endpoint = action === 'pause' ? 'pause' : 'resume';
  const res = await fetch(`${serviceUrl}/${endpoint}/${encodeURIComponent(phone)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hours: 24 }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
