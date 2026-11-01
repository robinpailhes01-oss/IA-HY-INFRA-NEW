import { cn } from "@/lib/utils";

/**
 * L'en-tête de page, identique partout : sur-titre, titre en serif (une seule
 * fois par écran), une phrase, puis les actions à droite.
 *
 * `title` accepte du JSX : un mot en <em> passe en italique océan —
 * « Agent <em>WhatsApp</em> ». Un seul mot par titre, sinon l'effet s'use.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "rise flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="t-eyebrow mb-2.5 text-ink-3">{eyebrow}</p>}
        <h1 className="t-page text-foreground">{title}</h1>
        {description && (
          <p className="t-body mt-2 max-w-2xl text-ink-2">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      )}
    </header>
  );
}
