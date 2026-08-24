/**
 * @module fiscal/irpf
 * IRPF tax calculation engine.
 * Computes the full tax result from a DeclaracionData, including 7.p, irregular income,
 * capital gains exemptions, 25% cross-compensation, and 4-year loss carryover.
 */

import type { DeclaracionData, FiscalResult, GainItem } from '../types.ts';
import {
  STATE_GENERAL_TAX_BRACKETS,
  CATALAN_GENERAL_TAX_BRACKETS,
  STATE_SAVINGS_TAX_BRACKETS,
  AUTONOMIC_SAVINGS_TAX_BRACKETS,
  PERSONAL_MINIMUM,
  PERSONAL_MINIMUM_OVER_65,
  PERSONAL_MINIMUM_OVER_75,
  DESCENDANT_MINIMUMS,
  DESCENDANT_UNDER_3_EXTRA,
  ASCENDANT_MINIMUM_OVER_65,
  ASCENDANT_MINIMUM_OVER_75_EXTRA,
  DISABILITY_MINIMUM_33,
  DISABILITY_MINIMUM_65,
  WORK_OTHER_EXPENSES,
  WORK_REDUCTION_THRESHOLD_LOW,
  WORK_REDUCTION_THRESHOLD_HIGH,
  WORK_REDUCTION_MAX,
  WORK_REDUCTION_COEFFICIENT,
  PENSION_PLAN_LIMIT,
  PENSION_PLAN_COMPANY_LIMIT,
  JOINT_TAXATION_REDUCTION_MATRIMONY,
  JOINT_TAXATION_REDUCTION_SINGLE_PARENT,
  SIMPLIFIED_EXPENSES_RATE,
  SIMPLIFIED_EXPENSES_MAX,
  type TaxBracket,
} from './constants.ts';
import { computeDeductions } from './deductions.ts';
import { computeCatalanDeductions } from './deductions-cat.ts';
import { calculateAllProperties } from './real-estate-engine.ts';
import { calculateSavingsCompensation } from './loss-carryover-engine.ts';
import { calculateComplementaryIRPF } from './complementary-engine.ts';

/**
 * Apply progressive tax brackets to a given base amount.
 */
export function applyBrackets(
  amount: number,
  brackets: readonly TaxBracket[],
): number {
  if (amount <= 0) return 0;

  let remaining = amount;
  let tax = 0;
  let previousLimit = 0;

  for (const bracket of brackets) {
    const tierSize = bracket.upTo - previousLimit;
    const taxableInTier = Math.min(remaining, tierSize);
    tax += taxableInTier * bracket.rate;
    remaining -= taxableInTier;
    previousLimit = bracket.upTo;
    if (remaining <= 0) break;
  }

  return tax;
}

/**
 * Compute the effective tax rate for a given amount and brackets.
 */
export function effectiveRate(
  amount: number,
  brackets: readonly TaxBracket[],
): number {
  if (amount <= 0) return 0;
  return applyBrackets(amount, brackets) / amount;
}

/**
 * Compute net work income (rendimiento neto del trabajo) including Art. 7.p and Art. 18.2.
 */
