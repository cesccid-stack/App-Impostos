/**
 * @module import/fifo-engine
 * Core logic for FIFO (First In, First Out) matching and capital gains calculation
 * compliant with Spanish LIRPF (Art. 37.1.a & Art. 33.5.f/g).
 */

import type { TradeRecord, FIFOLot, FIFOMatch, AssetSummary } from '../types-portfolio.ts';
import type { GainItem } from '../types.ts';

/**
 * Calculates capital gains using the FIFO method with full homogeneity across brokers.
 * Implements proportional wash-sale anti-application rules (Art. 33.5 LIRPF).
 * 
 * @param trades Array of all trades across all brokers.
 * @returns Matched sales, open positions, and asset summaries per ISIN.
 */
export function calculateFIFO(trades: TradeRecord[]): {
  matches: FIFOMatch[];
  openLots: FIFOLot[];
  summaries: AssetSummary[];
} {
  const openLotsByAsset: Record<string, FIFOLot[]> = {};
  const matches: FIFOMatch[] = [];
  const summariesMap: Record<string, AssetSummary> = {};

  // Sort trades by date ascending (FIFO requirement)
  const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const trade of sortedTrades) {
    // Homogeneity key: ISIN is primary, fallback to Symbol
    const assetId = trade.isin?.trim() || trade.symbol?.trim();

    if (!summariesMap[assetId]) {
      summariesMap[assetId] = {
        isin: trade.isin || '',
        symbol: trade.symbol,
        name: trade.name || trade.symbol,
        assetClass: trade.assetClass || 'shares',
        totalBought: 0,
        totalSold: 0,
        realizedGain: 0,
        suspendedLosses: 0,
        netTaxableGain: 0,
        unrealizedGain: 0,
        openPosition: 0,
        tradesCount: 0,
      };
    }
    const summary = summariesMap[assetId];
    summary.tradesCount++;

    if (trade.type === 'buy') {
      if (!openLotsByAsset[assetId]) {
        openLotsByAsset[assetId] = [];
      }
      openLotsByAsset[assetId].push({
        buyTradeId: trade.id,
        symbol: trade.symbol,
        isin: trade.isin || '',
        remainingQty: trade.quantity,
        priceEUR: trade.totalEUR / trade.quantity, // Price per unit in EUR including buy commission
        date: trade.date,
        broker: trade.broker,
      });
      summary.totalBought += trade.totalEUR;
      summary.openPosition += trade.quantity;
    } else if (trade.type === 'sell') {
      const lots = openLotsByAsset[assetId] || [];
      let remainingToSell = trade.quantity;
      const matchedLotsForThisSale: FIFOMatch['matchedLots'] = [];
      let totalAcquisitionForSale = 0;
      let totalTransferForSale = 0;
      let totalGainForThisSale = 0;

      // Sell price per unit in EUR (net of sell commission)
      const sellPriceEURPerUnit = trade.totalEUR / trade.quantity;

      while (remainingToSell > 0 && lots.length > 0) {
        const currentLot = lots[0];
        const qtyToMatch = Math.min(remainingToSell, currentLot.remainingQty);
        
        const acquisitionValueEUR = qtyToMatch * currentLot.priceEUR;
        const transferValueEUR = qtyToMatch * sellPriceEURPerUnit;
        const gain = transferValueEUR - acquisitionValueEUR;

        matchedLotsForThisSale.push({
          lot: { ...currentLot },
          quantity: qtyToMatch,
          acquisitionValueEUR,
          transferValueEUR,
          gain,
        });

        totalAcquisitionForSale += acquisitionValueEUR;
        totalTransferForSale += transferValueEUR;
        totalGainForThisSale += gain;
        
        remainingToSell -= qtyToMatch;
        currentLot.remainingQty -= qtyToMatch;

        if (currentLot.remainingQty <= 0) {
          lots.shift(); // Free depleted lot
        }
      }

      if (remainingToSell > 0) {
        console.warn(`[FIFO Engine] Posició curta o historial de compra incomplet per a ${assetId}. Qty restant: ${remainingToSell}`);
      }

      // Regla d'antiaplicació de pèrdues (Art. 33.5 LIRPF)
      let antiApplicationApplied = false;
      let repurchasedQuantity = 0;
      let suspendedLossEUR = 0;
      let computedGainLossEUR = totalGainForThisSale;

      if (totalGainForThisSale < 0) {
        const sellDate = new Date(trade.date);
        
        // Determinar finestra temporal: 2 mesos per mercat regulat UE, 1 any per la resta
        const isRegulatedEU = trade.marketType !== 'unregulated_or_foreign';
        const windowMonths = isRegulatedEU ? 2 : 12;

        const windowStart = new Date(sellDate);
        windowStart.setMonth(windowStart.getMonth() - windowMonths);
        const windowEnd = new Date(sellDate);
        windowEnd.setMonth(windowEnd.getMonth() + windowMonths);

        // Sumar compres del mateix valor homogeni (ISIN) en la finestra
        const nearbyBuys = sortedTrades.filter(t => 
          t.type === 'buy' && 
          (t.isin === trade.isin || (!t.isin && t.symbol === trade.symbol)) &&
          new Date(t.date) >= windowStart && 
          new Date(t.date) <= windowEnd &&
          t.id !== trade.id
        );

        repurchasedQuantity = nearbyBuys.reduce((sum, b) => sum + b.quantity, 0);

        if (repurchasedQuantity > 0) {
          antiApplicationApplied = true;
          // Càlcul proporcional: només queda suspesa la pèrdua corresponent als títols recomprats
          const matchedSoldQty = trade.quantity - remainingToSell;
          const suspendedRatio = Math.min(1, repurchasedQuantity / (matchedSoldQty || 1));
          
          suspendedLossEUR = Math.abs(totalGainForThisSale) * suspendedRatio;
          // La pèrdua computable és la part no recomprada (negativa)
          computedGainLossEUR = totalGainForThisSale + suspendedLossEUR;
        }
      }

      // Dies de tinença (basats en el lot més antic casat)
      let holdingDays = 0;
      if (matchedLotsForThisSale.length > 0) {
        const oldestLotDate = new Date(matchedLotsForThisSale[0].lot.date);
        holdingDays = Math.floor((new Date(trade.date).getTime() - oldestLotDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      matches.push({
        sellTrade: trade,
        matchedLots: matchedLotsForThisSale,
        totalAcquisitionEUR: totalAcquisitionForSale,
        totalTransferEUR: totalTransferForSale,
        totalGain: totalGainForThisSale,
        holdingDays,
        antiApplicationRuleApplied: antiApplicationApplied,
        repurchasedQuantity,
        suspendedLossEUR,
        computedGainLossEUR,
      });

      // Actualitzar resum per actiu
      summary.totalSold += totalTransferForSale;
      summary.realizedGain += totalGainForThisSale;
      summary.suspendedLosses += suspendedLossEUR;
      summary.netTaxableGain += computedGainLossEUR;
      summary.openPosition -= (trade.quantity - remainingToSell);
    }
  }

  const openLots: FIFOLot[] = [];
  for (const assetId in openLotsByAsset) {
    openLots.push(...openLotsByAsset[assetId]);
  }

  const summaries = Object.values(summariesMap);

  return { matches, openLots, summaries };
}

/**
 * Converteix els FIFOMatches en GainItems compatibles amb l'aplicació i el model IRPF.
 */
export function matchesToGainItems(matches: FIFOMatch[]): GainItem[] {
  return matches.map(match => {
    let type: GainItem['type'] = 'shares';
    const c = match.sellTrade.assetClass;
    if (c === 'etf' || (c as any) === 'funds') type = 'funds';
    else if (c === 'crypto') type = 'crypto';
    else if (c === 'options' || c === 'futures' || c === 'cfd' || c === 'warrants') type = 'other';

    const acquisitionDate = match.matchedLots.length > 0 ? match.matchedLots[0].lot.date.split('T')[0] : match.sellTrade.date.split('T')[0];
    const isinPart = match.sellTrade.isin ? ` [${match.sellTrade.isin}]` : '';
    const description = `${match.sellTrade.quantity} ${match.sellTrade.symbol}${isinPart} (${match.sellTrade.broker})`;

    return {
      id: `fifo-${match.sellTrade.id}`,
      description,
      type,
      acquisitionDate,
      transferDate: match.sellTrade.date.split('T')[0],
      acquisitionValue: match.totalAcquisitionEUR,
      transferValue: match.totalTransferEUR,
      expenses: 0,
      isNonComputableLoss: match.antiApplicationRuleApplied && match.suspendedLossEUR > 0,
      nonComputableLossAmount: match.suspendedLossEUR,
    };
  });
}
