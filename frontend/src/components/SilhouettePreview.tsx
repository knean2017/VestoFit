"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Category, WardrobeItem } from "@/lib/api";

export type SilhouetteItem = Pick<
  WardrobeItem,
  "id" | "category" | "clean_image_url" | "image_url"
>;

const LAYER_STYLE: Record<
  Category | "outer",
  { top: string; left: string; width: string; height: string; zIndex: number }
> = {
  tops: { top: "18%", left: "22%", width: "56%", height: "28%", zIndex: 2 },
  bottoms: { top: "44%", left: "26%", width: "48%", height: "38%", zIndex: 1 },
  dresses: { top: "16%", left: "20%", width: "60%", height: "66%", zIndex: 2 },
  outer: { top: "14%", left: "18%", width: "64%", height: "32%", zIndex: 3 },
};

function orderForPreview(items: SilhouetteItem[]): SilhouetteItem[] {
  const dresses = items.filter((i) => i.category === "dresses");
  if (dresses.length) return [dresses[0]];
  const tops = items.filter((i) => i.category === "tops");
  const bottoms = items.filter((i) => i.category === "bottoms");
  if (tops.length === 1 && bottoms.length === 1) return [tops[0], bottoms[0]];
  if (tops.length === 2 && bottoms.length === 1)
    return [tops[0], bottoms[0], tops[1]];
  return items;
}

function layerKey(item: SilhouetteItem, _index: number, ordered: SilhouetteItem[]) {
  if (item.category === "dresses") return "dresses";
  if (item.category === "bottoms") return "bottoms";
  const tops = ordered.filter((i) => i.category === "tops");
  if (item.category === "tops" && tops.length > 1 && item.id === tops[1]?.id) {
    return "outer";
  }
  return "tops";
}

export default function SilhouettePreview({
  items,
  startDelay = 0,
  editable = false,
  onRemove,
  className = "",
}: {
  items: SilhouetteItem[];
  startDelay?: number;
  editable?: boolean;
  onRemove?: (id: string) => void;
  className?: string;
}) {
  const ordered = orderForPreview(items);
  const reduce = useReducedMotion();

  return (
    <div
      className={
        "relative mx-auto aspect-[3/5] w-full max-w-[280px] " + className
      }
    >
      <svg
        viewBox="0 0 200 340"
        className="absolute inset-0 h-full w-full text-line"
        aria-hidden
      >
        <ellipse cx="100" cy="28" rx="22" ry="26" fill="currentColor" opacity="0.35" />
        <path
          d="M72 52 Q58 68 52 92 L48 130 Q46 150 52 168 L56 200 Q58 230 54 260 L52 310 Q52 322 62 328 L138 328 Q148 322 148 310 L146 260 Q142 230 144 200 L148 168 Q154 150 152 130 L148 92 Q142 68 128 52 Z"
          fill="currentColor"
          opacity="0.2"
        />
        <path
          d="M72 52 L128 52 L118 88 L82 88 Z"
          fill="currentColor"
          opacity="0.08"
        />
      </svg>

      <AnimatePresence>
        {ordered.map((item, idx) => {
          const key = layerKey(item, idx, ordered);
          const style = LAYER_STYLE[key];
          const img = item.clean_image_url || item.image_url;
          const fromY = reduce ? 0 : key === "bottoms" ? 20 : -20;
          const delay = startDelay + idx * 0.15;
          return (
            <motion.div
              key={item.id}
              className="absolute"
              style={{
                top: style.top,
                left: style.left,
                width: style.width,
                height: style.height,
                zIndex: style.zIndex,
              }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: fromY, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
              transition={
                reduce
                  ? { duration: 0.01 }
                  : { type: "spring", stiffness: 300, damping: 25, delay }
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt=""
                className="h-full w-full object-contain drop-shadow-sm pointer-events-none"
              />
              {editable && onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-ink/70 text-white text-[10px] grid place-items-center hover:bg-coral transition-colors z-10"
                  aria-label="Remove item"
                >
                  ×
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {ordered.length === 0 && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <p className="text-sm text-muted italic">
            Tell me the occasion — I&apos;ll dress this up
          </p>
        </div>
      )}
    </div>
  );
}
