# Conversation-First Stylist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded chip flows on the home page and manual search on the shop page with a unified AI chat component (`<StylistChat>`) that lets users talk freely with the stylist from the moment they arrive.

**Architecture:** Shared `StylistChat` component with a `mode` prop (`"stylist"` | `"shopping"`) that determines API endpoints and result rendering. Backend adds a new `POST /shopping/ask` endpoint that combines LLM intent parsing with search execution in a single round-trip. The existing `stylistAsk` response gains a `chips` field for contextual quick replies.

**Tech Stack:** Next.js 14, TypeScript, Tailwind 3, Framer Motion, FastAPI, Pydantic, Gemini 2.5 Flash-Lite (via REST).

## Global Constraints

- **Do NOT** change `Header`, `BottomNav`, `Toast`, `lib/auth.ts`.
- **Do NOT** edit `tailwind.config.ts` or `globals.css`.
- **Do NOT** change existing `POST /shopping/search`, `POST /stylist/suggest`, `POST /stylist/reroll` endpoints.
- **Do NOT** change database models.
- All animations gate on `prefers-reduced-motion`.
- Build gate: `cd frontend && npx next build` must pass with zero TS errors.
- No test framework exists — verification is build + `npm run dev` manual check.

---

### Task 1: Backend — Schemas + LLM functions

**Files:**
- Modify: `backend/app/schemas/stylist.py` (add `chips` to `StylistAskResponse`)
- Modify: `backend/app/schemas/shopping.py` (add `ShoppingMessageItem`, `ShoppingAskRequest`, `ShoppingAskResponse`)
- Modify: `backend/app/services/llm_service.py` (add `stylist_ask_structured`, `shopping_ask`)

**Interfaces:**
- Consumes: existing `_gemini_generate`, `_parse_json`, `MOCK_RESULTS` from shopping_service.
- Produces: `stylist_ask_structured(wardrobe_json, prompt, item_ids) -> dict` (returns `{"reply": str, "chips": list|None}`), `shopping_ask(prompt, history) -> dict` (returns `{"reply": str, "search": {...}|None, "chips": list|None}`), updated `StylistAskResponse` schema, new `ShoppingAskRequest`/`ShoppingAskResponse` schemas.

- [ ] **Step 1: Update `backend/app/schemas/stylist.py`.** Add `chips` field to `StylistAskResponse`.

```python
class StylistAskResponse(BaseModel):
    reply: str
    chips: list[str] | None = None
```

- [ ] **Step 2: Add schemas to `backend/app/schemas/shopping.py`.** Append after `ShoppingHistoryItem`:

```python
class ShoppingMessageItem(BaseModel):
    role: str
    content: str


class ShoppingAskRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    history: list[ShoppingMessageItem] | None = None


class ShoppingAskResponse(BaseModel):
    reply: str
    results: list[ShoppingResultItem] | None = None
    search_query: str | None = None
    chips: list[str] | None = None
```

- [ ] **Step 3: Add `stylist_ask_structured` to `backend/app/services/llm_service.py`.** This replaces the current plain-text `stylist_ask` call pattern with structured JSON output. Append after the existing `stylist_ask` function:

```python
STYLIST_ASK_STRUCTURED = """You are a personal stylist assistant. ONLY answer questions about clothing, outfits, and style.
If off-topic, politely decline and steer back to fashion. Be concise and helpful.

Respond as JSON:
{
  "reply": "<your conversational response>",
  "chips": ["<suggested quick reply 1>", ...] or null
}

Chips are optional 1-4 word quick-reply suggestions the user can tap. Use them when there are natural follow-up actions.
Examples: after suggesting an outfit → ["Try it on", "Something different", "More casual"]
For a new user with empty wardrobe → ["Add from closet", "Browse shop"]
When no follow-up is natural → null"""


async def stylist_ask_structured(
    wardrobe_json: str,
    prompt: str,
    *,
    item_ids: list[str] | None = None,
) -> dict[str, Any]:
    extra = f"\nReferenced item ids: {item_ids}" if item_ids else ""
    parts = [
        {
            "text": (
                f"{STYLIST_ASK_STRUCTURED}\n\nWardrobe:\n{wardrobe_json}{extra}\n\n"
                f"User: {prompt}"
            )
        }
    ]
    raw = await _gemini_generate(parts, json_mode=True)
    try:
        parsed = _parse_json(raw)
        return {
            "reply": str(parsed.get("reply", raw)),
            "chips": parsed.get("chips"),
        }
    except LlmError:
        return {"reply": raw, "chips": None}
```

