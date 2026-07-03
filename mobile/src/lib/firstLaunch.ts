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
