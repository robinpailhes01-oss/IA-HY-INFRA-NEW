"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateLong } from "@/lib/format";
import { sendOutreachCampaign, deleteLegacyClient } from "@/app/(dashboard)/archives/actions";

export type ArchiveClient = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  offerSummary: string | null;
  eventDate: string | null;
  eventYear: number | null;
  outreachStatus: string | null; // null = jamais tenté pour cette campagne
  outreachSentAt: string | null;
  outreachError: string | null;
};

const CAMPAIGN = "changement_nom_2025";

function fullName(c: ArchiveClient): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "—";
}

function OutreachBadge({ status }: { status: string | null }) {
  if (status === "unsubscribed") return <Badge variant="destructive">Désabonné</Badge>;
  if (status === "sent") return <Badge variant="secondary" className="bg-success/10 text-success">Envoyé</Badge>;
  if (status === "failed") return <Badge variant="destructive">Échec</Badge>;
  if (status === "sending") return <Badge variant="outline">Envoi…</Badge>;
  if (status === "skipped") return <Badge variant="outline" className="text-muted-foreground">Ignoré</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Pas encore envoyé</Badge>;
}

export function ArchivesTable({ clients }: { clients: ArchiveClient[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const years = useMemo(() => {
    const s = new Set(clients.map((c) => c.eventYear).filter((y): y is number => y !== null));
    return Array.from(s).sort((a, b) => b - a);
  }, [clients]);

  const filtered = useMemo(() => {
    if (yearFilter === "all") return clients;
    return clients.filter((c) => String(c.eventYear) === yearFilter);
  }, [clients, yearFilter]);

  // Seuls les clients avec email et pas déjà "sent" sont sélectionnables pour
  // l'envoi — pas la peine de proposer de cocher ce qui ne peut pas partir.
  const sendable = filtered.filter(
    (c) => c.email && c.outreachStatus !== "sent" && c.outreachStatus !== "unsubscribed",
  );
  const allSendableSelected = sendable.length > 0 && sendable.every((c) => selected.has(c.id));

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSendableSelected) return new Set();
      return new Set(sendable.map((c) => c.id));
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmSend = () => {
    setConfirmOpen(false);
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await sendOutreachCampaign(ids, CAMPAIGN);
      if (!res.ok) {
        toast.error("Échec de l'envoi", { description: res.error });
        return;
      }
      const { sent, failed, skipped } = res.data;
      if (sent > 0) toast.success(`${sent} email(s) envoyé(s)`);
      if (failed > 0) toast.error(`${failed} échec(s)`, { description: "Voir le statut par ligne ci-dessous." });
      if (skipped > 0) toast.message(`${skipped} ignoré(s)`, { description: "Déjà envoyés ou sans email." });
      setSelected(new Set());
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteLegacyClient(id);
      if (!res.ok) {
        toast.error("Suppression échouée", { description: res.error });
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={yearFilter} onValueChange={(v) => setYearFilter((v as string) ?? "all")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les années</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filtered.length} client{filtered.length > 1 ? "s" : ""}
          </span>
        </div>

        <Button
          disabled={selected.size === 0 || pending}
          onClick={() => setConfirmOpen(true)}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
          Envoyer à {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
        </Button>
      </div>

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={allSendableSelected}
                  onChange={toggleAll}
                  disabled={sendable.length === 0}
                  aria-label="Tout sélectionner"
                />
              </TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Prestation</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Campagne</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Aucun client importé pour l&apos;instant — utilise le bouton d&apos;import ci-dessus.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selected.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                      disabled={!c.email || c.outreachStatus === "sent" || c.outreachStatus === "unsubscribed"}
                      aria-label={`Sélectionner ${fullName(c)}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{fullName(c)}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col">
                      <span className={c.email ? "" : "text-muted-foreground"}>
                        {c.email ?? "sans email"}
                      </span>
                      {c.phone ? (
                        <span className="text-xs text-muted-foreground">{c.phone}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-sm text-muted-foreground" title={c.offerSummary ?? ""}>
                    {c.offerSummary ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {c.eventDate ? formatDateLong(c.eventDate) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <OutreachBadge status={c.outreachStatus} />
                      {c.outreachStatus === "sent" && c.outreachSentAt ? (
                        <span className="text-xs text-muted-foreground">
                          via Resend · {formatDateLong(c.outreachSentAt)}
                        </span>
                      ) : null}
                      {c.outreachStatus === "failed" && c.outreachError ? (
                        <span className="max-w-56 truncate text-xs text-destructive" title={c.outreachError}>
                          {c.outreachError}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(c.id)}
                      title="Supprimer cette fiche"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-5" />
              Envoyer la relance
            </DialogTitle>
            <DialogDescription>
              Tu es sur le point d&apos;envoyer l&apos;email &laquo; On a changé de nom &raquo; à{" "}
              <strong>{selected.size}</strong> client{selected.size > 1 ? "s" : ""}, via Resend.
              Chaque envoi est enregistré et ne peut pas partir deux fois à la même personne.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button onClick={confirmSend}>Confirmer l&apos;envoi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
