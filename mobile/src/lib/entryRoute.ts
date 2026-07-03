export type EntryRoute = '/(tabs)/wardrobe' | '/(auth)/login' | '/(hook)';

/** Entry decision: token wins, then first-launch flag. */
export function resolveEntryRoute(token: string | null, seenHook: boolean): EntryRoute {
  if (token) return '/(tabs)/wardrobe';
  if (seenHook) return '/(auth)/login';
  return '/(hook)';
}
