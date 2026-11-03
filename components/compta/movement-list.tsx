"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CircleDashed,
  FileCheck2,
  FileWarning,
  Loader2,
  Paperclip,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Num } from "@/components/ui/num";
import { PillGroup } from "@/components/finance/pill-group";
import { ChoicePills, Field, ToggleRow } from "@/components/finance/form-bits";
import { shortDate } from "@/components/finance/fin-utils";
import { createClient } from "@/lib/supabase/client";
import { VAT_RATES, type Account } from "@/lib/compta/accounts";
import type { Movement } from "@/lib/compta/ledger";
import {
  acceptSuggestions,
  attachReceipt,
  classifyMovement,
  receiptUrl,
  setNoReceipt,
} from "@/app/(dashboard)/compta/actions";
import { formatEurCents as formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

// Le journal à traiter : chaque mouvement de banque et de caisse, avec ce
// qu'il lui manque — un compte, ou un justificatif. Un clic ouvre la fiche
// du mouvement, où l'on classe, joint la facture, ou explique son absence.

type Filter = "todo" | "receipt" | "all";

const PAGE = 40;

function StatusDot({ m }: { m: Movement }) {
  if (m.status === "a_classer")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(217,130,43,0.12)] px-2 py-0.5 text-[11px] font-semibold text-warning">
        <CircleDashed className="size-3" /> À classer
      </span>
    );
  if (m.status === "justificatif")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(224,77,85,0.1)] px-2 py-0.5 text-[11px] font-semibold text-danger">
        <FileWarning className="size-3" /> Justificatif
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(15,159,110,0.1)] px-2 py-0.5 text-[11px] font-semibold text-success">
      <Check className="size-3" /> OK
    </span>
  );
}

