"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Wallet,
  ChartColumn,
  Megaphone,
  PartyPopper,
  Bot,
  Settings,
  Sparkles,
  Mic,
  Search,
  Archive,
  LineChart,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { LeaStatusPill } from "@/components/lea-status-pill";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/resultats", label: "Résultats", icon: Sparkles },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/bookings", label: "Réservations", icon: Calendar },
  { href: "/finances", label: "Finances", icon: Wallet },
  { href: "/reports", label: "Rapports", icon: ChartColumn },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/seo", label: "Visibilité SEO", icon: Search },
  { href: "/events", label: "Événements", icon: PartyPopper },
  { href: "/archives", label: "Archives clients", icon: Archive },
  { href: "/agent", label: "Agent IA", icon: Bot },
  { href: "/jarvis", label: "Jarvis", icon: Mic },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex shrink-0 items-center gap-3 px-5 pb-7"
      >
        {/* La marque de l'application (app/icon.svg) : l'ancre or sur marine.
            Rendue en SVG plutôt qu'en <img> pour recevoir le même liseré de
            lumière que les autres surfaces. */}
        <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[linear-gradient(150deg,#17395C,#0A1F35)] shadow-[0_0.5px_0_rgba(255,255,255,0.18)_inset,0_6px_16px_-8px_rgba(0,0,0,0.8)]">
          <svg viewBox="0 0 100 100" className="size-[22px]" aria-hidden="true">
            <g
              fill="none"
              stroke="#C9A84C"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="50" cy="22" r="6" />
              <path d="M50 28v54M38 40h24M22 60c0 18 16 22 28 22s28-4 28-22M22 60l-8-4M78 60l8-4" />
            </g>
          </svg>
        </span>
        <span className="text-[15.5px] font-semibold tracking-[-0.02em] text-foreground">
          Harmonie <span className="text-gold">Yacht</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14.5px] font-medium tracking-[-0.012em]",
                "text-muted-foreground transition-all duration-[220ms] [transition-timing-function:var(--ease-ios)]",
                "hover:bg-[var(--surface-hover)] hover:text-foreground",
                // L'état actif est une pastille claire posée sur le verre, pas
                // une teinte de fond : c'est ce qui lui donne du relief.
                active &&
                  "bg-[rgba(255,255,255,0.12)] font-semibold text-foreground shadow-[0_0.5px_0_rgba(255,255,255,0.18)_inset,0_8px_20px_-14px_rgba(0,0,0,0.9)]",
              )}
            >
              <Icon
                className={cn("size-[17px] shrink-0 stroke-[1.6]", active && "text-gold")}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--hairline)] p-3">
        <LeaStatusPill />
      </div>
    </div>
  );
}
