import { NextResponse } from "next/server";

import { backupGuard, fetchPage, PAGE_SIZE, validTableName } from "@/lib/backup/server";
import { SENSITIVE_TABLES } from "@/lib/backup/tables";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const ctx = await backupGuard();
  if (!ctx) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  const from = Math.max(0, Number(url.searchParams.get("from") ?? 0) || 0);
  if (!validTableName(name)) return NextResponse.json({ error: "Table invalide" }, { status: 400 });
  if ((SENSITIVE_TABLES as readonly string[]).includes(name) && !ctx.isAdmin) {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  const { data, error } = await fetchPage(ctx, name, from);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as unknown[];
  return NextResponse.json(
    { rows, next: rows.length === PAGE_SIZE ? from + PAGE_SIZE : null },
    { headers: { "cache-control": "no-store" } },
  );
}
