import type { ITPAndAJDData, MunicipalPlusvaliaData } from '../types-patrimonial.ts';

export class ITPAndAJDEngine {
  /**
   * Càlcul del Model 600 (ITP i AJD)
   */
  public static calculateITPAJD(data: ITPAndAJDData): ITPAndAJDData {
    let taxRate = 0;

    // Tipus impositius genèrics (depèn molt de la CCAA, simplificat)
    if (data.operationType === 'TPO') {
      if (data.community === 'CAT') {
        taxRate = data.isPrimaryResidence && data.buyerAge <= 32 ? 5 : 10;
        if (data.disabilityDegree >= 33 || data.largeFamily) taxRate = 5;
      } else if (data.community === 'MAD') {
        taxRate = 6;
      } else {
        taxRate = 8; // Resta general
      }
    } else if (data.operationType === 'AJD') {
      if (data.community === 'CAT') taxRate = 1.5;
      else if (data.community === 'MAD') taxRate = 0.75;
      else taxRate = 1.0;
    } else if (data.operationType === 'OS') {
      taxRate = 1.0; // Operaciones societarias
    }

    const amountDue = data.propertyValue * (taxRate / 100);

    return {
      ...data,
      taxRate,
      amountDue
    };
  }

  /**
   * Càlcul de Plusvalia Municipal (IIVTNU) comparant mètode objectiu i real.
   */
  public static calculatePlusvalia(data: MunicipalPlusvaliaData): MunicipalPlusvaliaData {
    // 1. Mètode Real
    const realGain = Math.max(0, data.transferPrice - data.acquisitionPrice);
    const proportionLand = 0.5; // Suposem que el valor del sòl és un 50% del total a l'IBI per l'exemple
    const realBase = realGain * proportionLand;

    // 2. Mètode Objectiu (Art. 107 TRLRHL)
    // Utilitzem el coeficient màxim legal que els ajuntaments poden aplicar segons els anys de tinença.
    let coeficientAEAT = 0;
    if (data.yearsOwned < 1) coeficientAEAT = 0.14;
    else if (data.yearsOwned === 1) coeficientAEAT = 0.13;
    else if (data.yearsOwned <= 5) coeficientAEAT = 0.15;
    else if (data.yearsOwned <= 10) coeficientAEAT = 0.10;
    else if (data.yearsOwned <= 15) coeficientAEAT = 0.12;
    else coeficientAEAT = 0.45; // 20 anys o més

    const objectiveBase = data.cadastralLandValue * coeficientAEAT;

    // 3. Comparativa i elecció del més favorable
    const taxableBase = Math.min(realBase, objectiveBase);
    const chosenMethod = realBase < objectiveBase ? 'real' : 'objective';

    // 4. Quota
    // El tipus pot ser establert per l'ajuntament (màxim legal 30%)
    const amountDue = taxableBase * (data.taxRate / 100);

    return {
      ...data,
      objectiveBase,
      realBase,
      chosenMethod,
      taxableBase,
      amountDue
    };
  }
}
