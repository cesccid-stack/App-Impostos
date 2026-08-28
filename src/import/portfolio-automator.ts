/**
 * @module import/portfolio-automator
 * Hub universal d'automatització de carteres d'accions, bròkers i guanys patrimonials:
 * - Auto-detecció de format de bròker (DEGIRO, IBKR, Trade Republic, Revolut, eToro, Scalable, Binance, Coinbase, etc.).
 * - Extracció automàtica de dividends cobrats i retenció en origen (W-8BEN / Casella 0588).
 * - Sincronització en 1 sol clic entre extractes de bròker -> Motor FIFO -> Caselles Renta Web (0328-0336).
 * - Extracció de posicions obertes reals i simulador interactiu de Tax-Loss Harvesting.
 * - Presets de carteres reals per a simulació i proves.
 */

import { store } from '../store.ts';
import { calculateFIFO, matchesToGainItems } from './fifo-engine.ts';
import { parseDegiro } from './parser-degiro.ts';
import { parseGeneric } from './parser-generic.ts';
import type { TradeRecord } from '../types-portfolio.ts';
import type { OpenPosition } from '../fiscal/tax-loss-harvesting.ts';

export type DetectedBrokerType = 
  | 'degiro' 
  | 'ibkr' 
  | 'traderepublic' 
  | 'revolut' 
  | 'etoro' 
  | 'scalable' 
  | 'myinvestor' 
  | 'binance' 
  | 'coinbase' 
  | 'generic';

export interface DividendExtractionResult {
  totalGrossForeignDividends: number;
  totalForeignWithholdingTax: number;
  totalSpanishDividends: number;
  totalSpanishWithholdingTax: number;
  extractedRecordsCount: number;
  details: {
    date: string;
    symbol: string;
    grossEUR: number;
    withholdingEUR: number;
    country: string;
  }[];
}

/**
 * Detecta automàticament el format del bròker analitzant les capçaleres i estructura del fitxer CSV.
 */
export function detectBrokerFormat(csvText: string): { broker: DetectedBrokerType; confidence: number; label: string } {
  const sample = csvText.substring(0, 3000).toLowerCase();

  if (sample.includes('degiro') || (sample.includes('isin') && sample.includes('hora') && sample.includes('producte')) || (sample.includes('producto') && sample.includes('isin') && sample.includes('bolsa'))) {
    return { broker: 'degiro', confidence: 98, label: 'DEGIRO (Transactions.csv)' };
  }
  if (sample.includes('interactive brokers') || sample.includes('flex query') || (sample.includes('trades,header') && sample.includes('datagroup')) || sample.includes('symbol,dateTime,quantity,tradePrice')) {
    return { broker: 'ibkr', confidence: 95, label: 'Interactive Brokers (IBKR Flex Query)' };
  }
  if (sample.includes('trade republic') || (sample.includes('isin') && sample.includes('anzahl') && sample.includes('betrag')) || (sample.includes('kauf') && sample.includes('isin'))) {
    return { broker: 'traderepublic', confidence: 92, label: 'Trade Republic (CSV)' };
  }
  if (sample.includes('revolut') || (sample.includes('ticker') && sample.includes('type') && sample.includes('price per share'))) {
    return { broker: 'revolut', confidence: 90, label: 'Revolut Trading (CSV)' };
  }
  if (sample.includes('etoro') || (sample.includes('position id') && sample.includes('action') && sample.includes('amount'))) {
    return { broker: 'etoro', confidence: 90, label: 'eToro (Account Statement)' };
  }
  if (sample.includes('scalable') || sample.includes('wertpapier')) {
    return { broker: 'scalable', confidence: 85, label: 'Scalable Capital (CSV)' };
  }
  if (sample.includes('binance') || (sample.includes('utc_time') && sample.includes('operation') && sample.includes('coin'))) {
    return { broker: 'binance', confidence: 90, label: 'Binance (Trade History)' };
  }
  if (sample.includes('coinbase') || (sample.includes('transaction type') && sample.includes('quantity transacted'))) {
    return { broker: 'coinbase', confidence: 90, label: 'Coinbase (Report CSV)' };
  }
  if (sample.includes('myinvestor')) {
    return { broker: 'myinvestor', confidence: 85, label: 'MyInvestor (CSV)' };
  }

  return { broker: 'generic', confidence: 60, label: 'Format Universal Intel·ligent (Auto-detectat)' };
}

