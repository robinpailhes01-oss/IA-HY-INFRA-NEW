"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEur } from "@/lib/format";
import { addEventBooking } from "@/app/(dashboard)/events/actions";

type EventInfo = {
  id: string;
  title: string;
  price_per_person: number | null;
};

type Booking = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  party_size: number | null;
  total_paid: number | null;
  payment_status: string | null;
  created_at: string | null;
};

const PAYMENT_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  paid: { label: "Payé", variant: "default" },
  pending: { label: "En attente", variant: "secondary" },
  refunded: { label: "Remboursé", variant: "destructive" },
};

export function EventBookingsDialog({
  event,
  bookings,
}: {
  event: EventInfo;
  bookings: Booking[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"list" | "add">(bookings.length === 0 ? "add" : "list");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    party_size: "1",
    total_paid: event.price_per_person != null ? String(event.price_per_person) : "",
    payment_status: "pending",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Auto-calculer le montant si le prix/pers et le nb de pers changent
      if ((key === "party_size") && event.price_per_person != null) {
        const n = Number(value) || 1;
        next.total_paid = String(event.price_per_person * n);
      }
      return next;
    });
  }

  function handleAdd() {
    if (!form.first_name.trim()) {
      toast.error("Le prénom est requis.");
      return;
    }
    startTransition(async () => {
      const res = await addEventBooking({
        event_id: event.id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        party_size: Number(form.party_size) || 1,
        total_paid: form.total_paid ? Number(form.total_paid) : null,
        payment_status: form.payment_status,
      });
      if (!res.ok) {
        toast.error("Échec de l'ajout", { description: res.error });
        return;
      }
      toast.success("Inscription ajoutée !");
      setForm({ first_name: "", last_name: "", email: "", phone: "", party_size: "1", total_paid: event.price_per_person != null ? String(event.price_per_person) : "", payment_status: "pending" });
      setTab("list");
      router.refresh();
    });
  }

  const totalPaid = bookings.reduce((s, b) => s + Number(b.total_paid ?? 0), 0);
  const totalSeats = bookings.reduce((s, b) => s + (b.party_size ?? 1), 0);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Users className="size-4" />
        {bookings.length > 0 ? `${totalSeats} inscrit${totalSeats !== 1 ? "s" : ""}` : "Inscrits"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
        </DialogHeader>

        {/* Onglets */}
        <div className="mb-2 inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-sm">
          {(["list", "add"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "list" ? `Inscrits (${bookings.length})` : "Ajouter"}
            </button>
          ))}
        </div>

        {tab === "list" && (
          <>
            {bookings.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucune inscription pour le moment.</p>
            ) : (
              <>
                <div className="mb-3 flex gap-4 text-sm">
                  <span className="text-muted-foreground">{totalSeats} place{totalSeats !== 1 ? "s" : ""}</span>
                  {totalPaid > 0 && <span className="font-semibold text-success">{formatEur(totalPaid)} encaissés</span>}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead className="text-center">Pers.</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((b) => {
                      const ps = PAYMENT_STATUS[b.payment_status ?? ""] ?? { label: b.payment_status ?? "—", variant: "outline" as const };
                      return (
                        <TableRow key={b.id}>
                          <TableCell>
                            <div className="font-medium text-foreground">{b.first_name} {b.last_name ?? ""}</div>
                            {b.phone && <div className="text-xs text-muted-foreground">{b.phone}</div>}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">{b.party_size ?? 1}</TableCell>
                          <TableCell className="text-right font-medium text-foreground">{formatEur(b.total_paid)}</TableCell>
                          <TableCell><Badge variant={ps.variant}>{ps.label}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </>
        )}

        {tab === "add" && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Prénom *</Label>
                <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="Alice" />
              </div>
              <div className="grid gap-1.5">
                <Label>Nom</Label>
                <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="Dupont" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Téléphone</Label>
                <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+33 6 …" />
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="alice@…" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Personnes</Label>
                <Input type="number" min={1} value={form.party_size} onChange={(e) => set("party_size", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Montant (€)</Label>
                <Input type="number" min={0} value={form.total_paid} onChange={(e) => set("total_paid", e.target.value)} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>Paiement</Label>
                <Select value={form.payment_status} onValueChange={(v) => set("payment_status", v as string)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v) => PAYMENT_STATUS[v as string]?.label ?? (v as string)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="paid">Payé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Fermer</DialogClose>
          {tab === "add" && (
            <Button onClick={handleAdd} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Inscrire
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
