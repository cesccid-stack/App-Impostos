/**
 * @module types
 * Core TypeScript interfaces for the Declaració de la Renda application.
 */

import type { RentalProperty } from './types-properties.ts';
import type { IVAData } from './types-iva.ts';
import type { WealthTaxData } from './fiscal/wealth-tax-engine.ts';
import type { ForeignAssetsData } from './fiscal/model720-engine.ts';
import type { QuarterlyTaxesData } from './types-quarterly.ts';
import type { PatrimonialTaxesData } from './types-patrimonial.ts';
import type { StrategicAdvisingData } from './types-strategy.ts';
import type { CryptoData } from './types-crypto.ts';
import type { IngestionBatch } from './types-ocr.ts';
import type { ComplianceData } from './types-compliance.ts';

/** Tipus de contribuent / perfil fiscal */
export type UserType =
  | 'employee'          // Assalariat / Compte d'altri
  | 'freelance'         // Autònom / Professional independent
  | 'investor'          // Inversor Financer / Trader / Cripto
  | 'landlord'          // Propietari / Arrendador Immobiliari
  | 'retiree'           // Jubilat / Pensionista
  | 'corporate_partner' // Soci / Administrador de Societats
  | 'beckham'           // Impatriat / Llei Beckham
  | 'family_member'     // Cònjuge / Familiar dependent
  | 'advisor_client';   // Client d'assessoria fiscal

/** Estat de la tramitació de la declaració */
export type ProfileStatus = 'draft' | 'in_review' | 'ready' | 'filed';

/** Perfil d'usuari / declarant (Multi-declarant amb eines modulars a la carta) */
export interface UserProfile {
  id: string;
  name: string;
  type?: UserType; // Opcional per compatibilitat històrica
  relation: 'main' | 'spouse' | 'child' | 'parent' | 'client' | 'other';
  nif?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  community?: string;
  status?: ProfileStatus;
  notes?: string;
  avatarColor?: string;
  avatarIcon?: string;
  tags?: string[];
  iban?: string;
  activityIAE?: string;
  enabledModules?: string[]; // IDs dels mòduls/eines activats per a aquest declarant
  createdAt?: string;
  updatedAt?: string;
}

/** Pèrdua pendent de compensar d'exercicis anteriors */
export interface PriorLossItem {
  year: number;   // Ex: 2020, 2021, 2022, 2023
  amount: number; // Import pendent (€)
}

/** Motius oficials de Declaració Complementària o Rectificativa d'IRPF (Caselles 0120 - 0127 AEAT) */
export type IRPFComplementaryReason = 
  | 'arrears_work'        // Atrasos de rendiments del treball meritats en anys previs (Art. 14.2.b LIRPF)
  | 'loss_deductions'     // Pèrdua del dret a deduccions aplicades en anys anteriors (Art. 14.2.d LIRPF)
  | 'change_residence'    // Pèrdua de la condició de contribuent per canvi de residència (Art. 14.3 LIRPF)
  | 'other_higher_tax'    // Altres motius (Ingrés superior o menor devolució a l'anterior)
  | 'rectification';      // Autoliquidació Rectificativa (Sol·licitud d'ingrés indegut o major devolució)

export interface ComplementaryIRPFData {
  isComplementary: boolean;
  reason: IRPFComplementaryReason;
  previousReceiptNumber: string; // Núm. de justificant de la declaració anterior (13 caràcters)
  previousResult: number;        // Import ingressat (+) o tornat (-) en la declaració anterior (€)
  monthsLate?: number;           // Mesos de retard respecte al termini voluntari (per recàrrecs Art. 27 LGT)
  hasTaxOfficeNotice?: boolean;  // Si hi ha requeriment previ de l'AEAT
  notes?: string;
}

/** Fiscal year data – top-level container */
export interface DeclaracionData {
  readonly year: number;
  profileId?: string;
  personal: PersonalData;
  workIncome: WorkIncomeData;
  capitalIncome: CapitalIncomeData;
  properties: RentalProperty[];
  activities: ActivitiesData;
  gains: GainsData;
  deductions: DeductionsData;
  lossCarryovers?: LossCarryoversData; // Bossa de pèrdues pendents de 4 anys
  complementary?: ComplementaryIRPFData; // Declaració Complementària / Rectificativa d'IRPF
  wealth?: WealthTaxData; // Dades de l'Impost sobre el Patrimoni (Model 714)
  foreignAssets?: ForeignAssetsData; // Dades de béns i cripto a l'estranger (Models 720/721)
  iva?: IVAData; // Dades de gestió integral de l'IVA (Models 303/390/349)
  quarterlyTaxes?: QuarterlyTaxesData; // Obligacions periòdiques (Mod. 130, 111, 115, 347)
  patrimonialTaxes?: PatrimonialTaxesData; // Sucesiones, Donaciones, ITP, Plusvalia, 718
  strategicAdvising?: StrategicAdvisingData; // Simulacions estratègiques
  crypto?: CryptoData; // DeFi, Mod 721
  ocrBatches?: IngestionBatch[]; // Llots de processament intel·ligent
  compliance?: ComplianceData; // VeriFactu, Llibres oficials AEAT
}

