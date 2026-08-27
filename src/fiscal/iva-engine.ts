/**
 * @module fiscal/iva-engine
 * Motor fiscal especialitzat per al càlcul de l'IVA (Llei 37/1992 i Reglaments de Facturació i Gestió Tributària).
 * Inclou:
 * - Càlcul precís de les caselles oficials del Model 303 (1T, 2T, 3T, 4T) amb cascada de saldos a compensar.
 * - Motor de Prorrata General i Especial (Art. 102 a 106 LIVA).
 * - Regularització multianual de Béns d'Inversió a 5 i 10 anys (Art. 107 a 110 LIVA).
 * - Resum anual Model 390 i validació creuada d'auditoria amb els trimestres del 303.
 * - Declaració recapitulativa d'operacions intracomunitàries Model 349.
 * - Radar de Riscos i Calendari Fiscal Oficial de l'AEAT.
 */

import type { 
  IVAData, 
  IVAInvoiceIssued, 
  IVAInvoiceReceived, 
  IVABienInversion, 
  FiscalQuarter, 
  Model303QuarterResult, 
  Model390AnnualSummary,
  Model349Entry,
  IVAProrrataConfig
} from '../types-iva.ts';
import { calculateComplementaryIVAQuarter } from './complementary-engine.ts';

export const QUARTERS: readonly FiscalQuarter[] = ['1T', '2T', '3T', '4T'];

/** Terminis oficials de presentació de l'AEAT */
export const IVA_FILING_DEADLINES = {
  '1T': { label: '1r Trimestre (1T)', deadline: '20 d\'abril', days: '1 - 20 d\'abril' },
  '2T': { label: '2n Trimestre (2T)', deadline: '20 de juliol', days: '1 - 20 de juliol' },
  '3T': { label: '3r Trimestre (3T)', deadline: '20 d\'octubre', days: '1 - 20 d\'octubre' },
  '4T': { label: '4t Trimestre (4T) & Model 390/349', deadline: '30 de gener', days: '1 - 30 de gener' },
};

/**
 * Calcula el percentatge de Prorrata General segons l'Art. 104 LIVA.
 * Fórmula: (Ingressos amb dret a deducció / Volum total d'operacions) * 100,
 * arrodonit sempre a l'enter superior immediat (ex: 82.01% -> 83%).
 */
export function calculateProrrataPercentage(
  operationsWithDeduction: number,
  totalOperationsVolume: number
): number {
  if (totalOperationsVolume <= 0) return 100;
  if (operationsWithDeduction >= totalOperationsVolume) return 100;
  if (operationsWithDeduction <= 0) return 0;

  const raw = (operationsWithDeduction / totalOperationsVolume) * 100;
  return Math.ceil(raw); // Arrodoniment a l'enter superior immediat (Art. 104.Dos LIVA)
}

/**
 * Calcula la regularització anual d'un bé d'inversió individual (Art. 107-110 LIVA).
 * S'aplica si la diferència entre la prorrata de l'any i la de l'any d'adquisició supera els 10 punts percentuals.
 */
export function calculateBienInversionAnnualRegularization(
  bien: IVABienInversion,
  currentYear: number,
  currentYearProrrata: number
): number {
  if (bien.status === 'disposed') {
    // Si s'ha venut / transmès durant l'exercici (Art. 110 LIVA)
    // Es considera dedicat al 100% a activitats amb dret o sense dret segons si la venda està subjecta o exempta
    return 0;
  }

  const acqYear = new Date(bien.acquisitionDate || `${currentYear}-01-01`).getFullYear();
  const yearDiff = currentYear - acqYear;

  // Ha d'estar dins del període de regularització (4 anys posteriors a l'adquisició per mobles, 9 per immobles)
  if (yearDiff <= 0 || yearDiff >= bien.regularizationYears) {
    return 0;
  }

  const initialProrrata = bien.initialDeductionPercentage || 100;
  const prorrataDiff = currentYearProrrata - initialProrrata;

  // Només si la variació és superior a 10 punts percentuals
  if (Math.abs(prorrataDiff) <= 10) {
    return 0;
  }

  // Import anual = (IVA suportat a l'adquisició / anys de regularització) * (Prorrata actual - Prorrata inicial) / 100
  const annualQuota = (bien.totalVatPaid / bien.regularizationYears) * (prorrataDiff / 100);
  return annualQuota;
}

