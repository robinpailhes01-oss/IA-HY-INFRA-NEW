"use client";

import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Check, Loader2, Mail, MessageSquare, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { ChannelLogo } from "@/components/leads/channel-logo";
import { channelLabel } from "@/components/agent/channels";
import type { Lead } from "@/lib/leads";
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
      {/* La mémoire de Léa sur ce contact : ce qu'elle réutilise à chaque
          réponse. Modifiable — corriger le mémo, c'est corriger l'agent. */}
      <div className="rounded-[20px] border border-[rgba(47,127,224,0.16)] bg-[linear-gradient(160deg,rgba(47,127,224,0.08),rgba(124,192,245,0.06))] p-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ocean">
            <Sparkles className="size-3.5" strokeWidth={2} /> Ce que Léa a retenu
          </span>
          <span className="flex items-center gap-1 text-[11.5px] text-ink-3">
            {memoState === "saving" && <Loader2 className="size-3 animate-spin" />}
            {memoState === "saved" && (
              <>
                <Check className="size-3 text-success" /> Enregistré
              </>
            )}
          </span>
        </div>
        <Textarea
          value={memo}
          onChange={(e) => {
            setMemo(e.target.value);
            saveMemo(e.target.value);
          }}
          onBlur={() => saveMemo.flush()}
          placeholder="Contexte retenu par l'agent : occasion, préférences, objections…"
          className="min-h-[64px] resize-none rounded-none border-0 bg-transparent p-0 text-[13.5px] leading-relaxed shadow-none focus-visible:bg-transparent focus-visible:ring-0"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-[13px] text-ink-3">
          <Loader2 className="mr-2 size-4 animate-spin" /> Chargement…
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState icon={<MessageSquare />} title="Aucune conversation pour l'instant">
          Le premier échange avec ce contact apparaîtra ici, quel que soit le canal.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {conversations.map((conv) => {
            return (
              <div key={conv.id} className="flex flex-col gap-3">
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/90 bg-white/70 px-3 py-1 text-[11.5px] font-medium text-ink-2 shadow-[inset_0_1px_0_#fff]">
                    <ChannelLogo channel={conv.channel} className="size-3" />
                    {channelLabel(conv.channel)}
                    {conv.created_at && (
                      <span className="text-ink-3">
                        · {new Date(conv.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </span>
                </div>
                {conv.summary && (
                  <p className="vitre-inset rounded-[16px] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
                    <span className="font-semibold text-foreground">Résumé · </span>
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

      {/* Collé en bas du panneau ; -mb-4/pb-4 recouvre la marge intérieure du
          conteneur, sinon les bulles défilaient visibles SOUS le champ. */}
      <div className="sticky bottom-0 -mx-5 -mb-4 flex items-end gap-2 border-t border-[var(--hairline)] bg-[rgba(250,252,255,0.97)] px-5 pb-4 pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
          }}
          placeholder={
            lead.source_channel === "email"
              ? "Écrire un email… (⌘ + Entrée pour envoyer)"
              : "Écrire un message… (⌘ + Entrée pour envoyer)"
          }
          className="min-h-12 flex-1 resize-none rounded-[24px] py-3"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          aria-label="Envoyer"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-[linear-gradient(160deg,#1d4c84,#0b2545)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_18px_-8px_rgba(11,37,69,0.6)] transition-[transform,filter,opacity] duration-200 hover:brightness-110 active:scale-95 disabled:opacity-40"
        >
          {sending ? (
            <Loader2 className="size-[18px] animate-spin" />
          ) : lead.source_channel === "email" ? (
            <Mail className="size-[18px]" />
          ) : (
            <Send className="size-[18px]" />
          )}
        </button>
      </div>
    </div>
  );
}
