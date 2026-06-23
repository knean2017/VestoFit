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

