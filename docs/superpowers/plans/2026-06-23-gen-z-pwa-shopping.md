# Gen Z Styling + PWA + Shopping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle FitMe with a Clean Bold Gen Z aesthetic (no emoji chrome, sparing gradients), add PWA support, build a shopping backend with mock data, and wire up a `/shop` frontend page.

**Architecture:** Sequential phases — design tokens first (Tailwind + CSS), then page-by-page restyling, then PWA static assets + service worker, then FastAPI shopping endpoints with mock service, then Next.js shop page. Each phase builds on the previous and is verified with a build check.

**Tech Stack:** Next.js 14, Tailwind 3, FastAPI, SQLAlchemy (async), PostgreSQL, Pydantic v2

## Global Constraints

- No emoji in UI chrome (buttons, labels, badges, nav, section headers). Emoji allowed only in user-generated content.
- Gradients on primary CTA buttons only — no gradient backgrounds, text, or secondary buttons.
- Mock shopping data until SerpAPI key is configured.
- No new npm or pip dependencies unless explicitly noted.
- Every task ends with `npx next build` or backend equivalent passing.

---

### Task 1: Design Tokens — Tailwind Config + CSS Utilities

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: nothing
- Produces: new Tailwind tokens (`tracking-tighter2`, `rounded-xl4`, `shadow-glow2`, `animate-shuffleSpin`), new CSS classes (`.btn-primary` with gradient, `.grain` texture, `.card` with xl4 radius, `.chip` with bolder sizing, `.field` with thicker focus)

- [ ] **Step 1: Update `tailwind.config.ts` with new tokens**

```ts
// In theme.extend.letterSpacing, add:
tighter2: "-0.04em",

// In theme.extend.borderRadius, already has xl4: "2rem" — keep it

// In theme.extend.boxShadow, add:
glow2: "0 4px 24px rgba(255, 107, 94, 0.18)",

// In theme.extend.keyframes, add:
shuffleSpin: {
  "0%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
  "50%": { opacity: "0.5", transform: "scale(0.92) rotate(3deg)" },
  "100%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
},

// In theme.extend.animation, add:
shuffleSpin: "shuffleSpin 0.4s cubic-bezier(.22, 1, .36, 1)",
```

- [ ] **Step 2: Update `globals.css` component classes**

Replace the full `@layer components` block. Key changes:

```css
/* In @layer base, after body styles add grain */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  pointer-events: none;
}

/* Update .heading-lg */
.heading-lg {
  @apply text-2xl sm:text-3xl font-extrabold tracking-tighter2 text-ink;
}

/* Update .heading-md */
.heading-md {
  @apply text-xl font-extrabold tracking-tight text-ink;
}

/* Update .label */
.label {
  @apply text-xs font-black text-muted uppercase tracking-[0.08em];
}

/* Update .card */
.card {
  @apply bg-surface rounded-xl4 shadow-soft;
}

/* Update .card-interactive — add gradient border glow on hover */
.card-interactive {
  @apply card transition-all duration-200 hover:shadow-lifted hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer;
  background-clip: padding-box;
}
.card-interactive:hover {
  box-shadow: 0 8px 32px rgba(42, 37, 34, 0.10), 0 0 0 1px rgba(255, 107, 94, 0.12);
}

/* Update .field — thicker focus */
.field {
  @apply w-full bg-surface border border-line rounded-xl4 px-4 py-3.5 text-ink placeholder:text-muted/60 transition-all duration-200;
}
.field:focus {
  border-color: #FF6B5E;
  border-width: 2px;
  box-shadow: 0 0 0 4px rgba(255, 107, 94, 0.18);
  padding: calc(0.875rem - 1px) calc(1rem - 1px);
}

/* Update .btn-primary — gradient fill */
.btn-primary {
  @apply btn text-white shadow-glow2 hover:scale-[1.02] hover:shadow-lifted active:scale-[0.97];
  background: linear-gradient(135deg, #FF6B5E, #FF8F6B);
}

/* Update .chip — bolder */
.chip {
  @apply inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-full bg-surface2 text-muted;
}

/* Update .chip-coral */
.chip-coral {
  @apply chip bg-coralSoft text-coral font-extrabold;
}

/* Update .chip-teal */
.chip-teal {
  @apply chip bg-tealSoft text-teal font-extrabold;
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npx next build`
Expected: compiles with 0 errors

