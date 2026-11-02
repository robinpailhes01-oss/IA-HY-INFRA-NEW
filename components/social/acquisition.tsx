import Link from "next/link";
import { ArrowRight, Megaphone, Receipt, Tag } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { cn } from "@/lib/utils";
import { formatEur, formatNumber } from "@/lib/format";
import { sourceChannelLabel } from "@/lib/status";
import { dec1, plural, type CanalCategory } from "@/components/social/model";

// ACQUISITION & RENTABILITÉ — l'ancienne page Marketing, condensée.
// Payant contre organique, ce que la pub a coûté et rapporté, et canal par
// canal d'où viennent les clients.

export type AttributionRow = { channel: string; category: CanalCategory; count: number; revenue: number };

// Organique, payant, autre : trois teintes de la gamme maritime, pas de vert.
// Le vert dit « c'est bien » partout ailleurs (variations, ROAS) ; peindre
// l'organique en vert en faisait un jugement plutôt qu'une catégorie.
const CAT: Record<CanalCategory, { label: string; bar: string; pill: string }> = {
  organic: { label: "Organique", bar: "bg-[linear-gradient(90deg,#7cc0f5,#2f7fe0)]", pill: "bg-[rgba(47,127,224,0.1)] text-ocean" },
  paid: { label: "Payant", bar: "bg-[linear-gradient(90deg,#28507f,#0b2545)]", pill: "bg-[rgba(11,37,69,0.08)] text-navy" },
  other: { label: "Autre", bar: "bg-[#c9dcf0]", pill: "bg-[rgba(11,37,69,0.05)] text-ink-2" },
};

