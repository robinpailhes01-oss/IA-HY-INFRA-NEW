import { NextResponse } from "next/server";

import { isDenied, restoreGuard } from "@/lib/backup/restore-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type BackupUser = {
  id: string;
  email: string | null;
  phone?: string | null;
  email_confirmed_at?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

// Recrée les comptes de connexion en gardant leurs identifiants (les profils et
// les liens en dépendent). Les mots de passe ne se récupèrent pas : chaque
// personne en choisira un nouveau via « mot de passe oublié ».
export async function POST(req: Request) {
  const ctx = await restoreGuard();
  if (isDenied(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = (await req.json().catch(() => null)) as { users?: BackupUser[] } | null;
  const users = Array.isArray(body?.users) ? body!.users!.slice(0, 200) : [];

  const created: string[] = [];
  const skipped: Array<{ email: string | null; reason: string }> = [];
  /** ancien identifiant → identifiant réel, quand ils diffèrent. */
  const remap: Record<string, string> = {};

  for (const u of users) {
    if (!u?.id || !/^[0-9a-f-]{36}$/i.test(u.id)) continue;
    const { data: existing } = await ctx.db.auth.admin.getUserById(u.id);
    if (existing?.user) {
      skipped.push({ email: u.email, reason: "déjà présent" });
      continue;
    }
    const attrs = {
      id: u.id,
      email: u.email ?? undefined,
      phone: u.phone || undefined,
      email_confirm: true,
      user_metadata: u.user_metadata ?? {},
      app_metadata: u.app_metadata ?? {},
    };
    const { data, error } = await ctx.db.auth.admin.createUser(attrs as never);
    if (error || !data?.user) {
      skipped.push({ email: u.email, reason: error?.message ?? "échec" });
      continue;
    }
    created.push(data.user.id);
    if (data.user.id !== u.id) remap[u.id] = data.user.id;
  }
  return NextResponse.json({ created: created.length, skipped, remap });
}
