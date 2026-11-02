import { CalendarPlus, Lightbulb } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PlatformGlyph } from "@/components/social/platform-glyph";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, plural, type Platform } from "@/components/social/model";
import {
  JOURS_COURTS,
  JOURS_INITIALES,
  addDays,
  daysBetween,
  hourLabel,
  weekdayMon,
} from "@/components/social/time";

// CALENDRIER ÉDITORIAL — ce qui doit sortir, et quand.
//
// Un mini-calendrier de quatre semaines (lundi → dimanche, la semaine en cours
// d'abord) pour voir les trous d'un coup d'œil, puis la liste des prochaines
// publications. Une publication « programmée » dont la date est passée sans
// être marquée publiée remonte en tête : c'est soit un oubli de publication,
// soit un oubli de mise à jour du carnet — dans les deux cas, à regarder.

export type CalendarItem = {
  id: string;
  date: string | null;
  time: string | null;
  title: string;
  platform: Platform | null;
  format: string;
  status: string;
};

const STATUS_STYLE: Record<string, { pill: string; dot: string }> = {
  scheduled: { pill: "bg-[rgba(47,127,224,0.1)] text-ocean", dot: "bg-ocean" },
  in_progress: { pill: "bg-[rgba(217,130,43,0.12)] text-warning", dot: "bg-warning" },
  idea: { pill: "bg-[rgba(11,37,69,0.06)] text-ink-2", dot: "bg-transparent ring-[1.5px] ring-inset ring-ink-3" },
};

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function EditorialCalendar({ items, today }: { items: CalendarItem[]; today: string }) {
  const overdue = items.filter((i) => i.date && i.date < today && i.status !== "idea");
  const dated = items
    .filter((i) => i.date && i.date >= today)
    .sort((a, b) => (a.date! + (a.time ?? "")).localeCompare(b.date! + (b.time ?? "")));
  const undated = items.filter((i) => !i.date);
  const list = [...overdue, ...dated];

  // Quatre semaines à partir du lundi de cette semaine.
  const monday = addDays(today, -weekdayMon(today));
  const days = Array.from({ length: 28 }, (_, i) => addDays(monday, i));
  const byDay = new Map<string, CalendarItem[]>();
  for (const it of dated) {
    byDay.set(it.date!, [...(byDay.get(it.date!) ?? []), it]);
  }
  const horizon = addDays(monday, 27);
  const inGrid = dated.filter((i) => i.date! <= horizon).length;

  const shown = list.slice(0, 3);
  const rest = list.length - shown.length;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Calendrier éditorial</CardTitle>
        <CardDescription>
          {dated.length === 0
            ? "Rien de prévu pour l'instant"
            : `${inGrid} ${plural(inGrid, "contenu prévu", "contenus prévus")} sur les quatre prochaines semaines`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        {/* Mini-calendrier */}
        <div>
          <div className="grid grid-cols-7 gap-1 pb-1.5">
            {JOURS_INITIALES.map((l, i) => (
              <span key={i} className="text-center text-[11px] font-semibold text-ink-3">
                {l}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const posts = byDay.get(d) ?? [];
              const isToday = d === today;
              const past = d < today;
              const firstOfMonth = d.endsWith("-01");
              return (
                <div
                  key={d}
                  className={cn(
                    "relative flex h-10 flex-col items-center justify-center rounded-full",
                    posts.length > 0 && !isToday && "bg-white/80 shadow-[var(--shadow-glass)]",
                  )}
                  title={posts.map((p) => p.title).join(" · ") || undefined}
                >
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-full text-[12.5px] font-medium tabular-nums",
                      isToday
                        ? "bg-[linear-gradient(180deg,#183f6d,#0b2545)] text-white shadow-[0_6px_14px_-6px_rgba(11,37,69,0.6)]"
                        : past
                          ? "text-ink-3/60"
                          : "text-foreground",
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {firstOfMonth && !isToday && (
                    <span className="absolute -top-0.5 text-[9px] font-semibold uppercase tracking-wide text-ocean">
                      {MOIS[Number(d.slice(5, 7)) - 1].replace(".", "")}
                    </span>
                  )}
                  {posts.length > 0 && (
                    <span className="absolute bottom-1 flex gap-0.5">
                      {posts.slice(0, 3).map((p) => (
                        <span key={p.id} className={cn("size-1.5 rounded-full", STATUS_STYLE[p.status]?.dot ?? "bg-ink-3")} />
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-ink-2">
            {(["scheduled", "in_progress", "idea"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", STATUS_STYLE[s].dot)} />
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        {/* Les prochaines publications */}
        {list.length === 0 ? (
          <EmptyState icon={<CalendarPlus />} title="Aucune publication à venir" className="flex-1 py-8">
            Note tes prochains contenus dans le carnet, avec leur date : ils apparaîtront ici et Léa
            te préviendra des semaines vides.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((it) => {
              const late = it.date! < today && it.status !== "idea";
              const style = STATUS_STYLE[it.status] ?? STATUS_STYLE.idea;
              const diff = daysBetween(today, it.date!);
              const pill = (
                <span className={cn("pastille shrink-0", late ? "bg-[rgba(224,77,85,0.1)] text-danger" : style.pill)}>
                  {late ? "Date passée" : STATUS_LABEL[it.status] ?? it.status}
                </span>
              );
              return (
                <li key={it.id} className="flex items-center gap-3 rounded-[18px] px-1 py-1">
                  <span className="vitre-inset flex w-12 shrink-0 flex-col items-center rounded-[14px] py-1.5 leading-none">
                    <span className="text-[10.5px] font-medium text-ink-3">{JOURS_COURTS[weekdayMon(it.date!)]}</span>
                    <span className="n-inline mt-1 text-[17px] text-foreground">{Number(it.date!.slice(8))}</span>
                    <span className="mt-0.5 text-[10px] text-ink-3">{MOIS[Number(it.date!.slice(5, 7)) - 1]}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-foreground">
                      {it.platform && <PlatformGlyph platform={it.platform} className="size-3.5" />}
                      <span className="truncate">{it.title}</span>
                    </p>
                    {/* Téléphone : l'état passe sous le titre — à droite, il
                        coupait le titre après quinze lettres. */}
                    <p className="mt-1 flex min-w-0 items-center gap-2 text-[12px] text-ink-3 sm:mt-0.5">
                      <span className="sm:hidden">{pill}</span>
                      <span className="truncate">
                        {it.format}
                        {hourLabel(it.time) ? ` · ${hourLabel(it.time)}` : ""}
                        {!late && diff === 0 ? " · aujourd'hui" : !late && diff === 1 ? " · demain" : ""}
                      </span>
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex">{pill}</span>
                </li>
              );
            })}
          </ul>
        )}

        {(rest > 0 || undated.length > 0) && (
          <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--hairline)] pt-3 text-[12px] text-ink-3">
            {rest > 0 && <span>+ {rest} {plural(rest, "autre publication", "autres publications")} plus loin</span>}
            {undated.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Lightbulb className="size-3.5 text-gold" />
                {undated.length} {plural(undated.length, "idée", "idées")} sans date
              </span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
