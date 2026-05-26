import { CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateRelative, formatEur, formatTimeRange } from "@/lib/format";

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
};

const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  confirmed: { label: "Confirmée", variant: "default" },
  pending: { label: "En attente", variant: "secondary" },
  completed: { label: "Terminée", variant: "outline" },
  cancelled: { label: "Annulée", variant: "destructive" },
};

export function UpcomingBookings({ bookings }: { bookings: UpcomingBooking[] }) {
  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
        <CalendarClock className="size-6 text-muted-foreground/60" />
        Aucune réservation à venir.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {bookings.map((b) => {
        const status = STATUS[b.status ?? ""] ?? {
          label: b.status ?? "—",
          variant: "outline" as const,
        };
        const time = formatTimeRange(b.startTime, b.endTime);
        return (
          <li key={b.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-center">
              <span className="text-[11px] font-medium capitalize leading-none text-muted-foreground">
                {formatDateRelative(b.date).split(" ")[0]}
              </span>
              <span className="text-sm font-semibold leading-tight text-foreground">
                {new Date(b.date).getDate()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {b.offerName ?? "Réservation"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {b.customerName}
                {b.partySize ? ` · ${b.partySize} pers.` : ""}
                {time ? ` · ${time}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold text-foreground">
                {formatEur(b.amount)}
              </span>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
