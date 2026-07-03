import { QueryClient } from '@tanstack/react-query';
import type { Query } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const CACHE_24H = 1000 * 60 * 60 * 24;

// Queries worth caching to disk — read-heavy, low-churn
const PERSISTED_KEYS = new Set(['wardrobe', 'stylist-messages', 'me', 'subscription']);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      gcTime: CACHE_24H,
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'vestofit-query-cache',
  throttleTime: 1000,
});

export const persistOptions = {
  persister,
  maxAge: CACHE_24H,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) => {
      const key = query.queryKey[0];
      return typeof key === 'string' && PERSISTED_KEYS.has(key);
    },
  },
};
