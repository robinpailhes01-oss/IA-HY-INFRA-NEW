"use client";

import { cn } from "@/lib/utils";

// Contrôle segmenté façon iOS : l'indicateur est une pastille qui GLISSE d'un
// segment à l'autre plutôt qu'un fond qui s'allume. Le mouvement fait tout —
// sans lui c'est une rangée de boutons.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div
      role="tablist"
      className={cn(
        "relative inline-flex rounded-full border border-white/90 bg-[rgba(11,37,69,0.045)] p-[3px] shadow-[inset_0_1px_2px_rgba(11,37,69,0.05)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-[3px] rounded-full bg-white shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.08),0_4px_12px_-6px_rgba(11,37,69,0.25)] transition-[transform,width] duration-[420ms] [transition-timing-function:var(--ease-ios)]"
        style={{
          width: `calc((100% - 6px) / ${options.length})`,
          transform: `translateX(calc(${index} * 100%))`,
          left: 3,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-10 flex-1 whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium tracking-[-0.01em] transition-colors duration-200",
            o.value === value ? "text-foreground" : "text-ink-2 hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
