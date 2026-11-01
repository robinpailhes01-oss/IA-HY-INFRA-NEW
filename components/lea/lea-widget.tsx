"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Mic, MicOff, RotateCcw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { LeaAvatar, type LeaState } from "@/components/lea/lea-avatar";
import { LEA_ASK_EVENT } from "@/components/lea/ask-lea";

// ═══════════════════════════════════════════════════════════════════════
// LÉA — la manageuse, accessible de partout (bas droite).
//
// Le cerveau n'est PAS ici : c'est l'agent Manager déjà en production
// (supabase/functions/dashboard-agent, cerveau partagé avec Telegram dans
// _shared/manager-agent.ts), joint via /api/jarvis — la même route que la
// page Jarvis, donc la même mémoire de conversation. Il lit les chiffres
// (stats, leads, réservations, trésorerie, dépenses, marketing) et AGIT
// réellement : relance WhatsApp, réponse email, ajout/suppression de
// dépense, mouvement d'espèces, changement de config de Léa (celui-ci
// toujours soumis à confirmation explicite). Ses garde-fous contre les
// confirmations inventées vivent côté serveur.
//
// Ici : la présence (son avatar), la conversation, la dictée vocale, et le
// rafraîchissement des données affichées après chaque réponse — une
// dépense ajoutée par Léa doit apparaître sans recharger la page.
// ═══════════════════════════════════════════════════════════════════════

type Msg = { id: string; role: "user" | "lea"; text: string; failed?: boolean };

const STORAGE_KEY = "hy-lea-chat-v1";

const SUGGESTIONS = [
  "Qui attend une réponse de ma part ?",
  "Combien j'ai encaissé ce mois-ci ?",
  "Quelles sorties cette semaine ?",
  "Comment va la trésorerie ?",
  "Ajoute 45 € de gasoil aujourd'hui",
  "Relance les devis envoyés cette semaine",
];

