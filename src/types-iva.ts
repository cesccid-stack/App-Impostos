/**
 * @module types-iva
 * Definició exhaustiva de tipus TypeScript per a la Gestió Integral de l'IVA (Llei 37/1992 i Ordre HAC/773/2019).
 * Suporta autoliquidacions trimestrals (Model 303), resum anual (Model 390), operacions intracomunitàries (Model 349),
 * llibres registre oficials de factures emeses/rebudes, béns d'inversió, prorrata general i especial,
 * i vinculació bidireccional amb Activitats Econòmiques (IRPF) i Gestió Patrimonial (Immobles i Patrimoni).
 */

/** Tipus de tipus impositius d'IVA vigents a Espanya */
export type IVARate = 21 | 10 | 4 | 2 | 0;

/** Tipus de recàrrec d'equivalència */
export type RecargoEquivalenciaRate = 5.2 | 1.4 | 0.5 | 0;

/** Tipus de retenció IRPF aplicables en factures */
export type WithholdingRate = 19 | 15 | 7 | 1 | 0;

/** Trimestres fiscals */
export type FiscalQuarter = '1T' | '2T' | '3T' | '4T';

/** Categoria d'operació de factura emesa */
export type IssuedInvoiceCategory = 
  | 'activity_service'          // Prestació de serveis d'activitat professional
  | 'activity_goods'            // Venda de béns o mercaderies
  | 'property_commercial_rental'// Arrendament de local comercial / oficina / nau (IVA 21% + Retenció 19%)
  | 'property_tourist_rental'   // Lloguer turístic amb serveis hotelers (IVA 10%)
  | 'property_exempt_rental'    // Lloguer d'habitatge habitual (Exempt Art. 20.Uno.23è LIVA)
  | 'asset_disposal'            // Venda / baixa de bé d'inversió o patrimonial
  | 'intra_eu_delivery'         // Lliurament intracomunitari exempt (Model 349)
  | 'exportation'               // Exportació fora de la UE
  | 'other_exempt'              // Altres operacions exemptes amb dret a deducció o sense
  | 'other';

/** Categoria de despesa de factura rebuda */
export type ReceivedInvoiceCategory = 
  | 'activity_expense'          // Despesa corrent de l'activitat econòmica
  | 'activity_supplies'         // Subministraments (llum, internet, telèfon)
  | 'property_expense'          // Despesa / reparació d'immoble arrendat
  | 'investment_asset'          // Compra de bé d'inversió (amortitzable > 3.005,06 €)
  | 'intra_eu_acquisition'      // Adquisició intracomunitària de béns o serveis (ISP)
  | 'importation'               // Importació (DUA)
  | 'professional_services'     // Serveis de gestoria, assessoria, advocats
  | 'vehicle_expense'           // Despesa de vehicle (afectació 50% Art. 95 LIVA)
  | 'other';

/** Factura emesa / expedida */
export interface IVAInvoiceIssued {
  id: string;
  quarter: FiscalQuarter;
  invoiceNumber: string;         // Ex: "2024/001" o "FAC-2024-12"
  series?: string;               // Ex: "A", "B", "R" per rectificatives
  date: string;                  // AAAA-MM-DD
  clientName: string;            // Nom o Raó Social del client/llogater
  clientNif: string;             // NIF / CIF / NIE del client
  concept: string;               // Descripció de l'operació
  taxableBase: number;           // Base Imposable (€)
  vatRate: IVARate;              // Tipus d'IVA (%)
  vatAmount: number;             // Quota d'IVA Repercutit (€)
  recargoRate?: RecargoEquivalenciaRate; // Recàrrec d'equivalència si escau
  recargoAmount?: number;        // Quota del recàrrec d'equivalència (€)
  withholdingRate?: WithholdingRate; // Retenció IRPF (%)
  withholdingAmount?: number;    // Quota retinguda (€)
  totalInvoice: number;          // Import total de la factura (€)
  category: IssuedInvoiceCategory;
  paymentMethod?: 'transfer' | 'direct_debit' | 'card' | 'cash' | 'check'; // Mètode de cobrament
  isRectification?: boolean;     // Factura rectificativa (Art. 15 Reglament Facturació)
  originalInvoiceNumber?: string;// Factura rectificada de referència
  linkedEntityId?: string;       // ID d'activitat, ID d'immoble (properties.id) o bé d'inversió
  notes?: string;
  // Metadades del document original adjunt (PDF / Imatge)
  hasAttachment?: boolean;
  attachmentFileName?: string;
  attachmentStandardizedName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  attachmentUploadedAt?: string;
}

