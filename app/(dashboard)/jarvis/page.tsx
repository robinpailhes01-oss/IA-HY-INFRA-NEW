'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Status = 'idle' | 'listening' | 'thinking' | 'speaking';

// Reconnaissance vocale : API native du navigateur (Chrome/Edge/Safari),
// gratuite et instantanée — pas d'upload audio, pas de coût par requête.
// Fallback texte si le navigateur ne la supporte pas.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  resultIndex: number;
};
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function createSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const { SpeechRecognition, webkitSpeechRecognition } = window as SpeechRecognitionWindow;
  const Ctor = SpeechRecognition ?? webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Appuie sur l’orbe pour parler à Jarvis',
  listening: 'Je t’écoute…',
  thinking: 'Jarvis réfléchit…',
  speaking: 'Jarvis répond…',
};

export default function JarvisPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [sessionActive, setSessionActive] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [interim, setInterim] = useState('');
  const [lastUser, setLastUser] = useState('');
  const [lastAssistant, setLastAssistant] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [draft, setDraft] = useState('');

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sessionActiveRef = useRef(false);
  const statusRef = useRef<Status>('idle');

  useEffect(() => {
    setSpeechSupported(!!createSpeechRecognition());
  }, []);

  const setStatusBoth = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  const speak = useCallback((text: string, onDone: () => void) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) {
      onDone();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.onend = onDone;
    utterance.onerror = onDone;
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  // Volontairement PAS de useCallback ici : cette fonction doit toujours
  // fermer sur le `send`/`speak` du rendu courant (qui dépend de
  // voiceEnabled). Un useCallback à deps vides figerait ces références sur
  // le tout premier rendu — couper le son en cours de session n'aurait
  // alors plus aucun effet.
  const startListening = () => {
    if (!sessionActiveRef.current) return;
    const recognition = createSpeechRecognition();
    if (!recognition) return;
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0]?.transcript ?? '';
        else interimText += result[0]?.transcript ?? '';
      }
      if (interimText) setInterim(interimText);
      if (finalText.trim()) {
        setInterim('');
        recognitionRef.current?.stop();
        void send(finalText.trim());
      }
    };
    recognition.onerror = (event) => {
      // "no-speech"/"aborted" sont normaux en mode mains-libres (silence,
      // ou stop() volontaire) — on relance juste l'écoute, sans casser la
      // session ni remonter d'erreur à Robin.
      if (sessionActiveRef.current && statusRef.current === 'listening' && event.error !== 'not-allowed') {
        setTimeout(() => startListening(), 300);
      }
    };
    recognition.onend = () => {
      // Le navigateur peut couper l'écoute tout seul (silence prolongé) —
      // en session active et toujours en mode "listening", on relance.
      if (sessionActiveRef.current && statusRef.current === 'listening') {
        setTimeout(() => startListening(), 300);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setStatusBoth('listening');
    } catch {
      // start() peut jeter si une reconnaissance est déjà active — ignoré,
      // le cycle onend/onresult en cours reprendra la main.
    }
  };

  const send = async (text: string) => {
    setLastUser(text);
    setStatusBoth('thinking');
    try {
      const res = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      const reply = data.reply ?? data.error ?? "Désolé, je n'ai pas pu répondre.";
      setLastAssistant(reply);
      setStatusBoth('speaking');
      speak(reply, () => {
        if (sessionActiveRef.current) startListening();
        else setStatusBoth('idle');
      });
    } catch {
      setLastAssistant('Erreur de connexion — réessaie dans un instant.');
      setStatusBoth('speaking');
      speak('Erreur de connexion, réessaie dans un instant.', () => {
        if (sessionActiveRef.current) startListening();
        else setStatusBoth('idle');
      });
    }
  };

  const toggleSession = () => {
    if (sessionActive) {
      sessionActiveRef.current = false;
      setSessionActive(false);
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
      setInterim('');
      setStatusBoth('idle');
      return;
    }
    sessionActiveRef.current = true;
    setSessionActive(true);
    startListening();
  };

  const sendTextDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setDraft('');
    void send(trimmed);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-2xl border border-[#1c1f2e] bg-[radial-gradient(ellipse_at_center,_#0c1020_0%,_#05060b_70%)] text-white">
      <div className="flex shrink-0 items-center justify-between px-5 py-4">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-white/90">JARVIS</h1>
          <p className="text-xs text-white/40">Le Manager, en vocal</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowTextInput((v) => !v)}
            className="text-white/60 hover:bg-white/10 hover:text-white"
            title="Basculer en texte"
          >
            <Keyboard className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setVoiceEnabled((v) => !v)}
            className="text-white/60 hover:bg-white/10 hover:text-white"
            title={voiceEnabled ? 'Couper la voix' : 'Activer la voix'}
          >
            {voiceEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
        <button
          type="button"
          onClick={toggleSession}
          disabled={!speechSupported && !showTextInput}
          aria-label={sessionActive ? 'Terminer la conversation' : 'Démarrer la conversation'}
          className="orb-button relative flex size-56 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:opacity-40"
        >
          <span className={`orb-ring ${status !== 'idle' ? 'orb-ring--active' : ''}`} />
          <span className={`orb-core orb-core--${status}`}>
            {sessionActive ? <MicOff className="size-9 text-black/70" /> : <Mic className="size-9 text-black/70" />}
          </span>
        </button>

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-base font-medium text-white/85">{STATUS_LABEL[status]}</p>
          {interim && <p className="max-w-sm text-sm italic text-white/40">« {interim} »</p>}
        </div>

        {(lastUser || lastAssistant) && (
          <div className="flex w-full max-w-md flex-col gap-2 text-sm">
            {lastUser && (
              <p className="rounded-xl bg-white/5 px-3 py-2 text-right text-white/70">{lastUser}</p>
            )}
            {lastAssistant && (
              <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-amber-100/90">{lastAssistant}</p>
            )}
          </div>
        )}

        {!speechSupported && !showTextInput && (
          <p className="max-w-xs text-center text-xs text-white/40">
            Reconnaissance vocale non supportée par ce navigateur — utilise le clavier (icône en haut à droite) ou ouvre depuis Chrome.
          </p>
        )}
      </div>

      {showTextInput && (
        <div className="flex shrink-0 items-center gap-2 border-t border-white/10 p-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Écris à Jarvis…"
            onKeyDown={(e) => e.key === 'Enter' && sendTextDraft()}
            className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
          />
          <Button type="button" onClick={sendTextDraft} disabled={!draft.trim()}>
            Envoyer
          </Button>
        </div>
      )}

      <style jsx>{`
        .orb-core {
          position: relative;
          display: flex;
          height: 9rem;
          width: 9rem;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          background: radial-gradient(circle at 35% 30%, #ffe8b8, #f5b942 45%, #b8791a 80%);
          box-shadow: 0 0 40px 6px rgba(245, 185, 66, 0.45), 0 0 90px 20px rgba(245, 185, 66, 0.2);
          transition: box-shadow 0.4s ease, transform 0.4s ease;
        }
        .orb-core--idle {
          animation: orb-breathe 4s ease-in-out infinite;
        }
        .orb-core--listening {
          animation: orb-breathe 1.4s ease-in-out infinite;
          box-shadow: 0 0 55px 10px rgba(245, 185, 66, 0.65), 0 0 120px 30px rgba(245, 185, 66, 0.3);
        }
        .orb-core--thinking {
          animation: orb-spin-pulse 1.1s ease-in-out infinite;
        }
        .orb-core--speaking {
          animation: orb-breathe 0.6s ease-in-out infinite;
          box-shadow: 0 0 60px 14px rgba(245, 185, 66, 0.7), 0 0 130px 34px rgba(245, 185, 66, 0.35);
        }
        .orb-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 1px solid rgba(245, 185, 66, 0.25);
        }
        .orb-ring::before,
        .orb-ring::after {
          content: '';
          position: absolute;
          inset: -14px;
          border-radius: 9999px;
          border: 1px solid rgba(245, 185, 66, 0.12);
        }
        .orb-ring::after {
          inset: -28px;
          border-color: rgba(245, 185, 66, 0.07);
        }
        .orb-ring--active {
          animation: orb-ring-spin 8s linear infinite;
        }
        @keyframes orb-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes orb-spin-pulse {
          0%, 100% { transform: scale(0.96) rotate(0deg); }
          50% { transform: scale(1.02) rotate(180deg); }
        }
        @keyframes orb-ring-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
