"use client";

import { askLea } from "@/components/lea/ask-lea";
import { cn } from "@/lib/utils";

// Une piste du panneau marine qui se TOUCHE : elle ouvre Léa (le widget de la
// coque, branché sur le vrai agent Manager) avec la question déjà posée.
//
// Avant, ces pistes étaient des étiquettes en forme de pilule — exactement la
// forme de tout ce qui se clique dans le tableau de bord. Une pilule qui ne
// fait rien, c'est un faux bouton : soit on lui retire sa forme, soit on lui
// donne un vrai geste. Léa lit les mêmes tables que ces pages : le geste
// existe, on le branche.
//
// 44 px de haut au téléphone (au pouce), 36 px au bureau.
export function LeaPrompt({
  question,
  icon,
  children,
  tone = "default",
  className,
}: {
  /** La question envoyée à Léa, telle que Robin la poserait. */
  question: string;
  /** Icône lucide déjà rendue (frontière serveur/client). */
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** « warn » : une alerte douce (rien de programmé, par exemple). */
  tone?: "default" | "warn";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => askLea(question)}
      title="Demander à Léa"
      className={cn(
        "inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-4 py-2 text-left text-[13px] font-medium leading-tight tracking-[-0.01em] outline-none transition-colors duration-200 focus-visible:ring-4 focus-visible:ring-white/20 sm:min-h-9 sm:px-3.5 sm:py-1.5 sm:text-[12.5px] [&_svg]:size-3.5 [&_svg]:shrink-0",
        tone === "warn"
          ? "border-[#f6c784]/25 bg-[#f6c784]/[0.08] text-[#f8d9a8] hover:bg-[#f6c784]/[0.14] [&_svg]:text-[#f6c784]"
          : "border-white/12 bg-white/[0.07] text-[#e3eefb] hover:bg-white/[0.13] hover:text-white [&_svg]:text-[#9fd0f7]",
        className,
      )}
    >
      {icon}
      <span className="min-w-0">{children}</span>
    </button>
  );
}