- [ ] **Step 4: Add `shopping_ask` to `backend/app/services/llm_service.py`.** Append after `stylist_ask_structured`:

```python
SHOPPING_ASK_SYSTEM = """You are a shopping assistant for a fashion app. Help users find clothes to buy.

Given the user's message (and optional conversation history), decide:
1. If the user has a clear, specific shopping request → extract search parameters
2. If the request is vague → ask ONE follow-up question with quick-reply chips
3. If conversational/advisory → just reply, no search

Respond as JSON:
{
  "reply": "<your conversational response>",
  "search": {"query": "<search terms>", "budget_max": <number or null>, "category": "<tops|bottoms|dresses or null>"} or null,
  "chips": ["<quick reply>", ...] or null
}

Rules:
- "search" is null when you need more info or are just chatting
- "search" is filled when you have enough to search (at minimum a query)
- budget_max is a number in USD or null if not specified
- category must be exactly "tops", "bottoms", or "dresses", or null
- chips are 1-4 word tap-able suggestions, max 4 items
- Be warm and helpful, like a personal shopper"""


async def shopping_ask(
    prompt: str,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    context = ""
    if history:
        for msg in history[-10:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            context += f"\n{role.capitalize()}: {content}"

    parts = [
        {
            "text": (
                f"{SHOPPING_ASK_SYSTEM}\n\n"
                f"{'Conversation so far:' + context + chr(10) + chr(10) if context else ''}"
                f"User: {prompt}"
            )
        }
    ]
    raw = await _gemini_generate(parts, json_mode=True)
    try:
        parsed = _parse_json(raw)
        return {
            "reply": str(parsed.get("reply", raw)),
            "search": parsed.get("search"),
            "chips": parsed.get("chips"),
        }
    except LlmError:
        return {"reply": raw, "search": None, "chips": None}
```

- [ ] **Step 5: Verify.** Run `cd backend && python -c "from app.services.llm_service import stylist_ask_structured, shopping_ask; print('OK')"` to confirm imports work.

- [ ] **Step 6: Commit.**

```bash
git add backend/app/schemas/stylist.py backend/app/schemas/shopping.py backend/app/services/llm_service.py
git commit -m "feat(api): add structured stylist response + shopping ask LLM function"
```

---

### Task 2: Backend — Service + Router for `/shopping/ask`

**Files:**
- Modify: `backend/app/services/stylist_service.py` (update `ask_stylist` to use structured output)
- Modify: `backend/app/services/shopping_service.py` (add `ask_shopping_assistant`)
- Modify: `backend/app/routers/shopping.py` (add `/shopping/ask` endpoint)
- Modify: `backend/app/routers/stylist.py` (update `/ask` response)

**Interfaces:**
- Consumes: `stylist_ask_structured` and `shopping_ask` from Task 1, `search_products` from existing shopping_service, `ShoppingAskRequest`/`ShoppingAskResponse`/`ShoppingResultItem` schemas from Task 1.
- Produces: `POST /shopping/ask` endpoint (auth + rate-limited), updated `POST /stylist/ask` endpoint returning `{reply, chips}`.

- [ ] **Step 1: Update `ask_stylist` in `backend/app/services/stylist_service.py`.** Change it to use `stylist_ask_structured` and return both reply and chips. Replace the existing `ask_stylist` function (lines 158–180):

```python
async def ask_stylist(
    db: AsyncSession,
    user_id: uuid.UUID,
    prompt: str,
    item_ids: list[uuid.UUID] | None = None,
) -> dict[str, Any]:
    wardrobe = await _load_wardrobe(db, user_id)
    catalog = wardrobe_catalog_json(wardrobe)
    id_strs = [str(i) for i in item_ids] if item_ids else None

    try:
        result = await stylist_ask_structured(catalog, prompt, item_ids=id_strs)
    except LlmError as e:
        result = {"reply": str(e), "chips": None}

    db.add(
        StylistMessage(user_id=user_id, role="user", content=prompt)
    )
    db.add(
        StylistMessage(user_id=user_id, role="assistant", content=result["reply"])
    )
    await db.commit()
    return result
```

