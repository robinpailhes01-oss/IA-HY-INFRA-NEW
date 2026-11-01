import { cn } from "@/lib/utils";

// L'orbe de Léa sans WebGL : affichée pendant le chargement du moteur 3D,
// quand le navigateur ne sait pas faire de WebGL, ou quand le système
// demande moins d'animations. Même lumière (haut-gauche), même cœur océan,
// pour qu'on ne voie pas la bascule.
export function LeaOrbFallback({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative block aspect-square rounded-full",
        "bg-[radial-gradient(circle_at_32%_26%,#ffffff_0%,rgba(255,255,255,0.85)_12%,rgba(220,235,250,0.55)_34%,rgba(124,192,245,0.55)_62%,rgba(47,127,224,0.75)_100%)]",
        "shadow-[inset_0_-6px_14px_rgba(11,37,69,0.25),inset_0_4px_10px_rgba(255,255,255,0.9)]",
        className,
      )}
    >
      <span className="absolute inset-[24%] rounded-full bg-[radial-gradient(circle_at_40%_35%,#9fd0f7,#2f7fe0_60%,#0b2545)] opacity-80 blur-[1px]" />
      <span className="absolute left-[18%] top-[12%] h-[22%] w-[34%] rotate-[-24deg] rounded-full bg-white/80 blur-[2px]" />
    </span>
  );
}
