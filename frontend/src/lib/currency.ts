const RATES_URL = "https://open.er-api.com/v6/latest/USD";
const CACHE_KEY = "vto_fx_rates";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface RatesCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let _inMemory: RatesCache | null = null;

async function fetchRates(): Promise<Record<string, number>> {
  // Check in-memory cache first
  if (_inMemory && Date.now() - _inMemory.fetchedAt < CACHE_TTL_MS) {
    return _inMemory.rates;
  }
  // Check localStorage
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached: RatesCache = JSON.parse(raw);
      if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        _inMemory = cached;
        return cached.rates;
      }
    }
  } catch { /* ignore */ }

  // Fetch fresh rates
  const res = await fetch(RATES_URL);
  if (!res.ok) throw new Error("FX fetch failed");
  const data = await res.json();
  const rates: Record<string, number> = data.rates ?? {};
  const cache: RatesCache = { rates, fetchedAt: Date.now() };
  _inMemory = cache;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  return rates;
}

/**
 * Convert amount from one currency to another.
 * Rates are relative to USD (base). Returns null if rates unavailable.
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number | null> {
  if (from === to) return amount;
  try {
    const rates = await fetchRates();
    const fromRate = from === "USD" ? 1 : rates[from];
    const toRate = to === "USD" ? 1 : rates[to];
    if (!fromRate || !toRate) return null;
    // Convert: amount / fromRate (to USD) * toRate (to target)
    return (amount / fromRate) * toRate;
  } catch {
    return null;
  }
}

/** Synchronous conversion using cached rates (returns null if no cache). */
export function convertCurrencySync(
  amount: number,
  from: string,
  to: string
): number | null {
  if (from === to) return amount;
  if (!_inMemory) return null;
  const rates = _inMemory.rates;
  const fromRate = from === "USD" ? 1 : rates[from];
  const toRate = to === "USD" ? 1 : rates[to];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}

/** Pre-warm the cache (call on shop page mount). */
export async function warmRates(): Promise<void> {
  try { await fetchRates(); } catch { /* best-effort */ }
}

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "TRY", "AZN", "RUB", "AED", "SAR"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
