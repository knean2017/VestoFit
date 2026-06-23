# FitMe — Gen Z Styling + PWA + Shopping

**Date:** 2026-06-23  
**Status:** Draft  
**Scope:** 4 workstreams executed sequentially

---

## 1. Gen Z Styling Pass (Clean Bold, No Emojis)

### Design Token Changes

**Typography:**
- Headings: `font-extrabold`, tracking `-0.04em`
- Labels: `font-black`, uppercase
- No emoji in UI chrome — replace with colored circles or minimal SVG icons

**Colors (keep warm palette, push contrast):**
- Background stays `#FBF7F0`, add subtle CSS grain texture
- Primary buttons get gradient fill: `linear-gradient(135deg, #FF6B5E, #FF8F6B)` — used sparingly, only on main CTAs
- Cards: subtle gradient-border glow on hover (not gradient backgrounds)
- Active nav: gradient underline pill instead of flat bg

**Components:**
- Buttons: gradient on primary only, bigger shadow, scale(1.02) hover
- Cards: `rounded-xl4` (2rem), hover adds faint border glow + shadow lift
- Chips: taller padding (py-2), bolder font-weight
- Fields: 2px coral border on focus, more padding
- No gradient on secondary/ghost buttons — keep flat

**Motion:**
- Staggered `animate-rise` (already exists)
- Button hover: `scale-[1.02]` + shadow transition
- Tab switches: `transition-all duration-300`
- Shuffle: slight rotation + scale on card swap

**Landing page:**
- Replace emoji in step cards with numbered colored circles (already numbered, just remove emoji)
- Replace emoji in feature grid with solid-color icon circles using SVG
- Hero: subtle grain overlay, no gradient mesh blob
- CTA: primary gradient button

**All pages:**
- Remove inline emoji from labels and badges where possible
- Wardrobe cards show condition chips if set
- Studio render button: gradient
- Settings: cleaner dividers, gradient accent on avatar ring

### Files Modified
- `tailwind.config.ts` — new tokens, keyframes
- `globals.css` — grain texture, gradient utilities, updated component classes
- `page.tsx` (home) — remove emoji from UI elements
- `wardrobe/page.tsx` — condition chips on cards
- `studio/page.tsx` — gradient render button
- `settings/page.tsx` — cleaner sections
- `login/page.tsx`, `register/page.tsx` — remove emoji logo
- `Header.tsx`, `BottomNav.tsx` — active state styling
- `onboard/page.tsx` — consistent styling

---

## 2. PWA Setup

### New Files
- `frontend/public/manifest.json`
- `frontend/public/sw.js` — minimal service worker (cache-first static, network-first API)
- `frontend/public/icons/icon-192.png`
- `frontend/public/icons/icon-512.png`

### Changes
- `layout.tsx` already references manifest — just need actual file
- Add SW registration in layout or a small `usePWA` hook
- Add dismissible install prompt component

### Manifest
```json
{
  "name": "FitMe",
  "short_name": "FitMe",
  "description": "Your AI-powered wardrobe assistant",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FBF7F0",
  "theme_color": "#FF6B5E",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 3. Shopping Backend

### New Files
- `backend/app/models/shopping.py` — ShoppingQuery model
- `backend/app/schemas/shopping.py` — request/response schemas
- `backend/app/services/shopping_service.py` — mock impl + SerpAPI interface
- `backend/app/routers/shopping.py` — API endpoints

### Config Addition
- `config.py`: add `serpapi_key: str = ""`

### Data Model
```
ShoppingQuery:
  id: UUID
  user_id: UUID (FK)
  query: str
  budget_min: float | null
  budget_max: float | null
  category: str | null
  results_json: JSON
  created_at: datetime
```

### API Endpoints
- `POST /shopping/search` — body: `{query, budget_max?, category?}` → `ShoppingResponse`
- `GET /shopping/history` — last 20 searches

### Shopping Result Schema
```
ShoppingResult:
  title: str
  price: float
  currency: str = "USD"
  image_url: str
  product_url: str
  source: str
  category: str | null
```

### Mock Implementation
Returns 6-8 hardcoded results per query, filtered by budget. Ready to swap for SerpAPI when key is available.

### Two Modes
1. **Fill gaps** — takes item_ids of owned pieces + occasion → searches for missing categories
2. **Full outfit** — takes occasion + budget → returns complete shoppable outfit

---

## 4. Shopping Frontend

### New Files
- `frontend/src/app/shop/page.tsx` — dedicated shopping page

### Changes
- `BottomNav.tsx` — add "Shop" tab (bag icon) between Closet and Studio
- `Header.tsx` — add Shop nav link
- `api.ts` — add shopping API methods

### Shop Page Layout
1. **Search bar** at top with occasion input
2. **Budget chips**: $25, $50, $100, $200+ (selectable, not a slider)
3. **Category filter**: All, Tops, Bottoms, Dresses, Shoes, Accessories
4. **Results grid**: 2-col on mobile, 3-col on desktop
5. **ShopResultCard**: product image, title, price badge, source, "View" button linking to external store

### ShopResultCard Component
- Card with product image (aspect 3/4)
- Title truncated to 2 lines
- Price in bold coral
- Source badge (small chip)
- External link button

---

## Execution Order
1. Gen Z styling pass (all pages)
2. PWA setup
3. Shopping backend (mock)
4. Shopping frontend
5. Visual verification with Playwright MCP after each step

## Constraints
- No emoji in UI chrome
- Gradients used sparingly (primary CTAs only)
- Mock shopping data until SerpAPI key provided
- Next.js 14, Tailwind 3, no additional UI libraries
