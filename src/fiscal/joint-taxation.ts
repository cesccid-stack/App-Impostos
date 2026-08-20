/**
 * @module fiscal/joint-taxation
 * Motor de càlcul de Tributació Conjunta i Comparador Individual vs Conjunta (Art. 82-84 LIRPF).
 */

import type { DeclaracionData, FiscalResult } from '../types.ts';
import { calculateIRPF } from './irpf.ts';

export interface JointComparisonResult {
  spouse1Result: FiscalResult;
  spouse2Result: FiscalResult;
  sumIndividualsTax: number;       // Suma de quotes netes individuals
  sumIndividualsResult: number;    // Suma de resultats individuals (a pagar/tornar)
  
  jointData: DeclaracionData;
  jointResult: FiscalResult;
  
  taxDifference: number;           // Estalvi en quota (positiu = millor conjunta, negatiu = millor individual)
  resultDifference: number;        // Diferencial en resultat a pagar/tornar
  recommendedOption: 'joint' | 'individual' | 'equal';
  savingsAmount: number;           // Import absolut de l'estalvi (€)
  reasoning: string;
}

/**
 * Combina dues declaracions individuals d'una unitat familiar en una declaració conjunta (Art. 82 LIRPF).
 */
export function combineDeclarationsForJoint(
  spouse1: DeclaracionData,
  spouse2: DeclaracionData,
  isSingleParent: boolean = false
): DeclaracionData {
  const year = spouse1.year || 2024;

  // Combinar descendents sense duplicar
  const combinedDescendants = [...(spouse1.personal?.descendants || [])];
  (spouse2.personal?.descendants || []).forEach(d2 => {
    // Si no té id coincident o té id diferent
    if (!combinedDescendants.some(d1 => d1.id === d2.id)) {
      combinedDescendants.push(d2);
    }
  });

  // Combinar ascendents
  const combinedAscendants = [...(spouse1.personal?.ascendants || [])];
  (spouse2.personal?.ascendants || []).forEach(a2 => {
    if (!combinedAscendants.some(a1 => a1.id === a2.id)) {
      combinedAscendants.push(a2);
    }
  });

  // Combinar feina
  const combinedEmployers = [
    ...(spouse1.workIncome?.employers || []),
    ...(spouse2.workIncome?.employers || []),
  ];

  // Combinar immobles
  const combinedProperties = [
    ...(spouse1.properties || []),
    ...(spouse2.properties || []),
  ];

  // Combinar guanys patrimonials
  const combinedGainItems = [
    ...(spouse1.gains?.items || []),
    ...(spouse2.gains?.items || []),
  ];

  // Combinar donatius
  const combinedDonations = [
    ...(spouse1.deductions?.donations || []),
    ...(spouse2.deductions?.donations || []),
  ];

  return {
    year,
    personal: {
      name: `${spouse1.personal?.name || 'Declarant 1'} & ${spouse2.personal?.name || 'Declarant 2'}`,
      age: Math.max(spouse1.personal?.age || 35, spouse2.personal?.age || 35),
      disability: Math.max(spouse1.personal?.disability || 0, spouse2.personal?.disability || 0),
      descendants: combinedDescendants,
      ascendants: combinedAscendants,
      community: spouse1.personal?.community || 'CAT',
      taxDeclarationType: isSingleParent ? 'single_parent' : 'joint',
    },
    workIncome: {
      employers: combinedEmployers,
      unionFees: (spouse1.workIncome?.unionFees || 0) + (spouse2.workIncome?.unionFees || 0),
      otherDeductible: (spouse1.workIncome?.otherDeductible || 0) + (spouse2.workIncome?.otherDeductible || 0),
      pensionContributions: (spouse1.workIncome?.pensionContributions || 0) + (spouse2.workIncome?.pensionContributions || 0),
    },
    capitalIncome: {
      interests: (spouse1.capitalIncome?.interests || 0) + (spouse2.capitalIncome?.interests || 0),
      dividends: (spouse1.capitalIncome?.dividends || 0) + (spouse2.capitalIncome?.dividends || 0),
      foreignDividends: (spouse1.capitalIncome?.foreignDividends || 0) + (spouse2.capitalIncome?.foreignDividends || 0),
      foreignTaxWithheld: (spouse1.capitalIncome?.foreignTaxWithheld || 0) + (spouse2.capitalIncome?.foreignTaxWithheld || 0),
      insuranceGains: (spouse1.capitalIncome?.insuranceGains || 0) + (spouse2.capitalIncome?.insuranceGains || 0),
      otherMobiliary: (spouse1.capitalIncome?.otherMobiliary || 0) + (spouse2.capitalIncome?.otherMobiliary || 0),
      mobiliaryWithholdings: (spouse1.capitalIncome?.mobiliaryWithholdings || 0) + (spouse2.capitalIncome?.mobiliaryWithholdings || 0),
      rentalIncome: (spouse1.capitalIncome?.rentalIncome || 0) + (spouse2.capitalIncome?.rentalIncome || 0),
      rentalExpenses: (spouse1.capitalIncome?.rentalExpenses || 0) + (spouse2.capitalIncome?.rentalExpenses || 0),
      imputedIncome: (spouse1.capitalIncome?.imputedIncome || 0) + (spouse2.capitalIncome?.imputedIncome || 0),
      realEstateWithholdings: (spouse1.capitalIncome?.realEstateWithholdings || 0) + (spouse2.capitalIncome?.realEstateWithholdings || 0),
    },
    properties: combinedProperties,
    activities: {
      income: (spouse1.activities?.income || 0) + (spouse2.activities?.income || 0),
      expenses: (spouse1.activities?.expenses || 0) + (spouse2.activities?.expenses || 0),
      withholdings: (spouse1.activities?.withholdings || 0) + (spouse2.activities?.withholdings || 0),
      socialSecuritySelfEmployed: (spouse1.activities?.socialSecuritySelfEmployed || 0) + (spouse2.activities?.socialSecuritySelfEmployed || 0),
      estimationType: spouse1.activities?.estimationType || 'direct_simplified',
    },
    gains: {
      items: combinedGainItems,
      totalWithholdings: (spouse1.gains?.totalWithholdings || 0) + (spouse2.gains?.totalWithholdings || 0),
    },
    deductions: {
      housingDeduction: spouse1.deductions?.housingDeduction || spouse2.deductions?.housingDeduction || false,
      housingAmountsPaid: Math.min(9040, (spouse1.deductions?.housingAmountsPaid || 0) + (spouse2.deductions?.housingAmountsPaid || 0)), // Límit màxim per declaració
      donations: combinedDonations,
      maternityDeduction: spouse1.deductions?.maternityDeduction || spouse2.deductions?.maternityDeduction || false,
      maternityMonths: Math.max(spouse1.deductions?.maternityMonths || 0, spouse2.deductions?.maternityMonths || 0),
      maternityNurseryExpenses: Math.max(spouse1.deductions?.maternityNurseryExpenses || 0, spouse2.deductions?.maternityNurseryExpenses || 0),
      pensionPlanContributions: (spouse1.deductions?.pensionPlanContributions || 0) + (spouse2.deductions?.pensionPlanContributions || 0),
      companyPensionContributions: (spouse1.deductions?.companyPensionContributions || 0) + (spouse2.deductions?.companyPensionContributions || 0),
      energyEfficiencyType: spouse1.deductions?.energyEfficiencyType || spouse2.deductions?.energyEfficiencyType || 'none',
      energyEfficiencyAmount: (spouse1.deductions?.energyEfficiencyAmount || 0) + (spouse2.deductions?.energyEfficiencyAmount || 0),
      otherDeductions: (spouse1.deductions?.otherDeductions || 0) + (spouse2.deductions?.otherDeductions || 0),
      catalanRentalDeduction: spouse1.deductions?.catalanRentalDeduction || spouse2.deductions?.catalanRentalDeduction || false,
      catalanRentalAmount: (spouse1.deductions?.catalanRentalAmount || 0) + (spouse2.deductions?.catalanRentalAmount || 0),
      catalanRentalSituation: spouse1.deductions?.catalanRentalSituation || spouse2.deductions?.catalanRentalSituation || 'none',
      catalanBirthAdoption: (spouse1.deductions?.catalanBirthAdoption || 0) + (spouse2.deductions?.catalanBirthAdoption || 0),
      catalanStartupInvestment: (spouse1.deductions?.catalanStartupInvestment || 0) + (spouse2.deductions?.catalanStartupInvestment || 0),
      catalanStartupIsResearchOrUniversity: spouse1.deductions?.catalanStartupIsResearchOrUniversity || spouse2.deductions?.catalanStartupIsResearchOrUniversity,
      catalanWidowhood: spouse1.deductions?.catalanWidowhood || spouse2.deductions?.catalanWidowhood,
      catalanWidowhoodWithDependents: spouse1.deductions?.catalanWidowhoodWithDependents || spouse2.deductions?.catalanWidowhoodWithDependents,
      catalanAgaurMasterLoanInterests: (spouse1.deductions?.catalanAgaurMasterLoanInterests || 0) + (spouse2.deductions?.catalanAgaurMasterLoanInterests || 0),
      catalanLanguageDonations: (spouse1.deductions?.catalanLanguageDonations || 0) + (spouse2.deductions?.catalanLanguageDonations || 0),
      catalanBiomedicalDonations: (spouse1.deductions?.catalanBiomedicalDonations || 0) + (spouse2.deductions?.catalanBiomedicalDonations || 0),
      catalanHomeRehabilitation: (spouse1.deductions?.catalanHomeRehabilitation || 0) + (spouse2.deductions?.catalanHomeRehabilitation || 0),
    },
  };
}

