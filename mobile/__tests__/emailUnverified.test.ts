/**
 * Regression test for the auth-gate bug: request() must NOT treat a
 * 403 "email_unverified" response as an auth failure (no token clear,
 * no forced navigation to login) since the user IS authenticated and
 * just needs to be routed to /verify-email by the caller's onError.
 * A plain 401 must still clear the token (old behavior preserved).
 */
import { setupServer } from 'msw/node';
import { rest } from 'msw';

// Mock expo-secure-store before importing api
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('sometoken'),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { apiUrl: 'http://localhost:8000' } } },
}));

// Mock navigation ref
const mockNavigate = jest.fn();
jest.mock('../src/lib/navigation', () => ({
  navigationRef: { isReady: () => true, navigate: (...a: unknown[]) => mockNavigate(...a) },
}));

import * as SecureStore from 'expo-secure-store';
import { api } from '../src/lib/api';

const server = setupServer(
  rest.get('http://localhost:8000/wardrobe/items', (_req, res, ctx) =>
    res(ctx.json([])),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

describe('403 email_unverified handling', () => {
  it('does not clear token or navigate to login, throws email_unverified', async () => {
    server.use(
      rest.get('http://localhost:8000/wardrobe/items', (_req, res, ctx) =>
        res(ctx.status(403), ctx.json({ detail: 'email_unverified' })),
      ),
    );

    await expect(api.listWardrobe()).rejects.toThrow('email_unverified');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('401 handling (regression guard)', () => {
  it('still clears token and navigates to login', async () => {
    server.use(
      rest.get('http://localhost:8000/wardrobe/items', (_req, res, ctx) =>
        res(ctx.status(401), ctx.json({ detail: 'Unauthorized' })),
      ),
    );

    await expect(api.listWardrobe()).rejects.toThrow('Unauthorized');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/(auth)/login');
  });
});
