/**
 * @module import/parser-degiro
 * Parser for DEGIRO transactions CSV.
 */

import { parseCSV, parseNumber } from './csv-utils.ts';
import type { TradeRecord } from '../types-portfolio.ts';

export async function parseDegiro(csv: string): Promise<TradeRecord[]> {
  const lines = parseCSV(csv, ',');
  if (lines.length < 2) return [];

  const headers = lines[0].map(h => h.trim().toLowerCase());
  
  // Find column indices
  const dateIdx = headers.findIndex(h => h.includes('fecha'));
  const productIdx = headers.findIndex(h => h.includes('producto'));
  const isinIdx = headers.findIndex(h => h.includes('isin'));
  const qtyIdx = headers.findIndex(h => h.includes('cantidad'));
  const priceIdx = headers.findIndex(h => h.includes('precio'));
  const totalIdx = headers.findIndex(h => h.includes('total') || h.includes('valor'));
  // Degiro has "Valor local" and "Valor" (in EUR) usually. 
  const valIdx = headers.indexOf('valor');

  const trades: TradeRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length < 5) continue;
    if (!row[dateIdx] || !row[productIdx]) continue;

    // Degiro date is usually DD-MM-YYYY
    const dateStr = row[dateIdx].trim();
    let isoDate = dateStr;
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3 && parts[0].length === 2) {
        isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const qty = parseNumber(row[qtyIdx]);
    if (qty === 0) continue;

    const type = qty > 0 ? 'buy' : 'sell';
    const absQty = Math.abs(qty);
    const price = parseNumber(row[priceIdx]);
    
    // We assume Degiro's "Valor" is in EUR
    const totalEUR = Math.abs(parseNumber(row[valIdx > -1 ? valIdx : totalIdx]));

    trades.push({
      id: `degiro-${i}`,
      broker: 'degiro',
      date: isoDate,
      symbol: row[productIdx], // Sometimes Degiro lacks ticker, we use product name
      isin: row[isinIdx],
      name: row[productIdx],
      type,
      assetClass: 'shares', // Default to shares, could refine later
      quantity: absQty,
      price,
      currency: 'EUR', // Simplified, assuming total is in EUR
      exchangeRate: 1,
      commission: 0, // In Degiro, total is usually net, but we can refine
      totalEUR,
    });
  }

  return trades;
}
