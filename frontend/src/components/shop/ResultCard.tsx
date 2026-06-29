"use client";

import { useState, useEffect } from "react";
import { convertCurrencySync } from "@/lib/currency";
import type { ShoppingResultItem } from "@/lib/api";

interface Props {
  item: ShoppingResultItem;
  displayCurrency: string;
}

function safeHref(u: string): string {
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? u : "#";
  } catch {
    return "#";
  }
}

export default function ResultCard({ item, displayCurrency }: Props) {
  const [converted, setConverted] = useState<number | null>(null);

  useEffect(() => {
    if (item.price == null) { setConverted(null); return; }
    const sync = convertCurrencySync(item.price, item.currency || "USD", displayCurrency);
    setConverted(sync);
  }, [item.price, item.currency, displayCurrency]);

  const priceLabel = converted != null
    ? `${displayCurrency} ${converted.toFixed(2)}`
    : item.price != null
      ? `${item.currency || "USD"} ${item.price.toFixed(2)}`
      : "Visit store";

  return (
    <a
      href={safeHref(item.product_url)}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl3 overflow-hidden bg-surface2 border border-line hover:border-coral transition-colors"
      data-result-card
    >
      {/* Image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-surface2">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-3xl">
            🛍
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-ink/70 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 text-center">
          <span className="text-white font-semibold text-sm leading-tight line-clamp-2">
            {item.source}
          </span>
          <span className="text-coral font-bold text-base">{priceLabel}</span>
        </div>
      </div>
    </a>
  );
}
