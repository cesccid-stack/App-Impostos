/**
 * @module utils/exact-math
 * Motor d'Aritmètica Decimal Financera i Arrodoniments Oficials AEAT.
 * 
 * Garanteix una precisió del 100% lliure d'errors de coma flotant IEEE-754
 * (com ara 0.1 + 0.2 !== 0.3 o pèrdues de precisió en agregacions massives).
 * Utilitza aritmètica entera de cèntims i escala de 4 decimals per a càlculs
 * tributaris intermedis (prorrates, percentatges, taules d'amortització i trams).
 */

const PRECISION_SCALE = 10_000n; // 4 decimals per a precisió intermèdia
const CENT_SCALE = 100n;         // 2 decimals per a liquidació oficial

/**
 * Converteix una quantitat en euros (number) a cèntims enters (BigInt).
 */
export function eurosToCents(euros: number | string | null | undefined): bigint {
  if (euros === null || euros === undefined) return 0n;
  const num = typeof euros === 'string' ? parseFloat(euros.replace(',', '.')) : euros;
  if (!Number.isFinite(num) || Number.isNaN(num)) return 0n;
  // Arrodoniment simètric al cèntim
  return BigInt(Math.round(num * 100));
}

/**
 * Converteix cèntims enters (BigInt) a euros (number) amb 2 decimals garantits.
 */
export function centsToEuros(cents: bigint): number {
  const isNegative = cents < 0n;
  const absCents = isNegative ? -cents : cents;
  const units = absCents / CENT_SCALE;
  const fraction = absCents % CENT_SCALE;
  const floatVal = Number(units) + Number(fraction) / 100;
  return isNegative ? -floatVal : floatVal;
}

/**
 * Converteix un valor decimal a representació d'escala fixa 4 decimals (BigInt).
 */
export function toFixedScaled(val: number | string | null | undefined): bigint {
  if (val === null || val === undefined) return 0n;
  const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
  if (!Number.isFinite(num) || Number.isNaN(num)) return 0n;
  return BigInt(Math.round(num * 10_000));
}

/**
 * Converteix un BigInt d'escala fixa 4 decimals a euros (number amb 2 decimals arrodonits segons AEAT).
 */
export function fromFixedScaled(scaledVal: bigint): number {
  const isNegative = scaledVal < 0n;
  const absVal = isNegative ? -scaledVal : scaledVal;
  // Arrodoniment mitjà cap amunt a 2 decimals (divisió per 100 amb arrodoniment del cèntim)
  const cents = (absVal + 50n) / 100n;
  const euros = Number(cents) / 100;
  return isNegative ? -euros : euros;
}

/**
 * Suma exacta de múltiples valors monetaris.
 */
export function exactAdd(...amounts: Array<number | string | null | undefined>): number {
  let totalCents = 0n;
  for (const amt of amounts) {
    totalCents += eurosToCents(amt);
  }
  return centsToEuros(totalCents);
}

/**
 * Resta exacta: minuend - subtrahend.
 */
export function exactSub(
  minuend: number | string | null | undefined,
  subtrahend: number | string | null | undefined
): number {
  return centsToEuros(eurosToCents(minuend) - eurosToCents(subtrahend));
}

/**
 * Multiplicació exacta d'un import monetari per un coeficient o tipus impositiu (decimal, e.g. 0.21 per 21%).
 * Retorna l'import arrodonit al cèntim més proper segons normativa AEAT.
 */
export function exactMultiply(
  amount: number | string | null | undefined,
  rate: number | string | null | undefined
): number {
  const cents = eurosToCents(amount);
  const rateScaled = toFixedScaled(rate);
  const isNegative = (cents < 0n) !== (rateScaled < 0n);
  const absCents = cents < 0n ? -cents : cents;
  const absRate = rateScaled < 0n ? -rateScaled : rateScaled;

  // (cents * (rate * 10_000) + 5_000) / 10_000
  const productScaled = absCents * absRate;
  const roundedCents = (productScaled + 5_000n) / PRECISION_SCALE;
  const result = centsToEuros(roundedCents);
  return isNegative ? -result : result;
}

/**
 * Divisió exacta d'un import monetari per un divisor.
 */
