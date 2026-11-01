"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Num } from "@/components/ui/num";

// Histogramme en capsules : une barre par mois, rien derrière.
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
            {/* Plus de rail de fond.
                Il était censé faire lire « combien sur combien », mais sa
                hauteur ne représentait rien : elle valait le meilleur mois,
                c'est-à-dire une valeur arbitraire. Sur une activité
                saisonnière où huit mois sur douze sont proches de zéro, douze
                rails pleine hauteur ne montraient qu'une chose — du vide — et
                volaient l'attention aux trois mois qui comptent. */}
            <motion.span
              initial={{ height: 0 }}
              animate={{ height: `${pct}%` }}
              transition={{ delay: 0.1 + i * 0.045, duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                "relative w-full rounded-full",
                // Les barres sont de la glace bleutée ; le mois le plus fort
                // passe au marine plein, avec sa lueur océan. Un seul accent
                // par graphique, sinon l'œil ne sait plus où aller.
                isPeak
                  ? "bg-[linear-gradient(180deg,#2f7fe0,#0b2545)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_12px_26px_-8px_rgba(47,127,224,0.6)]"
                  : "bg-[linear-gradient(180deg,#bfe0fa,#8cc4f0)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
              )}
            />
            {/* Valeur au survol — l'information à la demande plutôt qu'un
                étiquetage permanent qui encombrerait le graphique. */}
            <span className="n-inline pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-navy px-2.5 py-1 text-[11px] text-white opacity-0 shadow-[0_8px_18px_-8px_rgba(11,37,69,0.6)] transition-opacity duration-200 group-hover/bar:opacity-100">
              <Num>{d.display ?? String(d.value)}</Num>
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