/**
 * Calcula la liquidació d'un trimestre individual del Model 303,
 * tenint en compte el saldo a compensar heretat de trimestres anteriors.
 */
export function calculateModel303Quarter(
  quarter: FiscalQuarter,
  year: number,
  issuedInvoices: IVAInvoiceIssued[],
  receivedInvoices: IVAInvoiceReceived[],
  investmentAssets: IVABienInversion[],
  prorrataConfig: IVAProrrataConfig,
  pendingCarryoverFromBefore: number,
  isREDEME: boolean = false
): { quarterResult: Model303QuarterResult; remainingCarryover: number } {
  // Filtrar factures del trimestre
  const qIssued = issuedInvoices.filter(i => i.quarter === quarter);
  const qReceived = receivedInvoices.filter(i => i.quarter === quarter);

  // 1. ── IVA DEVENGAT ──────────────────────────────────────────
  let base21 = 0, cuota21 = 0;
  let base10 = 0, cuota10 = 0;
  let base4 = 0, cuota4 = 0;
  let base0 = 0, cuota0 = 0;
  let modBase = 0, modCuota = 0;
  let recargoBases = 0, recargoCuotas = 0;
  let intraEuBase = 0, intraEuCuota = 0;
  let ispBase = 0, ispCuota = 0;

  for (const inv of qIssued) {
    const b = inv.taxableBase || 0;
    const c = inv.vatAmount || (b * ((inv.vatRate || 0) / 100));

    if (inv.isRectification) {
      modBase += b;
      modCuota += c;
      continue;
    }

    if (inv.category === 'intra_eu_delivery' || inv.category === 'exportation' || inv.vatRate === 0) {
      base0 += b;
      cuota0 += c;
    } else if (inv.vatRate === 21) {
      base21 += b;
      cuota21 += c;
    } else if (inv.vatRate === 10) {
      base10 += b;
      cuota10 += c;
    } else if (inv.vatRate === 4 || inv.vatRate === 2) {
      base4 += b;
      cuota4 += c;
    }

    if (inv.recargoRate && inv.recargoRate > 0) {
      recargoBases += b;
      recargoCuotas += inv.recargoAmount || (b * (inv.recargoRate / 100));
    }
  }

  // Comprovar adquisicions intracomunitàries i ISP en factures rebudes
  for (const rInv of qReceived) {
    if (rInv.category === 'intra_eu_acquisition') {
      intraEuBase += rInv.taxableBase || 0;
      intraEuCuota += rInv.vatAmount || 0;
    } else if (rInv.category === 'professional_services' && rInv.vatAmount > 0 && rInv.notes?.includes('ISP')) {
      ispBase += rInv.taxableBase || 0;
      ispCuota += rInv.vatAmount || 0;
    }
  }

  const totalDevengado = cuota21 + cuota10 + cuota4 + cuota0 + modCuota + recargoCuotas + intraEuCuota + ispCuota;

  // 2. ── IVA DEDUÏBLE ──────────────────────────────────────────
  let deducibleCorrienteBase = 0, deducibleCorrienteCuota = 0;
  let deducibleInversionBase = 0, deducibleInversionCuota = 0;
  let deducibleImportacionesBase = 0, deducibleImportacionesCuota = 0;
  let deducibleIntraEuBase = 0, deducibleIntraEuCuota = 0;
  let rectificacionDeducciones = 0;

  // Aplicar coeficient de prorrata si està actiu (Prorrata provisional en 1T-3T, definitiva en 4T)
  const effectiveProrrata = quarter === '4T'
    ? prorrataConfig.definitivePercentage
    : prorrataConfig.provisionalPercentage;
  
  const prorrataMultiplier = prorrataConfig.type === 'general' ? (effectiveProrrata / 100) : 1.0;

  for (const inv of qReceived) {
    const b = inv.taxableBase || 0;
    const vat = inv.vatAmount || (b * ((inv.vatRate || 0) / 100));
    const dedRatio = (inv.deductiblePercentage ?? 100) / 100;
    const allowedVat = vat * dedRatio * prorrataMultiplier;

    if (inv.isInvestmentAsset || inv.category === 'investment_asset') {
      deducibleInversionBase += b;
      deducibleInversionCuota += allowedVat;
    } else if (inv.category === 'importation') {
      deducibleImportacionesBase += b;
      deducibleImportacionesCuota += allowedVat;
    } else if (inv.category === 'intra_eu_acquisition') {
      deducibleIntraEuBase += b;
      deducibleIntraEuCuota += allowedVat;
    } else {
      deducibleCorrienteBase += b;
      deducibleCorrienteCuota += allowedVat;
    }
  }

  // Regularitzacions al 4T
  let regularizacionBienesInversion = 0;
  let regularizacionProrrata = 0;

  if (quarter === '4T') {
    // Casella 43: Regularització de béns d'inversió
    for (const bien of investmentAssets) {
      regularizacionBienesInversion += calculateBienInversionAnnualRegularization(
        bien,
        year,
        prorrataConfig.definitivePercentage
      );
    }

    // Casella 44: Regularització per aplicació del percentatge definitiu de prorrata als trimestres 1T-3T
    if (prorrataConfig.type === 'general' && prorrataConfig.provisionalPercentage !== prorrataConfig.definitivePercentage) {
      // Diferència de deducció aplicada en 1T-3T
      const prorrataDelta = (prorrataConfig.definitivePercentage - prorrataConfig.provisionalPercentage) / 100;
      
      const previousQuartersReceived = receivedInvoices.filter(i => i.quarter !== '4T');
      const totalPreviousVatSupported = previousQuartersReceived.reduce((s, i) => {
        const vat = i.vatAmount || ((i.taxableBase || 0) * ((i.vatRate || 0) / 100));
        const ded = (i.deductiblePercentage ?? 100) / 100;
        return s + (vat * ded);
      }, 0);

      regularizacionProrrata = totalPreviousVatSupported * prorrataDelta;
    }
  }

  const totalDeducible = 
    deducibleCorrienteCuota + 
    deducibleInversionCuota + 
    deducibleImportacionesCuota + 
    deducibleIntraEuCuota + 
    rectificacionDeducciones + 
    regularizacionBienesInversion + 
    regularizacionProrrata;

  // 3. ── RESULTAT DE LA LIQUIDACIÓ ────────────────────────────
  const diferencia = totalDevengado - totalDeducible; // Casella 46
  const porcentajeAtribuibleEstado = 100; // Casella 64
  const tributacionEstado = diferencia * (porcentajeAtribuibleEstado / 100); // Casella 65

  // Casella 110/78: Compensació de quotes de períodes anteriors
  let cuotasCompensarPeriodosAnteriores = 0;
  let resultadoLiquidacion = 0;
  let remainingCarryover = pendingCarryoverFromBefore;

  if (tributacionEstado > 0) {
    // Hi ha quota positiva a pagar -> podem aplicar saldos negatius pendents
    cuotasCompensarPeriodosAnteriores = Math.min(tributacionEstado, pendingCarryoverFromBefore);
    resultadoLiquidacion = tributacionEstado - cuotasCompensarPeriodosAnteriores;
    remainingCarryover = pendingCarryoverFromBefore - cuotasCompensarPeriodosAnteriores;
  } else {
    // Resultat negatiu -> augmenta la bossa a compensar
    cuotasCompensarPeriodosAnteriores = 0;
    resultadoLiquidacion = tributacionEstado; // Negatiu
    remainingCarryover = pendingCarryoverFromBefore + Math.abs(tributacionEstado);
  }

  let paymentType: Model303QuarterResult['paymentType'] = 'zero';
  if (resultadoLiquidacion > 0) {
    paymentType = 'ingressar';
  } else if (resultadoLiquidacion < 0) {
    if (quarter === '4T' || isREDEME) {
      paymentType = 'tornar'; // Opcionalment a compensar
    } else {
      paymentType = 'compensar';
    }
  }

  const quarterResult: Model303QuarterResult = {
    quarter,
    year,
    base21, cuota21,
    base10, cuota10,
    base4, cuota4,
    base0, cuota0,
    modBase, modCuota,
    recargoBases, recargoCuotas,
    intraEuBase, intraEuCuota,
    ispBase, ispCuota,
    totalDevengado,

    deducibleCorrienteBase, deducibleCorrienteCuota,
    deducibleInversionBase, deducibleInversionCuota,
    deducibleImportacionesBase, deducibleImportacionesCuota,
    deducibleIntraEuBase, deducibleIntraEuCuota,
    rectificacionDeducciones,
    regularizacionBienesInversion,
    regularizacionProrrata,
    totalDeducible,

    diferencia,
    porcentajeAtribuibleEstado,
    tributacionEstado,
    cuotasCompensarPeriodosAnteriores,
    resultadoLiquidacion,
    status: 'draft',
    paymentType,
  };

  return { quarterResult, remainingCarryover };
}

