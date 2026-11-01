import { CalendarHeart, Euro, PartyPopper, Ticket, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { Num } from "@/components/ui/num";
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

  // Le jour du mois en grand, à gauche de chaque événement : on lit une liste
  // d'événements comme un agenda, par la date d'abord.
  const dayParts = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    return {
      day: d.toLocaleDateString("fr-FR", { day: "numeric" }),
      month: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
    };
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Outils"
        title={<>Événements <em>publics</em></>}
        description={`${upcoming.length} événement${upcoming.length !== 1 ? "s" : ""} à venir — soirées à thème, couchers de soleil partagés, sorties à la place.`}
        actions={<AddEventDialog />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-5">
        <KpiCard label="Événements à venir" value={upcoming.length} accent="ocean" icon={<CalendarHeart />} index={0} />
        <KpiCard label="Places réservées" value={totalSeats} accent="aqua" icon={<Users />} index={1} />
        <KpiCard
          label="CA événements"
          value={totalRevenue}
          format="eur"
          accent="success"
          icon={<Euro />}
          index={2}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {events.length === 0 ? (
        <EmptyState icon={<PartyPopper />} title="Aucun événement pour l'instant">
          Crée le premier avec « Nouvel événement » : il apparaîtra ici avec sa
          jauge de remplissage et la liste des inscrits.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          {events.map((ev, i) => {
            const evBookings = bookingsByEvent[ev.id] ?? [];
            const seats = ev.current_bookings ?? 0;
            const capacity = ev.max_participants;
            const isPast = ev.date < todayIso;
            const time = formatTimeRange(ev.start_time, ev.end_time);
            const fillPct = capacity ? Math.min(100, Math.round((seats / capacity) * 100)) : null;
            const { day, month } = dayParts(ev.date);

            return (
              <Card
                key={ev.id}
                // L'animation d'entrée finit sur opacity: 1 et écraserait une opacité
                // posée sur la carte elle-même : on estompe donc son contenu.
                className={`rise ${isPast ? "[&>*]:opacity-55" : ""}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <CardHeader className="pb-1">
                  <div className="flex items-start gap-4">
                    <span className="flex w-14 shrink-0 flex-col items-center rounded-[18px] border border-white bg-white/80 py-2 shadow-[var(--shadow-glass)]">
                      <span className="n-inline text-[22px] leading-none text-foreground">{day}</span>
                      <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ocean">{month}</span>
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-[16px]">{ev.title}</CardTitle>
                        {isPast && <Badge variant="outline">Passé</Badge>}
                        {!isPast && ev.status === "published" && (
                          <Badge className="bg-[rgba(15,159,110,0.1)] text-success">En ligne</Badge>
                        )}
                      </div>
                      <p className="text-[13px] text-ink-2">
                        {formatDateLong(ev.date)}
                        {time && <span className="text-ink-3"> · {time}</span>}
                      </p>
                      {ev.theme && <p className="text-xs text-ink-3">{ev.theme}</p>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Jauge de remplissage */}
                  <div className="vitre-inset flex items-center gap-3 rounded-full px-4 py-2.5">
                    <Ticket className="size-4 shrink-0 text-ocean" />
                    <span className="shrink-0 text-[13px]">
                      <span className="n-inline text-foreground">{seats}</span>
                      <span className="text-ink-3">
                        {capacity ? ` / ${capacity} places` : ` inscrit${seats !== 1 ? "s" : ""}`}
                      </span>
                    </span>
                    {fillPct !== null && (
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(11,37,69,0.07)]">
                        <span
                          className={`block h-full rounded-full ${fillPct >= 90 ? "bg-warning" : "bg-[linear-gradient(90deg,#7cc0f5,#2f7fe0)]"}`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </span>
                    )}
                    {Number(ev.total_revenue) > 0 && (
                      <Num className="n-inline ml-auto shrink-0 text-[13px] text-success">
                        {formatEur(ev.total_revenue)}
                      </Num>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {evBookings.slice(0, 4).map((b) => (
                      <span
                        key={b.id}
                        className="inline-flex items-center gap-1 rounded-full border border-white bg-white/70 px-2.5 py-1 text-xs text-ink-2"
                      >
                        {b.first_name} {b.last_name ?? ""}
                        {(b.party_size ?? 1) > 1 && (
                          <span className="font-semibold text-foreground">×{b.party_size}</span>
                        )}
                      </span>
                    ))}
                    {evBookings.length > 4 && (
                      <span className="rounded-full bg-[rgba(11,37,69,0.05)] px-2.5 py-1 text-xs text-ink-2">
                        +{evBookings.length - 4} autres
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-2">
                      {ev.price_per_person != null && (
                        <span className="text-[13px] text-ink-2">
                          <Num className="n-inline text-foreground">{formatEur(ev.price_per_person)}</Num> / pers.
                        </span>
                      )}
                      <EventBookingsDialog event={ev} bookings={evBookings} />
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
