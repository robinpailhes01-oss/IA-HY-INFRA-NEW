import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

// Une tuile chiffrée posée sur le panneau marine (le point de Léa sur les
// réservations, sa lecture des rapports) : un libellé, un chiffre, une
// précision. `alert` la passe à l'ambre — « ce chiffre demande un geste ».
// Avec `href`, la tuile mène à l'endroit où faire ce geste.
//
// Téléphone : trois tuiles dans 390 px laissent ~75 px de texte. Le chiffre
// y descend à 20 px, la précision peut passer à la ligne, et `shortLabel`
// remplace un libellé qui serait coupé (« Meilleur m… »).
export function BriefTile({
  label,
  shortLabel,
  value,
  detail,
  alert,
  href,
}: {
  label: string;
  /** Libellé sur téléphone, si `label` ne tient pas. */
  shortLabel?: string;
  value: React.ReactNode;
  detail: React.ReactNode;
  alert?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <p className={cn("t-label flex items-center justify-between gap-1 truncate", alert ? "text-[#f7d3a6]" : "text-[#cfe2f7]")}>
        {shortLabel ? (
          <>
            <span className="truncate sm:hidden">{shortLabel}</span>
            <span className="hidden truncate sm:inline">{label}</span>
          </>
        ) : (
          <span className="truncate">{label}</span>
        )}
        {href && <ArrowUpRight aria-hidden className="size-3.5 shrink-0 opacity-70" />}
      </p>
      <p className={cn("n-kpi mt-2.5 truncate max-sm:text-[20px]", alert ? "text-[#ffe2bd]" : "text-white")}>{value}</p>
      <p className="t-caption mt-1.5 text-[#a9c3e0] sm:truncate">{detail}</p>
    </>
  );
  const cls = cn(
    "block min-w-0 rounded-[18px] border p-3 sm:rounded-[20px] sm:p-4",
    alert ? "border-[rgba(247,194,127,0.28)] bg-[rgba(217,130,43,0.12)]" : "border-white/10 bg-white/[0.05]",
  );
  return href ? (
    <Link
      href={href}
      className={cn(
        cls,
        "outline-none transition-colors hover:bg-white/[0.1] focus-visible:ring-4 focus-visible:ring-white/20",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
