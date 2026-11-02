import { cn } from "@/lib/utils";
import { scoreTone } from "@/components/agent/stages";

// Le score est la seule donnée qu'on lit d'un coup d'œil sans la lire : dix
// segments, remplis jusqu'à la valeur. Plus rapide qu'un nombre.
export function ScoreMeter({ score, className }: { score: number; className?: string }) {
  const tone = scoreTone(score);
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      title={`Score d'intérêt : ${score}/10`}
    >
      <span className="flex gap-[3px]" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="h-3.5 w-[5px] rounded-full"
            style={{ background: i < score ? tone.bar : "rgba(11,37,69,0.09)" }}
          />
        ))}
      </span>
      <span className="text-[12px] font-semibold tabular-nums text-foreground">
        {score}
        <span className="font-medium text-ink-3">/10</span>
      </span>
    </span>
  );
}

/** Pastille ronde du score, pour les cartes et les lignes. */
export function ScoreChip({ score, size = "md" }: { score: number | null; size?: "sm" | "md" }) {
  const tone = scoreTone(score);
  return (
    <span
      title="Score d'intérêt"
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold tabular-nums",
        size === "sm" ? "size-7 text-[11.5px]" : "size-8 text-[12.5px]",
        tone.chip,
      )}
    >
      {score ?? "–"}
    </span>
  );
}
