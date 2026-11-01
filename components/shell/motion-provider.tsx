"use client";

import { MotionConfig } from "framer-motion";

// Une seule règle de mouvement pour toute l'application : si le système
// demande moins d'animations, framer-motion coupe les transformations et ne
// garde que les fondus. Décidé ICI plutôt que par composant avec
// useReducedMotion() — qui renvoie une valeur différente au serveur et au
// client, et provoquait une erreur d'hydratation.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
