/**
 * @module fiscal/social-security-engine
 * Motor fiscal i laboral especialitzat en Seguretat Social (Règim General i RETA).
 * - Càlcul de Cost Total d'Empresa (Cost Laboral) vs Sou Brut vs Sou Net per a treballadors.
 * - Desglossament de cotitzacions (Treballador ~6.47% vs Empresa ~31.40% incloent MEI).
 * - Sistema de Cotització d'Autònoms per Ingressos Reals (RD-Llei 13/2022) amb 15 Trams oficials (2024, 2025, 2026).
 * - Calculador de Regularització Anual de Quotes RETA (pagament o devolució).
 */

export type EmployeeRegimeType = 
  | 'private_indefinite'      // Sector Privat - Indefinit (Atur 1.55% / 5.50%, FOGASA 0.20%)
  | 'private_temporary'       // Sector Privat - Temporal (Atur 1.60% / 6.70%, FOGASA 0.20%)
  | 'public_civil_servant'    // Funcionari Públic - Règim General (Atur 0%, FOGASA 0%)
  | 'public_muface_a1'        // Funcionari Classes Passives / MUFACE (Grup A1)
  | 'public_muface_a2'        // Funcionari Classes Passives / MUFACE (Grup A2)
  | 'public_muface_c1'        // Funcionari Classes Passives / MUFACE (Grup C1)
  | 'public_muface_c2';       // Funcionari Classes Passives / MUFACE (Grup C2)

export interface EmployeeSalaryCostBreakdown {
  grossSalaryAnnual: number;
  grossSalaryMonthly: number;
  contributionBaseMonthly: number;
  regimeType: EmployeeRegimeType;
  isCivilServant: boolean;
  isClassesPassives: boolean;
  
  // Seguretat Social a càrrec del Treballador
  employeeCommonContingencies: number; // 4.70% (0% en Classes Passives)
  employeeUnemployment: number;        // 1.55% / 1.60% (0.00% si és funcionari)
  employeeTraining: number;            // 0.10% (0% en Classes Passives)
  employeeMEI: number;                 // 0.12% - 0.14% (0% en Classes Passives)
  employeePassiveRightsAnnual: number; // Drets Passius (MUFACE)
  employeeMutualismAnnual: number;     // Mutualitat (MUFACE / ISFAS)
  totalEmployeeSSAnnual: number;
  totalEmployeeSSMonthly: number;

  // Retencions IRPF Treballador
  irpfWithholdingRate: number;
  irpfWithholdingAnnual: number;
  irpfWithholdingMonthly: number;

  // Salari Net a la butxaca del treballador
  netSalaryAnnual: number;
  netSalaryMonthly: number;

  // Seguretat Social a càrrec de l'Empresa (Cost Empresa / Administració)
  employerCommonContingencies: number; // 23.60%
  employerUnemployment: number;        // 5.50% / 6.70% (0.00% si és funcionari)
  employerFOGASA: number;              // 0.20% (0.00% si és funcionari)
  employerTraining: number;            // 0.60%
  employerMEI: number;                 // 0.58% - 0.70%
  totalEmployerSSAnnual: number;
  totalEmployerSSMonthly: number;

  // Cost Laboral Total
  totalCompanyCostAnnual: number;
  totalCompanyCostMonthly: number;
  taxWedgePercentage: number; // Pressió fiscal total (Total impostos / Cost empresa)
}

export interface RETATramInfo {
  tramNumber: number;
  minNetIncomeMonthly: number;
  maxNetIncomeMonthly: number;
  minBaseMonthly: number;
  maxBaseMonthly: number;
  minMonthlyQuota: number;
  maxMonthlyQuota: number;
}

export interface RETACalculationResult {
  year: number;
  isSocietario: boolean;
  hasFlatRate: boolean; // Tarifa Plana 80€ / 86€
  flatRateQuotaMonthly: number;
  annualActivityIncome: number;
  annualActivityExpenses: number;
  annualRETAPaid: number;
  genericExpenseDeductionRate: number; // 7% o 3%
  computableNetIncomeAnnual: number;
  computableNetIncomeMonthly: number;
  
