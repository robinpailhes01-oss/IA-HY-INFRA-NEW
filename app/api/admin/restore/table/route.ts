import { NextResponse } from "next/server";

import { restoreChunk, type Row } from "@/lib/backup/restore";
import { CLEAR_BEFORE, isDenied, restoreGuard } from "@/lib/backup/restore-server";
import { RESTORE_ORDER } from "@/lib/backup/schema-meta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ROWS = 400;

export async function POST(req: Request) {
  const ctx = await restoreGuard();
  if (isDenied(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = (await req.json().catch(() => null)) as {
    table?: string;
    rows?: Row[];
    clear?: boolean;
    nullify?: string[];
  } | null;
  const table = body?.table ?? "";
  if (!(RESTORE_ORDER as readonly string[]).includes(table)) {
    return NextResponse.json({ error: "Table inconnue" }, { status: 400 });
  }

  if (body?.clear) {
    if (!CLEAR_BEFORE.has(table)) return NextResponse.json({ error: "Table non videable" }, { status: 400 });
    const { error } = await ctx.db.from(table).delete().not("id", "is", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cleared: true });
  }

  const rows = Array.isArray(body?.rows) ? body!.rows! : [];
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Trop de lignes (${MAX_ROWS} max)` }, { status: 413 });
  const nullify = Array.isArray(body?.nullify) ? body!.nullify!.filter((c) => /^[a-z_0-9]+$/.test(c)) : [];

  const result = await restoreChunk(
    table,
    rows,
    (t, batch, onConflict) => ctx.db.from(t).upsert(batch as never, { onConflict }) as unknown as Promise<{ error: { message: string; code?: string | null } | null }>,
    { nullify },
  );
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
