// Outils Gmail partagés par mail-oauth, mail-sync et mail-act.
//
// Portées demandées : gmail.modify (lire, étiqueter, mettre à la corbeille) et calendar.events
// (planning : créer/modifier les événements des réservations). Jamais de
// suppression définitive : l'API DELETE n'est appelée nulle part.

// Client Supabase (clé de service) : non typé, comme dans les autres fonctions.
// deno-lint-ignore no-explicit-any
export type Supa = any;

export const SCOPES = "openid email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.events";
export const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export const CATEGORIES = [
  "client",
  "facture",
  "banque_impots",
  "fournisseur",
  "newsletter",
  "notification",
  "indesirable",
  "autre",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export type Account = { id: string; email: string; refresh_token: string };

/** Jeton d'accès (valable 1 h) à partir du jeton de renouvellement. */
export async function accessToken(supabase: Supa, account: Account): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "",
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    const reason = data?.error === "invalid_grant" ? "Autorisation expirée ou retirée : reconnecte la boîte." : `Google: ${data?.error_description ?? data?.error ?? res.status}`;
    await supabase.from("mail_accounts").update({ status: "error", last_error: reason }).eq("id", account.id);
    throw new Error(reason);
  }
  await supabase.from("mail_accounts").update({ status: "connected", last_error: null }).eq("id", account.id);
  return data.access_token as string;
}

export async function gmail(token: string, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${GMAIL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${data?.error?.message ?? text.slice(0, 200)}`);
  return data;
}

/** « "Nom" <a@b.fr> » ou « a@b.fr » → { name, email }. */
export function parseFrom(raw: string | undefined): { name: string | null; email: string | null } {
  if (!raw) return { name: null, email: null };
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  const plain = raw.trim().toLowerCase();
  return { name: null, email: plain.includes("@") ? plain : null };
}

export const domainOf = (email: string | null) => (email && email.includes("@") ? email.split("@")[1] : null);

export async function connectedAccount(supabase: Supa): Promise<Account | null> {
  const { data } = await supabase.from("mail_accounts").select("id, email, refresh_token").order("connected_at", { ascending: false }).limit(1);
  return (data?.[0] as Account | undefined) ?? null;
}