  assignedTram: RETATramInfo;
  recommendedBaseMonthly: number;
  recommendedMonthlyQuota: number;
  recommendedAnnualQuota: number;

  // Regularització anual de la Seguretat Social
  regularizationDifferenceAnnual: number; // Positiu = A pagar suplementari, Negatiu = Devolució de la SS
  regularizationStatus: 'balanced' | 'underpaid_must_pay' | 'overpaid_refund_eligible';
}

/** Bases de cotització màximes i mínimes del Règim General */
export const GENERAL_REGIME_LIMITS = {
  minMonthlyBase: 1323.00, // SMI amb prorrateig pagues extres
  maxMonthlyBase: 4720.50, // Base màxima de cotització 2024-2025
};

/** Quotes fixes de Classes Passives i Mutualisme Administratiu (MUFACE / ISFAS / MUGEJU) 2024-2025 */
export const CLASSES_PASSIVES_QUOTAS = {
  public_muface_a1: { passiveRightsMonthly: 124.12, mutualismMonthly: 53.88 },
  public_muface_a2: { passiveRightsMonthly: 97.69, mutualismMonthly: 42.41 },
  public_muface_c1: { passiveRightsMonthly: 75.02, mutualismMonthly: 32.57 },
  public_muface_c2: { passiveRightsMonthly: 59.38, mutualismMonthly: 25.78 },
};

/**
 * Calcula el Cost Total Laboral d'Empresa/Administració i el desglossament de Nòmina Líquida del treballador.
 * Té en compte el règim de funcionaris públics (exempts d'atur i FOGASA) i Classes Passives (MUFACE).
 */
