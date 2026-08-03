'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Mic, MicOff, Volume2, VolumeX, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { JarvisStatus } from '@/components/jarvis/orb-3d';

// Le rendu WebGL (three.js) n'a rien à faire côté serveur — chargé
// uniquement client-side, avec un fallback identique au look final pendant
// le chargement du bundle 3D (évite un flash de contenu vide).
const Orb3D = dynamic(() => import('@/components/jarvis/orb-3d'), {
  ssr: false,
  loading: () => <div className="orb-fallback" />,
});

type Status = JarvisStatus;

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
    // iOS/Safari ne joue le TTS que si speak() a déjà été appelé une fois de
    // façon SYNCHRONE dans un vrai geste utilisateur (ce clic). La réponse
    // de Jarvis arrive plus tard, après un fetch réseau — à ce moment-là,
    // Safari ne considère plus qu'on est "dans" le geste et coupe le son
    // silencieusement (pas d'erreur, juste rien à l'oral). Un utterance
    // vide ici "débloque" la synthèse vocale pour le reste de la session.
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const unlock = new SpeechSynthesisUtterance(' ');
      unlock.volume = 0;
      window.speechSynthesis.speak(unlock);
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
          className="orb-glow relative flex size-72 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:opacity-40"
        >
          <Orb3D status={status} />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {sessionActive ? <MicOff className="size-8 text-black/60 drop-shadow-sm" /> : <Mic className="size-8 text-black/60 drop-shadow-sm" />}
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
        /* Halo ambiant derrière l'orbe 3D (le canvas WebGL est transparent) —
           donne l'impression que l'orbe irradie sur son environnement,
           façon hologramme. Pulse doucement au repos, plus vite en session. */
        .orb-glow {
          background: radial-gradient(circle, rgba(245, 185, 66, 0.35) 0%, rgba(245, 185, 66, 0.08) 45%, transparent 70%);
          animation: orb-glow-pulse 4s ease-in-out infinite;
        }
        .orb-fallback {
          height: 12rem;
          width: 12rem;
          border-radius: 9999px;
          background: radial-gradient(circle at 35% 30%, #ffe8b8, #f5b942 45%, #b8791a 80%);
          opacity: 0.7;
        }
        @keyframes orb-glow-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
