import type { InheritanceDonationData, KinshipGroup } from '../types-patrimonial.ts';

export class InheritanceTaxEngine {
  /**
   * Càlcul complet del Model 650 (Successions) / 651 (Donacions)
   */
  public static calculate(data: InheritanceDonationData): InheritanceDonationData {
    // 1. Masa Hereditaria / Base Imposable
    const masa = data.realEstateValue + data.financialAssetsValue + data.lifeInsuranceValue;
    
    // Ajuar domèstic (normalment 3% del cabal relicte en successions)
    const ajuar = data.type === 'inheritance' ? masa * 0.03 : 0;
    
    // Base imposable prèvia
    const basePrevia = masa + ajuar - data.deductibleDebts - data.deductibleExpenses;
    const taxableBase = Math.max(0, basePrevia);

    // 2. Reduccions estatals / autonòmiques
    let reductions = data.reductionPrimaryResidence + data.reductionFamilyBusiness;
    
    // Reduccions per parentiu (Estatals per defecte)
    if (data.kinshipGroup === 'I') reductions += 15956.87;
    else if (data.kinshipGroup === 'II') reductions += 15956.87;
    else if (data.kinshipGroup === 'III') reductions += 7993.46;
    
    // Discapacitat
    if (data.disabilityDegree >= 33 && data.disabilityDegree < 65) reductions += 47858.59;
    if (data.disabilityDegree >= 65) reductions += 150253.03;

    // 3. Base Liquidable
    const liquidableBase = Math.max(0, taxableBase - reductions);

    // 4. Quota Íntegra (Escala estatal simplificada per a l'exemple)
    const grossTax = this.calculateTarifa(liquidableBase);

    // 5. Coeficient Multiplicador (Patrimoni preexistent + Parentiu)
    const multiplier = this.getMultiplier(data.kinshipGroup, data.preExistingWealth);

    // 6. Quota Tributària
    const netTax = grossTax * multiplier;

    // 7. Bonificacions Autonòmiques (Simplificació per demostració)
    let autonomicBonus = 0;
    if (data.community === 'MAD' && (data.kinshipGroup === 'I' || data.kinshipGroup === 'II')) {
      autonomicBonus = netTax * 0.99; // 99% bonificat a Madrid
    } else if (data.community === 'AND' && (data.kinshipGroup === 'I' || data.kinshipGroup === 'II')) {
      autonomicBonus = netTax * 0.99; // 99% a Andalusia
    } else if (data.community === 'CAT' && (data.kinshipGroup === 'I' || data.kinshipGroup === 'II')) {
      // Catalunya té bonificacions per trams, aquí apliquem un fix simulable (ex: 60%)
      autonomicBonus = netTax * 0.60; 
    }

    // 8. Quota a ingressar
    const amountDue = Math.max(0, netTax - autonomicBonus);

    return {
      ...data,
      householdFurnishingsValue: ajuar,
      taxableBase,
      liquidableBase,
      grossTax,
      multiplierBase: multiplier,
      netTax,
      autonomicBonus,
      amountDue
    };
  }

  private static calculateTarifa(base: number): number {
    // Escala simplificada (en un entorn real s'usa la taula progressiva de 16 trams)
    if (base <= 0) return 0;
    if (base <= 7993.46) return base * 0.0765;
    if (base <= 31956) return (7993.46 * 0.0765) + ((base - 7993.46) * 0.085);
    // ... salt simplificat al marginal per bases majors
    return base * 0.15; // Placeholder for demo
  }

  private static getMultiplier(kinship: KinshipGroup, preWealth: number): number {
    let multiplier = 1.0;
    if (kinship === 'I' || kinship === 'II') {
      if (preWealth <= 402678.11) multiplier = 1.0;
      else if (preWealth <= 2007380.43) multiplier = 1.05;
      else if (preWealth <= 4000000) multiplier = 1.1;
      else multiplier = 1.2;
    } else if (kinship === 'III') {
      multiplier = 1.5882;
      if (preWealth > 402678.11) multiplier = 1.6676;
    } else {
      multiplier = 2.0;
      if (preWealth > 402678.11) multiplier = 2.4;
    }
    return multiplier;
  }
}
