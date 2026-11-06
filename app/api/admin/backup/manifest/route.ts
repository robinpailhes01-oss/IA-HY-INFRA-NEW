import { NextResponse } from "next/server";

import { backupGuard, buildManifest } from "@/lib/backup/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const ctx = await backupGuard();
  if (!ctx) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const includeSensitive = new URL(req.url).searchParams.get("wa") === "1";
  return NextResponse.json(await buildManifest(ctx, includeSensitive), { headers: { "cache-control": "no-store" } });
}
