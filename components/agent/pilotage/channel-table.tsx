import { ChannelLogo } from "@/components/leads/channel-logo";
import { Num } from "@/components/ui/num";
import { channelLabel } from "@/components/agent/channels";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { MessagesSquare } from "lucide-react";

export type ChannelRow = { channel: string; conversations: number; leads: number; qualified: number };

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Performance de Léa par canal — source de vérité : `conversations.channel`
 * (le journal multicanal de l'agent), pas le canal d'acquisition du lead.
 * Un lead venu d'Instagram qui écrit ensuite sur WhatsApp compte pour les
 * deux canaux où Léa lui a parlé.
 *
 * Le taux = leads qualifiés (qualifié, devis envoyé, réservé) / leads du canal.
 */
export function ChannelTable({ rows, totals }: { rows: ChannelRow[]; totals: Omit<ChannelRow, "channel"> }) {
  if (rows.length === 0) {
    return (
      <EmptyState icon={<MessagesSquare />} title="Aucune conversation enregistrée">
        Les statistiques par canal apparaîtront dès que Léa aura parlé à ses premiers clients.
      </EmptyState>
    );
  }
  const best = Math.max(...rows.map((r) => pct(r.qualified, r.leads)));

  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-ink-3">
          <th className="pb-2.5 pr-3 font-medium">Canal</th>
          <th className="pb-2.5 pr-3 text-right font-medium">Conv.</th>
          <th className="hidden pb-2.5 pr-3 text-right font-medium sm:table-cell">Leads</th>
          <th className="hidden pb-2.5 pr-3 text-right font-medium sm:table-cell">Qualifiés</th>
          <th className="w-[38%] pb-2.5 text-right font-medium sm:w-[30%]">Taux</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => {
          const label = channelLabel(c.channel);
          const rate = pct(c.qualified, c.leads);
          return (
            <tr key={c.channel} className="border-t border-[var(--hairline)]">
              <td className="py-3 pr-3">
                <span className="flex items-center gap-2.5 font-medium text-foreground">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white shadow-[var(--shadow-glass)] text-ink-2">
                    <ChannelLogo channel={c.channel === "autre" ? null : c.channel} className="size-4" />
                  </span>
                  {label}
                </span>
              </td>
              <td className="py-3 pr-3 text-right">
                <Num className="n-inline text-foreground">{formatNumber(c.conversations)}</Num>
              </td>
              <td className="hidden py-3 pr-3 text-right sm:table-cell">
                <Num className="n-inline text-ink-2">{formatNumber(c.leads)}</Num>
              </td>
              <td className="hidden py-3 pr-3 text-right sm:table-cell">
                <Num className="n-inline text-ink-2">{formatNumber(c.qualified)}</Num>
              </td>
              <td className="py-3">
                <span className="flex items-center justify-end gap-2.5">
                  <span className="hidden h-1.5 w-full max-w-[90px] overflow-hidden rounded-full bg-[rgba(11,37,69,0.06)] min-[420px]:block">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${rate}%`,
                        background: rate === best ? "#0f9f6e" : "#2f7fe0",
                      }}
                    />
                  </span>
                  <span className={rate === best ? "n-inline w-10 text-right text-success" : "n-inline w-10 text-right text-foreground"}>
                    {rate} %
                  </span>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t border-[var(--hairline-strong)] font-semibold">
          <td className="pt-3 pr-3 text-foreground">Total</td>
          <td className="pt-3 pr-3 text-right">
            <Num className="n-inline text-foreground">{formatNumber(totals.conversations)}</Num>
          </td>
          <td className="hidden pt-3 pr-3 text-right sm:table-cell">
            <Num className="n-inline text-foreground">{formatNumber(totals.leads)}</Num>
          </td>
          <td className="hidden pt-3 pr-3 text-right sm:table-cell">
            <Num className="n-inline text-foreground">{formatNumber(totals.qualified)}</Num>
          </td>
          <td className="pt-3 text-right">
            <span className="n-inline text-foreground">{pct(totals.qualified, totals.leads)} %</span>
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
