# Mobile Cinematic Hook Onboarding + Design Elevation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-time mobile users get a 4-slide cinematic, gesture-driven story hook before auth (hook → register/login → avatar onboard → tabs), and the app's emoji-based surface is elevated to SVG icons with entrance/transition animations.

**Architecture:** A new `app/index.tsx` entry gate routes by auth token + AsyncStorage first-launch flag. The hook is a Reanimated 4 `GestureDetector` pan pager (NOT a ScrollView) where one shared `progress` value (0..3) drives all slide animations continuously. Slides live in `src/features/hook/`. Icons come from `lucide-react-native` over `react-native-svg`. Existing auth/onboard screens get staggered entrance animations; the tab bar becomes a custom animated component.

**Tech Stack:** Expo SDK 54, expo-router (typed routes), React Native 0.81, Reanimated ~4.1, react-native-gesture-handler ~2.28, react-native-unistyles v2 (`createStyleSheet`/`useStyles` API — NOT v3), expo-haptics, expo-image, AsyncStorage, jest-expo + @testing-library/react-native + MSW.

**Spec:** `docs/superpowers/specs/2026-07-03-mobile-hook-onboarding-design.md`

## Global Constraints

- All work in `mobile/`. Run npm/jest/tsc commands from `mobile/`. Git commands from repo root are fine.
- Springs everywhere use `{ damping: 20, stiffness: 300 }` (matches existing `Button`).
- Animations: transform/opacity only (exceptions allowed: progress-dot width, tab pill width — tiny views, no layout thrash).
- No emoji glyphs anywhere in the app when done.
- unistyles v2 API only: `createStyleSheet((theme) => ({...}))` + `useStyles(stylesheet)`. Do NOT use unistyles v3 `StyleSheet.create`.
- Respect reduce-motion: `useReducedMotion()` from `react-native-reanimated`; autonomous loops/springs degrade to static or plain fades.
- Existing tests must stay green: `npm test` in `mobile/`.
- Typecheck must stay green: `npm run typecheck` in `mobile/`.
- Typed routes: `experiments.typedRoutes` is on. New route strings (`/(hook)`) may not be in generated types until the dev server regenerates them — where tsc complains on a brand-new route string, cast `as never` (existing precedent: `src/lib/api.ts` navigationRef call) and leave a comment.
- Commit message style: `feat(mobile): ...` / `fix(mobile): ...` + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- During implementation, consult the `animating-react-native-expo` and `mobile-touch` skills for Reanimated 4 / gesture idioms.

## File Structure

| Path | Responsibility |
|---|---|
| `mobile/app/index.tsx` | Entry gate: splash + route resolution |
| `mobile/src/lib/entryRoute.ts` | Pure routing decision function |
| `mobile/src/lib/firstLaunch.ts` | AsyncStorage `hasSeenHook` flag |
| `mobile/app/(hook)/_layout.tsx` | Hook stack layout (no header) |
| `mobile/app/(hook)/index.tsx` | Pager orchestration: gesture, snapping, chrome |
| `mobile/src/features/hook/types.ts` | `SlideProps` shared type |
| `mobile/src/features/hook/useActiveSlide.ts` | Hook: is slide N currently snapped |
| `mobile/src/features/hook/ProgressDots.tsx` | Animated progress dots |
| `mobile/src/features/hook/Slide1Closet.tsx` | Slide 1: parallax SVG garments |
| `mobile/src/features/hook/Slide2TryOn.tsx` | Slide 2: photo crossfade morph |
| `mobile/src/features/hook/Slide3Stylist.tsx` | Slide 3: chat bubbles |
| `mobile/src/features/hook/Slide4CTA.tsx` | Slide 4: wordmark + CTAs |
| `mobile/src/components/ui/TabBar.tsx` | Custom animated SVG tab bar |
| `mobile/assets/demo/` | Bundled morph images + README |
| Modified: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(auth)/login.tsx`, `app/(auth)/register.tsx`, `app/(onboard)/index.tsx`, `jest.config.js`, `package.json` | |

---

### Task 1: Dependencies — react-native-svg + lucide-react-native

**Files:**
- Modify: `mobile/package.json` (via install commands)
- Modify: `mobile/jest.config.js` (transformIgnorePatterns)

**Interfaces:**
- Produces: `lucide-react-native` icon components (e.g. `import { Shirt } from 'lucide-react-native'`) usable in all later tasks.

- [ ] **Step 1: Install with Expo-compatible versions**

Run in `mobile/`:
```bash
npx expo install react-native-svg
npm install lucide-react-native
```
Expected: both added to `package.json` dependencies; `expo install` picks the SDK-54-compatible `react-native-svg`.

- [ ] **Step 2: Allow both packages through the jest transform**

In `mobile/jest.config.js`, inside the `transformIgnorePatterns` string, change the line:
```
      'react-native-gesture-handler|react-native-screens|' +
```
to:
```
      'react-native-gesture-handler|react-native-screens|' +
      'react-native-svg|lucide-react-native|' +
