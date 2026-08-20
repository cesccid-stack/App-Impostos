/**
 * @module fiscal/deductions
 * Computes applicable state and general tax deductions for the IRPF declaration.
 */

import type { DeclaracionData } from '../types.ts';
import {
  HOUSING_DEDUCTION_RATE,
  HOUSING_DEDUCTION_MAX_BASE,
  DONATION_FIRST_TIER,
  DONATION_FIRST_TIER_RATE,
  DONATION_REST_RATE,
  DONATION_REST_RECURRING_RATE,
  MATERNITY_DEDUCTION_PER_MONTH,
  MATERNITY_DEDUCTION_MAX,
  MATERNITY_NURSERY_MAX,
} from './constants.ts';

export interface DeductionAmounts {
  housingDeductionAmount: number;
  donationsDeductionAmount: number;
  maternityDeductionAmount: number;
  energyEfficiencyDeductionAmount: number;
}

/**
 * Compute all applicable state deductions.
 */
export function computeDeductions(data: DeclaracionData): DeductionAmounts {
  return {
    housingDeductionAmount: computeHousingDeduction(data),
    donationsDeductionAmount: computeDonationsDeduction(data),
    maternityDeductionAmount: computeMaternityDeduction(data),
    energyEfficiencyDeductionAmount: computeEnergyEfficiencyDeduction(data),
  };
}

/**
 * Deducció per inversió en habitatge habitual.
 * Règim transitori: Adquisicions anteriors a 01/01/2013.
 * 15% de les quantitats satisfetes (base màxima 9.040 €/any).
 */
function computeHousingDeduction(data: DeclaracionData): number {
  if (!data.deductions.housingDeduction) return 0;
  const base = Math.min(
    data.deductions.housingAmountsPaid || 0,
    HOUSING_DEDUCTION_MAX_BASE,
  );
  return base * HOUSING_DEDUCTION_RATE;
}

/**
 * Deduccions per donatius (Llei 49/2002 actualitzada RD-Llei 6/2023).
 * - Primers 250 €: 80%
 * - Restant: 40% (o 45% si recurrent ≥3 anys a la mateixa entitat)
 * - Donatius generals no prioritaris: 10%
 */
function computeDonationsDeduction(data: DeclaracionData): number {
  let totalDeduction = 0;
  const donations = data.deductions.donations || [];

  for (const donation of donations) {
    if ((donation.amount || 0) <= 0) continue;

    if (donation.priority) {
      const firstTier = Math.min(donation.amount, DONATION_FIRST_TIER);
      const rest = Math.max(0, donation.amount - DONATION_FIRST_TIER);
      const restRate = donation.recurring
        ? DONATION_REST_RECURRING_RATE
        : DONATION_REST_RATE;

      totalDeduction += firstTier * DONATION_FIRST_TIER_RATE + rest * restRate;
    } else {
      totalDeduction += donation.amount * 0.10;
    }
  }

  return totalDeduction;
}

/**
 * Deducció per maternitat (Art. 81 LIRPF).
 * 100 €/mes per mare treballadora amb fills < 3 anys (màx 1.200 €).
 * + Increment per despeses de guarderia / centres d'educació infantil (fins a 1.000 € addicionals).
 */
function computeMaternityDeduction(data: DeclaracionData): number {
  if (!data.deductions.maternityDeduction) return 0;
  const months = Math.min(Math.max(0, data.deductions.maternityMonths || 0), 12);
  const baseMaternity = Math.min(months * MATERNITY_DEDUCTION_PER_MONTH, MATERNITY_DEDUCTION_MAX);
  const nurseryExtra = Math.min(data.deductions.maternityNurseryExpenses || 0, MATERNITY_NURSERY_MAX);

  return baseMaternity + nurseryExtra;
}

/**
 * Deducció per obres de millora de l'eficiència energètica en habitatges (RD-Llei 19/2021).
 */
function computeEnergyEfficiencyDeduction(data: DeclaracionData): number {
  const type = data.deductions.energyEfficiencyType;
  const amount = data.deductions.energyEfficiencyAmount || 0;
  if (!type || type === 'none' || amount <= 0) return 0;

  switch (type) {
    case 'heating_cooling_20':
      // 20% fins a 5.000€ (màx deducció 1.000€)
      return Math.min(amount, 5000) * 0.20;
    case 'primary_energy_40':
      // 40% fins a 7.500€ (màx deducció 3.000€)
      return Math.min(amount, 7500) * 0.40;
    case 'building_rehab_60':
      // 60% fins a 5.000€/any (màx deducció 3.000€/any)
      return Math.min(amount, 5000) * 0.60;
    default:
      return 0;
  }
}
