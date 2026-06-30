"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import SilhouettePreview from "@/components/SilhouettePreview";
import StylistChat from "@/components/StylistChat";
import { getToken } from "@/lib/auth";
import { api, WardrobeItem } from "@/lib/api";

export default function HomePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  if (authed === null) return null;
  if (!authed) return <LandingPage />;
  return <StylistHome />;
}

/* ─── Authenticated: Stylist-first home ─── */

type StageState = "idle" | "thinking" | "dressed";

function StylistHome() {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [suggestion, setSuggestion] = useState<WardrobeItem[]>([]);
  const [outfitId, setOutfitId] = useState("");
  const [stage, setStage] = useState<StageState>("idle");
  const [shuffling, setShuffling] = useState(false);
  const [loading, setLoading] = useState(true);

  const hasWardrobe = wardrobe.length >= 2;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const items = await api.listWardrobe();
      setWardrobe(items);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentItemIds = suggestion.map((i) => i.id);

  function handleShuffle() {
    if (!hasWardrobe || shuffling) return;
    setShuffling(true);
    const tops = wardrobe.filter((i) => i.category === "tops");
    const bottoms = wardrobe.filter((i) => i.category === "bottoms");
    const dresses = wardrobe.filter((i) => i.category === "dresses");
    let picked: WardrobeItem[] = [];
    if (dresses.length > 0 && Math.random() > 0.5) {
      picked = [dresses[Math.floor(Math.random() * dresses.length)]];
    } else if (tops.length > 0 && bottoms.length > 0) {
      picked = [tops[Math.floor(Math.random() * tops.length)], bottoms[Math.floor(Math.random() * bottoms.length)]];
    } else if (wardrobe.length > 0) {
      picked = [wardrobe[Math.floor(Math.random() * wardrobe.length)]];
    }
    setSuggestion(picked);
    if (picked.length > 0) {
      setOutfitId("shuffle-" + Date.now());
      setStage("dressed");
    }
    setTimeout(() => setShuffling(false), 500);
  }

  function handleTryOn() {
    if (currentItemIds.length === 0) return;
    router.push(`/studio?items=${currentItemIds.join(",")}`);
  }

  function handleSend() {
    setStage("thinking");
    setSuggestion([]);
  }

  async function handleStylistResult(result: { reasoning: string; item_ids: string[]; outfit_id: string; decline: boolean }) {
    if (result.decline || result.item_ids.length === 0) {
      setStage("idle");
      return;
    }

    // Try matching against local wardrobe state first
    let resolved = result.item_ids
      .map((id) => wardrobe.find((w) => w.id === id))
      .filter((w): w is WardrobeItem => !!w);

    // If no matches, wardrobe state may be stale — re-fetch and retry
    if (resolved.length === 0 && result.item_ids.length > 0) {
      try {
        const fresh = await api.listWardrobe();
        setWardrobe(fresh);
        resolved = result.item_ids
          .map((id) => fresh.find((w) => w.id === id))
          .filter((w): w is WardrobeItem => !!w);
      } catch {}
    }

    if (resolved.length === 0) {
      setStage("idle");
      return;
    }
    setSuggestion(resolved);
    setOutfitId(result.outfit_id);
    setStage("dressed");
  }

  function handleRemoveItem(id: string) {
    setSuggestion((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (next.length === 0) setStage("idle");
      return next;
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-bg pb-nav md:pb-0 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-2xl mx-auto w-full">
          <div className="aspect-[3/5] w-full max-w-[280px] skeleton" />
          <div className="mt-6 h-10 w-40 skeleton" />
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg pb-nav md:pb-0 flex flex-col">
      <Header />

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-5 min-h-0">
        {/* Silhouette zone with choreography */}
        <div className="relative min-h-[30vh] sm:min-h-[45vh] flex items-center justify-center pt-4 shrink-0">
          <AnimatePresence mode="wait">
            {stage === "idle" && (
              <motion.div
                key="idle"
                initial={reduce ? { opacity: 0 } : { opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, scale: [1, 1.015, 1] }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(6px)" }}
                transition={
                  reduce
                    ? { duration: 0.2 }
                    : { opacity: { duration: 0.45 }, scale: { duration: 3.2, repeat: Infinity, ease: "easeInOut" }, exit: { duration: 0.45 } }
                }
                className="w-full flex items-center justify-center"
              >
                <SilhouettePreview items={[]} className={hasWardrobe ? "" : "opacity-60"} />
              </motion.div>
            )}

            {stage === "thinking" && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full flex items-center justify-center"
              >
                <div className="w-16 h-16 rounded-full bg-coralSoft/40 animate-pulse" />
              </motion.div>
            )}

            {stage === "dressed" && (
              <motion.div
                key={"dressed-" + outfitId}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: "60%", scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                transition={
                  reduce
                    ? { duration: 0.2 }
                    : { type: "spring", stiffness: 90, damping: 18, mass: 1.1 }
                }
                className="w-full flex items-center justify-center"
              >
                <SilhouettePreview
                  items={suggestion}
                  startDelay={0.5}
                  editable
                  onRemove={handleRemoveItem}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action buttons */}
        {stage === "dressed" && (
          <div className="flex items-center justify-center gap-3 py-3 shrink-0">
            <motion.button
              type="button"
              onClick={handleShuffle}
              disabled={shuffling || !hasWardrobe}
              aria-label="Shuffle outfit"
              className="w-12 h-12 rounded-full bg-coralSoft text-coral grid place-items-center shadow-soft disabled:opacity-40"
              animate={shuffling && !reduce ? { rotate: 360 } : { rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              whileTap={reduce ? undefined : { scale: 0.92 }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3h5v5" />
                <path d="M4 20L21 3" />
                <path d="M21 16v5h-5" />
                <path d="M15 15l6 6" />
                <path d="M4 4l5 5" />
              </svg>
            </motion.button>

            <motion.button
              type="button"
              onClick={handleTryOn}
              disabled={currentItemIds.length === 0}
              className="btn-primary px-6"
              whileTap={reduce ? undefined : { scale: 0.96 }}
            >
              Try On
            </motion.button>
          </div>
        )}

        {/* Chat */}
        {hasWardrobe ? (
          <StylistChat
            mode="stylist"
            onSend={handleSend}
            onStylistResult={handleStylistResult}
            className="flex-1 min-h-0"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center">
              <p className="text-muted text-sm mb-3">Add at least 2 items to your wardrobe to get styled</p>
              <Link href="/wardrobe" className="btn-primary">Open wardrobe</Link>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

/* ─── Unauthenticated: Landing page ─── */

function LandingPage() {
  const reduce = useReducedMotion();
  const reveal = (i = 0) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: reduce
      ? { duration: 0.01 }
      : { type: "spring", stiffness: 260, damping: 24, delay: i * 0.08 },
  });

  return (
    <main className="min-h-screen flex flex-col bg-bg">
      <Header />

      <section className="container-app pt-16 sm:pt-24 pb-16">
        <div className="max-w-3xl">
          <motion.span className="chip-coral mb-6 inline-flex" {...reveal(0)}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-coral" />
            Your personal stylist
          </motion.span>

          <motion.h1
            className="font-extrabold tracking-tightest text-4xl sm:text-5xl md:text-6xl leading-[1.05]"
            {...reveal(0)}
          >
            Your closet, <span className="text-coral">smarter.</span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg text-muted max-w-xl leading-relaxed font-medium"
            {...reveal(1)}
          >
            VestoFit knows your wardrobe, suggests daily outfits, and lets you try on
            any clothes virtually — all powered by AI that actually understands your style.
          </motion.p>

          <motion.div className="mt-8 flex flex-wrap items-center gap-3" {...reveal(2)}>
            <Link href="/register" className="btn-primary btn-lg">
              Get started free
            </Link>
            <Link href="/login" className="btn-ghost btn-lg">
              Sign in
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="container-app pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <motion.article key={s.title} className="card p-6" {...reveal(i)}>
              <span className={"w-8 h-8 rounded-full grid place-items-center text-sm font-bold text-white " + s.color}>
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">{s.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="container-app pb-24">
        <div className="card p-8 sm:p-10">
          <h2 className="heading-lg text-center mb-8">Why VestoFit?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div key={f.t} className="flex gap-3" {...reveal(i)}>
                <span className="w-10 h-10 rounded-xl bg-coralSoft text-coral grid place-items-center text-lg shrink-0">
                  {f.icon}
                </span>
                <div>
                  <p className="font-bold">{f.t}</p>
                  <p className="text-sm text-muted leading-relaxed mt-0.5">{f.d}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

const STEPS = [
  {
    title: "Build your closet",
    body: "Snap photos of your clothes. Our AI tags each item with color, style, and season automatically.",
    color: "bg-coral",
  },
  {
    title: "Get styled",
    body: "Tell your stylist what you need — date night, work, casual — and get instant outfit combos.",
    color: "bg-teal",
  },
  {
    title: "Try it on",
    body: "See any outfit rendered on your photo. Same face, same body — only the clothes change.",
    color: "bg-ink",
  },
];

const FEATURES: { icon: React.ReactNode; t: string; d: string }[] = [
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 5.5H19l-4.5 3.5 1.5 5.5L12 14l-4.5 3.5 1.5-5.5L4.5 8.5H10z"/></svg>,
    t: "AI Stylist",
    d: "Knows your wardrobe and suggests outfits for any occasion.",
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
    t: "Shop smart",
    d: "Find clothes from real stores within your budget.",
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    t: "Virtual try-on",
    d: "Photorealistic rendering on your actual body.",
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    t: "Private",
    d: "Your photos stay private. Your data stays yours.",
  },
];