/**
 * Calcula en cascada els 4 trimestres complets de l'exercici (1T, 2T, 3T, 4T),
 * arrossegant automàticament els saldos a compensar d'un trimestre al següent.
 */
export function calculateAllQuarters(ivaData: IVAData, year: number): {
  quarters: Record<FiscalQuarter, Model303QuarterResult>;
  finalPendingCarryover: number;
} {
  const resultQuarters: Partial<Record<FiscalQuarter, Model303QuarterResult>> = {};
  let currentCarryover = ivaData.config?.initialPendingCarryover || 0;

  // Auto-ajustar prorrata si està configurat
  const prorrataConfig = { ...ivaData.config.prorrata };
  if (prorrataConfig.isRegulatedAutomatically) {
    const autoProrrata = computeAutoProrrataFromInvoices(ivaData.issuedInvoices);
    prorrataConfig.totalOperationsWithDeduction = autoProrrata.withDeduction;
    prorrataConfig.totalOperationsVolume = autoProrrata.totalVolume;
    prorrataConfig.definitivePercentage = autoProrrata.percentage;
  }

  for (const q of QUARTERS) {
    const { quarterResult, remainingCarryover } = calculateModel303Quarter(
      q,
      year,
      ivaData.issuedInvoices || [],
      ivaData.receivedInvoices || [],
      ivaData.investmentAssets || [],
      prorrataConfig,
      currentCarryover,
      ivaData.config.isREDEME
    );

    const storedQ = ivaData.quarters?.[q];
    if (storedQ?.isComplementary) {
      quarterResult.isComplementary = true;
      quarterResult.complementaryReason = storedQ.complementaryReason;
      quarterResult.previousReceiptNumber = storedQ.previousReceiptNumber;
      quarterResult.previousResultIngressat = storedQ.previousResultIngressat;
      quarterResult.extemporaneousMonths = storedQ.extemporaneousMonths;

      const compCalc = calculateComplementaryIVAQuarter(
        quarterResult,
        storedQ.extemporaneousMonths || 0
      );
      quarterResult.resultadoComplementaria = compCalc.resultadoComplementaria;
      quarterResult.surchargeExtemporaneous = compCalc.surcharge.finalSurchargeAmount;
      quarterResult.extemporaneousRate = compCalc.surcharge.nominalRatePercentage;
    }

    resultQuarters[q] = quarterResult;
    currentCarryover = remainingCarryover;
  }

  return {
    quarters: resultQuarters as Record<FiscalQuarter, Model303QuarterResult>,
    finalPendingCarryover: currentCarryover,
  };
}

