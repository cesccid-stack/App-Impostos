/**
 * @module types-portfolio
 * TypeScript interfaces for the mass import and FIFO engine with full AEAT compliance.
 */

/** Moviment individual importat */
export interface TradeRecord {
  id: string;
  broker: 'ibkr' | 'degiro' | 'traderepublic' | 'revolut' | 'quantfury' | 'etoro' | 'scalable' | 'myinvestor' | 'binance' | 'coinbase' | 'generic';
  date: string;              // ISO date
  symbol: string;            // Ticker
  isin: string;              // Codi ISIN (Ex: US0378331005)
  name: string;              // Asset name
  type: 'buy' | 'sell';
  assetClass: 'shares' | 'funds' | 'etf' | 'options' | 'futures' | 'cfd' | 'crypto' | 'warrants';
  quantity: number;
  price: number;             // Preu per unitat
  currency: string;          // EUR, USD, GBP...
  exchangeRate: number;      // Tipus de canvi oficial BCE a EUR
  commission: number;        // Comissió en divisa original
  totalEUR: number;          // Import total en EUR (inclou comissions)
  marketType?: 'regulated_eu' | 'unregulated_or_foreign'; // 2 mesos vs 1 any (Art 33.5.f/g)
}

/** Lot FIFO (posició oberta) */
export interface FIFOLot {
  buyTradeId: string;
  symbol: string;
  isin: string;
  remainingQty: number;
  priceEUR: number;          // Preu de compra per unitat en EUR (inclou comissió proporcional)
  date: string;
  broker: string;
}

/** Resultat de matching FIFO per a una venda amb compliment AEAT */
export interface FIFOMatch {
  sellTrade: TradeRecord;
  matchedLots: Array<{
    lot: FIFOLot;
    quantity: number;
    acquisitionValueEUR: number; // Casella 0330 AEAT
    transferValueEUR: number;    // Casella 0328 AEAT
    gain: number;                // Casella 0332 AEAT
  }>;
  totalAcquisitionEUR: number;
  totalTransferEUR: number;
  totalGain: number;
  holdingDays: number;
  
  // Regla d'antiaplicació (Art. 33.5 LIRPF)
  antiApplicationRuleApplied: boolean;
  repurchasedQuantity: number;    // Quantitat recomprada en la finestra
  suspendedLossEUR: number;       // Pèrdua no computable en l'exercici (Casella 0335/0336)
  computedGainLossEUR: number;    // Guany o pèrdua computable efectivament aquest any
}

/** Resum fiscal homogeni per valor / ISIN (Format oficial AEAT Renta Web) */
export interface AssetSummary {
  isin: string;
  symbol: string;
  name: string;
  assetClass: string;
  totalBought: number;
  totalSold: number;
  realizedGain: number;          // Total guanys/pèrdues bruts
  suspendedLosses: number;       // Pèrdues suspeses per regla 2 mesos
  netTaxableGain: number;        // Import computable a la Base de l'Estalvi
  unrealizedGain: number;
  openPosition: number;          // Quantitat restant en cartera
  tradesCount: number;
}
