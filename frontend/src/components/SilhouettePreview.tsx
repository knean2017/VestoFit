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
                className="h-full w-full object-contain pointer-events-none"
              />
              {editable && onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-ink text-white text-xs grid place-items-center hover:bg-accent transition-colors z-10"
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
        <>
          {(["tops", "bottoms"] as const).map((k) => (
            <div
              key={k}
              aria-hidden
              className="absolute rounded-xl2 border border-dashed border-sky-ink/30 grid place-items-center text-[13px] text-muted/70"
              style={{ top: LAYER_STYLE[k].top, left: LAYER_STYLE[k].left, width: LAYER_STYLE[k].width, height: LAYER_STYLE[k].height }}
            >
              {k === "tops" ? "Top" : "Bottom"}
            </div>
          ))}
          <p className="absolute inset-x-0 -bottom-2 text-center text-[14px] text-muted">
            Tell the stylist the occasion and the look appears here
          </p>
        </>
      )}
    </div>
  );
}
