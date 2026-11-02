import { CalendarClock, CloudSun, Sun, Users, Wind } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { formatEur, formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";

// Les prochaines sorties, en carnet de bord : la date en tuile, l'offre, le
// client, le montant — et la météo marine du jour quand elle est connue.
// Croiser les deux ici évite d'aller vérifier la météo sortie par sortie.
//
// Un seul signal par ligne au plus (« À confirmer », « Acompte dû ») : une
// sortie confirmée et payée n'a besoin d'aucune étiquette, c'est l'état normal.

export type UpcomingBooking = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  offerName: string | null;
  customerName: string;
  partySize: number | null;
  amount: number | null;
  status: string | null;
  depositPaid?: boolean | null;
};

/** Note météo du jour (weather_cache), indexée par date ISO. */
export type DayWeather = { rating: string | null; wind: number | null };

const RATING: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  ideal: { label: "Mer idéale", icon: <Sun />, cls: "bg-[rgba(15,159,110,0.1)] text-success" },
  acceptable: { label: "Mer correcte", icon: <CloudSun />, cls: "bg-[rgba(217,130,43,0.11)] text-warning" },
  // « Mer déconseillée », pas « Déconseillé » seul : c'est la mer qui l'est,
  // pas la sortie — et le brief de Léa emploie les mêmes mots.
  discouraged: { label: "Mer déconseillée", icon: <Wind />, cls: "bg-[rgba(224,77,85,0.1)] text-danger" },
};

const WEEKDAY = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTH = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function UpcomingBookings({
  bookings,
  weather = {},
  todayIso,
}: {
  bookings: UpcomingBooking[];
  weather?: Record<string, DayWeather>;
  /** Pour marquer « aujourd'hui » / « demain ». */
  todayIso?: string;
}) {
  if (bookings.length === 0) {
    return (
      <EmptyState icon={<CalendarClock />} title="Aucune sortie au planning">
        Les prochaines réservations s&apos;afficheront ici, avec la météo marine du jour.
      </EmptyState>
    );
  }

  const today = todayIso ? new Date(`${todayIso}T12:00:00Z`).getTime() : null;

  return (
    <ul className="space-y-1">
      {bookings.map((b) => {
        // Midi UTC : le jour affiché ne bascule pas avec le fuseau du serveur.
        const d = new Date(`${b.date.slice(0, 10)}T12:00:00Z`);
        const diff = today != null ? Math.round((d.getTime() - today) / 86_400_000) : null;
        const soon = diff === 0 || diff === 1;
        const time = formatTimeRange(b.startTime, b.endTime);
        const w = weather[b.date.slice(0, 10)];
        const rating = w?.rating ? RATING[w.rating] : undefined;
        const flag =
          b.status === "pending"
            ? { label: "À confirmer", cls: "bg-[rgba(217,130,43,0.11)] text-warning" }
            : b.depositPaid === false
              ? { label: "Acompte dû", cls: "bg-[rgba(217,130,43,0.11)] text-warning" }
              : null;

        return (
          <li key={b.id} className="flex items-center gap-3 rounded-[18px] py-2.5">
            <div
              className={cn(
                "flex h-[58px] w-12 shrink-0 flex-col items-center justify-center rounded-[16px] text-center",
                soon
                  ? "border border-[rgba(47,127,224,0.18)] bg-[rgba(47,127,224,0.1)] text-ocean"
                  : "vitre-inset text-foreground",
              )}
            >
              <span className={cn("text-[10.5px] font-medium leading-none", soon ? "text-ocean" : "text-ink-3")}>
                {diff === 0 ? "auj." : diff === 1 ? "dem." : WEEKDAY[d.getUTCDay()]}
              </span>
              <span className="n-inline mt-1 text-[18px] leading-none">{d.getUTCDate()}</span>
              <span className={cn("mt-1 text-[10px] leading-none", soon ? "text-ocean/80" : "text-ink-3")}>
                {MONTH[d.getUTCMonth()]}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                  {b.offerName?.replace(/\s*\(.*?\)/, "") ?? "Sortie"}
                </p>
                {b.amount != null && b.amount > 0 && (
                  <Num className="n-inline shrink-0 text-[14px] text-foreground">{formatEur(b.amount)}</Num>
                )}
              </div>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-ink-2">
                {time && <span className="shrink-0 tabular-nums">{time}</span>}
                {time && <span className="text-ink-3">·</span>}
                <span className="truncate">{b.customerName}</span>
                {b.partySize ? (
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-ink-3">
                    <Users className="size-3" />
                    {b.partySize}
                  </span>
                ) : null}
              </p>
              {(rating || flag) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {rating && (
                    <span className={cn("pastille [&_svg]:size-3", rating.cls)}>
                      {rating.icon}
                      {rating.label}
                      {w?.wind != null && w.rating === "discouraged" ? ` · ${Math.round(w.wind)} km/h` : ""}
                    </span>
                  )}
                  {flag && <span className={cn("pastille", flag.cls)}>{flag.label}</span>}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
