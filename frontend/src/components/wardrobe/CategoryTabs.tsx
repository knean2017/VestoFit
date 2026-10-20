"use client";
import type { Category } from "@/lib/api";

export type Filter = "all" | Category | "favorites";

const TABS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "dresses", label: "Dresses" },
  { id: "favorites", label: "Favorites" },
];

const TONE: Record<Filter, string> = {
  all: "bg-ink text-white",
  tops: "bg-sky text-sky-ink",
  bottoms: "bg-sage text-sage-ink",
  dresses: "bg-blush text-blush-ink",
  favorites: "bg-butter text-butter-ink",
};

export default function CategoryTabs({
  filter,
  setFilter,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setFilter(t.id)}
          className={
            "h-9 px-4 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors " +
            (filter === t.id
              ? TONE[t.id]
              : "bg-surface text-muted border border-line hover:text-ink")
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
