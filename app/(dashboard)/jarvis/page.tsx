'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

// Reconnaissance vocale : API native du navigateur (Chrome/Edge), gratuite et
// instantanée — pas d'upload audio, pas de coût par requête. Fallback texte
// si le navigateur ne la supporte pas (ex. Firefox, Safari selon version).
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function getSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const { SpeechRecognition, webkitSpeechRecognition } = window as SpeechRecognitionWindow;
  const Ctor = SpeechRecognition ?? webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export default function JarvisPage() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognition());
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setEntries((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: trimmed }]);
    setDraft('');
    setSending(true);
    try {
      const res = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      const reply = data.reply ?? data.error ?? "Désolé, je n'ai pas pu répondre.";
      setEntries((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: reply }]);
      speak(reply);
    } catch {
      const reply = 'Erreur de connexion — réessaie dans un instant.';
      setEntries((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: reply }]);
    } finally {
      setSending(false);
    }
  };

  const toggleRecording = () => {
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = getSpeechRecognition();
    if (!recognition) return;
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) send(transcript);
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jarvis — ton Manager, en vocal</h1>
          <p className="text-sm text-muted-foreground">Même agent que le Manager Telegram — chiffres, prospects, réservations, dépenses, relances.</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setVoiceEnabled((v) => !v)}
          title={voiceEnabled ? 'Couper la voix' : 'Activer la voix'}
        >
          {voiceEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </Button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {entries.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <p className="text-sm">Maintiens le micro et parle, ou écris directement.</p>
              <p className="text-xs">Ex. « Combien de CA ce mois-ci ? », « Qui était intéressé cette semaine ? »</p>
            </div>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  entry.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                }`}
              >
                {entry.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">…</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-border p-3">
          {!speechSupported && (
            <Badge variant="outline" className="mb-2 text-[10px]">
              Reconnaissance vocale non supportée par ce navigateur — utilise le texte, ou ouvre depuis Chrome.
            </Badge>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant={recording ? 'destructive' : 'outline'}
              onClick={toggleRecording}
              disabled={!speechSupported || sending}
              title="Maintenir pour parler"
              className="shrink-0"
            >
              <Mic className="size-4" />
            </Button>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={recording ? "Je t'écoute…" : 'Écris ou clique le micro pour parler…'}
              onKeyDown={(e) => e.key === 'Enter' && send(draft)}
              disabled={sending}
            />
            <Button type="button" size="icon" onClick={() => send(draft)} disabled={sending || !draft.trim()} className="shrink-0">
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
