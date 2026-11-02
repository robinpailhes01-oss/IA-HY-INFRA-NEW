"use client";

import { RotateCcw, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChannelLogo } from "@/components/leads/channel-logo";
import { channelLabel } from "@/components/agent/channels";
import {
  EMPTY_FILTERS,
  filtersActive,
  type LeadFilters,
} from "@/lib/leads";

const ALL_OFFERS = "__all__";

export type FilterControlsProps = {
  filters: LeadFilters;
  onChange: (patch: Partial<LeadFilters>) => void;
  availableChannels: string[];
  availableOffers: string[];
  resultCount: number;
  totalCount: number;
};

/**
 * Les filtres du pipeline. Tout est pilule : recherche, offre, « à relancer »,
 * canaux, score minimum. Les mêmes contrôles servent sur bureau (dans une
 * plaque de verre) et sur téléphone (dans une feuille qui monte du bas).
 */
export function FilterControls({
  filters,
  onChange,
  availableChannels,
  availableOffers,
  resultCount,
  totalCount,
}: FilterControlsProps) {
  function toggleChannel(channel: string) {
    const next = filters.channels.includes(channel)
      ? filters.channels.filter((c) => c !== channel)
      : [...filters.channels, channel];
    onChange({ channels: next });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Rechercher un lead</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Nom, téléphone, offre, occasion…"
            className="vitre-inset h-11 w-full rounded-full pl-10 pr-4 text-[14px] text-foreground outline-none placeholder:text-ink-3 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-ocean/12"
          />
        </label>

        <Select
          value={filters.offer || ALL_OFFERS}
          onValueChange={(v) => onChange({ offer: v === ALL_OFFERS ? "" : (v as string) })}
        >
          <SelectTrigger className="h-11 w-full min-w-[180px] md:w-auto">
            <SelectValue>
              {(value) =>
                !value || value === ALL_OFFERS ? "Toutes les offres" : (value as string)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_OFFERS}>Toutes les offres</SelectItem>
            {availableOffers.map((offer) => (
              <SelectItem key={offer} value={offer}>
                {offer}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex h-11 cursor-pointer items-center justify-between gap-3 rounded-full border border-[rgba(11,37,69,0.1)] bg-white/75 pl-4 pr-2.5 text-[13.5px] shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.05)]">
          <span className="text-ink-2">À relancer</span>
          <Switch
            checked={filters.followUpOnly}
            onCheckedChange={(c) => onChange({ followUpOnly: c })}
          />
        </label>

        <div className="flex items-center gap-2 md:ml-auto">
          {filtersActive(filters) && (
            <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)} className="h-10">
              <RotateCcw />
              Réinitialiser
            </Button>
          )}
          <span className="whitespace-nowrap text-[12.5px] text-ink-3">
            <span className="font-semibold tabular-nums text-foreground">{resultCount}</span>
            {" "}sur {totalCount}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-1.5">
          {availableChannels.map((channel) => {
            const active = filters.channels.includes(channel);
            return (
              <button
                key={channel}
                type="button"
                onClick={() => toggleChannel(channel)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-[background-color,border-color,color,box-shadow] duration-200",
                  active
                    ? "border-[rgba(47,127,224,0.3)] bg-[rgba(47,127,224,0.1)] text-ocean shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                    : "border-white/90 bg-white/55 text-ink-2 hover:bg-white hover:text-foreground",
                )}
              >
                <ChannelLogo channel={channel} className="size-3.5" />
                {channelLabel(channel)}
              </button>
            );
          })}
        </div>

        <label className="flex h-10 shrink-0 items-center gap-3 whitespace-nowrap rounded-full border border-white/90 bg-white/55 px-4 text-[12.5px] text-ink-2 md:ml-auto">
          Score min.
          <input
            type="range"
            min={0}
            max={10}
            value={filters.minScore}
            onChange={(e) => onChange({ minScore: Number(e.target.value) })}
            className="h-1.5 w-full min-w-24 cursor-pointer accent-ocean md:w-28"
          />
          <span className="w-4 text-right font-semibold tabular-nums text-foreground">
            {filters.minScore}
          </span>
        </label>
      </div>
    </div>
  );
}

export function LeadsFilters(props: FilterControlsProps) {
  return (
    <div className="vitre hidden rounded-[24px] p-3 md:block">
      <div className="relative z-[1]">
        <FilterControls {...props} />
      </div>
    </div>
  );
}
