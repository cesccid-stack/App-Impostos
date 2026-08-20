/**
 * @module types-strategy
 * Data types for Strategic Advising (Autónomo vs SL, Pension Rescue Optimization)
 */

export interface AutonomoVsSLData {
  expectedRevenue: number;
  expectedExpenses: number; // Deduïbles
  
  // Variables Autònom
  irpfMarginalRate: number; // o podem calcular-lo estimadament
  autonomoQuota: number;    // Quota anual SS autònoms (ex. 350 * 12 = 4200)
  
  // Variables S.L.
  corporateTaxRate: number; // Generalment 25%, o 15% primeres entitats
  dividendTaxRate: number;  // ~19%-26%
  slMaintenanceCost: number; // Cost extra assessoria S.L.
  societalSalary: number;   // Sou del soci administrador
  
  // Resultats
  netIncomeAutonomo: number;
  totalTaxesAutonomo: number;
  
  netIncomeSL: number; // Incloent sou + dividend
  totalTaxesSL: number;
  
  recommendation: 'autonomo' | 'sl';
  savings: number;
}

export interface PensionRescueData {
  pensionFundValue: number;
  pre2007Contributions: number; // Aportacions anteriors a 31/12/2006 (Dret a reducció 40%)
  yearsSinceRetirement: number; // Pels límits temporals del rescat en forma de capital
  
  otherYearlyIncome: number; // Per calcular el marginal
  
  // Escenaris d'anàlisi
  scenarios: {
    name: string;
    description: string;
    rescueFormat: 'capital' | 'renta' | 'mixto';
    capitalRescueAmount: number;
    yearlyRentaAmount: number;
    taxCost: number;
    netReceivedFirstYear: number;
  }[];
  
  bestScenarioName: string;
}

export interface StrategicAdvisingData {
  autonomoVsSL?: AutonomoVsSLData[];
  pensionRescues?: PensionRescueData[];
}
