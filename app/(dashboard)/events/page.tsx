import { CalendarDays, Euro, Ticket, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateLong, formatEur, formatTimeRange } from "@/lib/format";
import { AddEventDialog } from "@/components/events/add-event-dialog";
import { EventBookingsDialog } from "@/components/events/event-bookings-dialog";

type EventRow = {
  id: string;
  title: string;
  theme: string | null;
  description: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  price_per_person: number | null;
  max_participants: number | null;
  current_bookings: number | null;
  total_revenue: number | null;
  status: string | null;
  sumup_payment_link: string | null;
};

type BookingRow = {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  party_size: number | null;
  total_paid: number | null;
  payment_status: string | null;
  created_at: string | null;
};

export default async function EventsPage() {
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [eventsRes, bookingsRes] = await Promise.all([
    supabase
      .from("events_public")
      .select("id, title, theme, description, date, start_time, end_time, price_per_person, max_participants, current_bookings, total_revenue, status, sumup_payment_link")
      .neq("status", "cancelled")
      .order("date", { ascending: true })
      .returns<EventRow[]>(),
    supabase
      .from("event_bookings")
      .select("id, event_id, first_name, last_name, email, phone, party_size, total_paid, payment_status, created_at")
      .order("created_at", { ascending: false })
      .returns<BookingRow[]>(),
  ]);

  const events = eventsRes.data ?? [];
  const bookings = bookingsRes.data ?? [];

  const upcoming = events.filter((e) => e.date >= todayIso);
  const totalSeats = upcoming.reduce((s, e) => s + (e.current_bookings ?? 0), 0);
  const totalRevenue = upcoming.reduce((s, e) => s + Number(e.total_revenue ?? 0), 0);

  const bookingsByEvent = bookings.reduce<Record<string, BookingRow[]>>((acc, b) => {
    if (!acc[b.event_id]) acc[b.event_id] = [];
    acc[b.event_id].push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header className="enter-up flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Événements</h1>
          <p className="text-sm text-muted-foreground">
            {upcoming.length} événement{upcoming.length !== 1 ? "s" : ""} à venir
          </p>
        </div>
        <AddEventDialog />
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Événements à venir" value={upcoming.length} icon={CalendarDays} accent="primary" index={0} />
        <KpiCard label="Places réservées" value={totalSeats} icon={Users} accent="info" index={1} />
        <KpiCard label="CA événements" value={totalRevenue} format="eur" icon={Euro} accent="success" index={2} />
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aucun événement. Crée le premier avec le bouton ci-dessus.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {events.map((ev, i) => {
            const evBookings = bookingsByEvent[ev.id] ?? [];
            const seats = ev.current_bookings ?? 0;
            const capacity = ev.max_participants;
            const isPast = ev.date < todayIso;
            const time = formatTimeRange(ev.start_time, ev.end_time);
            const fillPct = capacity ? Math.min(100, Math.round((seats / capacity) * 100)) : null;

            return (
              <Card
                key={ev.id}
                className={`enter-up ${isPast ? "opacity-60" : ""}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{ev.title}</CardTitle>
                        {isPast && <Badge variant="outline">Passé</Badge>}
                        {!isPast && ev.status === "published" && (
                          <Badge className="bg-success/15 text-success hover:bg-success/15">En ligne</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDateLong(ev.date)}
                        {time && <span className="ml-2">{time}</span>}
                      </p>
                      {ev.theme && (
                        <p className="text-xs text-muted-foreground">{ev.theme}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {ev.price_per_person != null && (
                        <span className="text-sm font-semibold text-foreground">
                          {formatEur(ev.price_per_person)}<span className="font-normal text-muted-foreground">/pers.</span>
                        </span>
                      )}
                      <EventBookingsDialog event={ev} bookings={evBookings} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Jauge de remplissage */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Ticket className="size-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground">{seats}</span>
                      {capacity && (
                        <span className="text-muted-foreground">/ {capacity} places</span>
                      )}
                      {!capacity && (
                        <span className="text-muted-foreground">inscrit{seats !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                    {fillPct !== null && (
                      <div className="flex-1">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all ${fillPct >= 90 ? "bg-warning" : "bg-primary"}`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {Number(ev.total_revenue) > 0 && (
                      <span className="ml-auto text-sm font-semibold text-success">
                        {formatEur(ev.total_revenue)}
                      </span>
                    )}
                  </div>

                  {/* Résumé des inscrits */}
                  {evBookings.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {evBookings.slice(0, 5).map((b) => (
                        <span
                          key={b.id}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {b.first_name} {b.last_name ?? ""}
                          {(b.party_size ?? 1) > 1 && (
                            <span className="font-medium text-foreground">×{b.party_size}</span>
                          )}
                        </span>
                      ))}
                      {evBookings.length > 5 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          +{evBookings.length - 5} autres
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
