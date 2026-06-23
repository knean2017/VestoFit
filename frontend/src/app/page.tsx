"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import SilhouettePreview from "@/components/SilhouettePreview";
import FloatingCard from "@/components/FloatingCard";
import QuickReplyChips, { type Chip } from "@/components/QuickReplyChips";
import ChatSheet from "@/components/ChatSheet";
import { useToast } from "@/components/Toast";
import { getToken } from "@/lib/auth";
import { api, WardrobeItem, StylistMessage } from "@/lib/api";

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

function StylistHome() {
  const toast = useToast();
  const router = useRouter();
  const reduce = useReducedMotion();

  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [suggestion, setSuggestion] = useState<WardrobeItem[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [messages, setMessages] = useState<StylistMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cardVisible, setCardVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flowStage, setFlowStage] = useState<"opener" | "narrowing" | "final">("opener");
  const [tags, setTags] = useState<string[]>([]);

  const hasWardrobe = wardrobe.length >= 2;

  function pickRandom(items: WardrobeItem[]) {
    const tops = items.filter((i) => i.category === "tops");
    const bottoms = items.filter((i) => i.category === "bottoms");
    const dresses = items.filter((i) => i.category === "dresses");

    let picked: WardrobeItem[] = [];
    let why = "";
    if (dresses.length > 0 && Math.random() > 0.5) {
      picked = [dresses[Math.floor(Math.random() * dresses.length)]];
      why = "A simple one-piece look for today";
    } else if (tops.length > 0 && bottoms.length > 0) {
      const t = tops[Math.floor(Math.random() * tops.length)];
      const b = bottoms[Math.floor(Math.random() * bottoms.length)];
      picked = [t, b];
      why = `${t.name || "A top"} paired with ${b.name || "bottoms"} — effortless`;
    } else if (items.length > 0) {
      picked = [items[Math.floor(Math.random() * items.length)]];
      why = "Here's something from your closet";
    }
    setSuggestion(picked);
    setReasoning(why);
    return { picked, why };
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [items, msgs] = await Promise.all([
        api.listWardrobe(),
        api.stylistMessages(),
      ]);
      setWardrobe(items);
      setMessages(msgs);
      if (items.length >= 2) {
        pickRandom(items);
        if (msgs.length === 0) {
          setReasoning("Going anywhere special today? Tap a vibe and I'll style it.");
          setCardVisible(true);
        }
      }
    } catch {
      // user may have an empty wardrobe — leave state empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentItemIds = suggestion.map((i) => i.id);

  function handleShuffle() {
    if (!hasWardrobe || shuffling) return;
    setCardVisible(false);
    setShuffling(true);
    const { why } = pickRandom(wardrobe);
    setReasoning(why);
    setCardVisible(true);
    setTimeout(() => setShuffling(false), 500);
  }

  function handleTryOn() {
    if (currentItemIds.length === 0) return;
    router.push(`/studio?items=${currentItemIds.join(",")}`);
  }

  async function sendPrompt(promptText: string, displayText?: string) {
    if (!hasWardrobe || sending) return;
    setCardVisible(false);
    setSending(true);
    pickRandom(wardrobe);
    const userText = displayText ?? promptText;
    const userMsg: StylistMessage = {
      id: Date.now().toString(),
      role: "user",
      content: userText,
      outfit_id: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    try {
      const { reply } = await api.stylistAsk(promptText, currentItemIds);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: reply,
          outfit_id: null,
          created_at: new Date().toISOString(),
        },
      ]);
      setReasoning(reply);
      setCardVisible(true);
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || sending) return;
    setInput("");
    await sendPrompt(msg);
  }

  const OPENER_CHIPS: Chip[] = [
    { label: "Work", value: "work" },
    { label: "Date night", value: "date night" },
    { label: "Casual day", value: "casual day" },
    { label: "Going out", value: "going out" },
  ];

  async function handleChip(value: string) {
    setTags((prev) => [...prev, value]);
    setFlowStage("final");
    await sendPrompt(
      `Suggest an outfit for ${value} from my wardrobe.`,
      value.charAt(0).toUpperCase() + value.slice(1),
    );
  }

  const showChips =
    hasWardrobe && flowStage !== "final" && cardVisible && messages.length === 0;

  /* ---------- Empty state ---------- */
  if (!loading && !hasWardrobe) {
    return (
      <main className="min-h-screen bg-bg pb-nav md:pb-0 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-2xl mx-auto w-full">
          <SilhouettePreview items={[]} className="opacity-80" />
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="mt-6"
          >
            <Link
              href="/wardrobe"
              className="btn-primary btn-lg animate-pulse2 inline-flex"
            >
              Add your first clothes
            </Link>
          </motion.div>
        </div>
        <BottomNav />
      </main>
    );
  }

  /* ---------- Loading skeleton ---------- */
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

  /* ---------- Proactive / Active state ---------- */
  return (
    <main className="min-h-screen bg-bg pb-nav md:pb-0 flex flex-col">
      <Header />

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-5">
        {/* Silhouette zone — ~60vh, relative for overlays */}
        <div className="relative flex-1 min-h-[55vh] flex items-center justify-center pt-4">
          <SilhouettePreview items={suggestion} />

          {/* Floating AI card overlapping the silhouette's bottom edge */}
          <div className="absolute inset-x-0 bottom-2 px-4 z-20 pointer-events-none">
            <FloatingCard
              open={cardVisible}
              text={reasoning}
              onDismiss={() => setCardVisible(false)}
            >
              {showChips && (
                <QuickReplyChips chips={OPENER_CHIPS} onSelect={handleChip} />
              )}
            </FloatingCard>
          </div>
        </div>

        {/* Action buttons row */}
        <div className="flex items-center justify-center gap-3 py-4">
          <motion.button
            type="button"
            onClick={handleShuffle}
            disabled={!hasWardrobe || shuffling}
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

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="text-sm font-semibold text-muted hover:text-coral transition-colors px-2 py-2"
            >
              History
            </button>
          )}
        </div>

        {/* Chat input bar — pinned above BottomNav, safe-area aware */}
        <form
          onSubmit={handleSend}
          className="flex gap-2 pb-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your stylist..."
            disabled={sending}
            className="field-sm flex-1"
          />
          <motion.button
            type="submit"
            disabled={!input.trim() || sending}
            className="btn-primary px-4 py-2 text-sm"
            whileTap={reduce ? undefined : { scale: 0.96 }}
          >
            {sending ? "..." : "Send"}
          </motion.button>
        </form>
      </div>

      <ChatSheet open={sheetOpen} messages={messages} onClose={() => setSheetOpen(false)} />
      <BottomNav />
    </main>
  );
}

