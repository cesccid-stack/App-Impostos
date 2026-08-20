import type { Model130Quarterly, FiscalQuarter } from '../types-quarterly.ts';
import type { ActivitiesData } from '../types.ts';

export class Model130Engine {
  /**
   * Càlcul del Model 130 per al trimestre indicat.
   * Suposem una simplificació on s'arrosseguen els imports.
   */
  public static calculateQuarter(
    quarter: FiscalQuarter,
    year: number,
    accumulatedIncome: number,
    accumulatedExpenses: number,
    accumulatedWithholdings: number,
    previousFractionalPayments: number,
    hasHomeLoanDeduction: boolean
  ): Model130Quarterly {
    // 1. Rendiment Net
    const netYield = Math.max(0, accumulatedIncome - accumulatedExpenses);
    
    // 2. Quota al 20%
    const grossTax = netYield * 0.20;
    
    // 3. Deducció per habitatge habitual (2% del rendiment net, màxim 660,14)
    // S'aplica si es tenen dret a la deducció (prèvia a 2013)
    let deductionHomeLoan = 0;
    if (hasHomeLoanDeduction && netYield > 0) {
      deductionHomeLoan = Math.min(netYield * 0.02, 660.14);
    }
    
    // 4. Minoració per baixos rendiments (Art. 80 bis) - Simplificat a 0 per defecte
    // A la pràctica, depèn dels rendiments de l'exercici anterior.
    const minoracion = 0;
    
    // 5. Resultat final abans de minoracions
    let netTax = grossTax - deductionHomeLoan - minoracion - accumulatedWithholdings - previousFractionalPayments;
    
    // Si és negatiu, és a deduir en trimestres posteriors o a tornar a final d'any, normalment s'indica 0 si s'arrossega.
    // Per al model 130 es pot presentar amb resultat negatiu.
    
    return {
      quarter,
      year,
      incomeTotal: accumulatedIncome,
      expensesTotal: accumulatedExpenses,
      netYield,
      taxRate: 0.20,
      grossTax,
      withholdingsPrevious: accumulatedWithholdings,
      fractionalPaymentsPrevious: previousFractionalPayments,
      minoracion,
      deductionHomeLoan,
      netTax,
      status: 'draft'
    };
  }

  /**
   * Extracció de dades des de l'objecte global d'activitats econòmiques de l'IRPF
   * (En una versió real, això vindria dels llibres diaris de factures de l'usuari).
   */
  public static calculateFromYearlyActivities(
    activities: ActivitiesData,
    year: number,
    hasHomeLoan: boolean
  ): Model130Quarterly[] {
    // Simulació de distribució per trimestres assumint linealitat.
    // En producció, s'llegiria factura a factura sumant fins l'últim dia de cada trimestre.
    const q1Income = activities.income * 0.25;
    const q1Expenses = activities.expenses * 0.25;
    const q1Withholdings = activities.withholdings * 0.25;
    
    const q1 = this.calculateQuarter('1T', year, q1Income, q1Expenses, q1Withholdings, 0, hasHomeLoan);
    
    const q2 = this.calculateQuarter('2T', year, q1Income * 2, q1Expenses * 2, q1Withholdings * 2, Math.max(0, q1.netTax), hasHomeLoan);
    const q3 = this.calculateQuarter('3T', year, q1Income * 3, q1Expenses * 3, q1Withholdings * 3, Math.max(0, q1.netTax) + Math.max(0, q2.netTax), hasHomeLoan);
    const q4 = this.calculateQuarter('4T', year, q1Income * 4, q1Expenses * 4, q1Withholdings * 4, Math.max(0, q1.netTax) + Math.max(0, q2.netTax) + Math.max(0, q3.netTax), hasHomeLoan);
    
    return [q1, q2, q3, q4];
  }
}
