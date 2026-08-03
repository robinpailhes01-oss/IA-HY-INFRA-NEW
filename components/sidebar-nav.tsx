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
  { href: "/events", label: "Événements", icon: PartyPopper },
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
        className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-6 text-lg font-semibold tracking-tight text-primary"
      >
        <span className="text-gold">⚓</span>
        <span>
          Harmonie <span className="text-gold">Yacht</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active && "text-gold")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <LeaStatusPill />
      </div>
    </div>
  );
}
