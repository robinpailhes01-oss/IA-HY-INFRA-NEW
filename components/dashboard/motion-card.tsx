"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

// Enveloppe animée, volontairement SANS logique métier.
//
// La frontière serveur/client ne laisse passer que des valeurs sérialisables :
// ni fonction, ni composant. En gardant l'animation ici et le contenu dans un
// composant serveur qui passe des `children` déjà rendus, les pages peuvent
// continuer à écrire `icon={Ship}` sans rien casser.
export function MotionCard({
  children,
  index = 0,
  lift = true,
  className,
}: {
  children: React.ReactNode;
  index?: number;
  lift?: boolean;
  className?: string;
}) {
  const still = useReducedMotion();

  return (
    <motion.div
      initial={still ? false : { opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.62, ease: [0.32, 0.72, 0, 1] }}
      whileHover={
        still || !lift
          ? undefined
          : { y: -4, transition: { type: "spring", stiffness: 420, damping: 28 } }
      }
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
