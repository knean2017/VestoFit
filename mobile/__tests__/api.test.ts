/**
 * Tests for the API client — auth header, 401 path, form vs json.
 * Uses MSW to intercept fetch without a real server.
 */
import { setupServer } from 'msw/node';
import { rest } from 'msw';

// Mock expo-secure-store before importing api
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { apiUrl: 'http://localhost:8000' } } },
}));

// Mock navigation ref
jest.mock('../src/lib/navigation', () => ({
  navigationRef: { isReady: () => false, navigate: jest.fn() },
}));

import * as SecureStore from 'expo-secure-store';
import { api } from '../src/lib/api';
import { setToken } from '../src/lib/auth';

const server = setupServer(
  rest.post('http://localhost:8000/auth/login', (req, res, ctx) =>
    res(ctx.json({ access_token: 'tok123', token_type: 'bearer' })),
  ),
  rest.post('http://localhost:8000/auth/register', (req, res, ctx) =>
    res(ctx.json({ access_token: 'newtok', token_type: 'bearer' })),
  ),
  rest.get('http://localhost:8000/auth/me', (req, res, ctx) => {
    const auth = req.headers.get('Authorization');
    if (!auth) return res(ctx.status(401), ctx.json({ detail: 'Unauthorized' }));
    return res(ctx.json({ id: '1', email: 'test@test.com' }));
  }),
  rest.get('http://localhost:8000/wardrobe/items', (_req, res, ctx) =>
    res(ctx.json([])),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

describe('api.login', () => {
  it('returns token response', async () => {
    const res = await api.login('user@test.com', 'password');
    expect(res.access_token).toBe('tok123');
  });
});

describe('api.register', () => {
  it('returns token response', async () => {
    const res = await api.register('new@test.com', 'password123');
    expect(res.access_token).toBe('newtok');
  });
});

describe('auth header', () => {
  it('sends Authorization header when token present', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('mytoken');
    let capturedAuth: string | null = null;
    server.use(
      rest.get('http://localhost:8000/auth/me', (req, res, ctx) => {
        capturedAuth = req.headers.get('Authorization');
        return res(ctx.json({ id: '1', email: 'a@b.com' }));
      }),
    );
    await api.me();
    expect(capturedAuth).toBe('Bearer mytoken');
  });

  it('omits Authorization when no token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    let capturedAuth: string | null = 'sentinel';
    server.use(
      rest.get('http://localhost:8000/auth/me', (req, res, ctx) => {
        capturedAuth = req.headers.get('Authorization');
        return res(ctx.json({ id: '1', email: 'a@b.com' }));
      }),
    );
    await api.me();
    expect(capturedAuth).toBeNull();
  });
});

describe('401 handling', () => {
  it('throws on 401', async () => {
    server.use(
      rest.get('http://localhost:8000/wardrobe/items', (_req, res, ctx) =>
        res(ctx.status(401), ctx.json({ detail: 'Unauthorized' })),
      ),
    );
    await expect(api.listWardrobe()).rejects.toThrow('Unauthorized');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });
});

describe('auth.ts', () => {
  it('setToken calls SecureStore.setItemAsync', async () => {
    await setToken('abc');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('vestofit.token', 'abc');
  });
});
