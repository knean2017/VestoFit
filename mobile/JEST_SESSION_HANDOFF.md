# Jest Session Handoff — VestoFit Mobile

## Goal
Get `npm test` passing for `__tests__/api.test.ts` (6 tests).

## Status
- `tsc --noEmit` → 0 errors ✅
- `npm install` works ✅
- Jest: **FAILING** — root cause identified, fix ready to apply

---

## Root Cause (fully traced)

### The Error Chain

```
TypeError: Super expression must either be null or a function
  at _inherits
  at expo/src/winter/fetch/FetchResponse.ts:141   ← class FetchResponse extends Response — but Response is undefined
  at expo/src/winter/fetch/fetch.ts
  at expo/src/winter/fetch/index.ts
  at expo/src/winter/runtime.native.ts:52          ← lazy getter factory runs
  at expo/src/winter/installGlobal.ts:56           ← lazy getter triggered
  at src/__mocks__/setupExpoGlobals.js:56          ← THIS triggers it (transpiled line 56)
```

### Why It Happens

**jest-expo preset `setupFiles` run BEFORE user config `setupFiles`.**  
Order:
1. `react-native/jest/setup.js`
2. `jest-expo/src/preset/setup.js` — **line 308: `require('expo/src/winter')`**
   - This loads `expo/src/winter/index.ts` → `runtime.native.ts`
   - `runtime.native.ts` calls `install('fetch', () => require('./fetch').fetch)`
   - This installs a **lazy getter** on `global.fetch` (= `window.fetch` because jest-expo line 19 sets `window = global`)
3. **My `setupExpoGlobals.js`** — by now the lazy getter is already on `global.fetch`
   - My code tries to read `globalThis.fetch` (to save it as the new value)
   - Reading `globalThis.fetch` **triggers the lazy getter**
   - Getter loads expo's fetch chain → `FetchResponse extends Response`
   - `Response` is not defined in Jest's Node environment → crash

### Why `Response` Is Undefined
The test environment is `react-native/jest/react-native-env.js` which is `jest-environment-node` (NOT jsdom). Node.js does have `Response` globally, but Jest's vm context doesn't expose it. React Native's own setup is supposed to polyfill it, but expo's `runtime.native.ts` loads too early (before InitializeCore polyfills run).

---

## The Fix (ONE change needed)

**In `jest.config.js` `moduleNameMapper`, add:**
```js
'^expo/src/winter$': '<rootDir>/src/__mocks__/emptyModule.js',
```

This intercepts `jest-expo`'s `require('expo/src/winter')` at setup line 308 and returns an empty object. The lazy fetch getter is **never installed**. After this:
- `globalThis.fetch` = Node.js native fetch (safe to read)
- MSW can intercept fetch calls normally
- `api.ts` fetch calls work

### Full Updated `jest.config.js`
```js
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/src/__mocks__/setupExpoGlobals.js'],
  setupFilesAfterEnv: ['<rootDir>/src/__mocks__/setupFetchAfterPreset.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      'expo|expo-router|expo-modules-core|expo-modules-jsi|expo-secure-store|expo-haptics|' +
      'expo-image-picker|expo-constants|expo-web-browser|expo-location|' +
      'expo-notifications|expo-font|expo-status-bar|expo-application|' +
      '@expo|@unimodules|' +
      'react-native|@react-native|react-native-reanimated|' +
      'react-native-gesture-handler|react-native-screens|' +
      'react-native-safe-area-context|react-native-unistyles|' +
      '@lodev09/react-native-true-sheet|' +
      '@tanstack' +
    ')/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock expo's winter runtime — prevents lazy fetch getter from being installed.
    // jest-expo setup.js line 308 does require('expo/src/winter') which installs a
    // lazy global.fetch getter that crashes (Response undefined) in Jest Node env.
    '^expo/src/winter$': '<rootDir>/src/__mocks__/emptyModule.js',
    // jest-expo@53 references paths that moved in expo-modules-core@57
    '^expo-modules-core/src/Refs$': '<rootDir>/node_modules/expo-modules-core/src/Refs',
    '^expo-modules-core/src/web/(.*)$': '<rootDir>/src/__mocks__/emptyModule.js',
    '^expo-modules-core/src/uuid/uuid.web$': '<rootDir>/src/__mocks__/emptyModule.js',
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.[tj]s?(x)', '<rootDir>/src/**/*.test.[tj]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
```

---

## Current State of All Mock Files

### `src/__mocks__/setupExpoGlobals.js`
Runs first in setupFiles. Polyfills `globalThis.expo` for expo-modules-core@57.
The fetch-replacement block (lines 26-41) may or may not be needed after the fix.
**After applying the fix**, simplify it to just:

