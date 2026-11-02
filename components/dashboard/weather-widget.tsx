import { CloudSun, Sailboat, Sun, Wind } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { cn } from "@/lib/utils";

// La météo marine de Carnon en capsules verticales, comme le défilé horaire
// d'une app météo : un jour = une colonne, lisible d'un balayage. La couleur
// de l'icône porte la note du jour (idéal / correct / déconseillé) ; une
// petite voile marque les jours où une sortie est déjà réservée — c'est là
// que la météo compte vraiment.

export type WeatherDay = {
  date: string;
  rating: string | null;
  wind_speed_kmh: number | null;
  wind_direction: string | null;
  wave_height_m: number | null;
  water_temp_c: number | null;
  swell_m: number | null;
};

const RATING: Record<string, { label: string; icon: React.ReactNode; chip: string; dot: string }> = {
  ideal: { label: "idéal", icon: <Sun />, chip: "bg-[rgba(15,159,110,0.12)] text-success", dot: "bg-success" },
  acceptable: { label: "correct", icon: <CloudSun />, chip: "bg-[rgba(217,130,43,0.13)] text-warning", dot: "bg-warning" },
  discouraged: { label: "déconseillé", icon: <Wind />, chip: "bg-[rgba(224,77,85,0.12)] text-danger", dot: "bg-danger" },
};
const UNKNOWN = { label: "non noté", icon: <CloudSun />, chip: "bg-[rgba(11,37,69,0.06)] text-ink-3", dot: "bg-ink-3" };

const WEEKDAY = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const WEEKDAY_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const dec = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function WeatherWidget({
  days,
  booked = {},
  todayIso,
}: {
  days: WeatherDay[];
  /** Nombre de sorties réservées par date ISO. */
  booked?: Record<string, number>;
  todayIso?: string;
}) {
  if (days.length === 0) {
    return (
      <EmptyState icon={<CloudSun />} title="Prévisions indisponibles">
        La météo marine de Carnon se met à jour chaque matin.
      </EmptyState>
    );
  }

  const today = todayIso ? new Date(`${todayIso}T12:00:00Z`).getTime() : null;

  // Requête de conteneur plutôt que d'écran : la même carte vit dans une
  // colonne étroite (bureau, à droite) ou sur toute la largeur (tablette).
  // Large, elle montre une semaine entière et ses capsules gardent une
  // largeur de pilule au lieu de s'arrondir en gros disques.
  return (
    <div className="@container">
      <ul className="grid grid-cols-5 justify-items-center gap-1.5 sm:gap-2 @lg:grid-cols-7 [&>li:nth-child(n+6)]:hidden @lg:[&>li:nth-child(n+6)]:flex">
        {days.slice(0, 7).map((day) => {
          const r = RATING[day.rating ?? ""] ?? UNKNOWN;
          const d = new Date(`${day.date.slice(0, 10)}T12:00:00Z`);
          const diff = today != null ? Math.round((d.getTime() - today) / 86_400_000) : null;
          const label = diff === 0 ? "Auj." : diff === 1 ? "Dem." : WEEKDAY[d.getUTCDay()];
          const count = booked[day.date.slice(0, 10)] ?? 0;
          const wind = day.wind_speed_kmh != null ? Math.round(day.wind_speed_kmh) : null;
          const desc = [
            `${WEEKDAY_LONG[d.getUTCDay()]} ${d.getUTCDate()} : mer ${r.label}`,
            wind != null ? `vent ${wind} km/h${day.wind_direction ? ` ${day.wind_direction}` : ""}` : null,
            day.wave_height_m != null ? `vagues ${dec(day.wave_height_m)} m` : null,
            count > 0 ? `${count} sortie${count > 1 ? "s" : ""} réservée${count > 1 ? "s" : ""}` : null,
          ]
            .filter(Boolean)
            .join(", ");

          return (
            <li
              key={day.date}
              aria-label={desc}
              className={cn(
                "flex w-full max-w-[84px] flex-col items-center gap-2 rounded-full px-1 py-3.5 text-center",
                diff === 0 ? "bg-white shadow-[var(--shadow-glass)]" : "vitre-inset",
              )}
            >
              <span className="leading-none">
                <span className="block text-[11.5px] font-semibold tracking-[-0.01em] text-foreground">{label}</span>
                <span className="mt-1 block text-[10.5px] text-ink-3">{d.getUTCDate()}</span>
              </span>
              <span className={cn("grid size-8 place-items-center rounded-full [&_svg]:size-4 [&_svg]:stroke-[1.9]", r.chip)}>
                {r.icon}
              </span>
              <span className="leading-none">
                <Num className="n-inline block text-[15px] text-foreground">{wind != null ? String(wind) : "—"}</Num>
                <span className="mt-0.5 block text-[10px] text-ink-3">km/h</span>
              </span>
              <span className="text-[11px] leading-none text-ink-2">
                {day.wave_height_m != null ? <Num>{`${dec(day.wave_height_m)} m`}</Num> : "—"}
              </span>
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full",
                  count > 0 ? "bg-[rgba(34,167,191,0.14)] text-aqua" : "opacity-0",
                )}
                aria-hidden
              >
                <Sailboat className="size-3" />
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11.5px] text-ink-3">
        {(["ideal", "acceptable", "discouraged"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", RATING[k].dot)} />
            {RATING[k].label.charAt(0).toUpperCase() + RATING[k].label.slice(1)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <Sailboat className="size-3 text-aqua" />
          Sortie réservée
        </span>
      </div>
    </div>
  );
}