// Reconnaissance vocale native du navigateur (Chrome, Edge, Safari) — même
// approche que la page Jarvis : gratuite, instantanée, aucun audio envoyé.
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>; resultIndex: number }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function createRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function LeaWidget() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);

  // Capacités du navigateur, lues une fois montées (jamais au rendu serveur).
  useEffect(() => {
    setVoiceOk(Boolean(createRecognition()));
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved) as Msg[]);
    } catch {
      /* stockage indisponible (navigation privée) : on repart à vide */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* idem */
    }
  }, [messages]);

  // Une page peut ouvrir Léa (et lui poser une question) via askLea().
  const sendRef = useRef<(text: string) => void>(() => {});
  useEffect(() => {
    const onAsk = (e: Event) => {
      setOpen(true);
      const q = (e as CustomEvent<string | undefined>).detail;
      if (q) setTimeout(() => sendRef.current(q), 120);
    };
    window.addEventListener(LEA_ASK_EVENT, onAsk);
    return () => window.removeEventListener(LEA_ASK_EVENT, onAsk);
  }, []);

  // ⌘J / Ctrl+J ouvre Léa de n'importe où ; Échap la referme.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || pending) return;
      setInput("");
      setMessages((m) => [...m, { id: newId(), role: "user", text }]);
      setPending(true);
      try {
        const res = await fetch("/api/jarvis", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
        const reply = data.reply ?? data.error ?? "Je n'ai pas pu répondre — réessaie dans un instant.";
        setMessages((m) => [...m, { id: newId(), role: "lea", text: reply, failed: !res.ok || !data.reply }]);
        setSpeaking(true);
        setTimeout(() => setSpeaking(false), 2400);
        // Léa a peut-être modifié des données (dépense, relance…) : on
        // recharge les composants serveur de la page affichée.
        router.refresh();
      } catch {
        setMessages((m) => [
          ...m,
          { id: newId(), role: "lea", text: "Je n'arrive pas à joindre le serveur. Vérifie la connexion et réessaie.", failed: true },
        ]);
      } finally {
        setPending(false);
      }
    },
    [pending, router],
  );

  useEffect(() => {
    sendRef.current = (text: string) => void send(text);
  }, [send]);

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = createRecognition();
    if (!rec) return;
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput((finalText + interim).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) void send(finalText);
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const reset = () => {
    setMessages([]);
    setInput("");
  };

  // La page Jarvis EST déjà Léa en plein écran (même cerveau, en vocal).
  if (pathname.startsWith("/jarvis")) return null;

  // Sur la messagerie WhatsApp, la bulle recouvrirait la zone de saisie : on
  // ne l'affiche pas, mais ⌘J et askLea() ouvrent toujours le panneau.
  const hideLauncher = pathname.startsWith("/agent/conversations");

  const leaState: LeaState = listening ? "listening" : pending ? "thinking" : speaking ? "speaking" : "idle";

  return (
    <>
      {/* ── Le bouton : Léa, flottante ─────────────────────────────── */}
      <AnimatePresence>
        {!open && !hideLauncher && (
          <motion.button
            key="lea-launcher"
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.6, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            aria-label="Demander à Léa (⌘J)"
            className={cn(
              "group fixed right-4 z-[45] size-[60px] rounded-full lg:right-7 lg:size-[68px]",
              // Au-dessus de la barre d'onglets sur téléphone.
              "bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+78px)] lg:bottom-7",
            )}
          >
            {/* Halo : la lumière que Léa projette sur le verre derrière elle. */}
            <span className="absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgba(124,192,245,0.55),rgba(47,127,224,0.12)_55%,transparent_72%)] blur-md" />
            <span className="absolute inset-0 rounded-full border border-white/90 bg-white/40 shadow-[inset_0_1px_0_#fff,0_14px_30px_-10px_rgba(11,37,69,0.45)] backdrop-blur-md" />
            <LeaAvatar state={leaState} tilt priority className="absolute inset-[4px]" />
            <span className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-white shadow-[0_1px_3px_rgba(11,37,69,0.25)]">
              <span className="size-2 rounded-full bg-[#1fae5b]" />
            </span>
            <span className="pointer-events-none absolute right-[calc(100%+12px)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full bg-navy px-3.5 py-2 text-[12.5px] font-medium text-white opacity-0 shadow-[0_10px_24px_-10px_rgba(11,37,69,0.6)] transition-opacity duration-200 group-hover:opacity-100 lg:block">
              Demander à Léa <span className="ml-1 text-white/55">⌘J</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Le panneau ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.section
            key="lea-panel"
            role="dialog"
            aria-label="Léa, ta manageuse"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            style={{ transformOrigin: "bottom right" }}
            className={cn(
              "vitre-strong fixed z-[46] flex flex-col overflow-hidden rounded-[28px]",
              "inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] top-[max(4.5rem,8dvh)]",
              "sm:inset-x-auto sm:right-6 sm:top-auto sm:bottom-6 sm:h-[min(680px,calc(100dvh-3rem))] sm:w-[410px]",
            )}
          >
            {/* En-tête marine : la présence de Léa. */}
            <header className="vitre-signature relative flex shrink-0 items-center gap-3.5 rounded-none border-0 px-5 py-4">
              <LeaAvatar state={leaState} className="size-16 shrink-0" />
              <div className="relative min-w-0 flex-1">
                <p className="t-eyebrow text-[#9fc6ee]">Ta manageuse</p>
                <h2 className="font-serif text-[28px] leading-none tracking-[-0.01em] text-white">Léa</h2>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-white/70">
                  {pending ? "Je consulte le tableau de bord…" : listening ? "Je t'écoute…" : "Je lis tout, et j'agis."}
                </p>
              </div>
              <div className="relative flex shrink-0 items-center gap-1.5">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={reset}
                    className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                    aria-label="Nouvelle conversation"
                    title="Nouvelle conversation"
                  >
                    <RotateCcw className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                  aria-label="Fermer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            {/* Fil */}
            <div ref={listRef} className="scroll-soft min-h-0 flex-1 overflow-y-auto px-4 py-5">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col">
                  <p className="font-serif text-[25px] leading-tight tracking-[-0.01em] text-foreground">
                    Bonjour Robin. <em className="italic text-ocean">Que veux-tu savoir&nbsp;?</em>
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                    Demande-moi un chiffre, une liste, un point sur la saison — ou
                    une action : relancer quelqu&apos;un, noter une dépense, changer une offre.
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-6">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="rounded-full border border-white bg-white/80 px-3.5 py-2 text-left text-[12.5px] font-medium text-foreground shadow-[var(--shadow-glass)] transition-colors hover:bg-white hover:text-ocean"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ul className="space-y-3">
                  {messages.map((m) => (
                    <li key={m.id} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                      {m.role === "lea" && (
                        <LeaAvatar ring={false} className="mt-0.5 size-7 shrink-0" />
                      )}
                      <p
                        className={cn(
                          "max-w-[84%] whitespace-pre-wrap rounded-[20px] px-3.5 py-2.5 text-[13.5px] leading-relaxed",
                          m.role === "user"
                            ? "rounded-br-md bg-[linear-gradient(170deg,#183f6d,#0b2545)] text-white shadow-[0_8px_18px_-10px_rgba(11,37,69,0.6)]"
                            : m.failed
                              ? "rounded-bl-md border border-[rgba(224,77,85,0.2)] bg-[rgba(224,77,85,0.06)] text-foreground"
                              : "rounded-bl-md border border-white bg-white/85 text-foreground shadow-[var(--shadow-glass)]",
                        )}
                      >
                        {m.text}
                      </p>
                    </li>
                  ))}
                  {pending && (
                    <li className="flex items-center gap-2">
                      <LeaAvatar state="thinking" className="size-7 shrink-0" />
                      <span className="flex items-center gap-1 rounded-[20px] rounded-bl-md border border-white bg-white/85 px-3.5 py-3 shadow-[var(--shadow-glass)]">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="size-1.5 animate-bounce rounded-full bg-ocean/70"
                            style={{ animationDelay: `${i * 140}ms` }}
                          />
                        ))}
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="shrink-0 border-t border-[var(--hairline)] bg-white/50 p-3"
            >
              <div className="flex items-end gap-2 rounded-[24px] border border-[rgba(11,37,69,0.1)] bg-white p-1.5 pl-4 shadow-[inset_0_1px_2px_rgba(11,37,69,0.04)] focus-within:border-ocean/40 focus-within:ring-4 focus-within:ring-ocean/10">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  rows={1}
                  placeholder={listening ? "Je t'écoute…" : "Demande ou ordonne à Léa…"}
                  className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-[14px] leading-snug text-foreground outline-none [field-sizing:content] placeholder:text-ink-3"
                />
                {voiceOk && (
                  <button
                    type="button"
                    onClick={toggleVoice}
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full transition-colors",
                      listening ? "bg-danger text-white" : "text-ink-2 hover:bg-[rgba(11,37,69,0.06)] hover:text-foreground",
                    )}
                    aria-label={listening ? "Arrêter la dictée" : "Dicter à Léa"}
                  >
                    {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!input.trim() || pending}
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(170deg,#183f6d,#0b2545)] text-white shadow-[0_6px_14px_-6px_rgba(11,37,69,0.6)] transition-opacity disabled:opacity-35"
                  aria-label="Envoyer"
                >
                  <ArrowUp className="size-4" />
                </button>
              </div>
              <p className="mt-2 px-2 text-center text-[11px] text-ink-3">
                Léa agit pour de vrai — relances et dépenses sont exécutées ; une modification d&apos;offre attend ton « oui ».
              </p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
