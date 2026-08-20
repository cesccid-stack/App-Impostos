/**
 * @module fiscal/tax-loss-harvesting
 * Algorisme d'optimització de Tax-Loss Harvesting (Recol·lecció de pèrdues fiscals).
 * Calcula quines posicions amb pèrdues latents convé tancar abans del 31 de desembre
 * per compensar guanys patrimonials realitzats i minimitzar l'IRPF de l'estalvi a 0€.
 */

import type { GainItem } from '../types.ts';

export interface OpenPosition {
  id: string;
  tickerOrName: string;
  assetType: 'shares' | 'funds' | 'crypto' | 'other';
  currentMarketValue: number;
  totalAcquisitionCost: number;
  unrealizedPnL: number;
  lastPurchaseDate?: string;
}

export interface TaxLossHarvestingPlan {
  totalRealizedNetGains: number;      // Guanys realitzats de l'any (€)
  currentTaxDueEUR: number;           // Impostos actuals a pagar per la base de l'estalvi (€)
  targetLossToHarvestEUR: number;     // Pèrdua necessària a aflorar per arribar a 0€ de guanys (€)
  recommendedSales: {
    positionId: string;
    tickerOrName: string;
    unrealizedLoss: number;
    amountToSellEUR: number;
    washSaleRisk: boolean;
    washSaleWarning?: string;
  }[];
  totalLossHarvestedEUR: number;
  projectedNetGainsAfterHarvest: number;
  projectedTaxSavingsEUR: number;     // Estalvi directe d'impostos (€)
  netRemainingTaxDueEUR: number;
}

/**
 * Calcula l'estratègia òptima de Tax-Loss Harvesting.
 */
export function calculateTaxLossHarvesting(
  realizedItems: GainItem[] = [],
  openPositions: OpenPosition[] = []
): TaxLossHarvestingPlan {
  // 1. Calcular guanys nets ja realitzats durant l'exercici
  const totalRealizedNetGains = Math.max(
    0,
    realizedItems.reduce((sum, item) => {
      const pnl = (item.transferValue || 0) - (item.acquisitionValue || 0) - (item.expenses || 0);
      if (pnl < 0 && item.isNonComputableLoss) return sum; // Salta pèrdues no computables
      return sum + pnl;
    }, 0)
  );

  // 2. Calcular l'impost de l'estalvi que es pagaria actualment
  const currentTaxDueEUR = estimateSavingsTax(totalRealizedNetGains);

  if (totalRealizedNetGains <= 0 || openPositions.length === 0) {
    return {
      totalRealizedNetGains,
      currentTaxDueEUR,
      targetLossToHarvestEUR: 0,
      recommendedSales: [],
      totalLossHarvestedEUR: 0,
      projectedNetGainsAfterHarvest: totalRealizedNetGains,
      projectedTaxSavingsEUR: 0,
      netRemainingTaxDueEUR: currentTaxDueEUR,
    };
  }

  // 3. Filtrar posicions amb pèrdues latents (unrealizedPnL < 0)
  const lossPositions = openPositions
    .filter(p => p.unrealizedPnL < -1)
    .sort((a, b) => a.unrealizedPnL - b.unrealizedPnL); // Més pèrdua primer

  let neededLoss = totalRealizedNetGains;
  let totalLossHarvested = 0;
  const recommendedSales: TaxLossHarvestingPlan['recommendedSales'] = [];

  for (const pos of lossPositions) {
    if (neededLoss <= 0) break;

    const availableLoss = Math.abs(pos.unrealizedPnL);
    const lossToUse = Math.min(availableLoss, neededLoss);
    
    // Validar regla dels 2 mesos (si s'ha comprat fa menys de 2 mesos, alerta de recompra)
    const isRecentPurchase = pos.lastPurchaseDate 
      ? isWithinTwoMonths(pos.lastPurchaseDate) 
      : false;

    recommendedSales.push({
      positionId: pos.id,
      tickerOrName: pos.tickerOrName,
      unrealizedLoss: availableLoss,
      amountToSellEUR: (lossToUse / availableLoss) * pos.currentMarketValue,
      washSaleRisk: isRecentPurchase,
      washSaleWarning: isRecentPurchase 
        ? '⚠️ Atenció: Has comprat títols d\'aquest valor en els darrers 2 mesos. Si el vens ara amb pèrdues, la pèrdua quedarà suspesa segons l\'Art. 33.5.f LIRPF fins que no venguis la totalitat dels títols.'
        : '✅ Compatible AEAT: Sense operacions en els 2 mesos previs.',
    });

    totalLossHarvested += lossToUse;
    neededLoss -= lossToUse;
  }

  const projectedNetGainsAfterHarvest = Math.max(0, totalRealizedNetGains - totalLossHarvested);
  const netRemainingTaxDueEUR = estimateSavingsTax(projectedNetGainsAfterHarvest);
  const projectedTaxSavingsEUR = Math.max(0, currentTaxDueEUR - netRemainingTaxDueEUR);

  return {
    totalRealizedNetGains,
    currentTaxDueEUR,
    targetLossToHarvestEUR: totalRealizedNetGains,
    recommendedSales,
    totalLossHarvestedEUR: totalLossHarvested,
    projectedNetGainsAfterHarvest,
    projectedTaxSavingsEUR,
    netRemainingTaxDueEUR,
  };
}

function estimateSavingsTax(base: number): number {
  if (base <= 0) return 0;
  if (base <= 6000) return base * 0.19;
  if (base <= 50000) return (6000 * 0.19) + ((base - 6000) * 0.21);
  if (base <= 200000) return (6000 * 0.19) + (44000 * 0.21) + ((base - 50000) * 0.23);
  if (base <= 300000) return (6000 * 0.19) + (44000 * 0.21) + (150000 * 0.23) + ((base - 200000) * 0.27);
  return (6000 * 0.19) + (44000 * 0.21) + (150000 * 0.23) + (100000 * 0.27) + ((base - 300000) * 0.28);
}

function isWithinTwoMonths(dateStr: string): boolean {
  const d = new Date(dateStr).getTime();
  const now = new Date().getTime();
  const diffDays = Math.abs((now - d) / (1000 * 60 * 60 * 24));
  return diffDays <= 60;
}
