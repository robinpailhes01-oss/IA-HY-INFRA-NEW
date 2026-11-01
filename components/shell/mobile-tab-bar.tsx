"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";

import { cn } from "@/lib/utils";
import { SECTIONS, TOOLS, matchesPath, sectionFor } from "@/lib/navigation";
import { SECTION_ICONS } from "@/components/sidebar-nav";
import { LeaStatusPill } from "@/components/lea-status-pill";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/**
 * Sur téléphone, la navigation descend sous le pouce : une pilule de verre
 * flottante avec les quatre espaces + « Plus ». C'est le cas d'usage
 * principal (Robin consulte debout, entre deux sorties) — pas une réduction
 * du bureau.
 */
export function MobileTabBar({ attention = 0 }: { attention?: number }) {
  const pathname = usePathname();
  const current = sectionFor(pathname);
  const [moreOpen, setMoreOpen] = useState(false);
  const inTools = TOOLS.some((t) => matchesPath(pathname, t.href));

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="vitre-shell is-bar fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex h-[66px] items-center justify-between rounded-full px-1.5 lg:hidden"
      >
        {SECTIONS.map((s) => {
          const Icon = SECTION_ICONS[s.key];
          const active = current?.key === s.key;
          return (
            <Link
              key={s.key}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className="relative flex h-full flex-1 flex-col items-center justify-center gap-1"
            >
              <span
                className={cn(
                  "relative grid h-8 w-12 place-items-center rounded-full transition-all duration-300 [transition-timing-function:var(--ease-ios)]",
                  active
                    ? "bg-[linear-gradient(160deg,#1a4373,#0b2545)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_14px_-6px_rgba(11,37,69,0.7)]"
                    : "text-ink-2",
                )}
              >
                <Icon className="size-[19px]" strokeWidth={1.7} />
                {s.key === "agent" && attention > 0 && (
                  <span className="absolute -right-0.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full border-2 border-white bg-danger px-1 text-[9.5px] font-bold tabular-nums text-white">
                    {attention}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[10.5px] font-semibold tracking-[-0.005em]",
                  active ? "text-foreground" : "text-ink-3",
                )}
              >
                {s.short}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="relative flex h-full flex-1 flex-col items-center justify-center gap-1"
          aria-label="Plus"
        >
          <span
            className={cn(
              "grid h-8 w-12 place-items-center rounded-full",
              inTools ? "bg-[linear-gradient(160deg,#1a4373,#0b2545)] text-white" : "text-ink-2",
            )}
          >
            <Ellipsis className="size-[19px]" strokeWidth={1.7} />
          </span>
          <span className={cn("text-[10.5px] font-semibold", inTools ? "text-foreground" : "text-ink-3")}>
            Plus
          </span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <SheetTitle className="px-5 pt-5 font-serif text-[26px] font-normal tracking-[-0.01em]">
            Tout le tableau de bord
          </SheetTitle>
          <div className="space-y-5 px-5 pb-2 pt-4">
            <LeaStatusPill variant="card" />
            {SECTIONS.filter((s) => s.tabs.length > 0).map((s) => (
              <div key={s.key}>
                <p className="t-eyebrow mb-2 text-ink-3">{s.label}</p>
                <div className="flex flex-wrap gap-2">
                  {s.tabs.map((t) => (
                    <Link
                      key={t.href}
                      href={t.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "rounded-full border px-4 py-2.5 text-[13.5px] font-medium",
                        matchesPath(pathname, t.href)
                          ? "border-transparent bg-navy text-white"
                          : "border-white bg-white/80 text-foreground shadow-[var(--shadow-glass)]",
                      )}
                    >
                      {t.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <p className="t-eyebrow mb-2 text-ink-3">Outils</p>
              <div className="flex flex-wrap gap-2">
                {TOOLS.map((t) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "rounded-full border px-4 py-2.5 text-[13.5px] font-medium",
                      matchesPath(pathname, t.href)
                        ? "border-transparent bg-navy text-white"
                        : "border-white bg-white/80 text-foreground shadow-[var(--shadow-glass)]",
                    )}
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
