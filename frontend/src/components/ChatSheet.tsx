"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { StylistMessage } from "@/lib/api";

export default function ChatSheet({
  open,
  messages,
  onClose,
}: {
  open: boolean;
  messages: StylistMessage[];
  onClose: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.01 : 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-xl4 bg-surface shadow-lifted flex flex-col"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={
              reduce
                ? { duration: 0.01 }
                : { type: "spring", stiffness: 300, damping: 32 }
            }
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose();
            }}
          >
            <div className="pt-3 pb-2 flex items-center justify-center">
              <span className="h-1.5 w-12 rounded-full bg-line" />
            </div>
            <div className="px-5 pb-2 flex items-center justify-between border-b border-line">
              <h2 className="font-bold text-ink">Conversation</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-semibold text-muted hover:text-coral transition-colors px-2 py-1"
              >
                Close
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto p-5 space-y-3"
              style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
            >
              {messages.length === 0 ? (
                <p className="text-center text-sm text-muted py-8">No messages yet</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={
                        "max-w-[80%] rounded-xl3 px-4 py-2.5 text-sm " +
                        (m.role === "user"
                          ? "bg-coral text-white rounded-br-lg"
                          : "bg-surface2 text-ink rounded-bl-lg")
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