/**
 * Processa qualsevol fitxer CSV de qualsevol bròker de forma totalment autònoma.
 */
export async function autoParseBrokerCSV(csvText: string, forcedBroker?: DetectedBrokerType): Promise<{
  trades: TradeRecord[];
  detectedBroker: { broker: DetectedBrokerType; label: string; confidence: number };
  dividends: DividendExtractionResult;
}> {
  const detected = forcedBroker 
    ? { broker: forcedBroker, confidence: 100, label: forcedBroker.toUpperCase() }
    : detectBrokerFormat(csvText);

  let trades: TradeRecord[] = [];

  if (detected.broker === 'degiro') {
    try {
      trades = await parseDegiro(csvText);
    } catch {
      trades = await parseGeneric(csvText, undefined, 'degiro');
    }
  } else {
    trades = await parseGeneric(csvText, undefined, detected.broker);
  }

  // Extreure dividends si existeixen al fitxer
  const dividends = extractDividendsFromCSV(csvText);

  return {
    trades,
    detectedBroker: detected,
    dividends,
  };
}

/**
 * Extreu informació de dividends i retencions en origen (ex: tractat W-8BEN als EUA)
 */
export function extractDividendsFromCSV(csvText: string): DividendExtractionResult {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  const result: DividendExtractionResult = {
    totalGrossForeignDividends: 0,
    totalForeignWithholdingTax: 0,
    totalSpanishDividends: 0,
    totalSpanishWithholdingTax: 0,
    extractedRecordsCount: 0,
    details: [],
  };

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('dividend') || lower.includes('div.') || lower.includes('retenció') || lower.includes('withholding')) {
      // Extreure possibles imports
      const amounts = line.match(/\d+[\.,]\d{2}/g);
      if (amounts && amounts.length >= 1) {
        const gross = parseFloat(amounts[0].replace(',', '.'));
        if (!isNaN(gross) && gross > 0) {
          const isUS = line.toUpperCase().includes('US') || line.includes('USD') || line.includes('$');
          const withholding = amounts.length > 1 ? parseFloat(amounts[1].replace(',', '.')) : (isUS ? gross * 0.15 : gross * 0.19);
          
          if (isUS) {
            result.totalGrossForeignDividends += gross;
            result.totalForeignWithholdingTax += withholding;
          } else {
            result.totalSpanishDividends += gross;
            result.totalSpanishWithholdingTax += withholding;
          }

          result.details.push({
            date: new Date().toISOString().split('T')[0],
            symbol: extractSymbolFromDividendLine(line),
            grossEUR: gross,
            withholdingEUR: withholding,
            country: isUS ? 'EUA (W-8BEN 15%)' : 'Espanya',
          });
          result.extractedRecordsCount++;
        }
      }
    }
  }

  return result;
}

function extractSymbolFromDividendLine(line: string): string {
  const isinMatch = line.match(/\b([A-Z]{2}[A-Z0-9]{9}\d)\b/);
  if (isinMatch) return isinMatch[1];
  const tickerMatch = line.match(/\b([A-Z]{1,5})\b/);
  return tickerMatch ? tickerMatch[1] : 'Dividend';
}

/**
 * Sincronitza de forma 100% autònoma les operacions importades amb el magatzem reactiu de la Renda:
 * - Executa el càlcul FIFO.
 * - Converteix les transmissions en ítems oficials de Guanys Patrimonials (Caselles 0328-0336).
 * - Sincronitza dividends i retencions a la secció de Capital Mobiliari (Casella 0588).
 */
