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
            "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors " +
            (filter === t.id
              ? "bg-ink text-surface"
              : "bg-surface2 text-muted hover:text-ink")
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
