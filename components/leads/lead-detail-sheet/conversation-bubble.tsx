"use client";

import { Bot, User, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/app/(dashboard)/leads/actions";

const ROLE = {
  client: { label: "Client", Icon: UserRound },
  ai: { label: "Léa (IA)", Icon: Bot },
  human: { label: "Équipe", Icon: User },
} as const;

export function ConversationBubble({ message }: { message: ConversationMessage }) {
  const isClient = message.from === "client";
  const role = ROLE[message.from] ?? ROLE.human;
  const RoleIcon = role.Icon;
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
      <div className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
        <RoleIcon className="size-3" />
        {role.label}
        {time && <span className="opacity-70">· {time}</span>}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
          isClient
            ? "rounded-tl-sm bg-muted text-foreground"
            : message.from === "ai"
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tr-sm bg-gold/15 text-foreground",
        )}
      >
        {message.text}
      </div>
    </div>
  );
}
