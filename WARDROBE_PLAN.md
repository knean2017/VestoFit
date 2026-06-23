# FitMe — Virtual Wardrobe & AI Stylist (Design Plan)

> Status: design proposal. Last updated 2026-05-28.
> This builds on the existing FitMe MVP (avatar + single-garment try-on). See `FITME_PROJECT.md`
> for the current system. This document reasons about the next big feature and proposes a concrete build.

---

## 1. The idea, in one sentence

Let a user photograph their **own clothes** into a digital wardrobe, then ask an LLM in plain language
("date night, smart casual") to **assemble an outfit from what they actually own** — and see it rendered
on their avatar.

This turns FitMe from "try on a garment you found online" into "a stylist who knows your closet."

---

## 2. Why this is the right evolution

| Current FitMe | With Wardrobe |
|---|---|
| One garment at a time | Full outfits (top + bottom, or dress) |
| Garment comes from a URL/upload each time | Garments are owned, reusable, categorized |
| User decides what to try | LLM suggests based on occasion |
| No memory of the user's style | Persistent closet + per-item notes |
| Single value moment (try-on) | Repeat engagement (ask daily "what do I wear?") |

The wardrobe is also a **moat**: once a user has photographed 40 items, they're invested. The try-on tech
is replaceable; a populated closet is sticky.

---

## 3. Refined flow (with my changes called out)

```
┌─ ONBOARDING (one-time) ─────────────────────────────────────────┐
│ 1. User uploads ONE avatar photo (already built)                 │
│ 2. User adds clothes one by one (photo or upload)                │
│    └─ on each add: VISION LLM runs ONCE → extracts attributes    │
│       (type, color, pattern, formality, season, warmth)          │
│       → stored as TEXT on the item. Image kept for try-on.       │
└──────────────────────────────────────────────────────────────────┘

┌─ STYLING REQUEST ────────────────────────────────────────────────┐
│ User: "Date night outfit, smart casual"                          │
│         │                                                         │
│         ▼                                                         │
│  TEXT-ONLY LLM call  ← key cost optimization                      │
│   - input: the request + the wardrobe as a TEXT CATALOG          │
│     (not the images — we already described them at upload)        │
│   - guardrail: only answers clothing/outfit questions            │
│   - output JSON: { items: [id_3, id_7], reasoning: "..." }       │
│         │                                                         │
│         ▼                                                         │
│  PREVIEW (cheap, no AI): show the chosen item photos as an       │
│  outfit card + the reasoning. User can: accept / re-roll /        │
│  swap an item / edit.                                             │
│         │  (accept)                                               │
│         ▼                                                         │
│  RENDER — chained FASHN calls:                                    │
│   Call 1: avatar + top      → image_A                             │
│   Call 2: image_A + bottom  → final image                        │
│   (dress/jumpsuit = single call)                                  │
│         │                                                         │
│         ▼                                                         │
│  User sees themselves in the full outfit + the reasoning.         │
└──────────────────────────────────────────────────────────────────┘
```