Also update the import at the top of `stylist_service.py` — change:
```python
from app.services.llm_service import LlmError, stylist_ask, stylist_suggest
```
to:
```python
from app.services.llm_service import LlmError, stylist_ask_structured, stylist_suggest
```

- [ ] **Step 2: Update the `/ask` route in `backend/app/routers/stylist.py`.** The handler now returns the dict with reply + chips. Replace the `ask` function (lines 90–101):

```python
@router.post("/ask", response_model=StylistAskResponse)
async def ask(
    payload: StylistAskRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    try:
        item_ids = [uuid.UUID(i) for i in payload.item_ids] if payload.item_ids else None
        result = await ask_stylist(db, user.id, payload.prompt, item_ids)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid item id") from e
    return StylistAskResponse(reply=result["reply"], chips=result.get("chips"))
```

- [ ] **Step 3: Add `ask_shopping_assistant` to `backend/app/services/shopping_service.py`.** Append at the end of the file:

```python
from app.schemas.shopping import ShoppingResultItem as ShoppingResultSchema
from app.services.llm_service import LlmError, shopping_ask


async def ask_shopping_assistant(
    prompt: str,
    history: list[dict[str, str]] | None = None,
) -> dict:
    try:
        result = shopping_ask(prompt, history)
        llm_result = await result
    except LlmError:
        return {
            "reply": "I'm having trouble thinking right now. Try again in a moment.",
            "results": None,
            "search_query": None,
            "chips": None,
        }

    search_params = llm_result.get("search")
    results = None
    search_query = None

    if search_params and isinstance(search_params, dict):
        query = search_params.get("query", "").strip()
        if query:
            search_query = query
            budget_max = search_params.get("budget_max")
            category = search_params.get("category")
            if isinstance(budget_max, (int, float)) and budget_max > 0:
                budget_max = float(budget_max)
            else:
                budget_max = None
            if category not in ("tops", "bottoms", "dresses"):
                category = None
            results = await search_products(
                query=query,
                budget_max=budget_max,
                category=category,
            )

    return {
        "reply": llm_result.get("reply", ""),
        "results": results,
        "search_query": search_query,
        "chips": llm_result.get("chips"),
    }
```

- [ ] **Step 4: Add the `/shopping/ask` endpoint to `backend/app/routers/shopping.py`.** Add these imports at the top (merge with existing):

```python
from app.schemas.shopping import (
    ShoppingAskRequest,
    ShoppingAskResponse,
    ShoppingHistoryItem,
    ShoppingSearchRequest,
    ShoppingSearchResponse,
)
from app.services.shopping_service import ask_shopping_assistant, search_products
```

Then add the route after the existing `/search` route:

```python
@router.post("/ask", response_model=ShoppingAskResponse, dependencies=[Depends(rate_limit_search)])
async def ask(
    payload: ShoppingAskRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    history = None
    if payload.history:
        history = [{"role": m.role, "content": m.content} for m in payload.history]

    result = await ask_shopping_assistant(payload.prompt, history)

    return ShoppingAskResponse(
        reply=result["reply"],
        results=result.get("results"),
        search_query=result.get("search_query"),
        chips=result.get("chips"),
    )
```

- [ ] **Step 5: Verify.** Run `cd backend && python -c "from app.routers.shopping import router; from app.routers.stylist import router; print('OK')"` to confirm imports work.

- [ ] **Step 6: Commit.**

```bash
git add backend/app/services/stylist_service.py backend/app/services/shopping_service.py backend/app/routers/shopping.py backend/app/routers/stylist.py
git commit -m "feat(api): add /shopping/ask endpoint + structured stylist response"
```

---

### Task 3: Frontend — API client + types

**Files:**
- Modify: `frontend/src/lib/api.ts` (add `ShoppingAskResponse` type, `shoppingAsk` method, update `stylistAsk` return type)

**Interfaces:**
- Consumes: existing `request` helper and `ShoppingResultItem` type from `api.ts`.
- Produces: `api.shoppingAsk(prompt, history?) -> ShoppingAskResponse`, updated `api.stylistAsk()` returning `{ reply: string; chips?: string[] | null }`.

- [ ] **Step 1: Add `ShoppingAskResponse` type to `frontend/src/lib/api.ts`.** Add after the existing `ShoppingHistoryItem` type (around line 100):

```ts
export type ShoppingAskResponse = {
  reply: string;
  results: ShoppingResultItem[] | null;
  search_query: string | null;
  chips: string[] | null;
};
```

