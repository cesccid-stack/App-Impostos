/**
 * @module fiscal/schema-validator
 * Zero-dependency runtime schema validator and data sanitizer.
 * Guarantees data integrity, prevents NaN corruptions, and ensures safe fallbacks
 * when loading from localStorage or importing third-party JSON files.
 */

import type { DeclaracionData, PersonalData, WorkIncomeData, CapitalIncomeData, ActivitiesData, DeductionsData, GainsData, LossCarryoversData, PriorLossItem } from '../types.ts';
import { createEmptyDeclaracion } from './declaration-factory.ts';
import { FISCAL_YEARS, type FiscalYear } from './constants.ts';

/**
 * Sanitizes an unknown input into a guaranteed finite number with fallback.
 */
export function sanitizeNumber(value: unknown, fallback = 0, min?: number, max?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(',', '.'));
      if (Number.isFinite(parsed) && !Number.isNaN(parsed)) {
        let val = parsed;
        if (min !== undefined && val < min) val = min;
        if (max !== undefined && val > max) val = max;
        return val;
      }
    }
    return fallback;
  }
  let val = value;
  if (min !== undefined && val < min) val = min;
  if (max !== undefined && val > max) val = max;
  return val;
}

/**
 * Sanitizes a boolean value.
 */
export function sanitizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

/**
 * Sanitizes a string value.
 */
export function sanitizeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

/**
 * Validates and sanitizes a complete DeclaracionData tree.
 */
