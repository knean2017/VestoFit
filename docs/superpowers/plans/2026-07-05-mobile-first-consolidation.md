# Mobile-First Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Expo app (`mobile/`) fully self-sufficient as the only production surface: commit the load-bearing uncommitted backend code, remove the last flow that depends on the web app existing (password reset), bring the unified AI stylist to mobile, and clean the repository state so `HEAD` alone boots.

**Architecture:** Four thin workstreams. (1) The working tree contains an uncommitted full-outfit try-on implementation (`run_outfit_job` in `tryon_service.py` + `TryOnOutfitRequest` schema) that the *committed* router already imports — test it and commit it, since HEAD is broken without it. (2) Password reset currently emails a link to the web `/reset-password` page; since web never ships, the email gains a paste-able reset code and mobile gets a reset screen calling the existing `POST /auth/reset`. (3) The mobile stylist tab switches from the legacy `stylistAsk` to the unified `POST /stylist/chat`, rendering outfit suggestions and inline shop results the web already has. (4) Repo hygiene: ignore Playwright artifacts, snapshot the long-dirty web/doc files, and mark web as dev-only in `CLAUDE.md`.

**Tech Stack:** FastAPI + pytest (backend), Expo SDK 54 / expo-router typed routes / react-native-unistyles / TanStack Query / RNTL + MSW (mobile). No new dependencies.

## Global Constraints

- **Mobile is the only production surface.** Web (`frontend/`) is dev/demo only — never add features to it in this plan.
- No new npm or pip dependencies.
- Backend tests: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -q` — must stay green (56 tests exist before this plan; each backend task adds more).
- Mobile checks, all from `C:/Users/Envy/Desktop/VTO/mobile`: `npm run typecheck` (clean), `npm run lint` (0 errors; ~17 pre-existing warnings are OK), `npm test` (29 pass before this plan).
- **Typed routes:** after creating any new file under `mobile/app/`, regenerate route types before typechecking: run `npx expo start --offline --port 8090` in background, wait until the new route name appears in `mobile/.expo/types/router.d.ts`, then kill the process listening on port 8090 (`netstat -ano | grep :8090` → `taskkill //F //PID <pid>`).
- Reset-code email line (exact): `Reset code (paste it in the app): {raw}` — the raw token stays in the link too; both stay valid 30 minutes.
- Rate-limit/enumeration behavior of `/auth/forgot` and `/auth/reset` must not change.
- Mobile UI must use unistyles theme tokens (`theme.colors.*`, `theme.spacing.*`) — no hardcoded colors except `#fff` on accent backgrounds.
- Commit after every task; end commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Commit the load-bearing outfit try-on backend

The committed `backend/app/routers/tryon.py` imports `run_outfit_job` and `TryOnOutfitRequest`, but both exist only as uncommitted edits to `backend/app/services/tryon_service.py` and `backend/app/schemas/tryon.py`. A fresh clone of HEAD does not boot. Add tests for the deterministic parts, then commit the working-tree versions as-is.

**Files:**
- Test: `backend/tests/test_outfit_tryon.py` (create)
- Commit (already edited in working tree, do NOT rewrite): `backend/app/services/tryon_service.py`, `backend/app/schemas/tryon.py`

**Interfaces:**
- Consumes: existing working-tree code — `run_outfit_job(job_id: uuid.UUID, item_ids: list[uuid.UUID]) -> None`, `_LAYER_ORDER: dict[str, int]`, `TryOnOutfitRequest(item_ids: list[str])`.
- Produces: nothing new — locks in what `routers/tryon.py` and mobile `api.tryOnOutfit` already call.

- [ ] **Step 1: Write the failing-if-missing test**

`backend/tests/test_outfit_tryon.py`:

