"use client";
import { motion, useReducedMotion } from "framer-motion";
import HookIcon from "./HookIcon";

type Mode = "url" | "upload";
const MODES: { id: Mode; label: string }[] = [
  { id: "url", label: "Product URL" },
  { id: "upload", label: "Upload image" },
];

export default function ModeHooks({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex gap-6 justify-center">
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className="flex flex-col items-center gap-1"
          >
            <motion.span
              whileHover={reduce ? undefined : { y: -1 }}
              className={active ? "text-coral" : "text-muted"}
            >
              <HookIcon className="w-6 h-8" />
            </motion.span>
            <span
              className={
                "text-xs font-semibold " + (active ? "text-ink" : "text-muted")
              }
            >
              {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