- [ ] **Step 2: Update `stylistAsk` return type.** Change the existing `stylistAsk` method (line 285–289) from:

```ts
  stylistAsk(prompt: string, item_ids: string[] = []) {
    return request<{ reply: string }>("/stylist/ask", {
      method: "POST",
      body: JSON.stringify({ prompt, item_ids }),
    });
  },
```

to:

```ts
  stylistAsk(prompt: string, item_ids: string[] = []) {
    return request<{ reply: string; chips?: string[] | null }>("/stylist/ask", {
      method: "POST",
      body: JSON.stringify({ prompt, item_ids }),
    });
  },
```

- [ ] **Step 3: Add `shoppingAsk` method.** Add after `shoppingSearch` (around line 299):

```ts
  shoppingAsk(prompt: string, history?: { role: string; content: string }[]) {
    return request<ShoppingAskResponse>("/shopping/ask", {
      method: "POST",
      body: JSON.stringify({ prompt, history: history || null }),
    });
  },
```

- [ ] **Step 4: Verify.** `cd frontend && npx tsc --noEmit` passes with no errors.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(api): add shoppingAsk client + update stylistAsk types"
```

---

### Task 4: Frontend — `<StylistChat>` component

**Files:**
- Create: `frontend/src/components/StylistChat.tsx`

**Interfaces:**
- Consumes: `api.stylistAsk()`, `api.stylistMessages()`, `api.shoppingAsk()`, `ShoppingResultItem` and `StylistMessage` types from `@/lib/api`.
- Produces: `<StylistChat mode="stylist"|"shopping" onSearchResults? onSuggestion? greeting? className? />` — the shared chat component used by both pages.

- [ ] **Step 1: Create `frontend/src/components/StylistChat.tsx`.**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { api } from "@/lib/api";
import type { ShoppingResultItem, StylistMessage } from "@/lib/api";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  chips?: string[];
  searchTriggered?: boolean;
};

const DEFAULT_GREETINGS = {
  stylist:
    "Hey! I'm your stylist. What's the occasion today — or just tell me about your style and we'll go from there.",
  shopping:
    "Looking for something specific, or want me to help you find the right piece?",
};

const EXAMPLE_PROMPTS = {
  stylist: '"I need an outfit for a date" or "What\'s trending right now?"',
  shopping: '"summer dress under $80" or "help me find interview clothes"',
};

export default function StylistChat({
  mode,
  onSearchResults,
  onSuggestion,
  greeting,
  className = "",
}: {
  mode: "stylist" | "shopping";
  onSearchResults?: (results: ShoppingResultItem[]) => void;
  onSuggestion?: (reasoning: string) => void;
  greeting?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [slowTimer, setSlowTimer] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(mode !== "stylist");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const greetingText = greeting || DEFAULT_GREETINGS[mode];
  const showExamples = messages.length === 0;

  useEffect(() => {
    if (mode !== "stylist") return;
    let cancelled = false;
    (async () => {
      try {
        const history = await api.stylistMessages();
        if (cancelled) return;
        if (history.length > 0) {
          setMessages(
            history.map((m: StylistMessage) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          );
        }
      } catch {}
      setHistoryLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [mode]);

  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: reduce ? "instant" : "smooth",
    });
  }, [reduce]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setSlowTimer(false);

    const timer = setTimeout(() => setSlowTimer(true), 5000);

    try {
      if (mode === "stylist") {
        const res = await api.stylistAsk(text);
        clearTimeout(timer);
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: res.reply,
          chips: res.chips?.slice(0, 4) ?? undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        onSuggestion?.(res.reply);
      } else {
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const res = await api.shoppingAsk(text, history);
        clearTimeout(timer);
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: res.reply,
          chips: res.chips?.slice(0, 4) ?? undefined,
          searchTriggered: !!res.results,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (res.results && onSearchResults) {
          onSearchResults(res.results);
        }
      }
    } catch {
      clearTimeout(timer);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Something went wrong — tap to retry",
        chips: ["Try again"],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      setSlowTimer(false);
    }
  }

  function handleChip(chip: string) {
    if (chip === "Try again" && messages.length >= 2) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        setMessages((prev) => prev.slice(0, -1));
        setInput(lastUserMsg.content);
        setTimeout(() => inputRef.current?.form?.requestSubmit(), 50);
        return;
      }
    }
    setInput(chip);
    setTimeout(() => inputRef.current?.form?.requestSubmit(), 50);
  }

  if (mode === "stylist" && !historyLoaded) return null;

  return (
    <div className={"flex flex-col " + className}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
      >
        {/* Greeting */}
        <div className="flex justify-start">
          <div className="max-w-md rounded-xl3 px-4 py-2.5 text-sm bg-surface2 text-ink rounded-bl-lg">
            {greetingText}
          </div>
        </div>

        {/* Example prompts */}
        {showExamples && (
          <p className="text-xs text-muted/50 px-1 italic">
            Try: {EXAMPLE_PROMPTS[mode]}
          </p>
        )}

        {/* Messages */}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={"flex " + (msg.role === "user" ? "justify-end" : "justify-start")}
            >
              <div>
                <div
                  className={
                    "max-w-md rounded-xl3 px-4 py-2.5 text-sm " +
                    (msg.role === "user"
                      ? "bg-coral text-white rounded-br-lg"
                      : "bg-surface2 text-ink rounded-bl-lg")
                  }
                >
                  {msg.content}
                  {msg.searchTriggered && (
                    <span className="block mt-1 text-[10px] text-muted">
                      ↓ Results below
                    </span>
                  )}
                </div>
                {/* Chips */}
                {msg.chips && msg.chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.chips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleChip(chip)}
                        className="chip text-xs hover:bg-coralSoft hover:text-coral transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-surface2 rounded-xl3 rounded-bl-lg px-4 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse [animation-delay:300ms]" />
              {slowTimer && (
                <span className="text-xs text-muted ml-2">Still thinking...</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="flex gap-2 px-4 py-3 border-t border-line bg-bg"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your stylist..."
          disabled={sending}
          className="field-sm flex-1"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="btn-primary px-4 py-2 text-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify.** `cd frontend && npx next build` passes.

- [ ] **Step 3: Commit.**

```bash
git add frontend/src/components/StylistChat.tsx
git commit -m "feat(chat): create shared StylistChat component"
```

---

### Task 5: Frontend — Home page rewrite

**Files:**
- Modify: `frontend/src/app/page.tsx` (remove FloatingCard/ChatSheet/QuickReplyChips/chip flow, add StylistChat)
- Delete: `frontend/src/components/ChatSheet.tsx`
- Delete: `frontend/src/components/FloatingCard.tsx`
- Delete: `frontend/src/components/QuickReplyChips.tsx`

**Interfaces:**
- Consumes: `<StylistChat mode="stylist" onSuggestion />` from Task 4.
- Produces: redesigned home page with conversation-first UX in both empty-wardrobe and has-wardrobe states.

- [ ] **Step 1: Rewrite `StylistHome` in `frontend/src/app/page.tsx`.** Remove imports for `FloatingCard`, `QuickReplyChips`, `ChatSheet`. Remove all chip flow state (`flowStage`, `tags`, `OPENER_CHIPS`, `NARROWING_CHIPS`, `activeChips`, `showChips`, `handleChip`). Remove `cardVisible`, `sheetOpen`, `FloatingCard` rendering, `ChatSheet` rendering, the bottom `<form>` for chat input, and the "History" button. Add `StylistChat` import and render it.

The new `StylistHome` function (replace the existing one). Keep all imports, `cap`, `StylistHome` state/effects/handlers that are listed as "Keep unchanged" — specifically: `wardrobe`, `suggestion`, `reasoning`, `messages` (now unused for display but kept for `sendPrompt`), `input` (removed — handled by StylistChat), `sending` (removed), `shuffling`, `loading`, `pickRandom`, `loadData`, `handleShuffle`, `handleTryOn`, both useEffects. Remove `sendPrompt`, `handleSend`, `handleChip`, all chip/flow state.

The full rewritten file top section — replace imports and `StylistHome`:

```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import SilhouettePreview from "@/components/SilhouettePreview";
import StylistChat from "@/components/StylistChat";
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
  const [shuffling, setShuffling] = useState(false);
  const [loading, setLoading] = useState(true);

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
      const items = await api.listWardrobe();
      setWardrobe(items);
      if (items.length >= 2) {
        pickRandom(items);
      }
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
    pickRandom(wardrobe);
    setTimeout(() => setShuffling(false), 500);
  }

  function handleTryOn() {
    if (currentItemIds.length === 0) return;
    router.push(`/studio?items=${currentItemIds.join(",")}`);
  }

  function handleSuggestion(reply: string) {
    setReasoning(reply);
    if (hasWardrobe) pickRandom(wardrobe);
  }

  /* Loading skeleton */
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

  return (
    <main className="min-h-screen bg-bg pb-nav md:pb-0 flex flex-col">
      <Header />

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-5 min-h-0">
        {/* Silhouette zone */}
        <div className="relative min-h-[30vh] sm:min-h-[45vh] flex items-center justify-center pt-4 shrink-0">
          <SilhouettePreview items={suggestion} className={hasWardrobe ? "" : "opacity-60"} />
        </div>

        {/* Action buttons — only when wardrobe has items */}
        {hasWardrobe && (
          <div className="flex items-center justify-center gap-3 py-3 shrink-0">
            <motion.button
              type="button"
              onClick={handleShuffle}
              disabled={shuffling}
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
          </div>
        )}

        {/* Chat */}
        <StylistChat
          mode="stylist"
          onSuggestion={handleSuggestion}
          className="flex-1 min-h-0"
        />
      </div>

      <BottomNav />
    </main>
  );
}
```

Keep the entire `LandingPage` function, `STEPS` constant, and `FEATURES` constant unchanged — copy them from the existing file verbatim (lines 347–479).

- [ ] **Step 2: Delete unused components.**

```bash
rm frontend/src/components/ChatSheet.tsx
rm frontend/src/components/FloatingCard.tsx
rm frontend/src/components/QuickReplyChips.tsx
```

- [ ] **Step 3: Verify.** `cd frontend && npx next build` passes with zero errors. Then `npm run dev` — confirm the home page shows the silhouette + chat, no chip flow, no FloatingCard, no ChatSheet.

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/app/page.tsx
git add -u frontend/src/components/ChatSheet.tsx frontend/src/components/FloatingCard.tsx frontend/src/components/QuickReplyChips.tsx
git commit -m "feat(home): replace chip flow with StylistChat, delete unused components"
```

