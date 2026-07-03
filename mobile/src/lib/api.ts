/**
 * VestoFit API client — React Native port of frontend/src/lib/api.ts
 * Types are verbatim from the web client; transport uses fetch with
 * async expo-secure-store token retrieval.
 */
import Constants from 'expo-constants';
import { getToken, clearToken } from './auth';
import { navigationRef } from './navigation';

const BASE: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://localhost:8000';

// ── Response types (verbatim from web) ──────────────────────────────────────

export type TokenResponse = { access_token: string; token_type: string };

export type AvatarResponse = {
  avatar_id: string;
  photo_url: string;
};

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type Category = 'tops' | 'bottoms' | 'dresses';

export type WardrobeItem = {
  id: string;
  category: Category;
  image_url: string;
  clean_image_url: string | null;
  name: string | null;
  color: string | null;
  pattern: string | null;
  formality: string | null;
  season: string | null;
  warmth: number | null;
  user_notes: string | null;
  conditions: string | null;
  is_favorite: boolean;
  tagging_status: 'pending' | 'done' | 'failed';
  created_at: string;
};

export type Outfit = {
  id: string;
  prompt: string | null;
  reasoning: string | null;
  item_ids: string[];
  source: 'llm' | 'manual';
  items: WardrobeItem[];
  result_url: string | null;
  render_status: 'draft' | 'rendering' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
};

export type StylistSuggestResult = {
  outfit_id: string;
  item_ids: string[];
  reasoning: string;
  decline: boolean;
};

export type StylistMessage = {
  id: string;
  role: string;
  content: string;
  outfit_id: string | null;
  created_at: string;
};

export type WardrobeItemUpdate = {
  category?: Category;
  name?: string | null;
  user_notes?: string | null;
  conditions?: string | null;
  is_favorite?: boolean;
};

export type TryOnStatus = {
  job_id: string;
  status: JobStatus;
  result_url?: string | null;
  garment_url?: string | null;
  source_url?: string | null;
  category?: Category | null;
  error?: string | null;
  created_at: string;
};

