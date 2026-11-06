import { NextResponse } from "next/server";

import { backupGuard, fetchOpenApi } from "@/lib/backup/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await backupGuard();
  if (!ctx) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const openapi = await fetchOpenApi(ctx);
  return NextResponse.json({ openapi }, { headers: { "cache-control": "no-store" } });
}