function computeNetWorkIncome(data: DeclaracionData): {
  netIncome: number;
  reduction: number;
  foreignWorkExemptionApplied: number;
  irregularWorkReduction: number;
} {
  const w = data.workIncome;
  
  let totalGrossSalary = 0;
  let totalInKind = 0;
  let totalSocialSecurity = 0;
  let totalTaxableDiets = 0;
  let totalTaxableMileage = 0;

  for (const emp of (w.employers || [])) {
    totalGrossSalary += emp.grossSalary || 0;
    totalInKind += emp.inKind || 0;
    totalSocialSecurity += emp.socialSecurity || 0;
    
    const dietsExempt = (emp.dietsDays || 0) * 26.67;
    const mileageExempt = (emp.mileageKm || 0) * 0.26;

    totalTaxableDiets += Math.max(0, (emp.dietsIncome || 0) - dietsExempt);
    totalTaxableMileage += Math.max(0, (emp.mileageIncome || 0) - mileageExempt);
  }

  // 1. Exempció per treballs a l'estranger (Art. 7.p LIRPF - Màx 60.100 €)
  const foreignWorkExemptionApplied = Math.min(60100, Math.max(0, w.foreignWorkExemption7p || 0));
  const rawSalary = totalGrossSalary + totalInKind + totalTaxableDiets + totalTaxableMileage;
  const grossAfterExemption = Math.max(0, rawSalary - foreignWorkExemptionApplied);

  // 2. Reducció del 30% per rendiments irregulars o > 2 anys (Art. 18.2 LIRPF - Base màx 300.000 €)
  const irregularBase = Math.min(300000, Math.max(0, w.irregularIncomeAmount || 0));
  const irregularWorkReduction = irregularBase * 0.30;
  const grossIncome = Math.max(0, grossAfterExemption - irregularWorkReduction);

  // 3. Despeses deduïbles
  const deductibleExpenses =
    totalSocialSecurity + (w.unionFees || 0) + (w.otherDeductible || 0) + WORK_OTHER_EXPENSES;
  const netIncome = Math.max(0, grossIncome - deductibleExpenses);

  // 4. Reducció per rendiments del treball
  let reduction = 0;
  if (netIncome <= WORK_REDUCTION_THRESHOLD_LOW) {
    reduction = WORK_REDUCTION_MAX;
  } else if (netIncome <= WORK_REDUCTION_THRESHOLD_HIGH) {
    reduction =
      WORK_REDUCTION_MAX -
      WORK_REDUCTION_COEFFICIENT * (netIncome - WORK_REDUCTION_THRESHOLD_LOW);
  }
  reduction = Math.max(0, reduction);

  return { netIncome, reduction, foreignWorkExemptionApplied, irregularWorkReduction };
}

/**
 * Compute net capital income split into mobiliary and immobiliary.
 */
function computeCapitalIncome(data: DeclaracionData): {
  mobiliary: number;
  immobiliary: number;
  foreignDividends: number;
  foreignTaxWithheld: number;
} {
  const c = data.capitalIncome || {
    interests: 0,
    dividends: 0,
    insuranceGains: 0,
    otherMobiliary: 0,
    mobiliaryWithholdings: 0,
    foreignDividends: 0,
    foreignTaxWithheld: 0,
    rentalIncome: 0,
    rentalExpenses: 0,
    imputedIncome: 0,
    realEstateWithholdings: 0,
  };
  
  const foreignDividends = c.foreignDividends || 0;
  const foreignTaxWithheld = c.foreignTaxWithheld || 0;

  const mobiliary =
    (c.interests || 0) + (c.dividends || 0) + foreignDividends + (c.insuranceGains || 0) + (c.otherMobiliary || 0);
  
  let rentalReduced = 0;
  let imputedFromProperties = 0;
  if (data.properties && data.properties.length > 0) {
    const { totalNetReducedIncome, totalImputedIncome } = calculateAllProperties(data.properties, data.year || 2024);
    rentalReduced = totalNetReducedIncome;
    imputedFromProperties = totalImputedIncome;
  } else {
    const rentalNet = Math.max(0, (c.rentalIncome || 0) - (c.rentalExpenses || 0));
    rentalReduced = rentalNet * 0.4;
  }

  const immobiliary = rentalReduced + (c.imputedIncome || 0) + imputedFromProperties;

  return { mobiliary, immobiliary, foreignDividends, foreignTaxWithheld };
}

/**
 * Compute net income from economic activities.
 */
function computeActivitiesIncome(data: DeclaracionData): number {
  const a = data.activities || {
    income: 0,
    expenses: 0,
    withholdings: 0,
    socialSecuritySelfEmployed: 0,
    estimationType: 'direct_simplified',
  };
  const netIncome = (a.income || 0) - (a.expenses || 0) - (a.socialSecuritySelfEmployed || 0);

  if (a.estimationType === 'direct_simplified') {
    const simplifiedExpenses = Math.min(
      Math.max(0, netIncome) * SIMPLIFIED_EXPENSES_RATE,
      SIMPLIFIED_EXPENSES_MAX,
    );
    return Math.max(0, netIncome - simplifiedExpenses);
  }

  return Math.max(0, netIncome);
}

