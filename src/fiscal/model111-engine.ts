import type { Model111Quarterly, Model115Quarterly, FiscalQuarter } from '../types-quarterly.ts';

export class WithholdingsEngine {
  /**
   * Càlcul del Model 111 Trimestral.
   * Agrupa les percepcions i retencions de treballadors i professionals.
   */
  public static calculateModel111(
    quarter: FiscalQuarter,
    year: number,
    workRecipientsCount: number,
    workBaseTotal: number,
    workWithholdings: number,
    profRecipientsCount: number,
    profBaseTotal: number,
    profWithholdings: number
  ): Model111Quarterly {
    const totalToPay = workWithholdings + profWithholdings;

    return {
      quarter,
      year,
      workRecipientsCount,
      workBaseTotal,
      workWithholdings,
      profRecipientsCount,
      profBaseTotal,
      profWithholdings,
      totalToPay,
      status: 'draft'
    };
  }

  /**
   * Càlcul del Model 115 Trimestral.
   * Agrupa les retencions per arrendament de locals.
   */
  public static calculateModel115(
    quarter: FiscalQuarter,
    year: number,
    recipientsCount: number,
    baseTotal: number,
    withholdingsTotal: number
  ): Model115Quarterly {
    return {
      quarter,
      year,
      recipientsCount,
      baseTotal,
      withholdingsTotal,
      totalToPay: withholdingsTotal,
      status: 'draft'
    };
  }
}
