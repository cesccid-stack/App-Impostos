/**
 * @module import/parser-generic
 * Parser universal intel·ligent per a qualsevol broker, exchange o aplicació de trading
 * (Interactive Brokers, Degiro, Trade Republic, Revolut, eToro, Binance, Coinbase, etc.).
 */

import { parseCSV, parseNumber } from './csv-utils.ts';
import type { TradeRecord } from '../types-portfolio.ts';
import { convertToEUR } from './currency-service.ts';

export interface ColumnMapping {
  dateIdx: number;
  symbolIdx: number;
  isinIdx?: number;
  typeIdx: number;
  qtyIdx: number;
  priceIdx: number;
  totalEURIdx?: number;
  currencyIdx?: number;
  commissionIdx?: number;
  buyKeyword: string;
  sellKeyword: string;
}

/**
 * Detecta automàticament les columnes del CSV segons les capçaleres en Català, Castellà i Anglès.
 */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const norm = headers.map(h => h.trim().toLowerCase().replace(/['"_]/g, ' '));

  const findCol = (keywords: string[]): number => {
    return norm.findIndex(h => keywords.some(k => h.includes(k)));
  };

  const dateIdx = Math.max(0, findCol(['data', 'fecha', 'date', 'time', 'timestamp', 'executed']));
  const isinIdx = findCol(['isin', 'codi isin', 'identificador']);
  const symbolIdx = Math.max(0, findCol(['symbol', 'ticker', 'simbolo', 'titol', 'producto', 'product', 'asset', 'instrument', 'name', 'nombre', 'actiu']));
  const typeIdx = Math.max(0, findCol(['type', 'tipo', 'tipus', 'action', 'side', 'operation', 'operacion']));
  const qtyIdx = Math.max(0, findCol(['quantity', 'qty', 'cantidad', 'quantitat', 'units', 'titulos', 'unidades', 'shares', 'amount', 'volumen']));
  const priceIdx = Math.max(0, findCol(['price', 'preu', 'precio', 'kurs', 'trade price', 'prezzo', 'rate']));
  const totalEURIdx = findCol(['total', 'importe', 'import', 'value', 'valor', 'net amount', 'proceeds', 'gesamtwert']);
  const currencyIdx = findCol(['currency', 'divisa', 'moneda', 'curr']);
  const commissionIdx = findCol(['commission', 'comision', 'comissio', 'fee', 'gebühr', 'tasas']);

  return {
    dateIdx: dateIdx >= 0 ? dateIdx : 0,
    symbolIdx: symbolIdx >= 0 ? symbolIdx : 1,
    isinIdx: isinIdx >= 0 ? isinIdx : undefined,
    typeIdx: typeIdx >= 0 ? typeIdx : 2,
    qtyIdx: qtyIdx >= 0 ? qtyIdx : 3,
    priceIdx: priceIdx >= 0 ? priceIdx : 4,
    totalEURIdx: totalEURIdx >= 0 ? totalEURIdx : undefined,
    currencyIdx: currencyIdx >= 0 ? currencyIdx : undefined,
    commissionIdx: commissionIdx >= 0 ? commissionIdx : undefined,
    buyKeyword: 'buy',
    sellKeyword: 'sell',
  };
}

/**
 * Parser universal multiformat.
 */
export async function parseGeneric(
  csv: string,
  customMapping?: ColumnMapping,
  broker: TradeRecord['broker'] = 'generic'
): Promise<TradeRecord[]> {
  if (!csv || csv.trim().length === 0) return [];

  // Detectar delimitador automàticament (, ; \t)
  let delimiter = ',';
  if (csv.includes(';') && (csv.split(';').length > csv.split(',').length)) {
    delimiter = ';';
  } else if (csv.includes('\t') && (csv.split('\t').length > csv.split(',').length)) {
    delimiter = '\t';
  }

  const lines = parseCSV(csv, delimiter);
  if (lines.length < 2) return [];

  const headers = lines[0];
  const mapping = customMapping || autoDetectMapping(headers);

  const trades: TradeRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (!row || row.length < 3) continue;

    const dateStr = row[mapping.dateIdx]?.trim();
    if (!dateStr) continue;

    // Normalització de formats de dates (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, ISO amb hora)
    let isoDate = normalizeDate(dateStr);

    // Tipus d'operació (Compra / Venda)
    const typeStr = row[mapping.typeIdx]?.trim().toLowerCase() || '';
    let type: 'buy' | 'sell' | null = null;

    if (
      typeStr.includes('buy') ||
      typeStr.includes('compra') ||
      typeStr.includes('kauf') ||
      typeStr.includes('achat') ||
      typeStr.includes('bot') ||
      typeStr === 'b'
    ) {
      type = 'buy';
    } else if (
      typeStr.includes('sell') ||
      typeStr.includes('venta') ||
      typeStr.includes('verkauf') ||
      typeStr.includes('vente') ||
      typeStr.includes('sld') ||
      typeStr === 's'
    ) {
      type = 'sell';
    }

    const rawQty = row[mapping.qtyIdx] || '';
    const qty = Math.abs(parseNumber(rawQty));

    // Si el tipus no està definit textualment, intentar deduir pel signe de la quantitat
    if (!type && rawQty) {
      if (rawQty.includes('-')) type = 'sell';
      else type = 'buy';
    }

    if (!type || qty === 0) continue;

    const price = Math.abs(parseNumber(row[mapping.priceIdx] || '0'));
    let totalEUR = qty * price;

    if (mapping.totalEURIdx !== undefined && row[mapping.totalEURIdx]) {
      const parsedTotal = Math.abs(parseNumber(row[mapping.totalEURIdx]));
      if (parsedTotal > 0) totalEUR = parsedTotal;
    }

    let commission = 0;
    if (mapping.commissionIdx !== undefined && row[mapping.commissionIdx]) {
      commission = Math.abs(parseNumber(row[mapping.commissionIdx]));
    }

    let currency = 'EUR';
    if (mapping.currencyIdx !== undefined && row[mapping.currencyIdx]) {
      currency = row[mapping.currencyIdx].trim().toUpperCase() || 'EUR';
    }

    // Conversió de divisa oficial BCE si no és EUR
    if (currency !== 'EUR' && mapping.totalEURIdx === undefined) {
      try {
        const rate = await convertToEUR(1, currency, isoDate);
        totalEUR = totalEUR * rate;
        commission = commission * rate;
      } catch {
        // Fallback
      }
    }

    const symbolRaw = row[mapping.symbolIdx]?.trim() || 'ACTIU';
    const isinRaw = mapping.isinIdx !== undefined ? row[mapping.isinIdx]?.trim() : '';

    // Detecció del tipus d'actiu segons ticker / ISIN
    let assetClass: TradeRecord['assetClass'] = 'shares';
    const symUpper = symbolRaw.toUpperCase();
    if (symUpper.includes('BTC') || symUpper.includes('ETH') || symUpper.includes('SOL') || symUpper.includes('USDT') || symUpper.includes('CRYPTO')) {
      assetClass = 'crypto';
    } else if (symUpper.includes('ETF') || isinRaw.startsWith('IE') || isinRaw.startsWith('LU')) {
      assetClass = 'etf';
    }

    trades.push({
      id: `${broker}-${i}`,
      broker,
      date: isoDate,
      symbol: symbolRaw,
      isin: isinRaw || '',
      name: symbolRaw,
      type,
      assetClass,
      quantity: qty,
      price,
      currency,
      exchangeRate: 1,
      commission,
      totalEUR,
      marketType: isinRaw.startsWith('ES') || isinRaw.startsWith('FR') || isinRaw.startsWith('DE') || isinRaw.startsWith('IT')
        ? 'regulated_eu'
        : 'unregulated_or_foreign',
    });
  }

  return trades;
}

function normalizeDate(raw: string): string {
  // Eliminar part d'hora si n'hi ha (ex: "2024-03-15 14:30:00" -> "2024-03-15")
  const dateOnly = raw.split(' ')[0].split('T')[0].trim();

  if (dateOnly.includes('/')) {
    const parts = dateOnly.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        // DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  } else if (dateOnly.includes('-')) {
    const parts = dateOnly.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 2 && parts[2].length === 4) {
        // DD-MM-YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (parts[0].length === 4) {
        // YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
  }

  return dateOnly;
}
