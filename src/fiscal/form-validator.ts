/**
 * @module fiscal/form-validator
 * Pure, high-performance real-time form validators and legal limit checkers.
 * Provides immediate contextual warnings and suggestions for IRPF declarations.
 */

import { formatCurrency } from '../utils/currency.ts';

export interface ValidationFeedback {
  isValid: boolean;
  status: 'valid' | 'warning' | 'error';
  message?: string;
  suggestedValue?: number;
}

/**
 * Validates individual vs company pension plan contribution limits (Art. 52 LIRPF).
 * Individual max: 1.500 € / year.
 * Company max: 8.500 € / year.
 * Total combined max: 10.000 € / year.
 */
export function validatePensionContributions(individual: number, company = 0): ValidationFeedback {
  if (individual < 0 || company < 0) {
    return { isValid: false, status: 'error', message: 'Les aportacions no poden ser negatives.' };
  }

  if (individual > 1500) {
    return {
      isValid: false,
      status: 'warning',
      message: `El límit legal d'aportació individual és de 1.500,00 € anuals. L'excés (${formatCurrency(individual - 1500)}) no serà deduïble en aquest exercici.`,
      suggestedValue: 1500,
    };
  }

  if (company > 8500) {
    return {
      isValid: false,
      status: 'warning',
      message: `El límit legal d'aportacions empresarials és de 8.500,00 € anuals.`,
      suggestedValue: 8500,
    };
  }

  if (individual + company > 10000) {
    return {
      isValid: false,
      status: 'warning',
      message: `El límit conjunt d'aportacions (individual + empresa) és de 10.000,00 € anuals (actual: ${formatCurrency(individual + company)}).`,
      suggestedValue: 10000 - individual,
    };
  }

  return { isValid: true, status: 'valid' };
}

/**
 * Validates foreign work exemption under Art. 7.p LIRPF.
 * Maximum exempt amount: 60.100 € / year.
 */
export function validateForeignWorkExemption(amount: number): ValidationFeedback {
  if (amount < 0) {
    return { isValid: false, status: 'error', message: 'L\'import de l\'exempció no pot ser negatiu.' };
  }

  if (amount > 60100) {
    return {
      isValid: false,
      status: 'warning',
      message: `El límit màxim exempt per treballs a l'estranger és de 60.100,00 € anuals (Art. 7.p LIRPF).`,
      suggestedValue: 60100,
    };
  }

  return { isValid: true, status: 'valid' };
}

/**
 * Validates irregular income reduction under Art. 18.2 LIRPF.
 * Maximum base for 30% reduction: 300.000 €.
 */
export function validateIrregularIncome(amount: number): ValidationFeedback {
  if (amount < 0) {
    return { isValid: false, status: 'error', message: 'L\'import no pot ser negatiu.' };
  }

  if (amount > 300000) {
    return {
      isValid: false,
      status: 'warning',
      message: `La reducció del 30% per rendiments irregulars només s'aplica sobre un màxim de 300.000,00 € (Art. 18.2 LIRPF).`,
      suggestedValue: 300000,
    };
  }

  return { isValid: true, status: 'valid' };
}

/**
 * Mileage expense legal exemption (RD 436/2023: 0,26 € / km).
 */
export function validateMileageRate(income: number, km: number): {
  isFullyExempt: boolean;
  exemptAmount: number;
  taxableAmount: number;
  feedback: ValidationFeedback;
} {
  const maxExempt = Math.max(0, km) * 0.26;
  const actualIncome = Math.max(0, income);
  const exemptAmount = Math.min(actualIncome, maxExempt);
  const taxableAmount = Math.max(0, actualIncome - maxExempt);

  if (actualIncome > maxExempt && km > 0) {
    return {
      isFullyExempt: false,
      exemptAmount,
      taxableAmount,
      feedback: {
        isValid: true,
        status: 'warning',
        message: `El quilometratge rebut supera el límit oficial de 0,26 €/km. L'excés de ${formatCurrency(taxableAmount)} tributarà com a rendiment del treball.`,
      },
    };
  }

  return {
    isFullyExempt: true,
    exemptAmount,
    taxableAmount: 0,
    feedback: { isValid: true, status: 'valid' },
  };
}
