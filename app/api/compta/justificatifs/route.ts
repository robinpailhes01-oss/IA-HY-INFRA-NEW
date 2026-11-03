import { NextResponse } from "next/server";
import { zipSync, strToU8 } from "fflate";

import { loadCompta } from "@/lib/compta/data";
import { exportClient, yearParam } from "@/lib/compta/export-auth";

// Tous les justificatifs de l'exercice dans un ZIP, rangés par mois, avec un
// index CSV qui relie chaque fichier à son mouvement.
export const maxDuration = 120;

const MAX_FILES = 400;

export async function GET(req: Request) {
  const supabase = await exportClient();
  if (!supabase) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const data = await loadCompta(yearParam(req.url), supabase);
  if (!data.ready) return NextResponse.json({ error: "Migration 0035 non appliquée" }, { status: 409 });

  const withReceipt = data.movements.filter((m) => m.entry?.receipt_path).slice(0, MAX_FILES);
  const files: Record<string, Uint8Array> = {};
  const index: string[] = ["Fichier;Date;Libellé;Montant TTC;Compte"];
  const failed: string[] = [];

  for (const m of withReceipt) {
    const path = m.entry!.receipt_path!;
    const { data: blob, error } = await supabase.storage.from("justificatifs").download(path);
    if (error || !blob) {
      failed.push(path);
      continue;
    }
    const base = (m.entry!.receipt_name ?? path.split("/").at(-1) ?? "piece").replace(/[^\w.\- ]+/g, "_");
    const name = `${m.date.slice(0, 7)}/${m.date}_${m.amount.toFixed(2)}_${base}`;
    files[name] = new Uint8Array(await blob.arrayBuffer());
    index.push([name, m.date, `"${m.title.replace(/"/g, '""')}"`, m.amount.toFixed(2).replace(".", ","), m.entry!.account_code].join(";"));
  }
  if (failed.length) index.push("", `Fichiers illisibles : ${failed.join(" | ")}`);
  files["index.csv"] = strToU8(`﻿${index.join("\r\n")}\r\n`);

  const zip = zipSync(files, { level: 0 });
  return new Response(Buffer.from(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="justificatifs-harmonie-yacht-${data.year}.zip"`,
      "cache-control": "no-store",
    },
  });
}