### The one change I strongly recommend vs. the original sketch
The original flow sends **all wardrobe images to Gemini on every request**. That is:
- **Slow** (uploading/processing 40 images per question)
- **Expensive** (~$0.0003 × 40 = ~$0.012 per request, every time, forever)
- **Redundant** (the clothes don't change between questions)

**Better:** describe each item **once** at upload time with the vision LLM, store the description as text,
and make every styling request a **text-only** call over that catalog. Result:
- Styling requests cost a fraction of a cent and are near-instant.
- The vision cost is paid once per item, not once per question.
- The LLM reasons over clean structured data instead of re-interpreting pixels each time.

We keep the images, of course — they're used for the actual try-on render and shown in previews.

---

## 4. Two-call vs one-call outfit rendering

The current try-on models apply **one garment per call**. So a full outfit needs chaining:

```
Call 1: FASHN(avatar, top, category=tops)        → image_A (person in top)
Call 2: FASHN(image_A, bottom, category=bottoms)  → final  (person in full outfit)
```

- **Dresses / jumpsuits / overalls** = a single call (category=dresses). Detected from item attributes.
- **Top + bottom** = two sequential calls. Order matters: top first, then bottom on the result, because
  the second pass must see the tucked/untucked relationship.
- **Layering (jacket/coat over a shirt)** = **in scope**. Rendered as an additional chained call applied
  last, on top of the already-dressed image. Order: base top → bottom → outer layer. Each extra layer is
  one more sequential FASHN call on the previous result.

**Render order (general rule):** innermost/base garment first, working outward, bottoms before outer layers.
```
base top → image_A → bottom → image_B → outer layer → final
```

**Cost per outfit:** ~$0.075 per garment call. So ~$0.075 (dress) / ~$0.15 (top+bottom) /
~$0.225 (top+bottom+jacket). Only paid when the user hits "render" — not during preview or chat.
Because layering multiplies calls, the UI should show the per-render cost/estimated time before confirming.

If a single-call multi-garment model becomes available/affordable on FAL, the `outfit_service` is the only
place that changes; everything upstream (LLM, wardrobe, preview) stays identical.

---

## 5. LLM choice (cheapest capable, May 2026)

| Model | In / Out per 1M tok | ~Per image | Notes |
|---|---|---|---|
| **Gemini 2.5 Flash-Lite** | **$0.10 / $0.40** | **~$0.0003** | Cheapest managed vision option. Recommended. |
| GPT-5 Nano | $0.05 / $0.40 | ~$0.0001–0.0008 | Also very cheap; good fallback. |
| Gemini 2.5 Flash | $0.30 / $1.20-ish | ~$0.0009 | Step up if Lite reasoning is too weak. |
| GPT-4o mini | $0.15 / $0.60 | ~$0.0006 | Solid all-rounder. |

**Recommendation:** **Gemini 2.5 Flash-Lite** for both jobs (vision tagging at upload + text styling).
It's the price leader, multimodal, 1M context. We abstract it behind an `llm_service` so swapping to
GPT-5 Nano or a self-hosted model is a one-file change — mirroring how `tryon_service` abstracts FAL models.

> Note: the original sketch said "Gemini 2.0 Flash." As of 2026 that generation is superseded; 2.5 Flash-Lite
> is both cheaper and better. Same vendor, drop-in.

---

## 6. Data model (new tables)

```sql
-- A user's closet item
CREATE TABLE wardrobe_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    image_key       TEXT NOT NULL,          -- storage key of the garment photo
    clean_image_key TEXT,                   -- background-removed version (for render)

    -- category drives which try-on slot it fills
    category        VARCHAR NOT NULL,       -- tops | bottoms | dresses | (future: outerwear, shoes)

    -- attributes extracted ONCE by the vision LLM at upload
    name            TEXT,                   -- "olive green linen overshirt"
    color           TEXT,                   -- "olive green"
    pattern         TEXT,                   -- "solid" | "plaid" | "striped" ...
    formality       VARCHAR,                -- casual | smart-casual | formal
    season          VARCHAR,                -- all | summer | winter | spring-fall
    warmth          INT,                    -- 1 (light) .. 5 (heavy)
    attributes      JSONB,                  -- full raw LLM output, for flexibility

    -- user-supplied
    user_notes      TEXT,                   -- "gift from mom, wear on special days"
    is_favorite     BOOLEAN DEFAULT FALSE,
    conditions      TEXT,                   -- "only for warm weather", "not for work"

    tagging_status  VARCHAR DEFAULT 'pending', -- pending | done | failed
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- A generated or user-built outfit
CREATE TABLE outfits (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    prompt        TEXT,                      -- the request, if LLM-generated
    reasoning     TEXT,                      -- LLM's explanation
    item_ids      UUID[] NOT NULL,           -- the chosen wardrobe_items
    source        VARCHAR DEFAULT 'llm',     -- llm | manual
    result_key    TEXT,                      -- final rendered image (after chaining)
    render_status VARCHAR DEFAULT 'draft',   -- draft | rendering | completed | failed
    error_message TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- A stylist chat thread (optional but enables follow-ups / Q&A)
CREATE TABLE stylist_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR NOT NULL,             -- user | assistant
    content    TEXT NOT NULL,
    outfit_id  UUID REFERENCES outfits(id),  -- set when the message proposed an outfit
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. API surface (new endpoints)

```
WARDROBE
  POST   /wardrobe/items            multipart: photo  → { item } (+ async tagging)
  GET    /wardrobe/items            → [ items ]  (filter: ?category=&color=&season=)
  GET    /wardrobe/items/{id}       → { item }
  PATCH  /wardrobe/items/{id}       { name?, user_notes?, conditions?, is_favorite?, category? }
  DELETE /wardrobe/items/{id}       → 204
  POST   /wardrobe/items/{id}/retag → re-run vision tagging

STYLIST (the LLM)
  POST   /stylist/suggest           { prompt } → { outfit_id, item_ids, reasoning }
  POST   /stylist/ask               { prompt, item_ids? } → { reply }   # general Q&A / "how does this look"
  POST   /stylist/reroll            { prompt } → { new outfit }          # just asks the LLM again, same request, fresh combo

OUTFITS
  POST   /outfits                   { item_ids[] } → { outfit_id }       # manual build
  POST   /outfits/{id}/render       → { render job started }             # chained FASHN calls
  GET    /outfits/{id}              → { outfit, result_url?, status }
  GET    /outfits                   → [ saved outfits ]
```

The render endpoint reuses the existing FAL polling machinery from `tryon_service` — we generalize it to
accept an ordered list of garments and chain calls.

---

## 8. The vision tagging prompt (upload time)

Run once per item. Output is strict JSON so we can store it in columns.

```
System: You are a fashion cataloguer. Look at the single clothing item in the image and return ONLY
valid JSON, no prose.

Return:
{
  "category": "tops | bottoms | dresses",
  "name": "<short human name, e.g. 'olive linen overshirt'>",
  "color": "<primary color>",
  "pattern": "solid | striped | plaid | floral | graphic | other",
  "formality": "casual | smart-casual | formal",
  "season": "all | summer | winter | spring-fall",
  "warmth": 1-5
}
If the image is not a single clothing item, return {"category": null}.
```

`category` here also replaces the keyword-guessing in `garment_service.infer_category` — the vision model
is far more accurate than URL token matching.

---

## 9. The stylist prompt (request time, text-only)

```
System: You are a personal stylist. You ONLY discuss the user's clothing and outfits. If asked anything
unrelated to clothes/style/outfits, politely decline and steer back. You may ONLY choose items from the
wardrobe provided. Never invent items.

Wardrobe (JSON list): [
  {"id":"3","name":"olive linen overshirt","category":"tops","color":"olive","formality":"smart-casual","season":"summer","notes":"gift from mom, special days"},
  {"id":"7","name":"beige chino trousers","category":"bottoms","color":"beige","formality":"smart-casual","season":"all"},
  ...
]

User request: "Date night, smart casual"

Respond ONLY as JSON:
{
  "items": ["3","7"],        // must be one top+one bottom, OR one dress
  "reasoning": "<2-3 sentences, warm and specific>",
  "decline": false           // true if request was off-topic; then items=[]
}
```

Notes:
- The `notes`/`conditions`/`is_favorite` fields are included so the model can honor "special days" or
  "only warm weather" constraints — directly addressing the user's request that the LLM "think about it."
- Validation layer: we verify returned `items` exist, belong to the user, and form a valid combo
  (1 top + 1 bottom, or 1 dress). If not, we re-ask once, then fall back to a deterministic picker.

---

## 10. Modes of interaction (all requested features mapped)

| User wants | How it works |
|---|---|
| "Date night outfit" | `/stylist/suggest` → LLM picks items → preview → render |
| "Combine with green colors" | same; LLM filters wardrobe by color attribute |
| "Going to university, what do I wear?" | same; LLM uses formality=smart-casual/casual |
| Don't like the combo → new one | `/stylist/reroll` — simply returns a fresh suggestion for the same request |
| "Something with these jeans" | manual: lock item_7, LLM completes the rest |
| Pick both items myself, "how does this look?" | `/outfits` (manual) + `/stylist/ask` for an opinion |
| General clothes question | `/stylist/ask` (no render) |
| Item is special / has conditions | per-item `user_notes` + `conditions`, fed to the LLM |
| See clothes nicely before rendering | preview card with item photos (clean cut-outs) |
| Only render when happy | render is an explicit, separate, paid step |

### "Mannequin" preview — a 2D silhouette, NOT AI generation
This is purely a **front-end visual**: a flat 2D human silhouette (a simple SVG/PNG outline) with the
background-removed clothing images **positioned onto the correct body regions**:
- tops → chest/torso zone
- bottoms → hip/leg zone
- dresses → torso-to-leg zone
- outer layers → drawn over the top, slightly larger/offset

No AI, no FAL call, **zero cost, instant**. It exists so the user can see "these are the pieces, here's how
they sit together" before deciding to spend a real render. The clean cut-outs from `rembg` are exactly what
makes this look tidy. The silhouette is a static asset; the clothing images are absolutely-positioned layers
over it (CSS/Canvas).

The personal, photorealistic render (FASHN on the user's avatar) is the **separate, explicit, paid step**
that happens only after the user likes what they see on the silhouette.

---

## 11. Guardrail (clothes-only)

Three layers, cheap to strict:
1. **System prompt** instruction to decline off-topic asks (above).
2. **`decline` flag** in the JSON the model returns; the UI shows a gentle redirect.
3. (optional) a tiny pre-classifier on the request if abuse becomes a problem. Skip for MVP.

---

## 12. Cost model (per active user, rough)

| Action | Cost | Frequency |
|---|---|---|
| Tag an item (vision) | ~$0.0003 | once per item added |
| Styling suggestion (text) | < $0.001 | per request — cheap, so unlimited-feeling |
| Outfit render (top+bottom) | ~$0.15 | only on "render" |
| Outfit render (dress) | ~$0.075 | only on "render" |

A user with a 40-item closet pays ~$0.012 total to tag everything, then chats freely for fractions of a
cent, and only spends real money when they commit to seeing a render. This is a healthy structure — the
expensive step is the one with the most perceived value, and it's user-initiated.

---

## 13. Build phases

**Phase 1 — Wardrobe CRUD** ✅ *implemented*
- `wardrobe_items` table, upload endpoint, grid UI, background removal reuse, manual category.
- Routes: `POST/GET/PATCH/DELETE /wardrobe/items`, filters by category/favorites.
- Frontend: `/wardrobe` page with add, grid, edit modal (name, notes, conditions, favorite).
- No LLM yet. `tagging_status` stays `pending` until Phase 2.

**Phase 2 — Vision tagging** ✅ *implemented*
- `llm_service` (Gemini 2.5 Flash-Lite), tag on upload (background), store attributes, show in UI.
- `POST /wardrobe/items/{id}/retag` to re-run vision tagging.
- Env: `GEMINI_API_KEY`, `LLM_MODEL`.

**Phase 3 — Manual outfits + 2D silhouette preview** ✅ *implemented*
- `outfits` table, `POST/GET /outfits`, manual builder on `/stylist`.
- `SilhouettePreview` component — 2D silhouette with positioned cut-outs.

**Phase 4 — Chained render (incl. layering)** ✅ *implemented*
- `fal_render_service` + `outfit_render_service` chain FASHN calls (base top → bottom → outer).
- `POST /outfits/{id}/render` with polling in UI.

**Phase 5 — The stylist** ✅ *implemented*
- `/stylist/suggest` + `/stylist/reroll`, validation/fallback, feeds silhouette preview.

**Phase 6 — Chat & Q&A** ✅ *implemented*
- `stylist_messages`, `/stylist/ask`, `/stylist/messages`, chat panel on `/stylist`.

Each phase is independently shippable and testable.

---

## 14. New tech, added to the stack

| Concern | Choice | Why |
|---|---|---|
| Stylist + tagging LLM | **Gemini 2.5 Flash-Lite** (via `llm_service` abstraction) | Cheapest capable vision model in 2026 |
| Outfit rendering | **Existing FASHN v1.6**, chained | Already integrated; one garment/call → sequential |
| Background removal | **Existing `rembg`** | Already in the pipeline; gives clean preview cut-outs |
| Item attributes store | **Postgres JSONB + typed columns** | Query by color/season fast; keep raw JSON for flexibility |

No new infrastructure — just one new external dependency (the LLM API key) and three new tables.

---

## 15. Decisions (settled)

1. **Categories:** tops, bottoms, dresses for v1. More (shoes, accessories) come later. ✅
2. **Layering:** **in scope.** Jacket/coat over a shirt = an extra chained render call applied last
   (base top → bottom → outer layer). See §4. ✅
3. **Re-roll:** simple — re-asks the LLM with the same request and returns a fresh combo. No need to track
   the full history of rejected combos. ✅
4. **Preview = 2D silhouette** (front-end only, no AI): a flat human outline with the clothing cut-out
   images positioned on the body regions. Zero cost, instant. The photorealistic avatar render is the
   separate paid step. See §10. ✅
5. **LLM:** Gemini (2.5 Flash-Lite) for now. Kept behind the `llm_service` abstraction so a swap is easy. ✅

---

## 16. Environment additions

```bash
# backend/.env  (new)
LLM_PROVIDER=gemini                    # gemini | openai  (abstraction switch)
LLM_MODEL=gemini-2.5-flash-lite
GEMINI_API_KEY=                        # from aistudio.google.com
# (or OPENAI_API_KEY if LLM_PROVIDER=openai)
```

---

## 17. Summary of recommendations vs. the original idea

- **Keep:** the whole vision — wardrobe, LLM stylist, chained top+bottom render, **layering**, re-roll,
  manual mode, per-item notes/conditions, clothes-only guardrail.
- **Change:** tag clothes **once at upload** with the vision LLM and make styling requests **text-only**
  over that catalog — far cheaper and faster than sending all images every time.
- **Clarify:** the "mannequin" preview is a **2D silhouette** (front-end, no AI) — clothing cut-outs
  positioned on a body outline. Free and instant. The photorealistic render is a separate paid step.
- **Upgrade:** use **Gemini 2.5 Flash-Lite** (not 2.0 Flash) — cheaper and better, same vendor.
- **Sequence:** ship in 6 phases — wardrobe CRUD → vision tagging → silhouette preview → chained render
  (incl. layering) → stylist → chat. Each is usable on its own.
```
