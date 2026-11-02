"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { StatusDot, useLeaStatus, type LeaStatus } from "@/components/lea-status-pill";

// L'état de Léa, version panneau marine : le brief dit ce qu'elle a vu, la
// pastille dit qu'elle est toujours là. Même sondage partagé que l'en-tête
// (useLeaStatus) — aucun appel réseau en plus.
const TEXTE: Record<LeaStatus, string> = {
  connected: "Léa en ligne",
  pending: "Scan WhatsApp requis",
  waiting: "Connexion…",
  error: "Léa hors ligne",
};

export function LeaLiveBadge() {
  const status = useLeaStatus();
  return (
    <Link
      href="/agent/conversations"
      title="Ouvrir les conversations de Léa"
      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/[0.07] pl-3.5 pr-3 text-[12.5px] font-semibold tracking-[-0.01em] text-[#dcebfa] outline-none transition-colors duration-200 hover:bg-white/[0.12] focus-visible:ring-4 focus-visible:ring-white/20 sm:h-9"
    >
      <StatusDot status={status} />
      {/* Sur bureau, l'état de Léa est déjà dans l'en-tête juste au-dessus :
          la pastille y devient l'entrée vers ses conversations. */}
      <span className="lg:hidden">{TEXTE[status]}</span>
      <span className="hidden lg:inline">Ses conversations</span>
      <ArrowUpRight className="size-3.5 text-[#9fb8d6]" />
    </Link>
  );
}