export function calculateEmployeeSalaryCost(
  grossSalaryAnnual: number,
  irpfWithholdingRate: number = 15,
  regimeType: EmployeeRegimeType = 'private_indefinite',
  fiscalYear: number = 2024,
  paymentsCount: 12 | 14 = 12
): EmployeeSalaryCostBreakdown {
  const grossSalaryMonthly = grossSalaryAnnual / paymentsCount;
  
  const isCivilServant = regimeType.startsWith('public_');
  const isClassesPassives = regimeType.startsWith('public_muface_');

  // Base mensual de cotització (amb prorrateig de 12 mensualitats)
  const monthlyBaseUncapped = grossSalaryAnnual / 12;
  const contributionBaseMonthly = Math.min(
    GENERAL_REGIME_LIMITS.maxMonthlyBase,
    Math.max(GENERAL_REGIME_LIMITS.minMonthlyBase, monthlyBaseUncapped)
  );

  // Taxes MEI (Mecanisme d'Equitat Intergeneracional)
  const meiEmployeeRate = fiscalYear >= 2026 ? 0.14 : fiscalYear === 2025 ? 0.13 : 0.12;
  const meiEmployerRate = fiscalYear >= 2026 ? 0.70 : fiscalYear === 2025 ? 0.67 : 0.58;

  let empCC = 0;
  let empUnemp = 0;
  let empTrain = 0;
  let empMEI = 0;
  let empPassiveRightsAnnual = 0;
  let empMutualismAnnual = 0;
  let totalEmployeeSSMonthly = 0;
  let totalEmployeeSSAnnual = 0;

  let emprCC = 0;
  let emprUnemp = 0;
  let emprFOGASA = 0;
  let emprTrain = 0;
  let emprMEI = 0;
  let totalEmployerSSMonthly = 0;
  let totalEmployerSSAnnual = 0;

  if (isClassesPassives) {
    // Funcionari de Classes Passives (MUFACE / ISFAS / MUGEJU)
    const mufaceKey = regimeType as keyof typeof CLASSES_PASSIVES_QUOTAS;
    const quotas = CLASSES_PASSIVES_QUOTAS[mufaceKey] || CLASSES_PASSIVES_QUOTAS.public_muface_a1;
    
    empPassiveRightsAnnual = quotas.passiveRightsMonthly * 12;
    empMutualismAnnual = quotas.mutualismMonthly * 12;
    totalEmployeeSSMonthly = quotas.passiveRightsMonthly + quotas.mutualismMonthly;
    totalEmployeeSSAnnual = empPassiveRightsAnnual + empMutualismAnnual;

    // L'Estat no cotitza per Atur ni FOGASA en Classes Passives; aporta la quota patronal de classes passives i assistència sanitària (~19.5%)
    const stateContributionMonthly = contributionBaseMonthly * (19.50 / 100);
    totalEmployerSSMonthly = stateContributionMonthly;
    totalEmployerSSAnnual = stateContributionMonthly * 12;
    emprCC = totalEmployerSSAnnual;
  } else {
    // Règim General (Sector Privat o Funcionari Règim General)
    // IMPORTANT: Els funcionaris NO cotitzen per ATUR (0.00%) segons l'Art. 264 LGSS
    const unempEmpRate = isCivilServant ? 0.00 : (regimeType === 'private_temporary' ? 1.60 : 1.55);
    const unempEmprRate = isCivilServant ? 0.00 : (regimeType === 'private_temporary' ? 6.70 : 5.50);
    const fogasaEmprRate = isCivilServant ? 0.00 : 0.20;

    empCC = contributionBaseMonthly * (4.70 / 100);
    empUnemp = contributionBaseMonthly * (unempEmpRate / 100);
    empTrain = contributionBaseMonthly * (0.10 / 100);
    empMEI = contributionBaseMonthly * (meiEmployeeRate / 100);

    totalEmployeeSSMonthly = empCC + empUnemp + empTrain + empMEI;
    totalEmployeeSSAnnual = totalEmployeeSSMonthly * 12;

    emprCC = contributionBaseMonthly * (23.60 / 100);
    emprUnemp = contributionBaseMonthly * (unempEmprRate / 100);
    emprFOGASA = contributionBaseMonthly * (fogasaEmprRate / 100);
    emprTrain = contributionBaseMonthly * (0.60 / 100);
    emprMEI = contributionBaseMonthly * (meiEmployerRate / 100);

    totalEmployerSSMonthly = emprCC + emprUnemp + emprFOGASA + emprTrain + emprMEI;
    totalEmployerSSAnnual = totalEmployerSSMonthly * 12;
  }

  // Retencions IRPF
  const irpfWithholdingAnnual = grossSalaryAnnual * (irpfWithholdingRate / 100);
  const irpfWithholdingMonthly = irpfWithholdingAnnual / paymentsCount;

  // Salari Net Líquid
  const netSalaryAnnual = grossSalaryAnnual - totalEmployeeSSAnnual - irpfWithholdingAnnual;
  const netSalaryMonthly = netSalaryAnnual / paymentsCount;

  // Cost Laboral Total
  const totalCompanyCostAnnual = grossSalaryAnnual + totalEmployerSSAnnual;
  const totalCompanyCostMonthly = totalCompanyCostAnnual / paymentsCount;

  // Falca Fiscal (Tax Wedge)
  const totalTaxes = totalEmployerSSAnnual + totalEmployeeSSAnnual + irpfWithholdingAnnual;
  const taxWedgePercentage = totalCompanyCostAnnual > 0 
    ? Math.round((totalTaxes / totalCompanyCostAnnual) * 1000) / 10 
    : 0;

  return {
    grossSalaryAnnual,
    grossSalaryMonthly,
    contributionBaseMonthly,
    regimeType,
    isCivilServant,
    isClassesPassives,
    employeeCommonContingencies: empCC * 12,
    employeeUnemployment: empUnemp * 12,
    employeeTraining: empTrain * 12,
    employeeMEI: empMEI * 12,
    employeePassiveRightsAnnual: empPassiveRightsAnnual,
    employeeMutualismAnnual: empMutualismAnnual,
    totalEmployeeSSAnnual,
    totalEmployeeSSMonthly,
    irpfWithholdingRate,
    irpfWithholdingAnnual,
    irpfWithholdingMonthly,
    netSalaryAnnual,
    netSalaryMonthly,
    employerCommonContingencies: emprCC * 12,
    employerUnemployment: emprUnemp * 12,
    employerFOGASA: emprFOGASA * 12,
    employerTraining: emprTrain * 12,
    employerMEI: emprMEI * 12,
    totalEmployerSSAnnual,
    totalEmployerSSMonthly,
    totalCompanyCostAnnual,
    totalCompanyCostMonthly,
    taxWedgePercentage,
  };
}

