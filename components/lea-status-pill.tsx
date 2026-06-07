"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type Status = "connected" | "pending" | "waiting" | "error";

const LABELS: Record<Status, { text: string; dot: string; bg: string }> = {
  connected: { text: "Léa connectée", dot: "bg-success", bg: "bg-success/8 text-success" },
  pending: { text: "Léa : scan requis", dot: "bg-warning animate-pulse", bg: "bg-warning/10 text-warning" },
  waiting: { text: "Léa : démarrage…", dot: "bg-muted-foreground/60", bg: "bg-muted text-muted-foreground" },
  error: { text: "Léa hors ligne", dot: "bg-destructive animate-pulse", bg: "bg-destructive/10 text-destructive" },
};

/**
 * Indicateur global de l'état de Léa. Poll /api/wa/qr toutes les 30s — assez
 * pour repérer une déconnexion en moins d'une minute, pas assez pour spammer.
 * Cliquable : renvoie sur /agent pour rescanner si besoin.
 */
export function LeaStatusPill() {
  const [status, setStatus] = useState<Status>("waiting");

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/wa/qr", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) return setStatus("error");
        const data = (await res.json()) as { status?: Status };
        setStatus(data.status ?? "error");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const cfg = LABELS[status];
  return (
    <Link
      href="/agent"
      className={cn(
        "flex items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-xs font-medium transition-colors hover:opacity-80",
        cfg.bg,
      )}
      title="Voir l'état de Léa"
    >
      <span className={cn("size-2 shrink-0 rounded-full", cfg.dot)} />
      <span className="truncate">{cfg.text}</span>
    </Link>
  );
}