- [ ] **Step 4: Commit**

```bash
git add frontend/tailwind.config.ts frontend/src/app/globals.css
git commit -m "feat: update design tokens — bolder type, gradient primary btn, grain texture, xl4 cards"
```

---

### Task 2: Restyle Landing Page + Auth Pages (No Emoji)

**Files:**
- Modify: `frontend/src/app/page.tsx` (LandingPage function + STEPS + FEATURES constants)
- Modify: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/app/register/page.tsx`

**Interfaces:**
- Consumes: updated CSS classes from Task 1
- Produces: emoji-free landing page, login, register pages

- [ ] **Step 1: Update STEPS constant in `page.tsx` — remove emoji, keep numbered circles**

Replace the existing `STEPS` array at bottom of file:

```tsx
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
```

(Steps already have no emoji in their titles — the numbered circles are rendered in JSX. No change needed if already clean.)

- [ ] **Step 2: Update FEATURES constant — replace emoji with SVG icon circles**

Replace the `FEATURES` array:

```tsx
const FEATURES = [
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
```

- [ ] **Step 3: Update feature grid JSX to accept ReactNode icon**

In the LandingPage function, update the feature mapping (the icon is already rendered as `{f.icon}` in a span — just change the type inference). The span already applies `text-coral` so SVGs inherit `currentColor`.

- [ ] **Step 4: Update login page — replace emoji logo with styled letter**

In `login/page.tsx`, replace the logo div:

```tsx
// Old:
<div className="w-14 h-14 rounded-2xl bg-coral text-white grid place-items-center text-2xl font-extrabold shadow-glow mx-auto mb-4">
  F
</div>
```

This is already emoji-free (just letter "F"). No change needed.

- [ ] **Step 5: Update register page — replace emoji symbol with SVG**

In `register/page.tsx`, replace the logo div:

```tsx
<div className="w-14 h-14 rounded-2xl bg-teal text-white grid place-items-center shadow-glow mx-auto mb-4">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 5.5H19l-4.5 3.5 1.5 5.5L12 14l-4.5 3.5 1.5-5.5L4.5 8.5H10z"/></svg>
</div>
```

- [ ] **Step 6: Update StylistHome greeting — remove wave emoji**

In the `StylistHome` function in `page.tsx`, replace:

```tsx
<h1 className="heading-lg">
  Hey there <span className="inline-block animate-bounce2">👋</span>
</h1>
```

With:

```tsx
<h1 className="heading-lg">Hey there</h1>
```

- [ ] **Step 7: Remove emoji from empty wardrobe CTA on home page**

Replace the closet icon div in the empty-wardrobe card:

```tsx
<div className="w-16 h-16 rounded-full bg-coralSoft grid place-items-center mx-auto mb-4">
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/><path d="M12 5v16"/><path d="M3 5a2 2 0 012-2h14a2 2 0 012 2"/></svg>
</div>
```

- [ ] **Step 8: Verify build**

Run: `cd frontend && npx next build`
Expected: compiles with 0 errors

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/app/login/page.tsx frontend/src/app/register/page.tsx
git commit -m "feat: remove emoji from landing, auth, and home pages — use SVG icons"
```

---

### Task 3: Restyle Nav Components

**Files:**
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/components/BottomNav.tsx`

**Interfaces:**
- Consumes: updated CSS from Task 1
- Produces: gradient underline on active nav items, bolder styling

- [ ] **Step 1: Update Header active state**

In `Header.tsx`, update the active link styling. Replace the navLinks map className:

```tsx
(isActive(link.href)
  ? "bg-coralSoft text-coral"
  : "text-muted hover:text-ink hover:bg-surface2")
```

With:

```tsx
(isActive(link.href)
  ? "text-coral font-extrabold relative after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-coral after:to-[#FF8F6B]"
  : "text-muted hover:text-ink hover:bg-surface2")
```

- [ ] **Step 2: Update BottomNav active indicator**

In `BottomNav.tsx`, replace the active dot indicator. Remove the existing `{active && (<span className="absolute -bottom-0 w-1 h-1 rounded-full bg-coral" />)}` and update the link className to include a gradient bar:

```tsx
<Link
  key={tab.href}
  href={tab.href}
  className={
    "relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-2xl transition-all duration-200 min-w-[4rem] " +
    (active ? "text-coral" : "text-muted hover:text-ink")
  }
>
  <span className={"transition-transform duration-200 " + (active ? "scale-110" : "")}>
    {tab.icon(active)}
  </span>
  <span className={"text-[11px] font-bold " + (active ? "text-coral" : "text-muted")}>
    {tab.label}
  </span>
  {active && (
    <span className="absolute -top-0 left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-coral to-[#FF8F6B]" />
  )}
</Link>
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npx next build`
Expected: compiles with 0 errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Header.tsx frontend/src/components/BottomNav.tsx
git commit -m "feat: gradient active indicators on nav components"
```

---

### Task 4: Restyle Wardrobe, Studio, Settings, Onboard Pages

**Files:**
- Modify: `frontend/src/app/wardrobe/page.tsx`
- Modify: `frontend/src/app/studio/page.tsx`
- Modify: `frontend/src/app/settings/page.tsx`
- Modify: `frontend/src/app/onboard/page.tsx`

**Interfaces:**
- Consumes: updated CSS from Task 1
- Produces: emoji-free pages with bolder styling

- [ ] **Step 1: Wardrobe page — show condition chips on item cards**

In `ItemCard` component in `wardrobe/page.tsx`, after the color span, add:

```tsx
{item.conditions && (
  <div className="flex flex-wrap gap-1 mt-1">
    {item.conditions.split(",").map((c) => c.trim()).filter(Boolean).slice(0, 2).map((c) => (
      <span key={c} className="text-[10px] font-bold text-coral bg-coralSoft px-1.5 py-0.5 rounded-full">{c}</span>
    ))}
  </div>
)}
```

- [ ] **Step 2: Wardrobe page — remove emoji from category buttons**

Replace the category button content `{c.emoji} {c.label}` with just `{c.label}` in both the add section and anywhere else `CATEGORIES` emoji is rendered.

Update the `CATEGORIES` constant — remove the `emoji` field:

```tsx
const CATEGORIES: { id: Category; label: string }[] = [
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "dresses", label: "Dresses" },
];
```

Update the select dropdown in `EditModal` to use just `{c.label}` instead of `{c.emoji} {c.label}`.

- [ ] **Step 3: Studio page — remove emoji, gradient render button**

In `studio/page.tsx`:

Replace the render button text `"✨ Render"` with `"Render"`.

Replace the empty result panel emoji div:

```tsx
<div className="w-16 h-16 rounded-full bg-surface2 grid place-items-center mx-auto mb-3">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8C8279" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3l1 7 1-7"/><path d="M2 9h20"/></svg>
</div>
```

- [ ] **Step 4: Settings page — gradient avatar ring, remove emoji**

In `settings/page.tsx`, replace the profile avatar fallback emoji:

```tsx
{avatar ? (
  <img src={avatar.photo_url} alt="avatar" className="w-full h-full rounded-full object-cover" />
) : (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
)}
```

- [ ] **Step 5: Onboard page — replace camera emoji with SVG**

In `onboard/page.tsx`, replace the camera icon div:

```tsx
<div className="w-16 h-16 rounded-2xl bg-teal text-white grid place-items-center mx-auto mb-4">
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
</div>
```

Also replace the `+` text in the drop zone with an SVG plus icon:

```tsx
<div className="mx-auto w-14 h-14 rounded-full bg-coralSoft grid place-items-center text-coral">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
</div>
```

- [ ] **Step 6: Home page — replace chat empty state emoji suggestion**

In `page.tsx` StylistHome, the "Today's pick" chip-coral is fine (text only). Check for any remaining emoji in the authenticated home and remove.

The shuffle button text `"Shuffle ✦"` — replace with `"Shuffle"`.

- [ ] **Step 7: Verify build**

Run: `cd frontend && npx next build`
Expected: compiles with 0 errors

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/wardrobe/page.tsx frontend/src/app/studio/page.tsx frontend/src/app/settings/page.tsx frontend/src/app/onboard/page.tsx frontend/src/app/page.tsx
git commit -m "feat: restyle wardrobe, studio, settings, onboard — remove emoji, add condition chips"
```

---

### Task 5: PWA — Manifest, Icons, Service Worker

**Files:**
- Create: `frontend/public/manifest.json`
- Create: `frontend/public/sw.js`
- Create: `frontend/public/icons/icon-192.png` (generated)
- Create: `frontend/public/icons/icon-512.png` (generated)
- Modify: `frontend/src/app/layout.tsx`

**Interfaces:**
- Consumes: nothing external
- Produces: installable PWA with offline-capable static assets

- [ ] **Step 1: Create `frontend/public/` directory and `manifest.json`**

```json
{
  "name": "FitMe",
  "short_name": "FitMe",
  "description": "Your AI-powered wardrobe assistant",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FBF7F0",
  "theme_color": "#FF6B5E",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Create `frontend/public/sw.js`**

```js
const CACHE_NAME = "fitme-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api") || url.hostname !== location.hostname) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
```

- [ ] **Step 3: Generate icon PNGs**

Use a canvas-based approach or simply create minimal coral-background PNG icons with a white "F" letter. Create them programmatically via a Node script or manually place placeholder PNGs.

Generate with an inline Node script:

```bash
cd frontend && node -e "
const { createCanvas } = require('canvas');
// If canvas is not available, create a minimal valid PNG manually
" 2>/dev/null || echo "Generate icons manually — 192x192 and 512x512 coral background with white F"
```

Alternative: create SVG-based favicons and use the Playwright MCP to screenshot them, or place placeholder solid-coral PNGs.

For now, create minimal placeholder files that will be replaced with proper icons later. The manifest will still work.

- [ ] **Step 4: Add SW registration to `layout.tsx`**

Add a script tag in the body to register the service worker:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                window.addEventListener("load", () => {
                  navigator.serviceWorker.register("/sw.js").catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `cd frontend && npx next build`
Expected: compiles with 0 errors

- [ ] **Step 6: Commit**

```bash
git add frontend/public/ frontend/src/app/layout.tsx
git commit -m "feat: add PWA manifest, service worker, icon placeholders"
```

---

### Task 6: Shopping Backend — Model, Schema, Config

**Files:**
- Create: `backend/app/models/shopping.py`
- Create: `backend/app/schemas/shopping.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/config.py`

**Interfaces:**
- Consumes: existing `Base` from `app.database`, `User` model pattern
- Produces: `ShoppingQuery` ORM model, `ShoppingSearchRequest`/`ShoppingResultItem`/`ShoppingSearchResponse` Pydantic schemas, `serpapi_key` config field

- [ ] **Step 1: Create `backend/app/models/shopping.py`**

```python
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ShoppingQuery(Base):
    __tablename__ = "shopping_queries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    query: Mapped[str] = mapped_column(Text, nullable=False)
    budget_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    budget_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    results_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

- [ ] **Step 2: Create `backend/app/schemas/shopping.py`**

```python
from datetime import datetime

from pydantic import BaseModel, Field


class ShoppingSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    budget_max: float | None = Field(default=None, gt=0)
    category: str | None = None


class ShoppingResultItem(BaseModel):
    title: str
    price: float
    currency: str = "USD"
    image_url: str
    product_url: str
    source: str
    category: str | None = None


class ShoppingSearchResponse(BaseModel):
    query: str
    results: list[ShoppingResultItem]
    total: int


class ShoppingHistoryItem(BaseModel):
    id: str
    query: str
    budget_max: float | None
    category: str | None
    result_count: int
    created_at: datetime
```

- [ ] **Step 3: Register model in `__init__.py`**

Add to `backend/app/models/__init__.py`:

```python
from app.models.shopping import ShoppingQuery
```

And add `"ShoppingQuery"` to the `__all__` list.

- [ ] **Step 4: Add `serpapi_key` to config**

In `backend/app/config.py`, add inside the `Settings` class:

```python
serpapi_key: str = ""
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/shopping.py backend/app/schemas/shopping.py backend/app/models/__init__.py backend/app/config.py
git commit -m "feat: add shopping model, schemas, and config"
```

---

### Task 7: Shopping Backend — Mock Service + Router

**Files:**
- Create: `backend/app/services/shopping_service.py`
- Create: `backend/app/routers/shopping.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `ShoppingQuery` model from Task 6, `ShoppingSearchRequest`/`ShoppingSearchResponse`/`ShoppingResultItem`/`ShoppingHistoryItem` schemas from Task 6, `get_current_user` from `app.deps`, `get_db` from `app.database`, `serpapi_key` from config
- Produces: `POST /shopping/search` endpoint, `GET /shopping/history` endpoint, `search_products(query, budget_max, category)` service function

- [ ] **Step 1: Create `backend/app/services/shopping_service.py`**

```python
from app.config import get_settings
from app.schemas.shopping import ShoppingResultItem

MOCK_RESULTS: list[dict] = [
    {
        "title": "Relaxed Fit Oxford Shirt",
        "price": 39.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/FF6B5E/white?text=Shirt",
        "product_url": "https://example.com/oxford-shirt",
        "source": "H&M",
        "category": "tops",
    },
    {
        "title": "Slim Tapered Chinos",
        "price": 49.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/3DB6A8/white?text=Chinos",
        "product_url": "https://example.com/chinos",
        "source": "Zara",
        "category": "bottoms",
    },
    {
        "title": "Oversized Linen Blazer",
        "price": 89.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/2A2522/white?text=Blazer",
        "product_url": "https://example.com/blazer",
        "source": "Uniqlo",
        "category": "tops",
    },
    {
        "title": "High-Waist Wide Leg Pants",
        "price": 59.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/8C8279/white?text=Pants",
        "product_url": "https://example.com/wide-pants",
        "source": "ASOS",
        "category": "bottoms",
    },
    {
        "title": "Midi Wrap Dress",
        "price": 69.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/FF6B5E/white?text=Dress",
        "product_url": "https://example.com/wrap-dress",
        "source": "Mango",
        "category": "dresses",
    },
    {
        "title": "Cotton Crew Neck Tee",
        "price": 19.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/3DB6A8/white?text=Tee",
        "product_url": "https://example.com/crew-tee",
        "source": "H&M",
        "category": "tops",
    },
    {
        "title": "Straight Leg Jeans",
        "price": 45.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/2A2522/white?text=Jeans",
        "product_url": "https://example.com/jeans",
        "source": "Levi's",
        "category": "bottoms",
    },
    {
        "title": "Satin Slip Dress",
        "price": 54.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/E8DFF5/333?text=Slip+Dress",
        "product_url": "https://example.com/slip-dress",
        "source": "Zara",
        "category": "dresses",
    },
]


async def search_products(
    query: str,
    budget_max: float | None = None,
    category: str | None = None,
) -> list[ShoppingResultItem]:
    settings = get_settings()

    if settings.serpapi_key:
        return await _search_serpapi(query, budget_max, category, settings.serpapi_key)

    return _search_mock(query, budget_max, category)


def _search_mock(
    query: str,
    budget_max: float | None,
    category: str | None,
) -> list[ShoppingResultItem]:
    results = MOCK_RESULTS
    if category:
        results = [r for r in results if r["category"] == category]
    if budget_max:
        results = [r for r in results if r["price"] <= budget_max]
    return [ShoppingResultItem(**r) for r in results]


async def _search_serpapi(
    query: str,
    budget_max: float | None,
    category: str | None,
    api_key: str,
) -> list[ShoppingResultItem]:
    import httpx

    params = {
        "engine": "google_shopping",
        "q": query,
        "api_key": api_key,
        "num": 20,
    }
    if budget_max:
        params["price_max"] = str(int(budget_max))

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get("https://serpapi.com/search", params=params)
        resp.raise_for_status()
        data = resp.json()

    items: list[ShoppingResultItem] = []
    for r in data.get("shopping_results", [])[:12]:
        price_str = r.get("extracted_price") or r.get("price", "0")
        try:
            price = float(str(price_str).replace("$", "").replace(",", ""))
        except ValueError:
            price = 0
        if budget_max and price > budget_max:
            continue
        items.append(
            ShoppingResultItem(
                title=r.get("title", ""),
                price=price,
                currency="USD",
                image_url=r.get("thumbnail", ""),
                product_url=r.get("link", ""),
                source=r.get("source", ""),
                category=category,
            )
        )
    return items
```

- [ ] **Step 2: Create `backend/app/routers/shopping.py`**

```python
import json
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.shopping import ShoppingQuery
from app.models.user import User
from app.schemas.shopping import (
    ShoppingHistoryItem,
    ShoppingSearchRequest,
    ShoppingSearchResponse,
)
from app.services.shopping_service import search_products

router = APIRouter(prefix="/shopping", tags=["shopping"])


@router.post("/search", response_model=ShoppingSearchResponse)
async def search(
    payload: ShoppingSearchRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    results = await search_products(
        query=payload.query,
        budget_max=payload.budget_max,
        category=payload.category,
    )

    record = ShoppingQuery(
        user_id=user.id,
        query=payload.query,
        budget_max=payload.budget_max,
        category=payload.category,
        results_json={"results": [r.model_dump() for r in results]},
    )
    db.add(record)
    await db.commit()

    return ShoppingSearchResponse(
        query=payload.query,
        results=results,
        total=len(results),
    )


@router.get("/history", response_model=list[ShoppingHistoryItem])
async def history(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
):
    q = (
        select(ShoppingQuery)
        .where(ShoppingQuery.user_id == user.id)
        .order_by(ShoppingQuery.created_at.desc())
        .limit(limit)
    )
    res = await db.execute(q)
    items: list[ShoppingHistoryItem] = []
    for row in res.scalars().all():
        rj = row.results_json or {}
        items.append(
            ShoppingHistoryItem(
                id=str(row.id),
                query=row.query,
                budget_max=row.budget_max,
                category=row.category,
                result_count=len(rj.get("results", [])),
                created_at=row.created_at,
            )
        )
    return items
```

- [ ] **Step 3: Register router in `main.py`**

In `backend/app/main.py`, add:

```python
from app.routers import auth, avatar, files, outfits, settings, shopping, stylist, tryon, wardrobe
```

And add:

```python
app.include_router(shopping.router)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/shopping_service.py backend/app/routers/shopping.py backend/app/main.py
git commit -m "feat: add shopping search endpoint with mock data + SerpAPI support"
```

---

### Task 8: Shopping Frontend — API Client + Shop Page + Nav

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/app/shop/page.tsx`
- Modify: `frontend/src/components/BottomNav.tsx`
- Modify: `frontend/src/components/Header.tsx`

**Interfaces:**
- Consumes: `POST /shopping/search` and `GET /shopping/history` from Task 7, updated CSS from Task 1
- Produces: `api.shoppingSearch(query, budget_max?, category?)` method, `api.shoppingHistory()` method, `/shop` page, "Shop" nav tab

- [ ] **Step 1: Add types and methods to `api.ts`**

Add after the existing types:

```ts
export type ShoppingResultItem = {
  title: string;
  price: number;
  currency: string;
  image_url: string;
  product_url: string;
  source: string;
  category: string | null;
};

export type ShoppingSearchResponse = {
  query: string;
  results: ShoppingResultItem[];
  total: number;
};

export type ShoppingHistoryItem = {
  id: string;
  query: string;
  budget_max: number | null;
  category: string | null;
  result_count: number;
  created_at: string;
};
```

Add inside the `api` object:

```ts
shoppingSearch(query: string, budget_max?: number, category?: string) {
  return request<ShoppingSearchResponse>("/shopping/search", {
    method: "POST",
    body: JSON.stringify({ query, budget_max: budget_max || null, category: category || null }),
  });
},
shoppingHistory() {
  return request<ShoppingHistoryItem[]>("/shopping/history");
},
```

- [ ] **Step 2: Create `frontend/src/app/shop/page.tsx`**

```tsx
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

        {/* Results */}
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
            href={item.product_url}
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
```

- [ ] **Step 3: Add "Shop" tab to BottomNav**

In `BottomNav.tsx`, add a new entry to the `tabs` array between "Closet" and "Studio":

```tsx
{
  href: "/shop",
  label: "Shop",
  icon: (active: boolean) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
},
```

- [ ] **Step 4: Add "Shop" link to Header**

In `Header.tsx`, add to the `navLinks` array between Closet and Studio:

```tsx
{ href: "/shop", label: "Shop" },
```

So the full array becomes:

```tsx
const navLinks = [
  { href: "/", label: "Home" },
  { href: "/wardrobe", label: "Closet" },
  { href: "/shop", label: "Shop" },
  { href: "/studio", label: "Studio" },
  { href: "/settings", label: "Profile" },
];
```

- [ ] **Step 5: Verify frontend build**

Run: `cd frontend && npx next build`
Expected: compiles with 0 errors, new `/shop` route appears in build output

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/app/shop/page.tsx frontend/src/components/BottomNav.tsx frontend/src/components/Header.tsx
git commit -m "feat: add shop page with search, budget chips, result cards, and nav tab"
```

---

### Task 9: Visual Verification with Playwright MCP

**Files:**
- No file changes — verification only

**Interfaces:**
- Consumes: all previous tasks
- Produces: screenshots confirming visual correctness

- [ ] **Step 1: Start dev server**

Run: `cd frontend && npm run dev`

- [ ] **Step 2: Screenshot landing page**

Use Playwright MCP `browser_navigate` to `http://localhost:3000` and `browser_take_screenshot`. Verify:
- No emoji in step cards or feature grid
- Gradient on primary CTA button
- Grain texture visible on background
- Cards have rounded-xl4 borders

- [ ] **Step 3: Screenshot authenticated home**

Navigate to `/` while logged in. Verify:
- No wave emoji in greeting
- Today's pick card inside chat area
- Shuffle button has no emoji
- Chat composer styled correctly

- [ ] **Step 4: Screenshot shop page**

Navigate to `/shop`. Verify:
- Budget chips render correctly
- Category filter pills render
- Search form styled with bolder type
- Shop tab visible in bottom nav

- [ ] **Step 5: Screenshot wardrobe page**

Navigate to `/wardrobe`. Verify:
- Category buttons have no emoji
- Condition chips show on item cards (if items have conditions)

- [ ] **Step 6: Final build check**

Run: `cd frontend && npx next build`
Expected: all routes compile, 0 errors