```

- [ ] **Step 3: Verify nothing broke**

Run in `mobile/`:
```bash
npm run typecheck && npm test
```
Expected: 0 type errors; existing suites pass (api, components, env_check).

- [ ] **Step 4: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/jest.config.js
git commit -m "feat(mobile): add react-native-svg + lucide-react-native

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: firstLaunch flag library (TDD)

**Files:**
- Create: `mobile/src/lib/firstLaunch.ts`
- Test: `mobile/__tests__/firstLaunch.test.ts`

**Interfaces:**
- Produces:
  - `hasSeenHook(): Promise<boolean>` — `false` on any storage error (safe default = show hook).
  - `markHookSeen(): Promise<void>` — never throws.
  - Storage key literal: `'vestofit.hasSeenHook'`, value `'1'`.

- [ ] **Step 1: Write the failing test**

`mobile/__tests__/firstLaunch.test.ts`:
```ts
/**
 * firstLaunch flag — AsyncStorage-backed, error-safe.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasSeenHook, markHookSeen } from '../src/lib/firstLaunch';

describe('firstLaunch', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  test('defaults to false on fresh install', async () => {
    expect(await hasSeenHook()).toBe(false);
  });

  test('true after markHookSeen', async () => {
    await markHookSeen();
    expect(await hasSeenHook()).toBe(true);
  });

  test('storage read failure -> false (safe default: show hook)', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    expect(await hasSeenHook()).toBe(false);
  });

  test('storage write failure does not throw', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'));
    await expect(markHookSeen()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `mobile/`: `npx jest __tests__/firstLaunch.test.ts`
Expected: FAIL — cannot find module `../src/lib/firstLaunch`.

- [ ] **Step 3: Implement**

`mobile/src/lib/firstLaunch.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vestofit.hasSeenHook';

/** False on any storage error — safe default is to show the hook. */
export async function hasSeenHook(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markHookSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Non-fatal: worst case the user sees the hook again next launch.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run in `mobile/`: `npx jest __tests__/firstLaunch.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/firstLaunch.ts mobile/__tests__/firstLaunch.test.ts
git commit -m "feat(mobile): first-launch hasSeenHook flag

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Entry gate — pure route resolver + `app/index.tsx` (TDD)

**Files:**
- Create: `mobile/src/lib/entryRoute.ts`
- Create: `mobile/app/index.tsx`
- Create: `mobile/app/(hook)/_layout.tsx`
- Create: `mobile/app/(hook)/index.tsx` (placeholder, fleshed out in Task 4)
- Modify: `mobile/app/_layout.tsx:27-30` (register `index` + `(hook)` screens)
- Test: `mobile/__tests__/entryRoute.test.ts`

**Interfaces:**
- Consumes: `getToken()` from `src/lib/auth.ts` (returns `string | null`), `hasSeenHook()` from Task 2.
- Produces:
  - `type EntryRoute = '/(tabs)/wardrobe' | '/(auth)/login' | '/(hook)'`
  - `resolveEntryRoute(token: string | null, seenHook: boolean): EntryRoute`

- [ ] **Step 1: Write the failing test**

`mobile/__tests__/entryRoute.test.ts`:
```ts
import { resolveEntryRoute } from '../src/lib/entryRoute';

describe('resolveEntryRoute', () => {
  test('token present -> tabs (regardless of flag)', () => {
    expect(resolveEntryRoute('tok', false)).toBe('/(tabs)/wardrobe');
    expect(resolveEntryRoute('tok', true)).toBe('/(tabs)/wardrobe');
  });

  test('no token, hook already seen -> login', () => {
    expect(resolveEntryRoute(null, true)).toBe('/(auth)/login');
  });

  test('no token, first launch -> hook', () => {
    expect(resolveEntryRoute(null, false)).toBe('/(hook)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `mobile/`: `npx jest __tests__/entryRoute.test.ts`
Expected: FAIL — cannot find module `../src/lib/entryRoute`.

- [ ] **Step 3: Implement resolver**

`mobile/src/lib/entryRoute.ts`:
```ts
export type EntryRoute = '/(tabs)/wardrobe' | '/(auth)/login' | '/(hook)';

/** Entry decision: token wins, then first-launch flag. */
export function resolveEntryRoute(token: string | null, seenHook: boolean): EntryRoute {
  if (token) return '/(tabs)/wardrobe';
  if (seenHook) return '/(auth)/login';
  return '/(hook)';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run in `mobile/`: `npx jest __tests__/entryRoute.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Create the gate screen**

`mobile/app/index.tsx`:
```tsx
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

import { getToken } from '../src/lib/auth';
import { hasSeenHook } from '../src/lib/firstLaunch';
import { resolveEntryRoute } from '../src/lib/entryRoute';

/**
 * Entry gate. Shows the brand splash while resolving where to send the user.
 * router.replace so the back gesture never returns here.
 */
export default function EntryGate() {
  const { styles } = useStyles(stylesheet);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, seen] = await Promise.all([getToken(), hasSeenHook()]);
      if (cancelled) return;
      // Cast: typed routes regenerate on next `expo start`; '/(hook)' is new.
      router.replace(resolveEntryRoute(token, seen) as never);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.wordmark}>VestoFit</Text>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.display,
    color: theme.colors.accent,
    letterSpacing: -1,
  },
}));
```

- [ ] **Step 6: Create hook route placeholders**

`mobile/app/(hook)/_layout.tsx`:
```tsx
import React from 'react';
import { Stack } from 'expo-router';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

export default function HookLayout() {
  const { theme } = useStyles(stylesheet);
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}

const stylesheet = createStyleSheet(() => ({}));
```

`mobile/app/(hook)/index.tsx` (placeholder — replaced entirely in Task 4):
```tsx
import React from 'react';
import { View } from 'react-native';

export default function HookScreen() {
  return <View style={{ flex: 1 }} />;
}
```

- [ ] **Step 7: Register the new screens in the root stack**

In `mobile/app/_layout.tsx`, change:
```tsx
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
```
to:
```tsx
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(hook)" />
              <Stack.Screen name="(auth)" />
```

- [ ] **Step 8: Verify**

Run in `mobile/`:
```bash
npm run typecheck && npm test
```
Expected: 0 type errors, all suites pass. (If tsc rejects the route string despite the cast, re-check the cast in Step 5 is present.)

- [ ] **Step 9: Commit**

```bash
git add mobile/src/lib/entryRoute.ts mobile/app/index.tsx "mobile/app/(hook)" mobile/app/_layout.tsx mobile/__tests__/entryRoute.test.ts
git commit -m "feat(mobile): entry gate with hook/login/tabs routing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Hook pager — gesture pager, progress dots, skip, slide shells

**Files:**
- Create: `mobile/src/features/hook/types.ts`
- Create: `mobile/src/features/hook/useActiveSlide.ts`
- Create: `mobile/src/features/hook/ProgressDots.tsx`
- Create: `mobile/src/features/hook/Slide1Closet.tsx` (shell — content in Task 5)
- Create: `mobile/src/features/hook/Slide2TryOn.tsx` (shell — content in Task 6)
- Create: `mobile/src/features/hook/Slide3Stylist.tsx` (shell — content in Task 7)
- Create: `mobile/src/features/hook/Slide4CTA.tsx` (shell — content in Task 8)
- Modify: `mobile/app/(hook)/index.tsx` (replace placeholder entirely)
- Test: `mobile/__tests__/hook.test.tsx`

**Interfaces:**
- Consumes: `markHookSeen()` (Task 2).
- Produces:
  - `SlideProps = { progress: SharedValue<number>; index: number }` — every slide receives exactly this.
  - `useActiveSlide(progress: SharedValue<number>, index: number): boolean` — true while the pager is snapped to that slide.
  - `ProgressDots({ progress, count }: { progress: SharedValue<number>; count: number })`.
  - Pager constants: `SLIDE_COUNT = 4`, spring `{ damping: 20, stiffness: 300 }`.
  - Skip button has `testID="hook-skip"`.

- [ ] **Step 1: Shared types + active-slide hook**

`mobile/src/features/hook/types.ts`:
```ts
import type { SharedValue } from 'react-native-reanimated';

export type SlideProps = {
  /** Pager position, 0..3, fractional mid-swipe. Drives all slide animation. */
  progress: SharedValue<number>;
  /** This slide's own index. */
  index: number;
};
```

`mobile/src/features/hook/useActiveSlide.ts`:
```ts
import { useState } from 'react';
import { runOnJS, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';

/** React state that is true while the pager is snapped to slide `index`. */
export function useActiveSlide(progress: SharedValue<number>, index: number): boolean {
  const [active, setActive] = useState(index === 0);
  useAnimatedReaction(
    () => Math.round(progress.value) === index,
    (isActive, prev) => {
      if (isActive !== prev) runOnJS(setActive)(isActive);
    },
  );
  return active;
}
```

- [ ] **Step 2: ProgressDots**

`mobile/src/features/hook/ProgressDots.tsx`:
```tsx
import React from 'react';
import { View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

function Dot({ progress, index }: { progress: SharedValue<number>; index: number }) {
  const { styles } = useStyles(stylesheet);
  const style = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - index);
    return {
      width: interpolate(d, [0, 1], [24, 8], Extrapolation.CLAMP),
      opacity: interpolate(d, [0, 1], [1, 0.35], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

export function ProgressDots({
  progress,
  count,
}: {
  progress: SharedValue<number>;
  count: number;
}) {
  const { styles } = useStyles(stylesheet);
  return (
    <View style={styles.row} accessibilityLabel="Onboarding progress">
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} progress={progress} index={i} />
      ))}
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  row: { flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'center' },
  dot: {
    height: 8,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.accent,
  },
}));
```

- [ ] **Step 3: Slide shells (headline only — later tasks replace file contents)**

`mobile/src/features/hook/Slide1Closet.tsx`:
```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import type { SlideProps } from './types';

export function Slide1Closet(_props: SlideProps) {
  const { styles } = useStyles(stylesheet);
  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Your closet. Digital.</Text>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  headline: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxxl,
    color: theme.colors.ink,
    textAlign: 'center',
  },
}));
```

Create `Slide2TryOn.tsx`, `Slide3Stylist.tsx`, `Slide4CTA.tsx` identically, changing only the component name and headline text:
- `Slide2TryOn` → `Try it on. Before you buy.`
- `Slide3Stylist` → `A stylist who knows you.`
- `Slide4CTA` → `Your turn.`

- [ ] **Step 4: The pager (replace `mobile/app/(hook)/index.tsx` entirely)**

```tsx
import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

import { markHookSeen } from '../../src/lib/firstLaunch';
import { ProgressDots } from '../../src/features/hook/ProgressDots';
import { Slide1Closet } from '../../src/features/hook/Slide1Closet';
import { Slide2TryOn } from '../../src/features/hook/Slide2TryOn';
import { Slide3Stylist } from '../../src/features/hook/Slide3Stylist';
import { Slide4CTA } from '../../src/features/hook/Slide4CTA';

const SLIDE_COUNT = 4;
const SPRING = { damping: 20, stiffness: 300 };
const SLIDES = [Slide1Closet, Slide2TryOn, Slide3Stylist, Slide4CTA];

/** One slide pane, absolutely positioned, translated by pager progress. */
function SlidePane({
  progress,
  index,
  width,
  children,
}: {
  progress: SharedValue<number>;
  index: number;
  width: number;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (index - progress.value) * width }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width }, style]}>
      {children}
    </Animated.View>
  );
}

