# Studio & Stylist Bug Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 user-reported bugs: retag not applying, background removal silent failure, non-clothing uploads persisting, stylist suggestions not showing on silhouette, try-on results not visible in big image, and remove URL try-on mode from UI.

**Architecture:** Surgical fixes at each root cause. Backend changes in the tagging pipeline (retag re-runs clean_garment, non-clothing items auto-deleted). Frontend changes in ReflectionPanel (show result without garment_url), home page (wardrobe re-fetch fallback for stylist), GarmentInput (upload-only mode), and wardrobe page (detect auto-deleted items).

**Tech Stack:** Python/FastAPI backend, Next.js 15 / React 19 / TypeScript frontend, Framer Motion animations.

## Global Constraints

- No new dependencies
- No test infrastructure exists; verify manually via dev server
- Backend runs on port 8000, frontend on port 3000
- Keep backend `/tryon/url` endpoint intact (API consumers may use it); only remove from UI

---

### Task 1: Retag Re-runs Background Removal

**Files:**
- Modify: `backend/app/services/wardrobe_tagging_service.py:15-59`

**Interfaces:**
- Consumes: `clean_garment(data: bytes) -> bytes` from `garment_service.py`, `storage.save_bytes(key, data, ct)` and `storage.read_bytes(key)` from storage service
- Produces: Updated `tag_wardrobe_item()` that also regenerates `clean_image_key` on successful tag

- [ ] **Step 1: Add clean_garment import and storage regeneration logic**

Open `backend/app/services/wardrobe_tagging_service.py`. Add imports for `clean_garment` and `uuid`. After the block that sets `item.tagging_status = "done"` (line ~51), add logic to re-run background removal and update `clean_image_key`.

```python
"""Background vision tagging for wardrobe items."""

from __future__ import annotations

import uuid as _uuid

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.wardrobe_item import WardrobeItem
from app.services.garment_service import clean_garment
from app.services.llm_service import LlmError, tag_garment_image
from app.services.storage import get_storage


async def tag_wardrobe_item(item_id: _uuid.UUID) -> None:
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(WardrobeItem).where(WardrobeItem.id == item_id)
        )
        item = res.scalar_one_or_none()
        if not item:
            return

        try:
            storage = get_storage()
            data = await storage.read_bytes(item.image_key)
            ext = item.image_key.rsplit(".", 1)[-1].lower()
            mime = {
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "png": "image/png",
                "webp": "image/webp",
            }.get(ext, "image/jpeg")

            result = await tag_garment_image(data, mime)
            if result.get("category") is None:
                item.tagging_status = "failed"
                item.attributes = result
            else:
                cat = result.get("category")
                if cat in ("tops", "bottoms", "dresses"):
                    item.category = cat
                item.name = result.get("name") or item.name
                item.color = result.get("color")
                item.pattern = result.get("pattern")
                item.formality = result.get("formality")
                item.season = result.get("season")
                warmth = result.get("warmth")
                item.warmth = int(warmth) if warmth is not None else None
                item.attributes = result
                item.tagging_status = "done"

                # Re-run background removal and update clean image
                cleaned = await clean_garment(data)
                clean_key = f"wardrobe/{item.user_id}/{_uuid.uuid4().hex}.png"
                await storage.save_bytes(clean_key, cleaned, "image/png")
                item.clean_image_key = clean_key

        except (LlmError, ValueError, TypeError) as e:
            item.tagging_status = "failed"
            item.attributes = {"error": str(e)[:500]}
        except Exception as e:  # noqa: BLE001
            item.tagging_status = "failed"
            item.attributes = {"error": str(e)[:500]}

        await db.commit()
```

- [ ] **Step 2: Verify backend starts**

Run: `cd backend && python -c "from app.services.wardrobe_tagging_service import tag_wardrobe_item; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Manual test**

1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Open wardrobe page, click an existing item, click "Re-run AI tags"
3. Wait for tagging to complete (3s poll cycle)
4. Verify: tags updated AND clean_image_url changed (check network tab for new image URL)

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/wardrobe_tagging_service.py
git commit -m "fix(retag): re-run background removal when re-tagging wardrobe item"
```