```python
import inspect
from types import SimpleNamespace

from app.schemas.tryon import TryOnOutfitRequest
from app.services.tryon_service import _LAYER_ORDER, run_outfit_job


def test_outfit_request_schema_roundtrip():
    req = TryOnOutfitRequest(item_ids=["a", "b"])
    assert req.item_ids == ["a", "b"]


def test_layer_order_bottoms_under_tops_under_dresses():
    assert _LAYER_ORDER["bottoms"] < _LAYER_ORDER["tops"] < _LAYER_ORDER["dresses"]


def test_unknown_category_sorts_last():
    items = [SimpleNamespace(category=c) for c in ("dresses", None, "tops", "bottoms")]
    items.sort(key=lambda w: _LAYER_ORDER.get(w.category, 99))
    assert [i.category for i in items] == ["bottoms", "tops", "dresses", None]


def test_run_outfit_job_is_async():
    assert inspect.iscoroutinefunction(run_outfit_job)
```

- [ ] **Step 2: Run the new tests**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_outfit_tryon.py -v`
Expected: 4 PASSED (the implementation already exists in the working tree — these tests pin it down so it can't be lost again).

- [ ] **Step 3: Full suite**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -q`
Expected: all PASSED.

- [ ] **Step 4: Boot check + commit**

Run: `curl -s http://localhost:8000/health` (stack must be up: `docker compose up -d`)
Expected: `{"status":"ok","db":true}` — uvicorn reloaded with the files that are about to be committed.

```bash
cd C:/Users/Envy/Desktop/VTO
git add backend/app/services/tryon_service.py backend/app/schemas/tryon.py backend/tests/test_outfit_tryon.py
git commit -m "feat(tryon): full-outfit chained rendering (commit load-bearing WIP)

routers/tryon.py at HEAD already imported run_outfit_job and
TryOnOutfitRequest; the implementations lived only in the working
tree. Pin them with tests and commit.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: In-app password reset (kill the web dependency)

The reset email's only action today is a link to the web page `frontend_url/reset-password?token=...`. Web never ships, so: the email additionally presents the token as a paste-able code, and mobile gets `(auth)/reset-password.tsx` where the user pastes it and sets a new password via the existing `POST /auth/reset`.

**Files:**
- Modify: `backend/app/services/password_reset_service.py` (email body only, in `request_reset`)
- Test: `backend/tests/test_password_reset_service.py` (append one test)
- Modify: `mobile/src/lib/api.ts` (add `resetPassword` next to `forgotPassword`)
- Create: `mobile/app/(auth)/reset-password.tsx`
- Modify: `mobile/app/(auth)/forgot-password.tsx` (sent-state gains a "Have a code?" link)

**Interfaces:**
- Consumes: backend `POST /auth/reset` accepting `{ token: string, password: string }` (already deployed; web `api.resetPassword` calls it).
- Produces: `api.resetPassword(token: string, password: string) -> Promise<{ message: string }>`; route `/(auth)/reset-password`.

- [ ] **Step 1: Append the failing backend test**

Append to `backend/tests/test_password_reset_service.py` (matches the file's existing monkeypatch pattern — see `test_request_reset_emails_link_with_token` above it):

```python
async def test_request_reset_email_contains_pasteable_code(monkeypatch):
    user = SimpleNamespace(id=uuid.uuid4(), email="leyla@example.com")

    async def find_user(db, email):
        return user

    bodies = []

    async def fake_send(to, subject, body):
        bodies.append(body)

    monkeypatch.setattr(prs, "_get_user_by_email", find_user)
    monkeypatch.setattr(prs, "_invalidate_tokens", _noop_async())
    import app.services.email_service as email
    monkeypatch.setattr(email, "send_email", fake_send)

    db = FakeDB()
    await request_reset(db, "leyla@example.com")

    assert len(bodies) == 1
    assert "Reset code (paste it in the app):" in bodies[0]
    # the raw token appears both in the link and as the standalone code
    raw = db.added[0]  # PasswordResetToken row
    # we can't read the raw token back (only its hash is stored), so instead
    # assert the code line and the link line share the same trailing token
    code_line = next(l for l in bodies[0].splitlines() if l.startswith("Reset code"))
    link_line = next(l for l in bodies[0].splitlines() if "reset-password?token=" in l)
    assert code_line.rsplit(" ", 1)[-1] == link_line.rsplit("token=", 1)[-1]
