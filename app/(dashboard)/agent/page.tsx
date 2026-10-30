'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot, Loader2, PanelRightClose, PanelRightOpen, Search, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface Conversation {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  is_paused: boolean;
  paused_until: string | null;
  last_message_at: string;
}

interface Message {
  id: string;
  from_me: boolean;
  is_from_human: boolean;
  body: string;
  created_at: string;
}

interface Booking {
  id: string;
  date: string | null;
  offer_name: string | null;
  status: string | null;
  total_amount: number | null;
  balance_due: number | null;
  deposit_paid: boolean | null;
}

interface ClientCard {
  phone: string;
  masked: boolean;
  realPhone: string | null;
  name: string | null;
  messageCount: number;
  isPaused: boolean;
  bookings: Booking[];
  lead: {
    id: string;
    email: string | null;
    score: number | null;
    status: string | null;
    interestedOffer: string | null;
    occasion: string | null;
    partySize: number | null;
    desiredDate: string | null;
    desiredTimeSlot: string | null;
    sourceChannel: string | null;
    needsHuman: boolean | null;
    createdAt: string | null;
    notes: string | null;
  } | null;
}

interface QRState {
  status: 'connected' | 'pending' | 'waiting' | 'error';
  qr?: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  qualified: 'Qualifié',
  quote_sent: 'Devis envoyé',
  followed_up: 'Relancé',
  booked: 'Réservé',
  lost: 'Perdu',
};

