/**
 * @module types-properties
 * Interfaces for individual rental real estate management, asset inventories, mixed usage and amortization.
 * Conforme amb l'Art. 23 & 85 LIRPF, Taula Simplificada AEAT i la Llei 12/2023 pel Dret a l'Habitatge.
 */

import type { AEATAssetGroupId } from './fiscal/amortization-tables.ts';

/** Motiu de baixa d'un element d'inventari */
export type AssetDisposalReason = 'sale' | 'damaged' | 'replaced' | 'personal_use' | 'other';

/** Element individual de l'inventari o extracontable d'immobilitzat */
export interface PropertyInventoryItem {
  id: string;
  invoiceNumber: string;         // Núm. de factura (ex: "F-2024-0891")
  supplierName: string;          // Nom / Raó social del proveïdor (ex: "Leroy Merlin", "Ikea", "MediaMarkt")
  supplierNif: string;           // NIF/CIF del proveïdor (ex: "A-28824360")
  concept: string;               // Descripció de l'element / línia (ex: "Smart TV 55 polzades", "Bomba de calor", "Parament cuina")
  category: AEATAssetGroupId;    // Categoria segons la taula simplificada AEAT (per coeficient màxim)
  acquisitionDate: string;       // Data d'alta / factura (AAAA-MM-DD)
  amount: number;                // Preu total satisfet (Base + IVA no deduïble) (€)
  amortizationRate: number;      // Coeficient lineal màxim aplicat (%)
  maxYears: number;              // Període màxim en anys
  minYears: number;              // Període mínim d'amortització en anys
  previousAmortization: number;  // Amortització acumulada manual d'exercicis previs (€)
  notes?: string;                // Observacions o ubicació (ex: "Menjador", "Dormitori principal")
  
  // Gestió de baixes (derecognition / disposal)
  status?: 'active' | 'disposed'; // Estat: actiu o donat de baixa
  disposalDate?: string;          // Data de baixa / venda / trencament (AAAA-MM-DD)
  disposalReason?: AssetDisposalReason; // Motiu de la baixa
  disposalValue?: number;         // Valor de venda o recuperació en la baixa (€)
}

/** Obra o millora realitzada a l'immoble (Legacy / Compatibilitat) */
export interface PropertyImprovement {
  id: string;
  description: string;         // Ex: "Reforma bany", "Canvi tancaments d'alumini", "Aerotèrmia"
  completionDate: string;      // Data acabament obra (AAAA-MM-DD)
  amount: number;              // Cost total satisfet de l'obra
  amortizationRate: number;    // Normalment 3% anual
}

/** Mobles, instal·lacions o electrodomèstics cedits amb l'immoble (Legacy / Compatibilitat) */
export interface FurnitureItem {
  id: string;
  description: string;         // Ex: "Nevera", "Rentadora", "Mobiliari menjador"
  acquisitionDate: string;     // Data de compra
  amount: number;              // Preu de compra
  amortizationRate: number;    // Normalment 10% anual (màxim 20 anys)
}

/** Tipus de reducció d'arrendament d'habitatge (Llei 12/2023 / Règim Transitori) */
export type RentalReductionType = 
  | 'none'                      // Sense reducció (lloguer turístic, temporal, local, ús diferent d'habitatge)
  | 'transitional_60'           // 60% Contractes previs a 26/05/2023 (Disposició Transitòria 38a LIRPF)
  | 'general_50'                // 50% Règim general nou contracte d'habitatge habitual
  | 'rehabilitated_60'          // 60% Immoble rehabilitat en els darrers 2 anys
  | 'young_tenant_70'           // 70% Llogaters joves (18-35 anys) en zona de mercat tensionat (Catalunya)
  | 'public_or_social_70'       // 70% Arrendament a l'Administració Pública o entitats sense ànim de lucre / habitatge social
  | 'tensioned_rent_cut_90';    // 90% Nou contracte amb rebaixa >= 5% de renda en zona de mercat tensionat

