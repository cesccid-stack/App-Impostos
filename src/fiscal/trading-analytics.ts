/**
 * @module fiscal/trading-analytics
 * Motor d'anàlisi quantitativa, backtesting multianual, mètriques històriques i comparatives de trading.
 */

import type { GainItem } from '../types.ts';

export interface YearPerformance {
  year: number;
  trades: number;
  pnl: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  volume: number;
}

export interface DayOfWeekPerformance {
  dayName: string;
  dayIndex: number;
  trades: number;
  pnl: number;
  winRate: number;
}

export interface PnLDistributionBucket {
  label: string;
  count: number;
  totalPnl: number;
  color: string;
}

export interface AssetComparison {
  type: string;
  label: string;
  trades: number;
  totalProfit: number;
  totalLoss: number;
  netPnL: number;
  winRate: number;
  profitFactor: number;
  avgTrade: number;
}

export interface TradePerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;                   // % (ex: 65.4%)
  lossRate: number;                  // % (ex: 34.6%)
  
  totalProfit: number;               // Suma guanys bruts (€)
  totalLoss: number;                 // Suma pèrdues brutes (€)
  netPnL: number;                    // P&L Net total (€)
  totalVolumeTraded: number;         // Volum total transaccionat (€)
  profitFactor: number;              // Total Profit / Total Loss
  
  avgTrade: number;                  // P&L mitjà per trade (€)
  avgWin: number;                    // Guany mitjà en trades positius (€)
  avgLoss: number;                   // Pèrdua mitjana en trades negatius (€)
  payoffRatio: number;               // avgWin / avgLoss (Risk to Reward ratio)
  expectancyEUR: number;             // Esperança matemàtica per operació (€)
  
  maxWin: number;                    // Guany màxim en 1 trade (€)
  maxLoss: number;                   // Pèrdua màxima en 1 trade (€)
  
  maxConsecutiveWins: number;        // Ratxa màxima de victòries
  maxConsecutiveLosses: number;      // Ratxa màxima de derrotes
  
  maxDrawdownEUR: number;            // Màxima caiguda en euros (€)
  maxDrawdownPercent: number;        // Màxima caiguda en % des del pic
  
  avgHoldingDaysWins: number;        // Dies mitjans que s'aguanten les guanyadores
  avgHoldingDaysLosses: number;      // Dies mitjans que s'aguanten les perdedores
  
  estimatedTaxesSavings: number;     // Estimació impost IRPF (escala de l'estalvi)
  netPnLAfterTax: number;            // P&L net lliure d'impostos (€)
  
  sharpeRatio: number;               // Ràtio de Sharpe aproximat
  disciplineScore: number;           // Puntuació de disciplina (0-100)
  psychologicalBiases: {
    dispositionEffect: boolean;      // Aguanta més les pèrdues que els guanys?
    revengeTradingRisk: boolean;     // Pèrdues grans concentrades?
    outlierRisk: boolean;            // El 80% dels guanys depèn d'1 sol trade?
    warnings: string[];
    strengths: string[];
  };

  equityCurve: { tradeIndex: number; date: string; cumulativePnL: number; peakPnL: number; drawdown: number }[];
  
  // Informació històrica i comparativa
  yearlyPerformance: YearPerformance[];
  monthlyBreakdown: { yearMonth: string; pnl: number; trades: number; winRate: number }[];
  dayOfWeekPerformance: DayOfWeekPerformance[];
  assetComparison: AssetComparison[];
  distributionBuckets: PnLDistributionBucket[];
  benchmarkComparison: {
    tradingReturnTotalEUR: number;
    estimatedCapitalEmployed: number;
    tradingReturnPct: number;
    benchmarkSp500Pct: number;
    alphaGeneratedPct: number;
  };
}

/**
 * Calcula totes les mètriques quantitatives, històriques i comparatives de trading.
 */
