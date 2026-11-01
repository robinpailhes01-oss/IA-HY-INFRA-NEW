"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { activeTab, sectionFor } from "@/lib/navigation";

/**
 * Les sous-onglets de l'espace courant (Agent WhatsApp → Pilotage,
 * Conversations, Leads, Résultats…), posés dans l'en-tête.
 *
 * Déduits de l'URL : une page n'a rien à déclarer pour apparaître ici, il
 * suffit qu'elle soit listée dans lib/navigation.ts. La pastille blanche
 * GLISSE d'un onglet à l'autre — sans ce mouvement, c'est une rangée de liens.
 */
export function SectionTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  if (!section || section.tabs.length === 0) return null;

  // /marketing est l'ancienne adresse de Réseaux sociaux.
  const current =
    activeTab(pathname, section.tabs) ??
    (pathname.startsWith("/marketing") ? "/social" : undefined);

  return (
    <nav
      aria-label={section.label}
      className={cn(
        "no-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-white/90 bg-white/45 p-1 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.04)] backdrop-blur-xl",
        className,
      )}
    >
      {section.tabs.map((tab) => {
        const active = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative h-9 shrink-0 rounded-full px-4 text-[13.5px] font-medium leading-9 tracking-[-0.012em] transition-colors duration-200",
              active ? "text-foreground" : "text-ink-2 hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="section-tab-pill"
                transition={{ type: "spring", stiffness: 460, damping: 36 }}
                className="absolute inset-0 rounded-full bg-white shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.08),0_6px_14px_-8px_rgba(11,37,69,0.3)]"
              />
            )}
            <span className="relative">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
