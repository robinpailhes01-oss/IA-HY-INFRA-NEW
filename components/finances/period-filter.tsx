"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ALL_TIME_FROM = "2020-01-01";
const ALL_TIME_TO = "2099-12-31";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function monthBounds(year: number, monthIdx: number): { from: string; to: string } {
  const last = new Date(year, monthIdx + 1, 0).getDate();
  return {
    from: `${year}-${pad(monthIdx + 1)}-01`,
    to: `${year}-${pad(monthIdx + 1)}-${pad(last)}`,
  };
}

type Preset = "month" | "prev_month" | "30d" | "year" | "all" | "custom";

function detectPreset(from: string, to: string): Preset {
  const now = new Date();
  const cur = monthBounds(now.getFullYear(), now.getMonth());
  if (from === cur.from && to === cur.to) return "month";

  const prevMonthIdx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prev = monthBounds(prevMonthYear, prevMonthIdx);
  if (from === prev.from && to === prev.to) return "prev_month";

  if (from === `${now.getFullYear()}-01-01` && to === `${now.getFullYear()}-12-31`) return "year";
  if (from === ALL_TIME_FROM && to === ALL_TIME_TO) return "all";

  const today = now.toISOString().slice(0, 10);
  const thirty = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  if (from === thirty && to === today) return "30d";

  return "custom";
}

export function PeriodFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  const active = detectPreset(from, to);

  function navigate(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(search.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function applyPreset(p: Exclude<Preset, "custom">) {
    const now = new Date();
    if (p === "month") {
      const { from: f, to: t } = monthBounds(now.getFullYear(), now.getMonth());
      navigate(f, t);
    } else if (p === "prev_month") {
      const idx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const yr = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const { from: f, to: t } = monthBounds(yr, idx);
      navigate(f, t);
    } else if (p === "30d") {
      const today = now.toISOString().slice(0, 10);
      const thirty = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      navigate(thirty, today);
    } else if (p === "year") {
      navigate(`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`);
    } else if (p === "all") {
      navigate(ALL_TIME_FROM, ALL_TIME_TO);
    }
  }

  const presets: { id: Exclude<Preset, "custom">; label: string }[] = [
    { id: "month", label: "Ce mois" },
    { id: "prev_month", label: "Mois dernier" },
    { id: "30d", label: "30 j" },
    { id: "year", label: "Année" },
    { id: "all", label: "Tout" },
  ];

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        pending && "opacity-60",
      )}
    >
      {presets.map((p) => (
        <Button
          key={p.id}
          variant={active === p.id ? "default" : "outline"}
          size="sm"
          onClick={() => applyPreset(p.id)}
        >
          {p.label}
        </Button>
      ))}
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={from}
          onChange={(e) => navigate(e.target.value, to)}
          className="h-8 w-auto text-xs"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => navigate(from, e.target.value)}
          className="h-8 w-auto text-xs"
        />
      </div>
    </div>
  );
}
