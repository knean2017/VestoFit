# Home Page Redesign — Design Spec

**Date:** 2026-06-23
**App:** FitMe — AI-powered personal stylist PWA
**Stack:** Next.js 14 (App Router), Tailwind 3, FastAPI backend, Framer Motion (new dependency)
**Scope:** Authenticated home page (`StylistHome` in `app/page.tsx`) + app-wide animation system. Backend untouched.

---

## 1. Goal

Redesign the logged-in home page around a centered body silhouette as the visual centerpiece (~60% of viewport). The AI stylist becomes proactive and conversational: typing a message or tapping a quick-reply chip animates a new outfit onto the silhouette while the AI's reasoning appears in a floating card. Add a Framer Motion animation system available to the whole app, applied fully only to the home page and landing scroll reveals in this iteration.

This redesign touches the authenticated home view, `layout.tsx`, `SilhouettePreview.tsx`, and adds five new components. It does **not** restyle the landing page (beyond swapping CSS scroll animations for Framer Motion), wardrobe, shop, studio, or settings, and makes **zero backend changes**.

---

## 2. Existing Code Facts (verified)

These constrain the implementation:

- **`SilhouettePreview.tsx`** renders an SVG body outline plus clothing image layers positioned absolutely by category (`tops`, `bottoms`, `dresses`, synthetic `outer`). It accepts `items: SilhouetteItem[]` where `SilhouetteItem = Pick<WardrobeItem, "id" | "category" | "clean_image_url" | "image_url">`. It already renders a bare outline + "Pick items to preview your outfit" placeholder when `items` is empty. Container is `aspect-[3/5] w-full max-w-[280px]`, centered via `mx-auto`. Clothing images currently are plain `<div><img/></div>` — these are the elements to wrap in `motion.div` + `AnimatePresence`.
- **`app/page.tsx`** — `HomePage` decides auth via `getToken()`, returns `<LandingPage/>` (unauthenticated) or `<StylistHome/>` (authenticated). `StylistHome` is the full rewrite target. `LandingPage` stays except for scroll-reveal animation swap.
- **`pickRandom(items)`** — current logic: filters tops/bottoms/dresses; with 50% chance picks a random dress, else a random top+bottom pair, else a single item. Sets `suggestion` (array) and `reasoning` (string). Reuse this logic for Shuffle.
- **API (`lib/api.ts`):**
  - `api.listWardrobe()` → `WardrobeItem[]`
  - `api.stylistAsk(prompt: string, item_ids?: string[])` → `{ reply: string }` (note: accepts an optional `item_ids` array — pass the current silhouette item IDs so the AI has outfit context)
  - `api.stylistMessages()` → `StylistMessage[]`
  - `WardrobeItem`: `id, category, image_url, clean_image_url, name, color, pattern, formality, …`
  - `Category = "tops" | "bottoms" | "dresses"`
  - `StylistMessage`: `{ id, role, content, outfit_id, created_at }`
- **Critical constraint — no visual outfit from AI replies.** `api.stylistAsk` returns only a text `reply`. It does **not** return structured item IDs to render on the silhouette. Therefore, when the user sends a message, the *text* comes from the API but the *visual outfit change* must be produced client-side. The implementation derives a new silhouette outfit locally (via `pickRandom` over the wardrobe, optionally biased by keywords in the message — see §5.3) and renders that alongside the AI's text reply. This keeps the "respond in two ways simultaneously" experience without backend changes. Document this clearly so the plan does not assume the API drives the silhouette.
- **`BottomNav.tsx`** — fixed bottom bar, `h-16`, `md:hidden`, respects `env(safe-area-inset-bottom)`. Home page uses `pb-nav` to clear it on mobile. The chat input bar must sit **above** BottomNav and also respect the safe-area inset.
- **Tailwind tokens** (already defined): colors `bg #FBF7F0`, `surface #FFFFFF`, `surface2 #F5EFE6`, `ink #2A2522`, `muted #8C8279`, `coral #FF6B5E`, `coralSoft #FFF0EE`, `teal #3DB6A8`, `tealSoft`, `line`; radii `xl2/xl3/xl4`; shadows `soft/glow/glow2/lifted/ring`; font `Nunito`. Reuse these — do not hardcode hex outside what the design already uses.

---

## 3. Layout & Structure (mobile-first)

Top-to-bottom on the authenticated home, for a user **with** wardrobe items:

