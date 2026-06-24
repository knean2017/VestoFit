"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function MirrorFlipCard({
  garmentUrl,
  resultUrl,
}: {
  garmentUrl: string;
  resultUrl: string;
}) {
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(true);

  if (reduce) {
    return (
      <button
        onClick={() => setFlipped((f) => !f)}
        className="relative w-full aspect-[3/4] rounded-xl overflow-hidden"
      >
        <motion.img
          key={flipped ? "result" : "garment"}
          src={flipped ? resultUrl : garmentUrl}
          alt={flipped ? "You, styled" : "Garment"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full object-cover"
        />
        <span className="absolute bottom-2 left-2 chip text-[10px]">
          {flipped ? "You, styled" : "Garment"}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setFlipped((f) => !f)}
      className="relative w-full aspect-[3/4]"
      style={{ perspective: 1000 }}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
      >
        <div
          className="absolute inset-0 rounded-xl overflow-hidden"
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={garmentUrl} alt="Garment" className="w-full h-full object-cover" />
          <span className="absolute bottom-2 left-2 chip text-[10px]">Garment</span>
        </div>
        <div
          className="absolute inset-0 rounded-xl overflow-hidden"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="You, styled" className="w-full h-full object-cover" />
          <span className="absolute bottom-2 left-2 chip text-[10px]">You, styled</span>
        </div>
      </motion.div>
    </button>
  );
}
