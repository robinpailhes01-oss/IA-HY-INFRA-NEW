import { cn } from "@/lib/utils";

// L'avatar d'un contact : ses initiales sur une pastille de glace, et en bas à
// droite un petit badge (logo du canal, point d'état). Pas de couleur par
// personne : sur un tableau de bord, une teinte doit vouloir dire quelque
// chose — ici, c'est le badge qui parle.
//
// Sans hook : utilisable depuis un composant serveur comme client.
const SIZES = {
  sm: "size-9 text-[12px]",
  md: "size-11 text-[13.5px]",
  lg: "size-14 text-[17px]",
} as const;

export function ContactAvatar({
  initials,
  size = "md",
  tone = "ice",
  badge,
  className,
}: {
  initials: string;
  size?: keyof typeof SIZES;
  /** `navy` pour le contact sélectionné ou mis en avant. */
  tone?: "ice" | "navy";
  /** Élément déjà rendu (logo de canal, point d'état). */
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-grid shrink-0", className)}>
      <span
        aria-hidden
        className={cn(
          "grid place-items-center rounded-full font-semibold tracking-[-0.02em]",
          SIZES[size],
          tone === "navy"
            ? "bg-[linear-gradient(155deg,#1d4c84,#0b2545)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_14px_-8px_rgba(11,37,69,0.7)]"
            : "bg-[linear-gradient(160deg,#f1f7fe,#d9e9fa)] text-navy shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(11,37,69,0.05)]",
        )}
      >
        {initials}
      </span>
      {badge && (
        <span className="absolute -bottom-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full bg-white shadow-[0_0_0_1px_rgba(11,37,69,0.06),0_2px_4px_rgba(11,37,69,0.08)] [&_svg]:size-[11px]">
          {badge}
        </span>
      )}
    </span>
  );
}