1. **Header** — existing `<Header/>`, unchanged.
2. **Silhouette Zone** — `SilhouettePreview` centered, occupying roughly 60% of viewport height. The zone is a positioned container (`relative`) so the floating card and skeleton can overlay it.
3. **Action Buttons Row** — horizontal row directly below the silhouette: **Shuffle** (icon button, spins on tap) on the left, **Try On** (gradient CTA) on the right. Centered, comfortable tap targets (min 44px).
4. **AI Floating Card** — `FloatingCard`, absolutely positioned to overlap the bottom edge of the silhouette zone. Shows the AI's latest reasoning text. Auto-dismisses after 6s or on next interaction (shuffle, new message, chip tap). When the proactive flow is active, **QuickReplyChips** render directly beneath this card.
5. **Chat Input Bar** — pinned above BottomNav, always visible. Single-line input + send button. Respects safe-area inset.
6. **Chat History** — hidden by default. Opened via a "View history" affordance that triggers the `ChatSheet` pull-up bottom sheet.
7. **BottomNav** — existing `<BottomNav/>`, unchanged.

### Layout sizing notes
- Use a flex column on `<main>` sized to `min-h-screen`. The silhouette zone grows to ~60vh; the action row, floating-card overlap, and input bar take the remainder.
- Reserve bottom padding for the input bar + BottomNav so nothing is occluded (`pb-nav` plus input-bar height on mobile).
- On `md+` (desktop), BottomNav is hidden and Header nav is used; the input bar still pins to the bottom of the viewport. Keep content centered with a constrained max width (e.g. `max-w-2xl mx-auto`) consistent with the current page.

---

## 4. States

The home page has three mutually exclusive states determined by wardrobe + conversation:

### 4.1 Empty state (no usable wardrobe)
Trigger: `wardrobe.length < 2` (matches existing `hasWardrobe` threshold — silhouette outfits need top+bottom or a dress, so 2 is the practical minimum; keep the same threshold the current page uses).
- Silhouette renders **bare** (SVG outline only, no clothing — `SilhouettePreview` with `items={[]}`).
- A single centered button below it: **"Add your first clothes"**, with a subtle pulse animation (reuse `animate-pulse2` or a Framer Motion equivalent). Tapping navigates to `/wardrobe`.
- **No** floating card, **no** chips, **no** chat input bar. Just the bare figure and the button.

### 4.2 Proactive state (wardrobe present, no conversation yet)
Trigger: `wardrobe.length >= 2` and `messages.length === 0`.
- A starting outfit is shown on the silhouette via `pickRandom` on load.
- The floating card opens with a conversational prompt (e.g. "Going anywhere special today?" or "What's the vibe — chill, work, or something else?").
- `QuickReplyChips` render below the card: tappable pills like **Work**, **Date night**, **Casual day**, **Going out**.
- See §6 for the multi-turn proactive flow.

