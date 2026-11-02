"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, MessagesSquare } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { ConversationList, type ListFilter } from "@/components/agent/inbox/conversation-list";
import { Thread } from "@/components/agent/inbox/thread";
import { ClientPanel } from "@/components/agent/inbox/client-panel";
import { ConnectPanel } from "@/components/agent/inbox/connect-panel";
import { ContactAvatar } from "@/components/agent/contact-avatar";
import { initialsOf } from "@/components/agent/format";
import type {
  ClientCard,
  ConnectionState,
  Conversation,
  Message,
} from "@/components/agent/inbox/types";

/**
 * La boîte de réception de Léa — les conversations WhatsApp en direct.
 *
 * Trois volets sur grand écran (fils · conversation · fiche client), un seul
 * à la fois sur téléphone. Tout est sondé, pas poussé : QR toutes les 4 s,
 * liste toutes les 5 s, fil ouvert toutes les 3 s. La fiche client ne change
 * pas au rythme des messages : elle n'est rechargée qu'au changement de fil.
 *
 * `?phone=<numéro>` présélectionne un fil (liens du Pilotage, de la cloche).
 */
export function Inbox() {
  const search = useSearchParams();
  const phoneParam = search.get("phone");

  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(phoneParam);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [pending, setPending] = useState<Message[]>([]);
  const [client, setClient] = useState<ClientCard | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [cardOpen, setCardOpen] = useState(true);
  // Sous xl il n'y a pas la place pour trois volets : la fiche prend alors
  // la place du fil, atteignable par un bouton. Sans ça elle était
  // simplement invisible sur téléphone.
  const [cardOnTop, setCardOnTop] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Un lien vers ce même écran avec un autre ?phone= (la cloche, une autre
  // carte) doit ouvrir ce fil même si la page est déjà montée.
  useEffect(() => {
    if (phoneParam) setSelectedPhone(phoneParam);
  }, [phoneParam]);

  // Un lien venu d'ailleurs (fiche lead, Pilotage) porte le numéro tel que
  // la fiche le stocke : « 06 71 … », « +33 6 71 … ». WhatsApp, lui, garde
  // « +33671… ». Sans correspondance exacte, on rattache le lien au fil dont
  // les 9 derniers chiffres concordent — sinon le fil s'ouvrait vide.
  useEffect(() => {
    if (!selectedPhone || conversations.length === 0) return;
    if (conversations.some((c) => c.customer_phone === selectedPhone)) return;
    const tail = selectedPhone.replace(/\D/g, "").slice(-9);
    if (tail.length < 9) return;
    const match = conversations.find((c) => c.customer_phone.replace(/\D/g, "").slice(-9) === tail);
    if (!match) return;
    setSelectedPhone(match.customer_phone);
    window.history.replaceState(null, "", `?phone=${encodeURIComponent(match.customer_phone)}`);
  }, [conversations, selectedPhone]);

  // ── Sondages ─────────────────────────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/wa/qr", { cache: "no-store" });
        setConnection(res.ok ? await res.json() : { status: "error" });
      } catch {
        setConnection({ status: "error" });
      }
    };
    poll();
    const id = setInterval(poll, 4_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/agent/conversations/feed", { cache: "no-store" });
        if (res.ok) setConversations(await res.json());
      } catch {
        // Réseau coupé : on garde la dernière liste connue.
      } finally {
        setLoaded(true);
        setNow(Date.now());
      }
    };
    load();
    const id = setInterval(load, 5_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedPhone) {
      setMessages([]);
      return;
    }
    let active = true;
    setMessages([]);
    setPending([]);
    setLoadingThread(true);
    const load = async () => {
      try {
        const res = await fetch(`/api/wa/messages?phone=${encodeURIComponent(selectedPhone)}`, {
          cache: "no-store",
        });
        if (res.ok && active) {
          const fresh: Message[] = await res.json();
          setMessages(fresh);
          // Un message envoyé d'ici disparaît de « en cours » dès que le
          // service WhatsApp l'a enregistré dans le fil.
          setPending((prev) => prev.filter((p) => !fresh.some((m) => m.from_me && m.body === p.body)));
        }
      } finally {
        if (active) setLoadingThread(false);
      }
    };
    load();
    const id = setInterval(load, 3_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [selectedPhone]);

  useEffect(() => {
    if (!selectedPhone) {
      setClient(null);
      return;
    }
    let active = true;
    setClient(null);
    // Une seule requête : /api/wa/client renvoie aussi le mémo de Léa.
    fetch(`/api/wa/client?phone=${encodeURIComponent(selectedPhone)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((card: ClientCard | null) => {
        if (active) setClient(card);
      })
      .catch(() => active && setClient(null));
    return () => {
      active = false;
    };
  }, [selectedPhone]);

  // ── Actions ──────────────────────────────────────────────────────────
  const select = useCallback((phone: string | null) => {
    setSelectedPhone(phone);
    setCardOnTop(false);
    setReply("");
    // L'adresse suit la sélection (un rechargement rouvre le même fil),
    // sans aller-retour serveur.
    const url = phone ? `?phone=${encodeURIComponent(phone)}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = reply.trim();
    if (!text || !selectedPhone) return;
    setSending(true);
    const local: Message = {
      id: `local-${Date.now()}`,
      from_me: true,
      is_from_human: true,
      body: text,
      created_at: new Date().toISOString(),
      pending: true,
    };
    try {
      const res = await fetch("/api/wa/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: selectedPhone, message: text }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setPending((prev) => [...prev, local]);
      setReply("");
    } catch {
      toast.error("Message non envoyé", {
        description: "Le service WhatsApp n'a pas répondu. Ton texte est resté dans le champ.",
      });
    } finally {
      setSending(false);
    }
  }, [reply, selectedPhone]);

  const togglePause = useCallback(async () => {
    if (!selectedPhone) return;
    const conv = conversations.find((c) => c.customer_phone === selectedPhone);
    const wasPaused = conv?.is_paused ?? false;
    const flip = (paused: boolean) =>
      setConversations((prev) =>
        prev.map((c) => (c.customer_phone === selectedPhone ? { ...c, is_paused: paused } : c)),
      );
    flip(!wasPaused);
    try {
      const res = await fetch("/api/wa/pause", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: selectedPhone, action: wasPaused ? "resume" : "pause" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success(wasPaused ? "Léa reprend la conversation" : "Léa est en pause sur ce fil (24 h)");
    } catch {
      flip(wasPaused);
      toast.error("Impossible de joindre le service WhatsApp", {
        description: "L'état de Léa n'a pas changé.",
      });
    }
  }, [conversations, selectedPhone]);

  // ── Dérivés ──────────────────────────────────────────────────────────
  const selectedConv = conversations.find((c) => c.customer_phone === selectedPhone);
  const displayName = client?.name ?? selectedConv?.customer_name ?? selectedPhone ?? "";
  const thread = useMemo(() => [...messages, ...pending], [messages, pending]);
  const pausedCount = conversations.filter((c) => c.is_paused).length;
  const unreadCount = conversations.filter((c) => (c.unread_count ?? 0) > 0).length;
  // Ce qui attend quelqu'un : des messages non lus, ou un fil où Léa est en
  // pause et où le client a parlé en dernier (même règle que la liste).
  const waiting = conversations
    .filter(
      (c) =>
        (c.unread_count ?? 0) > 0 ||
        (c.is_paused && c.last_message !== null && !c.last_message.from_me),
    )
    .slice(0, 3);

  const notConnected = connection !== null && connection.status !== "connected";

  return (
    <div
      className={cn(
        // Sur bureau, la boîte occupe l'écran et seuls les volets défilent :
        // -mb-28 annule le lg:pb-28 du <main>, sinon la page glissait de 64 px.
        "flex flex-col gap-4 lg:-mb-28 lg:h-[calc(100dvh-8rem)] lg:gap-5",
        // Sur téléphone, un fil ouvert tient pile entre l'en-tête (143 px :
        // marque + sous-onglets) et la barre d'onglets flottante (66 px, posée
        // à max(12 px, zone sûre) du bas), 12 px d'air au-dessus : le champ de
        // réponse reste sous le pouce, jamais dessous. La marge négative
        // absorbe le pb-44 du <main> : la page elle-même ne défile pas.
        // (La bulle de Léa est masquée sur cet écran : rien à contourner.)
        selectedPhone &&
          !notConnected &&
          "-mb-24 h-[calc(100dvh-221px-max(12px,env(safe-area-inset-bottom)))]",
      )}
    >
      <PageHeader
        className={cn("shrink-0", selectedPhone && !notConnected && "hidden lg:flex")}
        eyebrow="Agent WhatsApp · en direct"
        title={
          <>
            Les <em>conversations</em>
          </>
        }
        description="Léa répond à chaque message. Écris toi-même quand tu veux : elle se met en pause 24 h sur ce fil."
        actions={
          loaded ? <StatChips total={conversations.length} unread={unreadCount} paused={pausedCount} /> : null
        }
      />

      {notConnected ? (
        <ConnectPanel state={connection} />
      ) : (
        <div className="flex min-h-0 flex-1 gap-4 lg:gap-5">
          <ConversationList
            conversations={conversations}
            loaded={loaded}
            selectedPhone={selectedPhone}
            onSelect={select}
            query={query}
            onQuery={setQuery}
            filter={filter}
            onFilter={setFilter}
            now={now}
            className={cn(
              "w-full lg:w-[310px] lg:shrink-0 xl:w-[320px]",
              selectedPhone ? "hidden lg:flex" : "flex",
            )}
          />

          {selectedPhone ? (
            <Thread
              phone={selectedPhone}
              conv={selectedConv}
              displayName={displayName}
              messages={thread}
              loading={loadingThread}
              reply={reply}
              onReply={setReply}
              onSend={sendMessage}
              sending={sending}
              onTogglePause={togglePause}
              onBack={() => select(null)}
              cardOpen={cardOpen}
              onToggleCard={() => setCardOpen((v) => !v)}
              onShowCard={() => setCardOnTop(true)}
              className={cn("flex-1", cardOnTop ? "hidden xl:flex" : "flex")}
            />
          ) : (
            <div className="vitre hidden min-w-0 flex-1 place-items-center rounded-[24px] p-8 lg:grid">
              <div className="relative z-[1] flex w-full max-w-sm flex-col items-center text-center">
                <span className="mb-4 grid size-14 place-items-center rounded-full bg-white text-ocean shadow-[var(--shadow-lift)]">
                  <MessagesSquare className="size-6" strokeWidth={1.7} />
                </span>
                {/* Geist, comme l'EmptyState du kit : le serif reste au titre de page. */}
                <p className="text-[17px] font-semibold tracking-[-0.022em] text-foreground">
                  {waiting.length > 0 ? "Par où commencer" : "Choisis une conversation"}
                </p>
                <p className="t-body mt-1.5 text-ink-2">
                  {waiting.length > 0
                    ? "Ces fils ont des messages que personne n'a encore lus, ou attendent ta réponse."
                    : "Léa tient chaque fil en direct. Ouvre un échange pour le relire, voir la fiche du client ou reprendre la main."}
                </p>
                {/* Un raccourci vers ce qui attend vraiment : le volet vide
                    devient le point de départ, pas un écran d'attente. */}
                {waiting.length > 0 && (
                  <ul className="mt-5 flex w-full flex-col gap-2">
                    {waiting.map((c) => {
                      const unread = c.unread_count ?? 0;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => select(c.customer_phone)}
                            className="group flex h-14 w-full items-center gap-3 rounded-full border border-white/90 bg-white/75 pl-2 pr-4 text-left shadow-[var(--shadow-glass)] transition-colors hover:bg-white"
                          >
                            <ContactAvatar initials={initialsOf(c.customer_name, c.customer_phone)} size="sm" />
                            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">
                              {c.customer_name ?? c.customer_phone}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 text-[12px] font-medium",
                                unread > 0 ? "text-ocean" : "text-warning",
                              )}
                            >
                              {unread > 0
                                ? `${unread} non lu${unread > 1 ? "s" : ""}`
                                : "À toi de répondre"}
                            </span>
                            <ArrowRight className="size-3.5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {selectedPhone && (cardOpen || cardOnTop) && (
            <ClientPanel
              client={client}
              onClose={() => setCardOnTop(false)}
              className={cn(
                "w-full xl:w-[320px] xl:shrink-0",
                cardOnTop ? "flex flex-1 xl:flex-none" : "hidden xl:flex",
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Les trois compteurs de la boîte, réunis dans UNE pilule de verre : trois
 * pastilles séparées passaient à la ligne une par une vers 1 200 px.
 */
function StatChips({ total, unread, paused }: { total: number; unread: number; paused: number }) {
  const parts: Array<{ value: number; label: string; tone: string }> = [
    { value: total, label: total > 1 ? "fils" : "fil", tone: "text-foreground" },
  ];
  if (unread > 0) parts.push({ value: unread, label: unread > 1 ? "non lus" : "non lu", tone: "text-ocean" });
  if (paused > 0) parts.push({ value: paused, label: "en pause", tone: "text-warning" });
  return (
    <span className="inline-flex h-10 items-center divide-x divide-[var(--hairline)] whitespace-nowrap rounded-full border border-white/90 bg-white/65 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.05)]">
      {parts.map((p) => (
        <span key={p.label} className="inline-flex items-center gap-1.5 px-3.5">
          <span className={cn("n-inline text-[14px]", p.tone)}>{p.value}</span>
          <span className="text-[12.5px] text-ink-2">{p.label}</span>
        </span>
      ))}
    </span>
  );
}