/**
 * Auto-calcula la prorrata a partir de les factures emeses de l'exercici.
 */
export function computeAutoProrrataFromInvoices(issuedInvoices: IVAInvoiceIssued[]): {
  withDeduction: number;
  totalVolume: number;
  percentage: number;
} {
  let withDeduction = 0;
  let exemptWithoutDeduction = 0;

  for (const inv of issuedInvoices) {
    const b = inv.taxableBase || 0;
    if (inv.category === 'property_exempt_rental' || inv.notes?.includes('exempt_art20')) {
      exemptWithoutDeduction += b;
    } else {
      withDeduction += b;
    }
  }

  const totalVolume = withDeduction + exemptWithoutDeduction;
  const percentage = calculateProrrataPercentage(withDeduction, totalVolume);

  return { withDeduction, totalVolume, percentage };
}

/**
 * Genera el Resum Anual del Model 390 i valida la concordança amb els 4 trimestres del 303.
 */
export function calculateModel390Annual(
  ivaData: IVAData,
  year: number
): Model390AnnualSummary {
  const { quarters, finalPendingCarryover } = calculateAllQuarters(ivaData, year);

  let sumOfQuarterDevengado = 0;
  let sumOfQuarterDeducible = 0;
  let totalAnnualResult = 0;

  for (const q of QUARTERS) {
    const qr = quarters[q];
    sumOfQuarterDevengado += qr.totalDevengado;
    sumOfQuarterDeducible += qr.totalDeducible;
    totalAnnualResult += qr.resultadoLiquidacion;
  }

  let totalGeneralRegimeBase = 0;
  let totalExemptWithRight = 0;
  let totalExemptWithoutRight = 0;
  let totalIntraEuDeliveries = 0;
  let totalExports = 0;

  for (const inv of (ivaData.issuedInvoices || [])) {
    const b = inv.taxableBase || 0;
    if (inv.category === 'property_exempt_rental') {
      totalExemptWithoutRight += b;
    } else if (inv.category === 'intra_eu_delivery') {
      totalIntraEuDeliveries += b;
    } else if (inv.category === 'exportation') {
      totalExports += b;
    } else if (inv.vatRate === 0) {
      totalExemptWithRight += b;
    } else {
      totalGeneralRegimeBase += b;
    }
  }

  const totalVolumeOperations = totalGeneralRegimeBase + totalExemptWithRight + totalExemptWithoutRight + totalIntraEuDeliveries + totalExports;

  const definitiveProrrata = ivaData.config?.prorrata?.definitivePercentage ?? 100;
  const discrepancyAmount = Math.abs((sumOfQuarterDevengado - sumOfQuarterDeducible) - (quarters['1T'].diferencia + quarters['2T'].diferencia + quarters['3T'].diferencia + quarters['4T'].diferencia));

  // Auditoria comparativa Prorrata General vs Especial (Art. 103.Dos.1r LIVA)
  const prorrataComparison = calculateProrrataComparison(ivaData, definitiveProrrata);

  return {
    year,
    totalDevengado: sumOfQuarterDevengado,
    totalDeducible: sumOfQuarterDeducible,
    totalVolumeOperations,
    totalGeneralRegimeBase,
    totalExemptWithRight,
    totalExemptWithoutRight,
    totalIntraEuDeliveries,
    totalExports,
    definitiveProrrata,
    totalAnnualResult,
    accumulatedPendingCarryover: finalPendingCarryover,
    prorrataComparison,
    quartersReconciliation: {
      sumOfQuarterDevengado,
      sumOfQuarterDeducible,
      isBalanced: discrepancyAmount < 0.05,
      discrepancyAmount,
    }
  };
}

