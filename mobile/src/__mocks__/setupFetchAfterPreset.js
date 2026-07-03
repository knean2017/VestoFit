// Runs in setupFilesAfterFramework — AFTER react-native/jest/setup.js and jest-expo/src/preset/setup.js.
// At this point, expo's runtime.native.ts has installed its lazy 'fetch' getter on window.
// Replace it with Node.js native fetch so MSW can intercept and api.ts can call fetch().
if (typeof window !== 'undefined') {
  const fetchDesc = Object.getOwnPropertyDescriptor(window, 'fetch');
  if (fetchDesc && typeof fetchDesc.get === 'function') {
    // expo installed a lazy getter — replace it before MSW intercepts
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: globalThis.fetch,
    });
  } else if (!window.fetch) {
    window.fetch = globalThis.fetch;
  }
}
