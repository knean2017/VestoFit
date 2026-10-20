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
    <section className="rounded-xl4 bg-butter/70 overflow-hidden" data-activation-checklist>
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-3 pb-1">
        <h2 className="text-[15px] font-semibold text-ink" style={{ fontVariationSettings: '"wdth" 100', letterSpacing: 0, lineHeight: 1.3 }}>
          Get set up <span className="text-muted font-normal">{completed} of {steps.length} done</span>
        </h2>
        <button
          type="button"
          aria-label="Dismiss setup checklist"
          onClick={() => {
            window.localStorage.setItem(HIDE_KEY, "1");
            setHidden(true);
          }}
          className="w-8 h-8 -mr-2 grid place-items-center text-muted hover:text-ink transition-colors text-xl leading-none"
        >
          ×
        </button>
      </div>

      <ol className="grid sm:grid-cols-4 gap-2 p-2">
        {steps.map((s, i) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={
                "flex sm:flex-col gap-3 sm:gap-2 rounded-xl2 px-4 py-3 h-full text-[14px] transition-colors " +
                (s.complete ? "text-butter-ink/70" : "text-ink hover:bg-white") +
                (s === next ? " bg-white" : " bg-white/40")
              }
            >
              <span className={"tabular-nums " + (s.complete ? "text-sage-ink" : "text-butter-ink")}>
                {s.complete ? "✓" : i + 1}
              </span>
              <span className={s.complete ? "line-through" : ""}>{s.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