/**
 * Avalua si la Prorrata Especial és legalment obligatòria segons l'Art. 103.Dos.1r LIVA
 * (si la deducció amb Prorrata General supera en més d'un 10% la que resultaria d'aplicar la Prorrata Especial).
 */
export function calculateProrrataComparison(
  ivaData: IVAData,
  generalProrrataPercentage: number
): {
  generalDeductionAmount: number;
  specialDeductionAmount: number;
  differenceAmount: number;
  divergencePercentage: number;
  isSpecialProrrataMandatoryByLaw: boolean;
  recommendedRegime: 'general' | 'special';
  warningMessage?: string;
} {
  const receivedInvoices = ivaData.receivedInvoices || [];
  let totalInputVat = 0;
  let directWithRightVat = 0;
  let directWithoutRightVat = 0;
  let commonVat = 0;

  for (const inv of receivedInvoices) {
    const vat = inv.vatAmount || 0;
    totalInputVat += vat;

    if (inv.notes?.includes('exempt') || inv.concept?.toLowerCase().includes('lloguer habitatge')) {
      directWithoutRightVat += vat;
    } else if (inv.category === 'activity_expense' || inv.category === 'activity_supplies') {
      directWithRightVat += vat;
    } else {
      // Despeses comunes o generals
      commonVat += vat;
    }
  }

  // 1. Deducció amb Prorrata General (Art. 104 LIVA)
  const generalDeductionAmount = totalInputVat * (generalProrrataPercentage / 100);

  // 2. Deducció amb Prorrata Especial (Art. 106 LIVA)
  const specialDeductionAmount = directWithRightVat + (commonVat * (generalProrrataPercentage / 100));

  // 3. Comparativa de desviació
  const differenceAmount = generalDeductionAmount - specialDeductionAmount;
  let divergencePercentage = 0;
  if (specialDeductionAmount > 0) {
    divergencePercentage = ((generalDeductionAmount - specialDeductionAmount) / specialDeductionAmount) * 100;
  }

  const isSpecialProrrataMandatoryByLaw = divergencePercentage >= 10.0;
  const recommendedRegime = isSpecialProrrataMandatoryByLaw ? 'special' : (generalDeductionAmount >= specialDeductionAmount ? 'general' : 'special');

  let warningMessage: string | undefined;
  if (isSpecialProrrataMandatoryByLaw) {
    warningMessage = `Alerta Art. 103.Dos.1r LIVA: La deducció amb Prorrata General (${generalDeductionAmount.toFixed(2)} €) supera en un ${divergencePercentage.toFixed(1)}% (més del 10% legal) la Prorrata Especial (${specialDeductionAmount.toFixed(2)} €). L'aplicació de la Prorrata Especial és OBLIGATÒRIA per llei sota risc de sanció del 50%.`;
  }

  return {
    generalDeductionAmount: parseFloat(generalDeductionAmount.toFixed(2)),
    specialDeductionAmount: parseFloat(specialDeductionAmount.toFixed(2)),
    differenceAmount: parseFloat(differenceAmount.toFixed(2)),
    divergencePercentage: parseFloat(divergencePercentage.toFixed(2)),
    isSpecialProrrataMandatoryByLaw,
    recommendedRegime,
    warningMessage,
  };
}

