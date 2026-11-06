import { NextResponse } from "next/server";

import { isDenied, restoreGuard } from "@/lib/backup/restore-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await restoreGuard();
  if (isDenied(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const body = (await req.json().catch(() => null)) as { id?: string; public?: boolean } | null;
  const id = body?.id ?? "";
  if (!/^[\w-]{1,63}$/.test(id)) return NextResponse.json({ error: "Nom de bucket invalide" }, { status: 400 });
  const { data: list } = await ctx.db.storage.listBuckets();
  if ((list ?? []).some((b) => b.id === id)) return NextResponse.json({ created: false, existed: true });
  const { error } = await ctx.db.storage.createBucket(id, { public: Boolean(body?.public) });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ created: true });
}
