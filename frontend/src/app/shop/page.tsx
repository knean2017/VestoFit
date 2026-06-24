"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { api, type ShoppingResultItem } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { gsap, useGSAP } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import WindowDisplay from "@/components/shop/WindowDisplay";
import SearchBar from "@/components/shop/SearchBar";
import ResultCard from "@/components/shop/ResultCard";

const SmoothScroll = dynamic(() => import("@/components/SmoothScroll"), { ssr: false });
const CurtainReveal = dynamic(() => import("@/components/shop/CurtainReveal"), { ssr: false });
const DotLottieReact = dynamic(
  () => import("@lottiefiles/dotlottie-react").then((m) => m.DotLottieReact),
  { ssr: false },
);

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
  const reduce = usePrefersReducedMotion();

  const [query, setQuery] = useState("");
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<ShoppingResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [curtainDone, setCurtainDone] = useState(false);
  const grid = useRef<HTMLDivElement>(null);

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

  useGSAP(
    () => {
      if (reduce || !grid.current || results.length === 0) return;
      const cards = grid.current.querySelectorAll("[data-result-card]");
      gsap.fromTo(
        cards,
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          ease: "power3.out",
          stagger: 0.06,
          scrollTrigger: { trigger: grid.current, start: "top 80%", once: true },
        },
      );
    },
    { dependencies: [results, reduce], revertOnUpdate: true },
  );

  return (
    <SmoothScroll>
      <main className="min-h-screen bg-bg pb-nav md:pb-0">
        <Header />
        {!curtainDone && <CurtainReveal onComplete={() => setCurtainDone(true)} />}
        <section className="container-app py-6 sm:py-8 max-w-4xl">
          <WindowDisplay items={searched ? results : undefined} />
          <div className="mt-6">
            <SearchBar
              query={query}
              setQuery={setQuery}
              budgetMax={budgetMax}
              setBudgetMax={setBudgetMax}
              category={category}
              setCategory={setCategory}
              budgetOptions={BUDGET_OPTIONS}
              categoryOptions={CATEGORY_OPTIONS}
              onSubmit={handleSearch}
              searching={searching}
            />
          </div>

          {searching && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card p-0 overflow-hidden">
                  <div className="aspect-[3/4] skeleton" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 w-12 skeleton rounded ml-auto" />
                    <div className="h-3 w-3/4 skeleton rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searching && searched && results.length === 0 && (
            <div className="py-12 grid place-items-center text-center">
              {reduce ? (
                <div className="w-24 h-24 rounded-full bg-surface2 grid place-items-center text-muted">∅</div>
              ) : (
                <div className="w-32 h-32">
                  <DotLottieReact src="/lottie/mannequin.lottie" loop autoplay />
                </div>
              )}
              <p className="text-muted mt-2">Nothing in stock.</p>
            </div>
          )}

          {!searching && results.length > 0 && (
            <div ref={grid} className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
              {results.map((item, i) => (
                <div key={i} data-result-card>
                  <ResultCard item={item} />
                </div>
              ))}
            </div>
          )}
        </section>
        <BottomNav />
      </main>
    </SmoothScroll>
  );
}
