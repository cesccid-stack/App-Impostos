import { calculateSavingsTaxEUR } from './investment-cockpit-engine.ts';
import type { AutonomoVsSLData } from '../types-strategy.ts';

export class AutonomoVsSLEngine {
  /**
   * Càlcul bàsic per comparar la càrrega tributària d'un autònom vs S.L.
   */
  public static simulate(data: AutonomoVsSLData): AutonomoVsSLData {
    const netProfit = data.expectedRevenue - data.expectedExpenses;
    
    if (netProfit <= 0) {
      return {
        ...data,
        netIncomeAutonomo: 0,
        totalTaxesAutonomo: data.autonomoQuota,
        netIncomeSL: 0,
        totalTaxesSL: data.slMaintenanceCost,
        recommendation: 'autonomo',
        savings: 0
      };
    }

    // --- ESCENARI AUTÒNOM ---
    // Benefici abans d'IRPF (restant la quota d'autònoms com a despesa si no s'ha inclòs)
    const baseIrpf = Math.max(0, netProfit - data.autonomoQuota);
    
    // Càlcul simplificat de l'IRPF (tipus efectiu sobre la base)
    // En realitat usariem les taules de l'IRPF, fem una simulació bàsica
    const tipusEfectiuIRPF = this.estimarTipusEfectiuIRPF(baseIrpf);
    const irpfAmount = baseIrpf * tipusEfectiuIRPF;
    
    const totalTaxesAutonomo = irpfAmount + data.autonomoQuota;
    const netIncomeAutonomo = netProfit - totalTaxesAutonomo;

    // --- ESCENARI S.L. ---
    // Benefici de l'empresa després de pagar el sou al soci i costos extres
    const baseImposableIS = Math.max(0, netProfit - data.societalSalary - data.slMaintenanceCost - data.autonomoQuota); // Assumeix quota autònoms societaris com a cost
    
    // Impost de Societats
    const corporateTaxAmount = baseImposableIS * (data.corporateTaxRate / 100);
    const netCorporateProfit = baseImposableIS - corporateTaxAmount;
    
    // IRPF del Sou del Soci (sobre data.societalSalary)
    const irpfSouSoci = data.societalSalary * this.estimarTipusEfectiuIRPF(data.societalSalary);
    
    // Repartiment de dividends (assumeix que es reparteix tot el benefici net de la societat)
    // Tributació de l'estalvi: 19% fins 6k, 21% fins 50k, 23% fins 200k, 27% fins 300k, 28% resta
    const dividentsBruts = netCorporateProfit;
    const taxDividends = this.estimarTipusEstalvi(dividentsBruts);
    const netDividends = dividentsBruts - taxDividends;

    const totalTaxesSL = corporateTaxAmount + irpfSouSoci + taxDividends + data.autonomoQuota + data.slMaintenanceCost;
    const netIncomeSL = (data.societalSalary - irpfSouSoci) + netDividends;

    // --- COMPARATIVA ---
    const recommendation = netIncomeSL > netIncomeAutonomo ? 'sl' : 'autonomo';
    const savings = Math.abs(netIncomeSL - netIncomeAutonomo);

    return {
      ...data,
      netIncomeAutonomo,
      totalTaxesAutonomo,
      netIncomeSL,
      totalTaxesSL,
      recommendation,
      savings
    };
  }

  // Mètodes privats d'estimació per a la simulació
  private static estimarTipusEfectiuIRPF(base: number): number {
    if (base <= 12450) return 0.19;
    if (base <= 20200) return 0.24;
    if (base <= 35200) return 0.30;
    if (base <= 60000) return 0.37;
    if (base <= 300000) return 0.45;
    return 0.47;
  }

  private static estimarTipusEstalvi(base: number): number {
    return calculateSavingsTaxEUR(base);
  }
}
