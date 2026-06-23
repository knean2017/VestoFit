"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { api, type ShoppingResultItem } from "@/lib/api";
import { getToken } from "@/lib/auth";

const BUDGET_OPTIONS = [
  { label: "$25", value: 25 },
  { label: "$50", value: 50 },
  { label: "$100", value: 100 },
  { label: "$200+", value: 200 },
];

const CATEGORY_OPTIONS = [
  { label: "All", value: "" },
  { label: "Tops", value: "tops" },
  { label: "Bottoms", value: "bottoms" },
  { label: "Dresses", value: "dresses" },
];

export default function ShopPage() {
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<ShoppingResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); }
  }, [router]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await api.shoppingSearch(
        query.trim(),
        budgetMax || undefined,
        category || undefined,
      );
      setResults(res.results);
      setSearched(true);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg pb-nav md:pb-0">
      <Header />
      <section className="container-app py-6 sm:py-8 max-w-4xl mx-auto">
        <div className="animate-rise">
          <h1 className="heading-lg">Shop</h1>
          <p className="text-sm text-muted font-medium mt-1">
            Find clothes from real stores within your budget
          </p>
        </div>

        <form onSubmit={handleSearch} className="mt-6 space-y-4 animate-rise" style={{ animationDelay: "0.1s" }}>
          <div className="card p-5 space-y-4">
            <label className="block">
              <span className="label">What are you looking for?</span>
              <input
                type="text"
                className="field mt-2"
                placeholder="e.g. casual outfit for a weekend brunch"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>

            <div>
              <span className="label">Budget</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {BUDGET_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBudgetMax(budgetMax === opt.value ? null : opt.value)}
                    className={
                      "px-4 py-2 rounded-full text-sm font-bold transition-all " +
                      (budgetMax === opt.value
                        ? "bg-coral text-white shadow-glow2"
                        : "bg-surface2 text-muted hover:text-ink")
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label">Category</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={
                      "px-4 py-2 rounded-full text-sm font-bold transition-all " +
                      (category === opt.value
                        ? "bg-ink text-white"
                        : "bg-surface2 text-muted hover:text-ink")
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!query.trim() || searching}
              className="btn-primary w-full sm:w-auto"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        <div className="mt-6">
          {searching && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card overflow-hidden">
                  <div className="aspect-[3/4] skeleton" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 w-3/4 skeleton" />
                    <div className="h-3 w-1/3 skeleton" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searching && searched && results.length === 0 && (
            <div className="card p-12 text-center animate-rise">
              <p className="text-muted font-semibold">No results found. Try a different search.</p>
            </div>
          )}

          {!searching && results.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-rise">
              {results.map((item, i) => (
                <ShopResultCard key={i} item={item} />
              ))}
            </div>
          )}
        </div>
      </section>
      <BottomNav />
    </main>
  );
}

function safeHref(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return url;
  } catch {}
  return "#";
}

function ShopResultCard({ item }: { item: ShoppingResultItem }) {
  return (
    <div className="card-interactive overflow-hidden group">
      <div className="aspect-[3/4] bg-surface2 relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image_url}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
        />
        <span className="absolute top-2 left-2 chip-coral text-[10px]">
          {item.source}
        </span>
      </div>
      <div className="p-3">
        <p className="text-sm font-bold line-clamp-2 leading-snug">{item.title}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-base font-extrabold text-coral">
            {item.currency === "USD" ? "$" : item.currency}{item.price.toFixed(2)}
          </span>
          <a
            href={safeHref(item.product_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-muted hover:text-coral transition-colors"
          >
            View
          </a>
        </div>
      </div>
    </div>
  );
}
