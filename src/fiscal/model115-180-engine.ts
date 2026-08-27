/**
 * @module fiscal/model115-180-engine
 * Motor de Càlcul, Validació i Conciliació dels Models 115 i 180 de l'AEAT.
 * 
 * Normativa:
 * - Art. 75.2.a i Art. 100 del Reglament de l'IRPF (RD 439/2007).
 * - Art. 58 a 62 del Reglament de l'Impost sobre Societats (RD 634/2015).
 * - Ordre EHA/3895/2004 (Aprovació del Model 180).
 * 
 * Finalitat:
 * - Model 115 (Trimestral): Retencions sobre rendiments de l'arrendament d'immobles urbans (tipus oficial general del 19%).
 * - Model 180 (Resum Anual): Declaració informativa anual amb desglossament per arrendador, referència cadastral i immoble.
 */

import type {
  FiscalQuarter,
  Model115Quarterly,
  Model180Annual,
  Model180PerceptorItem,
  Model115LeaseInput,
} from '../types-quarterly.ts';
import type { DeclaracionData } from '../types.ts';
import { exactAdd, exactMultiply, exactSub } from '../utils/exact-math.ts';

export const LEASE_WITHHOLDING_RATE = 0.19; // 19%
export const LEASE_EXEMPTION_ANNUAL_THRESHOLD = 900; // 900 € anuals per arrendador (Art. 75.3.g RIRPF)

export interface LeaseObligationAudit {
  readonly isObligated: boolean;
  readonly reason: string;
  readonly activeLeaseCount: number;
  readonly exemptLeaseCount: number;
  readonly totalAnnualRent: number;
}

export interface Model115vs180Reconciliation {
  readonly isReconciled: boolean;
  readonly sum115Bases: number;
  readonly sum115Withholdings: number;
  readonly model180Bases: number;
  readonly model180Withholdings: number;
  readonly baseDifference: number;
  readonly withholdingDifference: number;
  readonly errorDetails?: string;
}

export class Model115And180Engine {
  /**
   * Avalua si l'arrendatari (autònom o empresa) té l'obligació legal de presentar el Model 115.
   */
  public static auditModel115Obligation(leases: readonly Model115LeaseInput[]): LeaseObligationAudit {
    if (!leases.length) {
      return {
        isObligated: false,
        reason: 'No hi ha immobles urbans afectes a activitats econòmiques en règim d’arrendament.',
        activeLeaseCount: 0,
        exemptLeaseCount: 0,
        totalAnnualRent: 0,
      };
    }

    let activeCount = 0;
    let exemptCount = 0;
    let totalAnnualRent = 0;

    for (const lease of leases) {
      const annualRent = lease.monthlyRent * 12;
      totalAnnualRent = exactAdd(totalAnnualRent, annualRent);

      // Comprovació de causes d'exempció
      if (lease.isExempt) {
        exemptCount++;
      } else if (annualRent <= LEASE_EXEMPTION_ANNUAL_THRESHOLD) {
        exemptCount++;
      } else {
        activeCount++;
      }
    }

    const isObligated = activeCount > 0;
    const reason = isObligated
      ? `Obligació de presentar el Model 115 per ${activeCount} immoble(s) arrendat(s) amb retenció del 19%.`
      : 'Tots els arrendaments estan exempts (renda anual <= 900 € o certificat d’exempció IAE 861.2).';

    return {
      isObligated,
      reason,
      activeLeaseCount: activeCount,
      exemptLeaseCount: exemptCount,
      totalAnnualRent,
    };
  }

  /**
   * Càlcul del Model 115 per a un trimestre específic amb aritmètica decimal exacta.
   */
  public static calculateModel115Quarterly(
    quarter: FiscalQuarter,
    year: number,
    leases: readonly Model115LeaseInput[],
    previousQuarterAdjustments = 0
  ): Model115Quarterly {
    // Filtrem contractes actius subjectes a retenció
    const subjectLeases = leases.filter(l => !l.isExempt && (l.monthlyRent * 12) > LEASE_EXEMPTION_ANNUAL_THRESHOLD);

    let baseTotal = 0;
    let withholdingsTotal = 0;

    // Agrupem per NIF d'arrendador per calcular el nombre de perceptors únics
    const uniqueLandlords = new Set<string>();

    for (const lease of subjectLeases) {
      uniqueLandlords.add(lease.landlordNif.trim().toUpperCase());
      const quarterlyRent = exactMultiply(lease.monthlyRent, 3);
      const rate = lease.withholdingRate || LEASE_WITHHOLDING_RATE;
      const quarterlyWithholding = exactMultiply(quarterlyRent, rate);

      baseTotal = exactAdd(baseTotal, quarterlyRent);
      withholdingsTotal = exactAdd(withholdingsTotal, quarterlyWithholding);
    }

    const totalToPay = Math.max(0, exactSub(withholdingsTotal, previousQuarterAdjustments));

    return {
      quarter,
      year,
      recipientsCount: uniqueLandlords.size,
      baseTotal,
      withholdingsTotal,
      previousQuarterAdjustments,
      totalToPay,
      status: 'draft',
    };
  }

  /**
   * Genera els 4 trimestres complets del Model 115 (1T, 2T, 3T, 4T).
   */
  public static calculateModel115AllQuarters(
    year: number,
    leases: readonly Model115LeaseInput[]
  ): Model115Quarterly[] {
    const quarters: FiscalQuarter[] = ['1T', '2T', '3T', '4T'];
    return quarters.map(q => this.calculateModel115Quarterly(q, year, leases));
  }