---

### Task 2: Log Warning on Background Removal Fallback

**Files:**
- Modify: `backend/app/services/garment_service.py:58-77`

**Interfaces:**
- Produces: Same `clean_garment(data: bytes) -> bytes` API, now with logging on fallback

- [ ] **Step 1: Add logging to _clean_sync fallback paths**

```python
"""Garment image preprocessing and category inference."""

from __future__ import annotations

import asyncio
import logging
from io import BytesIO

from PIL import Image

logger = logging.getLogger(__name__)

# ... (keep infer_category and keyword dicts unchanged) ...

def _clean_sync(data: bytes) -> bytes:
    try:
        from rembg import remove
    except ImportError:
        logger.warning("rembg not installed — returning original image without background removal")
        return data

    try:
        cut = remove(data)
        img = Image.open(BytesIO(cut)).convert("RGBA")
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        out = BytesIO()
        bg.save(out, format="PNG", optimize=True)
        return out.getvalue()
    except Exception:
        logger.warning("rembg background removal failed — returning original image", exc_info=True)
        return data


async def clean_garment(data: bytes) -> bytes:
    return await asyncio.to_thread(_clean_sync, data)
```

- [ ] **Step 2: Verify import works**

Run: `cd backend && python -c "from app.services.garment_service import clean_garment; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/garment_service.py
git commit -m "fix(garment): log warning when background removal fails instead of silent fallback"
```

---

### Task 3: Auto-Delete Non-Clothing Uploads

**Files:**
- Modify: `backend/app/services/wardrobe_tagging_service.py:15-65` (already modified in Task 1)
- Modify: `frontend/src/app/wardrobe/page.tsx:58-68`

**Interfaces:**
- Consumes: `storage.delete(key)` from storage service
- Produces: Items with `category: null` are deleted from DB and storage; frontend detects disappearance and shows toast

- [ ] **Step 1: Update tag_wardrobe_item to delete non-clothing items**

In `backend/app/services/wardrobe_tagging_service.py` (already modified by Task 1), replace the `category is None` branch. When the LLM returns null category, delete storage files and the DB row instead of marking as failed.