```

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_password_reset_service.py -v`
Expected: new test FAILS (`StopIteration` — no "Reset code" line yet).

- [ ] **Step 2: Extend the email body**

In `backend/app/services/password_reset_service.py`, `request_reset`, replace the `send_email` call's body:

```python
    link = f"{get_settings().frontend_url}/reset-password?token={raw}"
    await email_svc.send_email(
        user.email,
        "Reset your FitMe password",
        "Someone (hopefully you) asked to reset your FitMe password.\n\n"
        f"Reset code (paste it in the app): {raw}\n\n"
        f"Or reset in the browser (valid 30 minutes): {link}\n\n"
        "If this wasn't you, ignore this email — your password is unchanged.",
    )
```

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -q`
Expected: all PASSED (the older email test asserts the link is present — it still is).

- [ ] **Step 3: Mobile api method**

In `mobile/src/lib/api.ts`, directly after the `forgotPassword` method:

```typescript
  resetPassword(token: string, password: string) {
    return request<{ message: string }>('/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },
```

- [ ] **Step 4: Reset screen**

Create `mobile/app/(auth)/reset-password.tsx`:

```tsx
import React, { useState } from 'react';
import { Text, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { api } from '../../src/lib/api';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { useToast } from '../../src/components/ui/Toast';

export default function ResetPasswordScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const toast = useToast();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ token?: string; password?: string; confirm?: string }>({});

  const reduced = useReducedMotion();
  const enter = (step: number) =>
    reduced ? undefined : FadeInDown.delay(step * 60).springify().damping(20).stiffness(300);

  function validate() {
    const e: typeof errors = {};
    if (!token.trim()) e.token = 'Paste the code from your email';
    if (password.length < 8) e.password = 'Password must be 8+ characters';
    if (password !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.resetPassword(token.trim(), password);
      toast('success', 'Password updated — sign in with it now');
      router.replace('/(auth)/login');
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Animated.View entering={enter(0)} style={styles.header}>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>Paste the reset code from your email</Text>
        </Animated.View>

        <View style={styles.form}>
          <Animated.View entering={enter(1)}>
            <Input
              label="Reset code"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Paste code"
              error={errors.token}
            />
          </Animated.View>
          <Animated.View entering={enter(2)}>
            <Input
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              secureToggle
              placeholder="8+ characters"
              error={errors.password}
            />
          </Animated.View>
          <Animated.View entering={enter(3)}>
            <Input
              label="Confirm new password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              secureToggle
              returnKeyType="done"
              onSubmitEditing={submit}
              error={errors.confirm}
            />
          </Animated.View>
          <Animated.View entering={enter(4)}>
            <Button label="Reset password" onPress={submit} loading={loading} fullWidth />
          </Animated.View>
          <Animated.View entering={enter(5)}>
            <Text style={styles.foot}>
              <Link href="/(auth)/login" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                ← Back to sign in
              </Link>
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.xl,
  },
  header: { alignItems: 'center', gap: theme.spacing.xs },
  title: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxl,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  form: { gap: theme.spacing.md },
  foot: {
    textAlign: 'center',
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
  },
}));
```

- [ ] **Step 5: Link from the forgot screen's sent state**

In `mobile/app/(auth)/forgot-password.tsx`, inside the `sent` branch, after the `<Card>` block (still inside the same `Animated.View`), add:

```tsx
              <Text style={[styles.foot, { marginTop: 12 }]}>
                <Link
                  href="/(auth)/reset-password"
                  style={{ color: theme.colors.accent, fontWeight: '700' }}
                >
                  Have the code? Reset now →
                </Link>
              </Text>
