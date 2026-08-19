import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

// Page de confirmation minimale — pas de dépendance au design system du
// dashboard, cette page est vue par des gens qui n'y sont jamais connectés.
function page(title: string, message: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Harmonie Yacht</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background:#f4f6f8; color:#1a2733; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:24px; }
  .card { background:#fff; border-radius:16px; padding:40px 32px; max-width:420px; text-align:center; box-shadow:0 8px 30px rgba(0,0,0,.08); }
  h1 { font-size:20px; margin:0 0 12px; color:#1a5490; }
  p { margin:0; line-height:1.5; color:#445; }
</style></head>
<body><div class="card"><h1>⚓ ${title}</h1><p>${message}</p></div></body></html>`;
}

/**
 * Le "jeton" est l'id de la ligne client_outreach qui a envoyé cet email —
 * un UUID déjà unique et impossible à deviner, pas besoin d'en générer un
 * autre. On remonte de là à l'email du client, jamais transmis en clair dans
 * l'URL (empêche quelqu'un de désabonner un email au hasard en devinant une
 * adresse).
 *
 * Route publique, sans authentification : utilise la clé de service pour
 * écrire, car la personne qui clique n'est jamais connectée au dashboard.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return new NextResponse(page("Lien invalide", "Ce lien de désabonnement est incomplet."), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const supabase = createAdminClient();

  const { data: outreach, error: outreachErr } = await supabase
    .from("client_outreach")
    .select("campaign, legacy_client_id, legacy_clients(email)")
    .eq("id", token)
    .maybeSingle();

  // PostgREST renvoie un objet unique pour une relation vers-un (chaque ligne
  // d'outreach pointe vers exactement un legacy_client) — le type générique
  // Supabase le décrit en tableau, d'où le cast via `unknown`.
  const email = (outreach?.legacy_clients as unknown as { email: string | null } | null)?.email;

  if (outreachErr || !outreach || !email) {
    return new NextResponse(page("Lien invalide", "Ce lien de désabonnement n'est plus valide."), {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  await supabase
    .from("email_unsubscribes")
    .upsert({ email, source_campaign: outreach.campaign }, { onConflict: "email" });

  return new NextResponse(
    page("Vous êtes désabonné", `${email} ne recevra plus d'email de notre part. Merci d'avoir navigué avec nous.`),
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
