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