```

- [ ] **Step 6: Regenerate typed routes, verify, commit**

Regenerate typed routes (see Global Constraints), then:

Run: `cd C:/Users/Envy/Desktop/VTO/mobile && npm run typecheck && npm run lint && npm test`
Expected: typecheck clean, lint 0 errors, 29 tests pass.

```bash
cd C:/Users/Envy/Desktop/VTO
git add backend/app/services/password_reset_service.py backend/tests/test_password_reset_service.py \
        mobile/src/lib/api.ts "mobile/app/(auth)/reset-password.tsx" "mobile/app/(auth)/forgot-password.tsx"
git commit -m "feat(auth): in-app password reset via emailed code

Email now carries the token as a paste-able code; mobile gains a
reset screen. Web link kept for dev use only.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Unified stylist chat on mobile

Swap the mobile stylist tab's send path from legacy `POST /stylist/ask` to the unified `POST /stylist/chat`, and render its per-turn payload: an outfit suggestion card (with one-tap try-on via the existing `api.tryOnOutfit`) and inline shop results. Message history keeps coming from `GET /stylist/messages` (the backend persists chat turns).

**Files:**
- Modify: `mobile/src/lib/api.ts` (add `StylistChatResponse` type + `stylistChat` method)
- Create: `mobile/src/features/stylist/ChatActionCards.tsx`
- Test: `mobile/__tests__/chatActionCards.test.tsx`
- Modify: `mobile/app/(tabs)/stylist.tsx`

**Interfaces:**
- Consumes: backend `POST /stylist/chat` `{ prompt }` → `StylistChatResponse` (schema `backend/app/schemas/stylist.py:55`); existing mobile `ShoppingResultItem` type (`mobile/src/lib/api.ts:100`); `api.tryOnOutfit(item_ids: string[])`; `api.listWardrobe()`.
- Produces: `api.stylistChat(prompt: string) -> Promise<StylistChatResponse>`; components `OutfitSuggestionCard({ itemIds }: { itemIds: string[] })` and `ShopResultsRow({ results, currency }: { results: ShoppingResultItem[]; currency: string })`.

- [ ] **Step 1: API type + method**

In `mobile/src/lib/api.ts`, after the `ShoppingHistoryItem` type block, add:

```typescript
export type StylistChatResponse = {
  reply: string;
  chips: string[] | null;
  outfit_id: string | null;
  outfit_item_ids: string[] | null;
  results: ShoppingResultItem[] | null;
  search_query: string | null;
  currency: string;
  no_local: boolean;
};
```

In the `api` object's `// Stylist` section, before `stylistMessages`:

```typescript
  stylistChat(prompt: string) {
    return request<StylistChatResponse>('/stylist/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },
```

- [ ] **Step 2: Write the failing component test**

Create `mobile/__tests__/chatActionCards.test.tsx` (mock pattern copied from `__tests__/components.test.tsx`):

```tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { mockTheme, mockStyles, makeWrapper } from '../src/__mocks__/testUtils';

jest.mock('react-native-unistyles', () => ({
  useStyles: () => ({ styles: mockStyles, theme: mockTheme }),
  createStyleSheet: (fn: unknown) => fn,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  Link: ({ children }: any) => children,
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});

const mockTryOn = jest.fn().mockResolvedValue({ job_id: 'j1', status: 'queued' });
const mockListWardrobe = jest.fn().mockResolvedValue([
  { id: 'a', category: 'tops', name: 'linen shirt', image_url: 'http://x/a.png', clean_image_url: null },
  { id: 'b', category: 'bottoms', name: 'chinos', image_url: 'http://x/b.png', clean_image_url: null },
]);
jest.mock('../src/lib/api', () => ({
  api: {
    tryOnOutfit: (...a: unknown[]) => mockTryOn(...a),
    listWardrobe: (...a: unknown[]) => mockListWardrobe(...a),
  },
}));

import { OutfitSuggestionCard, ShopResultsRow } from '../src/features/stylist/ChatActionCards';

describe('OutfitSuggestionCard', () => {
  it('shows matched wardrobe items and fires try-on', async () => {
    const { getByText } = render(<OutfitSuggestionCard itemIds={['a', 'b']} />, {
      wrapper: makeWrapper(),
    });
    await waitFor(() => getByText('linen shirt'));
    fireEvent.press(getByText('Try it on'));
    await waitFor(() => expect(mockTryOn).toHaveBeenCalledWith(['a', 'b']));
  });
});

describe('ShopResultsRow', () => {
  it('renders product title, store and price', () => {
    const { getByText } = render(
      <ShopResultsRow
        currency="USD"
        results={[
          {
            title: 'Denim jacket',
            price: 79,
            currency: 'USD',
            image_url: '',
            product_url: 'https://store.example/dj',
            source: 'Example Store',
            category: 'tops',
          },
        ]}
      />,
      { wrapper: makeWrapper() },
    );
    getByText('Denim jacket');
    getByText('Example Store');
    getByText('$79');
  });
});
```

