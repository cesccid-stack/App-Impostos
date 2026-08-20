import type { PensionRescueData } from '../types-strategy.ts';

export class PensionsOptimizerEngine {
  /**
   * Genera escenaris òptims de rescat d'un pla de pensions.
   */
  public static optimizeRescue(data: PensionRescueData): PensionRescueData {
    const totalValue = data.pensionFundValue;
    const pre2007 = data.pre2007Contributions;
    
    // Si han passat més de 2 anys (com a norma general/règim transitori, depèn de l'any de jubilació), 
    // pot perdre's el dret a la reducció del 40% en forma de capital per contingències anteriors a 2007.
    // Ho simplifiquem assumint que si anys <= 2, manté el dret.
    const canApply40Reduction = data.yearsSinceRetirement <= 2;
    
    // Reducció aplicable al rescat en forma de capital de prestacions anteriors a 31/12/2006
    const reductionAmount = canApply40Reduction ? (pre2007 * 0.40) : 0;
    
    const scenarios = [];

    // --- ESCENARI 1: Rescat 100% en Capital ---
    // Tot de cop el primer any
    const baseCapital = totalValue - reductionAmount;
    const taxCostCapital = this.estimarIRPF(baseCapital + data.otherYearlyIncome) - this.estimarIRPF(data.otherYearlyIncome);
    scenarios.push({
      name: 'Rescat 100% Capital',
      description: 'Rescatar tot el fons en un únic pagament (Atenció al salt de tram IRPF).',
      rescueFormat: 'capital' as const,
      capitalRescueAmount: totalValue,
      yearlyRentaAmount: 0,
      taxCost: taxCostCapital,
      netReceivedFirstYear: totalValue - taxCostCapital
    });

    // --- ESCENARI 2: Rescat 100% en Renda (5 anys) ---
    // Repartit en 5 anys
    const yearlyRenta = totalValue / 5;
    const taxCostYearly = this.estimarIRPF(yearlyRenta + data.otherYearlyIncome) - this.estimarIRPF(data.otherYearlyIncome);
    const taxCostRentaTotal = taxCostYearly * 5; // Estimació a 5 anys constants
    scenarios.push({
      name: 'Rescat Renda (5 anys)',
      description: 'Repartir el rescat en 5 anualitats idèntiques per diluir l\'impacte fiscal.',
      rescueFormat: 'renta' as const,
      capitalRescueAmount: 0,
      yearlyRentaAmount: yearlyRenta,
      taxCost: taxCostRentaTotal,
      netReceivedFirstYear: yearlyRenta - taxCostYearly
    });

    // --- ESCENARI 3: Rescat Mixt (Capital pre-2007 + Renda post-2007) ---
    if (pre2007 > 0 && canApply40Reduction) {
      const restValue = totalValue - pre2007;
      const yearlyRestRenta = restValue / 5; // Renda a 5 anys de la resta
      
      const taxCostMixtFirstYear = this.estimarIRPF(data.otherYearlyIncome + (pre2007 - reductionAmount) + yearlyRestRenta) - this.estimarIRPF(data.otherYearlyIncome);
      const taxCostMixtSubsequentYears = this.estimarIRPF(data.otherYearlyIncome + yearlyRestRenta) - this.estimarIRPF(data.otherYearlyIncome);
      const taxCostMixtTotal = taxCostMixtFirstYear + (taxCostMixtSubsequentYears * 4);

      scenarios.push({
        name: 'Rescat Mixt Òptim',
        description: 'Cobrar el capital pre-2007 de cop aprofitant el 40% de reducció, i la resta en rendes de 5 anys.',
        rescueFormat: 'mixto' as const,
        capitalRescueAmount: pre2007,
        yearlyRentaAmount: yearlyRestRenta,
        taxCost: taxCostMixtTotal,
        netReceivedFirstYear: pre2007 + yearlyRestRenta - taxCostMixtFirstYear
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
      bestScenarioName: bestScenario.name
    };
  }

  // Càlcul ràpid marginal simplificat per IRPF (General)
  private static estimarIRPF(base: number): number {
    if (base <= 12450) return base * 0.19;
    if (base <= 20200) return (12450 * 0.19) + ((base - 12450) * 0.24);
    if (base <= 35200) return (12450 * 0.19) + (7750 * 0.24) + ((base - 20200) * 0.30);
    if (base <= 60000) return (12450 * 0.19) + (7750 * 0.24) + (15000 * 0.30) + ((base - 35200) * 0.37);
    if (base <= 300000) return (12450 * 0.19) + (7750 * 0.24) + (15000 * 0.30) + (24800 * 0.37) + ((base - 60000) * 0.45);
    return (12450 * 0.19) + (7750 * 0.24) + (15000 * 0.30) + (24800 * 0.37) + (240000 * 0.45) + ((base - 300000) * 0.47);
  }
}