export function MovementList({
  movements,
  accounts,
  closedMonths,
  initialFilter = "todo",
}: {
  movements: Movement[];
  accounts: Account[];
  closedMonths: string[];
  initialFilter?: Filter;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [limit, setLimit] = useState(PAGE);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(
    () => ({
      todo: movements.filter((m) => m.status === "a_classer").length,
      receipt: movements.filter((m) => m.status === "justificatif").length,
      all: movements.length,
    }),
    [movements],
  );

  const filtered = useMemo(() => {
    if (filter === "todo") return movements.filter((m) => m.status === "a_classer");
    if (filter === "receipt") return movements.filter((m) => m.status === "justificatif");
    return movements;
  }, [movements, filter]);

  const suggestions = movements.filter((m) => m.status === "a_classer" && m.suggestion && !m.pending);
  const open = movements.find((m) => m.key === openKey) ?? null;

  function acceptAll() {
    startTransition(async () => {
      const res = await acceptSuggestions(
        suggestions.map((m) => ({
          source: m.source,
          sourceId: m.sourceId,
          date: m.date,
          accountCode: m.suggestion!.account,
          vatRate: m.suggestion!.vatRate,
          reverseCharge: m.suggestion!.reverseCharge,
          noReceiptReason: m.suggestion!.noReceiptReason,
        })),
      );
      if (!res.ok) toast.error("Échec", { description: res.error });
      else {
        toast.success(`${res.count} mouvement${(res.count ?? 0) > 1 ? "s" : ""} classé${(res.count ?? 0) > 1 ? "s" : ""}`);
        router.refresh();
      }
    });
  }

  const label = (code: string) => accounts.find((a) => a.code === code)?.label ?? code;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PillGroup
          label="Filtrer les mouvements"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setLimit(PAGE);
          }}
          options={[
            { value: "todo", label: "À classer", count: counts.todo },
            { value: "receipt", label: "Sans justificatif", count: counts.receipt },
            { value: "all", label: "Tout", count: counts.all },
          ]}
        />
        {filter === "todo" && suggestions.length > 0 && (
          <Button variant="secondary" size="sm" onClick={acceptAll} disabled={pending} className="h-11 sm:h-8">
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Valider les {suggestions.length} propositions
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<FileCheck2 />}
          title={filter === "todo" ? "Tout est classé" : filter === "receipt" ? "Aucun justificatif manquant" : "Aucun mouvement"}
        >
          {filter === "all"
            ? "Les mouvements Qonto et la caisse apparaissent ici dès la première synchronisation."
            : "Rien à rattraper sur cet exercice. Les nouveaux mouvements arrivent toutes les heures."}
        </EmptyState>
      ) : (
        <ul className="mt-4 divide-y divide-[rgba(11,37,69,0.06)]">
          {filtered.slice(0, limit).map((m) => (
            <li key={m.key}>
              <button
                type="button"
                onClick={() => setOpenKey(m.key)}
                className="group/row flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left outline-none transition-colors hover:bg-white/60 focus-visible:ring-4 focus-visible:ring-ocean/20"
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-4",
                    m.direction === "in" ? "bg-[rgba(15,159,110,0.1)] text-success" : "bg-[rgba(11,37,69,0.06)] text-navy",
                  )}
                >
                  {m.direction === "in" ? <ArrowDownLeft /> : <ArrowUpRight />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold tracking-[-0.015em] text-foreground">
                    {m.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                    {shortDate(m.date)} · {m.source === "bank" ? "Qonto" : "Caisse"}
                    {m.pending ? " · en attente" : ""}
                    {m.status !== "a_classer" && m.entry
                      ? ` · ${label(m.entry.account_code)}${Number(m.entry.vat_rate) > 0 ? ` · TVA ${String(m.entry.vat_rate).replace(".", ",")} %` : ""}`
                      : m.suggestion
                        ? ` · proposé : ${label(m.suggestion.account)}`
                        : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Num className={cn("n-inline text-[14px]", m.direction === "in" ? "text-success" : "text-foreground")}>
                    {`${m.direction === "in" ? "+" : "−"}${formatEur(m.amount)}`}
                  </Num>
                  <StatusDot m={m} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {filtered.length > limit && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
            Voir {Math.min(PAGE, filtered.length - limit)} de plus
          </Button>
        </div>
      )}

      <MovementSheet
        movement={open}
        accounts={accounts}
        locked={open ? closedMonths.includes(`${open.date.slice(0, 7)}-01`) : false}
        onClose={() => setOpenKey(null)}
      />
    </div>
  );
}

function MovementSheet({
  movement,
  accounts,
  locked,
  onClose,
}: {
  movement: Movement | null;
  accounts: Account[];
  locked: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={movement !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        {movement && <MovementForm key={movement.key} m={movement} accounts={accounts} locked={locked} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function MovementForm({
  m,
  accounts,
  locked,
  onDone,
}: {
  m: Movement;
  accounts: Account[];
  locked: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  const initialAccount = m.entry && m.status !== "a_classer" ? m.entry.account_code : m.suggestion?.account ?? "";
  const [account, setAccount] = useState(initialAccount);
  const [rate, setRate] = useState<number>(
    m.entry && m.status !== "a_classer" ? Number(m.entry.vat_rate) : m.suggestion?.vatRate ?? 0,
  );
  const [reverse, setReverse] = useState(
    m.entry && m.status !== "a_classer" ? m.entry.reverse_charge : m.suggestion?.reverseCharge ?? false,
  );
  const [note, setNote] = useState(m.entry?.note ?? "");
  const [noReceipt, setNoReceiptText] = useState(m.entry?.no_receipt_reason ?? m.suggestion?.noReceiptReason ?? "");
  const [makeRule, setMakeRule] = useState(false);
  const [pattern, setPattern] = useState(m.source === "bank" ? m.title.toLowerCase().slice(0, 40) : "");

  // Comptes proposés : ceux qui ont du sens dans ce sens-là.
  const groups = useMemo(() => {
    const list = accounts
      .filter((a) => a.active)
      .filter((a) => (m.direction === "in" ? a.kind !== "charge" && a.kind !== "immobilisation" : a.kind !== "produit"))
      .sort((a, b) => a.sort - b.sort);
    const map = new Map<string, Account[]>();
    for (const a of list) map.set(a.grp, [...(map.get(a.grp) ?? []), a]);
    return [...map.entries()];
  }, [accounts, m.direction]);

  const acc = accounts.find((a) => a.code === account) ?? null;
  const vatPossible = acc && (acc.kind === "produit" || acc.kind === "charge" || acc.kind === "immobilisation");
  const gross = m.sumupFee && acc?.kind === "produit" ? m.amount + m.sumupFee : m.amount;
  const vatPreview =
    vatPossible && rate > 0
      ? reverse
        ? Math.round(m.amount * rate) / 100
        : Math.round(((gross * rate) / (100 + rate)) * 100) / 100
      : 0;

  const ref = { source: m.source, sourceId: m.sourceId, date: m.date };

  function save() {
    if (!account) {
      toast.error("Choisis un compte.");
      return;
    }
    startTransition(async () => {
      const res = await classifyMovement(ref, {
        accountCode: account,
        vatRate: vatPossible ? rate : 0,
        reverseCharge: vatPossible && m.direction === "out" ? reverse : false,
        note: note.trim() || null,
        noReceiptReason: noReceipt.trim() || null,
        rule: makeRule && m.source === "bank" ? { pattern, side: m.direction === "in" ? "credit" : "debit" } : null,
      });
      if (!res.ok) {
        toast.error("Échec", { description: res.error });
        return;
      }
      toast.success("Mouvement classé");
      router.refresh();
      onDone();
    });
  }

  async function upload(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Fichier trop lourd (15 Mo maximum).");
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80);
      const path = `${m.date.slice(0, 4)}/${m.date.slice(5, 7)}/${m.source}-${m.sourceId}-${Date.now()}-${safe}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("justificatifs").upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (error) {
        toast.error("Envoi impossible", { description: error.message });
        return;
      }
      const res = await attachReceipt(ref, { path, name: file.name });
      if (!res.ok) {
        toast.error("Échec", { description: res.error });
        return;
      }
      toast.success("Justificatif rattaché");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function openReceipt() {
    if (!m.entry?.receipt_path) return;
    const res = await receiptUrl(m.entry.receipt_path);
    if (res.url) window.open(res.url, "_blank", "noopener");
    else toast.error("Lien indisponible", { description: res.error ?? undefined });
  }

  function saveNoReceipt() {
    startTransition(async () => {
      const res = await setNoReceipt(ref, noReceipt);
      if (!res.ok) toast.error("Échec", { description: res.error });
      else {
        toast.success("Raison enregistrée");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-5 p-5 pb-8">
      <SheetHeader className="p-0">
        <SheetTitle className="pr-10">{m.title}</SheetTitle>
        <SheetDescription>
          {shortDate(m.date)} {m.date.slice(0, 4)} · {m.source === "bank" ? "Banque Qonto" : "Caisse espèces"}
          {m.detail ? ` · ${m.detail}` : ""}
        </SheetDescription>
      </SheetHeader>

      <div className="vitre-inset rounded-[22px] px-5 py-4">
        <p className="t-label text-ink-3">{m.direction === "in" ? "Encaissé" : "Payé"}</p>
        <Num className={cn("n-kpi-lead mt-1 block", m.direction === "in" ? "text-success" : "text-foreground")}>
          {formatEur(m.amount)}
        </Num>
        {m.sumupFee ? (
          <p className="t-caption mt-1 text-ink-3">
            Vente SumUp <Num>{formatEur(m.amount + m.sumupFee)}</Num> − commission <Num>{formatEur(m.sumupFee)}</Num>
          </p>
        ) : null}
      </div>

      {locked && (
        <p className="rounded-2xl bg-[rgba(217,130,43,0.1)] px-4 py-3 text-[13px] text-warning">
          Ce mois est clôturé : rouvre-le dans « Clôture » pour modifier ce mouvement.
        </p>
      )}

      <Field label="Compte" required hint={acc ? `Compte ${acc.code}` : "Où ranger ce mouvement"}>
        <select
          value={account}
          disabled={locked}
          onChange={(e) => {
            setAccount(e.target.value);
            const a = accounts.find((x) => x.code === e.target.value);
            if (a) setRate(a.default_vat_rate);
          }}
          className="h-11 w-full rounded-full border border-[rgba(11,37,69,0.1)] bg-white/80 px-4 text-[14px] text-foreground outline-none focus-visible:ring-4 focus-visible:ring-ocean/20"
        >
          <option value="">Choisir…</option>
          {groups.map(([grp, list]) => (
            <optgroup key={grp} label={grp}>
              {list.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      {vatPossible && (
        <div className="grid gap-2">
          <span className="t-label text-ink-2">Taux de TVA</span>
          <ChoicePills
            label="Taux de TVA"
            value={String(rate)}
            onChange={(v) => !locked && setRate(Number(v))}
            options={VAT_RATES.map((r) => ({ value: String(r), label: r === 0 ? "Sans TVA" : `${String(r).replace(".", ",")} %` }))}
          />
          {m.direction === "out" && (
            <ToggleRow
              checked={reverse}
              onChange={(v) => !locked && setReverse(v)}
              label="Autoliquidation (fournisseur étranger)"
            />
          )}
          <p className="t-caption text-ink-3">
            {rate > 0 ? (
              <>
                TVA {m.direction === "in" ? "collectée" : reverse ? "autoliquidée (collectée et déductible)" : "déductible"} :{" "}
                <Num>{formatEur(vatPreview)}</Num>
              </>
            ) : (
              "Pas de TVA sur ce mouvement."
            )}
          </p>
        </div>
      )}

      <Field label="Note (facultatif)">
        <Input value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} placeholder="Ex. vidange moteur bâbord" />
      </Field>

      {/* Justificatif */}
      <div className="grid gap-2.5">
        <span className="t-label text-ink-2">Justificatif</span>
        {m.entry?.receipt_path ? (
          <button
            type="button"
            onClick={openReceipt}
            className="flex items-center gap-2.5 rounded-2xl border border-white/90 bg-white/70 px-4 py-3 text-left text-[13.5px] font-medium text-foreground hover:bg-white"
          >
            <Paperclip className="size-4 text-ocean" />
            <span className="min-w-0 flex-1 truncate">{m.entry.receipt_name ?? "Justificatif"}</span>
            <span className="text-[12px] text-ocean">Ouvrir</span>
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        <Button variant="outline" className="h-11" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
          {m.entry?.receipt_path ? "Joindre un autre fichier" : "Photo ou PDF de la facture"}
        </Button>
        {!m.entry?.receipt_path && (
          <div className="grid gap-1.5">
            <Input
              value={noReceipt}
              onChange={(e) => setNoReceiptText(e.target.value)}
              placeholder="Ou : pourquoi il n'y en a pas (ex. frais sur relevé)"
            />
            {m.status === "justificatif" && (
              <Button variant="ghost" size="sm" className="justify-self-start" disabled={pending || noReceipt.trim().length < 3} onClick={saveNoReceipt}>
                Enregistrer la raison
              </Button>
            )}
          </div>
        )}
      </div>

      {m.source === "bank" && !locked && (
        <div className="grid gap-2 rounded-[20px] border border-[rgba(11,37,69,0.08)] bg-white/50 p-3">
          <ToggleRow checked={makeRule} onChange={setMakeRule} label="Toujours classer ainsi" />
          {makeRule && (
            <Field label="Quand la contrepartie contient" hint="Les prochains mouvements identiques seront classés tout seuls.">
              <Input value={pattern} onChange={(e) => setPattern(e.target.value)} />
            </Field>
          )}
        </div>
      )}

      <Button size="lg" onClick={save} disabled={pending || locked || !account}>
        {pending ? <Loader2 className="animate-spin" /> : <Check />}
        Enregistrer
      </Button>
    </div>
  );
}
