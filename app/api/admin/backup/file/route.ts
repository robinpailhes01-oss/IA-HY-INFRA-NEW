import { NextResponse } from "next/server";

import { backupGuard } from "@/lib/backup/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const ctx = await backupGuard();
  if (!ctx) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const url = new URL(req.url);
  const bucket = url.searchParams.get("bucket") ?? "";
  const path = url.searchParams.get("path") ?? "";
  if (!/^[\w-]{1,63}$/.test(bucket) || !path || path.includes("..") || path.startsWith("/")) {
    return NextResponse.json({ error: "Fichier invalide" }, { status: 400 });
  }

  const { data, error } = await ctx.db.storage.from(bucket).download(path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Introuvable" }, { status: 404 });
  return new Response(data, {
    headers: { "content-type": data.type || "application/octet-stream", "cache-control": "no-store" },
  });
}
