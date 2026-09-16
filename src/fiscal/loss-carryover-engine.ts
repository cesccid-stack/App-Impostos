/**
 * @module fiscal/loss-carryover-engine
 * Motor de compensació de pèrdues patrimonials, rendiments mobiliaris negatius i bossa de 4 anys (Art. 48 & 49 LIRPF).
 */

import type { PriorLossItem } from '../types.ts';
import { exactAdd, exactSub, round2 } from '../utils/exact-math.ts';

export interface SavingsCompensationResult {
  initialMobiliary: number;
  initialGains: number;
  
  // Compensació d'exercicis anteriors (4 anys - Caselles 0426 i 0443)
  priorMobiliaryCompensated: number;
  priorGainsCompensated: number;
  totalPriorCompensated: number;

  // Compensació de l'any actual (Regla del 25% - Caselles 0428 i 0445)
  crossCompensationApplied: number;
  mobiliaryAfterCross: number;
  gainsAfterCross: number;

  /** Compensació creuada del 25% aplicada a la bossa romanent de 4 anys (Art. 49 LIRPF) */
  priorCrossCompensated: number;

  // Saldos finals de la Base de l'Estalvi (Casella 0460)
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
  let mob = round2(netMobiliary);
  let gains = round2(netGains);
  let crossCompensationApplied = 0;

  // 1. Regla de Compensació Creuada del 25% en l'exercici actual
  if (mob < 0 && gains > 0) {
    const maxOffset = round2(gains * 0.25);
    const offset = Math.min(Math.abs(mob), maxOffset);
    crossCompensationApplied = offset;
    mob = exactAdd(mob, offset);   // Es redueix el saldo negatiu
    gains = exactSub(gains, offset); // Es redueix el saldo positiu de guanys
  } else if (gains < 0 && mob > 0) {
    const maxOffset = round2(mob * 0.25);
    const offset = Math.min(Math.abs(gains), maxOffset);
    crossCompensationApplied = offset;
    gains = exactAdd(gains, offset); // Es redueix la pèrdua patrimonial
    mob = exactSub(mob, offset);   // Es redueix el rendiment positiu
  }

  const mobiliaryAfterCross = mob;
  const gainsAfterCross = gains;

  // 2. Compensació de pèrdues d'exercicis anteriors (4 anys)
  // 2.1. Compensació sobre rendiments del capital mobiliari positius
  let priorMobiliaryCompensated = 0;
  const remainingPriorMobiliaryLosses: PriorLossItem[] = [];

  if (mob > 0 && pendingPriorMobiliary.length > 0) {
    // Ordenar per any més antic primer (FIFO tributari)
    const sortedPriorMob = [...pendingPriorMobiliary].sort((a, b) => a.year - b.year);
    for (const item of sortedPriorMob) {
      if (mob > 0 && item.amount > 0) {
        const comp = Math.min(mob, item.amount);
        priorMobiliaryCompensated = exactAdd(priorMobiliaryCompensated, comp);
        mob = exactSub(mob, comp);
        const rem = exactSub(item.amount, comp);
        if (rem > 0) remainingPriorMobiliaryLosses.push({ year: item.year, amount: rem });
      } else if (item.amount > 0) {
        remainingPriorMobiliaryLosses.push({ ...item });
      }
    }
  } else {
    for (const item of pendingPriorMobiliary) {
      if (item.amount > 0) remainingPriorMobiliaryLosses.push({ ...item });
    }
  }

  // 2.2. Compensació sobre guanys patrimonials positius
  let priorGainsCompensated = 0;
  const remainingPriorGainsLosses: PriorLossItem[] = [];

  if (gains > 0 && pendingPriorGains.length > 0) {
    const sortedPriorGains = [...pendingPriorGains].sort((a, b) => a.year - b.year);
    for (const item of sortedPriorGains) {
      if (gains > 0 && item.amount > 0) {
        const comp = Math.min(gains, item.amount);
        priorGainsCompensated = exactAdd(priorGainsCompensated, comp);
        gains = exactSub(gains, comp);
        const rem = exactSub(item.amount, comp);
        if (rem > 0) remainingPriorGainsLosses.push({ year: item.year, amount: rem });
      } else if (item.amount > 0) {
        remainingPriorGainsLosses.push({ ...item });
      }
    }
  } else {
    for (const item of pendingPriorGains) {
      if (item.amount > 0) remainingPriorGainsLosses.push({ ...item });
    }
  }

  // 3. Compensació creuada del 25% sobre la bossa de 4 anys romanent (Art. 49 LIRPF)
  // Esgotada la compensació dins de cada categoria, la bossa de pèrdues pot minorar el saldo
  // positiu de l'altra categoria amb el límit del 25% del saldo positiu.
  let priorCrossCompensated = 0;
  let restPriorMobiliary = remainingPriorMobiliaryLosses;
  let restPriorGains = remainingPriorGainsLosses;

  if (gains > 0 && restPriorMobiliary.length > 0) {
    const consumed = consumePriorLosses(restPriorMobiliary, round2(gains * 0.25));
    priorCrossCompensated = consumed.compensated;
    gains = exactSub(gains, consumed.compensated);
    restPriorMobiliary = consumed.rest;
  } else if (mob > 0 && restPriorGains.length > 0) {
    const consumed = consumePriorLosses(restPriorGains, round2(mob * 0.25));
    priorCrossCompensated = consumed.compensated;
    mob = exactSub(mob, consumed.compensated);
    restPriorGains = consumed.rest;
  }

  // 4. Base de l'Estalvi resultant
  const finalSavingsBase = exactAdd(Math.max(0, mob), Math.max(0, gains));

  return {
    initialMobiliary: netMobiliary,
    initialGains: netGains,
    crossCompensationApplied,
    mobiliaryAfterCross,
    gainsAfterCross,
    priorMobiliaryCompensated,
    priorGainsCompensated,
    priorCrossCompensated,
    totalPriorCompensated: exactAdd(priorMobiliaryCompensated, priorGainsCompensated, priorCrossCompensated),
    finalSavingsBase,
    remainingPriorMobiliaryLosses: restPriorMobiliary,
    remainingPriorGainsLosses: restPriorGains,
  };
}

/**
 * Consumeix la bossa de pèrdues (any més antic primer) fins a esgotar `maxAmount`.
 * Retorna l'import compensat i la bossa romanent.
 */
function consumePriorLosses(
  losses: PriorLossItem[],
  maxAmount: number,
): { compensated: number; rest: PriorLossItem[] } {
  let remaining = round2(maxAmount);
  let compensated = 0;
  const rest: PriorLossItem[] = [];

  for (const item of [...losses].sort((a, b) => a.year - b.year)) {
    if (remaining > 0 && item.amount > 0) {
      const comp = Math.min(remaining, item.amount);
      compensated = exactAdd(compensated, comp);
      remaining = exactSub(remaining, comp);
      const leftover = exactSub(item.amount, comp);
      if (leftover > 0) rest.push({ year: item.year, amount: leftover });
    } else if (item.amount > 0) {
      rest.push({ ...item });
    }
  }

  return { compensated, rest };
}
