# FitMe Home Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the authenticated FitMe home page (`StylistHome` in `app/page.tsx`) around a centered body silhouette as the visual centerpiece (~60% of viewport). The AI stylist becomes proactive and conversational: typing a message or tapping a quick-reply chip animates a new outfit onto the silhouette while the AI's reasoning appears in a floating card. Add a Framer Motion animation system available app-wide, applied fully to the home page, the silhouette, and the landing scroll reveals in this iteration.

**Architecture:** Next.js 14 App Router, client components. A new `framer-motion` dependency drives all motion. New shared components live in `frontend/src/components/`. `StylistHome` is fully rewritten to a flex-column layout with three mutually exclusive states (empty / proactive / active conversation) driven by `wardrobe.length` and `messages.length`. Silhouette outfit changes are **client-derived** (`pickRandom` over the wardrobe) because `api.stylistAsk` returns only `{ reply: string }` — the API drives the text, the client drives the visual outfit. A small client-side state machine (`flowStage` + accumulated tags) implements the proactive stylist flow. `layout.tsx` wraps `children` in a new `PageTransition`. No backend changes.

**Tech Stack:** Next.js 14.2.13, React 18.3.1, TypeScript 5.6, Tailwind 3.4, Framer Motion (new). Verification via `npx next build` + Playwright screenshots (no unit-test framework is configured).

## Global Constraints

- **Platform:** Windows. The repo root is `C:\Users\Envy\Desktop\VTO`. The frontend is in `frontend/`. Run build/dev commands from `frontend/`.
- **Build command:** `cd frontend && npx next build` — must pass with zero errors after every task.
- **Dev server:** `cd frontend && npm run dev` (port 3000).
- **No test framework.** Do not write Jest/Vitest tests. Verify with build + Playwright screenshots.
- **Design tokens only.** Use existing Tailwind tokens (`bg`, `surface`, `surface2`, `ink`, `muted`, `coral`, `coralSoft`, `teal`, `tealSoft`, `line`, radii `xl2/xl3/xl4`, shadows `soft/glow/glow2/lifted/ring`, font Nunito) and existing CSS classes (`.card`, `.btn-primary`, `.btn-soft`, `.btn-ghost`, `.chip-coral`, `.field-sm`, `.pb-nav`, `.heading-lg`, `.heading-md`). Do not introduce new hex colors.
- **API facts (do not change):** `api.listWardrobe()` → `WardrobeItem[]`; `api.stylistAsk(prompt, item_ids?)` → `{ reply: string }` (text only, **no** item IDs); `api.stylistMessages()` → `StylistMessage[]`. `Category = "tops" | "bottoms" | "dresses"`.
- **Silhouette outfits are client-derived.** Never assume `stylistAsk` returns an outfit. Derive the silhouette via `pickRandom(wardrobe)` locally and animate it immediately; settle the text when the reply lands.
- **`hasWardrobe` threshold:** `wardrobe.length >= 2` (unchanged from current code).
- **Reduced motion:** gate non-essential motion (page slides, hover lifts, shuffle spin, scroll reveals, silhouette transitions reduce to opacity-only) behind Framer Motion's `useReducedMotion()` hook.
- **Safe area:** the chat input bar must sit above `BottomNav` (`h-16`, `md:hidden`) and respect `env(safe-area-inset-bottom)`.
- **Scope guard:** Do not restyle Header, BottomNav, wardrobe, shop, studio, or settings. Do not change Toast's public API (`useToast()` returning `(kind, message) => void`). Landing page changes are scroll-reveal swap only.
- **`"use client"`** is required at the top of every new component and of `page.tsx` / `PageTransition.tsx` (they use hooks).

---

## Task 1 — Install Framer Motion + PageTransition wrapper

Adds the `framer-motion` dependency and a route-transition wrapper, wired into `layout.tsx`. Enter transition guaranteed; exit is best-effort under App Router (ship enter-only if exit proves unreliable).

