import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Landmark, PlugZap } from "lucide-react";

import { Num } from "@/components/ui/num";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { hoursSince, pct, shortDate, sinceLabel } from "@/components/finance/fin-utils";
import { TreasuryChart } from "@/components/finance/treasury-chart";

// LA TRÉSORERIE — le chiffre héros de la page Finance, le seul en dégradé.
//
// Trésorerie = solde Qonto + caisse espèces, exactement la formule de
// finance-pulse : le chiffre qu'affiche cette carte est celui sur lequel Léa
// calcule l'autonomie. La courbe vient des photos quotidiennes
// (financial_snapshots), pas d'une reconstitution : ce que la banque disait
// vraiment chaque matin.
//
// Un solde sans date ne vaut rien : la carte dit toujours d'où vient le
// chiffre et quand il a été relevé (pied de carte).

export type SyncSource = {
  name: string;
  /** Dernière synchro réussie (ISO), null si jamais. */
  syncedAt: string | null;
  error: string | null;
};

function SyncDot({ source, now }: { source: SyncSource; now: Date }) {
  const h = hoursSince(source.syncedAt, now);
  // Les synchros tournent au moins une fois par jour : au-delà de 26 h,
  // quelque chose s'est arrêté.
  const tone = source.error ? "danger" : h > 26 ? "warning" : "ok";
  const text = source.error
    ? "erreur de synchro"
    : source.syncedAt
      ? `synchronisé ${sinceLabel(source.syncedAt, now)}`
      : "jamais synchronisé";
  return (
    <li className="flex min-w-0 items-center gap-1.5" title={source.error ?? undefined}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "ok" && "bg-success shadow-[0_0_0_3px_rgba(15,159,110,0.14)]",
          tone === "warning" && "bg-warning shadow-[0_0_0_3px_rgba(217,130,43,0.16)]",
          tone === "danger" && "bg-danger shadow-[0_0_0_3px_rgba(224,77,85,0.16)]",
        )}
      />
      <span className="truncate">
        <span className="font-medium text-ink-2">{source.name}</span>
        <span className={cn(tone === "ok" ? "text-ink-3" : tone === "warning" ? "text-warning" : "text-danger")}>
          {" "}
          · {text}
        </span>
      </span>
    </li>
  );
}

export function TreasuryCard({
  bank,
  cash,
  cashLastDate,
  trend,
  delta30,
  syncs,
  className,
}: {
  /** Somme des comptes Qonto ouverts ; null tant que la banque n'est pas connectée. */
  bank: number | null;
  cash: number;
  cashLastDate: string | null;
  /** Trésorerie de chaque photo quotidienne, de la plus ancienne à la plus récente. */
  trend: Array<{ label: string; a: number }>;
  /** Écart avec la photo d'il y a ~30 jours. */
  delta30: number | null;
  syncs: SyncSource[];
  className?: string;
}) {
  const now = new Date();
  const connected = bank !== null;
  const treasury = (bank ?? 0) + cash;
  const bankShare = connected ? pct(Math.max(bank, 0), Math.max(bank, 0) + Math.max(cash, 0)) : 0;

  return (
    <section
      aria-labelledby="treasury-title"
      className={cn("vitre rise flex flex-col overflow-hidden rounded-[24px]", className)}
    >
      <div className="relative z-[1] px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[rgba(47,127,224,0.1)] text-ocean">
              <Landmark className="size-[17px]" strokeWidth={1.8} />
            </span>
            <h2 id="treasury-title" className="t-label text-ink-2">
              {connected ? "Trésorerie réelle" : "Caisse espèces"}
            </h2>
          </div>
          {connected && delta30 !== null && Math.round(delta30) !== 0 && (
            <span
              className={cn(
                "pastille shrink-0",
                delta30 > 0 ? "bg-[rgba(15,159,110,0.1)] text-success" : "bg-[rgba(224,77,85,0.1)] text-danger",
              )}
            >
              {delta30 > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              <Num>{`${delta30 > 0 ? "+" : "−"}${formatEur(Math.abs(delta30))}`}</Num>
              <span className="font-normal opacity-80">en 30 j</span>
            </span>
          )}
        </div>

        <Num className="n-hero n-gradient mt-5 block w-fit pb-1">{formatEur(connected ? treasury : cash)}</Num>

        {connected ? (
          <>
            {/* Les deux poches : la banque et la caisse. */}
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <dt className="t-label flex items-center gap-1.5 text-ink-3">
                  <span aria-hidden className="size-2 rounded-full bg-ocean" />
                  Qonto
                </dt>
                <dd className="mt-1">
                  <Num className="n-inline text-[16px] text-foreground">{formatEur(bank)}</Num>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="t-label flex items-center gap-1.5 text-ink-3">
                  <span aria-hidden className="size-2 rounded-full bg-sky" />
                  Caisse espèces
                </dt>
                <dd className="mt-1">
                  <Num className="n-inline text-[16px] text-foreground">{formatEur(cash)}</Num>
                </dd>
              </div>
            </dl>
            <div aria-hidden className="mt-3 flex h-1.5 gap-[3px] overflow-hidden rounded-full">
              <span className="h-full rounded-full bg-[linear-gradient(90deg,#1f5aa6,#2f7fe0)]" style={{ width: `${bankShare}%` }} />
              <span className="h-full flex-1 rounded-full bg-sky/80" />
            </div>
          </>
        ) : (
          <div className="vitre-inset mt-4 flex items-start gap-3 rounded-[18px] p-3.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-warning shadow-[var(--shadow-glass)]">
              <PlugZap className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-foreground">Qonto n&apos;est pas connecté</p>
              <p className="t-caption mt-0.5 text-ink-2">
                Sans le solde bancaire, la trésorerie n&apos;est pas calculée : seule la caisse est connue.
              </p>
              <Link
                href="/settings"
                className="mt-2 inline-flex h-9 items-center rounded-full bg-white px-3.5 text-[12.5px] font-medium text-ocean shadow-[var(--shadow-glass)] outline-none hover:text-navy focus-visible:ring-4 focus-visible:ring-ocean/20"
              >
                Voir les connexions
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* La courbe : ce que la banque disait chaque matin. */}
      <div className="relative z-[1] mt-5 flex-1 px-2 sm:px-3">
        {trend.length > 1 ? (
          <>
            <p className="t-caption px-3 text-ink-3">Chaque matin, sur {trend.length} jours</p>
            <div className="mt-2 px-1.5">
              <TreasuryChart data={trend} height={130} />
            </div>
          </>
        ) : (
          <p className="t-caption mx-3 mb-2 rounded-[16px] bg-white/50 px-3 py-2.5 text-ink-3">
            La courbe se dessinera au fil des photos quotidiennes de Léa.
          </p>
        )}
      </div>

      <ul className="relative z-[1] mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[var(--hairline)] bg-white/40 px-5 py-3 text-[12px] sm:px-6">
        {syncs.map((s) => (
          <SyncDot key={s.name} source={s} now={now} />
        ))}
        <li className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-sky" />
          <span className="truncate">
            <span className="font-medium text-ink-2">Caisse</span>
            <span className="text-ink-3">
              {" "}
              · {cashLastDate ? `dernier mouvement le ${shortDate(cashLastDate)}` : "aucun mouvement saisi"}
            </span>
          </span>
        </li>
      </ul>
    </section>
  );
}