Run: `cd C:/Users/Envy/Desktop/VTO/mobile && npx jest __tests__/chatActionCards.test.tsx`
Expected: FAIL — `Cannot find module '../src/features/stylist/ChatActionCards'`.

- [ ] **Step 3: Implement the cards**

Create `mobile/src/features/stylist/ChatActionCards.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

import { api, type ShoppingResultItem } from '../../lib/api';

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return '';
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : `${currency} `;
  return `${symbol}${price}`;
}

export function OutfitSuggestionCard({ itemIds }: { itemIds: string[] }) {
  const { styles } = useStyles(stylesheet);
  const router = useRouter();

  const { data: wardrobe = [] } = useQuery({
    queryKey: ['wardrobe', 'all'],
    queryFn: () => api.listWardrobe(),
  });
  const items = itemIds
    .map((id) => wardrobe.find((w) => w.id === id))
    .filter((w): w is NonNullable<typeof w> => w != null);

  const tryOn = useMutation({
    mutationFn: () => api.tryOnOutfit(itemIds),
    onSuccess: () => router.push('/(tabs)/studio'),
  });

  if (items.length === 0) return null;

  return (
    <View style={styles.outfitCard}>
      <Text style={styles.cardTitle}>Suggested look</Text>
      <View style={styles.thumbRow}>
        {items.map((item) => (
          <View key={item.id} style={styles.thumbWrap}>
            <Image
              source={{ uri: item.clean_image_url || item.image_url }}
              style={styles.thumb}
              contentFit="contain"
            />
            <Text style={styles.thumbLabel} numberOfLines={1}>
              {item.name || item.category}
            </Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={styles.tryOnBtn}
        onPress={() => tryOn.mutate()}
        disabled={tryOn.isPending}
      >
        <Text style={styles.tryOnBtnText}>{tryOn.isPending ? 'Starting…' : 'Try it on'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ShopResultsRow({
  results,
  currency,
}: {
  results: ShoppingResultItem[];
  currency: string;
}) {
  const { styles } = useStyles(stylesheet);
  if (results.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shopRow}>
      {results.map((r) => (
        <TouchableOpacity
          key={r.product_url}
          style={styles.productCard}
          onPress={() => Linking.openURL(r.product_url)}
        >
          {!!r.image_url && (
            <Image source={{ uri: r.image_url }} style={styles.productImage} contentFit="cover" />
          )}
          <Text style={styles.productTitle} numberOfLines={2}>{r.title}</Text>
          <Text style={styles.productMeta} numberOfLines={1}>{r.source}</Text>
          <Text style={styles.productPrice}>{formatPrice(r.price, r.currency || currency)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  outfitCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thumbRow: { flexDirection: 'row', gap: theme.spacing.sm },
  thumbWrap: { flex: 1, maxWidth: 96, gap: 4 },
  thumb: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.sand,
  },
  thumbLabel: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  tryOnBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.full,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  tryOnBtnText: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.md,
    color: '#fff',
  },
  shopRow: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  productCard: {
    width: 150,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radii.md,
    padding: theme.spacing.xs,
    gap: 4,
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.sand,
  },
  productTitle: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.ink,
  },
  productMeta: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.muted,
  },
  productPrice: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.accent,
  },
}));
```

