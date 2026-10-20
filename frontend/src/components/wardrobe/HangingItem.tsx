"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { WardrobeItem } from "@/lib/api";
import HangerIcon from "./HangerIcon";

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
        <div className="relative aspect-[3/4] bg-surface2">
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
            <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-accentSoft grid place-items-center text-accent text-xs">
              ♥
            </span>
          )}
          {pending && (
            <span className="absolute bottom-2 left-2 chip-accent text-[10px]">
              Tagging...
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="text-sm font-bold truncate">{label}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted capitalize">
              {item.category}
            </span>
            {item.color && (
              <span className="text-xs text-muted">&middot; {item.color}</span>
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
                    className="text-[10px] font-bold text-accent bg-accentSoft px-1.5 py-0.5 rounded-full"
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
