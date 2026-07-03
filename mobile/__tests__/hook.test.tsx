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

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
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
    mockReplace.mockClear();
  });

  test('renders slide headlines', async () => {
    const { getByText, queryByText } = await render(<HookScreen />);
    getByText('Your closet. Digital.');
    getByText('Try it on. Before you buy.');
    getByText('A stylist who knows you.');
    // Slide 4 content mounts only once the pager reaches it.
    expect(queryByText('Your turn.')).toBeNull();
  });

  test('Skip marks hasSeenHook and replaces to login', async () => {
    const { getByTestId } = await render(<HookScreen />);
    await fireEvent.press(getByTestId('hook-skip'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
    expect(await AsyncStorage.getItem('vestofit.hasSeenHook')).toBe('1');
  });
});
