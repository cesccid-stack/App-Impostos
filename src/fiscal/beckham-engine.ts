/**
 * @module fiscal/beckham-engine
 * Simulador comparatiu del Règim Especial de Treballadors Desplaçats (Llei Beckham / Art. 93 LIRPF - Model 151)
 * vs Règim Ordinari d'IRPF (Model 100).
 */

import type { DeclaracionData } from '../types.ts';
import { calculateIRPF } from './irpf.ts';
import { applyTaxBracketsExact, exactAdd, exactSub, round2 } from '../utils/exact-math.ts';
import { STATE_SAVINGS_TAX_BRACKETS, AUTONOMIC_SAVINGS_TAX_BRACKETS } from './constants.ts';

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
 * Escala estatal de l'estalvi aplicable als impatriats (IRNR / Art. 93 LIRPF - Model 151).
 * Els tipus són idèntics a l'escala de l'estalvi agregada (19%, 21%, 23%, 27%, 28%).
 */
const BECKHAM_SAVINGS_BRACKETS = STATE_SAVINGS_TAX_BRACKETS.map((b, i) => ({
  upTo: b.upTo,
  rate: round2(b.rate + (AUTONOMIC_SAVINGS_TAX_BRACKETS[i]?.rate || 0)),
}));

/**
 * Compara la tributació sota el règim general de l'IRPF vs el Règim Especial d'Impatriats (Llei Beckham / Art. 93 LIRPF).
 */
export function compareBeckhamRegime(data: DeclaracionData): BeckhamComparisonResult {
  const ordinaryResult = calculateIRPF(data);
  const ordinaryTax = ordinaryResult.netTax;

  // Càlcul Llei Beckham (Art. 93 LIRPF / Model 151)
  // 1. Salari brut del treball a Espanya (tipus fix 24% fins a 600.000 €, 47% per l'excés)
  const totalSpanishSalary = (data.workIncome?.employers || []).reduce((s, e) => s + (e.grossSalary || 0) + (e.inKind || 0), 0);

  let beckhamWorkTax = 0;
  if (totalSpanishSalary <= 600_000) {
    beckhamWorkTax = round2(totalSpanishSalary * 0.24);
  } else {
    beckhamWorkTax = round2(exactAdd(600_000 * 0.24, (totalSpanishSalary - 600_000) * 0.47));
  }

  // 2. Rendiments de capital mobiliari i guanys a Espanya (escala de l'estalvi estatal)
  const spanishSavingsBase = exactAdd(data.capitalIncome?.interests || 0, data.capitalIncome?.dividends || 0);
  const beckhamSavingsTax = applyTaxBracketsExact(spanishSavingsBase, BECKHAM_SAVINGS_BRACKETS).totalTax;

  // Les rendes i guanys internacionals (foreignDividends, plusvàlues estrangeres) tributen al 0% a Espanya sota la Llei Beckham!
  const beckhamTotalTax = Math.max(0, exactAdd(beckhamWorkTax, beckhamSavingsTax));

  const totalIncome = exactAdd(totalSpanishSalary, spanishSavingsBase, data.capitalIncome?.foreignDividends || 0);
  const ordinaryEffectiveRate = totalIncome > 0 ? round2((ordinaryTax / totalIncome) * 100) : 0;
  const beckhamEffectiveRate = totalIncome > 0 ? round2((beckhamTotalTax / totalIncome) * 100) : 0;

  const taxDifference = round2(exactSub(ordinaryTax, beckhamTotalTax)); // Positiu = estalvi amb Beckham
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
