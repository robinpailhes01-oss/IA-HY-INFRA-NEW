import { Num } from "@/components/ui/num";
import { formatNumber } from "@/lib/format";
import { STAGE_TONE } from "@/components/agent/stages";
import type { LeadStatus } from "@/lib/leads";

const FLOW: LeadStatus[] = ["new", "contacted", "qualified", "quote_sent", "followed_up", "booked"];

/**
 * Où en sont les leads, étape par étape : une barre par statut, de la
 * première prise de contact à la réservation. Les perdus sont mis à part —
 * ce n'est pas une étape, c'est une sortie.
 *
 * Composant SERVEUR (barres en CSS) ; la largeur est relative à l'étape la
 * plus remplie, pas au total : sinon un pipeline de 60 leads donne six
 * barres minuscules.
 */
export function PipelineBars({ counts }: { counts: Record<string, number> }) {
  const max = Math.max(1, ...FLOW.map((s) => counts[s] ?? 0));
  const lost = counts.lost ?? 0;

  return (
    <div className="flex flex-col gap-3.5">
      <ul className="flex flex-col gap-3">
        {FLOW.map((status) => {
          const n = counts[status] ?? 0;
          const tone = STAGE_TONE[status];
          return (
            <li key={status}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                  <span className="size-2 rounded-full" style={{ background: tone.color }} />
                  {tone.label}
                </span>
                <Num className="n-inline text-[13.5px] text-foreground">{formatNumber(n)}</Num>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[rgba(11,37,69,0.06)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${n > 0 ? Math.max(4, (n / max) * 100) : 0}%`,
                    background: `linear-gradient(90deg, ${tone.color}b3, ${tone.color})`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] pt-3 text-[12.5px]">
        <span className="flex items-center gap-2 text-ink-2">
          <span className="size-2 rounded-full" style={{ background: STAGE_TONE.lost.color }} />
          Perdus, mis à part
        </span>
        <Num className="n-inline text-ink-2">{formatNumber(lost)}</Num>
      </div>
    </div>
  );
}