/**
 * Compara completament l'opció Individual vs Conjunta i genera el dictamen d'estalvi.
 */
export function compareIndividualVsJoint(
  spouse1: DeclaracionData,
  spouse2: DeclaracionData,
  isSingleParent: boolean = false
): JointComparisonResult {
  // Assegurar tipus individual
  const s1Data = { ...spouse1, personal: { ...spouse1.personal, taxDeclarationType: 'individual' as const } };
  const s2Data = { ...spouse2, personal: { ...spouse2.personal, taxDeclarationType: 'individual' as const } };

  const spouse1Result = calculateIRPF(s1Data);
  const spouse2Result = calculateIRPF(s2Data);

  const sumIndividualsTax = spouse1Result.netTax + spouse2Result.netTax;
  const sumIndividualsResult = spouse1Result.result + spouse2Result.result;

  const jointData = combineDeclarationsForJoint(spouse1, spouse2, isSingleParent);
  const jointResult = calculateIRPF(jointData);

  // Diferència de resultat: si individual dona pagar 1.000€ i conjunta dona pagar 600€, estalvi és 400€
  // Resultat positiu = a pagar, negatiu = a tornar
  const resultDiff = sumIndividualsResult - jointResult.result; // > 0 -> Conjunta és millor (pagues menys o et tornen més)

  let recommendedOption: 'joint' | 'individual' | 'equal' = 'equal';
  let savingsAmount = Math.abs(resultDiff);
  let reasoning = '';

  if (resultDiff > 0.01) {
    recommendedOption = 'joint';
    reasoning = `La tributació conjunta és la millor opció. Us estalvieu ${savingsAmount.toFixed(2)} € gràcies a la reducció de ${isSingleParent ? '2.150 €' : '3.400 €'} i/o la compensació de rendiments entre cònjuges.`;
  } else if (resultDiff < -0.01) {
    recommendedOption = 'individual';
    reasoning = `La tributació individual és més favorable. Us estalvieu ${savingsAmount.toFixed(2)} € fent dues declaracions separades (gaudiu de dos mínims personals de 5.550 € i no salteu de tram en l'escala progressiva).`;
  } else {
    recommendedOption = 'equal';
    reasoning = 'Totes dues modalitats produeixen exactament el mateix resultat fiscal.';
  }

  return {
    spouse1Result,
    spouse2Result,
    sumIndividualsTax,
    sumIndividualsResult,
    jointData,
    jointResult,
    taxDifference: sumIndividualsTax - jointResult.netTax,
    resultDifference: resultDiff,
    recommendedOption,
    savingsAmount,
    reasoning,
  };
}
