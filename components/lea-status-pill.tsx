"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { LeaAvatar } from "@/components/lea/lea-avatar";

export type LeaStatus = "connected" | "pending" | "waiting" | "error";

const LABELS: Record<LeaStatus, { short: string; long: string; dot: string; text: string }> = {
  connected: {
    short: "Léa en ligne",
    long: "En ligne sur WhatsApp",
    dot: "bg-[#1fae5b] text-[#1fae5b]",
    text: "text-[#127a42]",
  },
  pending: {
    short: "Scan requis",
    long: "Scan WhatsApp requis",
    dot: "bg-warning text-warning",
    text: "text-warning",
  },
  waiting: {
    short: "Démarrage…",
    long: "Démarrage…",
    dot: "bg-ink-3 text-ink-3",
    text: "text-ink-2",
  },
  error: {
    short: "Léa hors ligne",
    long: "WhatsApp injoignable",
    dot: "bg-danger text-danger",
    text: "text-danger",
  },
};

// Un seul sondage pour toute l'application : la carte de la barre latérale,
// la pastille de l'en-tête et l'onglet mobile lisent le même état. Trois
// composants qui interrogent chacun /api/wa/qr toutes les 30 s, c'était trois
// fois le même appel.
let current: LeaStatus = "waiting";
const listeners = new Set<(s: LeaStatus) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function poll() {
  let next: LeaStatus = "error";
  try {
    const res = await fetch("/api/wa/qr", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { status?: LeaStatus };
      next = data.status ?? "error";
    }
  } catch {
    next = "error";
  }
  current = next;
  listeners.forEach((l) => l(next));
}

export function useLeaStatus(): LeaStatus {
  const [status, setStatus] = useState<LeaStatus>(current);
  useEffect(() => {
    listeners.add(setStatus);
    if (!timer) {
      void poll();
      timer = setInterval(poll, 30_000);
    }
    return () => {
      listeners.delete(setStatus);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return status;
}

export function StatusDot({ status, className }: { status: LeaStatus; className?: string }) {
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "connected" && "pulse-dot",
        LABELS[status].dot,
        className,
      )}
    />
  );
}

/**
 * État de Léa, l'agent IA WhatsApp.
 * · `card` : la carte vivante en bas de la barre latérale ;
 * · `pill` : la pastille compacte de l'en-tête.
 */
export function LeaStatusPill({ variant = "pill" }: { variant?: "card" | "pill" }) {
  const status = useLeaStatus();
  const cfg = LABELS[status];

  if (variant === "card") {
    return (
      <Link
        href="/agent/conversations"
        className="group flex items-center gap-3 rounded-[20px] border border-white/90 bg-white/60 p-2.5 pr-3 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.05)] transition-colors duration-200 hover:bg-white"
        title="Ouvrir les conversations de Léa"
      >
        <span className="relative size-10 shrink-0">
          <LeaAvatar ring={false} className="size-10" />
          <span className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full bg-white">
            <StatusDot status={status} className="size-2" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold tracking-[-0.015em] text-foreground">
            Léa · agent IA
          </span>
          <span className={cn("block truncate text-[11.5px] font-medium", cfg.text)}>
            {cfg.long}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/agent"
      className="flex h-10 items-center gap-2 rounded-full border border-white/90 bg-white/65 pl-3 pr-3.5 text-[12.5px] font-semibold tracking-[-0.01em] shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.05)] backdrop-blur-xl transition-colors hover:bg-white"
      title={cfg.long}
    >
      <StatusDot status={status} />
      <span className={cfg.text}>{cfg.short}</span>
    </Link>
  );
}
