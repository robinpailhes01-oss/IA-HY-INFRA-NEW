import { NextResponse } from "next/server";

import { loadCompta } from "@/lib/compta/data";
import { exportClient, latin9, yearParam } from "@/lib/compta/export-auth";
import { buildFec, fecFileName, fecText, unbalanced } from "@/lib/compta/fec";

// Export FEC de l'exercice — fichier texte, tabulations, ISO-8859-15.
export async function GET(req: Request) {
  const supabase = await exportClient();
  if (!supabase) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const data = await loadCompta(yearParam(req.url), supabase);
  if (!data.ready) return NextResponse.json({ error: "Migration 0035 non appliquée" }, { status: 409 });

  const today = new Date().toISOString().slice(0, 10);
  const lines = buildFec(data.movements, data.periods, today);
  const broken = unbalanced(lines);
  if (broken.length > 0) {
    return NextResponse.json({ error: `Écritures déséquilibrées : ${broken.slice(0, 5).join(", ")}` }, { status: 500 });
  }

  return new Response(Buffer.from(latin9(fecText(lines))), {
    headers: {
      "content-type": "text/plain; charset=iso-8859-15",
      "content-disposition": `attachment; filename="${fecFileName(data.settings.siren, data.to)}"`,
      "cache-control": "no-store",
    },
  });
}