**Files**
- Modify: `frontend/package.json` (via npm install)
- Create: `frontend/src/components/PageTransition.tsx`
- Modify: `frontend/src/app/layout.tsx`

**Interfaces**
- Consumes: `next/navigation` `usePathname`, `framer-motion` (`motion`, `AnimatePresence`, `useReducedMotion`).
- Produces: `<PageTransition>{children}</PageTransition>` default-exported client component.

**Steps**

- [ ] Install Framer Motion (pins a version compatible with React 18 / Next 14):
```bash
cd "C:/Users/Envy/Desktop/VTO/frontend" && npm install framer-motion@11.11.17
```
Expected: `package.json` `dependencies` now contains `"framer-motion": "11.11.17"` and `node_modules/framer-motion` exists.

- [ ] Create `frontend/src/components/PageTransition.tsx`:
```tsx
"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0 }}
        transition={
          reduce
            ? { duration: 0.01 }
            : {
                type: "spring",
                stiffness: 260,
                damping: 26,
                duration: 0.3,
              }
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] Wire it into `frontend/src/app/layout.tsx`. Replace the import block and the `<body>` content. Change the imports at the top:
```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import PageTransition from "@/components/PageTransition";
```
Then replace the `<ToastProvider>{children}</ToastProvider>` line with:
```tsx
        <ToastProvider>
          <PageTransition>{children}</PageTransition>
        </ToastProvider>