export function syncTradesToStore(
  trades: TradeRecord[],
  dividends?: DividendExtractionResult,
  options: { append?: boolean } = {}
): {
  itemsCreated: number;
  totalRealizedGain: number;
  totalSuspendedLosses: number;
  netTaxableGain: number;
  dividendsAddedEUR: number;
  foreignTaxCreditAddedEUR: number;
} {
  const fifoResult = calculateFIFO(trades);
  const newGainItems = matchesToGainItems(fifoResult.matches);

  const currentGains = store.getData().gains || { items: [], totalWithholdings: 0 };
  const finalItems = options.append 
    ? [...currentGains.items, ...newGainItems]
    : newGainItems;

  store.update('gains', {
    items: finalItems,
  });

  let dividendsAdded = 0;
  let foreignTaxAdded = 0;

  if (dividends && (dividends.totalGrossForeignDividends > 0 || dividends.totalSpanishDividends > 0)) {
    const currentCapital = store.getData().capitalIncome || {
      interests: 0,
      dividends: 0,
      foreignDividends: 0,
      foreignTaxWithheld: 0,
      insuranceGains: 0,
      otherMobiliary: 0,
      mobiliaryWithholdings: 0,
      rentalIncome: 0,
      rentalExpenses: 0,
      imputedIncome: 0,
      realEstateWithholdings: 0,
    };

    dividendsAdded = dividends.totalGrossForeignDividends;
    foreignTaxAdded = dividends.totalForeignWithholdingTax;

    store.update('capitalIncome', {
      dividends: (currentCapital.dividends || 0) + dividends.totalSpanishDividends,
      foreignDividends: (currentCapital.foreignDividends || 0) + dividends.totalGrossForeignDividends,
      foreignTaxWithheld: (currentCapital.foreignTaxWithheld || 0) + dividends.totalForeignWithholdingTax,
      mobiliaryWithholdings: (currentCapital.mobiliaryWithholdings || 0) + dividends.totalSpanishWithholdingTax,
    });
  }

  const totalRealizedGain = fifoResult.matches.reduce((s, m) => s + m.totalGain, 0);
  const totalSuspendedLosses = fifoResult.matches.reduce((s, m) => s + m.suspendedLossEUR, 0);
  const netTaxableGain = fifoResult.matches.reduce((s, m) => s + m.computedGainLossEUR, 0);

  return {
    itemsCreated: newGainItems.length,
    totalRealizedGain,
    totalSuspendedLosses,
    netTaxableGain,
    dividendsAddedEUR: dividendsAdded,
    foreignTaxCreditAddedEUR: foreignTaxAdded,
  };
}

/**
 * Converteix els lots oberts resultants de FIFO en posicions obertes interactives amb càlcul de PnL latent
 * per al simulador de Tax-Loss Harvesting.
 */
export function extractLiveOpenPositions(
  trades: TradeRecord[],
  priceMultipliers: Record<string, number> = {} // Permet simular canvis de preu
): OpenPosition[] {
  const fifoResult = calculateFIFO(trades);
  const positionsMap: Record<string, OpenPosition> = {};

  for (const lot of fifoResult.openLots) {
    if (lot.remainingQty <= 0) continue;
    const key = lot.isin || lot.symbol;
    const mult = priceMultipliers[key] !== undefined ? priceMultipliers[key] : 0.85; // Per defecte estimació
    const estimatedUnitCurrentPrice = lot.priceEUR * mult;

    if (!positionsMap[key]) {
      positionsMap[key] = {
        id: `pos-${key}`,
        tickerOrName: `${lot.symbol}${lot.isin ? ` (${lot.isin})` : ''}`,
        assetType: 'shares',
        totalAcquisitionCost: 0,
        currentMarketValue: 0,
        unrealizedPnL: 0,
        lastPurchaseDate: lot.date,
      };
    }

    const pos = positionsMap[key];
    const lotCost = lot.remainingQty * lot.priceEUR;
    const lotCurrentValue = lot.remainingQty * estimatedUnitCurrentPrice;

    pos.totalAcquisitionCost += lotCost;
    pos.currentMarketValue += lotCurrentValue;
    pos.unrealizedPnL += (lotCurrentValue - lotCost);

    if (new Date(lot.date).getTime() > new Date(pos.lastPurchaseDate || '2000-01-01').getTime()) {
      pos.lastPurchaseDate = lot.date;
    }
  }

  return Object.values(positionsMap);
}

