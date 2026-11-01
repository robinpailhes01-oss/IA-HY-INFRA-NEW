import { cn } from "@/lib/utils";

// LE panneau qui porte l'attention de l'écran — un seul par page.
//
// Tout le tableau de bord est clair ; celui-ci est le marine des grands fonds,
// traversé d'une lumière d'aurore (.vitre-signature). C'est l'endroit où
// parle l'agent IA : son brief, sa recommandation, sa prochaine action.
// L'inversion est volontaire — c'est le seul élément autorisé à rompre.
export function SignaturePanel({
  eyebrow,
  title,
  action,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("vitre-signature rounded-[28px] p-6 sm:p-7", className)}>
      {(eyebrow || title || action) && (
        <div className="relative mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="t-eyebrow mb-2 text-[#9fc6ee]">{eyebrow}</p>}
            {title && <h2 className="t-panel text-white">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      <div className="relative">{children}</div>
    </section>
  );
}
