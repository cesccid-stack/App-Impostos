/**
 * @module import/currency-service
 * Currency conversion service using Frankfurter API (ECB rates).
 */

const CACHE_KEY = 'hacienda_currency_cache';

interface RateCache {
  [date: string]: {
    [currency: string]: number;
  };
}

let cache: RateCache = {};

// Load cache from localStorage
try {
  const saved = localStorage.getItem(CACHE_KEY);
  if (saved) {
    cache = JSON.parse(saved);
  }
} catch (e) {
  console.error('Failed to load currency cache', e);
}

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to save currency cache', e);
  }
}

/**
 * Fetches the exchange rate for a given currency to EUR on a specific date.
 * If the rate is already cached, it returns the cached rate.
 * @param currency The 3-letter currency code (e.g., 'USD', 'GBP')
 * @param date The date in 'YYYY-MM-DD' format
 * @returns The exchange rate (1 EUR = X currency), or 1 if it fails.
 */
export async function getExchangeRate(currency: string, date: string): Promise<number> {
  const upperCurrency = currency.toUpperCase();
  if (upperCurrency === 'EUR') return 1;

  // Check cache
  if (cache[date] && cache[date][upperCurrency]) {
    return cache[date][upperCurrency];
  }

  try {
    // We use Frankfurter API which is a free API for ECB rates
    // It requires dates in YYYY-MM-DD format. If weekend, it returns the Friday rate.
    const response = await fetch(`https://api.frankfurter.app/${date}?to=${upperCurrency}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch rate: ${response.statusText}`);
    }

    const data = await response.json();
    const rate = data.rates[upperCurrency];

    if (typeof rate === 'number') {
      if (!cache[date]) cache[date] = {};
      cache[date][upperCurrency] = rate;
      saveCache();
      return rate;
    }
    
    console.warn(`Rate not found for ${upperCurrency} on ${date}`);
    return 1;
  } catch (error) {
    console.error(`Error fetching exchange rate for ${upperCurrency} on ${date}:`, error);
    // Fallback: prompt the user or return 1
    return 1;
  }
}

/**
 * Convert an amount from a foreign currency to EUR.
 * @param amount Amount in foreign currency
 * @param currency 3-letter currency code
 * @param date Date of the transaction
 * @returns Amount in EUR
 */
export async function convertToEUR(amount: number, currency: string, date: string): Promise<number> {
  if (currency.toUpperCase() === 'EUR') return amount;
  const rate = await getExchangeRate(currency, date);
  // rate is 1 EUR = X currency. So EUR = amount / rate
  return amount / rate;
}
