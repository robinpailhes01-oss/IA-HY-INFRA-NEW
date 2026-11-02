import Link from "next/link";
import { ArrowUpRight, MessagesSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { ContactAvatar } from "@/components/agent/contact-avatar";

export type RecentConversation = {
  id: string;
  phone: string;
  name: string;
  initials: string;
  paused: boolean;
  unread: number;
  /** Déjà formatés côté serveur. */
  ago: string;
  preview: string | null;
};

/** Les derniers fils WhatsApp — un aperçu qui mène à la boîte de réception. */
export function RecentConversations({ items }: { items: RecentConversation[] }) {
  if (items.length === 0) {
    return (
      <EmptyState icon={<MessagesSquare />} title="Pas encore de conversation">
        Dès qu&apos;un client écrit sur WhatsApp, son fil apparaît ici.
      </EmptyState>
    );
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((c) => (
        <li key={c.id}>
          <Link
            href={`/agent/conversations?phone=${encodeURIComponent(c.phone)}`}
            className="group flex min-h-[60px] items-center gap-3 rounded-[18px] px-2 py-2 transition-colors hover:bg-white/70"
          >
            <ContactAvatar
              initials={c.initials}
              size="sm"
              badge={<span className={cn("size-2 rounded-full", c.paused ? "bg-warning" : "bg-ocean")} />}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                  {c.name}
                </span>
                <span className={cn("shrink-0 text-[11.5px] tabular-nums", c.unread ? "font-semibold text-ocean" : "text-ink-3")}>
                  {c.ago}
                </span>
              </span>
              <span className="mt-0.5 flex items-center gap-2">
                <span className="line-clamp-1 min-w-0 flex-1 text-[12.5px] text-ink-2">
                  {c.preview ?? (c.paused ? "Léa en pause sur ce fil" : "Léa tient la conversation")}
                </span>
                {c.unread > 0 && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-ocean px-1.5 text-[10.5px] font-semibold tabular-nums text-white">
                    {c.unread}
                  </span>
                )}
              </span>
            </span>
            <ArrowUpRight className="size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
