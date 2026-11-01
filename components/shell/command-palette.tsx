"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SECTIONS, TOOLS } from "@/lib/navigation";

type Entry = { href: string; label: string; hint: string };

// Toutes les destinations, à plat : espaces, sous-onglets, outils, et deux
// raccourcis d'action. Une recherche qui ne cherche que dans la navigation —
// c'est ce qu'on fait 9 fois sur 10 en ouvrant ⌘K.
function buildEntries(): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  const push = (e: Entry) => {
    if (seen.has(e.href + e.label)) return;
    seen.add(e.href + e.label);
    out.push(e);
  };
  for (const s of SECTIONS) {
    push({ href: s.href, label: s.label, hint: s.group });
    for (const t of s.tabs) {
      if (t.href !== s.href) push({ href: t.href, label: t.label, hint: s.label });
    }
  }
  for (const t of TOOLS) push({ href: t.href, label: t.label, hint: "Outils" });
  push({ href: "/leads?view=priority&bucket=unanswered", label: "Clients sans réponse", hint: "Action" });
  push({ href: "/jarvis", label: "Parler à l'agent Manager", hint: "Action" });
  return out;
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const entries = useMemo(buildEntries, []);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return entries;
    return entries.filter((e) => normalize(`${e.label} ${e.hint}`).includes(q));
  }, [entries, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const go = (e: Entry | undefined) => {
    if (!e) return;
    onOpenChange(false);
    router.push(e.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Aller à…</DialogTitle>
        <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-5">
          <Search className="size-[18px] shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(results[index]);
              }
            }}
            placeholder="Aller à une page, une action…"
            className="h-14 flex-1 bg-transparent text-[15px] tracking-[-0.012em] text-foreground outline-none placeholder:text-ink-3"
          />
          <kbd className="rounded-md border border-[var(--hairline-strong)] bg-white px-1.5 py-0.5 text-[11px] font-medium text-ink-3">
            Esc
          </kbd>
        </div>
        <ul className="scroll-soft max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              Rien ne correspond à « {query} ».
            </li>
          )}
          {results.map((e, i) => (
            <li key={e.href + e.label}>
              <button
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(e)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                  i === index ? "bg-[rgba(47,127,224,0.08)]" : "hover:bg-white/70",
                )}
              >
                <span className="flex-1 truncate text-[14px] font-medium tracking-[-0.012em] text-foreground">
                  {e.label}
                </span>
                <span className="text-[12px] text-ink-3">{e.hint}</span>
                {i === index && <CornerDownLeft className="size-3.5 text-ocean" />}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
