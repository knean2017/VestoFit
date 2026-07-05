"use client";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WardrobeItem } from "@/lib/api";
import HangerIcon from "./HangerIcon";
import HangingItem from "./HangingItem";
import MagneticButton from "@/components/MagneticButton";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";

function Rod() {
  return <div className="sticky top-0 z-10 rod mb-3" />;
}

export default function HangingRack({
  items,
  loading,
  filterKey,
  onEdit,
  onAdd,
}: {
  items: WardrobeItem[];
  loading: boolean;
  filterKey: string;
  onEdit: (item: WardrobeItem) => void;
  onAdd: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  const rail = useRef<HTMLDivElement>(null);
  const nudged = useRef(false);

  useEffect(() => {
    if (reduce || loading || nudged.current || !rail.current) return;
    const el = rail.current;
    if (el.scrollWidth <= el.clientWidth) return;
    nudged.current = true;
    el.scrollTo({ left: 24, behavior: "smooth" });
    const t = setTimeout(
      () => el.scrollTo({ left: 0, behavior: "smooth" }),
      350,
    );
    return () => clearTimeout(t);
  }, [reduce, loading, items.length]);

  if (loading) {
    return (
      <div>
        <Rod />
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shrink-0 w-40 sm:w-44">
              <div className="flex justify-center -mb-2 text-muted">
                <HangerIcon className="w-12 h-7" />
              </div>
              <div className="card p-0 overflow-hidden">
                <div className="aspect-[3/4] skeleton" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-3/4 skeleton rounded" />
                  <div className="h-3 w-1/2 skeleton rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 grid place-items-center text-center">
        <HangerIcon className="w-16 h-10 text-muted/50" />
        <h3 className="heading-md mt-2">Your closet is empty</h3>
        <p className="text-muted text-sm max-w-sm">
          Snap or upload photos of your clothes — we&apos;ll tag the color, style, and
          season automatically. Three items is enough for your first styled look.
        </p>
        <MagneticButton className="mt-4">
          <button className="btn-primary" onClick={onAdd}>
            Add photo
          </button>
        </MagneticButton>
      </div>
    );
  }

  return (
    <div>
      <Rod />
      <AnimatePresence mode="wait">
        <motion.div
          key={filterKey}
          ref={rail}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory"
        >
          {items.map((item) => (
            <div key={item.id} className="snap-start">
              <HangingItem item={item} onEdit={onEdit} />
            </div>
          ))}
          <div className="shrink-0 w-40 sm:w-44 snap-start">
            <div className="flex justify-center -mb-2 text-muted">
              <HangerIcon className="w-12 h-7" />
            </div>
            <button
              onClick={onAdd}
              className="card w-full aspect-[3/4] grid place-items-center border-2 border-dashed border-line hover:border-coral transition-colors"
            >
              <div className="text-center text-muted">
                <div className="text-3xl leading-none">+</div>
                <div className="text-xs mt-1">Add piece</div>
              </div>
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
