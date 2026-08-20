/**
 * @module fiscal/wealth-tax-engine
 * Motor de càlcul de l'Impost sobre el Patrimoni (Model 714 - Catalunya) i
 * de l'Impost Temporal de Solidaritat de les Grans Fortunes (ISGF - Model 718 / Art. 31 LIP).
 */

export interface WealthAssetItem {
  id: string;
  category: 'real_estate' | 'bank_accounts' | 'shares_funds' | 'crypto' | 'vehicles_luxury' | 'business_exempt' | 'other';
  description: string;
  grossValue: number;         // Valor fiscal segons regles LIP (€)
  isPrimaryResidence?: boolean; // Habitatge habitual (exempt fins a 300.000 €)
  isBusinessExempt?: boolean;   // Empresa familiar / activitat econòmica exempta
}

export interface WealthDebtItem {
  id: string;
  description: string;
  amount: number;             // Deute deduïble a 31 de desembre (€)
}

export interface WealthTaxData {
  assets: WealthAssetItem[];
  debts: WealthDebtItem[];
  community: string;          // Default: CAT (Catalunya)
}

export interface WealthTaxCalculationResult {
  totalGrossAssets: number;
  totalExemptAssets: number;
  primaryResidenceExemption: number;
  businessExemption: number;
  computableGrossAssets: number;
  
  totalDeductibleDebts: number;
  netWealth: number;          // Patrimoni Net
  
  minimumExempt: number;      // 500.000 € a Catalunya
  taxableBase: number;        // Base liquidable
  
  grossTax: number;           // Quota íntegra de Patrimoni
  
  // Blindatge del límit conjunt Renda-Patrimoni (Art. 31 LIP - Límit 60%)
  jointLimitBase60: number;   // 60% de la base d'IRPF
  totalTaxesBeforeShield: number; // IRPF + Patrimoni
  shieldReductionApplied: number; // Reducció aplicada pel límit del 60%
  netWealthTax: number;       // Quota líquida final d'Impost sobre el Patrimoni
  
  // Impost de Solidaritat de les Grans Fortunes (ISGF Model 718)
  isgfApplicable: boolean;
  isgfNetTax: number;
  
  isObligatedToDeclare: boolean; // Obligació de declarar (>2M€ bruts o quota positiva)
}

/** Trams autonòmics de l'Impost sobre el Patrimoni a Catalunya (Llei 5/2020) */
export const CATALAN_WEALTH_TAX_BRACKETS = [
  { upTo: 167129.45, rate: 0.0021 },
  { upTo: 334252.88, rate: 0.0033 },
  { upTo: 668499.75, rate: 0.0055 },
  { upTo: 1336999.51, rate: 0.0099 },
  { upTo: 2673999.01, rate: 0.0143 },
  { upTo: 5347998.03, rate: 0.0198 },
  { upTo: 10695996.06, rate: 0.0264 },
  { upTo: Infinity, rate: 0.0348 },
];

/** Trams de l'Impost de Solidaritat de les Grans Fortunes (Model 718) */
export const ISGF_TAX_BRACKETS = [
  { upTo: 3000000.00, rate: 0.000 },
  { upTo: 5347998.03, rate: 0.017 },
  { upTo: 10695996.06, rate: 0.021 },
  { upTo: Infinity, rate: 0.035 },
];

export function calculateWealthTax(
  wealthData: WealthTaxData,
  irpfGeneralBase: number = 0,
  irpfSavingsBase: number = 0,
  irpfNetTax: number = 0
): WealthTaxCalculationResult {
  const assets = wealthData.assets || [];
  const debts = wealthData.debts || [];

  let totalGrossAssets = 0;
  let primaryResidenceExemption = 0;
  let businessExemption = 0;

  for (const a of assets) {
    const val = a.grossValue || 0;
    totalGrossAssets += val;

    if (a.isPrimaryResidence) {
      primaryResidenceExemption += Math.min(300000, val);
    } else if (a.isBusinessExempt || a.category === 'business_exempt') {
      businessExemption += val;
    }
  }

  const totalExemptAssets = primaryResidenceExemption + businessExemption;
  const computableGrossAssets = Math.max(0, totalGrossAssets - totalExemptAssets);

  const totalDeductibleDebts = debts.reduce((s, d) => s + (d.amount || 0), 0);
  const netWealth = Math.max(0, computableGrossAssets - totalDeductibleDebts);

  const minimumExempt = 500000; // Catalunya (Art. 21 Llei 5/2020)
  const taxableBase = Math.max(0, netWealth - minimumExempt);

  // Càlcul quota íntegra Patrimoni Catalunya
  let grossTax = 0;
  if (taxableBase > 0) {
    let remaining = taxableBase;
    let prev = 0;
    for (const b of CATALAN_WEALTH_TAX_BRACKETS) {
      const tier = b.upTo - prev;
      const taxable = Math.min(remaining, tier);
      grossTax += taxable * b.rate;
      remaining -= taxable;
      prev = b.upTo;
      if (remaining <= 0) break;
    }
  }

  // Límit Conjunt Renda - Patrimoni (Art. 31 LIP)
  // Quota IRPF + Quota Patrimoni no pot superar el 60% de les bases imposables d'IRPF
  const totalIrpfBase = irpfGeneralBase + irpfSavingsBase;
  const jointLimitBase60 = totalIrpfBase > 0 ? (totalIrpfBase * 0.60) : 0;
  const totalTaxesBeforeShield = irpfNetTax + grossTax;

  let shieldReductionApplied = 0;
  let netWealthTax = grossTax;

  if (totalIrpfBase > 0 && totalTaxesBeforeShield > jointLimitBase60 && grossTax > 0) {
    const excess = totalTaxesBeforeShield - jointLimitBase60;
    const maxReduction = grossTax * 0.80; // La reducció no pot superar el 80% de la quota de patrimoni
    shieldReductionApplied = Math.min(excess, maxReduction);
    netWealthTax = Math.max(grossTax * 0.20, grossTax - shieldReductionApplied);
  }

  // Càlcul ISGF (Model 718) per patrimonis > 3M€
  let isgfNetTax = 0;
  let isgfApplicable = false;
  if (netWealth > 3000000) {
    isgfApplicable = true;
    let isgfGross = 0;
    let rem = netWealth - 3700000; // 3M + 700k mínim exempt estatal
    if (rem > 0) {
      let prev = 0;
      for (const b of ISGF_TAX_BRACKETS) {
        if (b.rate === 0) continue;
        const tier = b.upTo - prev;
        const taxable = Math.min(rem, tier);
        isgfGross += taxable * b.rate;
        rem -= taxable;
        prev = b.upTo;
        if (rem <= 0) break;
      }
    }
    // Descomptem la quota satisfeta a Catalunya per evitar doble imposició
    isgfNetTax = Math.max(0, isgfGross - netWealthTax);
  }

  const isObligatedToDeclare = totalGrossAssets > 2000000 || netWealthTax > 0;

  return {
    totalGrossAssets,
    totalExemptAssets,
    primaryResidenceExemption,
    businessExemption,
    computableGrossAssets,
    totalDeductibleDebts,
    netWealth,
    minimumExempt,
    taxableBase,
    grossTax,
    jointLimitBase60,
    totalTaxesBeforeShield,
    shieldReductionApplied,
    netWealthTax,
    isgfApplicable,
    isgfNetTax,
    isObligatedToDeclare,
  };
}
