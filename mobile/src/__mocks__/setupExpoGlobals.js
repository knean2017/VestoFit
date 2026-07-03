// Polyfill globalThis.expo for Jest — normally installed by JSI (C++ native runtime).
// expo-modules-core@57 accesses globalThis.expo.EventEmitter synchronously at import time.
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

