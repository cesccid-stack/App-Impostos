/**
 * @module types-quarterly
 * Definició de tipus per als models fiscals trimestrals i anuals associats:
 * 130/131 (Pagos fraccionados IRPF)
 * 111/190 (Retencions treball i professionals)
 * 115/180 (Retencions lloguers)
 * 347 (Operacions > 3005.06€)
 */

export type FiscalQuarter = '1T' | '2T' | '3T' | '4T';

/**
 * Model 130: Pagament fraccionat de l'IRPF (Estimació Directa)
 * S'acumula durant l'any.
 */
export interface Model130Quarterly {
  quarter: FiscalQuarter;
  year: number;
  
  // Rendiments activitats econòmiques (des de 1 gener fins fi trimestre)
  incomeTotal: number;          // Ingressos acumulats
  expensesTotal: number;        // Despeses acumulades
  netYield: number;             // Rendiment net (income - expenses)
  
  // Càlcul del pagament
  taxRate: number;              // 20% per defecte
  grossTax: number;             // Quota bruta (20% del netYield)
  
  // Deduccions i minoracions
  withholdingsPrevious: number; // Retencions suportades des de 1 de gener
  fractionalPaymentsPrevious: number; // Pagaments fraccionats anteriors (ex: 1T per al càlcul del 2T)
  minoracion: number;           // Art. 80 bis (si escau per baix rendiment)
  deductionHomeLoan: number;    // Deducció per adquisició habitatge habitual (2%)
  
  netTax: number;               // Resultat declaració (a pagar o negatiu)
  
  status: 'draft' | 'filed';
}

/**
 * Model 111: Retencions i ingressos a compte (Treball i Professionals)
 */
export interface Model111Quarterly {
  quarter: FiscalQuarter;
  year: number;
  
  // Rendiments del treball
  workRecipientsCount: number;  // Número de perceptors
  workBaseTotal: number;        // Import de les percepcions (Base)
  workWithholdings: number;     // Retencions a ingressar
  
  // Rendiments d'activitats econòmiques (Professionals)
  profRecipientsCount: number;
  profBaseTotal: number;
  profWithholdings: number;     // 15% o 7%
  
  totalToPay: number;           // Resultat a ingressar
  status: 'draft' | 'filed';
}

/**
 * Model 115: Retencions procedents d'arrendament d'immobles urbans
 */
export interface Model115Quarterly {
  quarter: FiscalQuarter;
  year: number;
  
  recipientsCount: number;      // Número de perceptors (arrendadors)
  baseTotal: number;            // Base de les retencions
  withholdingsTotal: number;    // Retencions a ingressar (ex. 19%)
  
  totalToPay: number;           // Resultat a ingressar
  status: 'draft' | 'filed';
}

/**
 * Model 347: Operacions amb terceres persones (> 3005.06€)
 */
export interface Model347Entity {
  nif: string;
  name: string;
  type: 'client' | 'supplier';
  provinceCode: string;
  
  // Imports trimestrals
  q1Amount: number;
  q2Amount: number;
  q3Amount: number;
  q4Amount: number;
  
  totalAmount: number;          // Ha de ser > 3005.06 per incloure's
}

export interface Model347Yearly {
  year: number;
  entities: Model347Entity[];
  totalClientsVolume: number;
  totalSuppliersVolume: number;
}

/**
 * Estat global dels models trimestrals
 */
export interface QuarterlyTaxesData {
  mod130: Model130Quarterly[];
  mod111: Model111Quarterly[];
  mod115: Model115Quarterly[];
  mod347?: Model347Yearly;
}
