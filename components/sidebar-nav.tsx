"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  ChevronDown,
  LayoutGrid,
  MessageCircle,
  Mic,
  PartyPopper,
  Settings,
  Share2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { BrandMark, BrandWordmark } from "@/components/shell/brand-mark";
import { LeaStatusPill } from "@/components/lea-status-pill";
import {
  SECTIONS,
  TOOLS,
  matchesPath,
  sectionFor,
  type SectionKey,
  type ToolKey,
} from "@/lib/navigation";

export const SECTION_ICONS: Record<SectionKey, LucideIcon> = {
  overview: LayoutGrid,
  agent: MessageCircle,
  social: Share2,
  finance: Wallet,
};

const TOOL_ICONS: Record<ToolKey, LucideIcon> = {
  events: PartyPopper,
  archives: Archive,
  jarvis: Mic,
  settings: Settings,
};

/**
 * La barre latérale : quatre espaces, rien de plus à la surface.
 *
 * L'état actif est une pilule blanche posée sur le verre, avec l'icône dans
 * une pastille marine — la seule touche sombre de la barre. Les outils
 * secondaires sont repliés : ils restent à un clic sans voler l'attention.
 */
export function SidebarNav({
  attention = 0,
  onNavigate,
}: {
  /** Clients qui attendent une réponse humaine — badge sur l'agent. */
  attention?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const current = sectionFor(pathname);
  const inTools = TOOLS.some((t) => matchesPath(pathname, t.href));
  const [toolsOpen, setToolsOpen] = useState(inTools);

  return (
    <div className="flex h-full flex-col p-3">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-2xl px-2 pb-6 pt-2"
      >
        <BrandMark />
        <BrandWordmark />
      </Link>

      <nav className="scroll-soft -mx-1 flex-1 space-y-4 overflow-y-auto px-1">
        {SECTIONS.map((section) => {
          const Icon = SECTION_ICONS[section.key];
          const active = current?.key === section.key;
          return (
            <div key={section.key}>
              <p className="t-eyebrow mb-1.5 px-3 text-ink-3">{section.group}</p>
              <Link
                href={section.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-12 items-center gap-3 rounded-full pl-1.5 pr-3 text-[14.5px] font-medium tracking-[-0.016em] transition-all duration-300 [transition-timing-function:var(--ease-ios)]",
                  active
                    ? "border border-white bg-white text-foreground shadow-[var(--shadow-lift)]"
                    : "border border-transparent text-ink-2 hover:bg-white/60 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-300",
                    active
                      ? "bg-[linear-gradient(160deg,#1a4373,#0b2545)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_14px_-6px_rgba(11,37,69,0.7)]"
                      : "text-ink-2 group-hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={1.7} />
                </span>
                <span className="flex-1 truncate">{section.label}</span>
                {section.key === "agent" && attention > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-semibold tabular-nums text-white shadow-[0_4px_10px_-4px_rgba(224,77,85,0.8)]">
                    {attention}
                  </span>
                )}
              </Link>
            </div>
          );
        })}

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setToolsOpen((v) => !v)}
            aria-expanded={toolsOpen}
            className="flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-left"
          >
            <span className="t-eyebrow flex-1 text-ink-3">Outils</span>
            <ChevronDown
              className={cn(
                "size-3.5 text-ink-3 transition-transform duration-300 [transition-timing-function:var(--ease-ios)]",
                toolsOpen && "rotate-180",
              )}
            />
          </button>
          {toolsOpen && (
            <div className="mt-1 space-y-0.5">
              {TOOLS.map((tool) => {
                const Icon = TOOL_ICONS[tool.key];
                const active = matchesPath(pathname, tool.href);
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-full px-3 text-[13.5px] font-medium tracking-[-0.012em] transition-colors duration-200",
                      active
                        ? "bg-white text-foreground shadow-[var(--shadow-glass)]"
                        : "text-ink-2 hover:bg-white/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.7} />
                    <span className="truncate">{tool.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="pt-3">
        <LeaStatusPill variant="card" />
      </div>
    </div>
  );
}
