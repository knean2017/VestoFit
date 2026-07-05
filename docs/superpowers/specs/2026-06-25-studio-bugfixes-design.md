# Studio & Stylist Bug Fixes — Design Spec

**Date**: 2026-06-25
**Scope**: 6 user-reported bugs in the try-on studio, wardrobe tagging pipeline, and stylist suggestion flow.

---

## Fix 1: Re-run AI Tags Does Not Apply

### Root Cause
`tag_wardrobe_item()` in `wardrobe_tagging_service.py` only re-runs the LLM vision tagger on `image_key` (the original upload). It never re-runs `clean_garment()` to regenerate `clean_image_key`. After retag, tags may update but the background-removed image stays stale or identical to the original.

### Solution
In `tag_wardrobe_item()`, after successful tagging (`tagging_status = "done"`), also:
1. Read the original `image_key` bytes.
2. Call `clean_garment(data)` to produce a fresh background-removed image.
3. Save to a new storage key and update `item.clean_image_key`.

This makes retag = full reprocess (tags + clean image).

### Files Changed
- `backend/app/services/wardrobe_tagging_service.py` — add clean_garment call after successful tag

---

## Fix 2: Background Removal Fails Silently

### Root Cause
`garment_service.py:_clean_sync()` catches both `ImportError` (rembg not installed) and generic `Exception`, returning the original bytes unchanged. No error signal reaches the user. The "cleaned" image is identical to the raw upload.

### Solution
- In `_clean_sync()`: when rembg is not importable, raise a clear `RuntimeError("rembg not installed")` instead of silently returning raw bytes. This will cause the wardrobe item creation to still succeed (clean_image_key just won't be set), but the error surfaces.
- Actually, to avoid breaking uploads: keep the graceful fallback for `create_item` (upload flow), but **log a warning** when rembg fails. The retag flow (Fix 1) will re-attempt clean_garment, giving users a recovery path.
- Verify `rembg` is in `backend/requirements.txt`.

### Files Changed
- `backend/app/services/garment_service.py` — add logging on fallback
- `backend/requirements.txt` — verify rembg dependency

---

## Fix 3: Non-Clothing Uploads Auto-Deleted

### Root Cause
When the LLM returns `{"category": null}` (image is not a clothing item), `tag_wardrobe_item()` sets `tagging_status = "failed"` but the item persists in the wardrobe. Users see a broken item they didn't intend to add.

### Solution

**Backend** (`wardrobe_tagging_service.py`):
- When `result.get("category") is None`:
  1. Delete storage files: `item.image_key` and `item.clean_image_key` (if set).
  2. Delete the item from the database.
  3. Do not commit a "failed" status — the item is gone.

**Frontend** (`wardrobe/page.tsx`):
- Track items currently in `"pending"` tagging state.
- On each poll cycle, compare current pending IDs with the fresh list. If a pending item disappears (was auto-deleted), show a toast: "Removed — that doesn't look like a clothing item."

### Files Changed
- `backend/app/services/wardrobe_tagging_service.py` — delete item + storage on null category
- `frontend/src/app/wardrobe/page.tsx` — track pending items, detect disappearance, show toast

---

## Fix 4: Stylist Outfit Not Appearing on Silhouette

### Root Cause
In `page.tsx` (home), `handleStylistResult()` does:
```ts
const resolved = result.item_ids
  .map((id) => wardrobe.find((w) => w.id === id))
  .filter((w): w is WardrobeItem => !!w);
```

If the local `wardrobe` state is empty (not yet loaded), stale, or if the LLM returns IDs that exist on server but aren't in the local snapshot, `resolved` is empty and stage resets to `"idle"`. The chat shows the text response but the silhouette never updates with the outfit.

### Solution
1. **Guard**: Don't allow sending chat messages until wardrobe is loaded (`loading === false && wardrobe.length > 0`). If wardrobe is empty, show a prompt to add items instead of the chat.
2. **Fallback fetch**: If `resolved` is empty but `result.item_ids.length > 0`, re-fetch wardrobe from the API, then retry the ID matching. This handles stale local state.
3. Keep the current behavior of resetting to "idle" only when the fallback fetch also produces no matches.

### Files Changed
- `frontend/src/app/page.tsx` — add wardrobe re-fetch fallback in handleStylistResult, guard chat on wardrobe loaded

---

## Fix 5: History Renders Not Visible in Big Image

### Root Cause
`ReflectionPanel.tsx` renders `MirrorFlipCard` only when:
```ts
completed && active.garment_url && active.result_url
```

For outfit renders (multi-item try-on), `garment_url` is `null` because the job has no single garment key — it chains multiple garments sequentially. The condition fails and the panel shows the avatar photo instead of the result.

Similarly, for any historical job where garment storage was cleaned up or not set, the result never displays.

### Solution
In `ReflectionPanel.tsx`:
- When `completed && result_url` exists but `garment_url` is null: show `result_url` as a static full-bleed image (no flip card, since there's no single garment to compare against).
- MirrorFlipCard remains for single-garment renders where both URLs exist.

```
if (completed && result_url && garment_url) → MirrorFlipCard (flip between garment and result)
if (completed && result_url && !garment_url) → Static result image (full display)
```

### Files Changed
- `frontend/src/components/studio/ReflectionPanel.tsx` — add static image branch for missing garment_url

---

## Fix 6: Remove URL/Link Try-On from UI

### Root Cause
The "Product link" (URL) mode in the studio doesn't work reliably. The scraper fails on most retail sites, and users get confused by the two-mode interface.

### Solution
**Remove from UI only** (keep backend endpoint for potential future API use):

- `GarmentInput.tsx`: Remove the segmented control (url/upload tabs). Only show the upload dropzone. Remove the URL input field.
- `studio/page.tsx`: Remove `mode` state, `url` state, and the `mode === "url"` branch in `submit()`. The submit function only handles file upload.
- Remove `Mode` type from both files.

### Files Changed
- `frontend/src/components/studio/GarmentInput.tsx` — remove mode tabs, URL input; upload-only
- `frontend/src/app/studio/page.tsx` — remove mode/url state, simplify submit

---

## Out of Scope
- SSE/streaming for real-time job status (future)
- Backend URL endpoint removal (kept for API consumers)
- Wardrobe upload pre-validation with LLM (adds latency, not needed — post-upload tagging handles it)
- Rembg model optimization or alternative background removal services

## Testing Checklist
- [ ] Upload a clothing photo → tags appear, clean image has background removed
- [ ] Re-run AI tags on existing item → tags update, clean image regenerates
- [ ] Upload a non-clothing image (e.g. a cat) → item auto-deletes, toast shown
- [ ] Ask stylist for outfit → outfit appears on silhouette even if wardrobe was loaded slowly
- [ ] Run a try-on → result visible in big image panel
- [ ] Click a history render (especially outfit renders) → result displays in big image
- [ ] Studio page shows upload-only input (no URL/link tab)
- [ ] Existing wardrobe items with valid clean images still display correctly