/**
 * Presets de carteres reals per a proves i demostracions instantànies.
 */
export function getStockPortfolioPresets(): {
  name: string;
  description: string;
  broker: string;
  trades: TradeRecord[];
}[] {
  return [
    {
      name: '🇺🇸 Cartera Tech & Growth (Interactive Brokers - FIFO Multi-Lot)',
      description: 'Operacions sobre Nvidia (NVDA), Apple (AAPL), Microsoft (MSFT) i Tesla (TSLA) amb múltiples compres i vendes parcials.',
      broker: 'ibkr',
      trades: [
        { id: 't-1', broker: 'ibkr', date: '2023-01-15', symbol: 'NVDA', isin: 'US67066G1040', name: 'NVIDIA Corp', type: 'buy', assetClass: 'shares', quantity: 50, price: 180, currency: 'USD', exchangeRate: 1.08, commission: 2, totalEUR: 8335 },
        { id: 't-2', broker: 'ibkr', date: '2023-06-20', symbol: 'NVDA', isin: 'US67066G1040', name: 'NVIDIA Corp', type: 'buy', assetClass: 'shares', quantity: 30, price: 420, currency: 'USD', exchangeRate: 1.09, commission: 2, totalEUR: 11562 },
        { id: 't-3', broker: 'ibkr', date: '2024-03-10', symbol: 'NVDA', isin: 'US67066G1040', name: 'NVIDIA Corp', type: 'sell', assetClass: 'shares', quantity: 60, price: 880, currency: 'USD', exchangeRate: 1.09, commission: 3, totalEUR: 48437 }, // Venda amb gran guany FIFO
        { id: 't-4', broker: 'ibkr', date: '2023-04-10', symbol: 'TSLA', isin: 'US88160R1014', name: 'Tesla Inc', type: 'buy', assetClass: 'shares', quantity: 40, price: 240, currency: 'USD', exchangeRate: 1.08, commission: 2, totalEUR: 8890 },
        { id: 't-5', broker: 'ibkr', date: '2024-04-15', symbol: 'TSLA', isin: 'US88160R1014', name: 'Tesla Inc', type: 'sell', assetClass: 'shares', quantity: 40, price: 170, currency: 'USD', exchangeRate: 1.07, commission: 2, totalEUR: 6353 }, // Pèrdua per compensar
        { id: 't-6', broker: 'ibkr', date: '2023-09-01', symbol: 'AAPL', isin: 'US0378331005', name: 'Apple Inc', type: 'buy', assetClass: 'shares', quantity: 25, price: 175, currency: 'USD', exchangeRate: 1.08, commission: 1.5, totalEUR: 4052 },
        { id: 't-7', broker: 'ibkr', date: '2024-08-01', symbol: 'AAPL', isin: 'US0378331005', name: 'Apple Inc', type: 'sell', assetClass: 'shares', quantity: 25, price: 218, currency: 'USD', exchangeRate: 1.08, commission: 1.5, totalEUR: 5045 },
      ],
    },
    {
      name: '🇪🇺 Cartera Dividend Aristocrats & W-8BEN (DEGIRO)',
      description: 'Iberdrola, ASML Holding, Realty Income (O) amb retenció en origen als EUA (15%) i guanys de capital moderats.',
      broker: 'degiro',
      trades: [
        { id: 'd-1', broker: 'degiro', date: '2023-02-10', symbol: 'IBE', isin: 'ES0144580Y14', name: 'Iberdrola SA', type: 'buy', assetClass: 'shares', quantity: 400, price: 10.80, currency: 'EUR', exchangeRate: 1, commission: 1, totalEUR: 4321 },
        { id: 'd-2', broker: 'degiro', date: '2024-05-15', symbol: 'IBE', isin: 'ES0144580Y14', name: 'Iberdrola SA', type: 'sell', assetClass: 'shares', quantity: 200, price: 12.20, currency: 'EUR', exchangeRate: 1, commission: 1, totalEUR: 2439 },
        { id: 'd-3', broker: 'degiro', date: '2023-05-12', symbol: 'ASML', isin: 'NL0010273215', name: 'ASML Holding NV', type: 'buy', assetClass: 'shares', quantity: 10, price: 620, currency: 'EUR', exchangeRate: 1, commission: 2, totalEUR: 6202 },
        { id: 'd-4', broker: 'degiro', date: '2024-06-18', symbol: 'ASML', isin: 'NL0010273215', name: 'ASML Holding NV', type: 'sell', assetClass: 'shares', quantity: 10, price: 950, currency: 'EUR', exchangeRate: 1, commission: 2, totalEUR: 9498 },
        { id: 'd-5', broker: 'degiro', date: '2023-08-01', symbol: 'O', isin: 'US7561091049', name: 'Realty Income Corp', type: 'buy', assetClass: 'shares', quantity: 60, price: 58, currency: 'USD', exchangeRate: 1.09, commission: 1, totalEUR: 3193 },
      ],
    },
    {
      name: '⚠️ Swing Trading amb Regla dels 2 Mesos (Art. 33.5 LIRPF)',
      description: 'Exemple clau per comprovar la suspensió automàtica de pèrdues patrimonials en recomprar el mateix valor en menys de 2 mesos.',
      broker: 'traderepublic',
      trades: [
        { id: 'w-1', broker: 'traderepublic', date: '2024-01-10', symbol: 'SAN', isin: 'ES0113900J37', name: 'Banco Santander SA', type: 'buy', assetClass: 'shares', quantity: 1000, price: 3.80, currency: 'EUR', exchangeRate: 1, commission: 1, totalEUR: 3801 },
        { id: 'w-2', broker: 'traderepublic', date: '2024-03-01', symbol: 'SAN', isin: 'ES0113900J37', name: 'Banco Santander SA', type: 'sell', assetClass: 'shares', quantity: 1000, price: 3.30, currency: 'EUR', exchangeRate: 1, commission: 1, totalEUR: 3299 }, // Pèrdua de 502 €
        { id: 'w-3', broker: 'traderepublic', date: '2024-03-20', symbol: 'SAN', isin: 'ES0113900J37', name: 'Banco Santander SA', type: 'buy', assetClass: 'shares', quantity: 600, price: 3.40, currency: 'EUR', exchangeRate: 1, commission: 1, totalEUR: 2041 }, // Recompra de 600 títols en <2 mesos -> 60% pèrdua suspesa!
      ],
    },
    {
      name: '₿ Cartera Cripto & ETFs Indexats',
      description: 'Bitcoin (BTC), Ethereum (ETH) i ETF MSCI World amb guanys i posicions obertes.',
      broker: 'generic',
      trades: [
        { id: 'c-1', broker: 'generic', date: '2023-03-15', symbol: 'BTC', isin: 'CRYPTO-BTC', name: 'Bitcoin', type: 'buy', assetClass: 'crypto', quantity: 0.5, price: 24000, currency: 'EUR', exchangeRate: 1, commission: 10, totalEUR: 12010 },
        { id: 'c-2', broker: 'generic', date: '2024-04-10', symbol: 'BTC', isin: 'CRYPTO-BTC', name: 'Bitcoin', type: 'sell', assetClass: 'crypto', quantity: 0.3, price: 62000, currency: 'EUR', exchangeRate: 1, commission: 15, totalEUR: 18585 },
        { id: 'c-3', broker: 'generic', date: '2023-05-20', symbol: 'ETH', isin: 'CRYPTO-ETH', name: 'Ethereum', type: 'buy', assetClass: 'crypto', quantity: 3.0, price: 1800, currency: 'EUR', exchangeRate: 1, commission: 5, totalEUR: 5405 },
        { id: 'c-4', broker: 'generic', date: '2023-01-20', symbol: 'IWDA', isin: 'IE00B4L5Y983', name: 'iShares Core MSCI World', type: 'buy', assetClass: 'etf', quantity: 100, price: 72.50, currency: 'EUR', exchangeRate: 1, commission: 2, totalEUR: 7252 },
      ],
    },
  ];
}
