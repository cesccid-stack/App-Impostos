import type { WealthSolidarityTaxData } from '../types-patrimonial.ts';

export class AutonomicEngine {
  /**
   * Càlcul de l'Impost Temporal de Solidaritat de les Grans Fortunes (Model 718)
   */
  public static calculateSolidarityTax(data: WealthSolidarityTaxData): WealthSolidarityTaxData {
    // 1. Mínim exempt (3.000.000 € per norma general)
    const minimExempt = 3000000;
    
    // 2. Exempció d'habitatge habitual (màxim 300.000 €)
    const exempcioHabitatge = Math.min(data.primaryResidenceExemption, 300000);
    
    // 3. Base Imposable
    const taxableBase = Math.max(0, data.netWealth - exempcioHabitatge - minimExempt);
    
    // 4. Quota Íntegra
    // Escala:
    // Fins a 3.000.000 (Base liquidable 0) -> 0%
    // De 3M a 5M -> 1,7%
    // De 5M a 10M -> 2,1%
    // Més de 10M -> 3,5%
    let grossTax = 0;
    if (taxableBase > 0) {
      if (taxableBase <= 2366782.91) { // Més o menys el 1r tram
         // (Aproximació segons l'escala de l'estat)
         grossTax = taxableBase * 0.017;
      } else if (taxableBase <= 7366782.91) {
         grossTax = (2366782.91 * 0.017) + ((taxableBase - 2366782.91) * 0.021);
      } else {
         grossTax = (2366782.91 * 0.017) + (5000000 * 0.021) + ((taxableBase - 7366782.91) * 0.035);
      }
    }
    
    // 5. Límit de la Quota Íntegra Conjunta (IRPF + IP + IGF <= 60% base IRPF)
    // Suposem simplificadament que no aplica el límit per aquest càlcul o l'apliquem directament
    const limitApplied = false; 
    
    // 6. Deducció de la quota pagada per l'Impost sobre el Patrimoni (Model 714) de la mateixa CCAA
    const amountDue = Math.max(0, grossTax - data.wealthTaxPaid);
    
    return {
      ...data,
      taxableBase,
      grossTax,
      limitApplied,
      amountDue
    };
  }
}
