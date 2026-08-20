/**
 * @module utils/currency
 * Currency and number formatting utilities.
 */

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a number as EUR currency string */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** Format a number as percentage (0.19 → "19,0 %") */
export function formatPercent(value: number): string {
  return percentFormatter.format(value);
}

/** Format a number with 2 decimal places */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Format a number as a compact currency (e.g., 12.5k €) */
export function formatCompact(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(1)}M €`;
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(1)}k €`;
  }
  return formatCurrency(value);
}

/**
 * Parse a currency input string to number.
 * Handles European formatting (1.234,56).
 */
export function parseCurrencyInput(input: string): number {
  const cleaned = input
    .replace(/[€\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}