export default function HookScreen() {
  const { styles } = useStyles(stylesheet);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const progress = useSharedValue(0);
  const startProgress = useSharedValue(0);

  function snapTick() {
    Haptics.selectionAsync();
  }

  async function skip() {
    await markHookSeen();
    router.replace('/(auth)/login');
  }

  const pan = Gesture.Pan()
    .onStart(() => {
      startProgress.value = progress.value;
    })
    .onUpdate((e) => {
      const raw = startProgress.value - e.translationX / width;
      // Soft overscroll of 0.15 slide at each edge.
      progress.value = Math.min(Math.max(raw, -0.15), SLIDE_COUNT - 1 + 0.15);
    })
    .onEnd((e) => {
      const fling = -e.velocityX / width;
      const target = Math.round(progress.value + fling * 0.2);
      const clamped = Math.min(Math.max(target, 0), SLIDE_COUNT - 1);
      progress.value = withSpring(clamped, SPRING);
      runOnJS(snapTick)();
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.container}>
        {SLIDES.map((Slide, i) => (
          <SlidePane key={i} progress={progress} index={i} width={width}>
            <Slide progress={progress} index={i} />
          </SlidePane>
        ))}

        <Pressable
          testID="hook-skip"
          onPress={skip}
          style={[styles.skip, { top: insets.top + 12 }]}
          hitSlop={12}
        >
          <Text style={styles.skipLabel}>Skip</Text>
        </Pressable>

        <View style={[styles.dots, { bottom: insets.bottom + 24 }]}>
          <ProgressDots progress={progress} count={SLIDE_COUNT} />
        </View>
      </View>
    </GestureDetector>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  },
  skip: {
    position: 'absolute',
    right: theme.spacing.lg,
    zIndex: 10,
    paddingVertical: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.sm,
  },
  skipLabel: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
  },
  dots: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
  },
}));
```

- [ ] **Step 5: Write the hook screen test**

`mobile/__tests__/hook.test.tsx`:
```tsx
/**
 * Hook pager — renders all slides, Skip marks flag and routes to login.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { mockTheme, mockStyles } from '../src/__mocks__/testUtils';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-unistyles', () => ({
  useStyles: () => ({ styles: mockStyles, theme: mockTheme }),
  createStyleSheet: (fn: unknown) => fn,
  UnistylesRegistry: { addThemes: jest.fn().mockReturnThis(), addConfig: jest.fn() },
}));

const replace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  Link: ({ children }: any) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Chainable Gesture.Pan stub; GestureDetector renders children directly.
jest.mock('react-native-gesture-handler', () => {
  const chain: any = {};
  for (const k of ['onStart', 'onUpdate', 'onEnd']) chain[k] = () => chain;
  return {
    Gesture: { Pan: () => chain },
    GestureDetector: ({ children }: any) => children,
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('expo-image', () => ({ Image: () => null }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import HookScreen from '../app/(hook)/index';

describe('HookScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    replace.mockClear();
  });

  test('renders all four slide headlines', () => {
    const { getByText } = render(<HookScreen />);
    getByText('Your closet. Digital.');
    getByText('Try it on. Before you buy.');
    getByText('A stylist who knows you.');
    getByText('Your turn.');
  });

  test('Skip marks hasSeenHook and replaces to login', async () => {
    const { getByTestId } = render(<HookScreen />);
    fireEvent.press(getByTestId('hook-skip'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/(auth)/login'));
    expect(await AsyncStorage.getItem('vestofit.hasSeenHook')).toBe('1');
  });
});
```

- [ ] **Step 6: Run the new test**

Run in `mobile/`: `npx jest __tests__/hook.test.tsx`
Expected: 2 passing. (If reanimated errors surface under jest, add `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))` at the top of this test file and re-run — but only if the real module fails; `components.test.tsx` already exercises reanimated-based `Button` without mocking it.)

- [ ] **Step 7: Full verification**

Run in `mobile/`: `npm run typecheck && npm test`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add "mobile/app/(hook)" mobile/src/features/hook mobile/__tests__/hook.test.tsx
git commit -m "feat(mobile): gesture-driven hook pager with progress dots and skip

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Slide 1 — "Your closet. Digital." parallax SVG garments

**Files:**
- Modify: `mobile/src/features/hook/Slide1Closet.tsx` (replace entirely)

**Interfaces:**
- Consumes: `SlideProps` (Task 4), lucide icons (Task 1).
- Produces: nothing new — same `Slide1Closet(props: SlideProps)` export.

- [ ] **Step 1: Implement the slide (replace file contents)**

```tsx
import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { Shirt, ShoppingBag, Glasses, Footprints, Watch } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { SlideProps } from './types';

/** Garment scatter: icon, position (fraction of slide), size, layer depth factor. */
const GARMENTS: {
  Icon: LucideIcon;
  x: number;
  y: number;
  size: number;
  factor: number;
  rotate: string;
}[] = [
  { Icon: Shirt, x: 0.12, y: 0.16, size: 96, factor: 0.4, rotate: '-12deg' },
  { Icon: ShoppingBag, x: 0.68, y: 0.12, size: 72, factor: 0.7, rotate: '8deg' },
  { Icon: Glasses, x: 0.72, y: 0.62, size: 64, factor: 0.4, rotate: '-6deg' },
  { Icon: Footprints, x: 0.1, y: 0.66, size: 80, factor: 1.0, rotate: '10deg' },
  { Icon: Watch, x: 0.44, y: 0.08, size: 56, factor: 1.0, rotate: '-4deg' },
];

