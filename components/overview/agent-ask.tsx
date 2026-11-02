"use client";

import { useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";

import { askLea } from "@/components/lea/ask-lea";

// « Demande à Léa » — le compositeur posé sur le panneau marine.
//
// Il ne répond pas lui-même : il passe la question à Léa, le widget global
// (components/lea/lea-widget.tsx), qui s'ouvre et l'envoie à /api/jarvis — le
// Manager, qui lit les chiffres ET agit. Une seule conversation, une seule
// mémoire : une réponse affichée ici puis une autre dans la bulle auraient
// fait deux Léa qui ne se connaissent pas.
//
// Les suggestions viennent du brief (la page les compose d'après les
// signaux) : un compositeur vide ne dit pas ce qu'on peut lui demander.

export function AgentAsk({ suggestions }: { suggestions: string[] }) {
  const [value, setValue] = useState("");

  function send(raw: string, field?: HTMLInputElement | null) {
    const question = raw.trim();
    if (!question) return;
    askLea(question);
    setValue("");
    // Sur téléphone, le panneau de Léa s'ouvre en plein écran : on rend le
    // clavier, sinon il reste ouvert par-dessus la conversation.
    field?.blur();
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(value, e.currentTarget.querySelector("input"));
        }}
        className="flex h-[52px] items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.08] p-1 pl-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition-colors duration-200 focus-within:border-white/30 focus-within:bg-white/[0.12]"
      >
        <Sparkles className="size-4 shrink-0 text-[#9fd0f7]" aria-hidden />
        <label htmlFor="cockpit-ask" className="sr-only">
          Poser une question à Léa
        </label>
        <input
          id="cockpit-ask"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Demande à Léa…"
          autoComplete="off"
          enterKeyHint="send"
          // 16 px sur téléphone : en dessous, Safari iOS zoome sur le champ.
          className="h-full min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-[#8fa9c8] sm:text-[14.5px]"
        />
        {/* Le raccourci du widget, rappelé là où on s'en sert : à la souris. */}
        <kbd
          aria-hidden
          className="hidden shrink-0 rounded-full border border-white/12 px-2 py-0.5 font-sans text-[11px] font-medium text-[#8fa9c8] lg:inline"
        >
          ⌘J
        </kbd>
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="Envoyer la question à Léa"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-navy shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)] outline-none transition-[transform,opacity] duration-200 [transition-timing-function:var(--ease-ios)] focus-visible:ring-4 focus-visible:ring-white/25 active:scale-95 disabled:opacity-35"
        >
          <ArrowUp className="size-[18px]" strokeWidth={2.2} />
        </button>
      </form>

      {suggestions.length > 0 && (
        // Téléphone : une seule rangée qui défile, fondue sur les bords pour
        // dire qu'il y a une suite (trois lignes de pastilles repousseraient
        // tout le reste). Bureau : elles passent à la ligne.
        <div className="no-scrollbar -mx-6 mt-3 flex gap-2 overflow-x-auto px-6 [mask-image:linear-gradient(to_right,transparent,#000_20px,#000_calc(100%-28px),transparent)] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none]">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="inline-flex h-11 shrink-0 items-center rounded-full border border-white/12 bg-white/[0.05] px-4 text-[13px] font-medium tracking-[-0.01em] text-[#cfe2f7] outline-none transition-colors duration-200 hover:bg-white/[0.12] hover:text-white focus-visible:ring-4 focus-visible:ring-white/20 sm:h-9 sm:px-3.5"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
