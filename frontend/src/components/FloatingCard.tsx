"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export default function FloatingCard({
  open,
  text,
  onDismiss,
  children,
}: {
  open: boolean;
  text: string;
  onDismiss: () => void;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [open, text, onDismiss]);

  return (
    <AnimatePresence>
      {open && text && (
        <motion.div
          className="pointer-events-auto"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={
            reduce
              ? { duration: 0.01 }
              : { type: "spring", stiffness: 300, damping: 26 }
          }
        >
          <div className="card border border-line shadow-lifted px-4 py-3 max-w-sm mx-auto">
            <div className="flex items-start gap-2.5">
              <span className="w-7 h-7 shrink-0 rounded-full bg-coral text-white grid place-items-center text-xs font-extrabold shadow-glow">
                F
              </span>
              <p className="text-sm font-semibold text-ink leading-snug">{text}</p>
            </div>
            {children && <div className="mt-3">{children}</div>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
