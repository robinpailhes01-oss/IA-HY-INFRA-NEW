"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, ChevronLeft, ChevronRight, Loader2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { addBlocks, removeBlock } from "@/app/(dashboard)/planning/actions";
import { Field } from "@/components/finance/form-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { formatEur } from "@/lib/format";
import { dayTitle, KIND_LABEL, KIND_STYLE, monthTitle, shiftMonth, type PlanningItem } from "@/lib/planning";
import { cn } from "@/lib/utils";

const WEEK = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

export function PlanningCalendar({
  month,
  todayIso,
  days,
  items,
}: {
  month: string;
  todayIso: string;
  days: string[];
  items: PlanningItem[];
}) {
  const router = useRouter();
  const [navPending, startNav] = useTransition();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(days.includes(todayIso) && todayIso.startsWith(month) ? todayIso : `${month}-01`);
  const [dialog, setDialog] = useState(false);
  const [from, setFrom] = useState(selected);
  const [to, setTo] = useState(selected);
  const [reason, setReason] = useState("");

  const byDay = useMemo(() => {
    const map = new Map<string, PlanningItem[]>();
    for (const it of items) map.set(it.date, [...(map.get(it.date) ?? []), it]);
    for (const list of map.values()) list.sort((a, b) => (a.start ?? "99:99").localeCompare(b.start ?? "99:99"));
    return map;
  }, [items]);

  const monthItems = items.filter((i) => i.date.startsWith(month));
  const counts = {
    sortie: monthItems.filter((i) => i.kind === "sortie").length,
    nuit: monthItems.filter((i) => i.kind === "nuit").length,
    blocage: new Set(monthItems.filter((i) => i.kind === "blocage").map((i) => i.date)).size,
  };

  const go = (m: string) => startNav(() => router.push(`/planning?m=${m}`));
  const dayItems = byDay.get(selected) ?? [];

  function openBlockDialog() {
    setFrom(selected);
    setTo(selected);
    setReason("");
    setDialog(true);
  }

  function submitBlock() {
    startTransition(async () => {
      const r = await addBlocks(from, to, reason);
      if (!r.ok) {
        toast.error("Échec", { description: r.error });
        return;
      }
      setDialog(false);
      toast.success(`${r.count} jour${(r.count ?? 1) > 1 ? "s" : ""} bloqué${(r.count ?? 1) > 1 ? "s" : ""}`, {
        description: "Ils ne sont plus proposés à la réservation sur le site.",
      });
      router.refresh();
    });
  }

  function unblock(id: string) {
    startTransition(async () => {
      const r = await removeBlock(id);
      if (!r.ok) {
        toast.error("Échec", { description: r.error });
        return;
      }
      toast.success("Jour débloqué");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5">
      <Card className="rise">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="t-serif font-serif text-[26px] font-normal capitalize leading-none text-foreground">{monthTitle(month)}</h2>
            {navPending && <Loader2 className="size-4 animate-spin text-ink-3" />}
            <div className="ml-auto flex items-center gap-1.5">
              {month !== todayIso.slice(0, 7) && (
                <Button size="sm" variant="outline" onClick={() => go(todayIso.slice(0, 7))}>
                  Aujourd&apos;hui
                </Button>
              )}
              <Button size="icon" variant="outline" aria-label="Mois précédent" onClick={() => go(shiftMonth(month, -1))}>
                <ChevronLeft />
              </Button>
              <Button size="icon" variant="outline" aria-label="Mois suivant" onClick={() => go(shiftMonth(month, 1))}>
                <ChevronRight />
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[12.5px] text-ink-3">
            {counts.sortie} sortie{counts.sortie > 1 ? "s" : ""} · {counts.nuit} nuit{counts.nuit > 1 ? "s" : ""} · {counts.blocage} jour{counts.blocage > 1 ? "s" : ""} bloqué
            {counts.blocage > 1 ? "s" : ""}
          </p>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            {WEEK.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((iso) => {
              const list = byDay.get(iso) ?? [];
              const inMonth = iso.startsWith(month);
              const isToday = iso === todayIso;
              const isSel = iso === selected;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelected(iso)}
                  aria-label={`${dayTitle(iso)}${list.length ? `, ${list.length} élément${list.length > 1 ? "s" : ""}` : ""}`}
                  aria-pressed={isSel}
                  className={cn(
                    "flex min-h-[58px] flex-col items-stretch gap-1 rounded-xl border p-1.5 text-left transition-colors sm:min-h-[92px]",
                    inMonth ? "border-[rgba(11,37,69,0.07)] bg-white/70 hover:bg-white" : "border-transparent bg-transparent opacity-45 hover:opacity-80",
                    isSel && "border-ocean bg-white shadow-[0_0_0_3px_rgba(47,127,224,0.14)]",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-[12.5px] font-semibold",
                      isToday ? "bg-navy text-white" : "text-foreground",
                    )}
                  >
                    {Number(iso.slice(8))}
                  </span>
                  {/* Téléphone : des pastilles. Écran large : le nom de chaque élément. */}
                  <span className="flex flex-wrap gap-0.5 sm:hidden">
                    {list.slice(0, 4).map((it) => (
                      <span key={it.id} className={cn("size-2 rounded-full", KIND_STYLE[it.kind].dot)} />
                    ))}
                  </span>
                  <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                    {list.slice(0, 2).map((it) => (
                      <span key={it.id} className={cn("truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium", KIND_STYLE[it.kind].chip)}>
                        {it.start ? `${it.start} ` : ""}
                        {it.title}
                      </span>
                    ))}
                    {list.length > 2 && <span className="px-1 text-[11px] text-ink-3">+ {list.length - 2}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
            {(["sortie", "nuit", "blocage", "evenement"] as const).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-full", KIND_STYLE[k].dot)} />
                {KIND_LABEL[k]}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="rise h-fit lg:sticky lg:top-4">
        <CardContent className="pt-5">
          <div className="flex items-start gap-2">
            <h3 className="font-serif text-[22px] font-normal leading-tight text-foreground">{dayTitle(selected)}</h3>
            <Button size="sm" variant="outline" className="ml-auto shrink-0" onClick={openBlockDialog}>
              <CalendarOff /> Bloquer
            </Button>
          </div>

          {dayItems.length === 0 ? (
            <EmptyState className="mt-4" icon={<CalendarOff />} title="Journée libre">
              Rien de prévu. Le bateau est proposé à la réservation sur le site.
            </EmptyState>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {dayItems.map((it) => (
                <li key={`${it.source}-${it.id}`} className="rounded-2xl border border-[rgba(11,37,69,0.07)] bg-white/80 p-3.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", KIND_STYLE[it.kind].chip)}>{KIND_LABEL[it.kind]}</span>
                    {(it.start || it.end) && (
                      <span className="text-[12px] text-ink-3">
                        {it.start ?? ""}
                        {it.end ? ` → ${it.end}` : ""}
                      </span>
                    )}
                    {it.source === "block" && (
                      <Button size="icon-sm" variant="ghost" className="ml-auto text-danger" aria-label="Débloquer ce jour" disabled={pending} onClick={() => unblock(it.id)}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  <p className="mt-1.5 text-[14px] font-semibold tracking-[-0.015em] text-foreground">{it.title}</p>
                  {it.subtitle && <p className="text-[13px] text-ink-2">{it.subtitle}</p>}
                  {it.source === "booking" && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
                      {it.people != null && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" /> {it.people}
                        </span>
                      )}
                      {it.total != null && <span>{formatEur(it.total)}</span>}
                      {it.balance != null && it.balance > 0 ? (
                        <span className="font-medium text-warning">Solde dû {formatEur(it.balance)}</span>
                      ) : (
                        it.total != null && <span className="font-medium text-success">Payé</span>
                      )}
                    </div>
                  )}
                  {it.note && <p className="mt-2 text-[12.5px] text-ink-3">{it.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-10">
            <DialogTitle className="t-serif font-serif text-[26px] font-normal leading-tight text-foreground">Bloquer des jours</DialogTitle>
            <DialogDescription className="text-ink-2">
              Maintenance, congé, réservation prise hors du site… Ces jours ne seront plus proposés à la réservation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Du" required>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Au (inclus)" required>
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <Field label="Raison" hint="Visible seulement par toi, dans le planning.">
            <Input value={reason} maxLength={120} placeholder="Entretien du moteur" onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>
              Annuler
            </Button>
            <Button onClick={submitBlock} disabled={pending || !from || !to}>
              {pending ? <Loader2 className="animate-spin" /> : <CalendarOff />} Bloquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
