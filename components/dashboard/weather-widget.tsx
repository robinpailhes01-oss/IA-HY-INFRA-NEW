import { Droplets, Thermometer, Waves, Wind } from "lucide-react";

import { formatDateRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export type WeatherDay = {
  date: string;
  rating: string | null;
  wind_speed_kmh: number | null;
  wind_direction: string | null;
  wave_height_m: number | null;
  water_temp_c: number | null;
  swell_m: number | null;
};

const RATING: Record<string, { label: string; dot: string; text: string }> = {
  ideal: { label: "Idéal", dot: "bg-success", text: "text-success" },
  acceptable: { label: "Acceptable", dot: "bg-warning", text: "text-warning" },
  discouraged: { label: "Déconseillé", dot: "bg-danger", text: "text-danger" },
};

function ratingOf(rating: string | null) {
  return RATING[rating ?? ""] ?? { label: "—", dot: "bg-muted-foreground", text: "text-muted-foreground" };
}

export function WeatherWidget({ days }: { days: WeatherDay[] }) {
  if (days.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune prévision disponible pour le moment.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {days.map((day) => {
        const r = ratingOf(day.rating);
        return (
          <div
            key={day.date}
            className="flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium capitalize text-foreground">
                {formatDateRelative(day.date)}
              </span>
              <span className={cn("size-2 rounded-full", r.dot)} />
            </div>
            <span className={cn("text-xs font-medium", r.text)}>{r.label}</span>
            <dl className="mt-1 space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Wind className="size-3.5 shrink-0" />
                <span>
                  {Math.round(day.wind_speed_kmh ?? 0)} km/h
                  {day.wind_direction ? ` ${day.wind_direction}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Waves className="size-3.5 shrink-0" />
                <span>{(day.wave_height_m ?? 0).toFixed(1)} m</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Droplets className="size-3.5 shrink-0" />
                <span>Houle {(day.swell_m ?? 0).toFixed(1)} m</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Thermometer className="size-3.5 shrink-0" />
                <span>{Math.round(day.water_temp_c ?? 0)}°C</span>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}
