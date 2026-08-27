/**
 * @module fiscal/real-estate-analytics-engine
 * Motor d'Anàlisi Financera, Rendibilitat Avançada i Projecció Multianual de Cartera Immobiliària.
 * Conforme amb l'Art. 23 & 85 LIRPF i estàndards d'anàlisi d'inversió immobiliària (Real Estate ROI/Cap Rate).
 */

import type { RentalProperty, PropertyFiscalResult } from '../types-properties.ts';
import { calculatePropertyFiscalResult } from './real-estate-engine.ts';
import { round2 } from '../utils/exact-math.ts';

export interface PropertyFinancialMetrics {
  propertyId: string;
  propertyName: string;
  cadastralReference: string;
  usageType: string;
  acquisitionCost: number;
  totalCadastralValue: number;
  constructionCadastralValue: number;
  grossIncome: number;
  operatingExpenses: number;
  mortgageInterests: number;
  totalAmortization: number;
  netOperatingIncome: number; // NOI (Gross - OpEx)
  netTaxableIncome: number;   // Rendiment Net IRPF abans de reduccions
  reductionAmount: number;    // Reducció 50%/60%/70%/90% Llei 12/2023
  netReducedIncome: number;   // Rendiment net computable a la Renda (Casella 0150)
  taxShieldSavings: number;   // Estalvi fiscal per amortització (Amortització * Tipus Marginal ~37%)
  cashFlowAnnual: number;     // Cash Flow real de butxaca
  cashFlowMonthly: number;
  grossYieldPercent: number;  // (Gross Income / Acquisition Cost) * 100
  netYieldPercent: number;    // (NOI / Acquisition Cost) * 100
  postTaxYieldPercent: number;// ((Cash Flow + Tax Shield) / Acquisition Cost) * 100
  operatingExpenseRatio: number; // (OpEx / Gross Income) * 100
  breakEvenOccupancyMonths: number; // Mesos necessaris per cobrir despeses fixes
  strategicRecommendation: string;
  riskRating: 'low' | 'medium' | 'high';
}

export interface MultiYearProjectionYear {
  yearNumber: number;
  calendarYear: number;
  projectedGrossIncome: number;
  projectedOperatingExpenses: number;
  projectedAmortization: number;
  projectedNetOperatingIncome: number;
  projectedCashFlow: number;
  cumulativeCashFlow: number;
  projectedPropertyValue: number;
  cumulativeCapitalGain: number;
  totalEstimatedReturn: number;
}

export interface PropertyAnalyticsReport {
  propertyMetrics: PropertyFinancialMetrics;
  fiveYearProjection: MultiYearProjectionYear[];
}

export interface PortfolioAnalyticsReport {
  totalProperties: number;
  totalPortfolioCost: number;
  totalGrossIncome: number;
  totalOperatingExpenses: number;
  totalAmortization: number;
  totalNetOperatingIncome: number;
  totalCashFlowAnnual: number;
  totalTaxShieldSavings: number;
  avgGrossYieldPercent: number;
  avgNetYieldPercent: number;
  avgPostTaxYieldPercent: number;
  portfolioOperatingExpenseRatio: number;
  topPerformingPropertyId: string;
  propertiesRanked: PropertyFinancialMetrics[];
  portfolioFiveYearProjection: MultiYearProjectionYear[];
}

/**
 * Calcula les mètriques financeres i de rendibilitat d'un immoble individual.
 */
