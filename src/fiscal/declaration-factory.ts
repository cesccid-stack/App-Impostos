/**
 * @module fiscal/declaration-factory
 * Factory for creating fresh, empty DeclaracionData instances.
 */

import type { DeclaracionData } from '../types.ts';
import { initializeEmptyIVAData } from './iva-integration.ts';

/** Create a fresh, empty DeclaracionData for a given year and profile. */
export function createEmptyDeclaracion(year: number, profileId: string = 'profile_main'): DeclaracionData {
  return {
    year,
    profileId,
    personal: {
      name: '',
      nif: '',
      age: 35,
      disability: 0,
      descendants: [],
      ascendants: [],
      community: 'CAT',
      taxDeclarationType: 'individual',
    },
    workIncome: {
      employers: [],
      unionFees: 0,
      otherDeductible: 0,
      pensionContributions: 0,
    },
    capitalIncome: {
      interests: 0,
      dividends: 0,
      foreignDividends: 0,
      foreignTaxWithheld: 0,
      insuranceGains: 0,
      otherMobiliary: 0,
      mobiliaryWithholdings: 0,
      rentalIncome: 0,
      rentalExpenses: 0,
      imputedIncome: 0,
      realEstateWithholdings: 0,
    },
    properties: [],
    activities: {
      income: 0,
      expenses: 0,
      withholdings: 0,
      socialSecuritySelfEmployed: 0,
      estimationType: 'direct_simplified',
    },
    gains: {
      items: [],
      totalWithholdings: 0,
    },
    deductions: {
      housingDeduction: false,
      housingAmountsPaid: 0,
      donations: [],
      maternityDeduction: false,
      maternityMonths: 0,
      maternityNurseryExpenses: 0,
      pensionPlanContributions: 0,
      companyPensionContributions: 0,
      energyEfficiencyType: 'none',
      energyEfficiencyAmount: 0,
      otherDeductions: 0,
      catalanRentalDeduction: false,
      catalanRentalAmount: 0,
      catalanRentalSituation: 'none',
      catalanBirthAdoption: 0,
      catalanStartupInvestment: 0,
      catalanStartupIsResearchOrUniversity: false,
      catalanWidowhood: false,
      catalanWidowhoodWithDependents: false,
      catalanAgaurMasterLoanInterests: 0,
      catalanLanguageDonations: 0,
      catalanBiomedicalDonations: 0,
      catalanHomeRehabilitation: 0,
    },
    wealth: {
      assets: [],
      debts: [],
      community: 'CAT',
    },
    foreignAssets: {
      accounts: [],
      securities: [],
      realEstate: [],
      crypto: [],
    },
    iva: initializeEmptyIVAData(),
    quarterlyTaxes: {
      mod130: [],
      mod111: [],
      mod115: [],
    },
    patrimonialTaxes: {
      inheritance: [],
      itpAjd: [],
      plusvalia: [],
    },
    strategicAdvising: {
      autonomoVsSL: [],
      pensionRescues: [],
    },
    crypto: {
      transactions: [],
      capitalGains: [],
      defiIncome: 0,
    },
    ocrBatches: [],
    compliance: {
      verifactuRecords: [],
      officialBooks: [],
      isVerifactuEnabled: true,
    },
  };
}
