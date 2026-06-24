# Conversation-First Stylist Redesign — Design Spec

**Date:** 2026-06-24
**Goal:** Make the AI stylist the primary interface on both the home page and shop page. Users should be able to talk freely with the stylist from the moment they arrive — no forced chip flows, no dead-end CTAs. The shop page becomes AI-driven: the stylist decides what to search based on conversation rather than requiring manual query/filter input.

**Approach:** Unified `<StylistChat>` component shared by both pages, with a `mode` prop that determines API calls and result rendering.

---

## 1. `<StylistChat>` Component

**File:** `frontend/src/components/StylistChat.tsx`

### Props

| Prop | Type | Description |
|------|------|-------------|
| `mode` | `"stylist" \| "shopping"` | Determines greeting, API endpoints, and result handling |
| `onSearchResults` | `(results: ShoppingResultItem[]) => void` | Shopping mode only — fires when AI triggers a search so the page can render results in its grid |
| `onSuggestion` | `(reasoning: string) => void` | Stylist mode only — fires when AI replies with outfit reasoning, so the home page can update the silhouette |
| `greeting` | `string?` | Override the default opening message |
| `className` | `string?` | Additional CSS classes |

### Behavior by Mode

**`stylist` mode (home page):**
- Calls `api.stylistAsk(prompt, item_ids)` for every user message.
- Loads history on mount via `api.stylistMessages()`.
- Works with or without wardrobe items. Empty wardrobe: AI greets conversationally, talks about style, and naturally suggests adding clothes or browsing when relevant — never forces it. Has wardrobe: suggests outfits, answers style questions.
- Quick-reply chips come from the AI's response context (e.g., `[Try it on]`, `[Shuffle]`, `[Something more casual]`), not hardcoded stage machines.

**`shopping` mode (shop page):**
- Calls new `api.shoppingAsk(prompt)` endpoint for every user message.
- The AI decides per-message whether to auto-search or ask follow-ups:
  - Clear product intent + enough specificity → auto-search, fires `onSearchResults` with the results
  - Vague request → asks 1 follow-up question with quick-reply chips
  - Conversational / advisory → just replies, no search
- Search results render in the page's existing grid below the chat, not inline in the conversation.

### UI Structure

- Full-width scrollable message area with existing bubble styling from `ChatSheet` (user = coral, assistant = surface2, `rounded-xl3`, max 80% width).
- Sticky input bar at the bottom: text input + send button.
- Typing indicator (three-dot pulse) while waiting for API response.
- Quick-reply chips render below the latest assistant message when the API returns them.
- Auto-scrolls to latest message on new messages.
- `prefers-reduced-motion`: no entrance animations on bubbles, instant scroll instead of smooth.

### Message State

```ts
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  chips?: string[];        // quick-reply suggestions from AI
  searchTriggered?: boolean; // visual indicator that a search ran
};
```

Messages are managed locally in component state. On mount in stylist mode, history is loaded from `api.stylistMessages()`. Shopping mode starts fresh each visit (no persisted shopping chat history — shopping conversations are ephemeral and session-scoped).

### Callbacks for Page Integration

In stylist mode, `StylistChat` accepts an optional `onSuggestion?: (reasoning: string) => void` callback. When the AI's reply contains outfit reasoning, the home page uses this to update the silhouette preview's reasoning text and trigger `pickRandom` for a new outfit visual. This keeps the silhouette reactive to conversation without the chat component needing to know about wardrobe state.

---

## 2. Home Page Changes

**File:** `frontend/src/app/page.tsx`

### Empty Wardrobe State

**Remove:** The dead-end card with hardcoded "Add clothes" / "Browse shop" links.

**Replace with:**
- `SilhouettePreview` (faded/empty placeholder, same as now)
- `<StylistChat mode="stylist">` at the bottom
- AI greeting: "Hey! I'm your stylist. What's the occasion today — or just tell me about your style and we'll go from there."
- If the user says "I have nothing to wear," the AI naturally suggests adding clothes or browsing the shop, with contextual quick-reply chips like `[Add from closet]` `[Browse shop]`. These emerge from conversation, not as forced buttons.

