import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { phone, message } = await req.json() as { phone: string; message: string };
  const serviceUrl = process.env.BAILEYS_SERVICE_URL;
  if (!serviceUrl) return NextResponse.json({ error: 'BAILEYS_SERVICE_URL non configuré' }, { status: 500 });

  const res = await fetch(`${serviceUrl}/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, message }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