function ParallaxGarment({
  progress,
  index,
  item,
  width,
  height,
  reduced,
}: {
  progress: SharedValue<number>;
  index: number;
  item: (typeof GARMENTS)[number];
  width: number;
  height: number;
  reduced: boolean;
}) {
  const { theme } = useStyles(stylesheet);
  const style = useAnimatedStyle(() => {
    // Pane already moves at 1x; add relative offset so net speed = factor.
    const extra = reduced ? 0 : (index - progress.value) * width * (item.factor - 1);
    return { transform: [{ translateX: extra }, { rotate: item.rotate }] };
  });
  const { Icon } = item;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: item.x * width, top: item.y * height, opacity: 0.55 },
        style,
      ]}
    >
      <Icon size={item.size} color={theme.colors.accentLight} strokeWidth={1.4} />
    </Animated.View>
  );
}

export function Slide1Closet({ progress, index }: SlideProps) {
  const { styles } = useStyles(stylesheet);
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  const textStyle = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - index);
    return {
      opacity: interpolate(d, [0, 0.6, 1], [1, 0.3, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: reduced ? 0 : interpolate(d, [0, 1], [0, 32], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <View style={styles.container}>
      {GARMENTS.map((item, i) => (
        <ParallaxGarment
          key={i}
          progress={progress}
          index={index}
          item={item}
          width={width}
          height={height}
          reduced={reduced}
        />
      ))}
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.headline}>Your closet. Digital.</Text>
        <Text style={styles.subline}>
          Every piece you own, photographed once, organized forever.
        </Text>
      </Animated.View>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  textBlock: { alignItems: 'center', gap: theme.spacing.sm },
  headline: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxxl,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  subline: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
}));
```

- [ ] **Step 2: Verify**

Run in `mobile/`: `npm run typecheck && npx jest __tests__/hook.test.tsx`
Expected: green — the headline text is unchanged so the render test still passes.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/features/hook/Slide1Closet.tsx
git commit -m "feat(mobile): hook slide 1 parallax SVG garment layers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Slide 2 — try-on crossfade morph + demo assets

**Files:**
- Create: `mobile/assets/demo/morph-before.png`, `mobile/assets/demo/morph-after.png`, `mobile/assets/demo/README.md`
- Modify: `mobile/src/features/hook/Slide2TryOn.tsx` (replace entirely)

**Interfaces:**
- Consumes: `SlideProps`, `useActiveSlide` (Task 4).
- Produces: same `Slide2TryOn(props: SlideProps)` export.

- [ ] **Step 1: Bundle interim demo images**

Run from repo root (Git Bash):
```bash
mkdir -p mobile/assets/demo
cp wardrobe.png mobile/assets/demo/morph-before.png
cp studio.png mobile/assets/demo/morph-after.png
```

`mobile/assets/demo/README.md`:
```md
# Demo assets for hook slide 2

