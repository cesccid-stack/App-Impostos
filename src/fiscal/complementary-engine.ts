/**
 * @module fiscal/complementary-engine
 * Motor fiscal especialitzat per a Declaracions Complementàries i Autoliquidacions Rectificatives (Art. 120-122 LGT, Art. 14 LIRPF, Art. 70-71 Model 303).
 * Inclou càlcul automàtic de recàrrecs per extemporaneïtat segons l'Art. 27 de la Llei General Tributària (LGT) i la Llei 11/2021.
 */

import type { DeclaracionData, IRPFComplementaryReason } from '../types.ts';
import type { Model303QuarterResult } from '../types-iva.ts';

export interface ExtemporaneousSurchargeResult {
  monthsLate: number;
  baseAmount: number;
  nominalRatePercentage: number;
  nominalSurchargeAmount: number;
  discount25Percentage: number;
  discount25Amount: number;
  finalSurchargeAmount: number;
  requiresInterest: boolean;
  estimatedInterestAmount: number;
  totalWithSurcharge: number;
  legalBasis: string;
}

/**
 * Calcula el recàrrec per declaració extemporània sense requeriment previ (Art. 27 LGT - Redacció Llei 11/2021).
 * - Primers 12 mesos: 1% + 1% per cada mes complet de retard (1% a 12%). Sense interessos ni sancions.
 * - Després de 12 mesos: 15% + Interessos de demora tributaris meritats a partir del dia següent als 12 mesos.
 * - Reducció del 25% (Art. 27.5 LGT) si s'ingressa en període voluntari.
 */
export function calculateExtemporaneousSurcharge(
  amountToPay: number,
  monthsLate: number,
  hasNotice: boolean = false,
  isArrearsWorkExempt: boolean = false
): ExtemporaneousSurchargeResult {
  const baseAmount = Math.max(0, amountToPay);
  
  // Si no hi ha import a pagar, o és justificant d'atrasos laborals en termini legal (Art. 14.2.b), no hi ha recàrrec
  if (baseAmount <= 0 || monthsLate <= 0 || isArrearsWorkExempt) {
    return {
      monthsLate: 0,
      baseAmount,
      nominalRatePercentage: 0,
      nominalSurchargeAmount: 0,
      discount25Percentage: 0,
      discount25Amount: 0,
      finalSurchargeAmount: 0,
      requiresInterest: false,
      estimatedInterestAmount: 0,
      totalWithSurcharge: baseAmount,
      legalBasis: isArrearsWorkExempt 
        ? 'Exempt de recàrrecs i sancions segons l\'Art. 14.2.b LIRPF (Atrasos laborals presentats en termini).'
        : 'Sense recàrrecs (Presentació dins de termini reglamentari).'
    };
  }

  // Si hi ha requeriment previ de l'AEAT, s'aplica el règim sancionador general (Art. 191 LGT: 50%-150%)
  if (hasNotice) {
    return {
      monthsLate,
      baseAmount,
      nominalRatePercentage: 50,
      nominalSurchargeAmount: baseAmount * 0.5,
      discount25Percentage: 0,
      discount25Amount: 0,
      finalSurchargeAmount: baseAmount * 0.5,
      requiresInterest: true,
      estimatedInterestAmount: baseAmount * 0.0406 * (monthsLate / 12),
      totalWithSurcharge: baseAmount * 1.5,
      legalBasis: 'Infracció tributària amb requeriment previ de l\'AEAT (Art. 191 LGT: Sanció mínima 50%).'
    };
  }

  let nominalRatePercentage = 0;
  let requiresInterest = false;
  let estimatedInterestAmount = 0;

  if (monthsLate <= 12) {
    // 1% + 1% addicional per cada mes complet de retard
    nominalRatePercentage = 1 + Math.max(0, Math.floor(monthsLate - 1));
    nominalRatePercentage = Math.min(12, Math.max(1, nominalRatePercentage));
  } else {
    // Més de 12 mesos: 15% + interessos de demora (4.0625% legal)
    nominalRatePercentage = 15;
    requiresInterest = true;
    const monthsOver12 = monthsLate - 12;
    estimatedInterestAmount = baseAmount * 0.040625 * (monthsOver12 / 12);
  }

  const nominalSurchargeAmount = baseAmount * (nominalRatePercentage / 100);
  
  // Reducció del 25% per ingrés en període voluntari (Art. 27.5 LGT)
  const discount25Percentage = 25;
  const discount25Amount = nominalSurchargeAmount * (discount25Percentage / 100);
  const finalSurchargeAmount = nominalSurchargeAmount - discount25Amount;
  const totalWithSurcharge = baseAmount + finalSurchargeAmount + estimatedInterestAmount;

  return {
    monthsLate,
    baseAmount,
    nominalRatePercentage,
    nominalSurchargeAmount: Math.round(nominalSurchargeAmount * 100) / 100,
    discount25Percentage,
    discount25Amount: Math.round(discount25Amount * 100) / 100,
    finalSurchargeAmount: Math.round(finalSurchargeAmount * 100) / 100,
    requiresInterest,
    estimatedInterestAmount: Math.round(estimatedInterestAmount * 100) / 100,
    totalWithSurcharge: Math.round(totalWithSurcharge * 100) / 100,
    legalBasis: `Art. 27 LGT: Recàrrec del ${nominalRatePercentage}% amb reducció del 25% per pagament voluntari.`
  };
}