export type UserMe = {
  id: string;
  email: string;
  country?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type ShoppingResultItem = {
  title: string;
  price: number | null;
  currency: string;
  image_url: string;
  product_url: string;
  source: string;
  category: string | null;
  kind?: 'product' | 'store';
  address?: string | null;
  phone?: string | null;
  rating?: number | null;
  rating_count?: number | null;
  open_now?: boolean | null;
};

export type ShoppingSearchResponse = {
  query: string;
  results: ShoppingResultItem[];
  total: number;
  city?: string | null;
  currency?: string;
  no_local?: boolean;
};

export type ShoppingHistoryItem = {
  id: string;
  query: string;
  budget_max: number | null;
  category: string | null;
  result_count: number;
  created_at: string;
};

export type ShoppingAskResponse = {
  reply: string;
  results: ShoppingResultItem[] | null;
  total?: number;
  search_query: string | null;
  chips: string[] | null;
  city?: string | null;
  currency?: string;
  no_local?: boolean;
};

export type SubscriptionStatus = {
  is_active: boolean;
  plan: string | null;
  status: string | null;
  card_brand: string | null;
  card_last_four: string | null;
  renews_at: string | null;
  ends_at: string | null;
  update_payment_url: string | null;
  customer_portal_url: string | null;
};

// ── Native file type (replaces web File) ────────────────────────────────────

export type NativeFile = {
  uri: string;
  name: string;
  type: string;
};

// ── Core request helper ──────────────────────────────────────────────────────

async function request<T>(
  path: string,
  opts: RequestInit = {},
  isForm = false,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (!isForm) headers['Content-Type'] = 'application/json';

  const token = await getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...headers, ...(opts.headers as Record<string, string>) },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      await clearToken();
      // Navigate to login via navigation ref (avoids window.location)
      if (navigationRef.isReady()) {
        navigationRef.navigate('/(auth)/login' as never);
      }
    }
    let detail = 'Request failed';
    try {
      const body = (await res.json()) as { detail?: string; message?: string };
      detail = body.detail ?? body.message ?? 'Request failed';
    } catch {
      /* swallow parse errors */
    }
    throw new Error(detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── FormData helper for native file uploads ──────────────────────────────────

function appendNativeFile(fd: FormData, field: string, file: NativeFile): void {
  // React Native's FormData accepts { uri, name, type } objects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fd.append(field, { uri: file.uri, name: file.name, type: file.type } as any);
}

// ── API surface (matches web frontend/src/lib/api.ts exactly) ────────────────

export const api = {
  // Auth
  register(email: string, password: string) {
    return request<TokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  login(email: string, password: string) {
    return request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  me() {
    return request<UserMe>('/auth/me');
  },
  updateLocation(loc: { country?: string; city?: string; lat?: number; lng?: number }) {
    return request<UserMe>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(loc),
    });
  },

  // Avatar
  myAvatar() {
    return request<AvatarResponse | null>('/avatar/me').catch((e: Error) => {
      if (String(e.message).toLowerCase().includes('no avatar')) return null;
      throw e;
    });
  },
  uploadAvatar(file: NativeFile) {
    const fd = new FormData();
    appendNativeFile(fd, 'photo', file);
    return request<AvatarResponse>('/avatar/upload', { method: 'POST', body: fd }, true);
  },

  // Try-on
  tryOnOutfit(item_ids: string[]) {
    return request<{ job_id: string; status: JobStatus }>('/tryon/outfit', {
      method: 'POST',
      body: JSON.stringify({ item_ids }),
    });
  },
  tryOnUpload(garment: NativeFile, description?: string) {
    const fd = new FormData();
    appendNativeFile(fd, 'garment_image', garment);
    if (description) fd.append('description', description);
    return request<{ job_id: string; status: JobStatus }>(
      '/tryon/upload',
      { method: 'POST', body: fd },
      true,
    );
  },
  jobStatus(id: string) {
    return request<TryOnStatus>(`/tryon/${id}`);
  },
  history() {
    return request<TryOnStatus[]>('/tryon/history');
  },

  // Settings
  changePassword(current_password: string, new_password: string) {
    return request<void>('/settings/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password }),
    });
  },
  clearHistory() {
    return request<void>('/settings/history', { method: 'DELETE' });
  },
  deleteAccount() {
    return request<void>('/settings/account', { method: 'DELETE' });
  },

  // Wardrobe
  listWardrobe(params?: {
    category?: Category;
    color?: string;
    season?: string;
    favorites_only?: boolean;
  }) {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.color) q.set('color', params.color);
    if (params?.season) q.set('season', params.season);
    if (params?.favorites_only) q.set('favorites_only', 'true');
    const qs = q.toString();
    return request<WardrobeItem[]>(`/wardrobe/items${qs ? `?${qs}` : ''}`);
  },
  addWardrobeItem(file: NativeFile, category: Category) {
    const fd = new FormData();
    appendNativeFile(fd, 'photo', file);
    fd.append('category', category);
    return request<WardrobeItem>('/wardrobe/items', { method: 'POST', body: fd }, true);
  },
  updateWardrobeItem(id: string, data: WardrobeItemUpdate) {
    return request<WardrobeItem>(`/wardrobe/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteWardrobeItem(id: string) {
    return request<void>(`/wardrobe/items/${id}`, { method: 'DELETE' });
  },
  retagWardrobeItem(id: string) {
    return request<WardrobeItem>(`/wardrobe/items/${id}/retag`, { method: 'POST' });
  },

  // Outfits
  createOutfit(item_ids: string[]) {
    return request<Outfit>('/outfits', {
      method: 'POST',
      body: JSON.stringify({ item_ids }),
    });
  },
  listOutfits() {
    return request<Outfit[]>('/outfits');
  },
  getOutfit(id: string) {
    return request<Outfit>(`/outfits/${id}`);
  },
  renderOutfit(id: string) {
    return request<{ outfit_id: string; render_status: string }>(
      `/outfits/${id}/render`,
      { method: 'POST' },
    );
  },

  // Stylist
  stylistSuggest(prompt: string, locked_item_ids: string[] = []) {
    return request<StylistSuggestResult>('/stylist/suggest', {
      method: 'POST',
      body: JSON.stringify({ prompt, locked_item_ids }),
    });
  },
  stylistReroll(prompt: string, locked_item_ids: string[] = []) {
    return request<StylistSuggestResult>('/stylist/reroll', {
      method: 'POST',
      body: JSON.stringify({ prompt, locked_item_ids }),
    });
  },
  stylistAsk(prompt: string, item_ids: string[] = []) {
    return request<{ reply: string; chips?: string[] | null }>('/stylist/ask', {
      method: 'POST',
      body: JSON.stringify({ prompt, item_ids }),
    });
  },
  stylistMessages() {
    return request<StylistMessage[]>('/stylist/messages');
  },

  // Shopping
  shoppingSearch(
    query: string,
    budget_max?: number,
    category?: string,
    location?: { country?: string; city?: string; lat?: number; lng?: number },
  ) {
    return request<ShoppingSearchResponse>('/shopping/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        budget_max: budget_max ?? null,
        category: category ?? null,
        ...(location ?? {}),
      }),
    });
  },
  shoppingAsk(
    prompt: string,
    history?: { role: string; content: string }[],
    location?: { country?: string; city?: string; lat?: number; lng?: number },
  ) {
    return request<ShoppingAskResponse>('/shopping/ask', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        history: history ?? null,
        ...(location ?? {}),
      }),
    });
  },
  shoppingHistory() {
    return request<ShoppingHistoryItem[]>('/shopping/history');
  },

  // Billing
  billingCheckout(variant_id: string) {
    return request<{ checkout_url: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ variant_id }),
    });
  },
  billingSubscription() {
    return request<SubscriptionStatus>('/billing/subscription');
  },
};
