"use client";

import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FilterControls, type FilterControlsProps } from "@/components/leads/leads-filters";

export function LeadsFiltersMobile(props: FilterControlsProps) {
  const activeCount =
    (props.filters.q.trim() ? 1 : 0) +
    props.filters.channels.length +
    (props.filters.offer ? 1 : 0) +
    (props.filters.minScore > 0 ? 1 : 0) +
    (props.filters.followUpOnly ? 1 : 0);

  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger render={<Button variant="outline" size="sm" className="w-full" />}>
          <SlidersHorizontal />
          Filtres
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-gold/20 px-1.5 text-xs font-semibold text-gold">
              {activeCount}
            </span>
          )}
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4">
          <SheetHeader className="px-0">
            <SheetTitle>Filtrer les leads</SheetTitle>
          </SheetHeader>
          <FilterControls {...props} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
