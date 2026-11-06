import { NextResponse } from "next/server";

import { backupGuard } from "@/lib/backup/server";

export const dynamic = "force-dynamic";

// Comptes de connexion. Les mots de passe ne sont jamais lisibles (ils sont
// hachés côté Supabase) : au rétablissement, chaque personne recevra un lien
// pour en choisir un nouveau. Les identifiants (UUID) sont conservés, ce qui
// garde le lien avec la table `profiles`.
export async function GET() {
  const ctx = await backupGuard();
  if (!ctx) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  if (!ctx.service) return NextResponse.json({ users: [], note: "clé de service absente" });

  const users: unknown[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await ctx.db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const batch = data?.users ?? [];
    for (const u of batch) {
      users.push({
        id: u.id,
        email: u.email,
        phone: u.phone,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        app_metadata: u.app_metadata,
        user_metadata: u.user_metadata,
      });
    }
    if (batch.length < 200) break;
  }
  return NextResponse.json({ users }, { headers: { "cache-control": "no-store" } });
}
