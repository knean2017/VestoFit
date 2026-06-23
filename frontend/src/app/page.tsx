"use client";

import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
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
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [suggestion, setSuggestion] = useState<WardrobeItem[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [messages, setMessages] = useState<StylistMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [items, msgs] = await Promise.all([
        api.listWardrobe(),
        api.stylistMessages(),
      ]);
      setWardrobe(items);
      setMessages(msgs);
      if (items.length >= 2) {
        pickRandom(items);
      }
    } catch {
      // silently handle — user may have empty wardrobe
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function pickRandom(items: WardrobeItem[]) {
    const tops = items.filter((i) => i.category === "tops");
    const bottoms = items.filter((i) => i.category === "bottoms");
    const dresses = items.filter((i) => i.category === "dresses");

    let picked: WardrobeItem[] = [];
    if (dresses.length > 0 && Math.random() > 0.5) {
      picked = [dresses[Math.floor(Math.random() * dresses.length)]];
      setReasoning("A simple one-piece look for today");
    } else if (tops.length > 0 && bottoms.length > 0) {
      const t = tops[Math.floor(Math.random() * tops.length)];
      const b = bottoms[Math.floor(Math.random() * bottoms.length)];
      picked = [t, b];
      setReasoning(`${t.name || "A top"} paired with ${b.name || "bottoms"} — effortless`);
    } else if (items.length > 0) {
      picked = [items[Math.floor(Math.random() * items.length)]];
      setReasoning("Here's something from your closet");
    }
    setSuggestion(picked);
  }

  async function handleShuffle() {
    if (wardrobe.length < 2) return;
    setShuffling(true);
    await new Promise((r) => setTimeout(r, 300));
    pickRandom(wardrobe);
    setShuffling(false);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput("");
    setSending(true);
    try {
      const { reply } = await api.stylistAsk(msg);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "user", content: msg, outfit_id: null, created_at: new Date().toISOString() },
        { id: (Date.now() + 1).toString(), role: "assistant", content: reply, outfit_id: null, created_at: new Date().toISOString() },
      ]);
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  const hasWardrobe = wardrobe.length >= 2;

  return (
    <main className="min-h-screen bg-bg pb-nav md:pb-0">
      <Header />
      <div className="container-app py-6 space-y-6 max-w-2xl mx-auto">
        {/* Greeting */}
        <div className="animate-rise">
          <h1 className="heading-lg">Hey there</h1>
          <p className="text-muted font-medium mt-1">
            {hasWardrobe ? "Here's today's outfit pick" : "Let's build your wardrobe first"}
          </p>
        </div>

        {/* Empty wardrobe CTA */}
        {!hasWardrobe && (
          <div className="card p-8 text-center animate-rise" style={{ animationDelay: "0.1s" }}>
            <div className="w-16 h-16 rounded-full bg-coralSoft grid place-items-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/><path d="M12 5v16"/><path d="M3 5a2 2 0 012-2h14a2 2 0 012 2"/></svg>
            </div>
            <h3 className="heading-md">Your closet awaits</h3>
            <p className="text-sm text-muted mt-2 max-w-xs mx-auto">
              Add at least 2 items to your wardrobe and your stylist will start suggesting outfits
            </p>
            <Link href="/wardrobe" className="btn-primary mt-5 inline-flex">
              Add clothes
            </Link>
          </div>
        )}

        {/* Chat section with Today's Pick embedded */}
        <div className="card animate-rise" style={{ animationDelay: "0.2s" }}>
          <div className="p-4 border-b border-line">
            <h2 className="font-bold text-ink">Chat with your stylist</h2>
            <p className="text-xs text-muted mt-0.5">Ask about outfits, styling tips, or what to wear</p>
          </div>

          {/* Messages */}
          <div className="p-4 space-y-3 max-h-[28rem] overflow-y-auto">
            {/* Today's Pick — inside chat, hidden once conversation starts */}
            {hasWardrobe && suggestion.length > 0 && messages.length === 0 && (
              <div className="rounded-xl3 bg-surface2 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="chip-coral text-xs">Today's pick</span>
                </div>
                <div className={
                  "flex gap-3 overflow-x-auto pb-1 " +
                  (shuffling ? "opacity-50 scale-95 transition-all duration-200" : "transition-all duration-200")
                }>
                  {suggestion.map((item) => (
                    <div key={item.id} className="flex-shrink-0 w-24">
                      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-bg">
                        <img
                          src={item.clean_image_url || item.image_url}
                          alt={item.name || item.category}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs font-semibold mt-1.5 truncate">{item.name || item.category}</p>
                      {item.color && <p className="text-[10px] text-muted">{item.color}</p>}
                    </div>
                  ))}
                </div>
                {reasoning && (
                  <p className="text-xs text-muted mt-2 italic">{reasoning}</p>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={handleShuffle} disabled={shuffling} className="btn-soft text-xs px-3 py-1.5 flex-1">
                    {shuffling ? "Shuffling..." : "Shuffle"}
                  </button>
                  <Link href="/studio" className="btn-primary text-xs px-3 py-1.5 flex-1 text-center">
                    Try on
                  </Link>
                </div>
              </div>
            )}

            {messages.length === 0 && !hasWardrobe && (
              <div className="text-center py-8">
                <p className="text-sm text-muted">
                  Add some clothes first, then ask your stylist anything
                </p>
              </div>
            )}
            {messages.length === 0 && hasWardrobe && suggestion.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted">
                  Try &quot;What should I wear for a date night?&quot;
                </p>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  "flex " + (m.role === "user" ? "justify-end" : "justify-start")
                }
              >
                <div
                  className={
                    "max-w-[80%] rounded-xl3 px-4 py-2.5 text-sm " +
                    (m.role === "user"
                      ? "bg-coral text-white rounded-br-lg"
                      : "bg-surface2 text-ink rounded-bl-lg")
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Composer */}
          <form onSubmit={handleSend} className="p-3 border-t border-line flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={hasWardrobe ? "Ask your stylist..." : "Add wardrobe items first"}
              disabled={!hasWardrobe || sending}
              className="field-sm flex-1"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || !hasWardrobe}
              className="btn-primary px-4 py-2 text-sm"
            >
              {sending ? "..." : "Send"}
            </button>
          </form>
        </div>
      </div>
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