export function analyzePropertyFinances(p: RentalProperty, fiscalYear: number = 2024, marginalTaxRate: number = 0.37): PropertyAnalyticsReport {
  const fiscal: PropertyFiscalResult = calculatePropertyFiscalResult(p, fiscalYear);
  const cost = Math.max(1, p.acquisitionCost || p.totalCadastralValue || 150000);
  const gross = fiscal.grossIncome;
  const opex = fiscal.totalCurrentExpenses + fiscal.repairExpenses;
  const interests = fiscal.mortgageInterests;
  const amort = fiscal.totalAmortization;
  const noi = gross - opex;
  const netTaxable = fiscal.netIncome;
  const redAmount = fiscal.reductionAmount;
  const netReduced = fiscal.netReducedIncome;

  const taxShield = round2(amort * marginalTaxRate, 2);
  const cashFlow = round2(gross - opex - interests, 2);
  const cashFlowMo = round2(cashFlow / 12, 2);

  const grossYield = round2((gross / cost) * 100, 2);
  const netYield = round2((noi / cost) * 100, 2);
  const postTaxYield = round2(((cashFlow + taxShield) / cost) * 100, 2);
  const opexRatio = gross > 0 ? round2((opex / gross) * 100, 1) : 0;

  // Mesos de punt d'equilibri
  const monthlyRent = gross / 12;
  const breakEvenMonths = monthlyRent > 0 ? round2((opex + interests) / monthlyRent, 1) : 12;

  // Recomanació estratègica
  let strat = 'Rendibilitat equilibrada i compliment normatiu òptim.';
  let risk: 'low' | 'medium' | 'high' = 'low';

  if (p.usageType === 'habitual' && p.reductionType === 'general_50') {
    strat = 'Lloguer d\'habitatge habitual amb reducció del 50% (Llei 12/2023). Elevada seguretat jurídica.';
  } else if (p.usageType === 'commercial') {
    strat = 'Local comercial subjecte a retenció del 19% (Model 115/180) i IVA del 21%. Rendibilitat bruta atractiva.';
    risk = 'medium';
  } else if (p.usageType === 'tourist') {
    strat = 'Lloguer turístic sense reducció del 50%. Vigilar compliment municipal i retencions de plataformes (Model 179).';
    risk = 'high';
  }

  if (opexRatio > 35) {
    strat += ' Atenció: la ràtio de despeses operatives sobrepassa el 35% dels ingressos.';
    risk = 'medium';
  }

  const metrics: PropertyFinancialMetrics = {
    propertyId: p.id,
    propertyName: p.name || p.address || 'Immoble sense nom',
    cadastralReference: p.cadastralReference || '—',
    usageType: p.usageType || 'habitual',
    acquisitionCost: cost,
    totalCadastralValue: p.totalCadastralValue || 0,
    constructionCadastralValue: p.constructionCadastralValue || 0,
    grossIncome: gross,
    operatingExpenses: opex,
    mortgageInterests: interests,
    totalAmortization: amort,
    netOperatingIncome: noi,
    netTaxableIncome: netTaxable,
    reductionAmount: redAmount,
    netReducedIncome: netReduced,
    taxShieldSavings: taxShield,
    cashFlowAnnual: cashFlow,
    cashFlowMonthly: cashFlowMo,
    grossYieldPercent: grossYield,
    netYieldPercent: netYield,
    postTaxYieldPercent: postTaxYield,
    operatingExpenseRatio: opexRatio,
    breakEvenOccupancyMonths: breakEvenMonths,
    strategicRecommendation: strat,
    riskRating: risk,
  };

  // Projecció a 5 anys (Indexació renda 2.5%, inflació despeses 2.0%, revalorització 3.0%)
  const projection: MultiYearProjectionYear[] = [];
  let cumCashFlow = 0;

  for (let i = 1; i <= 5; i++) {
    const yearGrowthRent = Math.pow(1.025, i - 1);
    const yearGrowthExp = Math.pow(1.02, i - 1);
    const yearGrowthAppreciation = Math.pow(1.03, i);

    const projGross = round2(gross * yearGrowthRent, 2);
    const projExp = round2(opex * yearGrowthExp, 2);
    const projAmort = amort;
    const projNOI = round2(projGross - projExp, 2);
    const projCF = round2(projGross - projExp - interests, 2);
    cumCashFlow = round2(cumCashFlow + projCF, 2);

    const projVal = round2(cost * yearGrowthAppreciation, 2);
    const cumGain = round2(projVal - cost, 2);
    const totalReturn = round2(cumCashFlow + cumGain, 2);

    projection.push({
      yearNumber: i,
      calendarYear: fiscalYear + (i - 1),
      projectedGrossIncome: projGross,
      projectedOperatingExpenses: projExp,
      projectedAmortization: projAmort,
      projectedNetOperatingIncome: projNOI,
      projectedCashFlow: projCF,
      cumulativeCashFlow: cumCashFlow,
      projectedPropertyValue: projVal,
      cumulativeCapitalGain: cumGain,
      totalEstimatedReturn: totalReturn,
    });
  }

  return {
    propertyMetrics: metrics,
    fiveYearProjection: projection,
  };
}

/**
 * Genera l'informe integral d'anàlisi de rendibilitat de tota la cartera immobiliària.
 */
