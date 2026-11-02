"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { SOCIAL_PERIODS, type SocialPeriod } from "@/components/social/model";

/**
 * Choix de la période, en pilule segmentée. La période vit dans l'URL (?p=90)
 * pour que la page reste un composant serveur — les chiffres sont recalculés
 * côté serveur, jamais dans le navigateur — et qu'un lien partagé ou un
 * rechargement retombe sur la même vue.
 *
 * Pourquoi pas <Segmented> du kit : ses segments font 34 px de haut. Ici on
 * vise 44 px sur téléphone (pouce, debout sur le ponton), 36 px au bureau.
 */
export function PeriodSwitch({ value, className }: { value: SocialPeriod; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Optimiste : la pastille glisse tout de suite, la page suit.
  const [shown, setShown] = useState(value);
  if (!pending && shown !== value) setShown(value);

  function choose(next: SocialPeriod) {
    if (next === shown) return;
    setShown(next);
    const params = new URLSearchParams(search.toString());
    if (next === "30") params.delete("p");
    else params.set("p", next);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div
      role="radiogroup"
      aria-label="Période"
      aria-busy={pending}
      className={cn(
        "relative inline-flex rounded-full border border-white/90 bg-[rgba(11,37,69,0.045)] p-[3px] shadow-[inset_0_1px_2px_rgba(11,37,69,0.05)] transition-opacity",
        pending && "opacity-80",
        className,
      )}
    >
      {SOCIAL_PERIODS.map((p) => {
        const active = p.value === shown;
        return (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(p.value)}
            className={cn(
              "relative h-11 flex-1 whitespace-nowrap rounded-full px-4 text-[13px] font-medium tracking-[-0.01em] transition-colors duration-200 outline-none focus-visible:ring-4 focus-visible:ring-ocean/20 lg:h-[30px] lg:px-3.5",
              active ? "text-foreground" : "text-ink-2 hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="social-period"
                aria-hidden
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-full bg-white shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.08),0_4px_12px_-6px_rgba(11,37,69,0.25)]"
              />
            )}
            <span className="relative">{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}