`morph-before.png` / `morph-after.png` are INTERIM placeholders (app
screenshots). Before release, replace with a real pair generated via the
backend try-on studio: a model photo (before) and its try-on result (after),
same dimensions, portrait 3:4. Keep the filenames.
```

- [ ] **Step 2: Implement the slide (replace file contents)**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import type { SlideProps } from './types';
import { useActiveSlide } from './useActiveSlide';

const BEFORE = require('../../../assets/demo/morph-before.png');
const AFTER = require('../../../assets/demo/morph-after.png');

export function Slide2TryOn({ progress, index }: SlideProps) {
  const { styles } = useStyles(stylesheet);
  const reduced = useReducedMotion();
  const active = useActiveSlide(progress, index);
  const [imageFailed, setImageFailed] = useState(false);

  // 0 = before visible, 1 = after visible. Loops while slide is active.
  const fade = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (active && !reduced) {
      fade.value = withRepeat(withTiming(1, { duration: 3000 }), -1, true);
    } else {
      cancelAnimation(fade);
      if (reduced) fade.value = 1; // static "after" image
    }
    return () => cancelAnimation(fade);
  }, [active, reduced, fade]);

  const afterStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const textStyle = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - index);
    return { opacity: interpolate(d, [0, 0.6, 1], [1, 0.3, 0], Extrapolation.CLAMP) };
  });

  return (
    <View style={styles.container}>
      {!imageFailed && (
        <View style={styles.frame}>
          <Image
            source={BEFORE}
            style={styles.photo}
            contentFit="cover"
            onError={() => setImageFailed(true)}
          />
          <Animated.View style={[styles.photoOverlay, afterStyle]}>
            <Image
              source={AFTER}
              style={styles.photo}
              contentFit="cover"
              onError={() => setImageFailed(true)}
            />
          </Animated.View>
        </View>
      )}
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.headline}>Try it on. Before you buy.</Text>
        <Text style={styles.subline}>
          AI renders any garment on your own photo in seconds.
        </Text>
      </Animated.View>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  frame: {
    width: 220,
    height: 293, // 3:4
    borderRadius: theme.radii.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.sand,
    ...theme.shadows.lifted,
  },
  photo: { width: '100%', height: '100%' },
  photoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  textBlock: { alignItems: 'center', gap: theme.spacing.sm },
  headline: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxxl,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  subline: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
}));
```

- [ ] **Step 3: Verify**

Run in `mobile/`: `npm run typecheck && npx jest __tests__/hook.test.tsx`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add mobile/assets/demo mobile/src/features/hook/Slide2TryOn.tsx
git commit -m "feat(mobile): hook slide 2 try-on crossfade morph

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Slide 3 — stylist chat bubbles

**Files:**
- Modify: `mobile/src/features/hook/Slide3Stylist.tsx` (replace entirely)

**Interfaces:**
- Consumes: `SlideProps`, `useActiveSlide`.
- Produces: same `Slide3Stylist(props: SlideProps)` export.

- [ ] **Step 1: Implement the slide (replace file contents)**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { Sparkles } from 'lucide-react-native';
import type { SlideProps } from './types';
import { useActiveSlide } from './useActiveSlide';

