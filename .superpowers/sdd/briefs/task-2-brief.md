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

