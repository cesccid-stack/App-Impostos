/**
 * @module fiscal/beckham-engine
 * Simulador comparatiu del Règim Especial de Treballadors Desplaçats (Llei Beckham / Art. 93 LIRPF - Model 151)
 * vs Règim Ordinari d'IRPF (Model 100).
 */

import type { DeclaracionData } from '../types.ts';
import { calculateIRPF } from './irpf.ts';

export interface BeckhamComparisonResult {
  ordinaryTax: number;             // Quota IRPF règim ordinari
  ordinaryEffectiveRate: number;   // % Tipus efectiu règim ordinari
  
  beckhamWorkTax: number;          // Quota sobre la feina al 24%/47%
  beckhamSavingsTax: number;       // Quota sobre l'estalvi espanyol
  beckhamTotalTax: number;         // Quota total Llei Beckham
  beckhamEffectiveRate: number;    // % Tipus efectiu Llei Beckham
  
  taxDifference: number;           // Estalvi (€)
  isBeckhamBetter: boolean;
  explanation: string;
}

/**
 * Compara la tributació sota el règim general de l'IRPF vs el Règim Especial d'Impatriats (Llei Beckham).
 */
export function compareBeckhamRegime(data: DeclaracionData): BeckhamComparisonResult {
  const ordinaryResult = calculateIRPF(data);
  const ordinaryTax = ordinaryResult.netTax;

  // Càlcul Llei Beckham (Art. 93 LIRPF / Model 151)
  // 1. Salari brut del treball a Espanya
  let totalSpanishSalary = (data.workIncome?.employers || []).reduce((s, e) => s + (e.grossSalary || 0) + (e.inKind || 0), 0);

  let beckhamWorkTax = 0;
  if (totalSpanishSalary <= 600_000) {
    beckhamWorkTax = totalSpanishSalary * 0.24;
  } else {
    beckhamWorkTax = (600_000 * 0.24) + ((totalSpanishSalary - 600_000) * 0.47);
  }

  // 2. Rendiments de capital mobiliari i guanys a Espanya (escala de l'estalvi estatal)
  const spanishSavingsBase = (data.capitalIncome?.interests || 0) + (data.capitalIncome?.dividends || 0);
  let beckhamSavingsTax = 0;
  if (spanishSavingsBase > 0) {
    if (spanishSavingsBase <= 6000) beckhamSavingsTax = spanishSavingsBase * 0.19;
    else if (spanishSavingsBase <= 50000) beckhamSavingsTax = (6000 * 0.19) + ((spanishSavingsBase - 6000) * 0.21);
    else if (spanishSavingsBase <= 200000) beckhamSavingsTax = (6000 * 0.19) + (44000 * 0.21) + ((spanishSavingsBase - 50000) * 0.23);
    else if (spanishSavingsBase <= 300000) beckhamSavingsTax = (6000 * 0.19) + (44000 * 0.21) + (150000 * 0.23) + ((spanishSavingsBase - 200000) * 0.27);
    else beckhamSavingsTax = (6000 * 0.19) + (44000 * 0.21) + (150000 * 0.23) + (100000 * 0.27) + ((spanishSavingsBase - 300000) * 0.28);
  }

  // Les rendes i guanys internacionals (foreignDividends, etc.) tributen a 0 a Espanya sota la Llei Beckham!
  const beckhamTotalTax = Math.max(0, beckhamWorkTax + beckhamSavingsTax);

  const totalIncome = totalSpanishSalary + spanishSavingsBase + (data.capitalIncome?.foreignDividends || 0);
  const ordinaryEffectiveRate = totalIncome > 0 ? (ordinaryTax / totalIncome) * 100 : 0;
  const beckhamEffectiveRate = totalIncome > 0 ? (beckhamTotalTax / totalIncome) * 100 : 0;

  const taxDifference = ordinaryTax - beckhamTotalTax; // Positiu = estalvi amb Beckham
  const isBeckhamBetter = taxDifference > 0;

  let explanation = '';
  if (isBeckhamBetter) {
    explanation = `La Llei Beckham t'estalviaria ${Math.abs(taxDifference).toFixed(2)} € anuals (tipus efectiu del ${beckhamEffectiveRate.toFixed(1)}% vs ${ordinaryEffectiveRate.toFixed(1)}% al règim ordinari). A més, totes les teves rendes i inversions a l'estranger queden 100% exemptes a Espanya.`;
  } else {
    explanation = `El règim ordinari és més favorable (estalvi de ${Math.abs(taxDifference).toFixed(2)} €). Això és degut a que el teu sou té un tipus mitjà inferior al 24% gràcies als mínims personals, reduccions del treball i deduccions de Catalunya.`;
  }

  return {
    ordinaryTax,
    ordinaryEffectiveRate,
    beckhamWorkTax,
    beckhamSavingsTax,
    beckhamTotalTax,
    beckhamEffectiveRate,
    taxDifference,
    isBeckhamBetter,
    explanation,
  };
}