```js
class FakeEventEmitter {
  addListener() { return { remove: () => {} }; }
  removeAllListeners() {}
  emit() {}
}
class FakeNativeModule extends FakeEventEmitter {}
class FakeSharedObject {}

if (!globalThis.expo) {
  globalThis.expo = {
    EventEmitter: FakeEventEmitter,
    NativeModule: FakeNativeModule,
    SharedObject: FakeSharedObject,
    modules: {},
    uuidv4: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }),
    uuidv5: () => '00000000-0000-5000-8000-000000000000',
  };
}
```

### `src/__mocks__/emptyModule.js`
Stubs paths that don't exist in expo-modules-core@57 AND now also `expo/src/winter`.
```js
const v4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.random() * 16 | 0;
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});
const v5 = () => '00000000-0000-5000-8000-000000000000';

module.exports = { default: { v4, v5 }, v4, v5 };
```

### `src/__mocks__/setupFetchAfterPreset.js`
Runs in setupFilesAfterEnv. After the fix, verify it doesn't trigger any getter:
```js
if (typeof window !== 'undefined') {
  const fetchDesc = Object.getOwnPropertyDescriptor(window, 'fetch');
  if (fetchDesc && typeof fetchDesc.get === 'function') {
    // Still a getter? Replace with Node.js fetch.
    // (Should not happen if expo/src/winter is mocked to empty.)
    const nativeFetch = Function('return this')().fetch; // access from outer scope without getter
    Object.defineProperty(window, 'fetch', {
      configurable: true, enumerable: true, writable: true,
      value: nativeFetch,
    });
  }
}
```

---

## If Tests Still Fail After The Fix

Possible next errors and solutions:

### Error: `Cannot find module 'expo/virtual/streams'`
jest-expo setup.js line 312 requires `expo/virtual/streams`. Add to moduleNameMapper:
```js
'^expo/virtual/(.*)$': '<rootDir>/src/__mocks__/emptyModule.js',
```

### Error: `window is not defined` in api.ts
In the Node test env, `window` doesn't exist. `api.ts` likely calls global `fetch`. 
If `fetch` is still undefined, set it explicitly in `setupExpoGlobals.js`:
```js
if (typeof globalThis.fetch !== 'function') {
  // In Node 22, fetch is built-in but might need to be propagated
  globalThis.fetch = require('node-fetch') || globalThis.fetch;
}
```

### Error: `TextEncoder is not defined`
Add to `setupExpoGlobals.js`:
```js
const { TextEncoder, TextDecoder } = require('util');
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder;
```

### Error: something about `expo-modules-core/src/Refs` or uuid
Already handled by moduleNameMapper. If a new path appears, add it to:
```js
'^expo-modules-core/src/WHATEVER$': '<rootDir>/src/__mocks__/emptyModule.js',
```

---

## Key Architecture Facts (for next session)

| Fact | Detail |
|------|--------|
| Test environment | `jest-environment-node` (NOT jsdom) — `window` starts undefined |
| jest-expo sets `window = global` | Line 19 of `jest-expo/src/preset/setup.js` |
| Setup file order | Preset's setupFiles FIRST, then user's setupFiles |
| expo/src/winter installs lazy `global.fetch` | Via `installGlobal.ts`'s `defineLazyObjectProperty` |
| jest-expo line 308 triggers it | `require('expo/src/winter')` in preset setup |
| jest-expo@53 + expo-modules-core@57 compat | Factory at lines 220-291 is LAZY — runs when test code first requires `expo-modules-core` |
| `globalThis.expo` must exist before factory runs | Already handled by `setupExpoGlobals.js` |

---

## Files to Mention in New Session

Tell the AI to read these files:
1. `mobile/jest.config.js` — the config being fixed
2. `mobile/src/__mocks__/setupExpoGlobals.js` — first setupFile
3. `mobile/src/__mocks__/emptyModule.js` — stub for missing paths
4. `mobile/src/__mocks__/setupFetchAfterPreset.js` — setupFilesAfterEnv
5. `mobile/__tests__/api.test.ts` — the test file (don't modify this)
6. `mobile/node_modules/jest-expo/src/preset/setup.js` lines 299-313 — the root cause location

**Key line to show**: `node_modules/jest-expo/src/preset/setup.js:308` does `require('expo/src/winter')` which installs expo's lazy fetch getter that crashes in Jest.

---

## After Tests Pass

Remaining tasks:
1. `npm run lint` (ESLint)
2. Delete `__tests__/env_check.test.js` (throwaway debug file)
3. Phase 4 polish (deferred): Reanimated shared-element transitions, Skia mirror reveal, haptics, gesture swipe handlers, skeleton loaders, push notifications, biometric unlock
