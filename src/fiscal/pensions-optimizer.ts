/**
 * @module fiscal/pensions-optimizer
 * Motor d'optimització de rescat de plans de pensions.
 * Calcula el tractament fiscal del rescat en Capital, Renda i Mixt, aplicant
 * la reducció del 40% per aportacions anteriors a 31/12/2006 (DT 12a LIRPF)
 * i calculant l'IRPF marginal exacte segons les escales vigents.
 */

import type { PensionRescueData } from '../types-strategy.ts';
import { createEmptyDeclaracion } from './declaration-factory.ts';
import { calculateIRPF } from './irpf.ts';
import { round2 } from '../utils/exact-math.ts';

export class PensionsOptimizerEngine {
  /**
   * Genera escenaris òptims de rescat d'un pla de pensions.
   */
  public static optimizeRescue(data: PensionRescueData): PensionRescueData {
    const totalValue = data.pensionFundValue;
    const pre2007 = data.pre2007Contributions;

    // DT 12a LIRPF: Terminis per aplicar la reducció del 40% en forma de capital per aportacions pre-2007:
    // - Contingències esdevingudes fins a 2010: el termini va finalitzar el 31/12/2018 (extingit).
    // - Contingències esdevingudes 2011-2014: 8 exercicis següents a aquell en què va succeir la contingència.
    // - Contingències 2015 en endavant (inclòs 2022+): exercici de jubilació o els 2 següents (yearsSinceRetirement <= 2).
    let canApply40Reduction = false;
    const currentYear = 2024;
    const retYear = data.retirementYear ?? currentYear - data.yearsSinceRetirement;

    if (retYear <= 2010) {
      canApply40Reduction = false;
    } else if (retYear >= 2011 && retYear <= 2014) {
      canApply40Reduction = data.yearsSinceRetirement <= 8;
    } else {
      canApply40Reduction = data.yearsSinceRetirement <= 2;
    }

    // Reducció aplicable al rescat en forma de capital de prestacions anteriors a 31/12/2006
    const reductionAmount = canApply40Reduction ? round2(pre2007 * 0.4) : 0;

    const scenarios = [];

    // --- ESCENARI 1: Rescat 100% en Capital ---
    // Tot de cop el primer any
    const baseCapital = totalValue - reductionAmount;
    const taxCostCapital = round2(
      this.estimarIRPF(baseCapital + data.otherYearlyIncome) - this.estimarIRPF(data.otherYearlyIncome),
    );
    scenarios.push({
      name: 'Rescat 100% Capital',
      description: 'Rescatar tot el fons en un únic pagament (Atenció al salt de tram IRPF).',
      rescueFormat: 'capital' as const,
      capitalRescueAmount: totalValue,
      yearlyRentaAmount: 0,
      taxCost: taxCostCapital,
      netReceivedFirstYear: round2(totalValue - taxCostCapital),
    });

    // --- ESCENARI 2: Rescat 100% en Renda (5 anys) ---
    // Repartit en 5 anys
    const yearlyRenta = round2(totalValue / 5);
    const taxCostYearly = round2(
      this.estimarIRPF(yearlyRenta + data.otherYearlyIncome) - this.estimarIRPF(data.otherYearlyIncome),
    );
    const taxCostRentaTotal = round2(taxCostYearly * 5); // Estimació a 5 anys constants
    scenarios.push({
      name: 'Rescat Renda (5 anys)',
      description: "Repartir el rescat en 5 anualitats idèntiques per diluir l'impacte fiscal.",
      rescueFormat: 'renta' as const,
      capitalRescueAmount: 0,
      yearlyRentaAmount: yearlyRenta,
      taxCost: taxCostRentaTotal,
      netReceivedFirstYear: round2(yearlyRenta - taxCostYearly),
    });

    // --- ESCENARI 3: Rescat Mixt (Capital pre-2007 + Renda post-2007) ---
    if (pre2007 > 0 && canApply40Reduction) {
      const restValue = totalValue - pre2007;
      const yearlyRestRenta = round2(restValue / 5); // Renda a 5 anys de la resta

      const taxCostMixtFirstYear = round2(
        this.estimarIRPF(data.otherYearlyIncome + (pre2007 - reductionAmount) + yearlyRestRenta) -
          this.estimarIRPF(data.otherYearlyIncome),
      );
      const taxCostMixtSubsequentYears = round2(
        this.estimarIRPF(data.otherYearlyIncome + yearlyRestRenta) - this.estimarIRPF(data.otherYearlyIncome),
      );
      const taxCostMixtTotal = round2(taxCostMixtFirstYear + taxCostMixtSubsequentYears * 4);

      scenarios.push({
        name: 'Rescat Mixt Òptim',
        description:
          'Cobrar el capital pre-2007 de cop aprofitant el 40% de reducció, i la resta en rendes de 5 anys.',
        rescueFormat: 'mixto' as const,
        capitalRescueAmount: pre2007,
        yearlyRentaAmount: yearlyRestRenta,
        taxCost: taxCostMixtTotal,
        netReceivedFirstYear: round2(pre2007 + yearlyRestRenta - taxCostMixtFirstYear),
      });
    }

    // Determinar el millor escenari (el que té menys cost fiscal total)
    let bestScenario = scenarios[0];
    for (const sc of scenarios) {
      if (sc.taxCost < bestScenario.taxCost) {
        bestScenario = sc;
      }
    }

    return {
      ...data,
      scenarios,
      bestScenarioName: bestScenario.name,
    };
  }

  /**
   * Càlcul de la quota d'IRPF aplicant el motor oficial calculateIRPF
   * sobre un declarant de referència per a una base de treball donada.
   */
  private static estimarIRPF(base: number): number {
    if (base <= 0) return 0;
    const decl = createEmptyDeclaracion(2024);
    decl.workIncome.employers = [
      {
        id: 'pension_rescue_sim',
        name: 'Rendiments / Fons Pensió',
        grossSalary: base,
        inKind: 0,
        withholdings: 0,
        socialSecurity: 0,
        dietsIncome: 0,
        dietsDays: 0,
        mileageIncome: 0,
        mileageKm: 0,
      },
    ];
    const result = calculateIRPF(decl);
    return round2(result.netTax);
  }
}
