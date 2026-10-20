"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import ActivationChecklist from "@/components/ActivationChecklist";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import SilhouettePreview from "@/components/SilhouettePreview";
import StylistChat from "@/components/StylistChat";
import { getToken } from "@/lib/auth";
import { api, WardrobeItem } from "@/lib/api";
import { categoryTone } from "@/lib/categoryTone";

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
        <div className="container-app flex-1 w-full py-6 grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="aspect-[3/4] md:aspect-auto md:min-h-[560px] skeleton" />
          <div className="hidden md:block skeleton" />
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen md:h-screen bg-bg pb-nav md:pb-0 flex flex-col">
      <Header />

      <div className="container-app w-full flex-1 min-h-0 flex flex-col gap-4 py-4 md:py-6">
        <div className="shrink-0 empty:hidden">
          <ActivationChecklist />
        </div>

        <div className="flex-1 min-h-0 grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* The look */}
          <section aria-label="Current look" className="relative rounded-xl4 bg-sky/60 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 h-12 text-[14px] text-sky-ink">
              <span className="font-semibold">Today&apos;s look</span>
              <span className="text-sky-ink/70">
                {suggestion.length > 0 ? `${suggestion.length} ${suggestion.length === 1 ? "piece" : "pieces"}` : `${wardrobe.length} in your closet`}
              </span>
            </div>

            <div className="relative flex-1 min-h-[300px] flex items-center justify-center p-6">
              <AnimatePresence mode="wait">
                {stage === "idle" && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0.01 : 0.3 }}
                    className="w-full flex items-center justify-center"
                  >
                    <SilhouettePreview items={[]} />
                  </motion.div>
                )}

                {stage === "thinking" && (
                  <motion.div
                    key="thinking"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full flex flex-col items-center justify-center gap-3 text-[14px] text-muted"
                  >
                    <span className="block w-24 h-0.5 rounded-full bg-accent animate-pulse" />
                    Putting a look together
                  </motion.div>
                )}

                {stage === "dressed" && (
                  <motion.div
                    key={"dressed-" + outfitId}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={reduce ? { duration: 0.01 } : { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                    className="w-full flex items-center justify-center"
                  >
                    <SilhouettePreview
                      items={suggestion}
                      startDelay={0.2}
                      editable
                      onRemove={handleRemoveItem}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {stage === "dressed" && (
              <div className="flex justify-center gap-3 px-4 pb-5">
                <button
                  type="button"
                  onClick={handleShuffle}
                  disabled={shuffling || !hasWardrobe}
                  className="btn bg-surface text-ink hover:bg-white/70"
                >
                  Shuffle
                </button>
                <button
                  type="button"
                  onClick={handleTryOn}
                  disabled={currentItemIds.length === 0}
                  className="btn-primary"
                >
                  Try it on
                </button>
              </div>
            )}
          </section>

          {/* The conversation */}
          <section aria-label="Stylist" className="rounded-xl4 bg-surface border border-line flex flex-col min-h-[420px] md:min-h-0 overflow-hidden">
            <div className="flex items-center px-4 sm:px-6 h-12 border-b border-line text-[14px] font-semibold">
              Stylist
            </div>
            <StylistChat
              mode="stylist"
              onSend={handleSend}
              onStylistResult={handleStylistResult}
              greeting={
                wardrobe.length === 0
                  ? "Welcome! I'm your stylist. Add a few clothes to your closet and I can build real looks from them — or tell me what you're shopping for."
                  : undefined
              }
              className="flex-1 min-h-0"
            />
          </section>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

/* ─── Unauthenticated: Landing page ─── */

const HEADLINE = ["Get dressed from", "the closet you", "already own."];

function LandingPage() {
  const reduce = useReducedMotion();
  const line = (i: number) =>
    reduce
      ? {}
      : {
          initial: { y: "105%" },
          animate: { y: "0%" },
          transition: { duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: 0.1 + i * 0.09 },
        };
  const after = (delay: number, y = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, ease: [0.2, 0.8, 0.2, 1], delay },
        };

  return (
    <main className="min-h-screen flex flex-col bg-bg overflow-x-hidden">
      <Header />
      <MobileTopBar />

      <section className="relative">
        {/* Soft colour wash behind the hero */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 right-[-10%] w-[640px] h-[640px] rounded-full bg-lilac blur-[120px] opacity-80" />
          <div className="absolute top-[40%] right-[25%] w-[420px] h-[420px] rounded-full bg-sky blur-[110px] opacity-70" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[480px] h-[480px] rounded-full bg-blush blur-[120px] opacity-60" />
        </div>

        <div className="relative container-app pt-10 sm:pt-16 pb-16 sm:pb-24 grid gap-12 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-7 md:pt-6">
            <h1 className="text-ink text-[clamp(56px,7.6vw,116px)] leading-[0.88]">
              {HEADLINE.map((l, i) => (
                <span key={l} className="block overflow-hidden pb-[0.04em]">
                  <motion.span className="block" {...line(i)}>
                    {l}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.div {...after(0.55)} className="mt-8 sm:mt-10">
              <p className="text-lg sm:text-xl leading-relaxed max-w-[36ch] text-ink/80">
                VestoFit learns your wardrobe from photos, puts outfits together for
                wherever you&apos;re going, and shows them on you before you change.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <Link href="/register" className="btn-primary btn-lg">
                  Create account
                </Link>
                <Link href="/login" className="btn-link">
                  Sign in
                </Link>
              </div>
            </motion.div>
          </div>

          <div className="md:col-span-5 relative">
            <motion.div {...after(0.3, 24)} className="relative rounded-[28px] overflow-hidden aspect-[4/5] shadow-lifted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/sweater-hook.jpg"
                alt="A knit sweater on a wooden hanger against a soft wall"
                className="absolute inset-0 w-full h-full object-cover object-[50%_75%]"
              />
            </motion.div>

            <motion.figure
              {...after(0.9, 16)}
              className="relative -mt-28 mx-4 sm:mx-8 md:absolute md:mx-0 md:mt-0 md:-left-28 md:-bottom-14 md:w-[340px] bg-surface/90 backdrop-blur-xl border border-white/60 rounded-xl4 shadow-lifted overflow-hidden"
            >
              <div className="p-5 space-y-4">
                <p className="ml-auto w-fit max-w-[28ch] rounded-2xl rounded-br-md bg-lilac px-4 py-2.5 text-[14px] leading-relaxed text-ink">
                  Dinner on Friday, somewhere nice. It&apos;s supposed to rain.
                </p>
                <p className="text-[17px] leading-snug text-accent">
                  Go with the charcoal wool trousers and the cream cable knit. Dressy
                  enough for dinner, and wool shrugs off a little rain.
                </p>
                <dl className="grid gap-2">
                  {EXAMPLE_LOOK.map(([name, kind]) => (
                    <div key={name} className="flex items-center justify-between gap-4 rounded-xl2 bg-bg px-3.5 py-2 text-[14px]">
                      <dt className="text-ink">{name}</dt>
                      <dd className={"rounded-full px-2.5 py-0.5 text-[12px] font-medium " + categoryTone(kind)}>{kind}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <figcaption className="px-5 py-2.5 border-t border-line text-[12px] text-muted">
                Example stylist reply
              </figcaption>
            </motion.figure>
          </div>
        </div>
      </section>

      <section>
        <div className="container-app py-16 sm:py-24">
          <h2 className="display text-[clamp(40px,6vw,72px)] text-ink max-w-[14ch]">How it works</h2>
          <ol className="mt-12 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className={"rounded-xl4 p-3 pb-7 " + s.tone}>
                <div className="relative aspect-[4/3] rounded-xl3 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image} alt={s.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                </div>
                <div className="px-3 sm:px-4">
                  <span className="mt-6 block display text-[48px] leading-none">{i + 1}</span>
                  <h3 className="mt-4 text-xl font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink/70 max-w-[36ch]">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-app pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-[28px] bg-lilac grid md:grid-cols-[1.25fr_1fr]">
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 w-[420px] h-[420px] rounded-full bg-sky blur-[100px] opacity-80" />
          <div className="relative px-6 sm:px-12 py-14 sm:py-20 flex flex-col justify-end">
            <h2 className="display text-[clamp(44px,6.4vw,96px)] !leading-[0.9] text-ink">
              Same face, same body. Only the clothes change.
            </h2>
            <p className="mt-8 text-lg leading-relaxed text-ink/75 max-w-[40ch]">
              Try-on renders start from your own photos, so you judge the fit and colour on
              you, not on a model. Your photos stay private to your account.
            </p>
            <Link href="/register" className="btn-primary btn-lg mt-8 self-start">
              Create account
            </Link>
          </div>
          <div className="relative min-h-[320px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/three-knits.jpg"
              alt="Three knit sweaters in mustard, cream and brown laid side by side"
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function MobileTopBar() {
  return (
    <div className="md:hidden container-app w-full h-14 flex items-center justify-between border-b border-line">
      <span className="display text-[26px] leading-none">VestoFit</span>
      <Link href="/login" className="text-[15px] text-ink">
        Sign in
      </Link>
    </div>
  );
}

const EXAMPLE_LOOK: [string, string][] = [
  ["Charcoal wool trousers", "Bottoms"],
  ["Cream cable knit", "Tops"],
];

const STEPS = [
  {
    title: "Photograph your clothes",
    body: "Snap each piece once. VestoFit tags the category, colour, pattern, formality, and season for you.",
    tone: "bg-sage text-sage-ink",
    image: "/images/folded-knits.jpg",
    alt: "Folded knitwear stacked on a shelf",
  },
  {
    title: "Ask for an outfit",
    body: "Tell the stylist where you're going. It builds looks from what you own and says when something is missing.",
    tone: "bg-sky text-sky-ink",
    image: "/images/flat-lay.jpg",
    alt: "An outfit laid flat: jeans, shirt and tie, blazer and brown shoes",
  },
  {
    title: "Try it on",
    body: "Upload a few photos of yourself once. Then see any outfit, or a piece from a shop, on your own body.",
    tone: "bg-blush text-blush-ink",
    image: "/images/rack.jpg",
    alt: "Shirts and knits in soft colours on a clothing rail",
  },
];