/** Factura rebuda / despesa */
export interface IVAInvoiceReceived {
  id: string;
  quarter: FiscalQuarter;
  invoiceNumber: string;         // Número de factura del proveïdor
  date: string;                  // AAAA-MM-DD
  supplierName: string;          // Nom o Raó Social del proveïdor
  supplierNif: string;           // NIF / CIF del proveïdor
  concept: string;               // Descripció del bé o servei
  taxableBase: number;           // Base Imposable (€)
  vatRate: IVARate;              // Tipus d'IVA suportat (%)
  vatAmount: number;             // Quota d'IVA suportat (€)
  deductiblePercentage: number;  // % de deduïbilitat (100%, 50% vehicles, 0% no deduïble)
  deductibleVatAmount: number;   // Quota d'IVA deduïble (€)
  withholdingRate?: WithholdingRate; // Retenció IRPF practicada al proveïdor (%)
  withholdingAmount?: number;    // Quota retinguda (€)
  totalInvoice: number;          // Total factura satisfet (€)
  category: ReceivedInvoiceCategory;
  paymentMethod?: 'transfer' | 'direct_debit' | 'card' | 'cash' | 'check'; // Mètode de pagament
  isInvestmentAsset?: boolean;   // Si és bé d'inversió (> 3.005,06 €)
  linkedEntityId?: string;       // ID d'immoble o activitat
  notes?: string;
  // Metadades del document original adjunt (PDF / Imatge)
  hasAttachment?: boolean;
  attachmentFileName?: string;
  attachmentStandardizedName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  attachmentUploadedAt?: string;
}

/** Element del Llibre de Béns d'Inversió (Art. 107-110 LIVA) */
export interface IVABienInversion {
  id: string;
  description: string;           // Ex: "Furgoneta repartiment", "Equip informàtic", "Local comercial C/ Aragó"
  assetType: 'furniture' | 'machinery' | 'computer' | 'real_estate' | 'other';
  acquisitionDate: string;       // Data d'adquisició (AAAA-MM-DD)
  startDate: string;             // Data d'inici d'utilització efectiva
  taxableBase: number;           // Base imposable (€)
  vatRate: IVARate;              // Tipus d'IVA (%)
  totalVatPaid: number;          // IVA total suportat (€)
  initialDeductionPercentage: number; // % de deducció de l'any d'adquisició (prorrata inicial)
  initialDeductedVat: number;    // IVA efectivament deduït a l'alta (€)
  regularizationYears: 5 | 10;   // 5 anys per mobles/equips, 10 anys per immobles
  regularizations: Array<{
    year: number;
    prorrataApplied: number;     // Prorrata de l'any de regularització (%)
    regularizationAmount: number;// Import a regularitzar (+ a favor contribuent, - a retornar)
  }>;
  status: 'active' | 'disposed';
  disposalDate?: string;
  disposalValue?: number;
  linkedPropertyId?: string;     // ID de RentalProperty si és immoble
}

/** Configuració de Prorrata de l'IVA */
export interface IVAProrrataConfig {
  type: 'general' | 'special';
  provisionalPercentage: number; // % provisional aplicable durant els trimestres 1T-3T
  definitivePercentage: number;  // % definitiu calculat al tancament del 4T
  isRegulatedAutomatically: boolean; // Auto-calcular segons facturació
  totalOperationsWithDeduction: number; // Ingressos amb dret a deducció (€)
  totalOperationsVolume: number;        // Volum total d'operacions (inclosos lloguers exempts) (€)
}

/** Desglossament de caselles del Model 303 per a un trimestre */
export interface Model303QuarterResult {
  quarter: FiscalQuarter;
  year: number;

  // ── IVA Devengat (Règim General) ──
  base21: number;         // Casella 01
  cuota21: number;        // Casella 03
  base10: number;         // Casella 04
  cuota10: number;        // Casella 06
  base4: number;          // Casella 07
  cuota4: number;         // Casella 09
  base0: number;          // Casella 150 (tipus 0%/2%/5% transitoris)
  cuota0: number;         // Casella 152

  // Modificació de bases i quotes
  modBase: number;        // Casella 14
  modCuota: number;       // Casella 15

  // Recàrrec d'equivalència
  recargoBases: number;   // Caselles 16, 19, 22
  recargoCuotas: number;  // Caselles 18, 21, 24

  // Adquisicions intracomunitàries i ISP
  intraEuBase: number;    // Casella 10
  intraEuCuota: number;   // Casella 11
  ispBase: number;        // Casella 12 (Inversió del subjecte passiu)
  ispCuota: number;       // Casella 13

  totalDevengado: number; // Casella 27: Total quota devengada (€)

  // ── IVA Deduïble ──
  deducibleCorrienteBase: number;  // Casella 28: Base operacions interiors corrents
  deducibleCorrienteCuota: number; // Casella 29: Quota operacions interiors corrents
  deducibleInversionBase: number;  // Casella 30: Base béns d'inversió
  deducibleInversionCuota: number; // Casella 31: Quota béns d'inversió
  deducibleImportacionesBase: number; // Casella 32
  deducibleImportacionesCuota: number;// Casella 33
  deducibleIntraEuBase: number;    // Casella 36
  deducibleIntraEuCuota: number;   // Casella 37
  rectificacionDeducciones: number;// Casella 40/41