export function validateAndSanitizeDeclaration(
  raw: unknown,
  fallbackYear: FiscalYear = 2024,
  fallbackProfileId: string = 'profile_main'
): DeclaracionData {
  const defaults = createEmptyDeclaracion(fallbackYear, fallbackProfileId);
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const src = raw as Partial<DeclaracionData>;

  // Year validation
  let validYear = fallbackYear;
  if (typeof src.year === 'number' && FISCAL_YEARS.includes(src.year as FiscalYear)) {
    validYear = src.year as FiscalYear;
  }

  const validProfileId = sanitizeString(src.profileId, fallbackProfileId);

  // Personal data
  const pSrc = (src.personal || {}) as Partial<PersonalData>;
  const personal: PersonalData = {
    ...defaults.personal,
    name: sanitizeString(pSrc.name, defaults.personal.name),
    nif: sanitizeString(pSrc.nif, defaults.personal.nif),
    age: sanitizeNumber(pSrc.age, 35, 0, 120),
    disability: sanitizeNumber(pSrc.disability, 0, 0, 100),
    community: sanitizeString(pSrc.community, 'CAT'),
    taxDeclarationType: pSrc.taxDeclarationType === 'joint' || pSrc.taxDeclarationType === 'single_parent'
      ? pSrc.taxDeclarationType
      : 'individual',
    descendants: Array.isArray(pSrc.descendants)
      ? pSrc.descendants.map((d, idx) => ({
          id: sanitizeString(d?.id, `desc_${idx + 1}`),
          age: sanitizeNumber(d?.age, 0, 0, 30),
          disability: sanitizeNumber(d?.disability, 0, 0, 100),
        }))
      : [],
    ascendants: Array.isArray(pSrc.ascendants)
      ? pSrc.ascendants.map((a, idx) => ({
          id: sanitizeString(a?.id, `asc_${idx + 1}`),
          age: sanitizeNumber(a?.age, 65, 0, 120),
          disability: sanitizeNumber(a?.disability, 0, 0, 100),
        }))
      : [],
  };

  // Work Income
  const wSrc = (src.workIncome || {}) as Partial<WorkIncomeData>;
  const workIncome: WorkIncomeData = {
    unionFees: sanitizeNumber(wSrc.unionFees, 0),
    otherDeductible: sanitizeNumber(wSrc.otherDeductible, 0),
    pensionContributions: sanitizeNumber(wSrc.pensionContributions, 0),
    foreignWorkExemption7p: sanitizeNumber(wSrc.foreignWorkExemption7p, 0, 0, 60100),
    irregularIncomeAmount: sanitizeNumber(wSrc.irregularIncomeAmount, 0, 0, 300000),
    severancePay: sanitizeNumber(wSrc.severancePay, 0, 0, 180000),
    employers: Array.isArray(wSrc.employers)
      ? wSrc.employers.map((e, idx) => ({
          id: sanitizeString(e?.id, `emp_${idx + 1}`),
          name: sanitizeString(e?.name, `Pagador ${idx + 1}`),
          grossSalary: sanitizeNumber(e?.grossSalary, 0),
          inKind: sanitizeNumber(e?.inKind, 0),
          withholdings: sanitizeNumber(e?.withholdings, 0),
          socialSecurity: sanitizeNumber(e?.socialSecurity, 0),
          dietsIncome: sanitizeNumber(e?.dietsIncome, 0),
          dietsDays: sanitizeNumber(e?.dietsDays, 0, 0, 365),
          mileageIncome: sanitizeNumber(e?.mileageIncome, 0),
          mileageKm: sanitizeNumber(e?.mileageKm, 0),
        }))
      : [],
  };

  // Capital Income
  const cSrc = (src.capitalIncome || {}) as Partial<CapitalIncomeData>;
  const capitalIncome: CapitalIncomeData = {
    interests: sanitizeNumber(cSrc.interests, 0),
    dividends: sanitizeNumber(cSrc.dividends, 0),
    insuranceGains: sanitizeNumber(cSrc.insuranceGains, 0),
    otherMobiliary: sanitizeNumber(cSrc.otherMobiliary, 0),
    mobiliaryWithholdings: sanitizeNumber(cSrc.mobiliaryWithholdings, 0),
    foreignDividends: sanitizeNumber(cSrc.foreignDividends, 0),
    foreignTaxWithheld: sanitizeNumber(cSrc.foreignTaxWithheld, 0),
    rentalIncome: sanitizeNumber(cSrc.rentalIncome, 0),
    rentalExpenses: sanitizeNumber(cSrc.rentalExpenses, 0),
    imputedIncome: sanitizeNumber(cSrc.imputedIncome, 0),
    realEstateWithholdings: sanitizeNumber(cSrc.realEstateWithholdings, 0),
  };

  // Activities
  const aSrc = (src.activities || {}) as Partial<ActivitiesData>;
  const activities: ActivitiesData = {
    income: sanitizeNumber(aSrc.income, 0),
    expenses: sanitizeNumber(aSrc.expenses, 0),
    withholdings: sanitizeNumber(aSrc.withholdings, 0),
    socialSecuritySelfEmployed: sanitizeNumber(aSrc.socialSecuritySelfEmployed, 0),
    estimationType: aSrc.estimationType === 'direct_normal' ? ('direct_normal' as const) : ('direct_simplified' as const),
  };

  // Gains
  const gSrc = (src.gains || {}) as Partial<GainsData>;
  const gains: GainsData = {
    totalWithholdings: sanitizeNumber(gSrc.totalWithholdings, 0),
    items: Array.isArray(gSrc.items)
      ? gSrc.items.map((item, idx) => ({
          id: sanitizeString(item?.id, `gain_${idx + 1}`),
          description: sanitizeString(item?.description, 'Operació de valors'),
          type: item?.type || 'shares',
          acquisitionDate: sanitizeString(item?.acquisitionDate, `${validYear}-01-01`),
          transferDate: sanitizeString(item?.transferDate, `${validYear}-12-31`),
          acquisitionValue: sanitizeNumber(item?.acquisitionValue, 0),
          transferValue: sanitizeNumber(item?.transferValue, 0),
          expenses: sanitizeNumber(item?.expenses, 0),
          isNonComputableLoss: sanitizeBoolean(item?.isNonComputableLoss, false),
          nonComputableLossAmount: sanitizeNumber(item?.nonComputableLossAmount, 0),
          isPrimaryResidenceExemptOver65: sanitizeBoolean(item?.isPrimaryResidenceExemptOver65, false),
          isPrimaryResidenceReinvestment: sanitizeBoolean(item?.isPrimaryResidenceReinvestment, false),
          reinvestmentAmount: sanitizeNumber(item?.reinvestmentAmount, 0),
          isLifeAnnuityExemptOver65: sanitizeBoolean(item?.isLifeAnnuityExemptOver65, false),
          lifeAnnuityAmount: sanitizeNumber(item?.lifeAnnuityAmount, 0),
        }))
      : [],
  };

  // Deductions
  const dSrc = (src.deductions || {}) as Partial<DeductionsData>;
  const deductions: DeductionsData = {
    ...defaults.deductions,
    housingDeduction: sanitizeBoolean(dSrc.housingDeduction, false),
    housingAmountsPaid: sanitizeNumber(dSrc.housingAmountsPaid, 0),
    donations: Array.isArray(dSrc.donations)
      ? dSrc.donations.map((d, idx) => ({
          id: sanitizeString(d?.id, `don_${idx + 1}`),
          entity: sanitizeString(d?.entity, 'Entitat beneficiària'),
          amount: sanitizeNumber(d?.amount, 0),
          recurring: sanitizeBoolean(d?.recurring, false),
          priority: sanitizeBoolean(d?.priority, false),
        }))
      : [],
    maternityDeduction: sanitizeBoolean(dSrc.maternityDeduction, false),
    maternityMonths: sanitizeNumber(dSrc.maternityMonths, 0, 0, 12),
    maternityNurseryExpenses: sanitizeNumber(dSrc.maternityNurseryExpenses, 0, 0, 1000),
    pensionPlanContributions: sanitizeNumber(dSrc.pensionPlanContributions, 0, 0, 1500),
    companyPensionContributions: sanitizeNumber(dSrc.companyPensionContributions, 0, 0, 8500),
    otherDeductions: sanitizeNumber(dSrc.otherDeductions, 0),
    catalanRentalDeduction: sanitizeBoolean(dSrc.catalanRentalDeduction, false),
    catalanRentalAmount: sanitizeNumber(dSrc.catalanRentalAmount, 0),
    catalanRentalSituation: dSrc.catalanRentalSituation || 'none',
    catalanBirthAdoption: sanitizeNumber(dSrc.catalanBirthAdoption, 0),
    catalanStartupInvestment: sanitizeNumber(dSrc.catalanStartupInvestment, 0),
  };

  // Loss Carryovers
  const lSrc = (src.lossCarryovers || {}) as Partial<LossCarryoversData>;
  const lossCarryovers: LossCarryoversData = {
    pendingGeneralLosses: Array.isArray(lSrc.pendingGeneralLosses)
      ? lSrc.pendingGeneralLosses.map((l: PriorLossItem) => ({ year: sanitizeNumber(l?.year, validYear - 1), amount: sanitizeNumber(l?.amount, 0) }))
      : [],
    pendingMobiliaryLosses: Array.isArray(lSrc.pendingMobiliaryLosses)
      ? lSrc.pendingMobiliaryLosses.map((l: PriorLossItem) => ({ year: sanitizeNumber(l?.year, validYear - 1), amount: sanitizeNumber(l?.amount, 0) }))
      : [],
    pendingCapitalLosses: Array.isArray(lSrc.pendingCapitalLosses)
      ? lSrc.pendingCapitalLosses.map((l: PriorLossItem) => ({ year: sanitizeNumber(l?.year, validYear - 1), amount: sanitizeNumber(l?.amount, 0) }))
      : [],
  };

  return {
    ...defaults,
    ...src,
    year: validYear,
    profileId: validProfileId,
    personal,
    workIncome,
    capitalIncome,
    activities,
    gains,
    deductions,
    lossCarryovers,
    properties: Array.isArray(src.properties) ? src.properties : defaults.properties,
    iva: src.iva || defaults.iva,
  };
}
