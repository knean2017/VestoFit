/**
 * Currency utilities — ported from frontend/src/lib/currency.ts
 * Uses in-memory cache only (no localStorage in RN; AsyncStorage would be overkill for FX rates).
 */
const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface RatesCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let _inMemory: RatesCache | null = null;

async function fetchRates(): Promise<Record<string, number>> {
  if (_inMemory && Date.now() - _inMemory.fetchedAt < CACHE_TTL_MS) {
    return _inMemory.rates;
  }
  const res = await fetch(RATES_URL);
  if (!res.ok) throw new Error('FX fetch failed');
  const data = (await res.json()) as { rates?: Record<string, number> };
  const rates: Record<string, number> = data.rates ?? {};
  _inMemory = { rates, fetchedAt: Date.now() };
  return rates;
}

export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
): Promise<number | null> {
  if (from === to) return amount;
  try {
    const rates = await fetchRates();
    const fromRate = from === 'USD' ? 1 : rates[from];
    const toRate = to === 'USD' ? 1 : rates[to];
    if (!fromRate || !toRate) return null;
    return (amount / fromRate) * toRate;
  } catch {
    return null;
  }
}

export function convertCurrencySync(
  amount: number,
  from: string,
  to: string,
): number | null {
  if (from === to) return amount;
  if (!_inMemory) return null;
  const rates = _inMemory.rates;
  const fromRate = from === 'USD' ? 1 : rates[from];
  const toRate = to === 'USD' ? 1 : rates[to];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}

export async function warmRates(): Promise<void> {
  try { await fetchRates(); } catch { /* best-effort */ }
}

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'AZN', 'RUB', 'AED', 'SAR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
