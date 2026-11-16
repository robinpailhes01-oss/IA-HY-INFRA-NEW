"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Paperclip, ReceiptText, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PillGroup } from "@/components/finance/pill-group";
import { ToggleRow } from "@/components/finance/form-bits";
import { shortDate } from "@/components/finance/fin-utils";
import { actOnMails, ruleForSender, setMailCategory } from "@/app/(dashboard)/mails/actions";
import { CATEGORY_LABEL, MAIL_CATEGORIES, TRASHABLE, type MailAction, type MailCategory, type MailRow } from "@/lib/mail/types";
import { cn } from "@/lib/utils";

// Le tri : Léa propose, Robin dispose. La corbeille passe par une confirmation qui
// montre qui est concerné, et reste annulable (corbeille Gmail, 30 jours).

type Filter = "review" | "clients" | "invoices" | "unsorted" | "trashed" | "all";

const CHIP: Record<MailCategory, string> = {
  client: "bg-[rgba(47,127,224,0.12)] text-ocean",
  facture: "bg-[rgba(11,37,69,0.08)] text-navy",
  banque_impots: "bg-[rgba(34,167,191,0.13)] text-aqua",
  fournisseur: "bg-[rgba(109,124,242,0.12)] text-indigo",
  newsletter: "bg-[rgba(217,130,43,0.13)] text-warning",
  notification: "bg-[rgba(217,130,43,0.13)] text-warning",
  indesirable: "bg-[rgba(224,77,85,0.11)] text-danger",
  autre: "bg-[rgba(11,37,69,0.06)] text-ink-2",
  a_classer: "bg-[rgba(11,37,69,0.06)] text-ink-2",
};

const sender = (m: MailRow) => m.from_name || m.from_email || "Expéditeur inconnu";