/** Propietat immobiliària individual en lloguer o ús propi */
export interface RentalProperty {
  id: string;
  name: string;                // Nom identificatiu intern (Ex: "Pis Carrer Aragó")
  cadastralReference: string;  // 20 caràcters (Casella 0061)
  address: string;
  ownershipPercentage: number; // % de titularitat del declarant (Ex: 100 o 50)
  usageType: 'habitual' | 'temporary' | 'tourist' | 'commercial';
  contractDate: string;        // Data formalització contracte
  tenantNIFs: string[];        // NIF/NIE dels llogaters (Casella 0065)
  
  // Ús mixt / Dies a disposició dels propietaris (Art. 85 LIRPF)
  isMixedUsage?: boolean;      // Si s'utilitza una part de l'any com a lloguer i una altra com a ús propi
  rentalDays?: number;         // Dies llogat durant l'any (ex: 60)
  ownUseDays?: number;         // Dies a disposició particular (ex: 305)
  isCadastralRevised?: boolean;// Si el valor cadastral ha estat revisat en els darrers 10 anys (1,1% vs 2%)

  // Ingressos
  grossRentalIncome: number;   // Ingressos totals facturats (Casella 0066)
  otherIncomes: number;        // Altres rendiments / serveis repercutits
  
  // Despeses Limitades (Finançament + Reparació) - Límits Art. 23.1.a LIRPF
  mortgageInterests: number;   // Interessos i despeses financeres (Casella 0069)
  repairExpenses: number;      // Reparació i conservació (Casella 0070)
  pendingRepairsPreviousYears: number; // Despeses pendents de compensar dels 4 exercicis anteriors
  
  // Altres Despeses Deduïbles No Limitades (Art. 23.1.b LIRPF)
  ibi: number;                 // Impost sobre Béns Immobles (Casella 0073)
  wasteTax: number;            // Taxa d'escombraries / brosses (Casella 0073)
  otherTaxes?: number;         // Altres taxes municipals i tributs no estatals (Casella 0073)
  communityFees: number;       // Despeses de comunitat de propietaris (Casella 0074)
  insurance: number;           // Assegurances (llar, RC, impagament lloguer) (Casella 0075)
  managementFees: number;      // Despeses d'administració / agència / jurídica (Casella 0076)
  badDebts: number;            // Saldos de dubtós cobrament > 6 mesos (Casella 0077)
  
  // Càlcul d'Amortització de l'Immoble (Caselles 0079 a 0083)
  totalCadastralValue: number;        // Valor cadastral total
  constructionCadastralValue: number; // Valor cadastral de la construcció (per % sòl/construcció)
  acquisitionCost: number;            // Preu de compra + despeses (ITP, notaria, registre)
  
  // Extracontable d'inventari d'actius i factures (Taula Simplificada AEAT)
  inventory: PropertyInventoryItem[];
  
  // Amortitzacions legacy (compatibilitat)
  improvements: PropertyImprovement[]; // Obres de millora (3%)
  furniture: FurnitureItem[];          // Mobles i estris (10%)
  
  // Reducció aplicable (Llei 12/2023)
  reductionType: RentalReductionType;

  // Dades de contracte i gestió automatitzada
  monthlyRent?: number;               // Renda mensual vigent (€/mes)
  contractStartDate?: string;         // Data d'inici del contracte (AAAA-MM-DD)
  contractEndDate?: string;           // Data de fi del contracte (AAAA-MM-DD)
  depositHeld?: number;               // Fiança dipositada (Incasòl / CCAA) (€)
  lastIpcUpdate?: string;             // Darrera actualització per IPC / IRAV (AAAA-MM-DD)
  appliedIpcRate?: number;            // % d'increment aplicat (ex: 3.0%)
  