### Has-Wardrobe State

**Remove:**
- Hardcoded chip flow (`flowStage`, `OPENER_CHIPS`, `NARROWING_CHIPS`, `handleChip`, `showChips` logic)
- `FloatingCard` component usage (reasoning text moves into chat)
- `ChatSheet` bottom sheet and "History" button (messages are now inline)
- `QuickReplyChips` import (chips now come from `StylistChat` internally)

**Keep unchanged:**
- `SilhouettePreview` and its data binding to `suggestion` state
- Shuffle button + `handleShuffle` + `pickRandom`
- Try On button + `handleTryOn`
- `loadData` callback, both useEffects (auth + load, no polling needed)
- `sendPrompt` function — but rewired to go through the chat component
- All wardrobe/suggestion/reasoning state

**Rewire:**
- The chat input replaces the form at the bottom. `StylistChat` handles send/receive.
- When the AI suggests an outfit (via `stylistAsk`), the reasoning appears as a chat bubble AND updates the `FloatingCard`-style reasoning display near the silhouette.
- Shuffle and Try On buttons stay in their current position between the silhouette and chat.

### Layout (top to bottom)

1. `<Header />`
2. Silhouette zone (flex-1, centered, same as now)
3. Action buttons row (shuffle + try on)
4. `<StylistChat mode="stylist" />` (takes remaining space, scrollable messages + sticky input)
5. `<BottomNav />`

---

## 3. Shop Page Changes

**File:** `frontend/src/app/shop/page.tsx`

### Layout Shift

**Remove from default view:** `SearchBar` component (moved behind a toggle).

**Add:**
- `<StylistChat mode="shopping" onSearchResults={setResults} />` as the primary interface, positioned after the `WindowDisplay` hero
- A small magnifying glass icon button in the top-right corner of the chat area. Tapping it reveals/collapses the existing `SearchBar` component for power users who know exactly what they want.

### Flow

1. User arrives → curtain entrance → AI greeting: "Looking for something specific, or want me to help you find the right piece?"
2. User types "I need a summer dress under $80" → AI auto-parses, calls `shoppingSearch("summer dress", 80, "dresses")` via backend, replies "Here's what I found — 12 summer dresses under $80", fires `onSearchResults` → results appear in existing grid below
3. User types "something for a job interview" → AI asks "What kind of role? And are you thinking more formal or smart casual?" with chips `[Formal]` `[Smart casual]` `[Business casual]`
4. User picks or types → AI constructs the search, results appear

### What Stays Unchanged

- `CurtainReveal` entrance animation
- `WindowDisplay` hero component
- `ResultCard`, `PriceTag`, `MotionCard` components
- GSAP stagger animation on results grid
- `handleSearch` function (still used by the manual SearchBar toggle)
- `safeHref` helper (moved to `ResultCard` already)
- Auth redirect effect

---

## 4. Backend — New Shopping Ask Endpoint

**File:** `backend/app/routers/shopping.py` (add endpoint)
**File:** `backend/app/services/shopping_service.py` (add function)
**File:** `backend/app/schemas/shopping.py` (add schemas)

### `POST /shopping/ask`

**Request schema: `ShoppingAskRequest`**
```python
class ShoppingAskRequest(BaseModel):
    prompt: str
    history: list[dict] | None = None  # recent messages for context
```

**Response schema: `ShoppingAskResponse`**
```python
class ShoppingAskResponse(BaseModel):
    reply: str                          # always present — conversational text
    search: ShoppingSearchParams | None # when present, frontend auto-fires search
    chips: list[str] | None             # suggested quick replies

class ShoppingSearchParams(BaseModel):
    query: str
    budget_max: int | None = None
    category: str | None = None
```

