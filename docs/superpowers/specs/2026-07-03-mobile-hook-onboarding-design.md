# Mobile Cinematic Hook Onboarding + Design Elevation — Design Spec

**Date:** 2026-07-03
**Target:** `mobile/` (Expo 54, expo-router, Reanimated 4, unistyles v2)
**Approach:** B — Cinematic story intro, chosen over interactive demo and style quiz.

## Goal

First-time mobile users get a cinematic, gesture-driven story hook before auth:
hook (4 slides) → register/login → avatar onboard → tabs. Smooth 60fps motion
throughout. Existing screens elevated: SVG icons replace all emojis, entrance
animations added.

## Existing Design Verdict

Keep the token system (coral/cream palette, dark variants, Nunito, spacing/
radii/shadow scales) — it is coherent and matches web brand. No full redesign.
Fix the MVP-reading surface: emoji icons, missing transitions, plain forms.

## Entry Routing

New `mobile/app/index.tsx` gate, resolved in order:

1. Auth token present (SecureStore via `src/lib/auth.ts`) → `/(tabs)/wardrobe`
2. `hasSeenHook` flag set (AsyncStorage, `src/lib/firstLaunch.ts`) → `/(auth)/login`
3. Otherwise → `/(hook)`

Gate renders brand splash (wordmark on cream) while resolving; no flash of
wrong screen. `router.replace` so back gesture never returns to the gate.

## Hook Flow — `mobile/app/(hook)/`

Horizontal pager built on Reanimated 4 + `GestureDetector` (Pan), NOT a
ScrollView. A shared `progress` value (0..3) drives every slide animation
continuously during the swipe. Spring snap between slides
(`damping 20, stiffness 300` — matches existing Button springs). Haptic
selection tick on each snap.

Chrome: animated progress dots (active dot morphs wider, coral), persistent
"Skip" (top-right, ghost) → marks `hasSeenHook`, goes to `/(auth)/login`.

### Slides

1. **"Your closet. Digital."** — 3 parallax depth layers of coral-tinted SVG
   garment illustrations (ready-made set, licensed; tinted via `react-native-svg`
   fill/stroke props). Layers translate at 0.4×/0.7×/1× of swipe delta.
   Headline + subline stagger in (opacity + translateY).
2. **"Try it on. Before you buy."** — auto-looping crossfade morph between two
   bundled photos: model → try-on result (generated once via existing backend
   studio endpoint, bundled in `assets/demo/`). Slow 3s crossfade loop, paused
   when slide off-screen. Headline words stagger in.
3. **"A stylist who knows you."** — native-rendered chat bubbles spring in
   sequentially when slide becomes active; typing indicator (3 dots, staggered
   scale loop) precedes each bubble. Lucide icons inside bubbles where useful.
4. **"Your turn."** — wordmark settles in (scale + fade spring), primary
   Button "Get started" → `/(auth)/register`, ghost Button
   "I have an account" → `/(auth)/login`. Both mark `hasSeenHook`.

All animation transform/opacity only, worklet-driven. Respect
`AccessibilityInfo.isReduceMotionEnabled`: replace parallax/morph with simple
fades.

## SVG Icon System

- Add `react-native-svg` (via `npx expo install`) + `lucide-react-native`.
- No emoji anywhere in the app after this work.
- Tab bar: lucide icons (`Shirt`, `Sparkles`, `MessageCircle`, `ShoppingBag`,
  `User`), animated coral pill indicator behind active tab (layout-animated
  translateX), icon scale spring on focus.
- Screen headers and empty states: replace emoji glyphs with lucide icons in
  brand colors.

## Elevation Pass

- **Auth screens:** staggered entrance (wordmark → title → fields → button,
  60ms stagger, translateY + fade). Wordmark identical in size/position to
  hook slide 4 so hook → register feels continuous.
- **Avatar onboard `(onboard)/index.tsx`:** replace 📸 with lucide `Camera`
  icon in a coral circle; picker frame gets animated dashed-border treatment
  consistent with hook visual language; entrance stagger.
- **Out of scope:** deeper redesign of tab content screens (wardrobe, studio,
  stylist, shop, profile) — separate effort.

## New Files

| Path | Purpose |
|---|---|
| `mobile/app/index.tsx` | Entry gate |
| `mobile/app/(hook)/_layout.tsx` | Hook stack, no header |
| `mobile/app/(hook)/index.tsx` | Pager orchestration |
| `mobile/src/features/hook/Slide1Closet.tsx` … `Slide4CTA.tsx` | Slides |
| `mobile/src/features/hook/ProgressDots.tsx` | Animated dots |
| `mobile/src/lib/firstLaunch.ts` | AsyncStorage `hasSeenHook` flag |
| `mobile/assets/demo/` | Bundled morph photos + SVG garment illustrations |

Modified: `app/_layout.tsx` (register `(hook)` + index screens),
`app/(tabs)/_layout.tsx` (SVG tab bar), `(auth)/login.tsx`,
`(auth)/register.tsx`, `(onboard)/index.tsx` (elevation), `package.json`.

Backend: untouched. Web frontend: untouched.

## Error Handling

- SecureStore/AsyncStorage read failure in gate → treat as first launch
  (safe default: show hook).
- Missing/failed demo asset → slide renders headline-only, no crash.
- Reduce-motion → simplified fades (see above).

## Testing

- Jest: entry-gate routing logic (token/flag matrix), `firstLaunch` flag
  read/write, hook "Skip"/"Get started" set flag.
- Existing test suite stays green (`npm test` in `mobile/`).
- Manual: Expo run — swipe feel, snap springs, haptics, reduce-motion path,
  dark mode.

## Implementation Notes

- Use `animating-react-native-expo` + `mobile-touch` skills during
  implementation for Reanimated 4 / gesture patterns.
- SVG garment illustrations: ready-made licensed set (no hand-drawn custom
  art), tinted to brand tokens.
