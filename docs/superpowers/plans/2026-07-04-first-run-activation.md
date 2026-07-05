# First-Run Activation Implementation Plan

> **STATUS: COMPLETE (2026-07-05).** All tasks implemented and live-verified with a fresh account (checklist 0/4 → 1/4 after avatar, Next badge advances, empty-closet greeting, wardrobe/studio guided empty states, dismiss persists via localStorage and returns when the key is cleared). Not verified: fully-activated existing account (owner credentials unavailable); covered by the same `done → null` render path. Note: studio copy drops "paste a product link" — URL try-on mode was removed in the studio-bugfixes plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A brand-new user sees a clear path to their first "wow" (avatar → 3 garments → first styled outfit → first try-on render) instead of an empty app, raising activation without any backend changes.

**Architecture:** Frontend-only. A `useActivation` hook derives progress from existing APIs (`api.myAvatar()`, wardrobe list, outfits list, try-on history) — no new endpoints, no new tables. An `ActivationChecklist` card renders on the authenticated home page until all four steps are done (then never again, via `localStorage`). Wardrobe and Studio get guided empty states pointing to the next action. The home stylist greeting becomes wardrobe-aware for empty closets.

**Tech Stack:** Next.js 15, React 19, existing `api` client, Tailwind classes already in `globals.css` (`card`, `chip`, `btn-primary`, `text-muted`, `text-coral`).

## Global Constraints

- No backend changes in this plan. All state is derived client-side from existing endpoints.
- The checklist must never block anything — purely additive, dismissible (X button), and permanently hidden once completed or dismissed (`localStorage` key `fitme.activation.hidden = "1"`).
- All four API probes run in parallel and fail soft: any request error counts the step as incomplete; never crash or toast from the hook.
- Steps and their completion rules (exact): **1. Upload your photo** — `api.myAvatar()` resolves; **2. Add 3 clothes** — wardrobe list length ≥ 3; **3. Get styled** — outfits list length ≥ 1; **4. See it on you** — try-on history length ≥ 1.
- Match the visual language of existing cards (rounded `card`, coral accents). No new dependencies.
- Frontend must pass `cd frontend && npx tsc --noEmit`.
- Before editing any page, READ it first — insertion anchors below are descriptive, and the implementer must locate them in the real file.

---

### Task 1: useActivation hook + ActivationChecklist component

**Files:**
- Create: `frontend/src/lib/useActivation.ts`
- Create: `frontend/src/components/ActivationChecklist.tsx`

**Interfaces:**
- Consumes: `api.myAvatar()`, the wardrobe list method, the outfits list method, and the try-on history method from `frontend/src/lib/api.ts`. **First, open `api.ts` and copy the exact method names** (they exist — the wardrobe page, studio page, and stylist flows call them; likely candidates look like `wardrobeItems()` / `listWardrobe()`, `outfits()` / `listOutfits()`, `tryonHistory()`). Use whatever the file actually exports.
- Produces: `useActivation() -> { loading: boolean; steps: ActivationStep[]; done: boolean }` with `ActivationStep = { key: "avatar" | "wardrobe" | "outfit" | "render"; label: string; href: string; complete: boolean }`; `<ActivationChecklist />` self-contained (renders `null` while loading, when done, or when dismissed).

- [x] **Step 1: Write the hook**

`frontend/src/lib/useActivation.ts` (replace the four `api.*` calls with the real method names found in `api.ts`):

