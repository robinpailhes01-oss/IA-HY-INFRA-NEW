export async function askLea(message: string, phone: string): Promise<string> {
  const url = `${process.env.SUPABASE_URL}/functions/v1/agent-lea`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    body: JSON.stringify({ message, phone }),
  });

  if (!res.ok) {
    console.error('[lea] error', res.status, await res.text());
    return '';
  }

  const data = await res.json() as { reply?: string };
  return data.reply ?? '';
}
