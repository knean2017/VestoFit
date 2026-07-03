/**
 * Shared test utilities — providers and mocks for component tests.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const mockTheme = {
  colors: {
    background: '#fbf7f0', ink: '#2a2522', accent: '#ff6b5e', muted: '#9e958a',
    sand: '#f4ede0', card: '#fff', cardBorder: '#ddd5c8', line: '#ddd5c8',
    stone: '#e8ddd0', error: '#e53e3e', warning: '#f5a623', success: '#4caf7d', white: '#fff',
  },
  spacing: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 },
  radii: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, full: 999 },
  typography: {
    sizes: { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 30, display: 38 },
    weights: { regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800' },
    families: { sans: 'Nunito' },
  },
  shadows: { soft: {}, lifted: {}, card: {} },
};

// Returns {} for any style key access
export const mockStyles = new Proxy({} as Record<string, object>, { get: () => ({}) });

export function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}