export function analyzePortfolioFinances(properties: RentalProperty[], fiscalYear: number = 2024, marginalTaxRate: number = 0.37): PortfolioAnalyticsReport {
  if (properties.length === 0) {
    return {
      totalProperties: 0,
      totalPortfolioCost: 0,
      totalGrossIncome: 0,
      totalOperatingExpenses: 0,
      totalAmortization: 0,
      totalNetOperatingIncome: 0,
      totalCashFlowAnnual: 0,
      totalTaxShieldSavings: 0,
      avgGrossYieldPercent: 0,
      avgNetYieldPercent: 0,
      avgPostTaxYieldPercent: 0,
      portfolioOperatingExpenseRatio: 0,
      topPerformingPropertyId: '',
      propertiesRanked: [],
      portfolioFiveYearProjection: [],
    };
  }

  const reports = properties.map(p => analyzePropertyFinances(p, fiscalYear, marginalTaxRate));
  const metricsList = reports.map(r => r.propertyMetrics);

  const totalCost = metricsList.reduce((s, m) => s + m.acquisitionCost, 0);
  const totalGross = metricsList.reduce((s, m) => s + m.grossIncome, 0);
  const totalOpEx = metricsList.reduce((s, m) => s + m.operatingExpenses, 0);
  const totalAmort = metricsList.reduce((s, m) => s + m.totalAmortization, 0);
  const totalNOI = metricsList.reduce((s, m) => s + m.netOperatingIncome, 0);
  const totalCF = metricsList.reduce((s, m) => s + m.cashFlowAnnual, 0);
  const totalShield = metricsList.reduce((s, m) => s + m.taxShieldSavings, 0);

  const avgGross = totalCost > 0 ? round2((totalGross / totalCost) * 100, 2) : 0;
  const avgNet = totalCost > 0 ? round2((totalNOI / totalCost) * 100, 2) : 0;
  const avgPostTax = totalCost > 0 ? round2(((totalCF + totalShield) / totalCost) * 100, 2) : 0;
  const portfolioOpExRatio = totalGross > 0 ? round2((totalOpEx / totalGross) * 100, 1) : 0;

  // Ordenar per rendibilitat neta descendent
  const ranked = [...metricsList].sort((a, b) => b.netYieldPercent - a.netYieldPercent);
  const topId = ranked.length > 0 ? ranked[0].propertyId : '';

  // Projecció de cartera agregada a 5 anys
  const portfolioProjection: MultiYearProjectionYear[] = [];
  for (let i = 0; i < 5; i++) {
    const calYear = fiscalYear + i;
    const projGross = round2(reports.reduce((s, r) => s + r.fiveYearProjection[i].projectedGrossIncome, 0), 2);
    const projExp = round2(reports.reduce((s, r) => s + r.fiveYearProjection[i].projectedOperatingExpenses, 0), 2);
    const projAmort = round2(reports.reduce((s, r) => s + r.fiveYearProjection[i].projectedAmortization, 0), 2);
    const projNOI = round2(reports.reduce((s, r) => s + r.fiveYearProjection[i].projectedNetOperatingIncome, 0), 2);
    const projCF = round2(reports.reduce((s, r) => s + r.fiveYearProjection[i].projectedCashFlow, 0), 2);
    const cumCF = round2(reports.reduce((s, r) => s + r.fiveYearProjection[i].cumulativeCashFlow, 0), 2);
    const projVal = round2(reports.reduce((s, r) => s + r.fiveYearProjection[i].projectedPropertyValue, 0), 2);
    const cumGain = round2(reports.reduce((s, r) => s + r.fiveYearProjection[i].cumulativeCapitalGain, 0), 2);
    const totalReturn = round2(cumCF + cumGain, 2);

    portfolioProjection.push({
      yearNumber: i + 1,
      calendarYear: calYear,
      projectedGrossIncome: projGross,
      projectedOperatingExpenses: projExp,
      projectedAmortization: projAmort,
      projectedNetOperatingIncome: projNOI,
      projectedCashFlow: projCF,
      cumulativeCashFlow: cumCF,
      projectedPropertyValue: projVal,
      cumulativeCapitalGain: cumGain,
      totalEstimatedReturn: totalReturn,
    });
  }

  return {
    totalProperties: properties.length,
    totalPortfolioCost: totalCost,
    totalGrossIncome: totalGross,
    totalOperatingExpenses: totalOpEx,
    totalAmortization: totalAmort,
    totalNetOperatingIncome: totalNOI,
    totalCashFlowAnnual: totalCF,
    totalTaxShieldSavings: totalShield,
    avgGrossYieldPercent: avgGross,
    avgNetYieldPercent: avgNet,
    avgPostTaxYieldPercent: avgPostTax,
    portfolioOperatingExpenseRatio: portfolioOpExRatio,
    topPerformingPropertyId: topId,
    propertiesRanked: ranked,
    portfolioFiveYearProjection: portfolioProjection,
  };
}
