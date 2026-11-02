import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

// Le « ↗ » d'en-tête de carte : un cercle de verre, comme dans les autres
// espaces (Réseaux sociaux, Finance). Un contrôle icône est un cercle
// (docs/DESIGN.md §3) — le libellé passe dans aria-label et title, la carte
// dit déjà de quoi il s'agit. 44 px sous le pouce, 36 px à la souris.
export function CardLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="grid size-11 place-items-center rounded-full bg-white/80 text-ink-2 shadow-[var(--shadow-glass)] outline-none transition-colors hover:text-ocean focus-visible:ring-4 focus-visible:ring-ocean/20 lg:size-9"
    >
      <ArrowUpRight className="size-4" />
    </Link>
  );
}