function Tile({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="vitre-inset min-w-0 rounded-[18px] px-3.5 py-3">
      <p className="truncate text-[11.5px] text-ink-3">{label}</p>
      <p
        className={cn(
          "n-inline mt-1 truncate text-[19px] tracking-[-0.03em]",
          tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-foreground",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-ink-3">{hint}</p>}
    </div>
  );
}

export function Acquisition({
  rows,
  byCategory,
  adSpend,
  untagged,
}: {
  rows: AttributionRow[];
  byCategory: Record<CanalCategory, { count: number; revenue: number }>;
  adSpend: number;
  untagged: number;
}) {
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const paid = byCategory.paid;
  const roas = adSpend > 0 ? paid.revenue / adSpend : null;
  const cpa = paid.count > 0 && adSpend > 0 ? Math.round(adSpend / paid.count) : null;
  const margin = paid.revenue - adSpend;

  return (
    <div className="flex flex-col gap-5">
      {/* Payant · organique · autre, en une barre */}
      {total > 0 ? (
        <div>
          <div className="flex h-3 w-full gap-1 overflow-hidden rounded-full">
            {(["organic", "paid", "other"] as const).map((k) =>
              byCategory[k].revenue > 0 ? (
                <span
                  key={k}
                  className={cn("h-full rounded-full", CAT[k].bar)}
                  style={{ width: `${(byCategory[k].revenue / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {(["organic", "paid", "other"] as const).map((k) => (
              <div key={k} className="min-w-0">
                <p className="flex items-center gap-1.5 text-[12px] text-ink-2">
                  <span className={cn("size-2 shrink-0 rounded-full", CAT[k].bar)} />
                  {CAT[k].label}
                </p>
                <p className="n-inline mt-1 truncate text-[16px] text-foreground">
                  <Num>{formatEur(byCategory[k].revenue)}</Num>
                </p>
                <p className="truncate text-[11.5px] text-ink-3">
                  {byCategory[k].count} {plural(byCategory[k].count, "réservation", "réservations")}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* La pub, en quatre chiffres */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile label="Budget pub" value={<Num>{formatEur(adSpend)}</Num>} hint="dépenses « Marketing »" />
        <Tile
          label="CA par la pub"
          value={<Num>{formatEur(paid.revenue)}</Num>}
          hint={`${paid.count} ${plural(paid.count, "réservation", "réservations")}`}
        />
        <Tile
          label="ROAS"
          value={roas === null ? "—" : <Num>{`${dec1(roas)} ×`}</Num>}
          hint={roas === null ? "aucune dépense pub" : `1 € investi → ${dec1(roas)} €`}
          tone={roas === null ? undefined : roas >= 1 ? "good" : "bad"}
        />
        <Tile
          label="Coût par réservation"
          value={cpa === null ? "—" : <Num>{formatEur(cpa)}</Num>}
          hint={
            adSpend > 0 ? (
              <>
                marge pub <Num>{`${margin >= 0 ? "+" : "−"}${formatEur(Math.abs(margin))}`}</Num>
              </>
            ) : (
              "sans pub, pas de coût"
            )
          }
        />
      </div>

      {/* Canal par canal */}
      {rows.length === 0 ? (
        <EmptyState icon={<Tag />} title="Aucune réservation attribuée sur la période">
          Renseigne le canal d&apos;acquisition de tes réservations (Instagram, bouche à oreille,
          Meta Ads…) : c&apos;est lui qui permet de savoir ce qui remplit le bateau.
        </EmptyState>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-ink-3">
              <th className="pb-2.5 pr-3 font-medium">Canal</th>
              <th className="hidden pb-2.5 pr-3 font-medium sm:table-cell">Type</th>
              <th className="pb-2.5 pr-3 text-right font-medium">Résa.</th>
              <th className="pb-2.5 pr-3 text-right font-medium">Encaissé</th>
              <th className="hidden pb-2.5 pr-3 text-right font-medium md:table-cell">Panier moyen</th>
              <th className="hidden w-[24%] pb-2.5 text-right font-medium sm:table-cell">Part du CA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const share = total > 0 ? Math.round((r.revenue / total) * 100) : 0;
              return (
                <tr key={r.channel} className="border-t border-[var(--hairline)]">
                  <td className="py-3 pr-3">
                    <span className="block truncate font-medium text-foreground">{sourceChannelLabel(r.channel)}</span>
                    {/* .pastille fixe display : on masque son conteneur, pas elle. */}
                    <span className="mt-1 block sm:hidden">
                      <span className={cn("pastille", CAT[r.category].pill)}>{CAT[r.category].label}</span>
                    </span>
                  </td>
                  <td className="hidden py-3 pr-3 sm:table-cell">
                    <span className={cn("pastille", CAT[r.category].pill)}>{CAT[r.category].label}</span>
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <Num className="n-inline text-ink-2">{formatNumber(r.count)}</Num>
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <Num className="n-inline text-foreground">{formatEur(r.revenue)}</Num>
                  </td>
                  <td className="hidden py-3 pr-3 text-right md:table-cell">
                    <Num className="n-inline text-ink-2">{r.count > 0 ? formatEur(r.revenue / r.count) : "—"}</Num>
                  </td>
                  <td className="hidden py-3 sm:table-cell">
                    <span className="flex items-center justify-end gap-2.5">
                      <span className="h-1.5 w-full max-w-[90px] overflow-hidden rounded-full bg-[rgba(11,37,69,0.06)]">
                        <span className={cn("block h-full rounded-full", CAT[r.category].bar)} style={{ width: `${share}%` }} />
                      </span>
                      <span className="n-inline w-11 shrink-0 whitespace-nowrap text-right text-foreground">{share}&nbsp;%</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {untagged > 0 && (
        <Link
          href="/bookings"
          className="vitre-inset group/untag flex min-h-12 items-center gap-3 rounded-[18px] px-3.5 py-2.5 transition-colors hover:bg-white/80"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[rgba(217,130,43,0.12)] text-warning">
            <Receipt className="size-4" />
          </span>
          <span className="min-w-0 flex-1 text-[13px] text-ink-2">
            <span className="font-semibold text-foreground">
              {untagged} {plural(untagged, "réservation", "réservations")} sans canal
            </span>{" "}
            — à étiqueter pour que l&apos;attribution soit juste.
          </span>
          <ArrowRight className="size-4 shrink-0 text-ink-3 transition-colors group-hover/untag:text-ocean" />
        </Link>
      )}
    </div>
  );
}

export type AdExpense = { id: string; date: string; label: string; amount: number };

export function AdSpendList({
  items,
  total,
  recent,
  year,
}: {
  items: AdExpense[];
  total: number;
  /** Les dernières dépenses connues, toutes périodes confondues — pour situer
   *  un « rien sur la période » (hors saison, c'est fréquent). */
  recent: AdExpense[];
  /** Le budget pub des douze derniers mois, pour l'ordre de grandeur. */
  year: { total: number; count: number };
}) {
  if (items.length === 0 && recent.length === 0) {
    return (
      <EmptyState icon={<Megaphone />} title="Aucune dépense pub enregistrée" className="flex-1 py-7">
        Les dépenses notées dans Finance avec la catégorie « Marketing » apparaissent ici et
        alimentent le ROAS.
      </EmptyState>
    );
  }

  const quiet = items.length === 0;
  const list = quiet ? recent : items.slice(0, 6);

  return (
    <div className="flex flex-1 flex-col">
      {quiet ? (
        // Rien sur la période : on le dit en une ligne, puis on montre les
        // dernières campagnes — une grande case vide n'apprenait rien.
        <div className="vitre-inset flex items-start gap-3 rounded-[18px] px-3.5 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-ocean shadow-[var(--shadow-glass)]">
            <Megaphone className="size-3.5" />
          </span>
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            <span className="block font-semibold text-foreground">Aucune dépense pub sur la période</span>
            ROAS et coût par réservation reprendront avec la prochaine campagne.
          </p>
        </div>
      ) : (
        <p className="flex items-baseline gap-2">
          <Num className="n-kpi text-foreground">{formatEur(total)}</Num>
          <span className="text-[12.5px] text-ink-3">
            {items.length} {plural(items.length, "dépense", "dépenses")}
          </span>
        </p>
      )}

      {quiet && <p className="t-label mt-5 text-ink-2">Dernières dépenses</p>}
      <ul className={cn("flex flex-col", quiet ? "mt-1.5" : "mt-4")}>
        {list.map((e) => (
          <li key={e.id} className="flex items-center gap-3 border-t border-[var(--hairline)] py-2.5 first:border-t-0">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[rgba(47,127,224,0.1)] text-ocean">
              <Megaphone className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">{e.label}</span>
              <span className="block text-[11.5px] text-ink-3">{e.date}</span>
            </span>
            <Num className="n-inline text-[13.5px] text-foreground">{`−${formatEur(e.amount)}`}</Num>
          </li>
        ))}
      </ul>
      {!quiet && items.length > list.length && (
        <p className="mt-1 text-[12px] text-ink-3">+ {items.length - list.length} plus anciennes</p>
      )}

      {year.count > 0 && (
        <p className="mt-auto flex items-baseline justify-between gap-3 border-t border-[var(--hairline)] pt-3.5 text-[12px] text-ink-3">
          <span>Sur 12 mois</span>
          <span>
            <Num className="n-inline text-[13.5px] text-foreground">{formatEur(year.total)}</Num>
            <span className="ml-1.5">
              · {year.count} {plural(year.count, "dépense", "dépenses")}
            </span>
          </span>
        </p>
      )}
    </div>
  );
}