/** Bossa de pèrdues pendents de compensar dels 4 exercicis anteriors */
export interface LossCarryoversData {
  pendingGeneralLosses: PriorLossItem[];   // Caselles 0420 a 0427
  pendingMobiliaryLosses: PriorLossItem[]; // Caselles 0440 a 0447
  pendingCapitalLosses: PriorLossItem[];   // Caselles 0450 a 0457
}

/** Personal & family situation */
export interface PersonalData {
  name?: string;
  nif?: string;
  age: number;
  disability: number; // 0–100 %
  descendants: Descendant[];
  ascendants: Ascendant[];
  community: string; // Autonomous community code (CAT per defecte)
  autonomousCommunity?: string; // Codi normalitzat CCAA (madrid, catalunya, andalucia, etc.)
  fiscalYear?: number;
  taxDeclarationType?: 'individual' | 'joint' | 'single_parent'; // Tipus de tributació
}

export interface Descendant {
  id: string;
  age: number;
  disability: number;
}

export interface Ascendant {
  id: string;
  age: number;
  disability: number;
}

export interface EmployerItem {
  id: string;
  name: string;
  grossSalary: number;
  inKind: number; // Retribució en espècie
  withholdings: number; // Retencions IRPF practicades
  socialSecurity: number; // Quota treballador

  // Dietes i quilometratge (a la nòmina però amb exempcions)
  dietsIncome: number;
  dietsDays: number;
  mileageIncome: number;
  mileageKm: number;
}

/** Rendiments del treball */
export interface WorkIncomeData {
  employers: EmployerItem[];
  unionFees: number;
  otherDeductible: number;
  pensionContributions: number; // Aportacions a plans de pensions

  // Exempció per treballs a l'estranger (Art. 7.p LIRPF - Màx. 60.100 €)
  foreignWorkExemption7p?: number;

  // Rendiments irregulars o generats en més de 2 anys (Art. 18.2 LIRPF - Reducció 30%)
  irregularIncomeAmount?: number;

  // Indemnitzacions per acomiadament laboral (Art. 7.e LIRPF - Exempció màx. 180.000 €)
  severancePay?: number;
}

/** Rendiments del capital */
export interface CapitalIncomeData {
  /** Mobiliari nacional */
  interests: number;
  dividends: number;
  insuranceGains: number;
  otherMobiliary: number;
  mobiliaryWithholdings: number;

  /** Dividends i rendiments internacionals (Doble Imposició - Casella 0588) */
  foreignDividends: number;
  foreignTaxWithheld: number; // Retenció en origen (ex: 15% US W-8BEN)

  /** Immobiliari */
  rentalIncome: number;
  rentalExpenses: number;
  rentalIBI?: number;               // IBI (Casella 0073)
  rentalWasteTax?: number;          // Taxa d'escombraries / brosses (Casella 0073)
  rentalOtherTaxes?: number;        // Altres taxes municipals (Casella 0073)
  rentalInsurance?: number;         // Assegurances (llar, RC, impagament) (Casella 0075)
  rentalCommunityFees?: number;     // Comunitat de propietaris (Casella 0074)
  rentalMortgageInterests?: number; // Interessos finançament (Casella 0069)
  rentalRepairs?: number;           // Reparació i conservació (Casella 0070)
  rentalAmortization?: number;      // Amortització immoble + mobles (Casella 0081)
  imputedIncome: number;            // Imputació de rendes immobiliàries
  realEstateWithholdings: number;
}

/** Activitats econòmiques (autònoms) */
export interface ActivitiesData {
  income: number;
  expenses: number;
  withholdings: number;
  socialSecuritySelfEmployed: number;
  estimationType: 'direct_simplified' | 'direct_normal';
  iae?: string; // Codi d'epígraf IAE (ex: 763, 511, 722)
}

/** Guanys i pèrdues patrimonials */
export interface GainsData {
  items: GainItem[];
  totalWithholdings: number;
}

export interface GainItem {
  id: string;
  description: string;
  type: 'shares' | 'funds' | 'real_estate' | 'crypto' | 'other';
  acquisitionDate: string;
  transferDate: string;
  acquisitionValue: number; // Casella 0330 AEAT
  transferValue: number;    // Casella 0328 AEAT
  expenses: number;         // Despeses deduïbles
  isNonComputableLoss?: boolean; // Regla antiaplicació (2 mesos / 1 any)
  nonComputableLossAmount?: number; // Import exacte de la pèrdua suspesa (Casella 0335/0336 AEAT)

  // Exempcions tributàries
  isPrimaryResidenceExemptOver65?: boolean; // Exempció habitatge habitual > 65 anys (Art. 33.4.b)
  isPrimaryResidenceReinvestment?: boolean; // Exempció per reinversió en nou habitatge (Art. 38.1)
  reinvestmentAmount?: number;              // Import efectivament reinvertit en 2 anys (€)
  isLifeAnnuityExemptOver65?: boolean;     // Exempció reinversió en renda vitalícia > 65 anys (Art. 38.3)
  lifeAnnuityAmount?: number;              // Import reinvertit en renda vitalícia (màx 240.000 €)
}