/**
 * Compute total capital gains taking into account wash sales and statutory exemptions (Art. 33.4.b, Art. 38).
 */
function computeGains(items: GainItem[] = []): number {
  return items.reduce((total, item) => {
    let rawGain = (item.transferValue || 0) - (item.acquisitionValue || 0) - (item.expenses || 0);

    // 1. Exempció per venda d'habitatge habitual per majors de 65 anys (Art. 33.4.b)
    if (item.isPrimaryResidenceExemptOver65 && rawGain > 0) {
      rawGain = 0;
    }

    // 2. Exempció per reinversió en habitatge habitual (Art. 38.1 - Caselles 0361-0370)
    if (item.isPrimaryResidenceReinvestment && rawGain > 0 && item.reinvestmentAmount && item.transferValue > 0) {
      const reinvestmentRatio = Math.min(1, item.reinvestmentAmount / item.transferValue);
      rawGain = rawGain * (1 - reinvestmentRatio);
    }

    // 3. Exempció per renda vitalícia per majors de 65 anys (Art. 38.3 - màx 240.000 €)
    if (item.isLifeAnnuityExemptOver65 && rawGain > 0 && item.lifeAnnuityAmount && item.transferValue > 0) {
      const lifeAnnuityCapped = Math.min(240000, item.lifeAnnuityAmount);
      const annuityRatio = Math.min(1, lifeAnnuityCapped / item.transferValue);
      rawGain = rawGain * (1 - annuityRatio);
    }

    // 4. Regla dels 2 mesos / 1 any (pèrdua no computable)
    if (rawGain < 0) {
      if (item.nonComputableLossAmount !== undefined && item.nonComputableLossAmount > 0) {
        const computableLoss = rawGain + item.nonComputableLossAmount;
        return total + computableLoss;
      } else if (item.isNonComputableLoss) {
        return total;
      }
    }
    
    return total + rawGain;
  }, 0);
}

/**
 * Compute personal and family minimum.
 */
function computeMinimums(data: DeclaracionData): {
  personalMinimum: number;
  descendantsMinimum: number;
  ascendantsMinimum: number;
  totalMinimum: number;
} {
  let personalMinimum = PERSONAL_MINIMUM;
  const age = data.personal?.age || 35;
  if (age >= 75) {
    personalMinimum = PERSONAL_MINIMUM_OVER_75;
  } else if (age >= 65) {
    personalMinimum = PERSONAL_MINIMUM_OVER_65;
  }

  const disability = data.personal?.disability || 0;
  if (disability >= 65) {
    personalMinimum += DISABILITY_MINIMUM_65;
  } else if (disability >= 33) {
    personalMinimum += DISABILITY_MINIMUM_33;
  }

  let descendantsMinimum = 0;
  (data.personal?.descendants || []).forEach((desc, index) => {
    const bracketIndex = Math.min(index, DESCENDANT_MINIMUMS.length - 1);
    let min = DESCENDANT_MINIMUMS[bracketIndex];
    if ((desc.age || 0) < 3) {
      min += DESCENDANT_UNDER_3_EXTRA;
    }
    if ((desc.disability || 0) >= 65) {
      min += DISABILITY_MINIMUM_65;
    } else if ((desc.disability || 0) >= 33) {
      min += DISABILITY_MINIMUM_33;
    }
    descendantsMinimum += min;
  });

  let ascendantsMinimum = 0;
  (data.personal?.ascendants || []).forEach((asc) => {
    if ((asc.age || 0) >= 75) {
      ascendantsMinimum +=
        ASCENDANT_MINIMUM_OVER_65 + ASCENDANT_MINIMUM_OVER_75_EXTRA;
    } else if ((asc.age || 0) >= 65) {
      ascendantsMinimum += ASCENDANT_MINIMUM_OVER_65;
    }
    if ((asc.disability || 0) >= 65) {
      ascendantsMinimum += DISABILITY_MINIMUM_65;
    } else if ((asc.disability || 0) >= 33) {
      ascendantsMinimum += DISABILITY_MINIMUM_33;
    }
  });

  const totalMinimum =
    personalMinimum + descendantsMinimum + ascendantsMinimum;

  return {
    personalMinimum,
    descendantsMinimum,
    ascendantsMinimum,
    totalMinimum,
  };
}

