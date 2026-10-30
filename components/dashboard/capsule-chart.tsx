"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

// Histogramme en capsules : un rail gris sur toute la hauteur, la valeur
// remplie par-dessus. Deux avantages sur une barre nue — on lit « combien sur
// combien » d'un coup d'œil, et la colonne garde une présence même à zéro.
//
// Le mois le plus fort passe en or. Un seul accent par graphique : s'il y en a
// deux, l'œil ne sait plus où aller.
export function CapsuleChart({
  data,
  className,
}: {
  // `display` est formaté CÔTÉ SERVEUR : on ne peut pas passer de fonction de
  // formatage à un composant client, seulement des valeurs sérialisables.
  data: Array<{ label: string; value: number; display?: string }>;
  className?: string;
}) {
  const still = useReducedMotion();
  const max = Math.max(...data.map((d) => d.value), 1);
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  // Sous `sm`, douze étiquettes de mois ne tiennent pas côte à côte : « Août »
  // et « Sep » se touchent. On n'en garde qu'une sur deux. Le mois le plus fort
  // garde toujours la sienne — c'est la seule qu'on vient vraiment lire — et
  // s'il tombe sur une position masquée, on masque ses voisines plutôt que de
  // recréer la collision qu'on vient d'éviter.
  const compact = data.length > 10;
  const labelled = new Set<number>();
  if (compact) {
    for (let i = 0; i < data.length; i += 2) labelled.add(i);
    if (data[peak].value > 0 && !labelled.has(peak)) {
      labelled.add(peak);
      labelled.delete(peak - 1);
      labelled.delete(peak + 1);
    }
  }

  return (
    <div className={cn("relative flex h-44 items-end gap-1.5 sm:gap-3", className)}>
      {data.map((d, i) => {
        const pct = Math.max(2, (d.value / max) * 100);
        const isPeak = i === peak && d.value > 0;
        return (
          <div key={d.label} className="group/bar relative flex h-full flex-1 items-end">
            <span className="absolute inset-0 rounded-full bg-[rgba(255,255,255,0.06)]" />
            <motion.span
              initial={still ? false : { height: 0 }}
              animate={{ height: `${pct}%` }}
              transition={{ delay: 0.1 + i * 0.045, duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                "relative w-full rounded-full shadow-[0_0.5px_0_rgba(255,255,255,0.3)_inset]",
                isPeak
                  ? "bg-[linear-gradient(180deg,#E8CE85,#C9A84C)] shadow-[0_0.5px_0_rgba(255,255,255,0.6)_inset,0_8px_22px_-6px_rgba(201,168,76,0.55)]"
                  : "bg-[linear-gradient(180deg,#2B5C8F,#0A1F35)]",
              )}
            />
            {/* Valeur au survol — l'information à la demande plutôt qu'un
                étiquetage permanent qui encombrerait le graphique. */}
            <span className="n-inline pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border-[0.5px] border-[var(--hairline)] bg-[rgba(10,31,53,0.92)] px-2 py-1 text-[11px] text-foreground opacity-0 backdrop-blur-xl transition-opacity duration-200 group-hover/bar:opacity-100">
              {d.display ?? d.value}
            </span>
            {/* Les noms de mois en sans plutôt qu'en mono : la mono est large,
                et douze étiquettes à 390 px se chevauchaient. */}
            <span
              className={cn(
                "absolute -bottom-6 left-0 right-0 text-center text-[11px] font-medium tracking-[0.01em] text-muted-foreground",
                compact && !labelled.has(i) && "hidden sm:block",
              )}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
