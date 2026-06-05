export async function askLea(message: string, phone: string): Promise<string> {
  const url = `${process.env.SUPABASE_URL}/functions/v1/agent-lea`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
  };
  if (process.env.LEA_SHARED_SECRET) headers['x-lea-secret'] = process.env.LEA_SHARED_SECRET;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, phone }),
  });

  if (!res.ok) {
    console.error('[lea] error', res.status, await res.text());
    return '';
  }

  const data = await res.json() as { reply?: string };
  return data.reply ?? '';
}
