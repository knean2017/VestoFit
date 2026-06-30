"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ShoppingResultItem } from "@/lib/api";

function safeHref(u: string): string {
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? u : "#";
  } catch {
    return "#";
  }
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor">
          {i < full ? (
            <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" className="text-amber-400" />
          ) : i === full && half ? (
            <>
              <defs>
                <clipPath id={`half-${i}`}><rect x="0" y="0" width="6" height="12" /></clipPath>
              </defs>
              <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" className="text-line" />
              <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" className="text-amber-400" clipPath={`url(#half-${i})`} />
            </>
          ) : (
            <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" className="text-line" />
          )}
        </svg>
      ))}
    </span>
  );
}

export default function StoreCard({ item }: { item: ShoppingResultItem }) {
  const reduce = useReducedMotion();

  const mapsUrl = item.address
    ? `https://www.google.com/maps/search/${encodeURIComponent(item.title + " " + item.address)}`
    : `https://www.google.com/maps/search/${encodeURIComponent(item.title)}`;

  return (
    <motion.div
      className="shrink-0 w-64 rounded-xl2 bg-surface border border-line overflow-hidden flex flex-col"
      whileHover={reduce ? undefined : { y: -2, transition: { type: "spring", stiffness: 300, damping: 25 } }}
    >
      {/* Thumbnail or placeholder */}
      <div className="relative h-28 bg-surface2 overflow-hidden">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted">
            <svg viewBox="0 0 48 48" className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 12h36l-4 20H10L6 12Z" />
              <path d="M16 12V8a8 8 0 0 1 16 0v4" />
              <circle cx="18" cy="36" r="2" />
              <circle cx="30" cy="36" r="2" />
            </svg>
          </div>
        )}
        {item.open_now != null && (
          <span className={
            "absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full " +
            (item.open_now ? "bg-teal/90 text-white" : "bg-danger/80 text-white")
          }>
            {item.open_now ? "Open" : "Closed"}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="font-semibold text-sm text-ink leading-tight line-clamp-1">{item.title}</p>

        {item.rating != null && (
          <div className="flex items-center gap-1.5">
            <StarRating rating={item.rating} />
            <span className="text-xs text-muted">
              {item.rating.toFixed(1)}
              {item.rating_count ? ` (${item.rating_count.toLocaleString()})` : ""}
            </span>
          </div>
        )}

        {item.address && (
          <p className="text-xs text-muted line-clamp-2 leading-snug">{item.address}</p>
        )}

        {item.phone && (
          <a href={`tel:${item.phone}`} className="text-xs text-coral hover:underline">
            {item.phone}
          </a>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-xs font-semibold py-1.5 rounded-lg bg-surface2 text-ink hover:bg-line transition-colors"
          >
            Directions
          </a>
          <a
            href={safeHref(item.product_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-xs font-semibold py-1.5 rounded-lg bg-coral text-white hover:bg-coral/90 transition-colors"
          >
            Website
          </a>
        </div>
      </div>
    </motion.div>
  );
}