/**
 * Taula Oficial dels 15 Trams de Cotització per Ingressos Reals d'Autònoms (RETA 2024-2025).
 * Tipus de cotització global: 31.30%
 */
export const RETA_TABLE_2024_2025: RETATramInfo[] = [
  // Taula Reduïda
  { tramNumber: 1, minNetIncomeMonthly: 0, maxNetIncomeMonthly: 670, minBaseMonthly: 735.29, maxBaseMonthly: 816.98, minMonthlyQuota: 230.15, maxMonthlyQuota: 255.71 },
  { tramNumber: 2, minNetIncomeMonthly: 670.01, maxNetIncomeMonthly: 900, minBaseMonthly: 816.99, maxBaseMonthly: 900.00, minMonthlyQuota: 255.72, maxMonthlyQuota: 281.70 },
  { tramNumber: 3, minNetIncomeMonthly: 900.01, maxNetIncomeMonthly: 1166.70, minBaseMonthly: 872.55, maxBaseMonthly: 1166.70, minMonthlyQuota: 273.11, maxMonthlyQuota: 365.18 },
  // Taula General
  { tramNumber: 4, minNetIncomeMonthly: 1166.71, maxNetIncomeMonthly: 1300, minBaseMonthly: 950.98, maxBaseMonthly: 1300.00, minMonthlyQuota: 297.66, maxMonthlyQuota: 406.90 },
  { tramNumber: 5, minNetIncomeMonthly: 1300.01, maxNetIncomeMonthly: 1500, minBaseMonthly: 960.78, maxBaseMonthly: 1500.00, minMonthlyQuota: 300.72, maxMonthlyQuota: 469.50 },
  { tramNumber: 6, minNetIncomeMonthly: 1500.01, maxNetIncomeMonthly: 1700, minBaseMonthly: 960.78, maxBaseMonthly: 1700.00, minMonthlyQuota: 300.72, maxMonthlyQuota: 532.10 },
  { tramNumber: 7, minNetIncomeMonthly: 1700.01, maxNetIncomeMonthly: 1850, minBaseMonthly: 1045.75, maxBaseMonthly: 1850.00, minMonthlyQuota: 327.32, maxMonthlyQuota: 579.05 },
  { tramNumber: 8, minNetIncomeMonthly: 1850.01, maxNetIncomeMonthly: 2030, minBaseMonthly: 1062.09, maxBaseMonthly: 2030.00, minMonthlyQuota: 332.43, maxMonthlyQuota: 635.39 },
  { tramNumber: 9, minNetIncomeMonthly: 2030.01, maxNetIncomeMonthly: 2330, minBaseMonthly: 1078.43, maxBaseMonthly: 2330.00, minMonthlyQuota: 337.55, maxMonthlyQuota: 729.29 },
  { tramNumber: 10, minNetIncomeMonthly: 2330.01, maxNetIncomeMonthly: 2760, minBaseMonthly: 1111.11, maxBaseMonthly: 2760.00, minMonthlyQuota: 347.78, maxMonthlyQuota: 863.88 },
  { tramNumber: 11, minNetIncomeMonthly: 2760.01, maxNetIncomeMonthly: 3190, minBaseMonthly: 1176.47, maxBaseMonthly: 3190.00, minMonthlyQuota: 368.23, maxMonthlyQuota: 998.47 },
  { tramNumber: 12, minNetIncomeMonthly: 3190.01, maxNetIncomeMonthly: 3620, minBaseMonthly: 1241.83, maxBaseMonthly: 3620.00, minMonthlyQuota: 388.69, maxMonthlyQuota: 1133.06 },
  { tramNumber: 13, minNetIncomeMonthly: 3620.01, maxNetIncomeMonthly: 4050, minBaseMonthly: 1307.19, maxBaseMonthly: 4050.00, minMonthlyQuota: 409.15, maxMonthlyQuota: 1267.65 },
  { tramNumber: 14, minNetIncomeMonthly: 4050.01, maxNetIncomeMonthly: 6000, minBaseMonthly: 1454.25, maxBaseMonthly: 4720.50, minMonthlyQuota: 455.18, maxMonthlyQuota: 1477.52 },
  { tramNumber: 15, minNetIncomeMonthly: 6000.01, maxNetIncomeMonthly: 999999, minBaseMonthly: 1732.03, maxBaseMonthly: 4720.50, minMonthlyQuota: 542.13, maxMonthlyQuota: 1477.52 },
];

