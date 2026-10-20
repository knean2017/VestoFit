"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { WardrobeItem } from "@/lib/api";
import HangerIcon from "./HangerIcon";
import { categoryTone } from "@/lib/categoryTone";

const CARD_BG: Record<string, string> = {
  tops: "bg-sky/50",
  bottoms: "bg-sage/50",
  dresses: "bg-blush/50",
};

export default function HangingItem({
  item,
  onEdit,
}: {
  item: WardrobeItem;
  onEdit: (item: WardrobeItem) => void;
}) {
  const reduce = useReducedMotion();
  const img = item.clean_image_url || item.image_url;
  const label =
    item.name || item.category.charAt(0).toUpperCase() + item.category.slice(1);
  const pending = item.tagging_status === "pending";

  return (
    <motion.button
      type="button"
      onClick={() => onEdit(item)}
      className="shrink-0 w-40 sm:w-44 origin-top text-left"
      style={{ transformOrigin: "top center" }}
      whileHover={
        reduce
          ? undefined
          : {
              rotateZ: [0, -3, 2, 0],
              transition: { type: "spring", stiffness: 120, damping: 8 },
            }
      }
      whileTap={reduce ? undefined : { scale: 1.04 }}
    >
      <div className="flex justify-center -mb-2 text-muted">
        <HangerIcon className="w-12 h-7" />
      </div>
      <div className="card card-interactive p-0 overflow-hidden">
        <div className={"relative aspect-[3/4] " + CARD_BG[item.category]}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={label}
              className="w-full h-full object-contain p-3"
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-muted text-xs">
              No image
            </div>
          )}
          {item.is_favorite && (
            <span aria-label="Favorite" className="absolute top-2 right-2 w-7 h-7 rounded-full bg-blush grid place-items-center text-blush-ink">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z" />
              </svg>
            </span>
          )}
          {pending && (
            <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-accent">
              Tagging...
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="text-[14px] font-semibold truncate">{label}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={"text-[11px] font-medium capitalize rounded-full px-2 py-0.5 " + categoryTone(item.category)}>
              {item.category}
            </span>
            {item.color && (
              <span className="text-[12px] text-muted capitalize">{item.color}</span>
            )}
          </div>
          {item.conditions && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.conditions
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean)
                .slice(0, 2)
                .map((c) => (
                  <span
                    key={c}
                    className="text-[11px] font-medium text-lilac-ink bg-lilac px-2 py-0.5 rounded-full"
                  >
                    {c}
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}
