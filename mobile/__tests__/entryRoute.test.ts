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