/**
 * Calcula la quota de Seguretat Social RETA corresponent als rendiments nets reals de l'activitat econòmica.
 */
export function calculateRETACotization(
  annualIncome: number,
  annualExpenses: number,
  annualRETAPaid: number = 0,
  isSocietario: boolean = false,
  hasFlatRate: boolean = false,
  fiscalYear: number = 2024
): RETACalculationResult {
  const genericDeductionRate = isSocietario ? 0.03 : 0.07;
  
  // Rendiment Net Previ = Ingressos - Despeses (sense incloure la quota RETA)
  // Per a la SS, la quota RETA pagada es reincorpora a la base prèvia abans d'aplicar la deducció del 7%/3%
  const baseBeforeDeduction = Math.max(0, (annualIncome - annualExpenses + annualRETAPaid));
  const computableNetIncomeAnnual = Math.max(0, baseBeforeDeduction * (1 - genericDeductionRate));
  const computableNetIncomeMonthly = computableNetIncomeAnnual / 12;

  // Trobar el tram oficial
  let assignedTram = RETA_TABLE_2024_2025[0];
  for (const t of RETA_TABLE_2024_2025) {
    if (computableNetIncomeMonthly >= t.minNetIncomeMonthly && computableNetIncomeMonthly <= t.maxNetIncomeMonthly) {
      assignedTram = t;
      break;
    }
  }
  if (computableNetIncomeMonthly > 6000) {
    assignedTram = RETA_TABLE_2024_2025[RETA_TABLE_2024_2025.length - 1];
  }

  // Base mínima si és autònom societari (mínim 1.000 € / mes)
  let recommendedBaseMonthly = assignedTram.minBaseMonthly;
  if (isSocietario && recommendedBaseMonthly < 1000) {
    recommendedBaseMonthly = 1000;
  }

  const flatRateQuotaMonthly = fiscalYear >= 2025 ? 86.66 : 80.00;
  
  const recommendedMonthlyQuota = hasFlatRate 
    ? flatRateQuotaMonthly 
    : Math.round(recommendedBaseMonthly * 0.3130 * 100) / 100;

  const recommendedAnnualQuota = recommendedMonthlyQuota * 12;

  // Regularització amb la quota realment pagada durant l'any
  const diff = recommendedAnnualQuota - annualRETAPaid;
  let regularizationStatus: RETACalculationResult['regularizationStatus'] = 'balanced';
  
  if (annualRETAPaid > 0) {
    if (diff > 50) {
      regularizationStatus = 'underpaid_must_pay'; // Has pagat menys del que et tocava pel teu rendiment real -> reclamarà la SS
    } else if (diff < -50) {
      regularizationStatus = 'overpaid_refund_eligible'; // Has pagat més -> la SS et retornarà l'excés
    }
  }

  return {
    year: fiscalYear,
    isSocietario,
    hasFlatRate,
    flatRateQuotaMonthly,
    annualActivityIncome: annualIncome,
    annualActivityExpenses: annualExpenses,
    annualRETAPaid,
    genericExpenseDeductionRate: genericDeductionRate * 100,
    computableNetIncomeAnnual,
    computableNetIncomeMonthly,
    assignedTram,
    recommendedBaseMonthly,
    recommendedMonthlyQuota,
    recommendedAnnualQuota,
    regularizationDifferenceAnnual: diff,
    regularizationStatus,
  };
}
