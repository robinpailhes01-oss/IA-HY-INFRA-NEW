"use client";

import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Check, Loader2, Mail, MessageSquare, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { channelMeta, type Lead } from "@/lib/leads";
import {
  getConversations,
  sendMessage,
  updateAiMemo,
  type ConversationRow,
} from "@/app/(dashboard)/leads/actions";
import { ConversationBubble } from "@/components/leads/lead-detail-sheet/conversation-bubble";

export function TabConversations({
  lead,
  onPatch,
}: {
  lead: Lead;
  onPatch: (patch: Partial<Lead>) => void;
}) {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [memo, setMemo] = useState(lead.ai_memo ?? "");
  const [memoState, setMemoState] = useState<"idle" | "saving" | "saved">("idle");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const memoSaved = useRef(lead.ai_memo ?? "");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMemo(lead.ai_memo ?? "");
    memoSaved.current = lead.ai_memo ?? "";
    getConversations(lead.id).then((res) => {
      if (!active) return;
      setConversations(res.ok ? res.data : []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [lead.id, lead.ai_memo]);

  const saveMemo = useDebouncedCallback(async (next: string) => {
    if (next === memoSaved.current) return;
    setMemoState("saving");
    const res = await updateAiMemo(lead.id, next);
    if (res.ok) {
      memoSaved.current = next;
      onPatch({ ai_memo: next || null });
      setMemoState("saved");
      setTimeout(() => setMemoState("idle"), 1500);
    } else {
      setMemoState("idle");
    }
  }, 1500);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await sendMessage(lead.id, text);
    setSending(false);
    if (!res.ok) {
      toast.error("Échec de l'envoi", { description: res.error });
      return;
    }
    const { messages, delivered, channel } = res.data;
    setConversations((prev) => {
      if (prev.length === 0) {
        return [
          {
            id: "local",
            channel: lead.source_channel,
            summary: null,
            outcome: null,
            messages,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      }
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], messages };
      return next;
    });
    // Répondre = reprendre la main : Léa est mise en pause et l'escalade levée.
    onPatch({ last_interaction_at: new Date().toISOString(), needs_human_intervention: false });
    setDraft("");

    if (delivered && channel === "whatsapp") {
      toast.success("Message WhatsApp envoyé", { description: "Léa est en pause sur cette conversation." });
    } else if (delivered && channel === "email") {
      toast.success("Email envoyé");
    } else {
      toast.warning("Message enregistré, non transmis", {
        description:
          channel === "whatsapp"
            ? "Service WhatsApp non configuré — envoyez-le manuellement."
            : "Ce canal n'est pas encore branché à l'envoi automatique.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gold/30 bg-gold/5 p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Sparkles className="size-4 text-gold" /> Mémo IA
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {memoState === "saving" && <Loader2 className="size-3 animate-spin" />}
            {memoState === "saved" && <Check className="size-3 text-success" />}
          </span>
        </div>
        <Textarea
          value={memo}
          onChange={(e) => {
            setMemo(e.target.value);
            saveMemo(e.target.value);
          }}
          onBlur={() => saveMemo.flush()}
          placeholder="Contexte retenu par l'assistant…"
          className="min-h-[64px] resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Chargement…
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          <MessageSquare className="size-6 opacity-50" />
          Aucune conversation pour l&apos;instant.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {conversations.map((conv) => {
            const meta = channelMeta(conv.channel);
            const Icon = meta.Icon;
            return (
              <div key={conv.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="size-3" />
                  {meta.label}
                </div>
                {conv.summary && (
                  <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs italic text-muted-foreground">
                    {conv.summary}
                  </p>
                )}
                <div className="flex flex-col gap-3">
                  {conv.messages.map((m, i) => (
                    <ConversationBubble key={i} message={m} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-0 flex items-end gap-2 border-t border-border bg-popover pt-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
          }}
          placeholder={
            lead.source_channel === "email"
              ? "Écrire un email…"
              : "Écrire un message…"
          }
          className="min-h-[44px] flex-1 resize-none"
        />
        <Button size="icon" onClick={handleSend} disabled={sending || !draft.trim()}>
          {sending ? (
            <Loader2 className="animate-spin" />
          ) : lead.source_channel === "email" ? (
            <Mail />
          ) : (
            <Send />
          )}
        </Button>
      </div>
    </div>
  );
}
