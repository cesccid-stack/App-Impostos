/**
 * @module fiscal/year-end-optimizer
 * Predicts and calculates marginal tax rates (IRPF) and generates year-end actionable
 * tax saving strategies before December 31st.
 */

import type { DeclaracionData } from '../types.ts';
import { calculateIRPF } from './irpf.ts';
import { STATE_GENERAL_TAX_BRACKETS, CATALAN_GENERAL_TAX_BRACKETS, STATE_SAVINGS_TAX_BRACKETS, AUTONOMIC_SAVINGS_TAX_BRACKETS } from './constants.ts';
import { roundCurrency, safeMultiply } from '../utils/math.ts';

export interface MarginalRates {
  stateGeneralRate: number;       // %
  autonomicGeneralRate: number;   // %
  totalGeneralMarginalRate: number; // % (Suma estatal + autonòmic)
  
  stateSavingsRate: number;       // %
  autonomicSavingsRate: number;   // %
  totalSavingsMarginalRate: number; // %
}

export interface YearEndTip {
  id: string;
  category: 'pensions' | 'donations' | 'loss_harvesting' | 'housing';
  title: string;
  description: string;
  potentialSavings: number; // €
  actionRecommendation: string;
}

export interface YearEndOptimizationReport {
  marginalRates: MarginalRates;
  currentResult: number;
  tips: YearEndTip[];
  totalPotentialSavings: number;
}

/**
 * Calculates the exact marginal tax rate (the tax rate applied to the next euro earned).
 */
export function calculateMarginalTaxRate(data: DeclaracionData): MarginalRates {
  const result = calculateIRPF(data);
  const generalBase = Math.max(0, result.generalBase);
  const savingsBase = Math.max(0, result.savingsBase);

  // 1. Tipus marginal general estatal
  let stateGeneralRate = STATE_GENERAL_TAX_BRACKETS[0].rate;
  for (const b of STATE_GENERAL_TAX_BRACKETS) {
    stateGeneralRate = b.rate;
    if (generalBase <= b.upTo) break;
  }

  // 2. Tipus marginal general autonòmic (Catalunya per defecte)
  let autonomicGeneralRate = CATALAN_GENERAL_TAX_BRACKETS[0].rate;
  for (const b of CATALAN_GENERAL_TAX_BRACKETS) {
    autonomicGeneralRate = b.rate;
    if (generalBase <= b.upTo) break;
  }

  // 3. Tipus marginal estalvi estatal
  let stateSavingsRate = STATE_SAVINGS_TAX_BRACKETS[0].rate;
  for (const b of STATE_SAVINGS_TAX_BRACKETS) {
    stateSavingsRate = b.rate;
    if (savingsBase <= b.upTo) break;
  }

  // 4. Tipus marginal estalvi autonòmic
  let autonomicSavingsRate = AUTONOMIC_SAVINGS_TAX_BRACKETS[0].rate;
  for (const b of AUTONOMIC_SAVINGS_TAX_BRACKETS) {
    autonomicSavingsRate = b.rate;
    if (savingsBase <= b.upTo) break;
  }

  return {
    stateGeneralRate: roundCurrency(stateGeneralRate * 100),
    autonomicGeneralRate: roundCurrency(autonomicGeneralRate * 100),
    totalGeneralMarginalRate: roundCurrency((stateGeneralRate + autonomicGeneralRate) * 100),
    stateSavingsRate: roundCurrency(stateSavingsRate * 100),
    autonomicSavingsRate: roundCurrency(autonomicSavingsRate * 100),
    totalSavingsMarginalRate: roundCurrency((stateSavingsRate + autonomicSavingsRate) * 100),
  };
}

/**
 * Generates actionable tax savings advice before year end.
 */
export function generateYearEndOptimization(data: DeclaracionData): YearEndOptimizationReport {
  const result = calculateIRPF(data);
  const marginal = calculateMarginalTaxRate(data);
  const tips: YearEndTip[] = [];

  // 1. Aportació a Plans de Pensions Individuals (Topall 1.500 €)
  const currentPension = data.workIncome.pensionContributions || 0;
  const remainingPension = Math.max(0, 1500 - currentPension);
  if (remainingPension > 0 && result.generalBase > 1500) {
    const savings = safeMultiply(remainingPension, marginal.totalGeneralMarginalRate / 100);
    tips.push({
      id: 'tip_pension',
      category: 'pensions',
      title: `Aporta ${remainingPension.toFixed(2)} € al teu Pla de Pensions`,
      description: `Com que el teu tipus marginal és del ${marginal.totalGeneralMarginalRate.toFixed(1)}%, una aportació de ${remainingPension.toFixed(2)} € abans del 31 de desembre redueix directament la teva base imposable.`,
      potentialSavings: savings,
      actionRecommendation: 'Realitza una aportació extraordinària al teu pla de pensions abans de final d\'any.',
    });
  }

  // 2. Donatius a ONG i Entitats d'Utilitat Pública (80% dels primers 250 €)
  const currentDonations = (data.deductions.donations || []).reduce((s, d) => s + (d.amount || 0), 0);
  if (currentDonations < 250) {
    const remainingDonation = 250 - currentDonations;
    const donationSavings = safeMultiply(remainingDonation, 0.80);
    tips.push({
      id: 'tip_donation',
      category: 'donations',
      title: `Donacions Solidàries amb deduibilitat del 80%`,
      description: `Els primers 250 € donats a entitats sense ànim de lucre tenen una deducció fiscal directa del 80% a la quota.`,
      potentialSavings: donationSavings,
      actionRecommendation: `Aporta fins a ${remainingDonation.toFixed(2)} € a una ONG per obtenir una devolució de ${donationSavings.toFixed(2)} €.`,
    });
  }

  // 3. Compensació de Pèrdues Patrimonials (Tax-Loss Harvesting)
  if (result.savingsBase > 1000) {
    const potentialLossOffset = safeMultiply(result.savingsBase, 0.25);
    const taxLossSavings = safeMultiply(potentialLossOffset, marginal.totalSavingsMarginalRate / 100);
    tips.push({
      id: 'tip_loss_harvesting',
      category: 'loss_harvesting',
      title: `Compensa Guanys amb Pèrdues Latents`,
      description: `Tens una base de l'estalvi positiva. Pots materialitzar posicions amb pèrdues latents abans del 31/12 per reduir la factura fiscal.`,
      potentialSavings: taxLossSavings,
      actionRecommendation: 'Revisa la teva cartera d\'inversions per aplicar Tax-Loss Harvesting.',
    });
  }

  const totalPotentialSavings = roundCurrency(tips.reduce((s, t) => s + t.potentialSavings, 0));

  return {
    marginalRates: marginal,
    currentResult: result.result,
    tips,
    totalPotentialSavings,
  };
}
