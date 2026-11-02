import { CalendarDays } from "lucide-react";

import { SignaturePanel } from "@/components/dashboard/signature-panel";
import { Num } from "@/components/ui/num";
import { AskLeaButton } from "@/components/finance/ask-lea-button";
import { BriefTile } from "@/components/finance/brief-tile";
import { JOURS, MOIS_LONG, noonUtc, plural } from "@/components/finance/fin-utils";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

// LE POINT DE LÉA sur les réservations — le panneau marine de la page.
//
// Pas de chiffre héros ici : l'argent à encaisser a sa carte à lui, juste
// en dessous. Le panneau dit ce qui demande un geste — le planning, les
// acomptes à réclamer, les soldes passés jamais saisis — en une phrase
// déterministe : mêmes données, même phrase.

type Seg = string | { em: string };

function Sentence({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, i) => (typeof s === "string" ? <span key={i}>{s}</span> : <em key={i}>{s.em}</em>))}
    </>
  );
}

export function BookingsBrief({
  upcomingCount,
  thisWeekCount,
  next,
  depositsDue,
  late,
  className,
}: {
  upcomingCount: number;
  thisWeekCount: number;
  next: { date: string; startTime: string | null; offerName: string | null; customerName: string } | null;
  depositsDue: { count: number; amount: number };
  late: { count: number; amount: number };
  className?: string;
}) {
  const first: Seg[] =
    upcomingCount === 0
      ? ["Aucune sortie au ", { em: "planning" }, " pour l'instant."]
      : [
          { em: `${upcomingCount} ${plural(upcomingCount, "sortie", "sorties")}` },
          " au planning",
          ...(thisWeekCount > 0 ? [", dont ", { em: String(thisWeekCount) }, " dans les 7 jours."] : ["."]),
        ];

  // Ce qui demande un geste : les acomptes à réclamer ET les soldes passés
  // jamais saisis. Les deux peuvent coexister — n'en nommer qu'un laissait
  // croire que l'autre était à jour.
  const lateSegs: Seg[] = [{ em: `${late.count} ${plural(late.count, "solde passé", "soldes passés")}` }, " à régulariser."];
  const second: Seg[] | null =
    depositsDue.count > 0
      ? [
          { em: `${depositsDue.count} ${plural(depositsDue.count, "acompte", "acomptes")}` },
          ` ${plural(depositsDue.count, "reste", "restent")} à réclamer`,
          ...(late.count > 0 ? [", et ", ...lateSegs] : ["."]),
        ]
      : late.count > 0
        ? lateSegs
        : upcomingCount > 0
          ? ["Tous les acomptes sont payés."]
          : null;

  let nextLine: string | null = null;
  if (next) {
    const d = noonUtc(next.date);
    const hour = next.startTime ? ` à ${Number(next.startTime.slice(0, 2))} h${next.startTime.slice(3, 5) !== "00" ? next.startTime.slice(3, 5) : ""}` : "";
    nextLine = `Prochaine sortie ${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS_LONG[d.getUTCMonth()]}${hour} — ${next.offerName ?? "sortie"} pour ${next.customerName}.`;
  }

  return (
    <SignaturePanel
      className={cn("rise", className)}
      eyebrow={
        <span className="inline-flex items-center gap-2">
          <span className="grid size-[22px] place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#7cc0f5_0%,#2f7fe0_55%,#13355e_100%)] shadow-[0_0_0_3px_rgba(124,192,245,0.14),0_4px_12px_-4px_rgba(47,127,224,0.8)]">
            <CalendarDays className="size-3 text-white" strokeWidth={2} />
          </span>
          Le point de Léa
        </span>
      }
      action={
        <AskLeaButton
          tone="dark"
          question="Quels acomptes et quels soldes dois-je relancer, et auprès de qui ?"
          label="Qui relancer ?"
          shortLabel="Relances"
        />
      }
    >
      <h2 className="sr-only">Le point sur les réservations</h2>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end lg:gap-8">
        <div className="min-w-0">
          <p className="t-panel max-w-[34rem] text-white [&_em]:text-[#9fd0f7]">
            <Sentence segs={first} />
            {second && (
              <>
                {" "}
                <Sentence segs={second} />
              </>
            )}
          </p>
          {nextLine && <p className="t-body mt-3 max-w-[36rem] text-[#a9c3e0]">{nextLine}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <BriefTile label="Sous 7 jours" value={thisWeekCount} detail={plural(thisWeekCount, "sortie", "sorties")} />
          <BriefTile
            label="Acomptes"
            value={depositsDue.count}
            detail={depositsDue.count > 0 ? <><Num>{formatEur(depositsDue.amount)}</Num> dus</> : "tous payés"}
            alert={depositsDue.count > 0}
          />
          <BriefTile
            label="En retard"
            value={late.count}
            detail={late.count > 0 ? <><Num>{formatEur(late.amount)}</Num> dus</> : "à jour"}
            alert={late.count > 0}
          />
        </div>
      </div>
    </SignaturePanel>
  );
}
