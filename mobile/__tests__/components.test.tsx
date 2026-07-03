/**
 * Component tests — Login validation, CoachingCard, Skeleton, Wardrobe loading state.
 * Uses RNTL + MSW. Providers mocked to minimise setup noise.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { mockTheme, mockStyles, makeWrapper } from '../src/__mocks__/testUtils';

// ── Global mocks ─────────────────────────────────────────────────────────────

jest.mock('react-native-unistyles', () => ({
  useStyles: () => ({ styles: mockStyles, theme: mockTheme }),
  createStyleSheet: (fn: unknown) => fn,
  UnistylesRegistry: { addThemes: jest.fn().mockReturnThis(), addConfig: jest.fn() },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  Link: ({ children }: any) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock('react-native-gesture-handler', () => ({
  Swipeable: ({ children }: any) => children,
  GestureHandlerRootView: ({ children }: any) => children,
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: 'images' },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'undetermined' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id'),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { HIGH: 5 },
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  isEnrolledAsync: jest.fn().mockResolvedValue(false),
  authenticateAsync: jest.fn().mockResolvedValue({ success: false }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { apiUrl: 'http://localhost:8000' } } },
}));

jest.mock('../src/lib/navigation', () => ({
  navigationRef: { isReady: () => false, navigate: jest.fn() },
}));

jest.mock('../src/components/ui/Toast', () => ({
  ToastProvider: ({ children }: any) => children,
  useToast: () => jest.fn(),
}));

jest.mock('@lodev09/react-native-true-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  return { TrueSheet: React.forwardRef(function MockSheet({ children }: any) { return children ?? null; }) };
});

jest.mock('../src/features/wardrobe/ItemDetailSheet', () => ({
  ItemDetailSheet: () => null,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    getAllKeys: jest.fn().mockResolvedValue([]),
    multiGet: jest.fn().mockResolvedValue([]),
    multiSet: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { CoachingCard } from '../src/components/ui/CoachingCard';
import { WardrobeSkeleton, StylistSkeleton, ShopSkeleton } from '../src/components/ui/Skeleton';
import LoginScreen from '../app/(auth)/login';
import WardrobeScreen from '../app/(tabs)/wardrobe';

// ── MSW server ────────────────────────────────────────────────────────────────

const WARDROBE_ITEMS = [
  {
    id: 'item-1', category: 'tops', image_url: 'http://x.com/a.jpg',
    clean_image_url: null, name: 'White tee', color: 'white',
    pattern: null, formality: null, season: 'summer', warmth: null,
    user_notes: null, conditions: null, is_favorite: false,
    tagging_status: 'done', created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'item-2', category: 'bottoms', image_url: 'http://x.com/b.jpg',
    clean_image_url: null, name: 'Blue jeans', color: 'blue',
    pattern: null, formality: null, season: null, warmth: null,
    user_notes: null, conditions: null, is_favorite: true,
    tagging_status: 'done', created_at: '2026-01-01T00:00:00Z',
  },
];

const server = setupServer(
  rest.get('http://localhost:8000/wardrobe/items', (_req, res, ctx) =>
    res(ctx.json(WARDROBE_ITEMS)),
  ),
  rest.get('http://localhost:8000/auth/me', (_req, res, ctx) =>
    res(ctx.json({ id: '1', email: 'a@b.com' })),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

// ── Tests: CoachingCard ───────────────────────────────────────────────────────

describe('CoachingCard', () => {
  it('renders title and all steps', async () => {
    const { getByText } = await render(
      <CoachingCard
        icon={<Text>👗</Text>}
        title="Build your wardrobe"
        steps={[
          { icon: <Text>📸</Text>, text: 'Upload a photo' },
          { icon: <Text>🏷️</Text>, text: 'AI tags it' },
          { icon: <Text>✨</Text>, text: 'Use in Studio' },
        ]}
      />,
    );
    expect(getByText('Build your wardrobe')).toBeTruthy();
    expect(getByText('Upload a photo')).toBeTruthy();
    expect(getByText('AI tags it')).toBeTruthy();
    expect(getByText('Use in Studio')).toBeTruthy();
  });

  it('renders optional subtitle', async () => {
    const { getByText } = await render(
      <CoachingCard icon={<Text>✨</Text>} title="Title" subtitle="A helpful tip" steps={[]} />,
    );
    expect(getByText('A helpful tip')).toBeTruthy();
  });

  it('renders children slot', async () => {
    const { getByText } = await render(
      <CoachingCard icon={<Text>✨</Text>} title="T" steps={[]}>
        <Text>CTA button</Text>
      </CoachingCard>,
    );
    expect(getByText('CTA button')).toBeTruthy();
  });
});

// ── Tests: Skeleton components ────────────────────────────────────────────────

describe('Skeleton components', () => {
  it('WardrobeSkeleton renders without crashing', async () => {
    await expect(render(<WardrobeSkeleton />)).resolves.not.toThrow();
  });

  it('StylistSkeleton renders without crashing', async () => {
    await expect(render(<StylistSkeleton />)).resolves.not.toThrow();
  });

  it('ShopSkeleton renders without crashing', async () => {
    await expect(render(<ShopSkeleton />)).resolves.not.toThrow();
  });
});

// ── Tests: Login form validation ──────────────────────────────────────────────

describe('LoginScreen — form validation', () => {
  it('shows both errors when submitting empty form', async () => {
    const { getByText } = await render(<LoginScreen />);
    await fireEvent.press(getByText('Sign in'));
    expect(getByText('Enter a valid email')).toBeTruthy();
    expect(getByText('Password must be 6+ characters')).toBeTruthy();
  });

  it('shows email error for missing @', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await render(<LoginScreen />);
    await fireEvent.changeText(getByPlaceholderText('you@example.com'), 'notanemail');
    await fireEvent.changeText(getByPlaceholderText('••••••••'), 'password123');
    await fireEvent.press(getByText('Sign in'));
    expect(getByText('Enter a valid email')).toBeTruthy();
    expect(queryByText('Password must be 6+ characters')).toBeNull();
  });

  it('shows password error for short password', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await render(<LoginScreen />);
    await fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    await fireEvent.changeText(getByPlaceholderText('••••••••'), '123');
    await fireEvent.press(getByText('Sign in'));
    expect(queryByText('Enter a valid email')).toBeNull();
    expect(getByText('Password must be 6+ characters')).toBeTruthy();
  });

  it('shows no errors for valid input', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await render(<LoginScreen />);
    server.use(
      rest.post('http://localhost:8000/auth/login', (_req, res, ctx) =>
        res(ctx.json({ access_token: 'tok', token_type: 'bearer' })),
      ),
    );
    await fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    await fireEvent.changeText(getByPlaceholderText('••••••••'), 'password123');
    await fireEvent.press(getByText('Sign in'));
    expect(queryByText('Enter a valid email')).toBeNull();
    expect(queryByText('Password must be 6+ characters')).toBeNull();
  });
});

// ── Tests: WardrobeScreen ─────────────────────────────────────────────────────

describe('WardrobeScreen', () => {
  it('renders header and add button', async () => {
    const { getByText } = await render(<WardrobeScreen />, { wrapper: makeWrapper() });
    expect(getByText('Wardrobe')).toBeTruthy();
    expect(getByText('+ Add')).toBeTruthy();
  });

  it('renders wardrobe items after load', async () => {
    const { getByText } = await render(<WardrobeScreen />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(getByText('White tee')).toBeTruthy();
      expect(getByText('Blue jeans')).toBeTruthy();
    });
  });

  it('shows coaching card when wardrobe is empty', async () => {
    server.use(
      rest.get('http://localhost:8000/wardrobe/items', (_req, res, ctx) => res(ctx.json([]))),
    );
    const { getByText } = await render(<WardrobeScreen />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(getByText('Build your wardrobe')).toBeTruthy();
    });
  });
});
