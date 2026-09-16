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
  DONATION_PUBLIC_UTILITY_RATE,
  DONATION_POLITICAL_PARTY_RATE,
  DONATION_POLITICAL_PARTY_MAX_BASE,
  DONATION_CAPPED_BASE_LIMIT_RATE,
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
 *
 * @param liquidableBase Base liquidable del contribuent (general + estalvi), necessària per al
 *   límit del 10% que afecta les deduccions per donatius dels apartats b) i c) de l'Art. 68.3.
 */
export function computeDeductions(data: DeclaracionData, liquidableBase = 0): DeductionAmounts {
  return {
    housingDeductionAmount: computeHousingDeduction(data),
    donationsDeductionAmount: computeDonationsDeduction(data, liquidableBase),
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
 * Deduccions per donatius i altres aportacions (Art. 68.3 LIRPF, Llei 49/2002 i RD-Llei 6/2023).
 * - Mecenatge (Llei 49/2002): 80% dels primers 250 € i 40% de la resta (45% si és recurrent). Sense límit de base.
 * - Fundacions i associacions d'utilitat pública no acollides: 10% (apartat b).
 * - Partits polítics, federacions, coalicions i agrupacions d'electors: 20% amb una base màxima de 600 € (apartat c).
 * La base conjunta de les deduccions b) i c) no pot superar el 10% de la base liquidable del contribuent.
 */
function computeDonationsDeduction(data: DeclaracionData, liquidableBase = 0): number {
  const donations = data.deductions.donations || [];

  let mecenatgeDeduction = 0;   // Apartat a) — sense límit de base
  let publicUtilityBase = 0;    // Apartat b)
  let politicalPartyBase = 0;   // Apartat c)

  for (const donation of donations) {
    const amount = donation.amount || 0;
    if (amount <= 0) continue;

    const category = donation.category ?? (donation.priority ? 'ley_49_2002' : 'public_utility');

    if (category === 'ley_49_2002') {
      const firstTier = Math.min(amount, DONATION_FIRST_TIER);
      const rest = Math.max(0, amount - DONATION_FIRST_TIER);
      const restRate = donation.recurring
        ? DONATION_REST_RECURRING_RATE
        : DONATION_REST_RATE;

      mecenatgeDeduction += firstTier * DONATION_FIRST_TIER_RATE + rest * restRate;
    } else if (category === 'political_party') {
      politicalPartyBase += amount;
    } else {
      publicUtilityBase += amount;
    }
  }

  // Art. 68.3.c: base màxima de 600 € per a aportacions a partits polítics
  const politicalPartyCappedBase = Math.min(politicalPartyBase, DONATION_POLITICAL_PARTY_MAX_BASE);

  let cappedDeduction =
    publicUtilityBase * DONATION_PUBLIC_UTILITY_RATE +
    politicalPartyCappedBase * DONATION_POLITICAL_PARTY_RATE;

  // Art. 68.3, pàrraf final: la base de les deduccions b) i c) no pot superar el 10% de la base liquidable
  const cappedBase = publicUtilityBase + politicalPartyCappedBase;
  if (cappedBase > 0 && liquidableBase > 0) {
    const maxBase = liquidableBase * DONATION_CAPPED_BASE_LIMIT_RATE;
    if (cappedBase > maxBase) {
      cappedDeduction *= maxBase / cappedBase;
    }
  }

  return mecenatgeDeduction + cappedDeduction;
}

/**
 * Deducció per maternitat (Art. 81 LIRPF i STS 8/2024).
 * 100 €/mes per mare treballadora per cada fill < 3 anys (màx 1.200 € per descendent).
 * + Increment per despeses de guarderia / centres d'educació infantil (fins a 1.000 € addicionals per descendent).
 */
function computeMaternityDeduction(data: DeclaracionData): number {
  if (!data.deductions.maternityDeduction) return 0;
  
  // Garantisme: computar el límit per cada descendent menor de 3 anys
  const eligibleChildren = (data.personal?.descendants || []).filter(d => (d.age || 0) < 3).length;
  const numChildren = Math.max(1, eligibleChildren);
  const maxBaseAllowed = MATERNITY_DEDUCTION_MAX * numChildren;
  const maxNurseryAllowed = MATERNITY_NURSERY_MAX * numChildren;

  const months = Math.min(Math.max(0, data.deductions.maternityMonths || 0), 12 * numChildren);
  const baseMaternity = Math.min(months * MATERNITY_DEDUCTION_PER_MONTH, maxBaseAllowed);
  const nurseryExtra = Math.min(data.deductions.maternityNurseryExpenses || 0, maxNurseryAllowed);

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