const irpfCache = new WeakMap<DeclaracionData, FiscalResult>();

/**
 * Main calculation: computes the full FiscalResult from input data.
 * Memoized via WeakMap for sub-millisecond repeated lookups.
 */
export function calculateIRPF(data: DeclaracionData, bypassCache = false): FiscalResult {
  if (!bypassCache && irpfCache.has(data)) {
    return irpfCache.get(data)!;
  }
  const result = computeIRPFInternal(data);
  irpfCache.set(data, result);
  return result;
}

function computeIRPFInternal(data: DeclaracionData): FiscalResult {
  // 1. Compute base imposable general
  const { netIncome: netWork, reduction: workReduction, foreignWorkExemptionApplied, irregularWorkReduction } =
    computeNetWorkIncome(data);
  const { mobiliary, immobiliary, foreignDividends, foreignTaxWithheld } = computeCapitalIncome(data);
  const activitiesNet = computeActivitiesIncome(data);
  const capitalGains = computeGains(data.gains?.items || []);

  // Compensació de l'estalvi amb regla del 25% i bossa de 4 anys
  const priorMob = data.lossCarryovers?.pendingMobiliaryLosses || [];
  const priorGains = data.lossCarryovers?.pendingCapitalLosses || [];
  const savingsComp = calculateSavingsCompensation(mobiliary, capitalGains, priorMob, priorGains);

  // General base: work + immobiliary + activities
  const generalBase = netWork + immobiliary + activitiesNet;

  // Savings base: base de l'estalvi resultant de la integració i compensació
  const savingsBase = savingsComp.finalSavingsBase;

  // 2. Reductions
  const personalPension = Math.min(
    (data.deductions?.pensionPlanContributions || 0) + (data.workIncome?.pensionContributions || 0),
    PENSION_PLAN_LIMIT,
  );
  const companyPension = Math.min(
    data.deductions?.companyPensionContributions || 0,
    PENSION_PLAN_COMPANY_LIMIT,
  );
  const pensionReduction = personalPension + companyPension;

  let jointTaxationReduction = 0;
  if (data.personal?.taxDeclarationType === 'joint') {
    jointTaxationReduction = JOINT_TAXATION_REDUCTION_MATRIMONY;
  } else if (data.personal?.taxDeclarationType === 'single_parent') {
    jointTaxationReduction = JOINT_TAXATION_REDUCTION_SINGLE_PARENT;
  }

  const totalReductions = workReduction + pensionReduction + jointTaxationReduction;

  // 3. Base liquidable
  const liquidableGeneralBase = Math.max(0, generalBase - totalReductions);
  const liquidableSavingsBase = Math.max(0, savingsBase);

  // 4. Minimums
  const minimums = computeMinimums(data);

  // 5. Tax calculation (State + Autonomic)
  const stateGeneralTax = applyBrackets(liquidableGeneralBase, STATE_GENERAL_TAX_BRACKETS);
  const autonomicGeneralTax = applyBrackets(liquidableGeneralBase, CATALAN_GENERAL_TAX_BRACKETS);
  const generalTax = stateGeneralTax + autonomicGeneralTax;

  const stateSavingsTax = applyBrackets(liquidableSavingsBase, STATE_SAVINGS_TAX_BRACKETS);
  const autonomicSavingsTax = applyBrackets(liquidableSavingsBase, AUTONOMIC_SAVINGS_TAX_BRACKETS);
  const savingsTax = stateSavingsTax + autonomicSavingsTax;

  const stateMinimumTaxCredit = applyBrackets(minimums.totalMinimum, STATE_GENERAL_TAX_BRACKETS);
  const autonomicMinimumTaxCredit = applyBrackets(minimums.totalMinimum, CATALAN_GENERAL_TAX_BRACKETS);
  const minimumTaxCredit = stateMinimumTaxCredit + autonomicMinimumTaxCredit;

  const grossTax = Math.max(0, generalTax + savingsTax - minimumTaxCredit);

  // 6. Deduccions Generals i Autonòmiques
  const deductionAmounts = computeDeductions(data);
  const catalanDeductionsAmount = computeCatalanDeductions(data);

  // 7. Deducció per Doble Imposició Internacional (Art. 80 LIRPF - Casella 0588)
  let foreignTaxCredit = 0;
  if (foreignDividends > 0 && foreignTaxWithheld > 0 && liquidableSavingsBase > 0) {
    const totalSavingsTax = stateSavingsTax + autonomicSavingsTax;
    const effectiveSavingsRate = totalSavingsTax / liquidableSavingsBase;
    const spanishTaxOnForeignIncome = foreignDividends * effectiveSavingsRate;
    foreignTaxCredit = Math.min(foreignTaxWithheld, spanishTaxOnForeignIncome);
  }
  
  const totalDeductions =
    deductionAmounts.housingDeductionAmount +
    deductionAmounts.donationsDeductionAmount +
    deductionAmounts.maternityDeductionAmount +
    deductionAmounts.energyEfficiencyDeductionAmount +
    catalanDeductionsAmount +
    foreignTaxCredit +
    (data.deductions?.otherDeductions || 0);

  // 8. Net tax
  const netTax = Math.max(0, grossTax - totalDeductions);

  const totalWorkWithholdings = (data.workIncome?.employers || []).reduce((sum, emp) => sum + (emp.withholdings || 0), 0);

  // 9. Withholdings
  const totalWithholdings =
    totalWorkWithholdings +
    (data.capitalIncome?.mobiliaryWithholdings || 0) +
    (data.capitalIncome?.realEstateWithholdings || 0) +
    (data.activities?.withholdings || 0) +
    (data.gains?.totalWithholdings || 0);

  // 10. Result
  const result = netTax - totalWithholdings;

  // 11. Declaració Complementària o Rectificativa (Model 100)
  const complementaryCalc = calculateComplementaryIRPF(data, result);

  return {
    generalBase,
    savingsBase,
    workIncomeReduction: workReduction,
    foreignWorkExemptionApplied,
    irregularWorkReduction,
    pensionReduction,
    jointTaxationReduction,
    totalReductions,
    liquidableGeneralBase,
    liquidableSavingsBase,
    ...minimums,
    stateGeneralTax,
    stateSavingsTax,
    stateMinimumTaxCredit,
    autonomicGeneralTax,
    autonomicSavingsTax,
    autonomicMinimumTaxCredit,
    generalTax,
    savingsTax,
    minimumTaxCredit,
    grossTax,
    netMobiliaryBalance: savingsComp.initialMobiliary,
    netGainsBalance: savingsComp.initialGains,
    crossCompensationAmount: savingsComp.crossCompensationApplied,
    priorLossesCompensated: savingsComp.totalPriorCompensated,
    ...deductionAmounts,
    catalanDeductionsAmount,
    foreignTaxCredit,
    totalDeductions,
    netTax,
    totalWithholdings,
    result,
    isComplementary: complementaryCalc.isComplementary,
    complementaryReason: complementaryCalc.reason,
    previousReceiptNumber: complementaryCalc.previousReceiptNumber,
    previousResult: complementaryCalc.previousResult,
    differentialResult: complementaryCalc.differentialAmount,
    surchargeExtemporaneous: complementaryCalc.surcharge.finalSurchargeAmount,
    finalAmountDue: complementaryCalc.finalAmountDue,
  };
}
