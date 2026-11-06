import { NextResponse } from "next/server";

import { isDenied, restoreGuard } from "@/lib/backup/restore-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Dépose un fichier dans le stockage. Limite Vercel : ~4,5 Mo par requête ; au-delà,
// la page envoie le fichier directement depuis le navigateur.
export async function POST(req: Request) {
  const ctx = await restoreGuard();
  if (isDenied(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const url = new URL(req.url);
  const bucket = url.searchParams.get("bucket") ?? "";
  const path = url.searchParams.get("path") ?? "";
  if (!/^[\w-]{1,63}$/.test(bucket) || !path || path.includes("..") || path.startsWith("/")) {
    return NextResponse.json({ error: "Fichier invalide" }, { status: 400 });
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  const { error } = await ctx.db.storage.from(bucket).upload(path, bytes, {
    upsert: true,
    contentType: req.headers.get("content-type") ?? undefined,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
