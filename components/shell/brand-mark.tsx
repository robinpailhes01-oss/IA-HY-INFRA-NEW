import { cn } from "@/lib/utils";

// La marque : l'ancre laiton sur une pastille marine. Le seul endroit où l'or
// de la marque apparaît en permanence — c'est une signature, pas un accent.
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(150deg,#1a4373_0%,#0b2545_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_18px_-8px_rgba(11,37,69,0.7)]",
        className,
      )}
    >
      <svg viewBox="0 0 100 100" className="size-[56%]" aria-hidden="true">
        <g
          fill="none"
          stroke="#D9B865"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="50" cy="22" r="6" />
          <path d="M50 28v54M38 40h24M22 60c0 18 16 22 28 22s28-4 28-22M22 60l-8-4M78 60l8-4" />
        </g>
      </svg>
    </span>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex min-w-0 flex-col leading-none", className)}>
      <span className="truncate text-[15px] font-semibold tracking-[-0.025em] text-foreground">
        Harmonie Yacht
      </span>
      <span className="mt-1 truncate text-[11px] font-medium tracking-[-0.005em] text-ink-3">
        Pilotage · agent IA
      </span>
    </span>
  );
}