function initials(name: string | null, phone: string): string {
  if (!name) return phone.replace(/\D/g, '').slice(-2);
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} j`;
}

function formatDateFr(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function AgentPage() {
  const [qrState, setQrState] = useState<QRState>({ status: 'waiting' });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [client, setClient] = useState<ClientCard | null>(null);
  const [query, setQuery] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [cardOpen, setCardOpen] = useState(true);
  // Sous xl il n'y a pas la place pour trois colonnes : la fiche prend
  // alors toute la largeur à la place du fil, atteignable par un bouton.
  // Sans ça elle était simplement invisible sur téléphone.
  const [cardOnTop, setCardOnTop] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/wa/qr');
        setQrState(res.ok ? await res.json() : { status: 'error' });
      } catch {
        setQrState({ status: 'error' });
      }
    };
    poll();
    const id = setInterval(poll, 4_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/wa/conversations');
      if (res.ok) setConversations(await res.json());
    };
    load();
    const id = setInterval(load, 5_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedPhone) return;
    const load = async () => {
      const res = await fetch(`/api/wa/messages?phone=${encodeURIComponent(selectedPhone)}`);
      if (res.ok) setMessages(await res.json());
    };
    load();
    const id = setInterval(load, 3_000);
    return () => clearInterval(id);
  }, [selectedPhone]);

  // La fiche ne change pas au rythme des messages : on la recharge au
  // changement de conversation, pas toutes les 3 secondes.
  useEffect(() => {
    if (!selectedPhone) {
      setClient(null);
      return;
    }
    setClient(null);
    fetch(`/api/wa/client?phone=${encodeURIComponent(selectedPhone)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setClient)
      .catch(() => setClient(null));
  }, [selectedPhone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!reply.trim() || !selectedPhone) return;
    setSending(true);
    await fetch('/api/wa/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: selectedPhone, message: reply }),
    });
    setReply('');
    setSending(false);
  }, [reply, selectedPhone]);

  const togglePause = async (phone: string, currentlyPaused: boolean) => {
    await fetch('/api/wa/pause', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, action: currentlyPaused ? 'resume' : 'pause' }),
    });
    setConversations((prev) =>
      prev.map((c) => (c.customer_phone === phone ? { ...c, is_paused: !currentlyPaused } : c)),
    );
  };

  const selectedConv = conversations.find((c) => c.customer_phone === selectedPhone);
  const filtered = query.trim()
    ? conversations.filter((c) =>
        `${c.customer_name ?? ''} ${c.customer_phone}`.toLowerCase().includes(query.toLowerCase()),
      )
    : conversations;
  const pausedCount = conversations.filter((c) => c.is_paused).length;

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agent Léa</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Conversations WhatsApp en direct — reprends la main quand tu veux
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatChip label="Conversations" value={conversations.length} />
          <StatChip label="En pause" value={pausedCount} muted />
          <ConnectionBadge state={qrState} />
        </div>
      </header>

      {qrState.status !== 'connected' ? (
        <QRPanel state={qrState} />
      ) : (
        <div className="flex min-h-0 flex-1 gap-4">
          {/* ── Conversations ─────────────────────────────────────────── */}
          <aside
            className={`vitre w-full shrink-0 flex-col rounded-2xl lg:flex lg:w-72 ${
              selectedPhone ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="border-b border-white/40 p-3 dark:border-white/5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher…"
                  className="h-9 border-transparent bg-white/60 pl-8 dark:bg-white/5"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filtered.length === 0 && (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  {query ? 'Aucun résultat.' : 'Aucune conversation pour le moment.'}
                </p>
              )}
              {filtered.map((conv) => {
                const active = selectedPhone === conv.customer_phone;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedPhone(conv.customer_phone)}
                    className={`mb-1 flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                      active
                        ? 'bg-primary/10 ring-1 ring-primary/20'
                        : 'hover:bg-white/60 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(conv.customer_name, conv.customer_phone)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {conv.customer_name ?? conv.customer_phone}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {timeAgo(conv.last_message_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className={`size-1.5 rounded-full ${
                            conv.is_paused ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {conv.is_paused ? 'Toi' : 'Léa répond'}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ── Fil de messages ───────────────────────────────────────── */}
          <main
            className={`vitre min-w-0 flex-1 flex-col rounded-2xl ${
              cardOnTop ? 'hidden xl:flex' : selectedPhone ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {!selectedPhone ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <Bot className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Sélectionne une conversation</p>
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/40 px-4 py-3 dark:border-white/5">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      onClick={() => setSelectedPhone(null)}
                      className="rounded-lg p-1.5 hover:bg-white/60 lg:hidden dark:hover:bg-white/5"
                      aria-label="Retour à la liste"
                    >
                      <ArrowLeft className="size-4" />
                    </button>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {client?.name ?? selectedConv?.customer_name ?? selectedPhone}
                      </p>
                      <p className="truncate text-xs tabular-nums text-muted-foreground">
                        {selectedPhone}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={selectedConv?.is_paused ?? false}
                        onCheckedChange={() =>
                          togglePause(selectedPhone, selectedConv?.is_paused ?? false)
                        }
                      />
                      Mettre Léa en pause
                    </label>
                    <button
                      onClick={() => setCardOnTop(true)}
                      className="rounded-lg px-2 py-1.5 text-xs font-medium text-primary hover:bg-white/60 xl:hidden dark:hover:bg-white/5"
                    >
                      Fiche
                    </button>
                    <button
                      onClick={() => setCardOpen((v) => !v)}
                      className="hidden rounded-lg p-1.5 text-muted-foreground hover:bg-white/60 xl:block dark:hover:bg-white/5"
                      aria-label={cardOpen ? 'Masquer la fiche client' : 'Afficher la fiche client'}
                    >
                      {cardOpen ? (
                        <PanelRightClose className="size-4" />
                      ) : (
                        <PanelRightOpen className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                          msg.from_me
                            ? msg.is_from_human
                              ? 'rounded-br-md bg-primary text-primary-foreground'
                              : 'rounded-br-md bg-emerald-600 text-white'
                            : 'rounded-bl-md bg-white text-foreground ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                          {msg.from_me && (msg.is_from_human ? <User className="size-3" /> : <Bot className="size-3" />)}
                          <span className="tabular-nums">
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="shrink-0 border-t border-white/40 p-3 dark:border-white/5">
                  <div className="flex gap-2">
                    <Input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Répondre toi-même (met Léa en pause)…"
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      disabled={sending}
                      className="border-transparent bg-white/70 dark:bg-white/5"
                    />
                    <Button onClick={sendMessage} disabled={sending || !reply.trim()} size="icon">
                      {sending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </main>

          {/* ── Fiche client ──────────────────────────────────────────── */}
          {selectedPhone && (cardOpen || cardOnTop) && (
            <ClientPanel client={client} onClose={() => setCardOnTop(false)} visible={cardOnTop} />
          )}
        </div>
      )}
    </div>
  );
}

function ClientPanel({
  client,
  onClose,
  visible,
}: {
  client: ClientCard | null;
  onClose: () => void;
  visible: boolean;
}) {
  const shell = `${visible ? 'flex' : 'hidden'} w-full shrink-0 rounded-2xl xl:flex xl:w-80`;
  if (!client) {
    return (
      <aside className={`vitre items-center justify-center ${shell}`}>
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </aside>
    );
  }

  const l = client.lead;
  const facts: Array<[string, string]> = [];
  if (l?.interestedOffer) facts.push(['Offre visée', l.interestedOffer]);
  if (l?.occasion) facts.push(['Occasion', l.occasion]);
  if (l?.partySize) facts.push(['Personnes', String(l.partySize)]);
  const d = formatDateFr(l?.desiredDate ?? null);
  if (d) facts.push(['Date souhaitée', d]);
  if (l?.desiredTimeSlot) facts.push(['Créneau', l.desiredTimeSlot]);
  if (l?.sourceChannel) facts.push(['Source', l.sourceChannel]);

  return (
    <aside className={`vitre flex-col overflow-y-auto ${shell}`}>
      <div className="flex items-center gap-3 border-b border-white/40 p-4 dark:border-white/5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials(client.name, client.phone)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">
            {client.name ?? 'Contact inconnu'}
          </p>
          <p className="truncate text-xs tabular-nums text-muted-foreground">
            {client.realPhone ?? client.phone}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-primary hover:bg-white/60 xl:hidden dark:hover:bg-white/5"
        >
          Fermer
        </button>
      </div>

      <div className="space-y-4 p-4">
        {client.masked && !client.realPhone && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400">
            Numéro masqué par WhatsApp. Tu peux répondre ici, mais pas le rappeler —
            son vrai numéro reste visible sur ton téléphone.
          </p>
        )}

        {l?.needsHuman && (
          <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary ring-1 ring-primary/20">
            Léa a passé la main — ce contact attend une réponse de toi.
          </p>
        )}

        {l ? (
          <>
            <div className="flex items-center gap-2">
              {l.status && (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                  {STATUS_LABELS[l.status] ?? l.status}
                </span>
              )}
              {l.score !== null && <ScoreMeter score={l.score} />}
            </div>

            {facts.length > 0 && (
              <dl className="space-y-2">
                {facts.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
                    <dd className="truncate text-right text-sm font-medium text-foreground">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {l.email && (
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="truncate text-sm font-medium text-foreground">{l.email}</p>
              </div>
            )}

            {l.notes && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Notes</p>
                <p className="rounded-xl bg-white/60 p-2.5 text-xs leading-relaxed text-foreground dark:bg-white/5">
                  {l.notes}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune fiche prospect rattachée à ce numéro.
          </p>
        )}

        {client.bookings.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Réservations ({client.bookings.length})
            </p>
            <div className="space-y-1.5">
              {client.bookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl bg-white/60 px-3 py-2 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {b.offer_name ?? 'Réservation'}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {b.total_amount ?? 0} €
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="tabular-nums">{formatDateFr(b.date) ?? 'Date à définir'}</span>
                    {(b.balance_due ?? 0) > 0 ? (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        reste {b.balance_due} €
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">soldé</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-white/40 pt-3 dark:border-white/5">
          <p className="text-xs text-muted-foreground">
            {client.messageCount} message{client.messageCount > 1 ? 's' : ''} échangé
            {client.messageCount > 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </aside>
  );
}

// Le score est la seule donnée qu'on lit d'un coup d'œil sans la lire :
// dix segments, remplis jusqu'à la valeur. Plus rapide qu'un nombre.
function ScoreMeter({ score }: { score: number }) {
  return (
    <span className="flex items-center gap-1.5" title={`Score d'intérêt : ${score}/10`}>
      <span className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-1 rounded-full ${
              i < score
                ? score >= 7
                  ? 'bg-emerald-500'
                  : score >= 4
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                : 'bg-black/10 dark:bg-white/10'
            }`}
          />
        ))}
      </span>
      <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{score}/10</span>
    </span>
  );
}

function StatChip({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <span className="vitre flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5">
      <span
        className={`text-sm font-semibold tabular-nums ${muted ? 'text-muted-foreground' : 'text-foreground'}`}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

function ConnectionBadge({ state }: { state: QRState }) {
  const map = {
    connected: { label: 'Connecté', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
    pending: { label: 'Scan requis', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
    waiting: { label: 'Démarrage…', dot: 'bg-slate-400', text: 'text-muted-foreground' },
    error: { label: 'Service hors ligne', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  };
  const { label, dot, text } = map[state.status];
  return (
    <span className="vitre flex items-center gap-2 rounded-full px-3 py-1.5">
      <span className={`size-2 rounded-full ${dot}`} />
      <span className={`text-xs font-medium ${text}`}>{label}</span>
    </span>
  );
}

function QRPanel({ state }: { state: QRState }) {
  return (
    <div className="vitre flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl p-8 text-center">
      <p className="text-lg font-semibold text-foreground">Connecter Léa à WhatsApp</p>
      {state.status === 'pending' && state.qr ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.qr}
            alt="QR code à scanner depuis WhatsApp Business"
            className="size-64 rounded-xl bg-white p-2 shadow-sm"
          />
          <p className="max-w-xs text-sm text-muted-foreground">
            WhatsApp Business → Appareils liés → Lier un appareil → scanne ce QR
          </p>
        </>
      ) : (
        <p className="max-w-xs text-sm text-muted-foreground">
          {state.status === 'waiting'
            ? 'Attente du service Baileys…'
            : 'Service Baileys indisponible — vérifie le déploiement Railway.'}
        </p>
      )}
    </div>
  );
}
