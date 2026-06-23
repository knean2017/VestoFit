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