export function analyzeTradingPerformance(items: GainItem[] = []): TradePerformanceMetrics {
  if (items.length === 0) {
    return createEmptyMetrics();
  }

  // Ordenar per data de transmissió / tancament
  const sorted = [...items].sort((a, b) => {
    const dateA = new Date(a.transferDate || '2024-01-01').getTime();
    const dateB = new Date(b.transferDate || '2024-01-01').getTime();
    return dateA - dateB;
  });

  let totalProfit = 0;
  let totalLoss = 0;
  let totalVolumeTraded = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let breakevenTrades = 0;
  let maxWin = 0;
  let maxLoss = 0;

  let winDaysSum = 0;
  let lossDaysSum = 0;

  let currentStreakWins = 0;
  let currentStreakLosses = 0;
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;

  let cumulativePnL = 0;
  let peakPnL = 0;
  let maxDrawdownEUR = 0;
  let maxDrawdownPercent = 0;

  const equityCurve: TradePerformanceMetrics['equityCurve'] = [
    { tradeIndex: 0, date: 'Inici', cumulativePnL: 0, peakPnL: 0, drawdown: 0 }
  ];

  const returns: number[] = [];

  // Mapeig històric
  const yearlyMap = new Map<number, { trades: number; pnl: number; wins: number; losses: number; winProfit: number; lossProfit: number; volume: number }>();
  const monthlyMap = new Map<string, { trades: number; pnl: number; wins: number }>();
  const dayNames = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
  const dayMap = new Map<number, { trades: number; pnl: number; wins: number }>();
  for (let d = 1; d <= 5; d++) dayMap.set(d, { trades: 0, pnl: 0, wins: 0 }); // Dilluns a Divendres

  const assetMap = new Map<string, { trades: number; profit: number; loss: number; pnl: number; wins: number; losses: number }>();

  // Histogram Buckets
  const bucketRanges = [
    { label: 'Gran Guany (> +1.000 €)', count: 0, totalPnl: 0, color: '#10b981' },
    { label: 'Guany Mitjà (+250 € a +1.000 €)', count: 0, totalPnl: 0, color: '#34d399' },
    { label: 'Guany Petit (+0 € a +250 €)', count: 0, totalPnl: 0, color: '#6ee7b7' },
    { label: 'Pèrdua Petita (-0 € a -250 €)', count: 0, totalPnl: 0, color: '#fca5a5' },
    { label: 'Pèrdua Mitjana (-250 € a -1.000 €)', count: 0, totalPnl: 0, color: '#f87171' },
    { label: 'Gran Pèrdua (< -1.000 €)', count: 0, totalPnl: 0, color: '#ef4444' },
  ];

  let totalAcquisitionCapital = 0;

  sorted.forEach((item, idx) => {
    const pnl = (item.transferValue || 0) - (item.acquisitionValue || 0) - (item.expenses || 0);
    const volume = (item.acquisitionValue || 0) + (item.transferValue || 0);
    totalVolumeTraded += volume;
    totalAcquisitionCapital += (item.acquisitionValue || 0);

    const holdingDays = calculateDaysBetween(item.acquisitionDate, item.transferDate);
    const itemDate = item.transferDate ? new Date(item.transferDate) : new Date('2024-01-01');
    const year = isNaN(itemDate.getFullYear()) ? 2024 : itemDate.getFullYear();
    const monthKey = item.transferDate ? item.transferDate.substring(0, 7) : `${year}-01`;
    const dayOfWeek = isNaN(itemDate.getDay()) ? 1 : itemDate.getDay();

    // 1. Acumulació per Any
    if (!yearlyMap.has(year)) {
      yearlyMap.set(year, { trades: 0, pnl: 0, wins: 0, losses: 0, winProfit: 0, lossProfit: 0, volume: 0 });
    }
    const yData = yearlyMap.get(year)!;
    yData.trades++;
    yData.pnl += pnl;
    yData.volume += volume;
    if (pnl > 0) { yData.wins++; yData.winProfit += pnl; }
    else if (pnl < 0) { yData.losses++; yData.lossProfit += Math.abs(pnl); }

    // 2. Acumulació per Mes
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { trades: 0, pnl: 0, wins: 0 });
    }
    const mData = monthlyMap.get(monthKey)!;
    mData.trades++;
    mData.pnl += pnl;
    if (pnl > 0) mData.wins++;

    // 3. Acumulació per Dia de la Setmana (1=Dilluns .. 5=Divendres)
    const validDay = (dayOfWeek >= 1 && dayOfWeek <= 5) ? dayOfWeek : (dayOfWeek === 0 ? 1 : 5);
    if (dayMap.has(validDay)) {
      const dData = dayMap.get(validDay)!;
      dData.trades++;
      dData.pnl += pnl;
      if (pnl > 0) dData.wins++;
    }

    // 4. Acumulació per Tipus d'Actiu
    const assetType = item.type || 'shares';
    if (!assetMap.has(assetType)) {
      assetMap.set(assetType, { trades: 0, profit: 0, loss: 0, pnl: 0, wins: 0, losses: 0 });
    }
    const aData = assetMap.get(assetType)!;
    aData.trades++;
    aData.pnl += pnl;
    if (pnl > 0) { aData.wins++; aData.profit += pnl; }
    else if (pnl < 0) { aData.losses++; aData.loss += Math.abs(pnl); }

    // 5. Histograma de distribució
    if (pnl >= 1000) { bucketRanges[0].count++; bucketRanges[0].totalPnl += pnl; }
    else if (pnl >= 250) { bucketRanges[1].count++; bucketRanges[1].totalPnl += pnl; }
    else if (pnl > 0) { bucketRanges[2].count++; bucketRanges[2].totalPnl += pnl; }
    else if (pnl > -250) { bucketRanges[3].count++; bucketRanges[3].totalPnl += pnl; }
    else if (pnl > -1000) { bucketRanges[4].count++; bucketRanges[4].totalPnl += pnl; }
    else { bucketRanges[5].count++; bucketRanges[5].totalPnl += pnl; }

    // Equity Curve
    cumulativePnL += pnl;
    if (cumulativePnL > peakPnL) peakPnL = cumulativePnL;
    const currentDrawdown = peakPnL - cumulativePnL;
    if (currentDrawdown > maxDrawdownEUR) maxDrawdownEUR = currentDrawdown;

    const ddPct = peakPnL > 0 ? (currentDrawdown / peakPnL) * 100 : 0;
    if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;

    equityCurve.push({
      tradeIndex: idx + 1,
      date: item.transferDate || `Trade ${idx + 1}`,
      cumulativePnL,
      peakPnL,
      drawdown: currentDrawdown,
    });

    const cost = (item.acquisitionValue || 1);
    returns.push(pnl / cost);

    if (pnl > 0.01) {
      winningTrades++;
      totalProfit += pnl;
      winDaysSum += holdingDays;
      if (pnl > maxWin) maxWin = pnl;

      currentStreakWins++;
      currentStreakLosses = 0;
      if (currentStreakWins > maxConsecutiveWins) maxConsecutiveWins = currentStreakWins;
    } else if (pnl < -0.01) {
      losingTrades++;
      const absLoss = Math.abs(pnl);
      totalLoss += absLoss;
      lossDaysSum += holdingDays;
      if (absLoss > maxLoss) maxLoss = absLoss;

      currentStreakLosses++;
      currentStreakWins = 0;
      if (currentStreakLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentStreakLosses;
    } else {
      breakevenTrades++;
    }
  });

  const totalTrades = sorted.length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const lossRate = totalTrades > 0 ? (losingTrades / totalTrades) * 100 : 0;
  const netPnL = totalProfit - totalLoss;
  const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss) : (totalProfit > 0 ? 99.9 : 0);

  const avgTrade = totalTrades > 0 ? netPnL / totalTrades : 0;
  const avgWin = winningTrades > 0 ? totalProfit / winningTrades : 0;
  const avgLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
  const payoffRatio = avgLoss > 0 ? (avgWin / avgLoss) : (avgWin > 0 ? 99.9 : 0);

  const winProb = winRate / 100;
  const lossProb = lossRate / 100;
  const expectancyEUR = (winProb * avgWin) - (lossProb * avgLoss);

  const avgHoldingDaysWins = winningTrades > 0 ? Math.round((winDaysSum / winningTrades) * 10) / 10 : 0;
  const avgHoldingDaysLosses = losingTrades > 0 ? Math.round((lossDaysSum / losingTrades) * 10) / 10 : 0;

  // Càlcul d'impostos de l'estalvi aproximat
  let estimatedTaxesSavings = 0;
  if (netPnL > 0) {
    if (netPnL <= 6000) estimatedTaxesSavings = netPnL * 0.19;
    else if (netPnL <= 50000) estimatedTaxesSavings = (6000 * 0.19) + ((netPnL - 6000) * 0.21);
    else if (netPnL <= 200000) estimatedTaxesSavings = (6000 * 0.19) + (44000 * 0.21) + ((netPnL - 50000) * 0.23);
    else estimatedTaxesSavings = (6000 * 0.19) + (44000 * 0.21) + (150000 * 0.23) + ((netPnL - 200000) * 0.27);
  }
  const netPnLAfterTax = netPnL - estimatedTaxesSavings;

  // Càlcul de ràtio de Sharpe aproximat
  const meanReturn = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
  const variance = returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / (returns.length || 1);
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? Math.round((meanReturn / stdDev) * Math.sqrt(totalTrades) * 100) / 100 : 0;

  // Diagnòstic psicològic i de gestió de risc
  const warnings: string[] = [];
  const strengths: string[] = [];

  const dispositionEffect = avgHoldingDaysLosses > (avgHoldingDaysWins * 1.5) && losingTrades > 0;
  if (dispositionEffect) {
    warnings.push(`⚠️ Efecte Disposició detectat: Aguantes les posicions perdedores una mitjana de ${avgHoldingDaysLosses} dies davant de només ${avgHoldingDaysWins} dies per a les guanyadores. Revisa els teus Stop Loss.`);
  } else if (winningTrades > 0) {
    strengths.push(`✅ Bona disciplina temporal: Deixes córrer els guanys (${avgHoldingDaysWins} dies) i talles les pèrdues amb rapidesa (${avgHoldingDaysLosses} dies).`);
  }

  const outlierRisk = totalProfit > 0 && maxWin > (totalProfit * 0.6);
  if (outlierRisk) {
    warnings.push(`⚠️ Dependència excessiva d'1 sol trade: El teu trade més gran (+${maxWin.toFixed(2)}€) representa més del 60% de tots els teus guanys bruts.`);
  }

  const revengeTradingRisk = maxLoss > (avgLoss * 2.5) && maxLoss > 100;
  if (revengeTradingRisk) {
    warnings.push(`⚠️ Pèrdues descontrolades (Outlier Loss): Tens pèrdues individuals (${maxLoss.toFixed(2)}€) que superen amb escreix la teva pèrdua mitjana (${avgLoss.toFixed(2)}€).`);
  }

  if (profitFactor >= 1.75) {
    strengths.push(`✅ Profit Factor excel·lent (${profitFactor.toFixed(2)}): El teu sistema genera significativament més del que perd.`);
  }

  if (payoffRatio >= 1.5) {
    strengths.push(`✅ Risk/Reward positiu (${payoffRatio.toFixed(2)}): Guanyes de mitjana més del que arrisques quan perds.`);
  }

  // Puntuació de disciplina (0-100)
  let disciplineScore = 70;
  if (profitFactor > 1.5) disciplineScore += 10;
  if (payoffRatio > 1.3) disciplineScore += 10;
  if (!dispositionEffect) disciplineScore += 10;
  if (outlierRisk) disciplineScore -= 15;
  if (revengeTradingRisk) disciplineScore -= 15;
  disciplineScore = Math.max(10, Math.min(100, disciplineScore));

  // Arrays històrics formats
  const yearlyPerformance: YearPerformance[] = Array.from(yearlyMap.entries())
    .map(([year, d]) => ({
      year,
      trades: d.trades,
      pnl: d.pnl,
      wins: d.wins,
      losses: d.losses,
      winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 1000) / 10 : 0,
      profitFactor: d.lossProfit > 0 ? Math.round((d.winProfit / d.lossProfit) * 100) / 100 : (d.winProfit > 0 ? 99.9 : 0),
      volume: d.volume,
    }))
    .sort((a, b) => a.year - b.year);

  const monthlyBreakdown = Array.from(monthlyMap.entries())
    .map(([yearMonth, d]) => ({
      yearMonth,
      pnl: d.pnl,
      trades: d.trades,
      winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

  const dayOfWeekPerformance: DayOfWeekPerformance[] = Array.from(dayMap.entries())
    .map(([dayIndex, d]) => ({
      dayIndex,
      dayName: dayNames[dayIndex],
      trades: d.trades,
      pnl: d.pnl,
      winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.dayIndex - b.dayIndex);

  const assetLabels: Record<string, string> = {
    shares: '📈 Accions / ETF',
    funds: '📊 Fons d\'Inversió',
    real_estate: '🏠 Immobles',
    crypto: '₿ Criptomonedes',
    other: '📋 Altres Actius',
  };

  const assetComparison: AssetComparison[] = Array.from(assetMap.entries())
    .map(([type, d]) => ({
      type,
      label: assetLabels[type] || type,
      trades: d.trades,
      totalProfit: d.profit,
      totalLoss: d.loss,
      netPnL: d.pnl,
      winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 1000) / 10 : 0,
      profitFactor: d.loss > 0 ? Math.round((d.profit / d.loss) * 100) / 100 : (d.profit > 0 ? 99.9 : 0),
      avgTrade: d.trades > 0 ? Math.round(d.pnl / d.trades) : 0,
    }))
    .sort((a, b) => b.netPnL - a.netPnL);

  // Benchmark comparison
  const estimatedCap = totalAcquisitionCapital > 0 ? (totalAcquisitionCapital / totalTrades) * 2 : 10000;
  const tradingReturnPct = estimatedCap > 0 ? (netPnL / estimatedCap) * 100 : 0;
  const benchmarkSp500Pct = 12.5; // Rendiment anualitzat típic S&P500
  const alphaGeneratedPct = tradingReturnPct - benchmarkSp500Pct;

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    breakevenTrades,
    winRate: Math.round(winRate * 10) / 10,
    lossRate: Math.round(lossRate * 10) / 10,
    totalProfit,
    totalLoss,
    netPnL,
    totalVolumeTraded,
    profitFactor: Math.round(profitFactor * 100) / 100,
    avgTrade,
    avgWin,
    avgLoss,
    payoffRatio: Math.round(payoffRatio * 100) / 100,
    expectancyEUR,
    maxWin,
    maxLoss,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    maxDrawdownEUR,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 10) / 10,
    avgHoldingDaysWins,
    avgHoldingDaysLosses,
    estimatedTaxesSavings,
    netPnLAfterTax,
    sharpeRatio,
    disciplineScore,
    psychologicalBiases: {
      dispositionEffect,
      revengeTradingRisk,
      outlierRisk,
      warnings,
      strengths,
    },
    equityCurve,
    yearlyPerformance,
    monthlyBreakdown,
    dayOfWeekPerformance,
    assetComparison,
    distributionBuckets: bucketRanges,
    benchmarkComparison: {
      tradingReturnTotalEUR: netPnL,
      estimatedCapitalEmployed: estimatedCap,
      tradingReturnPct: Math.round(tradingReturnPct * 10) / 10,
      benchmarkSp500Pct,
      alphaGeneratedPct: Math.round(alphaGeneratedPct * 10) / 10,
    },
  };
}

function calculateDaysBetween(startDateStr?: string, endDateStr?: string): number {
  if (!startDateStr || !endDateStr) return 1;
  const d1 = new Date(startDateStr).getTime();
  const d2 = new Date(endDateStr).getTime();
  if (isNaN(d1) || isNaN(d2)) return 1;
  const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
  return diffDays;
}

function createEmptyMetrics(): TradePerformanceMetrics {
  return {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    breakevenTrades: 0,
    winRate: 0,
    lossRate: 0,
    totalProfit: 0,
    totalLoss: 0,
    netPnL: 0,
    totalVolumeTraded: 0,
    profitFactor: 0,
    avgTrade: 0,
    avgWin: 0,
    avgLoss: 0,
    payoffRatio: 0,
    expectancyEUR: 0,
    maxWin: 0,
    maxLoss: 0,
    maxConsecutiveWins: 0,
    maxConsecutiveLosses: 0,
    maxDrawdownEUR: 0,
    maxDrawdownPercent: 0,
    avgHoldingDaysWins: 0,
    avgHoldingDaysLosses: 0,
    estimatedTaxesSavings: 0,
    netPnLAfterTax: 0,
    sharpeRatio: 0,
    disciplineScore: 50,
    psychologicalBiases: {
      dispositionEffect: false,
      revengeTradingRisk: false,
      outlierRisk: false,
      warnings: ['No hi ha operacions de trading registrades per realitzar l\'auditoria quantitativa.'],
      strengths: [],
    },
    equityCurve: [],
    yearlyPerformance: [],
    monthlyBreakdown: [],
    dayOfWeekPerformance: [],
    assetComparison: [],
    distributionBuckets: [],
    benchmarkComparison: {
      tradingReturnTotalEUR: 0,
      estimatedCapitalEmployed: 0,
      tradingReturnPct: 0,
      benchmarkSp500Pct: 12.5,
      alphaGeneratedPct: -12.5,
    },
  };
}
