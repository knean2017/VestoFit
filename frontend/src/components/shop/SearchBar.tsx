"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MagneticButton from "@/components/MagneticButton";

export default function SearchBar({
  query,
  setQuery,
  budgetMax,
  setBudgetMax,
  category,
  setCategory,
  budgetOptions,
  categoryOptions,
  onSubmit,
  searching,
}: {
  query: string;
  setQuery: (v: string) => void;
  budgetMax: number | null;
  setBudgetMax: (v: number | null) => void;
  category: string;
  setCategory: (v: string) => void;
  budgetOptions: { label: string; value: number }[];
  categoryOptions: { label: string; value: string }[];
  onSubmit: (e: React.FormEvent) => void;
  searching: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-center gap-2 field rounded-full px-4 py-2">
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What catches your eye?"
          className="flex-1 bg-transparent outline-none text-sm"
        />
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-muted hover:text-ink">
          Filters
        </button>
        <MagneticButton>
          <button type="submit" disabled={!query.trim() || searching} className="btn-primary text-sm">
            {searching ? "Looking…" : "Search"}
          </button>
        </MagneticButton>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 pt-1">
              {budgetOptions.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => setBudgetMax(budgetMax === b.value ? null : b.value)}
                  className={"chip " + (budgetMax === b.value ? "chip-accent" : "")}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {categoryOptions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={
                    "px-3 py-1.5 rounded-full text-sm font-semibold " +
                    (category === c.value ? "bg-ink text-surface" : "bg-surface2 text-muted")
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