export interface ComplementaryIRPFCalculationResult {
  isComplementary: boolean;
  reason: IRPFComplementaryReason;
  reasonLabel: string;
  previousReceiptNumber: string;
  previousResult: number;        // Positiu = Ingressat, Negatiu = Devolució percebuda
  currentComputedResult: number; // Resultat íntegre d'aquesta declaració (Casella 0610)
  differentialAmount: number;    // Diferència a ingressar o sol·licitar
  type: 'to_pay_higher' | 'refund_reduced' | 'rectification_refund' | 'no_difference';
  surcharge: ExtemporaneousSurchargeResult;
  finalAmountDue: number;
}

/**
 * Calcula la liquidació diferencial d'una Declaració Complementària o Rectificativa d'IRPF (Model 100).
 */
export function calculateComplementaryIRPF(
  data: DeclaracionData,
  currentComputedResult: number
): ComplementaryIRPFCalculationResult {
  const comp = data.complementary;
  if (!comp || !comp.isComplementary) {
    const surcharge = calculateExtemporaneousSurcharge(Math.max(0, currentComputedResult), 0);
    return {
      isComplementary: false,
      reason: 'other_higher_tax',
      reasonLabel: 'Declaració Ordinària',
      previousReceiptNumber: '',
      previousResult: 0,
      currentComputedResult,
      differentialAmount: currentComputedResult,
      type: currentComputedResult > 0 ? 'to_pay_higher' : 'rectification_refund',
      surcharge,
      finalAmountDue: currentComputedResult,
    };
  }

  const reasonLabels: Record<IRPFComplementaryReason, string> = {
    arrears_work: 'Atrasos de rendiments del treball meritats en anys previs (Art. 14.2.b LIRPF)',
    loss_deductions: 'Pèrdua del dret a deduccions aplicades en anys anteriors (Art. 14.2.d LIRPF)',
    change_residence: 'Pèrdua de la condició de contribuent per canvi de residència (Art. 14.3 LIRPF)',
    other_higher_tax: 'Altres motius (Resultat a ingressar superior o menor devolució a l\'anterior)',
    rectification: 'Autoliquidació Rectificativa (Sol·licitud d\'ingressos indeguts o major devolució)',
  };

  const prevResult = comp.previousResult || 0;
  
  // Si la declaració anterior va ser a ingressar (+500 €) i la nova és (+800 €): Diferencial = +300 €
  // Si la declaració anterior va ser a tornar (-400 €) i la nova és (+200 €): Diferencial = 200 - (-400) = +600 €
  // Si la declaració anterior va ser a tornar (-400 €) i la nova és (-100 €): Diferencial = -100 - (-400) = +300 € (menor devolució)
  const differentialAmount = currentComputedResult - prevResult;

  let type: ComplementaryIRPFCalculationResult['type'] = 'to_pay_higher';
  if (differentialAmount > 0) {
    type = 'to_pay_higher';
  } else if (differentialAmount < 0) {
    type = 'rectification_refund';
  } else {
    type = 'no_difference';
  }

  const isArrearsWorkExempt = comp.reason === 'arrears_work';
  const surcharge = calculateExtemporaneousSurcharge(
    Math.max(0, differentialAmount),
    comp.monthsLate || 0,
    comp.hasTaxOfficeNotice || false,
    isArrearsWorkExempt
  );

  const finalAmountDue = differentialAmount > 0 
    ? surcharge.totalWithSurcharge 
    : differentialAmount;

  return {
    isComplementary: true,
    reason: comp.reason,
    reasonLabel: reasonLabels[comp.reason] || comp.reason,
    previousReceiptNumber: comp.previousReceiptNumber || '',
    previousResult: prevResult,
    currentComputedResult,
    differentialAmount: Math.round(differentialAmount * 100) / 100,
    type,
    surcharge,
    finalAmountDue: Math.round(finalAmountDue * 100) / 100,
  };
}

export interface ComplementaryIVAQuarterCalculationResult {
  isComplementary: boolean;
  quarter: string;
  year: number;
  ordinaryResult: number;        // Casella 69: Resultat ordinari de la liquidació
  previousResultIngressat: number;// Casella 70: Import ingressat en l'anterior autoliquidació o devolució
  resultadoComplementaria: number;// Casella 71: Resultat efectiu de la complementària (C. 69 - C. 70)
  surcharge: ExtemporaneousSurchargeResult;
  finalAmountDue: number;
}

/**
 * Calcula la liquidació diferencial del Model 303 d'un trimestre amb autoliquidació complementària.
 */
export function calculateComplementaryIVAQuarter(
  quarterResult: Model303QuarterResult,
  monthsLate: number = 0,
  hasNotice: boolean = false
): ComplementaryIVAQuarterCalculationResult {
  const ordinaryResult = quarterResult.resultadoLiquidacion;
  const prevIngressat = quarterResult.previousResultIngressat || 0;
  
  // Casella 71 = Casella 69 - Casella 70
  const resultadoComplementaria = quarterResult.isComplementary
    ? (ordinaryResult - prevIngressat)
    : ordinaryResult;

  const surcharge = calculateExtemporaneousSurcharge(
    Math.max(0, resultadoComplementaria),
    monthsLate || quarterResult.extemporaneousMonths || 0,
    hasNotice
  );

  const finalAmountDue = resultadoComplementaria > 0
    ? surcharge.totalWithSurcharge
    : resultadoComplementaria;

  return {
    isComplementary: !!quarterResult.isComplementary,
    quarter: quarterResult.quarter,
    year: quarterResult.year,
    ordinaryResult,
    previousResultIngressat: prevIngressat,
    resultadoComplementaria: Math.round(resultadoComplementaria * 100) / 100,
    surcharge,
    finalAmountDue: Math.round(finalAmountDue * 100) / 100,
  };
}
