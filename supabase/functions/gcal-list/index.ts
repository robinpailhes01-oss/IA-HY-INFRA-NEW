// Supabase Edge Function — gcal-list
//
// Liste les events du calendrier Google sur une plage de dates donnée.
// Outil de back-office : utile pour ré-aligner Supabase avec GCal
// (import initial, audit de cohérence, recherche d'event ID…).
//
// Body : { timeMin: ISO, timeMax: ISO }
// Auth : header `x-sync-secret` (même que sync-gcal).

const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SYNC_SECRET = Deno.env.get("SYNC_GCAL_SECRET") ?? "";

function base64url(input: Uint8Array): string {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
function encode(obj: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(obj)));
}
async function signJwt(header: unknown, payload: unknown, pemKey: string): Promise<string> {
  const msg = `${encode(header)}.${encode(payload)}`;
  const b64 = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(msg));
  return `${msg}.${base64url(new Uint8Array(sig))}`;
}

async function getToken(email: string, pem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt(
    { alg: "RS256", typ: "JWT" },
    { iss: email, scope: GCAL_SCOPE, aud: TOKEN_URL, exp: now + 3600, iat: now },
    pem,
  );
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    if (SYNC_SECRET && req.headers.get("x-sync-secret") !== SYNC_SECRET) {
      return json({ error: "unauthorized" }, 401);
    }

    const { timeMin, timeMax } = await req.json();
    if (!timeMin || !timeMax) return json({ error: "timeMin et timeMax requis (ISO)" }, 400);

    const calId = Deno.env.get("GOOGLE_CALENDAR_ID")!;
    const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
    const key = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")!.replace(/\\n/g, "\n");

    const token = await getToken(email, key);
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return json({ error: `gcal ${res.status}: ${await res.text()}` }, 502);
    const data = await res.json();
    const events = (data.items ?? []).map((ev: any) => ({
      id: ev.id,
      summary: ev.summary ?? "",
      description: ev.description ?? "",
      start: ev.start?.dateTime ?? ev.start?.date ?? "",
      end: ev.end?.dateTime ?? ev.end?.date ?? "",
      creator: ev.creator?.email ?? "",
      organizer: ev.organizer?.email ?? "",
      location: ev.location ?? "",
    }));
    return json({ count: events.length, events });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
