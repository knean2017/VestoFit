"use client";

import { motion, useReducedMotion } from "framer-motion";

export type Chip = { label: string; value: string };

export default function QuickReplyChips({
  chips,
  onSelect,
  className = "",
}: {
  chips: Chip[];
  onSelect: (value: string) => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={"flex flex-wrap items-center justify-center gap-2 " + className}>
      {chips.map((chip, i) => (
        <motion.button
          key={chip.value}
          type="button"
          onClick={() => onSelect(chip.value)}
          className="chip-coral text-xs px-3.5 py-2"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduce
              ? { duration: 0.01 }
              : { type: "spring", stiffness: 300, damping: 22, delay: i * 0.05 }
          }
          whileTap={reduce ? undefined : { scale: 0.94 }}
        >
          {chip.label}
        </motion.button>
      ))}
    </div>
  );
}
