"use client";

import { useState, useTransition } from "react";
import { Archive, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  archiveLead,
  markBooked,
  markLost,
  updateLeadFields,
} from "@/app/(dashboard)/leads/actions";
import type { Lead } from "@/lib/leads";

export function LeadActions({
  lead,
  onPatch,
  onRemove,
  onClose,
}: {
  lead: Lead;
  onPatch: (patch: Partial<Lead>) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [lostOpen, setLostOpen] = useState(false);
  const [reason, setReason] = useState("");

  function relance() {
    startTransition(async () => {
      const now = new Date().toISOString();
      const res = await updateLeadFields(lead.id, {
        status: "followed_up",
        last_interaction_at: now,
      });
      if (!res.ok) {
        toast.error("Échec", { description: res.error });
        return;
      }
      onPatch({ status: "followed_up", last_interaction_at: now });
      toast.success("Relance envoyée (mock)");
    });
  }

  function booked() {
    startTransition(async () => {
      const res = await markBooked(lead.id);
      if (!res.ok) {
        toast.error("Échec", { description: res.error });
        return;
      }
      onPatch({ status: "booked" });
      toast.success("Lead marqué comme réservé 🎉");
    });
  }

  function confirmLost() {
    startTransition(async () => {
      const res = await markLost(lead.id, reason || "Sans raison précisée");
      if (!res.ok) {
        toast.error("Échec", { description: res.error });
        return;
      }
      onPatch({ status: "lost" });
      setLostOpen(false);
      setReason("");
      toast.success("Lead marqué comme perdu");
    });
  }

  function archive() {
    startTransition(async () => {
      const res = await archiveLead(lead.id);
      if (!res.ok) {
        toast.error("Échec", { description: res.error });
        return;
      }
      onRemove(lead.id);
      onClose();
      toast.success("Lead archivé");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {lostOpen && (
        <div className="flex items-center gap-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Raison de la perte…"
            autoFocus
            className="h-8"
          />
          <Button size="sm" variant="destructive" onClick={confirmLost} disabled={pending}>
            Confirmer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLostOpen(false)}>
            Annuler
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={relance} disabled={pending}>
          <RefreshCw />
          Relancer
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={booked}
          disabled={pending || lead.status === "booked"}
          className="text-success hover:text-success"
        >
          <CheckCircle2 />
          Réservé
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLostOpen((v) => !v)}
          disabled={pending || lead.status === "lost"}
          className="text-destructive hover:text-destructive"
        >
          <XCircle />
          Perdu
        </Button>
        <Button variant="ghost" size="sm" onClick={archive} disabled={pending}>
          <Archive />
          Archiver
        </Button>
      </div>
    </div>
  );
}
