import { NextResponse } from "next/server";

import { isDenied, restoreGuard } from "@/lib/backup/restore-server";
import { RESTORE_ORDER } from "@/lib/backup/schema-meta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Où l'on va restaurer (adresse du projet cible) et ce qu'il contient déjà.
export async function GET() {
  const ctx = await restoreGuard();
  if (isDenied(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const counts: Record<string, number | null> = {};
  await Promise.all(
    RESTORE_ORDER.map(async (t) => {
      const { count, error } = await ctx.db.from(t).select("*", { count: "exact", head: true });
      counts[t] = error ? null : (count ?? 0);
    }),
  );
  const missing = Object.entries(counts).filter(([, c]) => c === null).map(([t]) => t);
  return NextResponse.json({ target: ctx.supabaseUrl, email: ctx.email, counts, missing }, { headers: { "cache-control": "no-store" } });
}