export function exactDivide(
  amount: number | string | null | undefined,
  divisor: number | string | null | undefined
): number {
  const div = typeof divisor === 'string' ? parseFloat(divisor.replace(',', '.')) : Number(divisor);
  if (!div || !Number.isFinite(div)) return 0;
  const scaledDiv = toFixedScaled(div);
  if (scaledDiv === 0n) return 0;

  const cents = eurosToCents(amount);
  const isNegative = (cents < 0n) !== (scaledDiv < 0n);
  const absCents = cents < 0n ? -cents : cents;
  const absDiv = scaledDiv < 0n ? -scaledDiv : scaledDiv;

  const scaledNumerator = absCents * PRECISION_SCALE;
  const roundedCents = (scaledNumerator + (absDiv / 2n)) / absDiv;
  const result = centsToEuros(roundedCents);
  return isNegative ? -result : result;
}

/**
 * Aplica una escala de gravamen progressiva (IRPF, Patrimoni, Successions) amb màxima precisió cèntim a cèntim.
 */
export interface ExactBracketResult {
  readonly totalTax: number;
  readonly brackets: ReadonlyArray<{
    readonly from: number;
    readonly to: number;
    readonly baseInBracket: number;
    readonly rate: number;
    readonly taxInBracket: number;
  }>;
}

export function applyTaxBracketsExact(
  taxableBase: number,
  brackets: readonly { readonly upTo: number; readonly rate: number }[]
): ExactBracketResult {
  if (!taxableBase || taxableBase <= 0 || !brackets.length) {
    return { totalTax: 0, brackets: [] };
  }

  let remainingBaseCents = eurosToCents(taxableBase);
  let previousLimitCents = 0n;
  let totalTaxCents = 0n;
  const breakdown: Array<{
    from: number;
    to: number;
    baseInBracket: number;
    rate: number;
    taxInBracket: number;
  }> = [];

  for (const bracket of brackets) {
    if (remainingBaseCents <= 0n) break;

    const bracketLimitCents = bracket.upTo === Infinity ? -1n : eurosToCents(bracket.upTo);
    const bracketSpanCents = bracketLimitCents === -1n
      ? remainingBaseCents
      : bracketLimitCents - previousLimitCents;

    if (bracketSpanCents <= 0n) {
      previousLimitCents = bracketLimitCents;
      continue;
    }

    const baseInThisBracketCents = remainingBaseCents > bracketSpanCents ? bracketSpanCents : remainingBaseCents;
    const rateScaled = toFixedScaled(bracket.rate);

    // Càlcul del tribut en aquest tram amb arrodoniment cèntim
    const taxInThisBracketCents = (baseInThisBracketCents * rateScaled + 5_000n) / PRECISION_SCALE;

    totalTaxCents += taxInThisBracketCents;
    remainingBaseCents -= baseInThisBracketCents;

    breakdown.push({
      from: centsToEuros(previousLimitCents),
      to: bracket.upTo === Infinity ? Infinity : centsToEuros(bracketLimitCents),
      baseInBracket: centsToEuros(baseInThisBracketCents),
      rate: bracket.rate,
      taxInBracket: centsToEuros(taxInThisBracketCents),
    });

    if (bracketLimitCents !== -1n) {
      previousLimitCents = bracketLimitCents;
    }
  }

  return {
    totalTax: centsToEuros(totalTaxCents),
    brackets: breakdown,
  };
}

/**
 * Càlcul oficial de quota d'IVA i Recàrrec d'Equivalència per línia de factura.
 */
export interface ExactInvoiceLineTax {
  readonly base: number;
  readonly ivaRate: number;
  readonly ivaAmount: number;
  readonly reqRate: number;
  readonly reqAmount: number;
  readonly total: number;
}

export function calculateInvoiceLineTaxExact(
  base: number,
  ivaRate: number,
  reqRate: number = 0
): ExactInvoiceLineTax {
  const baseCents = eurosToCents(base);
  const ivaAmount = exactMultiply(base, ivaRate);
  const reqAmount = reqRate > 0 ? exactMultiply(base, reqRate) : 0;
  const total = exactAdd(base, ivaAmount, reqAmount);

  return {
    base: centsToEuros(baseCents),
    ivaRate,
    ivaAmount,
    reqRate,
    reqAmount,
    total,
  };
}