**Behavior:**
- Sends the user's prompt (+ optional recent history for context) to the LLM with a system prompt instructing it to:
  - Extract shopping intent (query, budget, category) when the user's request is specific enough
  - Return `search: null` when it needs more info, and ask a follow-up question
  - Always return a conversational `reply`
  - Optionally suggest `chips` for guided follow-up
- When `search` is non-null, the frontend calls the existing `api.shoppingSearch()` with those params and renders results in the grid.
- The existing `POST /shopping/search` endpoint stays untouched.

### Frontend API Addition

**File:** `frontend/src/lib/api.ts`

```ts
shoppingAsk(prompt: string, history?: { role: string; content: string }[]) {
  return request<ShoppingAskResponse>("/shopping/ask", {
    method: "POST",
    body: JSON.stringify({ prompt, history: history || null }),
  });
}
```

**New types:**
```ts
export type ShoppingAskResponse = {
  reply: string;
  search: { query: string; budget_max: number | null; category: string | null } | null;
  chips: string[] | null;
};
```

### Stylist Ask Response Update

**File:** `backend/app/schemas/stylist.py`

Add optional `chips` field to `StylistAskResponse`:
```python
class StylistAskResponse(BaseModel):
    reply: str
    chips: list[str] | None = None
```

Update `ask_stylist` in `stylist_service.py` to instruct the LLM to return structured JSON instead of plain text. The LLM system prompt should request output in the form `{"reply": "...", "chips": [...] | null}`. The service parses this JSON; if parsing fails, it falls back to treating the entire response as the `reply` with `chips: null`. Chips are contextual suggestions (e.g., after suggesting an outfit: `["Try it on", "Something different", "More casual"]`; for an empty wardrobe: `["Add from closet", "Browse shop"]`).

**File:** `frontend/src/lib/api.ts` — update the return type:
```ts
stylistAsk(prompt: string, item_ids: string[] = []) {
  return request<{ reply: string; chips?: string[] | null }>("/stylist/ask", { ... });
}
```

---

## 5. Components Affected Summary

| Component | Action |
|-----------|--------|
| `StylistChat.tsx` | **Create** — shared chat component |
| `app/page.tsx` | **Modify** — remove chip flow/FloatingCard/ChatSheet, add StylistChat |
| `app/shop/page.tsx` | **Modify** — replace SearchBar with StylistChat, add manual search toggle |
| `ChatSheet.tsx` | **Keep** — no longer imported by home page, but stays in codebase |
| `FloatingCard.tsx` | **Keep** — no longer imported by home page, but stays in codebase |
| `QuickReplyChips.tsx` | **Keep** — no longer imported by home page, but stays in codebase |
| `SearchBar.tsx` | **Keep** — used behind toggle on shop page |
| `SilhouettePreview.tsx` | **Unchanged** |
| `WindowDisplay.tsx` | **Unchanged** |
| `ResultCard.tsx` | **Unchanged** |
| `api.ts` | **Modify** — add `shoppingAsk`, update `stylistAsk` return type |
| `routers/shopping.py` | **Modify** — add `/shopping/ask` endpoint |
| `services/shopping_service.py` | **Modify** — add `ask_shopping_assistant` function |
| `schemas/shopping.py` | **Modify** — add request/response schemas |
| `schemas/stylist.py` | **Modify** — add `chips` to response |
| `services/stylist_service.py` | **Modify** — update LLM prompt for chips |
| `services/llm_service.py` | **Modify** — add shopping ask LLM function |

## 6. What Does NOT Change

- `Header`, `BottomNav`, `Toast`, `lib/auth.ts`
- `SmoothScroll`, `MagneticButton`, `Reveal`, `CurtainReveal`
- `ClosetDoors3D`, wardrobe page, studio page
- `tailwind.config.ts`, `globals.css`
- Existing `POST /shopping/search` endpoint
- Existing `POST /stylist/suggest`, `POST /stylist/reroll` endpoints
- Database models
