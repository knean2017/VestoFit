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

  const prefix = item.approx ? "~" : "";
  const priceLabel = converted != null
    ? `${prefix}${displayCurrency} ${converted.toFixed(2)}`
    : item.price != null
      ? `${prefix}${item.currency || "USD"} ${item.price.toFixed(2)}`
      : "Visit store";

  return (
    <a
      href={safeHref(item.product_url)}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl3 overflow-hidden bg-surface2 border border-line hover:border-accent transition-colors"
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
          <div className="w-full h-full flex items-center justify-center bg-sky text-sky-ink/60">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-ink/70 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 text-center">
          <span className="text-white font-semibold text-sm leading-tight line-clamp-2">
            {item.source}
          </span>
          <span className="text-accent font-bold text-base">{priceLabel}</span>
        </div>
      </div>
    </a>
  );
}
