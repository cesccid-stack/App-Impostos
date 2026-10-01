/**
 * @module fiscal/model130-engine
 * Motor de càlcul del Model 130 (Pagament fraccionat de l'IRPF per a autònoms en Estimació Directa).
 * Implementa el tipus general del 20%, la deducció per habitatge habitual (Art. 110.3.b RIRPF),
 * la minoració per baixos rendiments (Art. 110.3.c RIRPF / Art. 80 bis LIRPF)
 * i l'arrossegament acumulat de trimestres anteriors.
 */

import type { Model130Quarterly, FiscalQuarter } from '../types-quarterly.ts';
import type { ActivitiesData } from '../types.ts';
import { round2 } from '../utils/exact-math.ts';

export class Model130Engine {
  /**
   * Càlcul del Model 130 per al trimestre indicat.
   * Els imports són acumulats des de l'1 de gener fins al darrer dia del trimestre.
   */
  public static calculateQuarter(
    quarter: FiscalQuarter,
    year: number,
    accumulatedIncome: number,
    accumulatedExpenses: number,
    accumulatedWithholdings: number,
    previousFractionalPayments: number,
    hasHomeLoanDeduction: boolean,
    previousYearNetYield?: number,
  ): Model130Quarterly {
    // 1. Rendiment Net Acumulat (Casella 03)
    const netYield = Math.max(0, round2(accumulatedIncome - accumulatedExpenses));

    // 2. Quota al 20% (Casella 04)
    const grossTax = round2(netYield * 0.2);

    // 3. Deducció per habitatge habitual (Art. 110.3.b RIRPF)
    // 2% del rendiment net de la casella 03, amb un límit màxim anual de 660,14 €
    // prorratejat acumulativament segons el trimestre (165,04 € per trimestre).
    let deductionHomeLoan = 0;
    if (hasHomeLoanDeduction && netYield > 0) {
      const qFactor = quarter === '1T' ? 0.25 : quarter === '2T' ? 0.5 : quarter === '3T' ? 0.75 : 1.0;
      const maxHomeLoanQuarter = round2(660.14 * qFactor);
      deductionHomeLoan = Math.min(round2(netYield * 0.02), maxHomeLoanQuarter);
    }

    // 4. Minoració per baixos rendiments (Art. 110.3.c RIRPF / Art. 80 bis LIRPF)
    // S'aplica quan el rendiment net de l'activitat de l'any anterior va ser <= 12.000 €
    // o calculat de manera estimada sobre el rendiment anualitzat si no es disposa del valor previ.
    let minoracion = 0;
    const qIndex = quarter === '1T' ? 1 : quarter === '2T' ? 2 : quarter === '3T' ? 3 : 4;
    const refYield = previousYearNetYield ?? (accumulatedIncome > 0 ? netYield / (qIndex * 0.25) : 0);
    if (refYield > 0 && refYield <= 9000) {
      minoracion = 100 * qIndex;
    } else if (refYield > 9000 && refYield <= 10000) {
      minoracion = 75 * qIndex;
    } else if (refYield > 10000 && refYield <= 11000) {
      minoracion = 50 * qIndex;
    } else if (refYield > 11000 && refYield <= 12000) {
      minoracion = 25 * qIndex;
    }

    // 5. Resultat final de la liquidació (Casella 07 / 19)
    const netTax = round2(
      grossTax - deductionHomeLoan - minoracion - accumulatedWithholdings - previousFractionalPayments,
    );

    return {
      quarter,
      year,
      incomeTotal: accumulatedIncome,
      expensesTotal: accumulatedExpenses,
      netYield,
      taxRate: 0.2,
      grossTax,
      withholdingsPrevious: accumulatedWithholdings,
      fractionalPaymentsPrevious: previousFractionalPayments,
      minoracion,
      deductionHomeLoan,
      netTax,
      status: 'draft',
    };
  }

  /**
   * @deprecated Càlcul estimatiu a partir del total anual d'activitats econòmiques de l'IRPF.
   * ADVERTÈNCIA FISCAL: Distribueix els ingressos anuals de forma lineal (25% per trimestre).
   * Per a una presentació oficial i vinculant del Model 130 davant l'AEAT, s'han d'utilitzar
   * els registres reals de factures emeses i rebudes corresponents a cadascun dels períodes trimestrals.
   */
  public static calculateFromYearlyActivities(
    activities: ActivitiesData,
    year: number,
    hasHomeLoan: boolean,
  ): Model130Quarterly[] {
    const q1Income = round2(activities.income * 0.25);
    const q1Expenses = round2(activities.expenses * 0.25);
    const q1Withholdings = round2(activities.withholdings * 0.25);

    const warningText =
      'Distribució lineal estimada (25%/trimestre). No apte per a presentació vinculant AEAT sense facturació real.';

    const q1 = this.calculateQuarter('1T', year, q1Income, q1Expenses, q1Withholdings, 0, hasHomeLoan);
    q1.isLinearSimulation = true;
    q1.simulationWarning = warningText;

    const q2 = this.calculateQuarter(
      '2T',
      year,
      q1Income * 2,
      q1Expenses * 2,
      q1Withholdings * 2,
      Math.max(0, q1.netTax),
      hasHomeLoan,
    );
    q2.isLinearSimulation = true;
    q2.simulationWarning = warningText;

    const q3 = this.calculateQuarter(
      '3T',
      year,
      q1Income * 3,
      q1Expenses * 3,
      q1Withholdings * 3,
      Math.max(0, q1.netTax) + Math.max(0, q2.netTax),
      hasHomeLoan,
    );
    q3.isLinearSimulation = true;
    q3.simulationWarning = warningText;

    const q4 = this.calculateQuarter(
      '4T',
      year,
      q1Income * 4,
      q1Expenses * 4,
      q1Withholdings * 4,
      Math.max(0, q1.netTax) + Math.max(0, q2.netTax) + Math.max(0, q3.netTax),
      hasHomeLoan,
    );
    q4.isLinearSimulation = true;
    q4.simulationWarning = warningText;

    return [q1, q2, q3, q4];
  }
}