/**
 * Extreu les operacions intracomunitàries per a la declaració del Model 349.
 */
export function extractModel349Entries(ivaData: IVAData): Model349Entry[] {
  const map = new Map<string, Model349Entry>();

  // Factures emeses (Lliuraments intracomunitaris - Clau E o S)
  for (const inv of (ivaData.issuedInvoices || [])) {
    if (inv.category === 'intra_eu_delivery') {
      const key = `${inv.clientNif}_E`;
      if (!map.has(key)) {
        map.set(key, {
          operatorNif: inv.clientNif,
          operatorName: inv.clientName,
          countryCode: inv.clientNif.substring(0, 2),
          key: 'E',
          taxableBase: 0,
        });
      }
      map.get(key)!.taxableBase += inv.taxableBase || 0;
    }
  }

  // Factures rebudes (Adquisicions intracomunitàries - Clau A o I)
  for (const inv of (ivaData.receivedInvoices || [])) {
    if (inv.category === 'intra_eu_acquisition') {
      const key = `${inv.supplierNif}_A`;
      if (!map.has(key)) {
        map.set(key, {
          operatorNif: inv.supplierNif,
          operatorName: inv.supplierName,
          countryCode: inv.supplierNif.substring(0, 2),
          key: 'A',
          taxableBase: 0,
        });
      }
      map.get(key)!.taxableBase += inv.taxableBase || 0;
    }
  }

  return Array.from(map.values());
}

/**
 * Radar d'Alertes i Riscos Fiscals d'IVA.
 */
export function auditIVARisks(ivaData: IVAData): Array<{
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  message: string;
}> {
  const alerts: Array<{ type: 'warning' | 'error' | 'info' | 'success'; title: string; message: string }> = [];

  const issued = ivaData.issuedInvoices || [];

  // 1. Factures d'import elevat sense NIF
  const missingNifIssued = issued.filter(i => !i.clientNif || i.clientNif.trim() === '');
  if (missingNifIssued.length > 0) {
    alerts.push({
      type: 'warning',
      title: 'Factures emeses sense NIF/CIF identificat',
      message: `Hi ha ${missingNifIssued.length} factura/es expedida/es sense NIF de client. L'AEAT exigeix identificació fiscal completa en factures ordinàries.`,
    });
  }

  // 2. Saldos a compensar elevats
  const carryover = ivaData.config?.initialPendingCarryover || 0;
  if (carryover > 5000) {
    alerts.push({
      type: 'info',
      title: 'Bossa de crèdits d\'IVA pendents de compensar',
      message: `Tens un saldo acumulat a compensar de ${carryover.toFixed(2)} €. Recorda que tens un termini de 4 anys per compensar-lo o pots sol·licitar la devolució al 4T (o via REDEME).`,
    });
  }

  // 3. Impacte de la prorrata per arrendament d'habitatges
  const hasExemptRentals = issued.some(i => i.category === 'property_exempt_rental');
  if (hasExemptRentals && !ivaData.config?.hasProrrata) {
    alerts.push({
      type: 'error',
      title: 'Règim de Prorrata obligatori per lloguer d\'habitatges',
      message: `Tens ingressos per arrendament d'habitatge (exempts d'IVA). Segons l'Art. 102 LIVA, has d'aplicar la Regla de Prorrata a l'IVA suportat de les despeses comunes.`,
    });
  }

  // 4. Regularització de béns d'inversió
  if (ivaData.investmentAssets && ivaData.investmentAssets.length > 0) {
    alerts.push({
      type: 'success',
      title: 'Control de Béns d\'Inversió actiu',
      message: `S'estan auditant ${ivaData.investmentAssets.length} actiu/s d'inversió per al període de regularització de 5/10 anys (Art. 107-110 LIVA).`,
    });
  }

  return alerts;
}
