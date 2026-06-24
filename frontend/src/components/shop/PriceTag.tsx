"use client";
import { motion, useReducedMotion } from "framer-motion";

export default function PriceTag({ price, currency }: { price: number; currency: string }) {
  const reduce = useReducedMotion();
  const label = `${currency === "USD" ? "$" : currency}${price.toFixed(2)}`;

  return (
    <motion.div
      className="absolute -top-1 right-3 origin-top"
      style={{ transformOrigin: "top center" }}
      initial={{ rotateZ: -4 }}
      whileHover={
        reduce
          ? undefined
          : { rotateZ: [-4, 2, -4], transition: { type: "spring", stiffness: 120, damping: 8 } }
      }
    >
      <div className="w-px h-3 bg-ink/40 mx-auto" />
      <div className="relative bg-ink text-surface text-xs font-bold px-3 py-1 rounded-md shadow-soft">
        <span className="absolute left-1.5 top-1.5 w-1.5 h-1.5 rounded-full bg-surface/60" />
        <span className="pl-3">{label}</span>
      </div>
    </motion.div>
  );
}
