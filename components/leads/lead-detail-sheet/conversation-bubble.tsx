"use client";

import { Sparkles, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/app/(dashboard)/leads/actions";

/**
 * Une bulle du journal de conversation, dans la même grammaire que la boîte
 * de réception : client en verre blanc à gauche, Léa en océan (étincelle),
 * l'équipe en marine (« Toi »).
 */
export function ConversationBubble({ message }: { message: ConversationMessage }) {
  const isClient = message.from === "client";
  const isAi = message.from === "ai";
  const time = message.at
    ? new Date(message.at).toLocaleString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className={cn("flex flex-col gap-1", isClient ? "items-start" : "items-end")}>
      <div
        className={cn(
          "max-w-[86%] whitespace-pre-wrap break-words rounded-[20px] px-3.5 py-2 text-[14px] leading-[1.45]",
          isClient &&
            "rounded-bl-[6px] border border-white bg-white/90 text-foreground shadow-[0_1px_2px_rgba(11,37,69,0.06),0_8px_20px_-14px_rgba(11,37,69,0.3)]",
          isAi &&
            "rounded-br-[6px] bg-[linear-gradient(155deg,#5da5ee_0%,#2f7fe0_55%,#2b72d6_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_20px_-12px_rgba(47,127,224,0.65)]",
          !isClient &&
            !isAi &&
            "rounded-br-[6px] bg-[linear-gradient(160deg,#1d4c84_0%,#0b2545_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_20px_-12px_rgba(11,37,69,0.6)]",
        )}
      >
        {message.text}
      </div>
      <p className="flex items-center gap-1 px-1.5 text-[11px] text-ink-3">
        {isAi && (
          <>
            <Sparkles className="size-3 text-ocean" strokeWidth={2} />
            <span className="font-medium text-ocean">Léa</span>
            <span aria-hidden>·</span>
          </>
        )}
        {!isClient && !isAi && (
          <>
            <UserRound className="size-3 text-navy" strokeWidth={2} />
            <span className="font-medium text-navy">Toi</span>
            <span aria-hidden>·</span>
          </>
        )}
        {isClient && <span className="font-medium text-ink-2">Client</span>}
        {isClient && time && <span aria-hidden>·</span>}
        {time && <span className="tabular-nums">{time}</span>}
      </p>
    </div>
  );
}
