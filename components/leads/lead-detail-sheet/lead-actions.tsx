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
  triggerManualFollowup,
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
      const res = await triggerManualFollowup(lead.id);
      if (!res.ok) {
        toast.error("Échec de la relance", { description: res.error });
        return;
      }
      const now = new Date().toISOString();
      onPatch({
        status: "followed_up",
        last_interaction_at: now,
        last_followup_at: now,
        followup_count: (lead.followup_count ?? 0) + 1,
      });
      toast.success("Relance envoyée par Léa");
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
      toast.success("Lead marqué comme réservé");
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

  // Quatre décisions, une rangée de pilules. La relance (confiée à Léa) est
  // l'action principale ; « Réservé » et « Perdu » ferment le dossier.
  return (
    <div className="flex flex-col gap-2.5">
      {lostOpen && (
        <div className="flex items-center gap-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Raison de la perte…"
            autoFocus
            className="h-10"
          />
          <Button variant="destructive" onClick={confirmLost} disabled={pending}>
            Confirmer
          </Button>
          <Button variant="ghost" onClick={() => setLostOpen(false)}>
            Annuler
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button onClick={relance} disabled={pending} className="h-11">
          <RefreshCw />
          Relancer
        </Button>
        <Button
          variant="outline"
          onClick={booked}
          disabled={pending || lead.status === "booked"}
          className="h-11 text-success hover:text-success"
        >
          <CheckCircle2 />
          Réservé
        </Button>
        <Button
          variant="outline"
          onClick={() => setLostOpen((v) => !v)}
          disabled={pending || lead.status === "lost"}
          className="h-11 text-danger hover:text-danger"
        >
          <XCircle />
          Perdu
        </Button>
        <Button variant="ghost" onClick={archive} disabled={pending} className="h-11">
          <Archive />
          Archiver
        </Button>
      </div>
    </div>
  );
}
