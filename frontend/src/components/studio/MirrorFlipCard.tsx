"use client";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export default function MirrorFlipCard({
  garmentUrl,
  resultUrl,
}: {
  garmentUrl: string;
  resultUrl: string;
}) {
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(true);

  const label = flipped ? "You, styled" : "Garment";

  if (reduce) {
    return (
      <button
        onClick={() => setFlipped((f) => !f)}
        className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-lifted"
      >
        <motion.img
          key={flipped ? "result" : "garment"}
          src={flipped ? resultUrl : garmentUrl}
          alt={label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full object-cover"
        />
        <AnimatePresence mode="wait">
          <motion.span
            key={label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute bottom-3 left-3 bg-surface/80 backdrop-blur text-ink text-[11px] font-bold px-3 py-1 rounded-full"
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </button>
    );
  }

  return (
    <button
      onClick={() => setFlipped((f) => !f)}
      className="relative w-full aspect-[3/4] shadow-lifted"
      style={{ perspective: 1000 }}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
      >
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={garmentUrl} alt="Garment" className="w-full h-full object-cover" />
        </div>
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="You, styled" className="w-full h-full object-cover" />
        </div>
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.span
          key={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="absolute bottom-3 left-3 z-10 bg-surface/80 backdrop-blur text-ink text-[11px] font-bold px-3 py-1 rounded-full shadow-soft"
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