- [ ] **Step 4: Run the component test**

Run: `cd C:/Users/Envy/Desktop/VTO/mobile && npx jest __tests__/chatActionCards.test.tsx`
Expected: 2 PASSED.

- [ ] **Step 5: Wire the stylist screen**

In `mobile/app/(tabs)/stylist.tsx`:

1. Add imports:

```tsx
import { type StylistChatResponse } from '../../src/lib/api';
import { OutfitSuggestionCard, ShopResultsRow } from '../../src/features/stylist/ChatActionCards';
```

2. Add turn state next to `chips`:

```tsx
  const [turn, setTurn] = useState<StylistChatResponse | null>(null);
```

3. Replace `askMutation` with the unified endpoint:

```tsx
  const askMutation = useMutation({
    mutationFn: (text: string) => api.stylistChat(text),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['stylist-messages'] });
      setChips(res.chips ?? []);
      setTurn(res);
      setPrompt('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
    },
    onError: (e: Error) => toast('error', e.message),
  });
```

4. Render the action cards between the messages area and the Chips block:

```tsx
        {/* Latest turn's action payload */}
        {turn?.outfit_item_ids && turn.outfit_item_ids.length > 0 && (
          <OutfitSuggestionCard itemIds={turn.outfit_item_ids} />
        )}
        {turn?.results && turn.results.length > 0 && (
          <ShopResultsRow results={turn.results} currency={turn.currency} />
        )}
```

5. Clear the turn when a chip is tapped (chips row `onPress` already calls `send(c)`; prepend `setTurn(null);` inside that handler):

```tsx
              <Chip key={c} label={c} onPress={() => { setChips([]); setTurn(null); send(c); }} />
```

- [ ] **Step 6: Full mobile check + commit**

Run: `cd C:/Users/Envy/Desktop/VTO/mobile && npm run typecheck && npm run lint && npm test`
Expected: typecheck clean, lint 0 errors, 31 tests pass (29 + 2 new).

```bash
cd C:/Users/Envy/Desktop/VTO
git add mobile/src/lib/api.ts mobile/src/features/stylist/ChatActionCards.tsx \
        mobile/__tests__/chatActionCards.test.tsx "mobile/app/(tabs)/stylist.tsx"
git commit -m "feat(mobile): unified stylist chat with outfit + shop cards

Switches ask path to POST /stylist/chat; renders per-turn outfit
suggestion (one-tap try-on) and inline shop results.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Repo hygiene — ignore artifacts, snapshot web, mark web dev-only

After Task 1, the remaining dirty tracked files are frontend/doc leftovers that have ridden along uncommitted for days (deleted planning docs, PWA icon/manifest tweaks, studio component edits the running dev site already serves). Web never ships, so snapshot them in one chore commit rather than triaging file-by-file. Also stop `.playwright-mcp/` session artifacts from polluting `git status`, and record the mobile-only decision in `CLAUDE.md`.

**Files:**
- Modify: `.gitignore` (append `.playwright-mcp/`)
- Modify: `CLAUDE.md` (production-surface note)
- Commit: every remaining tracked modification/deletion (`git status --short` after Task 1 shows the list; all under `frontend/`, `docs/`, root `.md` files, and `.superpowers/`)

**Interfaces:** none.

- [ ] **Step 1: Ignore Playwright artifacts**

Append to `.gitignore`:

```
# Playwright MCP session artifacts
.playwright-mcp/
```

- [ ] **Step 2: Mark web as dev-only in CLAUDE.md**

In `CLAUDE.md`, directly under the `# VTO (Virtual Try-On) — VestoFit` heading's intro line, add:

```markdown
**Production surface: the Expo app in `mobile/` only.** The Next.js web app (`frontend/`)
is a dev/demo surface — never ships to production; do not build new features on it.
```

- [ ] **Step 3: Review then snapshot the dirty tree**

