"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ShoppingResultItem } from "@/lib/api";

const FEATURED: ShoppingResultItem[] = [
  { title: "Linen blazer", source: "Boutique", product_url: "#", image_url: "", price: 120, currency: "USD", category: null },
  { title: "Silk midi dress", source: "Boutique", product_url: "#", image_url: "", price: 180, currency: "USD", category: null },
  { title: "Wide-leg trousers", source: "Boutique", product_url: "#", image_url: "", price: 90, currency: "USD", category: null },
];

export default function WindowDisplay({ items }: { items?: ShoppingResultItem[] }) {
  const reduce = useReducedMotion();
  const cards = items && items.length ? items.slice(0, 3) : FEATURED;
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused || cards.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % cards.length), 5000);
    return () => clearInterval(t);
  }, [reduce, paused, cards.length]);

  return (
    <div
      className="relative"
      onPointerDown={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <div className="hidden md:grid grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <div key={i} className="card p-0 overflow-hidden relative aspect-[3/4]">
            {c.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image_url} alt={c.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-muted text-sm bg-surface2">{c.title}</div>
            )}
            {!reduce && <div className="glass-shimmer" />}
          </div>
        ))}
      </div>

      <div className="md:hidden relative aspect-[3/4]">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            drag={reduce ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) setIdx((i) => (i + 1) % cards.length);
              if (info.offset.x > 60) setIdx((i) => (i - 1 + cards.length) % cards.length);
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="card p-0 overflow-hidden relative w-full h-full"
          >
            {cards[idx].image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cards[idx].image_url} alt={cards[idx].title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-muted text-sm bg-surface2">{cards[idx].title}</div>
            )}
            {!reduce && <div className="glass-shimmer" />}
          </motion.div>
        </AnimatePresence>
        <div className="flex justify-center gap-1.5 mt-3">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={"w-2 h-2 rounded-full " + (i === idx ? "bg-ink" : "bg-line")}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
