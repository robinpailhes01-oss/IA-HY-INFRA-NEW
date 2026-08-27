import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS =
  process.env.NODE_ENV === "development" ? ["/login", "/signup"] : ["/login"];

// Routes appelées sans session utilisateur (webhooks, cron, liens publics
// dans un email) — chacune fait sa propre vérification (secret partagé,
// token) plutôt que de dépendre de cette redirection pensée pour les pages.
// Sans cette exception, ces routes recevaient un 307 vers /login : les crons
// Vercel ne suivent jamais les redirections (elles échouaient donc en
// silence), et un visiteur non connecté qui cliquait sur un lien de
// désabonnement atterrissait sur l'écran de connexion.
const PUBLIC_API_PATHS = ["/api/unsubscribe", "/api/analytics/sync"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicApi(pathname)) return NextResponse.next();

  // Refreshes the Supabase session cookie on every request.
  const { supabaseResponse, user } = await updateSession(request);

  // Unauthenticated visitors are sent to /login (except on public routes).
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  // Authenticated users have no business on the auth pages.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  return supabaseResponse;
}

// Preserve the refreshed Supabase auth cookies on redirect responses.
function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
