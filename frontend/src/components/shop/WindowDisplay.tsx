"use client";
import Link from "next/link";
import type { ShoppingResultItem } from "@/lib/api";

/** Starting points shown before the first search; each runs a real search. */
const IDEAS = [
  { label: "Knitwear", query: "chunky knit sweater", image: "/images/three-knits.jpg", alt: "Three knit sweaters laid side by side", tone: "bg-butter" },
  { label: "Smart casual", query: "smart casual blazer", image: "/images/flat-lay.jpg", alt: "An outfit laid flat with jeans, shirt, blazer and shoes", tone: "bg-sky" },
  { label: "Soft blouses", query: "silk blouse", image: "/images/blouse.jpg", alt: "A light pink blouse with a tie waist", tone: "bg-blush" },
];

export default function WindowDisplay({ items }: { items?: ShoppingResultItem[] }) {
  const products = items && items.length ? items.slice(0, 3) : null;

  if (!products) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {IDEAS.map((idea) => (
          <Link
            key={idea.label}
            href={`/shop?q=${encodeURIComponent(idea.query)}`}
            className={"group relative rounded-xl4 overflow-hidden aspect-[16/10] sm:aspect-[3/4] " + idea.tone}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={idea.image}
              alt={idea.alt}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/45 to-transparent" />
            <span className="absolute left-4 bottom-4 rounded-full bg-white/90 backdrop-blur px-3.5 py-1.5 text-[14px] font-medium text-ink">
              {idea.label}
            </span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-3">
      {products.map((c, i) => (
        <a
          key={i}
          href={c.product_url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative rounded-xl4 overflow-hidden aspect-[3/4] bg-sky/60"
        >
          {c.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.image_url} alt={c.title} className="w-full h-full object-cover" />
          )}
        </a>
      ))}
    </div>
  );
}