/** Deduccions */
export interface DeductionsData {
  /** Habitatge habitual (règim transitori pre-2013) */
  housingDeduction: boolean;
  housingAmountsPaid: number;

  /** Donatius */
  donations: DonationItem[];

  /** Maternitat */
  maternityDeduction: boolean;
  maternityMonths: number; // Mesos amb dret (màx 12)
  maternityNurseryExpenses: number; // Despeses de guarderia autoritzada (màx 1.000€)

  /** Plans de pensions */
  pensionPlanContributions: number;
  companyPensionContributions?: number; // Aportacions de l'empresa (fins a 8.500€ addicionals)

  /** Eficiència energètica en habitatge (RD-Llei 19/2021) */
  energyEfficiencyType?: 'none' | 'heating_cooling_20' | 'primary_energy_40' | 'building_rehab_60';
  energyEfficiencyAmount?: number;

  /** Altres deduccions autonòmiques */
  otherDeductions: number;
  
  /** Deduccions autonòmiques Catalunya */
  catalanRentalDeduction: boolean;
  catalanRentalAmount: number;
  catalanRentalSituation: 'under32' | 'unemployed' | 'disabled65' | 'widow65' | 'large_family' | 'single_parent' | 'none';
  catalanBirthAdoption: number; // nombre de fills nascuts/adoptats
  catalanStartupInvestment: number;
  catalanStartupIsResearchOrUniversity?: boolean; // Spin-off universitària (50% fins a 12.000€)
  catalanWidowhood?: boolean; // Viduïtat (150€ / 300€ amb dependents)
  catalanWidowhoodWithDependents?: boolean;
  catalanAgaurMasterLoanInterests?: number; // Interessos préstecs màster/doctorat AGAUR (100%)
  catalanLanguageDonations?: number; // Donacions al foment de la llengua catalana / aranesa (15%)
  catalanBiomedicalDonations?: number; // Donacions a entitats de recerca biomèdica i universitats (25% / 30%)
  catalanHomeRehabilitation?: number; // Rehabilitació habitatge habitual (1,5%)
}

export interface DonationItem {
  id: string;
  entity: string;
  amount: number;
  recurring: boolean; // Donació recurrent (≥3 anys mateixa entitat)
  priority: boolean; // Entitat prioritària (Llei 49/2002)
}

/** Resultat del càlcul fiscal */
export interface FiscalResult {
  /** Bases imposables */
  generalBase: number;
  savingsBase: number;

  /** Reduccions */
  workIncomeReduction: number;
  irregularWorkReduction?: number; // Reducció 30% Art. 18.2
  foreignWorkExemptionApplied?: number; // Exempció 7.p
  pensionReduction: number;
  jointTaxationReduction?: number; // Reducció per tributació conjunta (3.400€ o 2.150€)
  totalReductions: number;

  /** Bases liquidables */
  liquidableGeneralBase: number;
  liquidableSavingsBase: number;

  /** Mínims */
  personalMinimum: number;
  descendantsMinimum: number;
  ascendantsMinimum: number;
  totalMinimum: number;

  /** Quotes estatals */
  stateGeneralTax: number;
  stateSavingsTax: number;
  stateMinimumTaxCredit: number;

  /** Quotes autonòmiques */
  autonomicGeneralTax: number;
  autonomicSavingsTax: number;
  autonomicMinimumTaxCredit: number;

  /** Quotes totals */
  generalTax: number;
  savingsTax: number;
  minimumTaxCredit: number;
  grossTax: number;

  /** Compensacions de pèrdues de l'estalvi i bossa 4 anys */
  netMobiliaryBalance?: number;
  netGainsBalance?: number;
  crossCompensationAmount?: number; // Compensació creuada 25% (Art. 49)
  priorLossesCompensated?: number;  // Pèrdues d'exercicis anteriors compensades aquest any

  /** Deduccions */
  housingDeductionAmount: number;
  donationsDeductionAmount: number;
  maternityDeductionAmount: number;
  catalanDeductionsAmount: number;
  energyEfficiencyDeductionAmount?: number;
  foreignTaxCredit?: number; // Deducció per doble imposició internacional (Casella 0588)
  totalDeductions: number;

  /** Final */
  netTax: number;
  totalWithholdings: number;
  result: number; // Positiu = a pagar, negatiu = a tornar

  /** Declaració Complementària o Rectificativa (Model 100) */
  isComplementary?: boolean;
  complementaryReason?: IRPFComplementaryReason;
  previousReceiptNumber?: string;
  previousResult?: number;
  differentialResult?: number;       // Diferència respecte a la declaració anterior (€)
  surchargeExtemporaneous?: number;  // Recàrrec Art. 27 LGT (€)
  finalAmountDue?: number;           // Import final efectiu a ingressar o sol·licitar (€)
}

/** Navigation route */
export interface Route {
  path: string;
  label: string;
  icon: string;
  section?: string;
  render: () => HTMLElement | Promise<HTMLElement>;
}

/** Tema visual de l'aplicació */
export type AppTheme = 'dark' | 'light' | 'emerald' | 'nord';

/** Store event */
export type StoreListener = () => void;

