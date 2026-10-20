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
      <div className="grid md:grid-cols-2 rounded-[28px] overflow-hidden bg-butter">
        <div className="relative min-h-[260px] md:min-h-[440px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hangers.jpg" alt="Empty wooden hangers on a clothing rail" className="absolute inset-0 w-full h-full object-cover" />
        </div>
        <div className="p-8 sm:p-12 flex flex-col justify-center">
        <h3 className="display text-[clamp(36px,4vw,56px)] text-ink">Your closet is empty</h3>
        <p className="mt-4 text-[16px] leading-relaxed text-ink/75 max-w-[38ch]">
          Snap or upload photos of your clothes — we&apos;ll tag the color, style, and
          season automatically. Three items is enough for your first styled look.
        </p>
        <MagneticButton className="mt-8 self-start">
          <button className="btn-primary btn-lg" onClick={onAdd}>
            Add photo
          </button>
        </MagneticButton>
        </div>
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
              className="w-full aspect-[3/4] rounded-xl3 grid place-items-center border border-dashed border-ink/20 bg-surface/60 hover:border-accent hover:bg-accentSoft transition-colors"
            >
              <div className="text-center text-muted">
                <div className="text-3xl leading-none">+</div>
                <div className="text-[13px] mt-1">Add piece</div>
              </div>
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
