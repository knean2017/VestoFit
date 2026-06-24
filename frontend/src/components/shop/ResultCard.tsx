"use client";
import MotionCard from "@/components/MotionCard";
import PriceTag from "./PriceTag";
import type { ShoppingResultItem } from "@/lib/api";

function safeHref(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return url;
  } catch { /* invalid URL */ }
  return "#";
}

export default function ResultCard({ item }: { item: ShoppingResultItem }) {
  return (
    <MotionCard className="p-0 overflow-hidden relative">
      <div className="relative aspect-[3/4] bg-surface2">
        {item.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
        )}
        <PriceTag price={item.price} currency={item.currency} />
        <span className="absolute top-2 left-2 chip-coral text-[10px]">{item.source}</span>
      </div>
      <div className="p-3">
        <p className="font-semibold text-sm text-ink mt-1 line-clamp-2">{item.title}</p>
        <a
          href={safeHref(item.product_url)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-soft mt-2 inline-block text-sm"
        >
          View
        </a>
      </div>
    </MotionCard>
  );
}
