/**
 * @module fiscal/real-estate-engine
 * Motor fiscal per al càlcul del Rendiment del Capital Immobiliari, Amortitzacions i Imputació de Rendes (Art. 23 & 85 LIRPF).
 */

import type { RentalProperty, PropertyFiscalResult, InventoryAmortizationBreakdown, RentalReductionType } from '../types-properties.ts';
import { calculateItemAnnualAmortization } from './amortization-tables.ts';

/**
 * Data d'entrada en vigor de la Llei 12/2023 pel Dret a l'Habitatge.
 * Els contractes formalitzats abans d'aquesta data es regeixen pel règim transitori (60%).
 */
export const LEY_12_2023_EFFECTIVE_DATE = '2023-05-26';

/**
 * Determina el percentatge de reducció del rendiment net per arrendament d'habitatge (Art. 23.2 LIRPF).
 *
 * - Contractes previs al 26/05/2023 → 60% (règim transitori, Disposició Transitòria 38a).
 * - Contractes posteriors → 50% general, 60% rehabilitat, 70% joves/habitatge social, 90% zona tensionada.
 *
 * @param reductionType Règim informat explícitament per l'usuari.
 * @param usageType Tipus d'ús de l'immoble (només l'habitatge habitual té reducció).
 * @param contractDate Data de formalització/inici del contracte (AAAA-MM-DD).
 */
export function getRentalReductionRate(
  reductionType: RentalReductionType | undefined,
  usageType: 'habitual' | 'temporary' | 'tourist' | 'commercial' = 'habitual',
  contractDate?: string,
): number {
  if (usageType !== 'habitual') return 0;

  let type: RentalReductionType | undefined = reductionType;

  // Règim transitori derogat: una reducció del 60% "transitoria" no pot aplicar-se a
  // contractes formalitzats a partir del 26/05/2023.
  if (type === 'transitional_60' && contractDate && contractDate >= LEY_12_2023_EFFECTIVE_DATE) {
    type = 'general_50';
  }

  // Sense informació explícita: inferir pel règim transitori segons la data del contracte.
  if (!type) {
    if (contractDate) {
      type = contractDate >= LEY_12_2023_EFFECTIVE_DATE ? 'general_50' : 'transitional_60';
    } else {
      // Compatibilitat retroactiva: dades antigues sense data → règim transitori del 60%.
      type = 'transitional_60';
    }
  }

  switch (type) {
    case 'tensioned_rent_cut_90':
      return 90;
    case 'young_tenant_70':
    case 'public_or_social_70':
      return 70;
    case 'rehabilitated_60':
    case 'transitional_60':
      return 60;
    case 'general_50':
      return 50;
    case 'none':
    default:
      return 0;
  }
}

/**
 * Calcula el compte d'explotació fiscal d'un immoble individual (incloent ús mixt i imputació de rendes).
 */
