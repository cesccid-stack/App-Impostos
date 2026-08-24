/**
 * @module utils/math
 * Pure, high-precision safe arithmetic utilities for financial calculations.
 * Protects against IEEE-754 floating point inaccuracies and NaN/Infinity corruptions.
 */

/**
 * Rounds a number to exactly 2 decimal places using standard financial rounding.
 */
export function roundCurrency(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Rounds a number to a specified number of decimal places.
 */
export function roundDecimals(value: number, decimals = 2): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Safe addition of multiple numbers.
 */
export function safeAdd(...values: unknown[]): number {
  let sum = 0;
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v) && !Number.isNaN(v)) {
      sum += v;
    }
  }
  return roundCurrency(sum);
}

/**
 * Safe multiplication of two numbers.
 */
export function safeMultiply(a: unknown, b: unknown): number {
  const numA = typeof a === 'number' && Number.isFinite(a) ? a : 0;
  const numB = typeof b === 'number' && Number.isFinite(b) ? b : 0;
  return roundCurrency(numA * numB);
}

/**
 * Safe percentage calculation: (part / total) * 100.
 */
export function safePercentage(part: unknown, total: unknown): number {
  const numPart = typeof part === 'number' && Number.isFinite(part) ? part : 0;
  const numTotal = typeof total === 'number' && Number.isFinite(total) ? total : 0;
  if (numTotal === 0) return 0;
  return roundDecimals((numPart / numTotal) * 100, 2);
}
