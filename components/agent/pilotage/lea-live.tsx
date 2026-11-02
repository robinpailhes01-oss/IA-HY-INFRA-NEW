"use client";

import { cn } from "@/lib/utils";
import { StatusDot, useLeaStatus, type LeaStatus } from "@/components/lea-status-pill";
import { LeaAvatar } from "@/components/lea/lea-avatar";

// L'état de Léa en direct, posé dans le panneau marine du Pilotage. Îlot
// client minimal : il lit le même sondage partagé que la pastille de
// l'en-tête (useLeaStatus), sans rien interroger de plus.
const LABEL: Record<LeaStatus, { text: string; tone: string }> = {
  connected: { text: "En ligne · répond sur WhatsApp", tone: "text-[#8fe3b4]" },
  pending: { text: "Scan requis · WhatsApp à reconnecter", tone: "text-[#f6c784]" },
  waiting: { text: "Démarrage du service…", tone: "text-[#a9c8ea]" },
  error: { text: "Hors ligne · service injoignable", tone: "text-[#ffa3a8]" },
};

export function LeaLive({ className }: { className?: string }) {
  const status = useLeaStatus();
  const cfg = LABEL[status];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Le même visage que la bulle flottante : une seule Léa. */}
      <span className="relative size-11 shrink-0">
        <LeaAvatar state={status === "connected" ? "idle" : "listening"} className="size-11" />
        <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-[#0b2545]">
          <StatusDot status={status} className="size-2" />
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold tracking-[-0.015em] text-white">
          Léa · agent IA
        </span>
        <span className={cn("block truncate text-[12.5px] font-medium", cfg.tone)}>{cfg.text}</span>
      </span>
    </div>
  );
}
