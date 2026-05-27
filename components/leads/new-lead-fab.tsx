"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";

export function NewLeadFab({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Nouveau lead"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.2 }}
      whileTap={{ scale: 0.9 }}
      className="fixed right-5 bottom-5 z-40 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#0f2942] text-primary-foreground shadow-lg shadow-primary/30 md:hidden"
    >
      <Plus className="size-7" />
    </motion.button>
  );
}