const CHAT: { role: 'user' | 'stylist'; text: string }[] = [
  { role: 'user', text: 'Dinner date tonight. What do I wear?' },
  { role: 'stylist', text: 'Your black slip dress + the cropped denim jacket. Rain later — flats, not heels.' },
  { role: 'user', text: 'Show me on me.' },
];

function TypingDot({ delay, reduced }: { delay: number; reduced: boolean }) {
  const { styles } = useStyles(stylesheet);
  const t = useSharedValue(0.4);
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 400 }), -1, true));
    return () => cancelAnimation(t);
  }, [delay, reduced, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value }));
  return <Animated.View style={[styles.typingDot, style]} />;
}

export function Slide3Stylist({ progress, index }: SlideProps) {
  const { styles, theme } = useStyles(stylesheet);
  const reduced = useReducedMotion();
  const active = useActiveSlide(progress, index);
  const [shown, setShown] = useState(false);

  // Bubbles animate in the first time the slide becomes active, then stay.
  useEffect(() => {
    if (active) setShown(true);
  }, [active]);

  const textStyle = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - index);
    return { opacity: interpolate(d, [0, 0.6, 1], [1, 0.3, 0], Extrapolation.CLAMP) };
  });

  const enter = (i: number) =>
    reduced ? FadeIn.duration(150) : FadeInDown.delay(200 + i * 350).springify().damping(20).stiffness(300);

  return (
    <View style={styles.container}>
      <View style={styles.chat}>
        {shown &&
          CHAT.map((msg, i) => (
            <Animated.View
              key={i}
              entering={enter(i)}
              style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.stylistBubble]}
            >
              {msg.role === 'stylist' && (
                <Sparkles size={14} color={theme.colors.accent} strokeWidth={2} />
              )}
              <Text style={[styles.bubbleText, msg.role === 'user' && styles.userText]}>
                {msg.text}
              </Text>
            </Animated.View>
          ))}
        {shown && (
          <Animated.View entering={enter(CHAT.length)} style={[styles.bubble, styles.stylistBubble]}>
            <TypingDot delay={0} reduced={reduced} />
            <TypingDot delay={130} reduced={reduced} />
            <TypingDot delay={260} reduced={reduced} />
          </Animated.View>
        )}
      </View>
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.headline}>A stylist who knows you.</Text>
        <Text style={styles.subline}>
          Outfit advice from your actual wardrobe, weather included.
        </Text>
      </Animated.View>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  chat: { gap: theme.spacing.sm },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    maxWidth: '85%',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    ...theme.shadows.soft,
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: theme.colors.accent },
  stylistBubble: { alignSelf: 'flex-start', backgroundColor: theme.colors.surface },
  bubbleText: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.ink,
    flexShrink: 1,
  },
  userText: { color: theme.colors.white },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.muted,
  },
  textBlock: { alignItems: 'center', gap: theme.spacing.sm },
  headline: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxxl,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  subline: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
}));
```

- [ ] **Step 2: Verify**

Run in `mobile/`: `npm run typecheck && npx jest __tests__/hook.test.tsx`
Expected: green. Note: slide 3's bubbles render because `useActiveSlide` initializes `active` true only for index 0 — the headline is what the test asserts, and it renders unconditionally.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/features/hook/Slide3Stylist.tsx
git commit -m "feat(mobile): hook slide 3 stylist chat bubbles

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Slide 4 — CTA

**Files:**
- Modify: `mobile/src/features/hook/Slide4CTA.tsx` (replace entirely)

**Interfaces:**
- Consumes: `SlideProps`, `useActiveSlide`, `markHookSeen`, existing `Button` (`src/components/ui/Button.tsx`: props `label`, `onPress`, `variant`, `fullWidth`).
- Produces: same `Slide4CTA(props: SlideProps)` export. Both CTAs call `markHookSeen()` before navigating.

- [ ] **Step 1: Implement the slide (replace file contents)**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import type { SlideProps } from './types';
import { useActiveSlide } from './useActiveSlide';
import { markHookSeen } from '../../lib/firstLaunch';
import { Button } from '../../components/ui/Button';

export function Slide4CTA({ progress, index }: SlideProps) {
  const { styles } = useStyles(stylesheet);
  const router = useRouter();
  const reduced = useReducedMotion();
  const active = useActiveSlide(progress, index);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (active) setShown(true);
  }, [active]);

  async function go(route: '/(auth)/register' | '/(auth)/login') {
    await markHookSeen();
    router.replace(route);
  }

  const enter = (i: number) =>
    reduced ? FadeIn.duration(150) : ZoomIn.delay(i * 120).springify().damping(20).stiffness(300);

  return (
    <View style={styles.container}>
      {shown && (
        <>
          <Animated.View entering={enter(0)} style={styles.textBlock}>
            <Text style={styles.wordmark}>VestoFit</Text>
            <Text style={styles.headline}>Your turn.</Text>
            <Text style={styles.subline}>
              One photo. Your whole wardrobe, styled and rendered on you.
            </Text>
          </Animated.View>
          <Animated.View entering={enter(1)} style={styles.actions}>
            <Button label="Get started" onPress={() => go('/(auth)/register')} fullWidth />
            <Button
              label="I have an account"
              variant="ghost"
              onPress={() => go('/(auth)/login')}
              fullWidth
            />
          </Animated.View>
        </>
      )}
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.xxl,
  },
  textBlock: { alignItems: 'center', gap: theme.spacing.sm },
  wordmark: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.display,
    color: theme.colors.accent,
    letterSpacing: -1,
  },
  headline: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxxl,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  subline: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: { gap: theme.spacing.sm },
}));
```

- [ ] **Step 2: Update the hook test — slide 4 content is now gated behind `shown`**