---

### Task 6: Frontend — Shop page rewrite

**Files:**
- Modify: `frontend/src/app/shop/page.tsx` (replace SearchBar with StylistChat as primary, add Filters toggle)

**Interfaces:**
- Consumes: `<StylistChat mode="shopping" onSearchResults />` from Task 4, existing `SearchBar`, `WindowDisplay`, `ResultCard` components.
- Produces: redesigned shop page with AI chat as primary search interface, manual SearchBar behind a "Filters" toggle.

- [ ] **Step 1: Rewrite `frontend/src/app/shop/page.tsx`.** Keep all existing imports for `WindowDisplay`, `ResultCard`, `SearchBar`, `CurtainReveal`, `SmoothScroll`, `DotLottieReact`, `BUDGET_OPTIONS`, `CATEGORY_OPTIONS`, auth effect, `handleSearch`, `safeHref` (if still in page), GSAP stagger logic. Add `StylistChat` import. Add `showFilters` state. Replace the `SearchBar` default rendering with `StylistChat` + a Filters toggle.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { api, type ShoppingResultItem } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { gsap, useGSAP } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import WindowDisplay from "@/components/shop/WindowDisplay";
import SearchBar from "@/components/shop/SearchBar";
import ResultCard from "@/components/shop/ResultCard";
import StylistChat from "@/components/StylistChat";

