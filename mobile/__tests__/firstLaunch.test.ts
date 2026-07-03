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