  // Desglossament històric d'excedents a 4 anys (Art. 23.1.a LIRPF)
  carryoverHistory?: {
    yearMinus4: number; // Excedent any N-4
    yearMinus3: number; // Excedent any N-3
    yearMinus2: number; // Excedent any N-2
    yearMinus1: number; // Excedent any N-1
  };
}

/** Desglossament de les amortitzacions per grup AEAT */
export interface InventoryAmortizationBreakdown {
  group6Tools30: number;       // Útils i eines (30%)
  group5Computer26: number;    // Equips TI / Domòtica / TV (26%)
  group4Transport16: number;   // Elements de transport (16%)
  group3Machinery12: number;   // Maquinària / Climatització (12%)
  group2Furniture10: number;   // Mobiliari i electrodomèstics (10%)
  group1Improvements3: number; // Obres de millora (3%)
  totalInventoryAmortization: number;
}

/** Mètriques financeres i de rendibilitat immobiliària */
export interface PropertyFinancialMetrics {
  grossYield: number;          // Rendibilitat bruta (%) = (Ingressos anuals / Cost adquisició) * 100
  netYield: number;            // Rendibilitat neta abans d'impostos (%) = ((Ingressos - Despeses corrents - Amortitzacions) / Cost) * 100
  cashFlowAnnual: number;      // Flux de caixa net anual (€) = Ingressos - Despeses corrents - Interessos - Reparacions
  capRate: number;             // Taxa de capitalització real (%)
  afterTaxReturn: number;      // Rendibilitat real després d'IRPF (%)
  estimatedSavingsAEAT: number;// Estalvi fiscal en IRPF gràcies a amortitzacions i reduccions (€)
}

/** Resultat fiscal calculat per a una propietat */
export interface PropertyFiscalResult {
  property: RentalProperty;
  grossIncome: number;
  
  // Despeses limitades
  mortgageInterests: number;
  repairExpenses: number;
  totalLimitedExpenses: number;
  limitedExpensesDeducted: number;       // Màxim igual a grossIncome
  pendingRepairsForFutureYears: number; // Excedent a traslladar (4 anys)
  
  // Despeses corrents i tributs
  taxes: number;
  ibiDeducted: number;                  // IBI deduït prorratejat (Casella 0073)
  wasteTaxDeducted: number;             // Taxa de brosses deduïda (Casella 0073)
  otherTaxesDeducted: number;           // Altres taxes deduïdes (Casella 0073)
  communityFees: number;                // Comunitat de propietaris (Casella 0074)
  insurance: number;                    // Assegurança (llar, RC, impagament) (Casella 0075)
  managementFees: number;               // Administració / agència (Casella 0076)
  badDebts: number;                     // Saldos dubtós cobrament (Casella 0077)
  totalCurrentExpenses: number;
  
  // Amortitzacions
  constructionBase: number;             // Base de càlcul de la construcció
  constructionPercentage: number;       // % construcció segons cadastre
  buildingAmortization: number;         // 3% anual sobre immoble
  improvementsAmortization: number;     // 3% sobre obres de millora
  furnitureAmortization: number;        // Amortització de mobles i estris
  inventoryBreakdown: InventoryAmortizationBreakdown; // Desglossament per grups AEAT
  totalAmortization: number;
  
  // Rendiment
  totalExpenses: number;
  netIncome: number;                    // Rendiment net previ (Casella 0090)
  reductionRate: number;                // 0, 50, 60, 70 o 90%
  reductionAmount: number;              // Casella 0100
  netReducedIncome: number;             // Rendiment net reduït (Casella 0105)

  // Imputació de rendes si és ús mixt (Art. 85 LIRPF)
  imputedIncomeForOwnUse: number;       // Imputació proporcional als dies d'ús propi

  // Retencions practicades pel llogater (Model 115 / Model 180 - Casella 0597)
  withholding19?: number;

  // Mètriques financeres calculades
  metrics?: PropertyFinancialMetrics;
}