```typescript
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type ActivationStep = {
  key: "avatar" | "wardrobe" | "outfit" | "render";
  label: string;
  href: string;
  complete: boolean;
};

async function probe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export function useActivation() {
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState({ avatar: false, wardrobe: false, outfit: false, render: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [avatar, items, outfits, history] = await Promise.all([
        probe(api.myAvatar()),
        probe(api.wardrobeItems()),   // ← confirm real name in api.ts
        probe(api.listOutfits()),     // ← confirm real name in api.ts
        probe(api.tryonHistory()),    // ← confirm real name in api.ts
      ]);
      if (!alive) return;
      setFlags({
        avatar: avatar != null,
        wardrobe: Array.isArray(items) && items.length >= 3,
        outfit: Array.isArray(outfits) && outfits.length >= 1,
        render: Array.isArray(history) && history.length >= 1,
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const steps: ActivationStep[] = [
    { key: "avatar", label: "Upload your photo", href: "/onboard", complete: flags.avatar },
    { key: "wardrobe", label: "Add 3 clothes to your closet", href: "/wardrobe", complete: flags.wardrobe },
    { key: "outfit", label: "Ask your stylist for a look", href: "/", complete: flags.outfit },
    { key: "render", label: "See an outfit on you", href: "/studio", complete: flags.render },
  ];

  return { loading, steps, done: steps.every((s) => s.complete) };
}
```

- [x] **Step 2: Write the component**

`frontend/src/components/ActivationChecklist.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useActivation } from "@/lib/useActivation";

const HIDE_KEY = "fitme.activation.hidden";

export default function ActivationChecklist() {
  const { loading, steps, done } = useActivation();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(window.localStorage.getItem(HIDE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!loading && done) window.localStorage.setItem(HIDE_KEY, "1");
  }, [loading, done]);

  if (loading || done || hidden) return null;

  const completed = steps.filter((s) => s.complete).length;
  const next = steps.find((s) => !s.complete);

  return (
    <div className="card p-5 space-y-3" data-activation-checklist>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-ink">Get set up ({completed}/{steps.length})</h2>
          <p className="text-xs text-muted mt-0.5">Four quick steps to your first try-on.</p>
        </div>
        <button
          type="button"
          aria-label="Dismiss setup checklist"
          onClick={() => {
            window.localStorage.setItem(HIDE_KEY, "1");
            setHidden(true);
          }}
          className="text-muted hover:text-ink transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
        <div
          className="h-full rounded-full bg-coral transition-all"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={
                "flex items-center gap-2.5 text-sm rounded-lg px-2 py-1.5 transition-colors " +
                (s.complete ? "text-muted line-through" : "text-ink hover:bg-surface2")
              }
            >
              <span
                className={
                  "w-4 h-4 rounded-full grid place-items-center text-[10px] font-bold shrink-0 " +
                  (s.complete ? "bg-coral text-white" : "border border-line text-transparent")
                }
              >
                ✓
              </span>
              {s.label}
              {s === next && (
                <span className="ml-auto text-[10px] font-bold text-coral uppercase tracking-wide">Next</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [x] **Step 3: Typecheck**

Run: `cd C:/Users/Envy/Desktop/VTO/frontend && npx tsc --noEmit`
Expected: clean (fix any api method name mismatches now).

- [x] **Step 4: Commit**

```bash
git add frontend/src/lib/useActivation.ts frontend/src/components/ActivationChecklist.tsx
git commit -m "feat(activation): first-run checklist hook + card"
```

---

### Task 2: Mount on home; wardrobe-aware greeting

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: `<ActivationChecklist />` (Task 1); the home page's existing authenticated layout and its `StylistChat` usage (`greeting` prop already exists on `StylistChat`).

- [x] **Step 1: Read the home page and mount the checklist**

Read `frontend/src/app/page.tsx`. It renders a landing view for signed-out users and the chat/silhouette experience for signed-in users. In the **signed-in** branch, add:

```tsx
import ActivationChecklist from "@/components/ActivationChecklist";
```

and render `<ActivationChecklist />` at the top of the signed-in content column (above or beside the chat, wherever the layout has a natural slot — keep it out of the chat's scroll area).

- [x] **Step 2: Wardrobe-aware greeting**

Still in `page.tsx`: where `StylistChat` is rendered, if the page already knows the wardrobe count, pass a tailored greeting; if it doesn't, fetch it once alongside existing data (reuse the same wardrobe list method from Task 1):

```tsx
greeting={
  wardrobeCount === 0
    ? "Welcome! I'm your stylist. Add a few clothes to your closet and I can build real looks from them — or tell me what you're shopping for."
    : undefined
}
```

(`undefined` keeps the existing default greeting.)

- [x] **Step 3: Typecheck + commit**

Run: `cd C:/Users/Envy/Desktop/VTO/frontend && npx tsc --noEmit`
Expected: clean.

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(home): activation checklist + empty-closet greeting"
```

