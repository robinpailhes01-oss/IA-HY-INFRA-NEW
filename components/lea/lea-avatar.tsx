"use client";

import { useRef } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

// Léa, le visage : un portrait en rendu 3D (personnage de film d'animation),
// blazer marine et ancre dorée au revers — la tenue de la maison.
//
// Le portrait est une image (public/lea/avatar.webp, 12 Ko) plutôt qu'un
// modèle 3D temps réel : à 60 px, un visage généré en maillage perd ce qui le
// rend sympathique (les yeux, le sourire), et charger three.js sur chaque page
// pour une bulle coûtait cher sur iPhone. Le relief vient d'ailleurs :
// - un ANNEAU de lumière qui tourne autour d'elle, au rythme de son état
//   (lent au repos, rapide quand elle réfléchit, pulsé quand elle répond) ;
// - un léger BASCULEMENT 3D qui suit le pointeur (option `tilt`) ;
// - un reflet de verre en haut à gauche, la lumière de toute l'interface.
//
// Changer de visage = remplacer public/lea/avatar.webp (carré, ~320 px).

export type LeaState = "idle" | "listening" | "thinking" | "speaking";

export function LeaAvatar({
  state = "idle",
  className,
  tilt = false,
  ring = true,
  priority = false,
}: {
  state?: LeaState;
  className?: string;
  /** Basculement 3D au survol (la bulle flottante). */
  tilt?: boolean;
  /** Anneau de lumière animé. Désactivé pour les mini-avatars du fil. */
  ring?: boolean;
  priority?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const onMove = (e: React.PointerEvent) => {
    if (!tilt || !ref.current || e.pointerType !== "mouse") return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(380px) rotateY(${x * 22}deg) rotateX(${-y * 22}deg)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <span
      ref={ref}
      data-state={state}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn(
        "lea-avatar relative block aspect-square rounded-full transition-transform duration-300 [transition-timing-function:var(--ease-ios)] [transform-style:preserve-3d]",
        className,
      )}
    >
      {ring && <span aria-hidden className="lea-ring absolute -inset-[3px] rounded-full" />}
      <span className="absolute inset-0 overflow-hidden rounded-full bg-[#dcebfa] ring-2 ring-white">
        <Image
          src="/lea/avatar.webp"
          alt=""
          width={160}
          height={160}
          priority={priority}
          className="lea-breathe size-full object-cover"
        />
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.5),transparent_42%)] shadow-[inset_0_-8px_16px_rgba(11,37,69,0.18)]"
        />
      </span>
    </span>
  );
}