```

- [ ] Verify build:
```bash
cd "C:/Users/Envy/Desktop/VTO/frontend" && npx next build
```
Expected: `✓ Compiled successfully` and the route table prints with no type errors.

- [ ] Commit:
```bash
cd "C:/Users/Envy/Desktop/VTO" && git add -A && git commit -m "feat(home): add framer-motion + PageTransition wrapper"
```

---

## Task 2 — Shared motion components (MotionCard, FloatingCard, QuickReplyChips, ChatSheet)

Creates the four reusable presentational/interaction components the home rewrite depends on. Each is self-contained and build-verifiable in isolation.

**Files**
- Create: `frontend/src/components/MotionCard.tsx`
- Create: `frontend/src/components/QuickReplyChips.tsx`
- Create: `frontend/src/components/FloatingCard.tsx`
- Create: `frontend/src/components/ChatSheet.tsx`

**Interfaces**
- Consumes: `framer-motion`, `@/lib/api` (`StylistMessage`).
- Produces:
  - `MotionCard({ children, className?, onClick? })` — hover-lift + tap-press card.
  - `QuickReplyChips({ chips: { label: string; value: string }[]; onSelect(value: string): void; className? })`.
  - `FloatingCard({ open: boolean; text: string; onDismiss(): void; children?: React.ReactNode })` — auto-dismiss after 6s, AnimatePresence enter/exit.
  - `ChatSheet({ open: boolean; messages: StylistMessage[]; onClose(): void })` — pull-up sheet.

**Steps**

- [ ] Create `frontend/src/components/MotionCard.tsx`:
```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function MotionCard({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      onClick={onClick}
      className={"card " + className}
      whileHover={reduce ? undefined : { y: -2, boxShadow: "0 8px 32px rgba(42, 37, 34, 0.10)" }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] Create `frontend/src/components/QuickReplyChips.tsx`:
```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";

export type Chip = { label: string; value: string };

export default function QuickReplyChips({
  chips,
  onSelect,
  className = "",
}: {
  chips: Chip[];
  onSelect: (value: string) => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={"flex flex-wrap items-center justify-center gap-2 " + className}>
      {chips.map((chip, i) => (
        <motion.button
          key={chip.value}
          type="button"
          onClick={() => onSelect(chip.value)}
          className="chip-coral text-xs px-3.5 py-2"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduce
              ? { duration: 0.01 }
              : { type: "spring", stiffness: 300, damping: 22, delay: i * 0.05 }
          }
          whileTap={reduce ? undefined : { scale: 0.94 }}
        >
          {chip.label}
        </motion.button>
      ))}
    </div>
  );
}
```

- [ ] Create `frontend/src/components/FloatingCard.tsx`. Auto-dismiss resets whenever `text` changes (each new reply re-arms the 6s timer):
```tsx
"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export default function FloatingCard({
  open,
  text,
  onDismiss,
  children,
}: {
  open: boolean;
  text: string;
  onDismiss: () => void;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [open, text, onDismiss]);

  return (
    <AnimatePresence>
      {open && text && (
        <motion.div
          className="pointer-events-auto"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={
            reduce
              ? { duration: 0.01 }
              : { type: "spring", stiffness: 300, damping: 26 }
          }
        >
          <div className="card border border-line shadow-lifted px-4 py-3 max-w-sm mx-auto">
            <div className="flex items-start gap-2.5">
              <span className="w-7 h-7 shrink-0 rounded-full bg-coral text-white grid place-items-center text-xs font-extrabold shadow-glow">
                F
              </span>
              <p className="text-sm font-semibold text-ink leading-snug">{text}</p>
            </div>
            {children && <div className="mt-3">{children}</div>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] Create `frontend/src/components/ChatSheet.tsx`. Renders messages in the existing bubble style; spring slide-up; backdrop scrim; dismiss on backdrop tap / drag-down / close button:
```tsx
"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { StylistMessage } from "@/lib/api";

export default function ChatSheet({
  open,
  messages,
  onClose,
}: {
  open: boolean;
  messages: StylistMessage[];
  onClose: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.01 : 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-xl4 bg-surface shadow-lifted flex flex-col"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={
              reduce
                ? { duration: 0.01 }
                : { type: "spring", stiffness: 300, damping: 32 }
            }
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose();
            }}
          >
            <div className="pt-3 pb-2 flex items-center justify-center">
              <span className="h-1.5 w-12 rounded-full bg-line" />
            </div>
            <div className="px-5 pb-2 flex items-center justify-between border-b border-line">
              <h2 className="font-bold text-ink">Conversation</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-semibold text-muted hover:text-coral transition-colors px-2 py-1"
              >
                Close
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto p-5 space-y-3"
              style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
            >
              {messages.length === 0 ? (
                <p className="text-center text-sm text-muted py-8">No messages yet</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}
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
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] Verify build (components compile even though not yet imported anywhere — Next tree-shakes unused, so add a temporary no-op is unnecessary; build still type-checks the files):
```bash
cd "C:/Users/Envy/Desktop/VTO/frontend" && npx next build
```
Expected: `✓ Compiled successfully`, no type errors. (Note: Next only type-checks files reachable from the graph; these become reachable in Task 4. If the build does not surface errors here, the type check in Task 4 covers them. Proceed if compile succeeds.)

- [ ] Commit:
```bash
cd "C:/Users/Envy/Desktop/VTO" && git add -A && git commit -m "feat(home): add MotionCard, FloatingCard, QuickReplyChips, ChatSheet"
```

---

## Task 3 — Silhouette outfit transitions (Framer Motion)

Wraps each clothing layer in `SilhouettePreview` with `motion.div` under `AnimatePresence` keyed by item id. Tops drop from above, bottoms rise from below, 150ms stagger, spring. Public props (`items`, `className`) and absolute positioning unchanged.

**Files**
- Modify: `frontend/src/components/SilhouettePreview.tsx`

**Interfaces**
- Consumes: `framer-motion` (`AnimatePresence`, `motion`, `useReducedMotion`). Existing `SilhouetteItem`, `LAYER_STYLE`, `orderForPreview`, `layerKey` are reused unchanged.
- Produces: same default export `SilhouettePreview({ items, className })`.

**Steps**

- [ ] Replace the entire contents of `frontend/src/components/SilhouettePreview.tsx` with the motion-wrapped version. The SVG outline, `LAYER_STYLE`, `orderForPreview`, and `layerKey` are byte-for-byte the same as today; only the layer `.map` and imports change:
```tsx
"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Category, WardrobeItem } from "@/lib/api";

type SilhouetteItem = Pick<
  WardrobeItem,
  "id" | "category" | "clean_image_url" | "image_url"
>;

const LAYER_STYLE: Record<
  Category | "outer",
  { top: string; left: string; width: string; height: string; zIndex: number }
> = {
  tops: {
    top: "18%",
    left: "22%",
    width: "56%",
    height: "28%",
    zIndex: 2,
  },
  bottoms: {
    top: "44%",
    left: "26%",
    width: "48%",
    height: "38%",
    zIndex: 1,
  },
  dresses: {
    top: "16%",
    left: "20%",
    width: "60%",
    height: "66%",
    zIndex: 2,
  },
  outer: {
    top: "14%",
    left: "18%",
    width: "64%",
    height: "32%",
    zIndex: 3,
  },
};

function orderForPreview(items: SilhouetteItem[]): SilhouetteItem[] {
  const dresses = items.filter((i) => i.category === "dresses");
  if (dresses.length) return [dresses[0]];

  const tops = items.filter((i) => i.category === "tops");
  const bottoms = items.filter((i) => i.category === "bottoms");
  if (tops.length === 1 && bottoms.length === 1) return [tops[0], bottoms[0]];
  if (tops.length === 2 && bottoms.length === 1)
    return [tops[0], bottoms[0], tops[1]];
  return items;
}

function layerKey(item: SilhouetteItem, index: number, ordered: SilhouetteItem[]) {
  if (item.category === "dresses") return "dresses";
  if (item.category === "bottoms") return "bottoms";
  const tops = ordered.filter((i) => i.category === "tops");
  if (item.category === "tops" && tops.length > 1 && item.id === tops[1]?.id) {
    return "outer";
  }
  return "tops";
}

export default function SilhouettePreview({
  items,
  className = "",
}: {
  items: SilhouetteItem[];
  className?: string;
}) {
  const ordered = orderForPreview(items);
  const reduce = useReducedMotion();

  return (
    <div
      className={
        "relative mx-auto aspect-[3/5] w-full max-w-[280px] " + className
      }
    >
      <svg
        viewBox="0 0 200 340"
        className="absolute inset-0 h-full w-full text-line"
        aria-hidden
      >
        <ellipse cx="100" cy="28" rx="22" ry="26" fill="currentColor" opacity="0.35" />
        <path
          d="M72 52 Q58 68 52 92 L48 130 Q46 150 52 168 L56 200 Q58 230 54 260 L52 310 Q52 322 62 328 L138 328 Q148 322 148 310 L146 260 Q142 230 144 200 L148 168 Q154 150 152 130 L148 92 Q142 68 128 52 Z"
          fill="currentColor"
          opacity="0.2"
        />
        <path
          d="M72 52 L128 52 L118 88 L82 88 Z"
          fill="currentColor"
          opacity="0.08"
        />
      </svg>

      <AnimatePresence>
        {ordered.map((item, idx) => {
          const key = layerKey(item, idx, ordered);
          const style = LAYER_STYLE[key];
          const img = item.clean_image_url || item.image_url;
          const fromY = reduce ? 0 : key === "bottoms" ? 20 : -20;
          return (
            <motion.div
              key={item.id}
              className="absolute pointer-events-none"
              style={{
                top: style.top,
                left: style.left,
                width: style.width,
                height: style.height,
                zIndex: style.zIndex,
              }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: fromY, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
              transition={
                reduce
                  ? { duration: 0.01 }
                  : {
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                      delay: idx * 0.15,
                    }
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt=""
                className="h-full w-full object-contain drop-shadow-sm"
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {ordered.length === 0 && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <p className="text-sm text-muted font-serif italic">
            Pick items to preview your outfit
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] Verify build:
```bash
cd "C:/Users/Envy/Desktop/VTO/frontend" && npx next build
```
Expected: `✓ Compiled successfully`, no type errors.

- [ ] Commit:
```bash
cd "C:/Users/Envy/Desktop/VTO" && git add -A && git commit -m "feat(silhouette): animate outfit layers with framer-motion"
```

---

## Task 4 — Rewrite StylistHome: layout, states, shuffle, try-on, chat

Full rewrite of the authenticated home in `app/page.tsx`. New centered-silhouette layout, the three states (empty / proactive / active), shuffle, try-on navigation, message send, floating card, chat input bar, ChatSheet trigger, and skeleton loading. The proactive flow state machine is added in Task 5 — this task stubs `flowStage`/chips minimally so the page builds and the proactive *opener* shows, then Task 5 fleshes out narrowing. `LandingPage` and the `STEPS`/`FEATURES` consts are unchanged in this task (landing reveals are Task 6).

**Files**
- Modify: `frontend/src/app/page.tsx`

**Interfaces**
- Consumes: `@/components/SilhouettePreview`, `@/components/FloatingCard`, `@/components/QuickReplyChips` (+ its `Chip` type), `@/components/ChatSheet`, `@/components/Header`, `@/components/BottomNav`, `useToast`, `api`, `WardrobeItem`, `StylistMessage`, `getToken`, `framer-motion`, `next/navigation` `useRouter`.
- Produces: rewritten `StylistHome`. `HomePage` auth switch unchanged. `LandingPage` unchanged (this task).

**Steps**

- [ ] Replace the top imports and the **entire `StylistHome` function** (lines from `function StylistHome() {` through its closing `}` before `/* ─── Unauthenticated: Landing page ─── */`). Leave `HomePage`, `LandingPage`, `STEPS`, `FEATURES` intact. New import block at the very top of the file:
```tsx
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
```

- [ ] Replace the whole `StylistHome` function with the following. (`HomePage` above it stays as-is; this version introduces `flowStage` set to `"opener"` and a single opener chip set — Task 5 extends `handleChip` and the chip config for narrowing.)
```tsx
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
    // NOTE: /studio currently has no item pre-selection mechanism (verified:
    // it does avatar + garment URL/upload only). We pass IDs via query string;
    // wiring the studio side to read ?items= is a separate follow-up (out of scope).
    router.push(`/studio?items=${currentItemIds.join(",")}`);
  }

  async function sendPrompt(promptText: string, displayText?: string) {
    if (!hasWardrobe || sending) return;
    setCardVisible(false);
    setSending(true);
    // Visual: derive + animate a new outfit immediately, do not wait on the API.
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

  // Proactive flow — opener chips. Task 5 extends this for narrowing/final.
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
```

- [ ] Add the `btn-lg` class used by the empty-state CTA if it is not already defined. Check `globals.css`:
```bash
cd "C:/Users/Envy/Desktop/VTO/frontend" && grep -n "btn-lg" src/app/globals.css
```
If it prints nothing, add this inside the `@layer components` block of `frontend/src/app/globals.css`, immediately after the `.btn-link` rule:
```css
  .btn-lg {
    @apply px-7 py-3.5 text-base;
  }
```
(If `grep` shows `btn-lg` already exists, skip this edit. The landing page already uses `btn-lg`, so it most likely exists — verify before adding to avoid a duplicate.)

- [ ] Verify build (this is where the Task 2 components are type-checked through the graph):
```bash
cd "C:/Users/Envy/Desktop/VTO/frontend" && npx next build
```
Expected: `✓ Compiled successfully`, no type errors. If `Chip` import or any prop mismatch errors appear, fix to match the Task 2 signatures before proceeding.

- [ ] Commit:
```bash
cd "C:/Users/Envy/Desktop/VTO" && git add -A && git commit -m "feat(home): rewrite StylistHome around centered silhouette + chat bar"
```

---

## Task 5 — Proactive stylist flow (narrowing state machine)

Extends `handleChip` from a single-shot (opener → final) into a 2–3 exchange flow: opener → narrowing → final. Intermediate narrowing copy + chips are **local strings** (snappy, no API latency); only the **final** step calls `api.stylistAsk` so the recommendation reasoning is genuine AI output. Silhouette refines via `pickRandom` at every step.

**Files**
- Modify: `frontend/src/app/page.tsx` (only the proactive-flow pieces inside `StylistHome`)

**Interfaces**
- Consumes: existing `Chip` type, `pickRandom`, `sendPrompt`, `setReasoning`, `setCardVisible`, `flowStage`, `tags` from Task 4.
- Produces: a stage-driven chip config and a multi-step `handleChip`.

**Steps**

- [ ] In `frontend/src/app/page.tsx`, replace the `OPENER_CHIPS` const and the `handleChip` function (both added in Task 4) with a stage-driven config plus a multi-step handler. Find:
```tsx
  // Proactive flow — opener chips. Task 5 extends this for narrowing/final.
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
```
Replace it with:
```tsx
  // Proactive flow config: opener -> narrowing -> final.
  const OPENER_CHIPS: Chip[] = [
    { label: "Work", value: "work" },
    { label: "Date night", value: "date night" },
    { label: "Casual day", value: "casual day" },
    { label: "Going out", value: "going out" },
  ];
  const NARROWING_CHIPS: Chip[] = [
    { label: "Dressy", value: "dressy" },
    { label: "Laid-back", value: "laid-back" },
    { label: "Bold", value: "bold" },
    { label: "Minimal", value: "minimal" },
  ];
  const activeChips = flowStage === "opener" ? OPENER_CHIPS : NARROWING_CHIPS;

  async function handleChip(value: string) {
    const nextTags = [...tags, value];
    setTags(nextTags);

    if (flowStage === "opener") {
      // Local narrowing question — no API call, instant. Refine silhouette.
      pickRandom(wardrobe);
      setFlowStage("narrowing");
      setReasoning(`${cap(value)} it is — dressy or laid-back?`);
      setCardVisible(true);
      return;
    }

    // Narrowing -> final: call the API for genuine reasoning.
    setFlowStage("final");
    const prompt = `Suggest an outfit for ${nextTags.join(", ")} from my wardrobe.`;
    await sendPrompt(prompt, cap(value));
  }
```

- [ ] Add a small `cap` helper. Place it just above the `StylistHome` function (module scope, after the `HomePage` function):
```tsx
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

- [ ] Update the floating-card chips to use `activeChips` and to remain visible through the narrowing stage. Find this block inside the silhouette zone JSX:
```tsx
              {showChips && (
                <QuickReplyChips chips={OPENER_CHIPS} onSelect={handleChip} />
              )}
```
Replace with:
```tsx
              {showChips && (
                <QuickReplyChips chips={activeChips} onSelect={handleChip} />
              )}
```

- [ ] Update `showChips` so chips show during `opener` and `narrowing` (not `final`), and persist while the proactive flow is mid-conversation. Find:
```tsx
  const showChips =
    hasWardrobe && flowStage !== "final" && cardVisible && messages.length === 0;
```
Replace with:
```tsx
  const showChips =
    hasWardrobe &&
    flowStage !== "final" &&
    cardVisible &&
    messages.length === 0;
```
(The condition is intentionally unchanged in logic — `messages.length === 0` still holds during opener/narrowing because narrowing is local and adds no messages; only the final step appends messages. This step documents the invariant; if the build later shows chips lingering after the final API call, the `messages.length === 0` guard already hides them.)

- [ ] Verify build:
```bash
cd "C:/Users/Envy/Desktop/VTO/frontend" && npx next build
```
Expected: `✓ Compiled successfully`, no type errors.

- [ ] Commit:
```bash
cd "C:/Users/Envy/Desktop/VTO" && git add -A && git commit -m "feat(home): proactive stylist flow with local narrowing + final API call"
```

---

## Task 6 — Landing page scroll reveals (CSS → Framer Motion)

Swaps the landing page's CSS `animate-rise` scroll-in for Framer Motion `whileInView` stagger + spring. This is the **only** change to `LandingPage`. Hero, step cards, and feature grid get viewport-triggered reveals.

**Files**
- Modify: `frontend/src/app/page.tsx` (`LandingPage` function only)

**Interfaces**
- Consumes: `framer-motion` `motion`, `useReducedMotion` (already imported at top from Task 4).
- Produces: animated `LandingPage` with identical layout/markup, motion-wrapped.

**Steps**

- [ ] Replace the entire `LandingPage` function in `frontend/src/app/page.tsx` with the motion version below. Markup and copy are identical; `animate-rise` classes are removed and replaced by `motion` `whileInView`. The `STEPS` and `FEATURES` consts below it stay unchanged:
```tsx
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
            FitMe knows your wardrobe, suggests daily outfits, and lets you try on
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
          <h2 className="heading-lg text-center mb-8">Why FitMe?</h2>
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

      <footer className="mt-auto border-t border-line">
        <div className="container-app py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted">
          <p>© FitMe {new Date().getFullYear()}</p>
          <p className="font-medium">Made for the well-dressed.</p>
        </div>
      </footer>
    </main>
  );
}
```

- [ ] Verify build:
```bash
cd "C:/Users/Envy/Desktop/VTO/frontend" && npx next build
```
Expected: `✓ Compiled successfully`, no type errors.

- [ ] Commit:
```bash
cd "C:/Users/Envy/Desktop/VTO" && git add -A && git commit -m "feat(landing): framer-motion scroll reveals replacing CSS animate-rise"
```

---

## Task 7 — Visual verification with Playwright

Runs the app and captures screenshots of the redesigned home (all three states), the landing reveals, and confirms no regressions on wardrobe/shop/studio/settings. No code changes unless a defect is found.

**Files**
- None (verification only). Any fix required goes back into the relevant task's file.

**Interfaces**
- Consumes: running dev server, Playwright MCP browser tools.

**Steps**

- [ ] Start the dev server in the background:
```bash
cd "C:/Users/Envy/Desktop/VTO/frontend" && npm run dev
```
Wait for `Ready` / `Local: http://localhost:3000`. (Use a background run; do not block.)

- [ ] Confirm the server is up:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```
Expected: `200`.

- [ ] Landing (unauthenticated): with Playwright, `browser_navigate` to `http://localhost:3000`, `browser_resize` to 1280x800, scroll down once to trigger reveals, then `browser_take_screenshot` to `docs/superpowers/plans/screenshots/landing.png`. Confirm hero, step cards, and feature grid render and animate in (no blank sections).

- [ ] Empty home state: in Playwright, set a token to authenticate against a wardrobe with <2 items. Run `browser_evaluate` with `() => localStorage.setItem("fitme.token", "<a valid test token>")`, navigate to `http://localhost:3000`, `browser_resize` to 390x844 (mobile). Screenshot to `.../home-empty.png`. Confirm a bare silhouette + a single pulsing "Add your first clothes" button, and **no** floating card / chips / input bar.
  - If no valid token / test account is available, document this state as "manually verify" and skip the screenshot rather than fabricating auth.

- [ ] Proactive home state: with a token for an account that has ≥2 wardrobe items and no stylist messages, navigate to `http://localhost:3000` at 390x844. Screenshot to `.../home-proactive.png`. Confirm: outfit on silhouette, floating card opener text, quick-reply chips (Work / Date night / Casual day / Going out), Shuffle + Try On row, and the chat input bar pinned above BottomNav.

- [ ] Interaction check: `browser_click` the Shuffle button → confirm the silhouette outfit changes (re-screenshot to `.../home-shuffle.png`). `browser_click` a chip (e.g. "Date night") → confirm the card updates to a narrowing question with new chips (`.../home-narrowing.png`).

- [ ] Regression sweep: navigate to `/wardrobe`, `/shop`, `/studio`, `/settings` (authenticated). For each, `browser_snapshot` and confirm the page renders without console errors via `browser_console_messages` (expect no uncaught errors). Screenshot any that look off.

- [ ] Reduced-motion check: `browser_evaluate` to emulate reduced motion is limited; instead confirm via code review that every `motion` usage in Tasks 1–6 gates on `useReducedMotion()` (already verified in those tasks). Note result in the verification summary.

- [ ] Final build gate:
```bash
cd "C:/Users/Envy/Desktop/VTO/frontend" && npx next build
```
Expected: `✓ Compiled successfully`, no errors. This is the authoritative pass/fail for the redesign.

- [ ] Stop the dev server (use TaskStop on the background task, or kill the port).

- [ ] Commit screenshots + any fixes:
```bash
cd "C:/Users/Envy/Desktop/VTO" && git add -A && git commit -m "test(home): playwright visual verification screenshots"
```

---

## Self-Review

**Spec coverage (every §section → task):**
- §3 Layout & structure → Task 4 (silhouette zone, action row, floating card overlap, input bar, history trigger, BottomNav).
- §4.1 Empty state → Task 4 (bare silhouette + pulsing CTA, no card/chips/input).
- §4.2 Proactive state → Task 4 (opener) + Task 5 (full flow).
- §4.3 Active conversation → Task 4 (latest outfit + reply, ChatSheet history).
- §5.1 Shuffle → Task 4 (`handleShuffle`, spin animation, card reset, no API).
- §5.2 Try On → Task 4 (`handleTryOn`, query string, studio follow-up flagged).
- §5.3 Send message → Task 4 (`sendPrompt`/`handleSend`: API text + client outfit, both messages appended, toast on error).
- §5.4 Floating card dismissal → Task 2 `FloatingCard` (6s timer re-armed on `text` change) + Task 4 (dismiss on shuffle/chip/send via `setCardVisible(false)`).
- §6 Proactive flow → Task 5 (opener→narrowing→final state machine; local narrowing, final API call).
- §7.1 Page transitions → Task 1 `PageTransition`.
- §7.2 Micro-interactions → Task 2 `MotionCard`, Task 4 buttons (`whileTap`), shuffle spin. (Toast motion-wrapping is optional polish; spec §9 keeps Toast's API unchanged — not required for success criteria, left as-is to avoid touching Toast. Flagged below.)
- §7.3 Scroll reveals → Task 6.
- §7.4 Silhouette transitions → Task 3.
- §7.5 Loading skeleton → Task 4 (`loading` state + `.skeleton`).
- §7.6 Reduced motion → every task gates on `useReducedMotion()`.
- §8 Component architecture → Tasks 1–2 create all five new files; Tasks 3–6 modify the three existing files.
- §11 Open questions: (1) studio contract → resolved as query string + flagged follow-up in Task 4; (2) client-derived silhouette → honored throughout; (3) exit animations → `PageTransition` ships enter+fade-exit, best-effort per spec; (4) API cadence → Task 5 calls API only at final step.

**Placeholder scan:** No `TODO`, no "similar to Task N", no "add appropriate handling" — every code step is complete and copy-paste ready. The one cross-task dependency (`OPENER_CHIPS`/`handleChip` introduced in Task 4, replaced in Task 5) shows both full versions.

**Type consistency:** `Chip = { label: string; value: string }` defined in Task 2, imported in Task 4/5. `FloatingCard` props (`open`, `text`, `onDismiss`, `children`) match call site. `ChatSheet` props (`open`, `messages: StylistMessage[]`, `onClose`) match. `SilhouettePreview` keeps `{ items, className }`. `pickRandom` returns `{ picked, why }` and is used by name in shuffle/send. `api.stylistAsk(prompt, currentItemIds)` matches the real 2-arg signature.

**Deviation flagged:** §7.2 mentions wrapping Toast's render in motion. The plan leaves `Toast.tsx` untouched (its existing CSS transition already slides up/down, and spec §9 forbids changing its API). This is a deliberate, low-risk omission; if motion-wrapped toasts are desired later, it is an isolated additive change. All §10 success criteria are met without it.