/* ─── Unauthenticated: Landing page ─── */

function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col bg-bg">
      <Header />

      <section className="container-app pt-16 sm:pt-24 pb-16">
        <div className="max-w-3xl">
          <span className="chip-coral mb-6 animate-rise">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-coral" />
            Your personal stylist
          </span>

          <h1 className="font-extrabold tracking-tightest text-4xl sm:text-5xl md:text-6xl leading-[1.05] animate-rise">
            Your closet,{" "}
            <span className="text-coral">smarter.</span>
          </h1>

          <p
            className="mt-6 text-lg text-muted max-w-xl leading-relaxed font-medium animate-rise"
            style={{ animationDelay: "0.1s" }}
          >
            FitMe knows your wardrobe, suggests daily outfits, and lets you try on
            any clothes virtually — all powered by AI that actually understands your style.
          </p>

          <div
            className="mt-8 flex flex-wrap items-center gap-3 animate-rise"
            style={{ animationDelay: "0.2s" }}
          >
            <Link href="/register" className="btn-primary btn-lg">
              Get started free
            </Link>
            <Link href="/login" className="btn-ghost btn-lg">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="container-app pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <article
              key={s.title}
              className="card p-6 animate-rise"
              style={{ animationDelay: `${0.3 + i * 0.08}s` }}
            >
              <span className={"w-8 h-8 rounded-full grid place-items-center text-sm font-bold text-white " + s.color}>
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                {s.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="container-app pb-24">
        <div className="card p-8 sm:p-10">
          <h2 className="heading-lg text-center mb-8">Why FitMe?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div key={f.t} className="flex gap-3">
                <span className="w-10 h-10 rounded-xl bg-coralSoft text-coral grid place-items-center text-lg shrink-0">
                  {f.icon}
                </span>
                <div>
                  <p className="font-bold">{f.t}</p>
                  <p className="text-sm text-muted leading-relaxed mt-0.5">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-line">
        <div className="container-app py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted">
          <p>© FitMe {new Date().getFullYear()}</p>
          <p className="font-medium">Made for the well-dressed.</p>
        </div>
      </footer>
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