In `mobile/__tests__/hook.test.tsx`, the "renders all four slide headlines" test asserts `Your turn.` — slide 4 only renders content when active (index 3, initial active state is false). Change that assertion block to:
```tsx
  test('renders slide headlines', () => {
    const { getByText, queryByText } = render(<HookScreen />);
    getByText('Your closet. Digital.');
    getByText('Try it on. Before you buy.');
    getByText('A stylist who knows you.');
    // Slide 4 content mounts only once the pager reaches it.
    expect(queryByText('Your turn.')).toBeNull();
  });
```

- [ ] **Step 3: Verify**

Run in `mobile/`: `npm run typecheck && npx jest __tests__/hook.test.tsx`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/features/hook/Slide4CTA.tsx mobile/__tests__/hook.test.tsx
git commit -m "feat(mobile): hook slide 4 CTA with register/login gates

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Animated SVG tab bar

**Files:**
- Create: `mobile/src/components/ui/TabBar.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx` (replace entirely)

**Interfaces:**
- Consumes: lucide icons, `BottomTabBarProps` type from `@react-navigation/bottom-tabs` (transitive dep of expo-router — type-only import).
- Produces: `TabBar(props: BottomTabBarProps)` — passed to `<Tabs tabBar={...}>`. Icon map keyed by route name: wardrobe→Shirt, studio→Sparkles, stylist→MessageCircle, shop→ShoppingBag, profile→User.

- [ ] **Step 1: Create the tab bar component**

`mobile/src/components/ui/TabBar.tsx`:
```tsx
import React from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { MessageCircle, Shirt, ShoppingBag, Sparkles, User } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

const ICONS: Record<string, LucideIcon> = {
  wardrobe: Shirt,
  studio: Sparkles,
  stylist: MessageCircle,
  shop: ShoppingBag,
  profile: User,
};

const SPRING = { damping: 20, stiffness: 300 };

function TabIcon({ Icon, focused, color }: { Icon: LucideIcon; focused: boolean; color: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1.12 : 1, SPRING) }],
  }));
  return (
    <Animated.View style={style}>
      <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
    </Animated.View>
  );
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { styles, theme } = useStyles(stylesheet);
  const insets = useSafeAreaInsets();
  const tabWidth = useSharedValue(0);

  function onLayout(e: LayoutChangeEvent) {
    tabWidth.value = e.nativeEvent.layout.width / state.routes.length;
  }

  const pillStyle = useAnimatedStyle(() => ({
    width: Math.max(tabWidth.value - 24, 0),
    transform: [{ translateX: withSpring(state.index * tabWidth.value + 12, SPRING) }],
  }));

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}
      onLayout={onLayout}
    >
      <Animated.View style={[styles.pill, pillStyle]} />
      {state.routes.map((route, i) => {
        const { options } = descriptors[route.key];
        const focused = state.index === i;
        const Icon = ICONS[route.name] ?? User;
        const label = options.title ?? route.name;

        function onPress() {
          Haptics.selectionAsync();
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            style={styles.tab}
          >
            <TabIcon
              Icon={Icon}
              focused={focused}
              color={focused ? theme.colors.tabActive : theme.colors.tabInactive}
            />
            <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  bar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: theme.colors.tabBarBorder,
    paddingTop: 8,
  },
  pill: {
    position: 'absolute',
    top: 6,
    height: 52,
    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.accent,
    opacity: 0.12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  label: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.semibold,
    fontSize: 10,
    color: theme.colors.tabInactive,
  },
  labelActive: { color: theme.colors.tabActive },
}));
```

- [ ] **Step 2: Wire it into the tabs layout (replace `mobile/app/(tabs)/_layout.tsx` entirely)**

```tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '../../src/components/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="wardrobe" options={{ title: 'Wardrobe' }} />
      <Tabs.Screen name="studio" options={{ title: 'Studio' }} />
      <Tabs.Screen name="stylist" options={{ title: 'Stylist' }} />
      <Tabs.Screen name="shop" options={{ title: 'Shop' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
```

- [ ] **Step 3: Verify**

Run in `mobile/`: `npm run typecheck && npm test`
Expected: green. (If `@react-navigation/bottom-tabs` types are not resolvable, `npm install --save-dev @react-navigation/bottom-tabs` pinned to the version already in `node_modules` from expo-router, and re-run.)

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/ui/TabBar.tsx "mobile/app/(tabs)/_layout.tsx"
git commit -m "feat(mobile): animated SVG tab bar with pill indicator

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Auth screens — staggered entrance

**Files:**
- Modify: `mobile/app/(auth)/login.tsx`
- Modify: `mobile/app/(auth)/register.tsx`

**Interfaces:**
- Consumes: nothing new. Behavior (validation, submit, routes) unchanged — `components.test.tsx` login tests must stay green.

- [ ] **Step 1: login.tsx — add entrance stagger**

Add imports at the top of `mobile/app/(auth)/login.tsx`:
```tsx
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
```

Inside `LoginScreen`, after `const [errors, setErrors] = ...`, add:
```tsx
  const reduced = useReducedMotion();
  const enter = (step: number) =>
    reduced ? undefined : FadeInDown.delay(step * 60).springify().damping(20).stiffness(300);
```

