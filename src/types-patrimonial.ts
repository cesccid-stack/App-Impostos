/**
 * @module types-patrimonial
 * Tipus per a la Tributació Patrimonial: Sucesiones (650), Donaciones (651), ITP/AJD (600), Plusvalía y Grandes Fortunas (718)
 */

export type AutonomousCommunity = 
  | 'AND' | 'ARA' | 'AST' | 'BAL' | 'CAN' | 'CANT' 
  | 'CLM' | 'CYL' | 'CAT' | 'EXT' | 'GAL' | 'MAD' 
  | 'MUR' | 'NAV' | 'PVA' | 'RIO' | 'VAL' | 'CEU' | 'MEL';

export type KinshipGroup = 'I' | 'II' | 'III' | 'IV';

/**
 * Model 650/651: Sucesiones y Donaciones
 */
export interface InheritanceDonationData {
  type: 'inheritance' | 'donation';
  date: string;
  community: AutonomousCommunity;
  
  // Dades de l'adquirent (hereu / donatari)
  kinshipGroup: KinshipGroup;
  preExistingWealth: number;  // Patrimoni preexistent
  disabilityDegree: number;   // Grau de discapacitat
  
  // Cabal relicte / Béns transmesos
  realEstateValue: number;
  financialAssetsValue: number;
  lifeInsuranceValue: number; // Només per successions
  householdFurnishingsValue: number; // Ajuar domèstic (típicament 3%)
  
  // Càrregues i deutes deduïbles
  deductibleDebts: number;
  deductibleExpenses: number; // Despeses de sepeli, darrera malaltia
  
  // Reduccions aplicables
  reductionPrimaryResidence: number; // Habitatge habitual
  reductionFamilyBusiness: number;   // Empresa familiar
  
  // Càlcul de quotes
  taxableBase: number;        // Base imposable
  liquidableBase: number;     // Base liquidable (després de reduccions)
  grossTax: number;           // Quota íntegra
  multiplierBase: number;     // Coeficient multiplicador (patrimoni + parentiu)
  netTax: number;             // Quota tributària
  autonomicBonus: number;     // Bonificació autonòmica
  amountDue: number;          // Quota a ingressar
}

/**
 * Model 600: Impuesto Transmisiones Patrimoniales y Actos Jurídicos Documentados (ITP y AJD)
 */
export interface ITPAndAJDData {
  operationType: 'TPO' | 'AJD' | 'OS'; // Transmisions, Actos Jurídicos, Operaciones Societarias
  date: string;
  community: AutonomousCommunity;
  propertyValue: number;       // Valor de referència o de compravenda (el major)
  isPrimaryResidence: boolean;
  buyerAge: number;
  disabilityDegree: number;
  largeFamily: boolean;        // Família nombrosa
  
  taxRate: number;             // Tipus aplicable (%)
  amountDue: number;           // Quota a ingressar
}

/**
 * Plusvalía Municipal (IIVTNU)
 */
export interface MunicipalPlusvaliaData {
  acquisitionDate: string;
  transferDate: string;
  cadastralLandValue: number;  // Valor cadastral del sòl
  acquisitionPrice: number;    // Preu de compra
  transferPrice: number;       // Preu de venda
  municipalityCoef: number;    // Coeficient de l'ajuntament
  taxRate: number;             // Tipus impositiu (màx 30%)
  
  // Càlculs
  yearsOwned: number;
  objectiveBase: number;       // Mètode objectiu (Sòl * Coef. AEAT * Coef Ajuntament)
  realBase: number;            // Mètode real (Guany patrimonial * % Sòl)
  chosenMethod: 'objective' | 'real';
  taxableBase: number;
  amountDue: number;
}

/**
 * Model 718: Impuesto Temporal de Solidaridad de Grandes Fortunas
 */
export interface WealthSolidarityTaxData {
  year: number;
  netWealth: number;           // Patrimoni net total
  primaryResidenceExemption: number; // Fins a 300.000
  wealthTaxPaid: number;       // Quota pagada a l'IP (Mod 714) a deduir
  
  taxableBase: number;
  grossTax: number;
  limitApplied?: boolean;      // Límit del 60% (IRPF + IP + IGF)
  amountDue: number;
}

/**
 * Estat global dels impostos patrimonials
 */
export interface PatrimonialTaxesData {
  inheritance: InheritanceDonationData[];
  itpAjd: ITPAndAJDData[];
  plusvalia: MunicipalPlusvaliaData[];
  solidarity718?: WealthSolidarityTaxData;
}
