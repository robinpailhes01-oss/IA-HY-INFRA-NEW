// Supabase Edge Function — Connexion de la boîte Gmail (OAuth Google).
//
// Parcours :
//   1. Le tableau de bord (session ouverte) fabrique un lien signé :
//        …/functions/v1/mail-oauth?state=<horodatage>.<signature>
//      La signature (HMAC avec DASHBOARD_AGENT_SECRET) prouve que la demande vient d'un
//      utilisateur connecté au tableau de bord : sans elle, impossible de brancher une
//      boîte quelconque.
//   2. Cette fonction renvoie vers l'écran d'autorisation de Google.
//   3. Google revient ici avec ?code=… : on l'échange contre un jeton de renouvellement,
//      rangé dans mail_accounts (lisible par la clé de service seulement), puis on renvoie
//      vers le tableau de bord (/mails?connected=1).
//
// Secrets : GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, DASHBOARD_AGENT_SECRET,
// DASHBOARD_URL. URI de redirection à autoriser côté Google :
//   https://<projet>.supabase.co/functions/v1/mail-oauth

import { createClient } from "npm:@supabase/supabase-js@2";
import { SCOPES, json } from "../_shared/gmail.ts";

const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";
const SECRET = Deno.env.get("DASHBOARD_AGENT_SECRET") ?? "";
const DASHBOARD_URL = (Deno.env.get("DASHBOARD_URL") ?? "https://ia-hy-infra-new.vercel.app").replace(/\/$/, "");
const MAX_AGE_MS = 15 * 60_000;

const enc = new TextEncoder();
async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function validState(state: string | null): Promise<boolean> {
  if (!state || !SECRET) return false;
  const [ts, sig] = state.split(".");
  const age = Date.now() - Number(ts);
  if (!ts || !sig || !(age >= 0 && age <= MAX_AGE_MS)) return false;
  return safeEqual(sig, await sign(ts));
}

const back = (query: string) => Response.redirect(`${DASHBOARD_URL}/mails?${query}`, 302);

Deno.serve(async (req) => {
  if (req.method !== "GET") return json({ error: "GET only" }, 405);
  if (!CLIENT_ID || !CLIENT_SECRET || !SECRET) return json({ error: "Secrets Google ou DASHBOARD_AGENT_SECRET manquants" }, 500);

  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  if (!(await validState(state))) return json({ error: "Lien invalide ou expiré : relance la connexion depuis le tableau de bord." }, 403);

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mail-oauth`;
  const code = url.searchParams.get("code");
  const googleError = url.searchParams.get("error");
  if (googleError) return back(`error=${encodeURIComponent(googleError === "access_denied" ? "Autorisation refusée" : googleError)}`);

  // Étape 2 : vers Google.
  if (!code) {
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.search = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      // « consent » force Google à renvoyer un jeton de renouvellement même si l'accès a déjà été accordé.
      prompt: "consent",
      state: state!,
    }).toString();
    return Response.redirect(auth.toString(), 302);
  }

  // Étape 3 : retour de Google.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok || !token.refresh_token || !token.id_token) {
    const why = !tokenRes.ok ? (token.error_description ?? token.error ?? "échec") : "Google n'a pas fourni de jeton de renouvellement : retire l'accès de l'application dans ton compte Google puis recommence";
    return back(`error=${encodeURIComponent(String(why))}`);
  }
  // L'adresse vient de l'id_token reçu directement de Google en HTTPS.
  const claims = JSON.parse(atob(String(token.id_token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  const email = String(claims.email ?? "").toLowerCase();
  if (!email) return back("error=Adresse+introuvable");
  if (!String(token.scope ?? "").includes("gmail.modify")) return back("error=" + encodeURIComponent("Autorisation incomplète : coche bien l'accès à Gmail"));

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Une seule boîte à la fois : si une autre est déjà branchée, on refuse plutôt que d'en mélanger deux.
  const { data: existing } = await supabase.from("mail_accounts").select("email");
  if (existing && existing.length > 0 && !existing.some((a) => a.email === email)) {
    return back("error=" + encodeURIComponent(`Une autre boîte (${existing[0].email}) est déjà connectée.`));
  }
  const { error } = await supabase
    .from("mail_accounts")
    .upsert(
      { email, refresh_token: token.refresh_token, scopes: token.scope, status: "connected", last_error: null, connected_at: new Date().toISOString() },
      { onConflict: "email" },
    );
  if (error) return back(`error=${encodeURIComponent(error.message)}`);
  return back("connected=1");
});