Replace the two content `View`s in the JSX (`styles.header` and `styles.form` wrappers) with staggered `Animated.View`s — full replacement of the ScrollView children:
```tsx
        <Animated.View entering={enter(0)} style={styles.header}>
          <Text style={styles.wordmark}>VestoFit</Text>
          <Text style={styles.tagline}>Your AI fashion studio</Text>
        </Animated.View>

        <View style={styles.form}>
          <Animated.View entering={enter(1)}>
            <Text style={styles.title}>Welcome back</Text>
          </Animated.View>

          <Animated.View entering={enter(2)}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@example.com"
              error={errors.email}
            />
          </Animated.View>
          <Animated.View entering={enter(3)}>
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              secureToggle
              placeholder="••••••••"
              returnKeyType="done"
              onSubmitEditing={submit}
              error={errors.password}
            />
          </Animated.View>

          <Animated.View entering={enter(4)}>
            <Button label="Sign in" onPress={submit} loading={loading} fullWidth />
          </Animated.View>

          <Animated.View entering={enter(5)}>
            <Text style={styles.foot}>
              Don&apos;t have an account?{' '}
              <Link href="/(auth)/register" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                Sign up
              </Link>
            </Text>
          </Animated.View>
        </View>
```

- [ ] **Step 2: register.tsx — same pattern**

Apply the identical imports and `enter` helper to `mobile/app/(auth)/register.tsx`. Wrap: header → `enter(0)`, title → `enter(1)`, Email Input → `enter(2)`, Password Input → `enter(3)`, Confirm Input → `enter(4)`, Button → `enter(5)`, foot text → `enter(6)`. JSX contents of each block stay exactly as they are today.

- [ ] **Step 3: Verify**

Run in `mobile/`: `npm run typecheck && npm test`
Expected: green — login validation tests in `components.test.tsx` still pass (structure changed, behavior didn't).

- [ ] **Step 4: Commit**

```bash
git add "mobile/app/(auth)/login.tsx" "mobile/app/(auth)/register.tsx"
git commit -m "feat(mobile): staggered entrance animations on auth screens

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Avatar onboard screen — SVG icon + entrance polish

**Files:**
- Modify: `mobile/app/(onboard)/index.tsx`

**Interfaces:**
- Consumes: lucide `Camera`, `Plus` icons. Upload flow (`pickPhoto`/`upload`/routes) unchanged.

- [ ] **Step 1: Replace emoji header with SVG icon + add entrance stagger**

In `mobile/app/(onboard)/index.tsx`:

Add imports:
```tsx
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Camera, Plus } from 'lucide-react-native';
```

Inside the component add:
```tsx
  const reduced = useReducedMotion();
  const enter = (step: number) =>
    reduced ? undefined : FadeInDown.delay(step * 60).springify().damping(20).stiffness(300);
```

Replace the `textBlock` View (the one containing `<Text style={styles.emoji}>📸</Text>`):
```tsx
      <Animated.View entering={enter(0)} style={styles.textBlock}>
        <View style={styles.iconCircle}>
          <Camera size={28} color={theme.colors.white} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>Add your photo</Text>
        <Text style={styles.sub}>
          We use your photo to create a digital avatar for virtual try-ons. Use a clear, well-lit photo in fitted clothing.
        </Text>
      </Animated.View>
```
(Note: destructure `theme` from `useStyles` — the component currently only takes `styles`; change to `const { styles, theme } = useStyles(stylesheet);`.)

Wrap the picker and actions:
```tsx
      <Animated.View entering={enter(1)}>
        <TouchableOpacity style={styles.picker} onPress={pickPhoto} activeOpacity={0.8}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Plus size={36} color={theme.colors.muted} strokeWidth={1.6} />
              <Text style={styles.placeholderText}>Tap to choose photo</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={enter(2)} style={styles.actions}>
        {/* existing Buttons unchanged */}
      </Animated.View>
```

In the stylesheet: delete the `emoji` and `placeholderIcon` entries; add:
```tsx
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
```
Also change `picker` to add `alignSelf: 'center'` if removed by the wrap (keep it on the TouchableOpacity's style — it is already there; the wrapping Animated.View needs `alignItems: 'center'` via inline `style={{ alignItems: 'center' }}` OR keep `alignSelf` working by giving the wrapper full width — simplest: `<Animated.View entering={enter(1)} style={{ alignItems: 'center' }}>`).

- [ ] **Step 2: Confirm no emoji remain anywhere**

Run from repo root:
```bash
grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" mobile/app mobile/src --include="*.tsx" --include="*.ts"
```
Expected: no matches. Fix any stragglers found (replace with a lucide icon in brand colors).

- [ ] **Step 3: Verify**

Run in `mobile/`: `npm run typecheck && npm test`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add "mobile/app/(onboard)/index.tsx"
git commit -m "feat(mobile): onboard screen SVG icons + entrance stagger, drop emojis

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Final verification + manual QA

**Files:** none (verification only; fix regressions in place).

- [ ] **Step 1: Full automated pass**

Run in `mobile/`:
```bash
npm run typecheck && npm run lint && npm test
```
Expected: all green. Fix anything red before proceeding.

- [ ] **Step 2: Manual QA on device/simulator**

Run in `mobile/`: `npm start`, open in Expo Go / dev build. Checklist:
- Fresh install (or clear AsyncStorage via reinstall): app opens → hook slide 1.
- Swipe through all 4 slides: parallax on slide 1, morph loop on slide 2, bubbles animate on slide 3, CTA appears on slide 4. Haptic tick per snap. Dots track position.
- Skip → login; relaunch → login directly (no hook).
- "Get started" → register → avatar onboard → tabs.
- "I have an account" → login → tabs.
- Logged-in relaunch → straight to tabs (splash only, no flash of hook/login).
- Tab bar: SVG icons, pill slides between tabs with spring, haptic on tab press.
- Dark mode (device setting): hook, auth, onboard, tab bar all legible.
- Reduce motion (device accessibility setting): no parallax, no auto-loops; plain fades only.
- No emoji visible anywhere.

- [ ] **Step 3: Record deviations**

If manual QA reveals fixes, commit them as `fix(mobile): ...` with the standard trailer.
