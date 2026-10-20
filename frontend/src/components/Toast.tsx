"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastKind = "info" | "success" | "error";
type Toast = { id: number; kind: ToastKind; message: string };

const ToastContext = createContext<(kind: ToastKind, message: string) => void>(
  () => {},
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
  }, []);

  const styles =
    toast.kind === "success"
      ? "bg-surface2 border-ink/30"
      : toast.kind === "error"
        ? "bg-red-50 border-danger/30"
        : "bg-accentSoft border-accent/30";

  const icon =
    toast.kind === "success"
      ? "text-ink"
      : toast.kind === "error"
        ? "text-danger"
        : "text-accent";

  return (
    <div
      className={
        "rounded-xl3 border px-4 py-3 flex items-start gap-3 shadow-lifted transition-all duration-300 " +
        styles +
        (show ? " translate-y-0 opacity-100" : " translate-y-3 opacity-0")
      }
    >
      <span className={"text-lg leading-none mt-0.5 " + icon} aria-hidden>
        {toast.kind === "success" ? "✓" : toast.kind === "error" ? "!" : "•"}
      </span>
      <p className="text-sm font-semibold text-ink leading-snug">{toast.message}</p>
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