Run: `cd C:/Users/Envy/Desktop/VTO && git status --short` and `git diff HEAD --stat`
Expected: only `frontend/`, `docs/`, `.superpowers/`, and root `.md`/png files remain (backend files were committed in Task 1). If any `backend/` or `mobile/` file is still dirty, STOP — it belongs to an earlier task, do not fold it in here.

```bash
cd C:/Users/Envy/Desktop/VTO
git add -A
git commit -m "chore: snapshot long-dirty web/doc working tree; ignore .playwright-mcp

Web is dev-only (never ships) — commits the drifted frontend files
the dev server already serves, removes superseded planning docs,
and records the mobile-only production decision in CLAUDE.md.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Confirm clean tree**

Run: `git status --short`
Expected: empty output.

---

### Task 5: Live verification

**Files:** none.

- [ ] **Step 1: Backend suite + boot**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -q` → all PASSED.
Run: `curl -s http://localhost:8000/health` → `{"status":"ok","db":true}`.

- [ ] **Step 2: Reset-code email end-to-end (console backend)**

```bash
curl -s -X POST http://localhost:8000/auth/forgot -H "Content-Type: application/json" \
  -d '{"email": "activation.verify.0705@gmail.com"}'
docker logs vto-backend-1 --tail 25
```

Expected: 202 response; backend log shows the email body with the `Reset code (paste it in the app): <token>` line. Then exercise the reset API the way the mobile screen will:

```bash
curl -s -X POST http://localhost:8000/auth/reset -H "Content-Type: application/json" \
  -d '{"token": "<token from log>", "password": "newpass1234"}'
```

Expected: 200 with a success message. Login with the new password returns a token:

```bash
curl -s -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" \
  -d '{"email": "activation.verify.0705@gmail.com", "password": "newpass1234"}'
```

- [ ] **Step 3: Unified chat smoke via API**

With the same login token:

```bash
curl -s -X POST http://localhost:8000/stylist/chat -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" -d '{"prompt": "find me a denim jacket under $80"}'
```

Expected: JSON with `reply`, and (Gemini willing) `results` or a clarifying question with `chips`. This is the exact payload the new mobile cards render.

- [ ] **Step 4: Mobile static checks**

Run: `cd C:/Users/Envy/Desktop/VTO/mobile && npm run typecheck && npm run lint && npm test`
Expected: clean / 0 errors / 31 pass.

On-device visual QA of the three new mobile surfaces (reset screen, outfit card, shop row) stays with the owner — note it in the completion report, do not block on it.

- [ ] **Step 5: Commit fixes if any**

```bash
git add -A backend mobile
git commit -m "fix: follow-ups from mobile-first consolidation live verification

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Coverage vs. request:** "completely separate mobile from web" → Task 2 removes the only production flow that needed the web app (reset link) and Task 4 codifies web-as-dev-only; "leftovers" → Task 1 commits the load-bearing dirty backend (HEAD currently doesn't boot without it — highest priority), Task 4 clears the rest of the dirty tree; "things we had in the plan/backlog" → Task 3 ports the unified stylist (the biggest web-only feature); onboarding review minors M1/M2 were verified already fixed in the current code and are deliberately excluded.
- **Deliberate cuts:** email deep links (`vestofit://reset?token=`) — paste-a-code works without app-store/universal-link setup, revisit at store submission; removing `frontend/` or legacy `/stylist/ask` endpoints — web still serves as the dev/demo surface and the old endpoints keep old app builds working; server-driven outfit thumbnails in chat history (per-turn card is ephemeral by design, matching web).
- **Type consistency check:** `StylistChatResponse` fields mirror `backend/app/schemas/stylist.py:55-63` exactly (incl. `currency: string` default and `no_local: boolean`); `OutfitSuggestionCard` consumes `outfit_item_ids: string[]` (null-guarded at the call site); `api.resetPassword(token, password)` matches web's proven call shape against `POST /auth/reset`.
- **Placeholder scan:** all steps carry full code or exact commands; the only judgment step (Task 4 Step 3) has an explicit STOP guard instead of a vague instruction.