export function calculatePropertyFiscalResult(p: RentalProperty, fiscalYear: number = 2024): PropertyFiscalResult {
  const ownRatio = (p.ownershipPercentage || 100) / 100;
  
  // Ràtio de dies de lloguer si és ús mixt (Art. 23 & 85 LIRPF)
  let rentalTimeRatio = 1.0;
  let ownUseDays = 0;
  if (p.isMixedUsage && (p.rentalDays !== undefined || p.ownUseDays !== undefined)) {
    const rDays = Math.max(0, p.rentalDays || 0);
    const oDays = Math.max(0, p.ownUseDays || 0);
    const totalDays = (rDays + oDays) > 0 ? (rDays + oDays) : 365;
    rentalTimeRatio = Math.min(1, Math.max(0, rDays / totalDays));
    ownUseDays = oDays;
  }

  // 1. Ingressos íntegres
  const grossIncome = ((p.grossRentalIncome || 0) + (p.otherIncomes || 0)) * ownRatio;

  // 2. Despeses limitades (Finançament + Reparació/Conservació)
  const mortgageInterests = (p.mortgageInterests || 0) * ownRatio * rentalTimeRatio;
  const repairExpenses = (p.repairExpenses || 0) * ownRatio * rentalTimeRatio;
  const pendingPrevious = (p.pendingRepairsPreviousYears || 0) * ownRatio;
  const totalLimitedExpenses = mortgageInterests + repairExpenses + pendingPrevious;

  const limitedExpensesDeducted = Math.min(grossIncome, totalLimitedExpenses);
  const pendingRepairsForFutureYears = totalLimitedExpenses - limitedExpensesDeducted;

  // 3. Altres despeses no limitades (prorratejades pel temps llogat si és ús mixt)
  const ibiDeducted = (p.ibi || 0) * ownRatio * rentalTimeRatio;
  const wasteTaxDeducted = (p.wasteTax || 0) * ownRatio * rentalTimeRatio;
  const otherTaxesDeducted = (p.otherTaxes || 0) * ownRatio * rentalTimeRatio;
  const taxes = ibiDeducted + wasteTaxDeducted + otherTaxesDeducted;
  const communityFees = (p.communityFees || 0) * ownRatio * rentalTimeRatio;
  const insurance = (p.insurance || 0) * ownRatio * rentalTimeRatio;
  const managementFees = (p.managementFees || 0) * ownRatio * rentalTimeRatio;
  const badDebts = (p.badDebts || 0) * ownRatio;
  const totalCurrentExpenses = taxes + communityFees + insurance + managementFees + badDebts;

  // 4. Amortitzacions
  let constructionPercentage = 0.7;
  if (p.totalCadastralValue > 0 && p.constructionCadastralValue > 0) {
    constructionPercentage = Math.min(1, Math.max(0.1, p.constructionCadastralValue / p.totalCadastralValue));
  }

  // Conforme a la Sentència del Tribunal Suprem STS 1130/2021, el cost d'adquisició satisfet inclou el preu + tributs i despeses inherents
  const effectiveAcquisitionCost = (p.acquisitionCost || 0) + (p.acquisitionExpenses || 0);
  const acquisitionWithoutLand = effectiveAcquisitionCost * constructionPercentage;
  const cadastralConstruction = p.constructionCadastralValue || 0;
  const constructionBase = Math.max(cadastralConstruction, acquisitionWithoutLand);
  const buildingAmortization = constructionBase * 0.03 * ownRatio * rentalTimeRatio;

  // 4.2. Amortització de l'Inventari d'Actius per Grups AEAT
  const inventoryBreakdown: InventoryAmortizationBreakdown = {
    group6Tools30: 0,
    group5Computer26: 0,
    group4Transport16: 0,
    group3Machinery12: 0,
    group2Furniture10: 0,
    group1Improvements3: 0,
    totalInventoryAmortization: 0,
  };

  if (p.inventory && p.inventory.length > 0) {
    for (const item of p.inventory) {
      const calc = calculateItemAnnualAmortization(
        item.amount,
        item.amortizationRate,
        item.previousAmortization,
        fiscalYear,
        item.acquisitionDate,
        item.disposalDate,
        item.status
      );
      const amortYear = calc.annualAmount * ownRatio * rentalTimeRatio;

      switch (item.category) {
        case 'group_6_tools_30':
          inventoryBreakdown.group6Tools30 += amortYear;
          break;
        case 'group_5_computer_26':
          inventoryBreakdown.group5Computer26 += amortYear;
          break;
        case 'group_4_transport_16':
          inventoryBreakdown.group4Transport16 += amortYear;
          break;
        case 'group_3_machinery_12':
          inventoryBreakdown.group3Machinery12 += amortYear;
          break;
        case 'group_2_furniture_10':
          inventoryBreakdown.group2Furniture10 += amortYear;
          break;
        case 'group_1_improvements_3':
          inventoryBreakdown.group1Improvements3 += amortYear;
          break;
        default:
          inventoryBreakdown.group2Furniture10 += amortYear;
      }
    }
  }

  // 4.3. Amortització Legacy (Compatibilitat enrere)
  const legacyImprovements = (p.improvements || []).reduce((acc, imp) => {
    return acc + (imp.amount * ((imp.amortizationRate || 3) / 100) * ownRatio * rentalTimeRatio);
  }, 0);
  const legacyFurniture = (p.furniture || []).reduce((acc, f) => {
    return acc + (f.amount * ((f.amortizationRate || 10) / 100) * ownRatio * rentalTimeRatio);
  }, 0);

  const improvementsAmortization = inventoryBreakdown.group1Improvements3 + legacyImprovements;
  const furnitureAmortization = 
    inventoryBreakdown.group6Tools30 +
    inventoryBreakdown.group5Computer26 +
    inventoryBreakdown.group4Transport16 +
    inventoryBreakdown.group3Machinery12 +
    inventoryBreakdown.group2Furniture10 +
    legacyFurniture;

  inventoryBreakdown.totalInventoryAmortization = 
    inventoryBreakdown.group6Tools30 +
    inventoryBreakdown.group5Computer26 +
    inventoryBreakdown.group4Transport16 +
    inventoryBreakdown.group3Machinery12 +
    inventoryBreakdown.group2Furniture10 +
    inventoryBreakdown.group1Improvements3;

  const totalAmortization = buildingAmortization + improvementsAmortization + furnitureAmortization;
  const totalExpenses = limitedExpensesDeducted + totalCurrentExpenses + totalAmortization;

  // 5. Rendiment net previ (Casella 0090)
  const netIncome = grossIncome - totalExpenses;

  // 6. Reducció per arrendament d'habitatge habitual (Llei 12/2023)
  const reductionRate = netIncome > 0
    ? getRentalReductionRate(p.reductionType, p.usageType, p.contractStartDate || p.contractDate)
    : 0;

  const reductionAmount = (netIncome > 0) ? (netIncome * (reductionRate / 100)) : 0;
  const netReducedIncome = netIncome - reductionAmount;

  // 7. Imputació de rendes per als dies d'ús propi (Art. 85 LIRPF)
  let imputedIncomeForOwnUse = 0;
  if (p.isMixedUsage && ownUseDays > 0 && p.totalCadastralValue > 0) {
    const rate = p.isCadastralRevised ? 0.011 : 0.02;
    imputedIncomeForOwnUse = p.totalCadastralValue * rate * (ownUseDays / 365) * ownRatio;
  }

  const baseResult: PropertyFiscalResult = {
    property: p,
    grossIncome,
    mortgageInterests,
    repairExpenses,
    totalLimitedExpenses,
    limitedExpensesDeducted,
    pendingRepairsForFutureYears,
    taxes,
    ibiDeducted,
    wasteTaxDeducted,
    otherTaxesDeducted,
    communityFees,
    insurance,
    managementFees,
    badDebts,
    totalCurrentExpenses,
    effectiveAcquisitionCost,
    constructionBase,
    constructionPercentage: constructionPercentage * 100,
    buildingAmortization,
    improvementsAmortization,
    furnitureAmortization,
    inventoryBreakdown,
    totalAmortization,
    totalExpenses,
    netIncome,
    reductionRate,
    reductionAmount,
    netReducedIncome,
    imputedIncomeForOwnUse,
    withholding19: p.usageType === 'commercial' ? (grossIncome * 0.19) : 0,
  };

  // Càlcul de rendibilitats financeres
  const acquisitionCost = effectiveAcquisitionCost || p.totalCadastralValue || 1;
  const grossYield = acquisitionCost > 0 ? (grossIncome / acquisitionCost) * 100 : 0;
  const operatingExpenses = totalCurrentExpenses + repairExpenses + mortgageInterests;
  const noi = grossIncome - operatingExpenses;
  const netYield = acquisitionCost > 0 ? (noi / acquisitionCost) * 100 : 0;
  const cashFlowAnnual = grossIncome - operatingExpenses;
  const capRate = acquisitionCost > 0 ? (noi / acquisitionCost) * 100 : 0;
  const taxDeductionsTotal = totalAmortization + reductionAmount;
  const estimatedSavingsAEAT = taxDeductionsTotal * 0.35;
  const afterTaxNetIncome = noi + estimatedSavingsAEAT;
  const afterTaxReturn = acquisitionCost > 0 ? (afterTaxNetIncome / acquisitionCost) * 100 : 0;

  baseResult.metrics = {
    grossYield: parseFloat(grossYield.toFixed(2)),
    netYield: parseFloat(netYield.toFixed(2)),
    cashFlowAnnual: parseFloat(cashFlowAnnual.toFixed(2)),
    capRate: parseFloat(capRate.toFixed(2)),
    afterTaxReturn: parseFloat(afterTaxReturn.toFixed(2)),
    estimatedSavingsAEAT: parseFloat(estimatedSavingsAEAT.toFixed(2)),
  };

  return baseResult;
}