---

### Task 3: Guided empty states — wardrobe and studio

**Files:**
- Modify: `frontend/src/app/wardrobe/page.tsx`
- Modify: `frontend/src/app/studio/page.tsx`

**Interfaces:**
- Consumes: nothing new — each page already knows when its list is empty.

- [x] **Step 1: Wardrobe empty state**

Read `frontend/src/app/wardrobe/page.tsx`, find where the empty item list renders (blank rack or bare "no items" text). Replace/augment with a centered guide (reuse existing classes; keep any existing upload button as the CTA target):

```tsx
<div className="text-center py-10 space-y-3 max-w-sm mx-auto">
  <p className="font-bold text-ink">Your closet is empty</p>
  <p className="text-sm text-muted">
    Snap or upload photos of your clothes — I&apos;ll tag the color, style, and
    season automatically. Three items is enough for your first styled look.
  </p>
</div>
```

Keep the page's existing add/upload control visible directly below it. If the page already has an empty-state block, improve its copy to the above instead of adding a second block.

- [x] **Step 2: Studio empty state**

Read `frontend/src/app/studio/page.tsx`, find the render-history / result area's empty case, and add equivalent guidance:

```tsx
<div className="text-center py-10 space-y-3 max-w-sm mx-auto">
  <p className="font-bold text-ink">Nothing tried on yet</p>
  <p className="text-sm text-muted">
    Pick a garment from your closet, upload one, or paste a product link —
    you&apos;ll see it rendered on your photo in about a minute.
  </p>
</div>
```

Same rule: if an empty state exists, upgrade its copy; don't duplicate.

- [x] **Step 3: Typecheck + commit**

Run: `cd C:/Users/Envy/Desktop/VTO/frontend && npx tsc --noEmit`
Expected: clean.

```bash
git add frontend/src/app/wardrobe/page.tsx frontend/src/app/studio/page.tsx
git commit -m "feat(activation): guided empty states for wardrobe and studio"
```

---

### Task 4: Live UI verification

**Files:** none.

- [x] **Step 1: Fresh-account walkthrough**

With the stack running, register a brand-new account, then:
1. Home shows the checklist at 0/4 (avatar step incomplete because onboarding was skipped) or 1/4 after onboarding — "Next" badge on the first incomplete step.
2. Chat greeting is the empty-closet variant.
3. `/wardrobe` shows the guided empty state; `/studio` shows its guided empty state.
4. Dismiss the checklist with × → reload → it stays hidden. Clear `localStorage` key `fitme.activation.hidden` → it returns.
5. Existing account (the owner's real one): checklist does not appear if all steps are done.

- [x] **Step 2: Commit fixes if any**

```bash
git add -A frontend/src
git commit -m "fix(activation): follow-ups from live verification"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Coverage:** Leyla sees a path to value immediately (checklist + next badge), empty screens teach instead of confusing, stylist greets empty-closet users with direction. Zero backend risk.
- **Deliberate cuts:** demo/sample wardrobe content (real photos beat placeholders; revisit if activation metrics stall), server-side activation tracking/analytics (no analytics stack exists yet), mobile app parity (web first).
- **Honesty about anchors:** three page files are modified by description, not line number — each step starts with "read the file"; completion rules and copy are exact so only placement is left to the implementer.
