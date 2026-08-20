/**
 * @module fiscal/loss-carryover-engine
 * Motor de compensació de pèrdues patrimonials, rendiments mobiliaris negatius i bossa de 4 anys (Art. 48 & 49 LIRPF).
 */

import type { PriorLossItem } from '../types.ts';

export interface SavingsCompensationResult {
  initialMobiliary: number;
  initialGains: number;
  
  // Compensació de l'any actual (Regla del 25%)
  crossCompensationApplied: number;
  mobiliaryAfterCross: number;
  gainsAfterCross: number;
  
  // Compensació d'exercicis anteriors (4 anys)
  priorMobiliaryCompensated: number;
  priorGainsCompensated: number;
  totalPriorCompensated: number;

  // Saldos finals de la Base de l'Estalvi
  finalSavingsBase: number;

  // Bossa romanent que es trasllada als anys següents
  remainingPriorMobiliaryLosses: PriorLossItem[];
  remainingPriorGainsLosses: PriorLossItem[];
}

/**
 * Aplica la integració i compensació de rendiments de l'estalvi i pèrdues patrimonials
 * d'acord amb l'Art. 49 de la Llei de l'IRPF (Regla del 25% i bossa de 4 anys).
 */
export function calculateSavingsCompensation(
  netMobiliary: number,
  netGains: number,
  pendingPriorMobiliary: PriorLossItem[] = [],
  pendingPriorGains: PriorLossItem[] = []
): SavingsCompensationResult {
  let mob = netMobiliary;
  let gains = netGains;
  let crossCompensationApplied = 0;

  // 1. Regla de Compensació Creuada del 25% en l'exercici actual
  if (mob < 0 && gains > 0) {
    const maxOffset = gains * 0.25;
    const offset = Math.min(Math.abs(mob), maxOffset);
    crossCompensationApplied = offset;
    mob += offset;   // Es redueix el saldo negatiu
    gains -= offset; // Es redueix el saldo positiu de guanys
  } else if (gains < 0 && mob > 0) {
    const maxOffset = mob * 0.25;
    const offset = Math.min(Math.abs(gains), maxOffset);
    crossCompensationApplied = offset;
    gains += offset; // Es redueix la pèrdua patrimonial
    mob -= offset;   // Es redueix el rendiment positiu
  }

  const mobiliaryAfterCross = mob;
  const gainsAfterCross = gains;

  // 2. Compensació de pèrdues d'exercicis anteriors (4 anys)
  // 2.1. Compensació sobre rendiments del capital mobiliari positius
  let availableMobForPrior = Math.max(0, mob);
  let priorMobiliaryCompensated = 0;
  const remainingPriorMobiliaryLosses: PriorLossItem[] = [];

  // Ordenar per any més antic primer (FIFO tributari)
  const sortedPriorMob = [...pendingPriorMobiliary].sort((a, b) => a.year - b.year);
  for (const item of sortedPriorMob) {
    if (availableMobForPrior > 0 && item.amount > 0) {
      const comp = Math.min(availableMobForPrior, item.amount);
      priorMobiliaryCompensated += comp;
      availableMobForPrior -= comp;
      const rem = item.amount - comp;
      if (rem > 0) remainingPriorMobiliaryLosses.push({ year: item.year, amount: rem });
    } else {
      if (item.amount > 0) remainingPriorMobiliaryLosses.push({ ...item });
    }
  }

  // 2.2. Compensació sobre guanys patrimonials positius
  let availableGainsForPrior = Math.max(0, gains);
  let priorGainsCompensated = 0;
  const remainingPriorGainsLosses: PriorLossItem[] = [];

  const sortedPriorGains = [...pendingPriorGains].sort((a, b) => a.year - b.year);
  for (const item of sortedPriorGains) {
    if (availableGainsForPrior > 0 && item.amount > 0) {
      const comp = Math.min(availableGainsForPrior, item.amount);
      priorGainsCompensated += comp;
      availableGainsForPrior -= comp;
      const rem = item.amount - comp;
      if (rem > 0) remainingPriorGainsLosses.push({ year: item.year, amount: rem });
    } else {
      if (item.amount > 0) remainingPriorGainsLosses.push({ ...item });
    }
  }

  // 3. Base de l'Estalvi resultant
  const finalSavingsBase = Math.max(0, availableMobForPrior) + Math.max(0, availableGainsForPrior);

  return {
    initialMobiliary: netMobiliary,
    initialGains: netGains,
    crossCompensationApplied,
    mobiliaryAfterCross,
    gainsAfterCross,
    priorMobiliaryCompensated,
    priorGainsCompensated,
    totalPriorCompensated: priorMobiliaryCompensated + priorGainsCompensated,
    finalSavingsBase,
    remainingPriorMobiliaryLosses,
    remainingPriorGainsLosses,
  };
}
