import { cn } from "@/lib/utils";

/**
 * Un état vide n'est pas une erreur : c'est une place réservée. Il dit ce qui
 * apparaîtra ici et, si possible, comment le faire apparaître.
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "vitre-inset flex flex-col items-center justify-center gap-2 rounded-[20px] px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <span className="mb-1 grid size-11 place-items-center rounded-full bg-white text-ocean shadow-[var(--shadow-glass)] [&_svg]:size-5">
          {icon}
        </span>
      )}
      <p className="text-[14px] font-semibold tracking-[-0.015em] text-foreground">{title}</p>
      {children && <p className="max-w-sm text-[13px] leading-relaxed text-ink-2">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
