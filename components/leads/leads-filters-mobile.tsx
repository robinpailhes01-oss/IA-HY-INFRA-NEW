"use client";

import { Search, SlidersHorizontal } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FilterControls, type FilterControlsProps } from "@/components/leads/leads-filters";

/**
 * Sur téléphone : la recherche reste à portée de pouce, le reste des
 * filtres monte dans une feuille. Un compteur dit combien sont actifs.
 */
export function LeadsFiltersMobile(props: FilterControlsProps) {
  const activeCount =
    props.filters.channels.length +
    (props.filters.offer ? 1 : 0) +
    (props.filters.minScore > 0 ? 1 : 0) +
    (props.filters.followUpOnly ? 1 : 0);

  return (
    <div className="flex items-center gap-2 md:hidden">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Rechercher un lead</span>
        {/* z-[1] : le champ (backdrop-blur) forme un contexte d'empilement
            peint APRÈS l'icône — sans ça, son fond blanc la voilait. */}
        <Search className="pointer-events-none absolute left-3.5 top-1/2 z-[1] size-4 -translate-y-1/2 text-ink-3" />
        <input
          value={props.filters.q}
          onChange={(e) => props.onChange({ q: e.target.value })}
          placeholder="Rechercher un lead…"
          className="h-11 w-full rounded-full border border-white/90 bg-white/70 pl-10 pr-4 text-[15px] text-foreground shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.05)] outline-none backdrop-blur-xl placeholder:text-ink-3 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-ocean/12"
        />
      </label>
      <Sheet>
        <SheetTrigger
          render={
            <button
              type="button"
              className="relative flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/90 bg-white/70 px-4 text-[13.5px] font-medium text-foreground shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.05)] backdrop-blur-xl"
            />
          }
        >
          <SlidersHorizontal className="size-4" />
          Filtres
          {activeCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ocean px-1.5 text-[11px] font-semibold tabular-nums text-white">
              {activeCount}
            </span>
          )}
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="px-0 pt-0">
            <SheetTitle className="t-serif text-[26px] font-normal">Filtrer les leads</SheetTitle>
            <SheetDescription>
              {props.resultCount} sur {props.totalCount} leads affichés
            </SheetDescription>
          </SheetHeader>
          <FilterControls {...props} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
