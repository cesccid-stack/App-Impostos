/**
 * @module fiscal/deductions-cat
 * Deduccions autonòmiques específiques de Catalunya (IRPF 2024-2026).
 * Conforme al Text Refós de la Llei de Taxes i Preus Públics de la Generalitat de Catalunya
 * i la normativa reguladora del tram autonòmic de l'IRPF a Catalunya.
 */

import type { DeclaracionData } from '../types.ts';
import {
  CAT_RENTAL_RATE,
  CAT_RENTAL_LIMIT_GENERAL,
  CAT_RENTAL_LIMIT_SPECIAL,
  CAT_RENTAL_INCOME_LIMIT_INDIVIDUAL,
  CAT_RENTAL_INCOME_LIMIT_SPECIAL,
  CAT_BIRTH_INDIVIDUAL,
  CAT_BIRTH_SPECIAL,
  CAT_STARTUP_GENERAL_RATE,
  CAT_STARTUP_GENERAL_MAX,
  CAT_STARTUP_RESEARCH_RATE,
  CAT_STARTUP_RESEARCH_MAX,
  CAT_WIDOWHOOD_GENERAL,
  CAT_WIDOWHOOD_WITH_DEPENDENTS,
  CAT_LANGUAGE_DONATION_RATE,
  CAT_BIOMEDICAL_DONATION_RATE,
  CAT_HOME_REHAB_RATE,
  CAT_HOME_REHAB_MAX_BASE,
} from './constants.ts';

export function computeCatalanDeductions(data: DeclaracionData): number {
  const d = data.deductions;
  const isSpecialFamily = d.catalanRentalSituation === 'large_family' || d.catalanRentalSituation === 'single_parent' || data.personal.taxDeclarationType === 'single_parent';
  const isJointOrSpecial = data.personal.taxDeclarationType === 'joint' || isSpecialFamily;

  let totalCatalan = 0;

  // 1. Deducció per lloguer de l'habitatge habitual (arrendatari)
  if (d.catalanRentalDeduction && d.catalanRentalAmount > 0 && d.catalanRentalSituation !== 'none') {
    // Límit de base imposable: 20.000€ individual / 30.000€ família nombrosa o conjunta
    const maxIncomeThreshold = isSpecialFamily || data.personal.taxDeclarationType === 'joint'
      ? CAT_RENTAL_INCOME_LIMIT_SPECIAL
      : CAT_RENTAL_INCOME_LIMIT_INDIVIDUAL;

    // Càlcul ràpid de la base imposable estimada
    const workNet = Math.max(0, (data.workIncome.employers.reduce((s, e) => s + e.grossSalary + e.inKind, 0)) - (data.workIncome.employers.reduce((s, e) => s + e.socialSecurity, 0) + 2000));
    const estimatedBase = workNet + (data.activities.income - data.activities.expenses);

    // Només s'aplica si compleix els límits de renda (o si la base estimada és inferior)
    if (estimatedBase <= maxIncomeThreshold || maxIncomeThreshold === Infinity) {
      const maxLimit = isSpecialFamily || data.personal.taxDeclarationType === 'joint'
        ? CAT_RENTAL_LIMIT_SPECIAL
        : CAT_RENTAL_LIMIT_GENERAL;

      const deduction = Math.min(d.catalanRentalAmount * CAT_RENTAL_RATE, maxLimit);
      totalCatalan += deduction;
    }
  }

  // 2. Naixement o adopció de fills a Catalunya
  if (d.catalanBirthAdoption > 0) {
    const ratePerChild = isJointOrSpecial ? CAT_BIRTH_SPECIAL : CAT_BIRTH_INDIVIDUAL;
    totalCatalan += d.catalanBirthAdoption * ratePerChild;
  }

  // 3. Inversió en empreses de nova o recent creació (Startups Catalunya)
  if (d.catalanStartupInvestment > 0) {
    if (d.catalanStartupIsResearchOrUniversity) {
      // 50% fins a 12.000€ per a societats creades per universitats o centres de recerca
      const deduction = Math.min(d.catalanStartupInvestment * CAT_STARTUP_RESEARCH_RATE, CAT_STARTUP_RESEARCH_MAX);
      totalCatalan += deduction;
    } else {
      // 30% fins a 6.000€ general
      const deduction = Math.min(d.catalanStartupInvestment * CAT_STARTUP_GENERAL_RATE, CAT_STARTUP_GENERAL_MAX);
      totalCatalan += deduction;
    }
  }

  // 4. Viduïtat a Catalunya
  if (d.catalanWidowhood) {
    totalCatalan += d.catalanWidowhoodWithDependents 
      ? CAT_WIDOWHOOD_WITH_DEPENDENTS 
      : CAT_WIDOWHOOD_GENERAL;
  }

  // 5. Interessos de préstecs per a estudis de màster i doctorat (AGAUR)
  if (d.catalanAgaurMasterLoanInterests && d.catalanAgaurMasterLoanInterests > 0) {
    totalCatalan += d.catalanAgaurMasterLoanInterests; // 100% deduïble
  }

  // 6. Donacions al foment de la llengua catalana o aranesa
  if (d.catalanLanguageDonations && d.catalanLanguageDonations > 0) {
    totalCatalan += d.catalanLanguageDonations * CAT_LANGUAGE_DONATION_RATE; // 15%
  }

  // 7. Donacions a entitats de recerca biomèdica i universitats de Catalunya
  if (d.catalanBiomedicalDonations && d.catalanBiomedicalDonations > 0) {
    totalCatalan += d.catalanBiomedicalDonations * CAT_BIOMEDICAL_DONATION_RATE; // 25%
  }

  // 8. Rehabilitació de l'habitatge habitual a Catalunya
  if (d.catalanHomeRehabilitation && d.catalanHomeRehabilitation > 0) {
    const base = Math.min(d.catalanHomeRehabilitation, CAT_HOME_REHAB_MAX_BASE);
    totalCatalan += base * CAT_HOME_REHAB_RATE; // 1,5%
  }

  return totalCatalan;
}
