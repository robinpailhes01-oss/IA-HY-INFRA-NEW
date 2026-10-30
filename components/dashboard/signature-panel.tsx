import { cn } from "@/lib/utils";

// LE panneau qui porte l'attention de l'écran. Un seul par page.
//
// En thème sombre il est CLAIR : un panneau sombre sur fond sombre se fond et
// perd exactement le rôle qu'on lui donne. L'inversion est volontaire — c'est
// le seul élément autorisé à rompre avec le reste.
export function SignaturePanel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("vitre-signature rounded-[22px] p-6", className)}>
      <div className="relative mb-5 flex items-baseline justify-between gap-3">
        <h2 className="display-md text-[#06121F]">{title}</h2>
        {action}
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}