const propertyResultCache = new WeakMap<RentalProperty, { year: number; result: PropertyFiscalResult }>();

/**
 * Calcula l'agregat de tots els immobles del contribuent amb un únic recorregut O(N).
 */
export function calculateAllProperties(properties: RentalProperty[], fiscalYear: number = 2024): {
  results: PropertyFiscalResult[];
  totalGrossIncome: number;
  totalExpenses: number;
  totalAmortization: number;
  totalNetIncome: number;
  totalReductions: number;
  totalNetReducedIncome: number;
  totalImputedIncome: number;
} {
  const results: PropertyFiscalResult[] = [];
  let totalGrossIncome = 0;
  let totalExpenses = 0;
  let totalAmortization = 0;
  let totalNetIncome = 0;
  let totalReductions = 0;
  let totalNetReducedIncome = 0;
  let totalImputedIncome = 0;

  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    const cached = propertyResultCache.get(p);
    let r: PropertyFiscalResult;
    if (cached && cached.year === fiscalYear) {
      r = cached.result;
    } else {
      r = calculatePropertyFiscalResult(p, fiscalYear);
      propertyResultCache.set(p, { year: fiscalYear, result: r });
    }

    results.push(r);
    totalGrossIncome += r.grossIncome;
    totalExpenses += r.totalExpenses;
    totalAmortization += r.totalAmortization;
    totalNetIncome += r.netIncome;
    totalReductions += r.reductionAmount;
    totalNetReducedIncome += r.netReducedIncome;
    totalImputedIncome += r.imputedIncomeForOwnUse;
  }

  return {
    results,
    totalGrossIncome,
    totalExpenses,
    totalAmortization,
    totalNetIncome,
    totalReductions,
    totalNetReducedIncome,
    totalImputedIncome,
  };
}