Change this block inside `tag_wardrobe_item` (the one from Task 1's version):

```python
            result = await tag_garment_image(data, mime)
            if result.get("category") is None:
                item.tagging_status = "failed"
                item.attributes = result
```

To:

```python
            result = await tag_garment_image(data, mime)
            if result.get("category") is None:
                # Not a clothing item — delete from storage and DB
                await storage.delete(item.image_key)
                if item.clean_image_key:
                    await storage.delete(item.clean_image_key)
                await db.delete(item)
                await db.commit()
                return
```

- [ ] **Step 2: Verify storage service has delete method**

Run: `cd backend && grep -n "async def delete\|def delete" app/services/storage.py`

If `delete` method doesn't exist, add it to the storage service. Check output and implement accordingly. The method should accept a key string and delete the object from storage (S3 or local).

- [ ] **Step 3: Add pending-item tracking to wardrobe frontend**

In `frontend/src/app/wardrobe/page.tsx`, modify the polling `useEffect` (lines 63-68) to track which items were pending and detect when they disappear (auto-deleted by backend).

Replace the existing polling useEffect:

```tsx
  const pendingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentPending = new Set(
      items.filter((i) => i.tagging_status === "pending").map((i) => i.id)
    );
    pendingIdsRef.current = currentPending;
  }, [items]);

  useEffect(() => {
    const pending = items.some((i) => i.tagging_status === "pending");
    if (!pending) return;
    const t = setInterval(async () => {
      const prevPending = new Set(pendingIdsRef.current);
      await load();
      // After load, check if any pending items disappeared (auto-deleted)
      // We need to check after the state updates, so use a small delay
    }, 3000);
    return () => clearInterval(t);
  }, [items, load]);
```

Actually, a cleaner approach — compare before and after in the load callback:

Replace the polling useEffect (lines 63-68) and modify the `load` function to accept a callback:

```tsx
  const prevPendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pendingIds = items
      .filter((i) => i.tagging_status === "pending")
      .map((i) => i.id);
    prevPendingRef.current = new Set(pendingIds);
  }, [items]);

  useEffect(() => {
    const hasPending = items.some((i) => i.tagging_status === "pending");
    if (!hasPending) return;
    const t = setInterval(async () => {
      const before = new Set(prevPendingRef.current);
      try {
        const params =
          filter === "all"
            ? undefined
            : filter === "favorites"
              ? { favorites_only: true }
              : { category: filter };
        const fresh = await api.listWardrobe(params);
        const freshIds = new Set(fresh.map((i) => i.id));
        for (const id of before) {
          if (!freshIds.has(id)) {
            toast("info", "Removed — that doesn't look like a clothing item");
          }
        }
        setItems(fresh);
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [items, filter, toast]);
```

Also add `useRef` to the imports at line 1 (it's already imported).

- [ ] **Step 4: Verify frontend compiles**

Run: `cd frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: No compilation errors (build may warn about other things, but no errors in wardrobe/page.tsx)

- [ ] **Step 5: Manual test**

1. Start backend and frontend
2. Go to wardrobe page, upload a non-clothing image (e.g. screenshot of text, photo of a cat)
3. Item appears briefly with "AI tagging in progress..."
4. Within 3-10 seconds, item disappears and toast says "Removed — that doesn't look like a clothing item"

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/wardrobe_tagging_service.py frontend/src/app/wardrobe/page.tsx
git commit -m "fix(wardrobe): auto-delete uploads that aren't clothing items"
```

---

### Task 4: Stylist Outfit Appears on Silhouette

**Files:**
- Modify: `frontend/src/app/page.tsx:86-106`

**Interfaces:**
- Consumes: `api.listWardrobe()` from `lib/api.ts`
- Produces: `handleStylistResult` that re-fetches wardrobe when local ID matching fails

- [ ] **Step 1: Add wardrobe re-fetch fallback to handleStylistResult**

In `frontend/src/app/page.tsx`, replace the `handleStylistResult` function (lines 91-106):

```tsx
  async function handleStylistResult(result: { reasoning: string; item_ids: string[]; outfit_id: string; decline: boolean }) {
    if (result.decline || result.item_ids.length === 0) {
      setStage("idle");
      return;
    }

    // Try matching against local wardrobe state first
    let resolved = result.item_ids
      .map((id) => wardrobe.find((w) => w.id === id))
      .filter((w): w is WardrobeItem => !!w);

    // If no matches, wardrobe state may be stale — re-fetch and retry
    if (resolved.length === 0 && result.item_ids.length > 0) {
      try {
        const fresh = await api.listWardrobe();
        setWardrobe(fresh);
        resolved = result.item_ids
          .map((id) => fresh.find((w) => w.id === id))
          .filter((w): w is WardrobeItem => !!w);
      } catch {}
    }

    if (resolved.length === 0) {
      setStage("idle");
      return;
    }
    setSuggestion(resolved);
    setOutfitId(result.outfit_id);
    setStage("dressed");
  }
```

- [ ] **Step 2: Disable chat until wardrobe loads**

In the same file, update the StylistChat rendering (around line 226). Add a guard so users can't send messages before wardrobe is loaded. If wardrobe is empty after loading, show a message to add items.

Replace the StylistChat section:

```tsx
        {/* Chat */}
        {hasWardrobe ? (
          <StylistChat
            mode="stylist"
            onSend={handleSend}
            onStylistResult={handleStylistResult}
            className="flex-1 min-h-0"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center">
              <p className="text-muted text-sm mb-3">Add at least 2 items to your wardrobe to get styled</p>
              <Link href="/wardrobe" className="btn-primary">Open wardrobe</Link>
            </div>
          </div>
        )}
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 4: Manual test**

1. Start both servers, log in with an account that has wardrobe items
2. On home page, ask stylist "give me a casual outfit"
3. Verify: outfit items appear on the silhouette (not stuck on idle)
4. Also test: account with <2 wardrobe items sees "Add at least 2 items" message instead of chat

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "fix(stylist): re-fetch wardrobe when outfit IDs don't match local state"
```

---

### Task 5: History Renders Visible in Big Image

**Files:**
- Modify: `frontend/src/components/studio/ReflectionPanel.tsx:1-70`

**Interfaces:**
- Consumes: `TryOnStatus` type with optional `garment_url` and `result_url`
- Produces: ReflectionPanel that shows result as static image when garment_url is missing

- [ ] **Step 1: Add static result image branch to ReflectionPanel**

Replace the entire `ReflectionPanel.tsx`:

```tsx
"use client";
import type { AvatarResponse, TryOnStatus } from "@/lib/api";
import MirrorFlipCard from "./MirrorFlipCard";

export default function ReflectionPanel({
  avatar,
  active,
}: {
  avatar: AvatarResponse | null;
  active: TryOnStatus | null;
}) {
  const processing =
    active && (active.status === "processing" || active.status === "queued");
  const completed = active && active.status === "completed";
  const failed = active && active.status === "failed";

  return (
    <div className="stage-plate relative aspect-[3/4] rounded-2xl overflow-hidden">
      {completed && active.result_url && active.garment_url ? (
        <MirrorFlipCard garmentUrl={active.garment_url} resultUrl={active.result_url} />
      ) : completed && active.result_url ? (
        /* Outfit render or job without garment — show result directly */
        <div className="relative w-full h-full flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.result_url}
            alt="Your look"
            className="relative z-10 w-full h-full object-contain drop-shadow-lg"
          />
        </div>
      ) : (
        <>
          {avatar?.photo_url ? (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar.photo_url}
                alt="You"
                className="relative z-10 w-[85%] h-[85%] object-contain drop-shadow-lg"
              />
              <div className="contact-shadow z-0" />
              {/* Reflective floor */}
              <div className="hidden sm:block absolute bottom-0 inset-x-0 h-[18%] overflow-hidden opacity-30 scale-y-[-1] pointer-events-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar.photo_url}
                  alt=""
                  className="w-[85%] mx-auto object-contain"
                  style={{ filter: "blur(3px)", maskImage: "linear-gradient(to top, black, transparent)" }}
                />
              </div>
            </div>
          ) : (
            <div className="w-full h-full grid place-items-center text-muted text-sm">
              Your render will appear here
            </div>
          )}
          {processing && (
            <>
              <div className="glass-shimmer" />
              <div className="absolute inset-x-0 bottom-0 z-20">
                <div className="h-[2px] bg-coral/60 animate-pulse" />
                <p className="text-center text-xs text-ink/80 py-2">
                  Rendering your look…
                </p>
              </div>
            </>
          )}
          {failed && (
            <div className="absolute bottom-3 inset-x-3 z-20 bg-surface/90 backdrop-blur rounded-xl px-4 py-3 text-center">
              <p className="text-danger text-sm">
                {active.error || "Render failed. Try again."}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Manual test**

1. Start both servers, go to studio page
2. Run a try-on (upload a garment image) — verify result shows in big panel with flip card
3. Click a history render that was from an outfit (multi-item) — verify result shows as static image (no flip card, just the result)
4. Click a history render from a single garment — verify flip card still works

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/studio/ReflectionPanel.tsx
git commit -m "fix(studio): show result image when garment_url is missing (outfit renders)"
```

---

### Task 6: Remove URL Try-On Mode from UI

**Files:**
- Modify: `frontend/src/components/studio/GarmentInput.tsx:1-115`
- Modify: `frontend/src/app/studio/page.tsx:18-113`

**Interfaces:**
- Produces: GarmentInput accepts only upload props (no mode/url); StudioPage has no url/mode state

- [ ] **Step 1: Simplify GarmentInput to upload-only**

Replace `frontend/src/components/studio/GarmentInput.tsx`:

```tsx
"use client";
import MagneticButton from "@/components/MagneticButton";

export default function GarmentInput({
  description,
  setDescription,
  filePreview,
  fileInput,
  onFile,
  onSubmit,
  submitting,
  canSubmit,
}: {
  description: string;
  setDescription: (v: string) => void;
  filePreview: string | null;
  fileInput: React.RefObject<HTMLInputElement>;
  onFile: (f: File | null) => void;
  onSubmit: () => void;
  submitting: boolean;
  canSubmit: boolean;
}) {
  return (
    <div className="rounded-2xl bg-surface p-5 space-y-5 shadow-soft">
      <div
        onClick={() => fileInput.current?.click()}
        className="border-2 border-dashed border-line rounded-xl p-6 text-center cursor-pointer hover:border-coral transition-colors"
      >
        {filePreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={filePreview}
            alt="preview"
            className="max-h-40 mx-auto object-contain"
          />
        ) : (
          <p className="text-muted text-sm">Tap to upload a garment image</p>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the item (optional)"
        className="field w-full min-h-[72px]"
      />

      <MagneticButton>
        <button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="btn-primary"
        >
          {submitting ? "Rendering…" : "Render"}
        </button>
      </MagneticButton>
      <p className="text-xs text-muted">~15-30 seconds per render</p>
    </div>
  );
}
```

- [ ] **Step 2: Remove mode/url state from StudioPage**

In `frontend/src/app/studio/page.tsx`, remove the `Mode` type, `mode` state, `url` state, and simplify the `submit` function and `GarmentInput` props.

Remove line 18: `type Mode = "url" | "upload";`

Replace lines 37-38:
```tsx
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
```
With nothing (delete these lines).

Replace the `submit` function (lines 97-113):
```tsx
  async function submit() {
    if (!file) return;
    setSubmitting(true);
    try {
      const res = await api.tryOnUpload(file, description || undefined);
      const fresh = await api.jobStatus(res.job_id);
      setActive(fresh);
      toast("info", "Render started — about 15-30 seconds");
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }
```

Replace line 140: `const canSubmit = mode === "url" ? !!url.trim() : !!file;`
With: `const canSubmit = !!file;`

Replace the GarmentInput usage (lines 183-196):
```tsx
              <GarmentInput
                description={description}
                setDescription={setDescription}
                filePreview={filePreview}
                fileInput={fileInput}
                onFile={setFile}
                onSubmit={submit}
                submitting={submitting}
                canSubmit={canSubmit}
              />
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 4: Manual test**

1. Go to studio page
2. Verify: no URL/link tab — only the upload dropzone is visible
3. Upload a garment image, click Render — verify it works as before

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/studio/GarmentInput.tsx frontend/src/app/studio/page.tsx
git commit -m "feat(studio): remove URL try-on mode, upload-only input"
```

---

## Verification Checklist

After all tasks are complete, run through this full checklist:

- [ ] Upload clothing photo to wardrobe → tags appear, clean image has background removed
- [ ] Re-run AI tags on existing item → tags update, clean image regenerates
- [ ] Upload non-clothing image → auto-deletes within seconds, toast shown
- [ ] Ask stylist for outfit on home page → outfit appears on silhouette
- [ ] Ask stylist with freshly loaded page → outfit still appears (re-fetch works)
- [ ] Run single-garment try-on → result visible in big panel with flip card
- [ ] Click outfit render from history → result displays as static image in big panel
- [ ] Studio page shows upload-only (no URL/link tab)
- [ ] Backend logs show warning if rembg fails (check uvicorn output)