  // Regularitzacions (habitualment 4T)
  regularizacionBienesInversion: number; // Casella 43
  regularizacionProrrata: number;        // Casella 44

  totalDeducible: number; // Casella 45: Total a deduir (€)

  // ── Resultat de la Liquidació ──
  diferencia: number;     // Casella 46: Devengado - Deducible (€)
  porcentajeAtribuibleEstado: number; // Casella 64 (normalment 100%)
  tributacionEstado: number;          // Casella 65
  cuotasCompensarPeriodosAnteriores: number; // Casella 110/78: Saldos a compensar aplicats (€)
  resultadoLiquidacion: number;       // Casella 69/71: Resultat ordinari (€)

  // ── Autoliquidació Complementària del Model 303 (Caselles 70 / 71) ──
  isComplementary?: boolean;
  complementaryReason?: 'higher_income' | 'lower_deduction' | 'rectification' | 'other';
  previousReceiptNumber?: string;       // Núm. de justificant de l'autoliquidació anterior (13 dígits)
  previousResultIngressat?: number;     // Casella 70: Ingrés anterior o devolució practicada (€)
  resultadoComplementaria?: number;     // Casella 71: Resultat efectiu a ingressar d'aquesta complementària (€)
  surchargeExtemporaneous?: number;     // Recàrrec Art. 27 LGT si és fora de termini (€)
  extemporaneousRate?: number;          // % de recàrrec aplicat (1% per mes o 15%)
  extemporaneousMonths?: number;        // Mesos de retard

  // Estat del trimestre
  status: 'draft' | 'closed' | 'filed';
  paymentType: 'ingressar' | 'compensar' | 'tornar' | 'zero';
}

/** Auditoria comparativa entre Prorrata General i Especial (Art. 103 LIVA) */
export interface ProrrataComparisonAudit {
  generalDeductionAmount: number;
  specialDeductionAmount: number;
  differenceAmount: number;
  divergencePercentage: number; // ((General - Especial) / Especial) * 100
  isSpecialProrrataMandatoryByLaw: boolean; // True si > 10% per mandat de l'Art. 103.Dos.1r LIVA
  recommendedRegime: 'general' | 'special';
  warningMessage?: string;
}

/** Resum Anual del Model 390 */
export interface Model390AnnualSummary {
  year: number;
  totalDevengado: number;
  totalDeducible: number;
  totalVolumeOperations: number;
  totalGeneralRegimeBase: number;
  totalExemptWithRight: number;
  totalExemptWithoutRight: number; // Ex: lloguer d'habitatge
  totalIntraEuDeliveries: number;
  totalExports: number;
  definitiveProrrata: number;
  totalAnnualResult: number;
  accumulatedPendingCarryover: number;
  prorrataComparison?: ProrrataComparisonAudit;
  quartersReconciliation: {
    sumOfQuarterDevengado: number;
    sumOfQuarterDeducible: number;
    isBalanced: boolean;
    discrepancyAmount: number;
  };
}

/** Resum d'operació intracomunitària per al Model 349 */
export interface Model349Entry {
  operatorNif: string;
  operatorName: string;
  countryCode: string;
  key: 'E' | 'A' | 'T' | 'S' | 'I' | 'M'; // E = lliurament béns, A = adquisició béns, S = prestació serveis, I = adquisició serveis
  taxableBase: number;
}

/** Estat d'integració de l'IVA amb altres mòduls */
export interface IVAIntegrationSummary {
  activityIncomeSynced: number;
  activityExpensesSynced: number;
  propertyRentalsSynced: number;
  investmentAssetsSynced: number;
  pendingRefundOrPayment: number;
  lastSyncTimestamp?: string;
}

/** Estructura arrel de l'IVA emmagatzemada a DeclaracionData */
export interface IVAData {
  config: {
    regime: 'general' | 'simplified' | 'criterio_caja';
    settlementFrequency: 'quarterly' | 'monthly';
    isREDEME: boolean;           // Registre de Devolució Mensual
    hasProrrata: boolean;
    prorrata: IVAProrrataConfig;
    initialPendingCarryover: number; // Saldo a compensar pendent de l'any anterior (€)
  };
  issuedInvoices: IVAInvoiceIssued[];
  receivedInvoices: IVAInvoiceReceived[];
  investmentAssets: IVABienInversion[];
  quarters: {
    '1T': Model303QuarterResult;
    '2T': Model303QuarterResult;
    '3T': Model303QuarterResult;
    '4T': Model303QuarterResult;
  };
}