  /**
   * Genera el Resum Anual Model 180 a partir dels contractes i declaracions trimestrals.
   */
  public static generateModel180Annual(
    year: number,
    leases: readonly Model115LeaseInput[],
    quarters115?: readonly Model115Quarterly[]
  ): Model180Annual {
    const subjectLeases = leases.filter(l => !l.isExempt && (l.monthlyRent * 12) > LEASE_EXEMPTION_ANNUAL_THRESHOLD);

    const perceptors: Model180PerceptorItem[] = [];
    let totalBase = 0;
    let totalWithholding = 0;

    for (const lease of subjectLeases) {
      const annualBase = exactMultiply(lease.monthlyRent, 12);
      const rate = lease.withholdingRate || LEASE_WITHHOLDING_RATE;
      const annualWithholding = exactMultiply(annualBase, rate);

      totalBase = exactAdd(totalBase, annualBase);
      totalWithholding = exactAdd(totalWithholding, annualWithholding);

      perceptors.push({
        landlordNif: lease.landlordNif.trim().toUpperCase(),
        landlordName: lease.landlordName.trim(),
        cadastralReference: (lease.cadastralReference || '').trim().toUpperCase(),
        address: lease.address.trim(),
        postalCode: lease.postalCode.trim(),
        municipality: lease.municipality.trim(),
        provinceCode: lease.provinceCode.trim(),
        propertySituation: lease.propertySituation || '1',
        annualBase,
        withholdingRate: rate,
        annualWithholding,
      });
    }

    // Comprovació de reconciliació amb els 4 trimestres del 115
    let reconciliationWith115Status: 'perfect' | 'discrepancy' = 'perfect';
    let discrepancyAmount = 0;

    if (quarters115 && quarters115.length === 4) {
      const sum115Bases = quarters115.reduce((sum, q) => exactAdd(sum, q.baseTotal), 0);
      const sum115Withholdings = quarters115.reduce((sum, q) => exactAdd(sum, q.withholdingsTotal), 0);

      const diffBases = Math.abs(exactSub(sum115Bases, totalBase));
      const diffWithholdings = Math.abs(exactSub(sum115Withholdings, totalWithholding));

      if (diffBases > 0.05 || diffWithholdings > 0.05) {
        reconciliationWith115Status = 'discrepancy';
        discrepancyAmount = Math.max(diffBases, diffWithholdings);
      }
    }

    const uniqueLandlords = new Set(perceptors.map(p => p.landlordNif));

    return {
      year,
      totalRecipientsCount: uniqueLandlords.size,
      totalBaseAnnual: totalBase,
      totalWithholdingsAnnual: totalWithholding,
      perceptors,
      reconciliationWith115Status,
      discrepancyAmount: discrepancyAmount > 0 ? discrepancyAmount : undefined,
    };
  }

  /**
   * Conciliació Creuada estricta entre els 4 trimestres del Model 115 i el Resum Anual Model 180.
   */
  public static reconcileModel115vs180(
    quarters115: readonly Model115Quarterly[],
    model180: Model180Annual
  ): Model115vs180Reconciliation {
    const sum115Bases = quarters115.reduce((sum, q) => exactAdd(sum, q.baseTotal), 0);
    const sum115Withholdings = quarters115.reduce((sum, q) => exactAdd(sum, q.withholdingsTotal), 0);

    const baseDiff = Math.abs(exactSub(sum115Bases, model180.totalBaseAnnual));
    const withDiff = Math.abs(exactSub(sum115Withholdings, model180.totalWithholdingsAnnual));

    const isReconciled = baseDiff <= 0.05 && withDiff <= 0.05;

    let errorDetails: string | undefined;
    if (!isReconciled) {
      errorDetails = `Desquadrament detectat: Model 115 (1T-4T) suma ${sum115Withholdings.toFixed(2)} € en retencions, però el Model 180 en declara ${model180.totalWithholdingsAnnual.toFixed(2)} € (Diferència: ${withDiff.toFixed(2)} €).`;
    }

    return {
      isReconciled,
      sum115Bases,
      sum115Withholdings,
      model180Bases: model180.totalBaseAnnual,
      model180Withholdings: model180.totalWithholdingsAnnual,
      baseDifference: baseDiff,
      withholdingDifference: withDiff,
      errorDetails,
    };
  }

  /**
   * Conciliació Creuada amb la Renda de l'Arrendador (Model 100 Casella 0597):
   * Comprova que les retencions suportades pel propietari coincideixen amb les ingressades pel llogater al Model 180.
   */
  public static reconcileModel180vsLandlordDeclaracion(
    model180: Model180Annual,
    landlordData: DeclaracionData
  ): { isMatching: boolean; expectedWithholding: number; declaredWithholding: number; difference: number } {
    const expectedWithholding = model180.totalWithholdingsAnnual;
    const declaredWithholding = landlordData.capitalIncome?.realEstateWithholdings || 0;
    const difference = Math.abs(exactSub(expectedWithholding, declaredWithholding));
    const isMatching = difference <= 0.05;

    return {
      isMatching,
      expectedWithholding,
      declaredWithholding,
      difference,
    };
  }
}
