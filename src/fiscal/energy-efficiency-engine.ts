/**
 * @module fiscal/energy-efficiency-engine
 * Càlcul de les Deduccions Estatals per Obres de Millora de l'Eficiència Energètica
 * en Habitatges Habituals o Llogats (Disposició addicional 50a de la LIRPF / RDL 19/2021).
 */

import { roundCurrency } from '../utils/math.ts';

export type EnergyEfficiencyType = 
  | 'heating_cooling_20'       // Modalitat 1: Reducció del 7% en demanda de calefacció i refrigeració (20%)
  | 'non_renewable_energy_40'  // Modalitat 2: Reducció del 30% en consum d'energia primària no renovable (40%)
  | 'building_retrofit_60';    // Modalitat 3: Obres de rehabilitació energètica en edificis complets (60%)

export interface EnergyEfficiencyWorkItem {
  id: string;
  type: EnergyEfficiencyType;
  amountsPaid: number;          // Imports satisfets per les obres (€)
  subsidiesReceived?: number;   // Subvencions públiques rebudes (no deduïbles) (€)
  certificateBeforeDate: string; // Data certificat previ
  certificateAfterDate: string;  // Data certificat posterior
  reductionPercentageAchieved: number; // % reducció aconseguit
}

export interface EnergyEfficiencyResult {
  eligibleBase: number;
  deductionRate: number;        // 0.20, 0.40 o 0.60
  deductionAmount: number;      // Quota deduïble en aquest exercici (€)
  pendingCarryover: number;     // Excés pendent d'aplicar en exercicis futurs (€)
  meetsLegalRequirement: boolean;
  validationMessage: string;
}

/**
 * Calcula la deducció per obres d'eficiència energètica.
 */
export function calculateEnergyEfficiencyDeduction(item: EnergyEfficiencyWorkItem): EnergyEfficiencyResult {
  const netPaid = Math.max(0, (item.amountsPaid || 0) - (item.subsidiesReceived || 0));
  
  if (item.type === 'heating_cooling_20') {
    const meetsLegalRequirement = item.reductionPercentageAchieved >= 7;
    const maxBase = 5000;
    const eligibleBase = Math.min(netPaid, maxBase);
    const deductionAmount = roundCurrency(eligibleBase * 0.20);
    const pendingCarryover = 0; // No s'arrossega en la modalitat 1

    return {
      eligibleBase,
      deductionRate: 0.20,
      deductionAmount: meetsLegalRequirement ? deductionAmount : 0,
      pendingCarryover,
      meetsLegalRequirement,
      validationMessage: meetsLegalRequirement
        ? `Deducció del 20% aplicada sobre ${eligibleBase.toFixed(2)} € (Estalvi fiscal: ${deductionAmount.toFixed(2)} €).`
        : `No s'arriba al 7% de reducció de demanda exigit per la llei (aconseguit: ${item.reductionPercentageAchieved}%).`,
    };
  }

  if (item.type === 'non_renewable_energy_40') {
    const meetsLegalRequirement = item.reductionPercentageAchieved >= 30;
    const maxBase = 7500;
    const eligibleBase = Math.min(netPaid, maxBase);
    const deductionAmount = roundCurrency(eligibleBase * 0.40);
    const pendingCarryover = 0;

    return {
      eligibleBase,
      deductionRate: 0.40,
      deductionAmount: meetsLegalRequirement ? deductionAmount : 0,
      pendingCarryover,
      meetsLegalRequirement,
      validationMessage: meetsLegalRequirement
        ? `Deducció del 40% aplicada sobre ${eligibleBase.toFixed(2)} € (Estalvi fiscal: ${deductionAmount.toFixed(2)} €).`
        : `No s'arriba al 30% de reducció en consum no renovable exigit (aconseguit: ${item.reductionPercentageAchieved}%).`,
    };
  }

  // Modalitat 3: 60% per edificis complets (màx 5.000 anuals, fins a 15.000 acumulats)
  const meetsLegalRequirement = item.reductionPercentageAchieved >= 30;
  const maxAnnualBase = 5000;
  const eligibleBase = Math.min(netPaid, maxAnnualBase);
  const deductionAmount = roundCurrency(eligibleBase * 0.60);
  const pendingCarryover = Math.max(0, netPaid - maxAnnualBase);

  return {
    eligibleBase,
    deductionRate: 0.60,
    deductionAmount: meetsLegalRequirement ? deductionAmount : 0,
    pendingCarryover: meetsLegalRequirement ? pendingCarryover : 0,
    meetsLegalRequirement,
    validationMessage: meetsLegalRequirement
      ? `Deducció del 60% aplicada sobre ${eligibleBase.toFixed(2)} € (Estalvi fiscal: ${deductionAmount.toFixed(2)} €). Excés a deduir en propers 4 anys: ${pendingCarryover.toFixed(2)} €.`
      : `No s'arriba al 30% de millora en l'edifici exigit (aconseguit: ${item.reductionPercentageAchieved}%).`,
  };
}
