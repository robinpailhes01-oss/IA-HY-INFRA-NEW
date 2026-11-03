import { NextResponse } from "next/server";

import { loadCompta } from "@/lib/compta/data";
import { exportClient, yearParam } from "@/lib/compta/export-auth";

// Le journal lisible dans Excel : point-virgule, virgule décimale, UTF-8 avec
// BOM (sans lui, Excel affiche « Ã© » à la place des accents).
const STATUS = { a_classer: "À classer", justificatif: "Justificatif manquant", ok: "OK" } as const;

const cell = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v.toFixed(2).replace(".", ",");
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

export async function GET(req: Request) {
  const supabase = await exportClient();
  if (!supabase) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const data = await loadCompta(yearParam(req.url), supabase);
  if (!data.ready) return NextResponse.json({ error: "Migration 0035 non appliquée" }, { status: 409 });

  const header = ["Date", "Source", "Libellé", "Sens", "Montant TTC", "Commission SumUp", "Compte", "Intitulé du compte", "Taux TVA", "TVA collectée", "TVA déductible", "Autoliquidation", "Justificatif", "Sans justificatif (raison)", "Note", "Statut"];
  const rows = [...data.movements]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((m) =>
      [
        m.date,
        m.source === "bank" ? "Qonto" : "Caisse",
        m.title,
        m.direction === "in" ? "Entrée" : "Sortie",
        m.amount,
        m.sumupFee,
        m.entry?.account_code ?? "",
        m.account?.label ?? "",
        m.entry ? `${String(m.entry.vat_rate).replace(".", ",")} %` : "",
        m.vat.collected,
        m.vat.deductible + m.vat.deductibleAssets,
        m.vat.reverseVat,
        m.entry?.receipt_name ?? "",
        m.entry?.no_receipt_reason ?? "",
        m.entry?.note ?? "",
        STATUS[m.status],
      ]
        .map(cell)
        .join(";"),
    );

  return new Response(`﻿${[header.join(";"), ...rows].join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="journal-harmonie-yacht-${data.year}.csv"`,
      "cache-control": "no-store",
    },
  });
}