const SmoothScroll = dynamic(() => import("@/components/SmoothScroll"), { ssr: false });
const CurtainReveal = dynamic(() => import("@/components/shop/CurtainReveal"), { ssr: false });
const DotLottieReact = dynamic(
  () => import("@lottiefiles/dotlottie-react").then((m) => m.DotLottieReact),
  { ssr: false },
);

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
  const reduce = usePrefersReducedMotion();

  const [query, setQuery] = useState("");
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<ShoppingResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const grid = useRef<HTMLDivElement>(null);

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

  function handleAIResults(aiResults: ShoppingResultItem[]) {
    setResults(aiResults);
    setSearched(true);
  }

  useGSAP(
    () => {
      if (reduce || !grid.current || results.length === 0) return;
      const cards = grid.current.querySelectorAll("[data-result-card]");
      gsap.fromTo(
        cards,
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          ease: "power3.out",
          stagger: 0.06,
          scrollTrigger: { trigger: grid.current, start: "top 80%", once: true },
        },
      );
    },
    { dependencies: [results, reduce], revertOnUpdate: true },
  );

  return (
    <SmoothScroll>
      <main className="min-h-screen bg-bg pb-nav md:pb-0">
        <Header />
        <CurtainReveal />
        <section className="container-app py-6 sm:py-8 max-w-4xl">
          <WindowDisplay items={searched ? results : undefined} />

          {/* Chat + Filters toggle */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="heading-md">Ask your stylist</h2>
              <button
                type="button"
                onClick={() => setShowFilters((o) => !o)}
                className={"chip text-xs " + (showFilters ? "chip-coral" : "")}
              >
                Filters
              </button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden mb-4"
                >
                  <SearchBar
                    query={query}
                    setQuery={setQuery}
                    budgetMax={budgetMax}
                    setBudgetMax={setBudgetMax}
                    category={category}
                    setCategory={setCategory}
                    budgetOptions={BUDGET_OPTIONS}
                    categoryOptions={CATEGORY_OPTIONS}
                    onSubmit={handleSearch}
                    searching={searching}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <StylistChat
              mode="shopping"
              onSearchResults={handleAIResults}
              className="h-[40vh] border border-line rounded-xl3 overflow-hidden"
            />
          </div>

          {/* Results grid */}
          {searching && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card p-0 overflow-hidden">
                  <div className="aspect-[3/4] skeleton" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 w-12 skeleton rounded ml-auto" />
                    <div className="h-3 w-3/4 skeleton rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searching && searched && results.length === 0 && (
            <div className="py-12 grid place-items-center text-center">
              {reduce ? (
                <div className="w-24 h-24 rounded-full bg-surface2 grid place-items-center text-muted">∅</div>
              ) : (
                <div className="w-32 h-32">
                  <DotLottieReact src="/lottie/mannequin.lottie" loop autoplay />
                </div>
              )}
              <p className="text-muted mt-2">Nothing in stock.</p>
            </div>
          )}

          {!searching && results.length > 0 && (
            <div ref={grid} className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
              {results.map((item, i) => (
                <div key={i} data-result-card>
                  <ResultCard item={item} />
                </div>
              ))}
            </div>
          )}
        </section>
        <BottomNav />
      </main>
    </SmoothScroll>
  );
}
```

- [ ] **Step 2: Verify.** `cd frontend && npx next build` passes. Then `npm run dev` — confirm shop page shows WindowDisplay + "Ask your stylist" heading + chat + Filters toggle. Manual search works when Filters is expanded.

- [ ] **Step 3: Commit.**

```bash
git add frontend/src/app/shop/page.tsx
git commit -m "feat(shop): replace default SearchBar with StylistChat, add Filters toggle"
```

---

### Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Clean build.** `cd frontend && npx next build` — must pass with zero TS errors.

- [ ] **Step 2: Backend check.** `cd backend && python -c "from app.main import app; print('OK')"` — must import cleanly.

- [ ] **Step 3: Functional pass (`npm run dev`).** For each page:
  - **Home (no auth):** Landing page renders unchanged.
  - **Home (authed, empty wardrobe):** Silhouette placeholder + StylistChat with greeting + example prompts. No FloatingCard, no "Add clothes"/"Browse shop" forced links. Chat input works.
  - **Home (authed, has wardrobe):** Silhouette with outfit + shuffle/try-on buttons + StylistChat below. No chip flow. Chat sends messages and receives replies. `onSuggestion` updates the silhouette reasoning.
  - **Shop:** Curtain entrance + WindowDisplay + "Ask your stylist" + StylistChat. "Filters" toggle reveals SearchBar. Chat sends messages. When AI returns results, they appear in the grid with stagger animation.

- [ ] **Step 4: Deleted components check.** Confirm `ChatSheet.tsx`, `FloatingCard.tsx`, `QuickReplyChips.tsx` are deleted and no other file imports them. Run: `grep -r "ChatSheet\|FloatingCard\|QuickReplyChips" frontend/src/` — should return nothing.

- [ ] **Step 5: Mobile layout check.** Resize to mobile width: home page silhouette collapses to ~30vh, chat is usable below. Shop page chat is contained in 40vh box, results scroll below.

- [ ] **Step 6: Reduced-motion pass.** Enable OS "reduce motion": no bubble entrance animations, instant scroll, typing indicator still visible.
