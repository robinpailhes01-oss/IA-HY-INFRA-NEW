"use client";

import { RotateCcw, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EMPTY_FILTERS,
  channelMeta,
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Rechercher un lead…"
            className="h-8 pl-8"
          />
        </div>

        <Select
          value={filters.offer || ALL_OFFERS}
          onValueChange={(v) => onChange({ offer: v === ALL_OFFERS ? "" : (v as string) })}
        >
          <SelectTrigger className="h-8 min-w-[150px]">
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

        <label className="flex h-8 items-center gap-2 rounded-lg border border-border px-2.5 text-sm">
          <span className="text-muted-foreground">À relancer</span>
          <Switch
            checked={filters.followUpOnly}
            onCheckedChange={(c) => onChange({ followUpOnly: c })}
          />
        </label>

        {filtersActive(filters) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-muted-foreground"
          >
            <RotateCcw />
            Réinitialiser
          </Button>
        )}

        <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{resultCount}</span> / {totalCount}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {availableChannels.map((channel) => {
            const meta = channelMeta(channel);
            const active = filters.channels.includes(channel);
            const Icon = meta.Icon;
            return (
              <button
                key={channel}
                type="button"
                onClick={() => toggleChannel(channel)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                  active
                    ? "border-transparent " + meta.className
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3" />
                {meta.label}
              </button>
            );
          })}
        </div>

        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Score min
          <input
            type="range"
            min={0}
            max={10}
            value={filters.minScore}
            onChange={(e) => onChange({ minScore: Number(e.target.value) })}
            className="h-1.5 w-28 cursor-pointer accent-gold"
          />
          <span className="w-4 font-semibold tabular-nums text-foreground">
            {filters.minScore}
          </span>
        </label>
      </div>
    </div>
  );
}

export function LeadsFilters(props: FilterControlsProps) {
  return (
    <div className="hidden rounded-2xl border border-border bg-card/60 p-3 shadow-sm md:block">
      <FilterControls {...props} />
    </div>
  );
}
