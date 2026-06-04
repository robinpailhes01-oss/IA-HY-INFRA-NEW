// Lib partagée — Google Calendar API (Service Account)
//
// Authentification : JWT signé avec la clé privée du Service Account.
// Pas de dépendance externe (crypto natif Deno + fetch).
//
// Usage :
//   const gcal = new GoogleCalendar(calendarId, serviceAccountEmail, privateKey);
//   const eventId = await gcal.createEvent({ ... });
//   await gcal.deleteEvent(eventId);

const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// ── JWT helpers (RS256) ──────────────────────────────────────────────

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
  // Nettoie le PEM (retire les lignes header/footer et les sauts)
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

// ── Types ────────────────────────────────────────────────────────────

export type GCalEvent = {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  colorId?: string; // "1"–"11"
};

// ── Classe principale ────────────────────────────────────────────────

export class GoogleCalendar {
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(
    private calendarId: string,
    private serviceEmail: string,
    private privateKey: string,
  ) {}

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;

    const now = Math.floor(Date.now() / 1000);
    const jwt = await signJwt(
      { alg: "RS256", typ: "JWT" },
      { iss: this.serviceEmail, scope: GCAL_SCOPE, aud: TOKEN_URL, exp: now + 3600, iat: now },
      this.privateKey,
    );
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    if (!res.ok) throw new Error(`GCal token error ${res.status}: ${await res.text()}`);
    const { access_token, expires_in } = await res.json();
    this.accessToken = access_token;
    this.tokenExpiry = Date.now() + (expires_in - 60) * 1000;
    return this.accessToken!;
  }

  private async req(method: string, path: string, body?: unknown): Promise<any> {
    const token = await this.getToken();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const txt = await res.text();
    if (!res.ok) {
      // 404/410 sur DELETE = event déjà parti → traité comme un succès.
      if (method === "DELETE" && (res.status === 404 || res.status === 410)) return null;
      throw new Error(`GCal ${method} ${path} → ${res.status}: ${txt}`);
    }
    if (!txt) return null; // 204 No Content ou body vide
    try {
      return JSON.parse(txt);
    } catch {
      return null;
    }
  }

  // Crée un event et retourne son ID Google.
  async createEvent(event: GCalEvent): Promise<string> {
    const data = await this.req("POST", "/events", event);
    return data.id as string;
  }

  // Met à jour un event existant.
  async updateEvent(eventId: string, event: GCalEvent): Promise<void> {
    await this.req("PUT", `/events/${eventId}`, event);
  }

  // Supprime un event. Idempotent : si l'event a déjà disparu, on ne lève pas.
  async deleteEvent(eventId: string): Promise<void> {
    await this.req("DELETE", `/events/${eventId}`);
  }

  // Liste les events sur une plage de dates (pour check_availability).
  async listEvents(timeMin: string, timeMax: string): Promise<Array<{
    id: string;
    summary: string;
    start: string;
    end: string;
  }>> {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
    });
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events?${params}`;
    const token = await this.getToken();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`GCal listEvents → ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.items ?? []).map((ev: any) => ({
      id: ev.id,
      summary: ev.summary ?? "(sans titre)",
      start: ev.start?.dateTime ?? ev.start?.date ?? "",
      end: ev.end?.dateTime ?? ev.end?.date ?? "",
    }));
  }
}

// ── Constructeur depuis les secrets Deno ─────────────────────────────

export function gcalFromEnv(): GoogleCalendar | null {
  const calId = Deno.env.get("GOOGLE_CALENDAR_ID");
  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const key = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  if (!calId || !email || !key) return null;
  // Les variables d'environnement échappent parfois les \n — on les restaure.
  return new GoogleCalendar(calId, email, key.replace(/\\n/g, "\n"));
}