### 4.3 Active conversation state
Trigger: `wardrobe.length >= 2` and `messages.length > 0`.
- Silhouette shows the most recent client-derived outfit.
- Floating card shows the latest AI reply (auto-dismissing).
- Chips hidden once a freeform conversation is underway (they may still appear as the AI's narrowing follow-up in the proactive flow — see §6).
- Full history available via `ChatSheet`.

---

## 5. Interactions

### 5.1 Shuffle
- Tap → button plays a 360° spin (Framer Motion `animate={{ rotate: 360 }}`, spring).
- Current silhouette pieces scale down + fade out; new pieces (from `pickRandom`) animate in staggered (§7).
- Reasoning card updates to the new `reasoning` string and resets its 6s auto-dismiss timer.
- Pure client-side, **no API call**, instant. Disabled when `wardrobe.length < 2`.

### 5.2 Try On
- Reads the current silhouette outfit's item IDs.
- Navigates to `/studio` with those item IDs pre-selected. Use a query param or session mechanism consistent with how `/studio` already accepts pre-selected items — **verify the studio page's expected input during implementation**; if studio has no existing mechanism, pass IDs via query string (e.g. `/studio?items=id1,id2`) and note the studio side may need a follow-up (out of scope here, flag it).
- Page transition: smooth zoom-in on the silhouette feeding into the route change.

### 5.3 Sending a message (context-aware chat)
When the user submits the input:
- **Text:** call `api.stylistAsk(message, currentItemIds)`; on success, the returned `reply` populates the floating card.
- **Visual:** simultaneously derive a new silhouette outfit client-side and animate it in. Default derivation: `pickRandom(wardrobe)`. Optional enhancement (keep simple): bias the pick using keywords in the message/chip (e.g. "date" → prefer a dress or a dressier top if `formality` data exists). Keyword biasing is a nice-to-have; the baseline is `pickRandom`. Do not block on the API for the visual — derive and animate the outfit immediately, then settle the text when the reply lands.
- Append both user + assistant messages to local `messages` state (same shape the current code constructs).
- Errors surface via the existing `useToast()` (`toast("error", …)`).

### 5.4 Floating card dismissal
- Auto-dismiss after **6 seconds**.
- Dismiss immediately on next interaction: shuffle, chip tap, or new message send.
- Use Framer Motion `AnimatePresence` for enter/exit (fade + slight slide).

---

## 6. Proactive AI Stylist Flow

When the user lands with wardrobe items and `messages.length === 0`:

1. AI opens via floating card with a conversational opener.
2. `QuickReplyChips` appear: **Work**, **Date night**, **Casual day**, **Going out** (the canonical set; final copy may be tuned).
3. User may: tap a chip, type freeform, or hit shuffle to skip the flow entirely.
4. On engagement (e.g. tap **Date night**):
   - AI follows up with a narrowing question ("Dressy or laid-back?"), shown in the floating card, with a new set of narrowing chips.
   - Silhouette updates to match the direction (client-derived, biased by the chosen tag).
5. After **2–3 exchanges**, the AI lands on a final outfit recommendation with fuller reasoning text. A silhouette outfit is shown and progressively refined at **each** step.

### Implementation notes for the flow
- The flow is a small client-side state machine: track `flowStage` (e.g. `opener → narrowing → final`) and the accumulated tags.
- Each user choice can call `api.stylistAsk` with a composed prompt (e.g. "Suggest an outfit for date night, dressy") so the text reasoning is real AI output, while the silhouette outfit is derived locally. Alternatively, the narrowing copy can be local strings to avoid latency, with only the final step calling the API — **prefer calling the API at the final step at minimum** so the recommendation reasoning is genuine; intermediate narrowing prompts may be local for snappiness. Decide in the plan; either is acceptable, lean toward fewer API calls for the narrowing questions.
- Chips are data-driven: a small config mapping each stage to its chip set.

---

## 7. Animation System (Framer Motion) — App-Wide

**New dependency:** add `framer-motion` to the frontend `package.json`.

### 7.1 Page transitions
- `AnimatePresence` wrapper in `layout.tsx` (via the new `PageTransition` component wrapping `children`).
- Enter: `y: 12 → 0`, `opacity: 0 → 1`, ~300ms spring.
- Exit: fade out ~150ms.
- Note: App Router + `AnimatePresence` route transitions require keying on the pathname (`usePathname`). Implement `PageTransition` as a client component that reads the pathname and keys the `motion.div`. Verify exit animations behave under App Router during implementation (App Router does not natively unmount the old route the way Pages Router did; a `key`-on-pathname `motion.div` inside a client wrapper is the standard approach). If full exit animations prove unreliable, ship enter-only transitions and note the limitation rather than blocking.

### 7.2 Micro-interactions (all pages, opt-in via shared components)
- Buttons: `whileTap={{ scale: 0.96 }}` — press spring.
- Cards (`MotionCard`): `whileHover={{ y: -2 }}` with shadow deepening (`shadow-soft → shadow-lifted`).
- Shuffle button: `animate={{ rotate: 360 }}` on tap, spring.
- Toast: slide up from bottom with spring, slide down on dismiss. (Integrate with existing `Toast.tsx` — wrap its render in motion; keep the existing API.)

### 7.3 Scroll-triggered reveals (landing page)
- Landing step cards and feature grid switch from CSS `animate-rise` to Framer Motion `whileInView` with stagger and spring variants.
- This is the **only** change to `LandingPage`.

### 7.4 Silhouette outfit transitions
Inside `SilhouettePreview`, wrap each clothing layer in `motion.div` under `AnimatePresence` keyed by item id:
- **Exit:** `animate={{ opacity: 0, scale: 0.85 }}`, ~200ms.
- **Enter (staggered):** tops from `y: -20` (drops from above), bottoms from `y: +20` (rises from below), **150ms** stagger between pieces.
- Spring config: `{ type: "spring", stiffness: 300, damping: 25 }`.
- Preserve existing absolute layer positioning and z-index; the motion wrapper sits inside each positioned layer container so transforms don't fight the absolute layout.

### 7.5 Loading
- Skeleton shimmer over the silhouette zone while `listWardrobe`/`stylistMessages` load.
- Use `AnimatePresence` to cross-fade skeleton out and content in. Reuse the `animate-shimmer` token or a Framer equivalent.

### 7.6 Accessibility
- Respect `prefers-reduced-motion`: gate non-essential motion (page slides, hover lifts, shuffle spin, scroll reveals) so reduced-motion users get instant/opacity-only transitions. Framer Motion's `useReducedMotion` hook is the mechanism.

---

## 8. Component Architecture

### New files
| File | Responsibility |
|---|---|
| `components/PageTransition.tsx` | Client wrapper using `AnimatePresence` + pathname key for route enter/exit transitions. Wraps `children` in `layout.tsx`. |
| `components/MotionCard.tsx` | Reusable card: hover lift (`y: -2`, shadow deepen) + tap press. Drop-in replacement for `.card` where motion is wanted. Must not be forced onto other pages. |
| `components/FloatingCard.tsx` | AI response card overlaying the silhouette zone's bottom edge. Auto-dismiss after 6s + on external interaction. Controlled (visibility + content via props) with `AnimatePresence` enter/exit. |
| `components/ChatSheet.tsx` | Pull-up bottom sheet for full chat history. Renders `messages` in the existing bubble style. Opens/closes with spring slide; backdrop scrim; dismiss on backdrop tap / drag-down / close button. |
| `components/QuickReplyChips.tsx` | Horizontal row of tappable pill buttons. Props: `chips: {label, value}[]`, `onSelect(value)`. Styled with `chip-coral`/pill tokens. |

### Modified files
| File | Change |
|---|---|
| `components/SilhouettePreview.tsx` | Wrap clothing image layers in `motion.div` + `AnimatePresence` (per §7.4). Keep public props (`items`, `className`) and existing positioning unchanged. |
| `app/page.tsx` (`StylistHome`) | Full rewrite of the authenticated home layout per §3–§6. `LandingPage` only gets the §7.3 scroll-reveal swap. `HomePage` auth switch unchanged. |
| `app/layout.tsx` | Wrap `children` in `<PageTransition>` (inside `ToastProvider`). |

### State held in `StylistHome` (rewrite)
Reuse/extend current state: `wardrobe`, `suggestion` (current silhouette outfit), `reasoning`, `messages`, `input`, `sending`, `shuffling`, plus new: `cardVisible` (floating card), `flowStage` + accumulated tags (proactive flow), `sheetOpen` (ChatSheet), `loading` (skeleton). `pickRandom` logic is retained.

---

## 9. Scope Boundaries

**Changed:** authenticated home (`StylistHome`), `layout.tsx` (PageTransition), `SilhouettePreview.tsx` (motion layers), landing scroll reveals only, plus the five new components and the `framer-motion` install.

**Not touched:**
- Landing page visual design (only CSS→Framer scroll reveals).
- Wardrobe, Shop, Studio, Settings pages (separate/future).
- Backend APIs — zero changes.
- `Header.tsx`, `BottomNav.tsx`, `Toast.tsx` API surface (Toast render may be motion-wrapped internally but its public API is unchanged).

Shared additive changes (`PageTransition`, `MotionCard`) are **available** to all pages but not forced onto them in this iteration.

---

## 10. Success Criteria

- Silhouette is the visual centerpiece of the logged-in home, ~60% of viewport.
- Outfit changes animate smoothly on the silhouette — staggered enter/exit, no jumps or flashes.
- Empty state shows a bare figure + pulsing "Add your first clothes" button → `/wardrobe`, nothing else.
- Proactive flow engages with an opener + quick-reply chips when no conversation exists; narrows over 2–3 exchanges to a final recommendation, refining the silhouette at each step.
- Floating card shows AI reasoning, auto-dismisses at 6s or on next interaction.
- Chat history reachable via pull-up sheet but hidden by default.
- Chat input bar pinned above BottomNav, always visible, safe-area aware.
- Try On hands current outfit IDs to `/studio`.
- Page transitions feel smooth across routes; `prefers-reduced-motion` respected.
- `npm run build` passes with zero errors; no regressions on landing, wardrobe, shop, studio, settings.

---

## 11. Open Questions / Flags for the Plan

1. **Studio pre-selection contract** — confirm how `/studio` accepts pre-selected item IDs (§5.2). If no mechanism exists, query-string is the fallback and studio-side wiring is a separate follow-up.
2. **AI-driven vs client-derived silhouette** — the spec resolves this: silhouette outfits are **client-derived** (`pickRandom` ± keyword bias) because `stylistAsk` returns text only. The plan must not assume the API returns item IDs.
3. **App Router exit animations** — enter transitions are guaranteed; full exit transitions are best-effort (§7.1). Ship enter-only if exit proves unreliable.
4. **Proactive flow API cadence** — final recommendation should call `stylistAsk`; intermediate narrowing copy may be local to reduce latency (§6). Plan picks the exact split.