export function MailInbox({ messages: initial, accountEmail }: { messages: MailRow[]; accountEmail: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<MailRow[]>(initial);
  const [filter, setFilter] = useState<Filter>(initial.some((m) => m.status === "inbox" && m.proposed_action === "trash") ? "review" : "clients");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [alwaysRule, setAlwaysRule] = useState(false);
  const [pending, startTransition] = useTransition();

  const inbox = (m: MailRow) => m.status === "inbox";
  const filters: Record<Filter, (m: MailRow) => boolean> = {
    review: (m) => inbox(m) && m.proposed_action === "trash",
    clients: (m) => inbox(m) && m.category === "client",
    invoices: (m) => m.category === "facture" && m.status !== "trashed",
    unsorted: (m) => inbox(m) && (m.category === "a_classer" || m.category === "autre"),
    trashed: (m) => m.status === "trashed",
    all: (m) => m.status !== "trashed",
  };
  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>;
    for (const k of Object.keys(filters) as Filter[]) c[k] = messages.filter(filters[k]).length;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);
  const shown = useMemo(() => messages.filter(filters[filter]), [messages, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = shown.filter((m) => selected.has(m.id));

  function patch(ids: string[], change: Partial<MailRow>) {
    const set = new Set(ids);
    setMessages((all) => all.map((m) => (set.has(m.id) ? { ...m, ...change } : m)));
    setSelected(new Set());
  }

  function run(action: MailAction, ids: string[], opts: { undo?: boolean } = {}) {
    if (ids.length === 0) return;
    startTransition(async () => {
      const r = await actOnMails(action, ids);
      if (!r.ok) {
        toast.error("Échec", { description: r.error });
        return;
      }
      const n = r.count ?? ids.length;
      const plural = n > 1 ? "s" : "";
      if (action === "trash") {
        patch(ids, { status: "trashed" });
        toast.success(`${n} mail${plural} à la corbeille`, {
          description: "Récupérables 30 jours dans la corbeille Gmail.",
          action: { label: "Annuler", onClick: () => run("untrash", ids, { undo: true }) },
        });
      } else if (action === "untrash") {
        patch(ids, { status: "inbox", proposed_action: "keep" });
        toast.success(opts.undo ? "Corbeille annulée" : `${n} mail${plural} remis dans la boîte`);
      } else if (action === "label_invoice") {
        patch(ids, { status: "invoice", category: "facture" });
        toast.success(`${n} facture${plural} rangée${plural} sous l'étiquette « Factures »`);
      } else {
        patch(ids, { proposed_action: "keep" });
        toast.success(`${n} mail${plural} gardé${plural}`);
      }
      router.refresh();
    });
  }

  function onTrashConfirmed() {
    const ids = chosen.map((m) => m.id);
    const senders = [...new Set(chosen.map((m) => m.from_email).filter((e): e is string => Boolean(e)))];
    setConfirm(false);
    run("trash", ids);
    if (alwaysRule && senders.length === 1) {
      void ruleForSender(senders[0], chosen[0].category === "a_classer" ? "newsletter" : chosen[0].category, true);
    }
    setAlwaysRule(false);
  }

  function changeCategory(m: MailRow, category: MailCategory) {
    const trash = TRASHABLE.includes(category);
    setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, category, proposed_action: trash ? "trash" : "keep", classified_by: "robin" } : x)));
    startTransition(async () => {
      const r = await setMailCategory(m.id, category, null);
      if (!r.ok) toast.error("Échec", { description: r.error });
    });
  }

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; count: number; subject: string }>();
    for (const m of chosen) {
      const key = m.from_email ?? sender(m);
      const g = map.get(key) ?? { label: sender(m), count: 0, subject: m.subject ?? "" };
      g.count += 1;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [chosen]);
  const singleSender = new Set(chosen.map((m) => m.from_email)).size === 1;

  const allSelected = shown.length > 0 && chosen.length === shown.length;

  return (
    <Card className="rise">
      <CardContent className="pt-5">
        <PillGroup
          label="Filtrer les mails"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setSelected(new Set());
          }}
          options={[
            { value: "review", label: "À valider", count: counts.review },
            { value: "clients", label: "Clients", count: counts.clients },
            { value: "invoices", label: "Factures", count: counts.invoices },
            { value: "unsorted", label: "À classer", count: counts.unsorted },
            { value: "all", label: "Tout", count: counts.all },
            { value: "trashed", label: "Corbeille", count: counts.trashed },
          ]}
        />

        {shown.length === 0 ? (
          <EmptyState className="mt-4" icon={<Check />} title={filter === "review" ? "Rien à valider" : "Aucun mail ici"}>
            {filter === "review"
              ? "Léa n'a rien à proposer à la corbeille. Elle relit la boîte toutes les 30 minutes."
              : "Les mails de cette catégorie apparaîtront ici après la prochaine synchronisation."}
          </EmptyState>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-3 border-b border-[rgba(11,37,69,0.06)] pb-2.5 text-[12px] text-ink-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[#2f7fe0]"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(shown.map((m) => m.id)))}
                  aria-label="Tout sélectionner"
                />
                Tout sélectionner ({shown.length})
              </label>
              <span className="ml-auto hidden sm:inline">Boîte {accountEmail}</span>
            </div>
            <ul className="divide-y divide-[rgba(11,37,69,0.06)]">
              {shown.map((m) => (
                <li key={m.id} className={cn("flex items-start gap-3 px-1 py-3", selected.has(m.id) && "bg-[rgba(47,127,224,0.05)]")}>
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-[#2f7fe0] max-sm:size-5"
                    checked={selected.has(m.id)}
                    onChange={() =>
                      setSelected((s) => {
                        const next = new Set(s);
                        if (next.has(m.id)) next.delete(m.id);
                        else next.add(m.id);
                        return next;
                      })
                    }
                    aria-label={`Sélectionner le mail de ${sender(m)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[13.5px] font-semibold tracking-[-0.015em] text-foreground">{sender(m)}</span>
                      {m.has_attachment && <Paperclip className="size-3.5 shrink-0 text-ink-3" aria-label="Pièce jointe" />}
                      <span className="ml-auto shrink-0 text-[11.5px] text-ink-3">{m.received_at ? shortDate(m.received_at) : ""}</span>
                    </div>
                    <p className="truncate text-[13px] text-foreground">{m.subject || "(sans objet)"}</p>
                    <p className="truncate text-[12px] text-ink-3">{m.snippet}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <select
                        value={m.category}
                        onChange={(e) => changeCategory(m, e.target.value as MailCategory)}
                        aria-label="Catégorie"
                        className={cn("h-7 rounded-full border-0 px-2.5 text-[11.5px] font-semibold outline-none focus-visible:ring-4 focus-visible:ring-ocean/20 max-sm:h-9", CHIP[m.category])}
                      >
                        {MAIL_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_LABEL[c]}
                          </option>
                        ))}
                      </select>
                      {m.reason && (
                        <span className="truncate text-[11.5px] text-ink-3">
                          {m.classified_by === "robin" ? "Choisi par toi" : `Léa : ${m.reason}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {m.status === "trashed" ? (
                      <Button variant="ghost" size="icon-sm" className="max-sm:size-11" aria-label="Remettre dans la boîte" disabled={pending} onClick={() => run("untrash", [m.id])}>
                        <Undo2 />
                      </Button>
                    ) : (
                      <>
                        {m.status !== "invoice" && (
                          <Button variant="ghost" size="icon-sm" className="max-sm:size-11" aria-label="Ranger comme facture" disabled={pending} onClick={() => run("label_invoice", [m.id])}>
                            <ReceiptText />
                          </Button>
                        )}
                        {m.proposed_action === "trash" && (
                          <Button variant="ghost" size="icon-sm" className="max-sm:size-11" aria-label="Garder" disabled={pending} onClick={() => run("keep", [m.id])}>
                            <Check />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" className="max-sm:size-11 text-danger" aria-label="Mettre à la corbeille" disabled={pending} onClick={() => { setSelected(new Set([m.id])); setConfirm(true); }}>
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {chosen.length > 0 && filter !== "trashed" && (
          <div className="sticky bottom-24 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-full border border-white/90 bg-white/90 p-2 pl-4 shadow-[var(--shadow-lift)] backdrop-blur-xl lg:bottom-6">
            <span className="text-[13px] font-medium text-foreground">
              {chosen.length} sélectionné{chosen.length > 1 ? "s" : ""}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={() => run("keep", chosen.map((m) => m.id))} disabled={pending}>
                <Check /> Garder
              </Button>
              <Button size="sm" variant="outline" onClick={() => run("label_invoice", chosen.map((m) => m.id))} disabled={pending}>
                <ReceiptText /> Factures
              </Button>
              <Button size="sm" onClick={() => setConfirm(true)} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Corbeille
              </Button>
            </span>
          </div>
        )}
      </CardContent>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-10">
            <DialogTitle className="t-serif font-serif text-[26px] font-normal leading-tight text-foreground">
              Mettre {chosen.length} mail{chosen.length > 1 ? "s" : ""} à la corbeille ?
            </DialogTitle>
            <DialogDescription className="text-ink-2">
              Ils vont dans la corbeille de Gmail et y restent 30 jours : tu peux les récupérer ici (onglet Corbeille) ou dans Gmail.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-2xl bg-[rgba(11,37,69,0.04)] p-3 text-[13px]">
            {groups.slice(0, 12).map((g) => (
              <li key={g.label} className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{g.label}</span>
                <span className="shrink-0 text-ink-3">{g.count > 1 ? `${g.count} mails` : g.subject.slice(0, 28)}</span>
              </li>
            ))}
            {groups.length > 12 && <li className="text-ink-3">… et {groups.length - 12} autres expéditeurs</li>}
          </ul>
          {chosen.some((m) => m.category === "client") && (
            <p className="rounded-2xl bg-[rgba(217,130,43,0.12)] px-4 py-3 text-[13px] text-warning">
              Attention : la sélection contient des mails classés « Client ».
            </p>
          )}
          {singleSender && <ToggleRow checked={alwaysRule} onChange={setAlwaysRule} label="Toujours mettre cet expéditeur à la corbeille" />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Annuler
            </Button>
            <Button onClick={onTrashConfirmed} disabled={pending}>
              <Trash2 /> Mettre à la corbeille
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
