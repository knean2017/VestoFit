"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActivation } from "@/lib/useActivation";

const HIDE_KEY = "fitme.activation.hidden";

export default function ActivationChecklist() {
  const { loading, steps, done } = useActivation();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(window.localStorage.getItem(HIDE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!loading && done) window.localStorage.setItem(HIDE_KEY, "1");
  }, [loading, done]);

  if (loading || done || hidden) return null;

  const completed = steps.filter((s) => s.complete).length;
  const next = steps.find((s) => !s.complete);

  return (
    <div className="card p-5 space-y-3" data-activation-checklist>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-ink">
            Get set up ({completed}/{steps.length})
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Four quick steps to your first try-on.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss setup checklist"
          onClick={() => {
            window.localStorage.setItem(HIDE_KEY, "1");
            setHidden(true);
          }}
          className="text-muted hover:text-ink transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
        <div
          className="h-full rounded-full bg-coral transition-all"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={
                "flex items-center gap-2.5 text-sm rounded-lg px-2 py-1.5 transition-colors " +
                (s.complete ? "text-muted line-through" : "text-ink hover:bg-surface2")
              }
            >
              <span
                className={
                  "w-4 h-4 rounded-full grid place-items-center text-[10px] font-bold shrink-0 " +
                  (s.complete
                    ? "bg-coral text-white"
                    : "border border-line text-transparent")
                }
              >
                ✓
              </span>
              {s.label}
              {s === next && (
                <span className="ml-auto text-[10px] font-bold text-coral uppercase tracking-wide">
                  Next
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
