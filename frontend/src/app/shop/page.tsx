"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { api, type ShoppingResultItem } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { gsap, useGSAP } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import { warmRates } from "@/lib/currency";
import WindowDisplay from "@/components/shop/WindowDisplay";
import SearchBar from "@/components/shop/SearchBar";
import ResultCard from "@/components/shop/ResultCard";
import CurrencySwitcher from "@/components/shop/CurrencySwitcher";
import StylistChat from "@/components/StylistChat";

const SmoothScroll = dynamic(() => import("@/components/SmoothScroll"), { ssr: false });
const CurtainReveal = dynamic(() => import("@/components/shop/CurtainReveal"), { ssr: false });

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
  return (
    <Suspense>
      <ShopContent />
    </Suspense>
  );
}

function ShopContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const reduce = usePrefersReducedMotion();

  const seedQuery = searchParams.get("q") || "";
  const fromStylist = searchParams.get("from") === "stylist";

  const [query, setQuery] = useState(seedQuery);
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<ShoppingResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [userLocation, setUserLocation] = useState<{ country?: string; city?: string; lat?: number; lng?: number }>({});
  const [noLocal, setNoLocal] = useState(false);
  const [searchedCity, setSearchedCity] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  // Warm FX rate cache on mount
  useEffect(() => { warmRates(); }, []);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); }
  }, [router]);

  // Load user location from profile
  useEffect(() => {
    api.me().then((u) => {
      const loc = {
        country: u.country ?? undefined,
        city: u.city ?? undefined,
        lat: u.lat ?? undefined,
        lng: u.lng ?? undefined,
      };
      setUserLocation(loc);
      // Try to refine lat/lng via browser geolocation
      if (navigator.geolocation && u.city) {
        navigator.geolocation.getCurrentPosition((pos) => {
          setUserLocation((prev) => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        }, () => {}); // silent failure
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (seedQuery && !seeded) {
      setSeeded(true);
      setShowFilters(true);
    }
  }, [seedQuery, seeded]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await api.shoppingSearch(
        query.trim(),
        budgetMax || undefined,
        category || undefined,
        userLocation,
      );
      setResults(res.results);
      setSearched(true);
      if (res.currency) setDisplayCurrency(res.currency);
      setNoLocal(res.no_local ?? false);
      setSearchedCity(res.city ?? null);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function handleAIResults(aiResults: ShoppingResultItem[], currency?: string, noLocalFlag?: boolean, city?: string) {
    setResults(aiResults);
    setSearched(true);
    if (currency) setDisplayCurrency(currency);
    setNoLocal(noLocalFlag ?? false);
    setSearchedCity(city ?? null);
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
        <CurtainReveal />
        <section className="container-app py-6 sm:py-8 max-w-4xl">
          <WindowDisplay items={searched ? results : undefined} />

          {/* Chat + Filters toggle */}
          <div className="mt-6">
            {fromStylist && seedQuery && (
              <div className="mb-3 px-3 py-2 bg-coralSoft/50 rounded-xl text-xs text-coral font-semibold">
                From your stylist: &ldquo;{seedQuery}&rdquo;
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <h2 className="heading-md">Ask your stylist</h2>
              <button
                type="button"
                onClick={() => setShowFilters((o) => !o)}
                className={"chip text-xs " + (showFilters ? "chip-coral" : "")}
              >
                Filters
              </button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden mb-4"
                >
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
                </motion.div>
              )}
            </AnimatePresence>

            <StylistChat
              mode="shopping"
              onSearchResults={handleAIResults}
              location={userLocation}
              className="h-[40vh] border border-line rounded-xl3 overflow-hidden"
            />
          </div>

          {/* Results grid */}
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
              <div className="w-24 h-24 rounded-full bg-surface2 grid place-items-center text-muted text-3xl">∅</div>
              <p className="text-muted mt-2">
                {noLocal && searchedCity
                  ? `No local results in ${searchedCity}.`
                  : "Nothing in stock."}
              </p>
            </div>
          )}

          {!searching && results.length > 0 && (
            <>
              <div className="flex items-center justify-between mt-6 mb-2">
                <p className="text-xs text-muted">{results.length} results</p>
                <CurrencySwitcher value={displayCurrency} onChange={setDisplayCurrency} />
              </div>
              <div ref={grid} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {results.map((item, i) => (
                  <ResultCard key={i} item={item} displayCurrency={displayCurrency} />
                ))}
              </div>
            </>
          )}
        </section>
        <BottomNav />
      </main>
    </SmoothScroll>
  );
}
