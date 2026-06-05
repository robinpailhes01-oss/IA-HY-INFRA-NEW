'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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

interface QRState {
  status: 'connected' | 'pending' | 'waiting' | 'error';
  qr?: string;
}

export default function AgentPage() {
  const [qrState, setQrState] = useState<QRState>({ status: 'waiting' });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll QR / connection status
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/wa/qr');
        if (res.ok) setQrState(await res.json());
        else setQrState({ status: 'error' });
      } catch {
        setQrState({ status: 'error' });
      }
    };
    poll();
    const interval = setInterval(poll, 4_000);
    return () => clearInterval(interval);
  }, []);

  // Load conversations
  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/wa/conversations');
      if (res.ok) setConversations(await res.json());
    };
    load();
    const interval = setInterval(load, 5_000);
    return () => clearInterval(interval);
  }, []);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedPhone) return;
    const load = async () => {
      const res = await fetch(`/api/wa/messages?phone=${encodeURIComponent(selectedPhone)}`);
      if (res.ok) setMessages(await res.json());
    };
    load();
    const interval = setInterval(load, 3_000);
    return () => clearInterval(interval);
  }, [selectedPhone]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!reply.trim() || !selectedPhone) return;
    setSending(true);
    await fetch('/api/wa/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: selectedPhone, message: reply }),
    });
    setReply('');
    setSending(false);
  };

  const togglePause = async (phone: string, currentlyPaused: boolean) => {
    await fetch('/api/wa/pause', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, action: currentlyPaused ? 'resume' : 'pause' }),
    });
    setConversations((prev) =>
      prev.map((c) => c.customer_phone === phone ? { ...c, is_paused: !currentlyPaused } : c)
    );
  };

  const selectedConv = conversations.find((c) => c.customer_phone === selectedPhone);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Agent Léa — WhatsApp</h1>
        <ConnectionBadge state={qrState} />
      </div>

      {qrState.status !== 'connected' && (
        <QRPanel state={qrState} />
      )}

      {qrState.status === 'connected' && (
        <div className="flex flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Conversation list */}
          <aside className="w-72 shrink-0 overflow-y-auto border-r border-border">
            {conversations.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Aucune conversation pour l'instant.</p>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedPhone(conv.customer_phone)}
                className={`flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 ${selectedPhone === conv.customer_phone ? 'bg-muted' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">
                    {conv.customer_name ?? conv.customer_phone}
                  </span>
                  {conv.is_paused ? (
                    <Badge variant="outline" className="text-[10px] shrink-0">Pause</Badge>
                  ) : (
                    <Badge variant="default" className="text-[10px] shrink-0 bg-green-600">Léa</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{conv.customer_phone}</span>
              </button>
            ))}
          </aside>

          {/* Message thread */}
          <main className="flex flex-1 flex-col overflow-hidden">
            {!selectedPhone ? (
              <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
                Sélectionnez une conversation
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
                  <div>
                    <p className="font-medium">{selectedConv?.customer_name ?? selectedPhone}</p>
                    <p className="text-xs text-muted-foreground">{selectedPhone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedConv?.is_paused ? 'Toi' : 'Léa'}
                    </span>
                    <Switch
                      checked={selectedConv?.is_paused ?? false}
                      onCheckedChange={() => togglePause(selectedPhone, selectedConv?.is_paused ?? false)}
                    />
                    <span className="text-xs text-muted-foreground">Pause Léa</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                          msg.from_me
                            ? msg.is_from_human
                              ? 'bg-blue-600 text-white'
                              : 'bg-green-600 text-white'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        {msg.body}
                        <p className="mt-0.5 text-[10px] opacity-60 text-right">
                          {msg.from_me ? (msg.is_from_human ? '👤' : '🤖') : ''}
                          {' '}
                          {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply input */}
                <div className="border-t border-border p-3 flex gap-2 shrink-0">
                  <Input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Répondre manuellement (met Léa en pause)…"
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    disabled={sending}
                  />
                  <Button onClick={sendMessage} disabled={sending || !reply.trim()}>
                    Envoyer
                  </Button>
                </div>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

function ConnectionBadge({ state }: { state: QRState }) {
  const map = {
    connected: { label: '● Connecté', cls: 'bg-green-600 text-white' },
    pending: { label: '◌ Scan requis', cls: 'bg-yellow-500 text-white' },
    waiting: { label: '◌ Démarrage…', cls: 'bg-muted text-muted-foreground' },
    error: { label: '✕ Service hors ligne', cls: 'bg-destructive text-destructive-foreground' },
  };
  const { label, cls } = map[state.status];
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

function QRPanel({ state }: { state: QRState }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 shadow-sm">
      <p className="text-lg font-semibold">Connecter Léa à WhatsApp</p>
      {state.status === 'pending' && state.qr ? (
        <>
          <img src={state.qr} alt="QR Code WhatsApp" className="h-64 w-64 rounded-lg border" />
          <p className="text-sm text-muted-foreground">
            Ouvre WhatsApp Business → Appareils liés → Lier un appareil → Scanne ce QR
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {state.status === 'waiting' ? 'Attente du service Baileys…' : 'Service Baileys non disponible — vérifie le déploiement Railway.'}
        </p>
      )}
    </div>
  );
}
