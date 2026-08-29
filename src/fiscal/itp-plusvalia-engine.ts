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
   * Càlcul de Plusvàlua Municipal (IIVTNU - Art. 104 a 110 TRLRHL)
   * Incorpora la Doctrina Constitucional Vinculant STC 182/2021 i Art. 104.5 TRLRHL:
   * Si no hi ha increment real de valor (venda a pèrdues o preu igual), l'operació NO està subjecta a l'IIVTNU (Base = 0 €, Quota = 0 €).
   */
  public static calculatePlusvalia(data: MunicipalPlusvaliaData): MunicipalPlusvaliaData {
    // 1. Principi de No Subjecció per Inexistència d'Increment de Valor (STC 182/2021 i Art. 104.5 TRLRHL)
    const rawGain = data.transferPrice - data.acquisitionPrice;
    if (rawGain <= 0) {
      return {
        ...data,
        objectiveBase: 0,
        realBase: 0,
        chosenMethod: 'real',
        taxableBase: 0,
        amountDue: 0,
      };
    }

    // 2. Mètode Real (Art. 107.5 TRLRHL)
    const proportionLand = 0.5; // Proporció del valor cadastral del sòl sobre el total a l'IBI
    const realBase = Math.round(rawGain * proportionLand * 100) / 100;

    // 3. Mètode Objectiu (Art. 107.1-4 TRLRHL)
    // Coeficients màxims legals de l'Estat segons els anys de generació
    let coeficientAEAT = 0;
    if (data.yearsOwned < 1) coeficientAEAT = 0.14;
    else if (data.yearsOwned === 1) coeficientAEAT = 0.13;
    else if (data.yearsOwned <= 5) coeficientAEAT = 0.15;
    else if (data.yearsOwned <= 10) coeficientAEAT = 0.10;
    else if (data.yearsOwned <= 15) coeficientAEAT = 0.12;
    else coeficientAEAT = 0.45; // 20 anys o més

    const municipalityFactor = data.municipalityCoef || 1.0;
    const objectiveBase = Math.round(data.cadastralLandValue * coeficientAEAT * municipalityFactor * 100) / 100;

    // 4. Comparativa i elecció del mètode més beneficiós per al contribuent
    const taxableBase = Math.min(realBase, objectiveBase);
    const chosenMethod = realBase < objectiveBase ? 'real' : 'objective';

    // 5. Quota tributària (màxim 30%)
    const amountDue = Math.round(taxableBase * (data.taxRate / 100) * 100) / 100;

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
