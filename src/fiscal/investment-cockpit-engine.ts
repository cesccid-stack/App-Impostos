/**
 * @module fiscal/investment-cockpit-engine
 * Motor Avançat d'Analítica Quantitativa, Diagnòstic de Tècniques Operatives,
 * Avaluació de Biaixos Cognitius (Post-Mortem), Fricció Fiscal (Tax Drag),
 * Criteri de Kelly, Anàlisi per Setups, Mapa de Calor Calendari i Pla Kaizen 1% Diari.
 * Conforme a la normativa tributària d'IRPF sobre guanys patrimonials (Arts. 33 a 49 LIRPF).
 */

import type { GainItem } from '../types.ts';
import { roundCurrency } from '../utils/math.ts';

export type InvestmentAssetClass = 'shares' | 'crypto' | 'funds' | 'etf' | 'derivatives' | 'other';
export type TradingHoldingStyle = 'scalping' | 'swing' | 'positional' | 'long_term';

export interface InvestmentCockpitOptions {
  filterYear?: number | 'ALL';
  filterAssetClass?: InvestmentAssetClass | 'ALL';
  filterStyle?: TradingHoldingStyle | 'ALL';
  filterSetup?: string | 'ALL';
}

export interface EnrichedTradeItem extends GainItem {
  id: string;
  concept: string;
  pnl: number;
  returnPct: number;
  holdingDays: number;
  assetClass: InvestmentAssetClass;
  style: TradingHoldingStyle;
  isWin: boolean;
  isLoss: boolean;
  isBreakEven: boolean;
  year: number;
  month: number;
  dayOfWeek: number; // 0 (Diumenge) a 6 (Dissabte)
  dateStr: string;
  isWashSaleSuspect?: boolean;
  
  // Metadades de Trading Journal
  setup: string;
  emotionTag: string;
  executionGrade: 'A+' | 'A' | 'B' | 'C' | 'F' | 'Unrated';
  riskAmountEUR: number;
  rMultiple: number; // Retorn en múltiples de risc R (pnl / riskAmountEUR)
  notes: string;
}

export interface AssetClassAnalytics {
  assetClass: InvestmentAssetClass;
  label: string;
  icon: string;
  tradesCount: number;
  grossProfit: number;
  grossLoss: number;
  netPnL: number;
  volume: number;
  winRate: number;
  profitFactor: number;
  avgReturnPct: number;
  taxDragEUR: number;
}

export interface StyleAnalytics {
  style: TradingHoldingStyle;
  label: string;
  description: string;
  tradesCount: number;
  netPnL: number;
  winRate: number;
  profitFactor: number;
  avgHoldingDays: number;
  avgPnLPerTrade: number;
}

export interface SetupAnalytics {
  setup: string;
  tradesCount: number;
  grossProfit: number;
  grossLoss: number;
  netPnL: number;
  winRate: number;
  profitFactor: number;
  avgReturnPct: number;
  avgRMultiple: number;
}

export interface ExecutionGradeAnalytics {
  grade: 'A+' | 'A' | 'B' | 'C' | 'F' | 'Unrated';
  tradesCount: number;
  netPnL: number;
  winRate: number;
  profitFactor: number;
}

export interface DailyPnLEntry {
  date: string; // YYYY-MM-DD
  tradesCount: number;
  pnl: number;
  isWinningDay: boolean;
  isLosingDay: boolean;
  intensity: number; // 0 to 4 per al mapa de calor
}

export interface DayOfWeekEntry {
  dayName: string;
  dayIndex: number;
  tradesCount: number;
  netPnL: number;
  winRate: number;
  profitFactor: number;
}

export interface RiskManagementMetrics {
  kellyFractionPct: number;       // Criteri de Kelly (%)
  halfKellyPct: number;           // Half-Kelly conservador (%)
  var95EUR: number;               // Value at Risk 95% (€)
  var99EUR: number;               // Value at Risk 99% (€)
  cvarExpectedShortfallEUR: number; // Conditional VaR 95% (€)
  calmarRatio: number;            // Ràtio Calmar (Retorn / Max Drawdown)
  ulcerIndex: number;             // Índex d'Úlcera (Estrès de Drawdown)
  totalRAccumulated: number;      // Total R generat
  avgRWin: number;
  avgRLoss: number;
  maxConsecutiveLossesEUR: number;
  recommendedMaxRiskPerTradeEUR: number;
}

export interface PostMortemDiagnosis {
  disciplineScore: number; // 0 - 100
  rating: 'Excel·lent' | 'Rigorós' | 'Acceptable' | 'Millorable' | 'Risc Alt';
  dispositionEffectRatio: number; // Dies pèrdues / Dies guanys
  hasDispositionEffect: boolean;
  hasRevengeTrading: boolean;
  hasAsymmetricLossRisk: boolean;
  hasOvertradingFriction: boolean;
  hasWashSaleLock: boolean;
  blockedWashSaleLossesEUR: number;
  criticalMistakes: {
    title: string;
    description: string;
    impactEUR: number;
    severity: 'critical' | 'warning' | 'info';
    remedy: string;
  }[];
  worstTrades: EnrichedTradeItem[];
  bestTrades: EnrichedTradeItem[];
  coachingRecommendations: {
    category: 'Gestió del Risc' | 'Optimització Fiscal' | 'Tècnica & Timing' | 'Psicologia';
    title: string;
    detail: string;
    actionableStep: string;
  }[];
  kaizenGoldenRules: string[];
}

export interface WhatIfSimulationResult {
  currentNetPnL: number;
  simulatedNetPnL: number;
  pnlDifferenceEUR: number;
  simulatedWinRate: number;
  simulatedProfitFactor: number;
  tradesModifiedCount: number;
  explanation: string;
}

export interface MultiYearEvolutionItem {
  year: number;
  tradesCount: number;
  volume: number;
  grossProfit: number;
  grossLoss: number;
  netPnL: number;
  winRate: number;
  profitFactor: number;
  estimatedTaxDue: number;
  netAfterTax: number;
  taxDragPct: number;
}

export interface InvestmentCockpitReport {
  options: InvestmentCockpitOptions;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;
  lossRate: number;
  
  totalVolume: number;
  grossProfit: number;
  grossLoss: number;
  netPnL: number;
  profitFactor: number;
  
  avgTrade: number;
  avgWin: number;
  avgLoss: number;
  payoffRatio: number; // R:R (avgWin / avgLoss)
  expectancyEUR: number;
  
  maxWin: number;
  maxLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  
  maxDrawdownEUR: number;
  maxDrawdownPct: number;
  
  avgHoldingDays: number;
  avgHoldingDaysWins: number;
  avgHoldingDaysLosses: number;
  
  // Fricció Fiscal (Tax Drag)
  estimatedTaxSavingsBase: number;
  effectiveTaxRatePct: number;
  netPnLAfterTax: number;
  totalCommissionsAndExpenses: number;
  totalFrictionEUR: number;
  frictionPercentageOfProfits: number;
  
  // Ràtios Quantitatives & Risc
  sharpeRatio: number;
  sortinoRatio: number;
  riskMetrics: RiskManagementMetrics;
  
  // Segmentacions & Diari
  assetClasses: AssetClassAnalytics[];
  styles: StyleAnalytics[];
  setups: SetupAnalytics[];
  executionGrades: ExecutionGradeAnalytics[];
  dailyCalendarHeatmap: DailyPnLEntry[];
  dayOfWeekAnalytics: DayOfWeekEntry[];
  multiYearEvolution: MultiYearEvolutionItem[];
  
  // Corba d'Equitat & Drawdown
  equityCurve: {
    index: number;
    date: string;
    concept: string;
    tradePnL: number;
    cumulativePnL: number;
    peakPnL: number;
    drawdownEUR: number;
    drawdownPct: number;
  }[];
  
  // Post-Mortem & Psicologia
  postMortem: PostMortemDiagnosis;
  
  // Simulador What-If
  whatIfStrictStopLoss5Pct: WhatIfSimulationResult;
  whatIfStrictStopLoss8Pct: WhatIfSimulationResult;
  whatIfNoWashSales: WhatIfSimulationResult;
  
  enrichedTrades: EnrichedTradeItem[];
}

/**
 * Classifica un actiu patrimonial en una de les categories estàndard.
 */
export function classifyAssetType(concept: string, assetTypeStr?: string): InvestmentAssetClass {
  const c = (concept || '').toLowerCase();
  const t = (assetTypeStr || '').toLowerCase();

  if (t === 'crypto' || c.includes('btc') || c.includes('bitcoin') || c.includes('eth') || c.includes('ethereum') || c.includes('crypto') || c.includes('solana') || c.includes('usdt') || c.includes('bnb') || c.includes('avax')) {
    return 'crypto';
  }
  if (t === 'funds' || c.includes('fons') || c.includes('fondo') || c.includes('vanguard') || c.includes('amundi') || c.includes('indexat') || c.includes('blackrock') || c.includes('ishares fund')) {
    return 'funds';
  }
  if (c.includes('etf') || c.includes('spdr') || c.includes('ishares core') || c.includes('qqq') || c.includes('voo') || c.includes('spy')) {
    return 'etf';
  }
  if (c.includes('future') || c.includes('opcio') || c.includes('opcion') || c.includes('cfd') || c.includes('warrant') || c.includes('swap')) {
    return 'derivatives';
  }
  if (t === 'shares' || c.includes('accions') || c.includes('acciones') || c.includes('inc') || c.includes('corp') || c.includes('sa') || c.includes('s.a.') || c.includes('sl') || c.includes('holding') || c.includes('nvda') || c.includes('aapl') || c.includes('msft') || c.includes('tsla') || c.includes('amzn') || c.includes('googl')) {
    return 'shares';
  }
  return 'shares';
}

/**
 * Determina l'estil operatiu en funció del període de permanència (Holding Days).
 */
export function determineHoldingStyle(holdingDays: number): TradingHoldingStyle {
  if (holdingDays <= 1) return 'scalping';
  if (holdingDays <= 30) return 'swing';
  if (holdingDays <= 365) return 'positional';
  return 'long_term';
}

/**
 * Assigna o infereix un setup per defecte si no s'ha especificat.
 */
export function inferTradeSetup(item: GainItem, holdingDays: number): string {
  if (item.setup && item.setup.trim() !== '') return item.setup.trim();
  const c = (item.description || (item as unknown as { concept?: string }).concept || '').toLowerCase();
  if (c.includes('breakout') || c.includes('trencament')) return 'Breakout';
  if (c.includes('reversion') || c.includes('suport') || c.includes('dip')) return 'Dip Buying / Reversió';
  if (c.includes('trend') || c.includes('tendencia')) return 'Trend Following';
  if (c.includes('dca') || c.includes('recurrent')) return 'DCA / Acumulació';
  if (c.includes('earnings') || c.includes('resultats')) return 'Earnings Play';
  if (c.includes('staking') || c.includes('yield') || c.includes('defi')) return 'DeFi Yield / Staking';
  if (holdingDays <= 1) return 'Intradia Momentum';
  if (holdingDays <= 30) return 'Swing Momentum';
  return 'Posicional Fonamental';
}

/**
 * Assigna o infereix una etiqueta d'emoció / execució si no s'ha especificat.
 */
export function inferEmotionTag(item: GainItem, pnl: number): string {
  if (item.emotionTag && item.emotionTag.trim() !== '') return item.emotionTag.trim();
  if (pnl > 0) return 'Pla Executat';
  if (item.isNonComputableLoss) return 'Wash Sale Risc';
  return 'Execució Estàndard';
}

/**
 * Calcula l'escala de l'estalvi d'IRPF sobre la base imposable de guanys patrimonials.
 */
export function calculateSavingsTaxEUR(base: number): number {
  if (base <= 0) return 0;
  let tax = 0;
  let remaining = base;
  if (remaining > 300000) {
    tax += (remaining - 300000) * 0.28;
    remaining = 300000;
  }
  if (remaining > 200000) {
    tax += (remaining - 200000) * 0.27;
    remaining = 200000;
  }
  if (remaining > 50000) {
    tax += (remaining - 50000) * 0.23;
    remaining = 50000;
  }
  if (remaining > 6000) {
    tax += (remaining - 6000) * 0.21;
    remaining = 6000;
  }
  tax += remaining * 0.19;
  return roundCurrency(tax);
}

/**
 * Motor principal que processa i extreu tota l'analítica avançada d'inversió.
 */
export function analyzeInvestmentCockpit(
  items: GainItem[] = [],
  options: InvestmentCockpitOptions = {}
): InvestmentCockpitReport {
  const filterYear = options.filterYear ?? 'ALL';
  const filterAssetClass = options.filterAssetClass ?? 'ALL';
  const filterStyle = options.filterStyle ?? 'ALL';
  const filterSetup = options.filterSetup ?? 'ALL';

  // 1. Enriquir i normalitzar totes les operacions
  const allEnriched: EnrichedTradeItem[] = items.map((item, idx) => {
    const acqVal = Number(item.acquisitionValue) || 0;
    const transVal = Number(item.transferValue) || 0;
    const exp = Number(item.expenses) || 0;
    const pnl = roundCurrency(transVal - acqVal - exp);
    const returnPct = acqVal > 0 ? roundCurrency((pnl / acqVal) * 100) : 0;

    let holdingDays = 30;
    let year = 2024;
    let month = 1;
    let dayOfWeek = 3;
    let dateStr = '2024-01-01';

    if (item.transferDate) {
      dateStr = item.transferDate;
      const transDate = new Date(item.transferDate);
      if (!isNaN(transDate.getTime())) {
        year = transDate.getFullYear();
        month = transDate.getMonth() + 1;
        dayOfWeek = transDate.getDay();
      }
      if (item.acquisitionDate) {
        const acqDate = new Date(item.acquisitionDate);
        if (!isNaN(acqDate.getTime()) && !isNaN(transDate.getTime())) {
          const diffTime = transDate.getTime() - acqDate.getTime();
          holdingDays = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
        }
      }
    }

    const concept = item.description || (item as unknown as { concept?: string }).concept || 'Operació';
    const assetClass = classifyAssetType(concept, item.type);
    const style = determineHoldingStyle(holdingDays);
    const setup = inferTradeSetup(item, holdingDays);
    const emotionTag = inferEmotionTag(item, pnl);
    const executionGrade = item.executionGrade || (pnl > 0 ? 'A' : 'B');
    const riskAmountEUR = item.riskAmountEUR && item.riskAmountEUR > 0 ? item.riskAmountEUR : Math.max(50, roundCurrency(acqVal * 0.05));
    const rMultiple = riskAmountEUR > 0 ? roundCurrency(pnl / riskAmountEUR) : 0;
    const notes = item.notes || '';

    return {
      ...item,
      id: item.id || `trade_${idx}_${Date.now()}`,
      concept,
      pnl,
      returnPct,
      holdingDays,
      assetClass,
      style,
      isWin: pnl > 0.01,
      isLoss: pnl < -0.01,
      isBreakEven: Math.abs(pnl) <= 0.01,
      year,
      month,
      dayOfWeek,
      dateStr,
      isWashSaleSuspect: item.isNonComputableLoss || false,
      setup,
      emotionTag,
      executionGrade,
      riskAmountEUR,
      rMultiple,
      notes,
    };
  });

  // 2. Detecció avançada de Regla dels 2 Mesos (Wash Sales Art. 33.5 LIRPF)
  const tradesByConcept = new Map<string, EnrichedTradeItem[]>();
  for (const t of allEnriched) {
    const key = (t.concept || '').trim().toUpperCase();
    if (!tradesByConcept.has(key)) tradesByConcept.set(key, []);
    tradesByConcept.get(key)!.push(t);
  }

  for (const [, group] of tradesByConcept.entries()) {
    if (group.length <= 1) continue;
    group.sort((a, b) => new Date(a.transferDate || '').getTime() - new Date(b.transferDate || '').getTime());
    for (let i = 0; i < group.length; i++) {
      const current = group[i];
      if (current.isLoss) {
        const curDate = new Date(current.transferDate || '').getTime();
        for (let j = 0; j < group.length; j++) {
          if (i === j) continue;
          const otherAcq = new Date(group[j].acquisitionDate || group[j].transferDate || '').getTime();
          if (!isNaN(curDate) && !isNaN(otherAcq)) {
            const diffDays = Math.abs(curDate - otherAcq) / (1000 * 60 * 60 * 24);
            if (diffDays <= 60 && current.assetClass === 'shares') {
              current.isWashSaleSuspect = true;
              break;
            }
          }
        }
      }
    }
  }

  // 3. Aplicar filtres seleccionats
  let filtered = allEnriched;
  if (filterYear !== 'ALL') {
    filtered = filtered.filter(t => t.year === filterYear);
  }
  if (filterAssetClass !== 'ALL') {
    filtered = filtered.filter(t => t.assetClass === filterAssetClass);
  }
  if (filterStyle !== 'ALL') {
    filtered = filtered.filter(t => t.style === filterStyle);
  }
  if (filterSetup !== 'ALL') {
    filtered = filtered.filter(t => t.setup === filterSetup);
  }

  // Ordenar cronològicament per a la corba d'equitat
  filtered.sort((a, b) => {
    const dateA = new Date(a.transferDate || '2024-01-01').getTime();
    const dateB = new Date(b.transferDate || '2024-01-01').getTime();
    return dateA - dateB;
  });

  // 4. Mètriques quantitatives bàsiques
  const totalTrades = filtered.length;
  const winningTrades = filtered.filter(t => t.isWin).length;
  const losingTrades = filtered.filter(t => t.isLoss).length;
  const breakevenTrades = filtered.filter(t => t.isBreakEven).length;

  const winRate = totalTrades > 0 ? roundCurrency((winningTrades / totalTrades) * 100) : 0;
  const lossRate = totalTrades > 0 ? roundCurrency((losingTrades / totalTrades) * 100) : 0;

  let grossProfit = 0;
  let grossLoss = 0;
  let totalVolume = 0;
  let totalCommissionsAndExpenses = 0;
  let totalHoldingDaysWins = 0;
  let totalHoldingDaysLosses = 0;
  let totalHoldingDays = 0;

  let maxWin = 0;
  let maxLoss = 0;
  let curConsecWins = 0;
  let maxConsecWins = 0;
  let curConsecLosses = 0;
  let maxConsecLosses = 0;

  let cumulativePnL = 0;
  let peakPnL = 0;
  let maxDrawdownEUR = 0;
  let maxDrawdownPct = 0;

  const equityCurve: InvestmentCockpitReport['equityCurve'] = [];

  for (let i = 0; i < filtered.length; i++) {
    const t = filtered[i];
    const transVal = Number(t.transferValue) || 0;
    const acqVal = Number(t.acquisitionValue) || 0;
    const exp = Number(t.expenses) || 0;

    totalVolume += (transVal + acqVal);
    totalCommissionsAndExpenses += exp;
    totalHoldingDays += t.holdingDays;

    if (t.isWin) {
      grossProfit += t.pnl;
      totalHoldingDaysWins += t.holdingDays;
      if (t.pnl > maxWin) maxWin = t.pnl;
      curConsecWins++;
      curConsecLosses = 0;
      if (curConsecWins > maxConsecWins) maxConsecWins = curConsecWins;
    } else if (t.isLoss) {
      const absLoss = Math.abs(t.pnl);
      grossLoss += absLoss;
      totalHoldingDaysLosses += t.holdingDays;
      if (absLoss > maxLoss) maxLoss = absLoss;
      curConsecLosses++;
      curConsecWins = 0;
      if (curConsecLosses > maxConsecLosses) maxConsecLosses = curConsecLosses;
    }

    cumulativePnL = roundCurrency(cumulativePnL + t.pnl);
    if (cumulativePnL > peakPnL) peakPnL = cumulativePnL;

    const curDdEUR = roundCurrency(peakPnL - cumulativePnL);
    if (curDdEUR > maxDrawdownEUR) maxDrawdownEUR = curDdEUR;

    const curDdPct = peakPnL > 0 ? roundCurrency((curDdEUR / peakPnL) * 100) : 0;
    if (curDdPct > maxDrawdownPct) maxDrawdownPct = curDdPct;

    equityCurve.push({
      index: i + 1,
      date: t.transferDate || '2024-01-01',
      concept: t.concept || 'Operació',
      tradePnL: t.pnl,
      cumulativePnL,
      peakPnL,
      drawdownEUR: curDdEUR,
      drawdownPct: curDdPct,
    });
  }

  grossProfit = roundCurrency(grossProfit);
  grossLoss = roundCurrency(grossLoss);
  totalVolume = roundCurrency(totalVolume);
  totalCommissionsAndExpenses = roundCurrency(totalCommissionsAndExpenses);
  const netPnL = roundCurrency(grossProfit - grossLoss);

  const profitFactor = grossLoss > 0 ? roundCurrency(grossProfit / grossLoss) : (grossProfit > 0 ? 99.9 : 1.0);
  const avgTrade = totalTrades > 0 ? roundCurrency(netPnL / totalTrades) : 0;
  const avgWin = winningTrades > 0 ? roundCurrency(grossProfit / winningTrades) : 0;
  const avgLoss = losingTrades > 0 ? roundCurrency(grossLoss / losingTrades) : 0;
  const payoffRatio = avgLoss > 0 ? roundCurrency(avgWin / avgLoss) : (avgWin > 0 ? 99.9 : 1.0);

  const expectancyEUR = roundCurrency(((winRate / 100) * avgWin) - ((lossRate / 100) * avgLoss));

  const avgHoldingDays = totalTrades > 0 ? Math.round(totalHoldingDays / totalTrades) : 0;
  const avgHoldingDaysWins = winningTrades > 0 ? Math.round(totalHoldingDaysWins / winningTrades) : 0;
  const avgHoldingDaysLosses = losingTrades > 0 ? Math.round(totalHoldingDaysLosses / losingTrades) : 0;

  // 5. Càlculs Fiscals & Fricció (Tax Drag)
  const estimatedTaxSavingsBase = calculateSavingsTaxEUR(Math.max(0, netPnL));
  const effectiveTaxRatePct = netPnL > 0 ? roundCurrency((estimatedTaxSavingsBase / netPnL) * 100) : 0;
  const netPnLAfterTax = roundCurrency(netPnL - estimatedTaxSavingsBase);

  const totalFrictionEUR = roundCurrency(estimatedTaxSavingsBase + totalCommissionsAndExpenses);
  const frictionPercentageOfProfits = grossProfit > 0 ? roundCurrency((totalFrictionEUR / grossProfit) * 100) : 0;

  // Ràtios de Sharpe i Sortino
  const returns = filtered.map(t => t.returnPct);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 1 ? returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / (returns.length - 1) : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? roundCurrency(avgReturn / stdDev) : 0;

  const downsideReturns = returns.filter(r => r < 0);
  const downsideVariance = downsideReturns.length > 0 ? downsideReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / downsideReturns.length : 0;
  const downsideStdDev = Math.sqrt(downsideVariance);
  const sortinoRatio = downsideStdDev > 0 ? roundCurrency(avgReturn / downsideStdDev) : (avgReturn > 0 ? 5.0 : 0);

  // 6. Mètriques de Gestió de Risc & Kelly Criterion
  const p = winRate / 100;
  const b = payoffRatio > 0 ? payoffRatio : 1;
  const rawKelly = b > 0 ? (p * b - (1 - p)) / b : 0;
  const kellyFractionPct = Math.max(0, Math.min(100, roundCurrency(rawKelly * 100)));
  const halfKellyPct = roundCurrency(kellyFractionPct / 2);

  const sortedLosses = filtered.filter(t => t.isLoss).map(t => Math.abs(t.pnl)).sort((a, b) => b - a);
  const var95Index = Math.floor(sortedLosses.length * 0.05);
  const var95EUR = sortedLosses.length > 0 ? (sortedLosses[var95Index] || sortedLosses[0]) : 0;
  const var99Index = Math.floor(sortedLosses.length * 0.01);
  const var99EUR = sortedLosses.length > 0 ? (sortedLosses[var99Index] || sortedLosses[0]) : 0;
  const tailLosses = sortedLosses.slice(0, Math.max(1, var95Index + 1));
  const cvarExpectedShortfallEUR = tailLosses.length > 0 ? roundCurrency(tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length) : 0;

  const calmarRatio = maxDrawdownPct > 0 ? roundCurrency(avgReturn / maxDrawdownPct) : (avgReturn > 0 ? 5.0 : 0);
  const squaredDrawdowns = equityCurve.map(p => Math.pow(p.drawdownPct, 2));
  const ulcerIndex = squaredDrawdowns.length > 0 ? roundCurrency(Math.sqrt(squaredDrawdowns.reduce((a, b) => a + b, 0) / squaredDrawdowns.length)) : 0;

  const totalRAccumulated = roundCurrency(filtered.reduce((s, t) => s + t.rMultiple, 0));
  const winRTot = filtered.filter(t => t.isWin).reduce((s, t) => s + t.rMultiple, 0);
  const lossRTot = filtered.filter(t => t.isLoss).reduce((s, t) => s + Math.abs(t.rMultiple), 0);
  const avgRWin = winningTrades > 0 ? roundCurrency(winRTot / winningTrades) : 0;
  const avgRLoss = losingTrades > 0 ? roundCurrency(lossRTot / losingTrades) : 0;
  const maxConsecutiveLossesEUR = roundCurrency(maxConsecLosses * avgLoss);
  const recommendedMaxRiskPerTradeEUR = roundCurrency(Math.max(25, avgWin * 0.5));

  const riskMetrics: RiskManagementMetrics = {
    kellyFractionPct,
    halfKellyPct,
    var95EUR,
    var99EUR,
    cvarExpectedShortfallEUR,
    calmarRatio,
    ulcerIndex,
    totalRAccumulated,
    avgRWin,
    avgRLoss,
    maxConsecutiveLossesEUR,
    recommendedMaxRiskPerTradeEUR,
  };

  // 7. Segmentació per Classe d'Actiu
  const assetClassMap: Record<InvestmentAssetClass, { label: string; icon: string }> = {
    shares: { label: 'Accions / Borsa', icon: '📈' },
    crypto: { label: 'Criptoactius & DeFi', icon: '🪙' },
    funds: { label: 'Fons d\'Inversió', icon: '🏦' },
    etf: { label: 'ETFs Indexats', icon: '📊' },
    derivatives: { label: 'Derivats & Opcions', icon: '⚡' },
    other: { label: 'Altres Béns', icon: '💎' },
  };

  const assetClasses: AssetClassAnalytics[] = (Object.keys(assetClassMap) as InvestmentAssetClass[]).map(ac => {
    const subset = filtered.filter(t => t.assetClass === ac);
    const count = subset.length;
    const wins = subset.filter(t => t.isWin);
    const losses = subset.filter(t => t.isLoss);
    const gProf = roundCurrency(wins.reduce((s, t) => s + t.pnl, 0));
    const gLoss = roundCurrency(losses.reduce((s, t) => s + Math.abs(t.pnl), 0));
    const net = roundCurrency(gProf - gLoss);
    const vol = roundCurrency(subset.reduce((s, t) => s + (Number(t.transferValue) || 0) + (Number(t.acquisitionValue) || 0), 0));
    const wRate = count > 0 ? roundCurrency((wins.length / count) * 100) : 0;
    const pFact = gLoss > 0 ? roundCurrency(gProf / gLoss) : (gProf > 0 ? 99.9 : 1.0);
    const avgRet = count > 0 ? roundCurrency(subset.reduce((s, t) => s + t.returnPct, 0) / count) : 0;
    const taxDrag = calculateSavingsTaxEUR(Math.max(0, net));

    return {
      assetClass: ac,
      label: assetClassMap[ac].label,
      icon: assetClassMap[ac].icon,
      tradesCount: count,
      grossProfit: gProf,
      grossLoss: gLoss,
      netPnL: net,
      volume: vol,
      winRate: wRate,
      profitFactor: pFact,
      avgReturnPct: avgRet,
      taxDragEUR: taxDrag,
    };
  }).filter(a => a.tradesCount > 0);

  // 8. Segmentació per Estil Temporal (Holding Style)
  const styleMap: Record<TradingHoldingStyle, { label: string; desc: string }> = {
    scalping: { label: 'Intradia / Scalping (< 24h)', desc: 'Operacions d\'alta freqüència amb màxim estrès operatiu i alta comissió.' },
    swing: { label: 'Swing Trading (1-30 dies)', desc: 'Captura de moviments de mercat de curt termini.' },
    positional: { label: 'Posicional (1-12 mesos)', desc: 'Tendències de mitjà termini basades en cicles i fonamentals.' },
    long_term: { label: 'Inversió Llarg Termini (> 1 any)', desc: 'Horizonte temporal d\'acumulació patrimonial amb menor fricció fiscal.' },
  };

  const styles: StyleAnalytics[] = (Object.keys(styleMap) as TradingHoldingStyle[]).map(st => {
    const subset = filtered.filter(t => t.style === st);
    const count = subset.length;
    const wins = subset.filter(t => t.isWin);
    const losses = subset.filter(t => t.isLoss);
    const gProf = roundCurrency(wins.reduce((s, t) => s + t.pnl, 0));
    const gLoss = roundCurrency(losses.reduce((s, t) => s + Math.abs(t.pnl), 0));
    const net = roundCurrency(gProf - gLoss);
    const wRate = count > 0 ? roundCurrency((wins.length / count) * 100) : 0;
    const pFact = gLoss > 0 ? roundCurrency(gProf / gLoss) : (gProf > 0 ? 99.9 : 1.0);
    const avgHold = count > 0 ? Math.round(subset.reduce((s, t) => s + t.holdingDays, 0) / count) : 0;
    const avgPnL = count > 0 ? roundCurrency(net / count) : 0;

    return {
      style: st,
      label: styleMap[st].label,
      description: styleMap[st].desc,
      tradesCount: count,
      netPnL: net,
      winRate: wRate,
      profitFactor: pFact,
      avgHoldingDays: avgHold,
      avgPnLPerTrade: avgPnL,
    };
  }).filter(s => s.tradesCount > 0);

  // 9. Segmentació per Setups
  const setupsMap = new Map<string, EnrichedTradeItem[]>();
  filtered.forEach(t => {
    const s = t.setup || 'Sense Setup';
    if (!setupsMap.has(s)) setupsMap.set(s, []);
    setupsMap.get(s)!.push(t);
  });

  const setups: SetupAnalytics[] = Array.from(setupsMap.entries()).map(([setupName, itemsList]) => {
    const count = itemsList.length;
    const wins = itemsList.filter(t => t.isWin);
    const losses = itemsList.filter(t => t.isLoss);
    const gProf = roundCurrency(wins.reduce((s, t) => s + t.pnl, 0));
    const gLoss = roundCurrency(losses.reduce((s, t) => s + Math.abs(t.pnl), 0));
    const net = roundCurrency(gProf - gLoss);
    const wRate = count > 0 ? roundCurrency((wins.length / count) * 100) : 0;
    const pFact = gLoss > 0 ? roundCurrency(gProf / gLoss) : (gProf > 0 ? 99.9 : 1.0);
    const avgRet = count > 0 ? roundCurrency(itemsList.reduce((s, t) => s + t.returnPct, 0) / count) : 0;
    const avgR = count > 0 ? roundCurrency(itemsList.reduce((s, t) => s + t.rMultiple, 0) / count) : 0;

    return {
      setup: setupName,
      tradesCount: count,
      grossProfit: gProf,
      grossLoss: gLoss,
      netPnL: net,
      winRate: wRate,
      profitFactor: pFact,
      avgReturnPct: avgRet,
      avgRMultiple: avgR,
    };
  }).sort((a, b) => b.netPnL - a.netPnL);

  // 10. Segmentació per Execution Grade
  const gradesList: ('A+' | 'A' | 'B' | 'C' | 'F' | 'Unrated')[] = ['A+', 'A', 'B', 'C', 'F', 'Unrated'];
  const executionGrades: ExecutionGradeAnalytics[] = gradesList.map(gr => {
    const subset = filtered.filter(t => t.executionGrade === gr);
    const count = subset.length;
    const wins = subset.filter(t => t.isWin);
    const losses = subset.filter(t => t.isLoss);
    const gProf = roundCurrency(wins.reduce((s, t) => s + t.pnl, 0));
    const gLoss = roundCurrency(losses.reduce((s, t) => s + Math.abs(t.pnl), 0));
    const net = roundCurrency(gProf - gLoss);
    const wRate = count > 0 ? roundCurrency((wins.length / count) * 100) : 0;
    const pFact = gLoss > 0 ? roundCurrency(gProf / gLoss) : (gProf > 0 ? 99.9 : 1.0);

    return {
      grade: gr,
      tradesCount: count,
      netPnL: net,
      winRate: wRate,
      profitFactor: pFact,
    };
  }).filter(g => g.tradesCount > 0);

  // 11. Mapa de Calor Calendari P&L Diari (365 dies)
  const dailyPnLMap = new Map<string, { count: number; pnl: number }>();
  filtered.forEach(t => {
    const d = t.dateStr || '2024-01-01';
    const cur = dailyPnLMap.get(d) || { count: 0, pnl: 0 };
    cur.count++;
    cur.pnl = roundCurrency(cur.pnl + t.pnl);
    dailyPnLMap.set(d, cur);
  });

  const dailyCalendarHeatmap: DailyPnLEntry[] = Array.from(dailyPnLMap.entries()).map(([dStr, val]) => {
    let intensity = 0;
    const absPnl = Math.abs(val.pnl);
    if (absPnl > 1000) intensity = 4;
    else if (absPnl > 500) intensity = 3;
    else if (absPnl > 100) intensity = 2;
    else if (absPnl > 0) intensity = 1;

    return {
      date: dStr,
      tradesCount: val.count,
      pnl: val.pnl,
      isWinningDay: val.pnl > 0.01,
      isLosingDay: val.pnl < -0.01,
      intensity,
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 12. Rendiment per Dia de la Setmana
  const dayNames = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
  const dayOfWeekAnalytics: DayOfWeekEntry[] = dayNames.map((dName, dIdx) => {
    const subset = filtered.filter(t => t.dayOfWeek === dIdx);
    const count = subset.length;
    const wins = subset.filter(t => t.isWin);
    const losses = subset.filter(t => t.isLoss);
    const gProf = roundCurrency(wins.reduce((s, t) => s + t.pnl, 0));
    const gLoss = roundCurrency(losses.reduce((s, t) => s + Math.abs(t.pnl), 0));
    const net = roundCurrency(gProf - gLoss);
    const wRate = count > 0 ? roundCurrency((wins.length / count) * 100) : 0;
    const pFact = gLoss > 0 ? roundCurrency(gProf / gLoss) : (gProf > 0 ? 99.9 : 1.0);

    return {
      dayName: dName,
      dayIndex: dIdx,
      tradesCount: count,
      netPnL: net,
      winRate: wRate,
      profitFactor: pFact,
    };
  }).filter(d => d.tradesCount > 0);

  // 13. Evolució Multianual (2021-2024+)
  const yearsSet = new Set<number>();
  allEnriched.forEach(t => yearsSet.add(t.year));
  if (yearsSet.size === 0) yearsSet.add(2024);

  const multiYearEvolution: MultiYearEvolutionItem[] = Array.from(yearsSet).sort((a, b) => a - b).map(yr => {
    const subset = allEnriched.filter(t => t.year === yr);
    const count = subset.length;
    const wins = subset.filter(t => t.isWin);
    const losses = subset.filter(t => t.isLoss);
    const gProf = roundCurrency(wins.reduce((s, t) => s + t.pnl, 0));
    const gLoss = roundCurrency(losses.reduce((s, t) => s + Math.abs(t.pnl), 0));
    const net = roundCurrency(gProf - gLoss);
    const vol = roundCurrency(subset.reduce((s, t) => s + (Number(t.transferValue) || 0) + (Number(t.acquisitionValue) || 0), 0));
    const wRate = count > 0 ? roundCurrency((wins.length / count) * 100) : 0;
    const pFact = gLoss > 0 ? roundCurrency(gProf / gLoss) : (gProf > 0 ? 99.9 : 1.0);
    const estTax = calculateSavingsTaxEUR(Math.max(0, net));
    const netAfter = roundCurrency(net - estTax);
    const taxDragPct = net > 0 ? roundCurrency((estTax / net) * 100) : 0;

    return {
      year: yr,
      tradesCount: count,
      volume: vol,
      grossProfit: gProf,
      grossLoss: gLoss,
      netPnL: net,
      winRate: wRate,
      profitFactor: pFact,
      estimatedTaxDue: estTax,
      netAfterTax: netAfter,
      taxDragPct,
    };
  });

  // 14. Diagnòstic Post-Mortem, Biaixos Cognitius i Errors Operatius
  let disciplineScore = 85;
  const criticalMistakes: PostMortemDiagnosis['criticalMistakes'] = [];
  const coachingRecommendations: PostMortemDiagnosis['coachingRecommendations'] = [];
  const kaizenGoldenRules: string[] = [];

  const dispositionEffectRatio = avgHoldingDaysWins > 0 ? roundCurrency(avgHoldingDaysLosses / avgHoldingDaysWins) : 1;
  const hasDispositionEffect = dispositionEffectRatio > 2.0 && losingTrades > 0;
  if (hasDispositionEffect) {
    disciplineScore -= 18;
    criticalMistakes.push({
      title: 'Efecte Disposició Detectat (Holding Asimètric)',
      description: `Mantens les posicions perdedores una mitjana de ${avgHoldingDaysLosses} dies enfront de només ${avgHoldingDaysWins} dies per a les guanyadores (ràtio ${dispositionEffectRatio}x).`,
      impactEUR: roundCurrency(grossLoss * 0.35),
      severity: 'critical',
      remedy: 'Defineix un límit de temps màxim o Stop Loss per preu abans d\'entrar a cada operació.',
    });
    coachingRecommendations.push({
      category: 'Psicologia',
      title: 'Tallar ràpid les pèrdues i deixar córrer els guanys',
      detail: 'La por a consolidar la pèrdua et porta a mantenir actius en caiguda lliure esperant recuperar el preu de compra.',
      actionableStep: 'Utilitza Trailing Stops per assegurar guanys i automatitza la sortida en pèrdues màximes del 5-8%.',
    });
    kaizenGoldenRules.push('Regla d\'Or 1: No mantinguis mai una operació perdedora més de 15 dies sense una tesi fonamental explícita.');
  }

  const hasAsymmetricLossRisk = maxLoss > (avgWin * 3.5) && maxLoss > 200;
  if (hasAsymmetricLossRisk) {
    disciplineScore -= 20;
    criticalMistakes.push({
      title: 'Risc d\'Asimetria de Cua (Pèrdua Desproporcionada)',
      description: `La teva pitjor operació individual (-${maxLoss} €) supera en més de 3.5x el teu guany mitjà (+${avgWin} €), destruint la rendibilitat acumulada de múltiples trades positius.`,
      impactEUR: maxLoss,
      severity: 'critical',
      remedy: 'Cap operació individual hauria de comprometre més de l\'1-2% del teu capital total.',
    });
    coachingRecommendations.push({
      category: 'Gestió del Risc',
      title: 'Mida de Posició (Position Sizing) Estricta',
      detail: 'Una taxa d\'encert alta (> 70%) no serveix de res si un sol error catastròfic s\'emporta els beneficis de mesos.',
      actionableStep: 'Limita el risc màxim per operació al 2% del compte i no augmentis la posició a la baixa (averaging down).',
    });
    kaizenGoldenRules.push(`Regla d'Or 2: Risc màxim per operació limitat a ${recommendedMaxRiskPerTradeEUR} € (1R).`);
  }

  const hasRevengeTrading = maxConsecLosses >= 4 && lossRate > 50;
  if (hasRevengeTrading) {
    disciplineScore -= 12;
    criticalMistakes.push({
      title: 'Ratxes de Pèrdues Consecutives (Revenge Trading)',
      description: `S'ha registrat una ratxa màxima de ${maxConsecLosses} pèrdues consecutives, indicant possible operació impulsiva per recuperar ràpidament el saldo.`,
      impactEUR: roundCurrency(avgLoss * maxConsecLosses),
      severity: 'warning',
      remedy: 'Després de 2 pèrdues seguides en la mateixa sessió o setmana, atura l\'operativa 48 hores.',
    });
    kaizenGoldenRules.push('Regla d\'Or 3: Si acumules 2 pèrdues consecutives el mateix dia, tanca la plataforma i pren-te un descans obligatori.');
  }

  const hasOvertradingFriction = frictionPercentageOfProfits > 30 && totalTrades > 15;
  if (hasOvertradingFriction) {
    disciplineScore -= 10;
    criticalMistakes.push({
      title: 'Fricció d\'Operativa Excessiva (Overtrading)',
      description: `La combinació de comissions (${totalCommissionsAndExpenses} €) i impostos absorbeix el ${frictionPercentageOfProfits}% dels teus guanys bruts.`,
      impactEUR: totalCommissionsAndExpenses,
      severity: 'warning',
      remedy: 'Concentra les teves operacions en menys entrades de major qualitat i major recorregut temporal.',
    });
    coachingRecommendations.push({
      category: 'Tècnica & Timing',
      title: 'Menys trades, millors oportunitats',
      detail: 'Operar amb massa freqüència enriqueix el bròker i la hisenda abans que a l\'inversor.',
      actionableStep: 'Passa d\'un enfocament scalping/intradia a un enfocament swing/posicional de major retorn asimètric.',
    });
    kaizenGoldenRules.push('Regla d\'Or 4: Màxim 3 operacions per setmana per filtrar únicament setups de màxima convicció (A+).');
  }

  const washSaleTrades = filtered.filter(t => t.isWashSaleSuspect);
  const blockedWashSaleLossesEUR = roundCurrency(washSaleTrades.reduce((s, t) => s + Math.abs(t.pnl), 0));
  const hasWashSaleLock = blockedWashSaleLossesEUR > 0;
  if (hasWashSaleLock) {
    criticalMistakes.push({
      title: 'Pèrdues Cautelars Bloquejades (Regla dels 2 Mesos - Art. 33.5 LIRPF)',
      description: `Has venut valors amb pèrdua (${blockedWashSaleLossesEUR} €) i has recomprat títols homogenis en el termini de 2 mesos anteriors o posteriors. L'AEAT no permet restar aquesta pèrdua fins que es transmetin definitivament els nous títols.`,
      impactEUR: calculateSavingsTaxEUR(blockedWashSaleLossesEUR),
      severity: 'warning',
      remedy: 'Espera un mínim de 61 dies naturals abans de recomprar accions venudes en pèrdua per gaudir de la deducció fiscal immediata.',
    });
    coachingRecommendations.push({
      category: 'Optimització Fiscal',
      title: 'Blindatge de la Regla dels 2 Mesos',
      detail: 'L\'Art. 33.5 de la Llei d\'IRPF impedeix computar pèrdues si recompres el mateix actiu dins de la finestra de 2 mesos.',
      actionableStep: 'Per mantenir l\'exposició al mercat sense violar la regla dels 2 mesos, compra un ETF o actiu del mateix sector però no homogeni (ex: vendre Microsoft i comprar un ETF tecnològic).',
    });
    kaizenGoldenRules.push('Regla d\'Or 5: Respecta escrupolosament la finestra de 61 dies després de tancar amb pèrdues per blindar la deducció fiscal.');
  }

  if (kaizenGoldenRules.length === 0) {
    kaizenGoldenRules.push('Regla d\'Or 1: Executa el teu pla de trading sense desviacions emocionals.');
    kaizenGoldenRules.push('Regla d\'Or 2: Registra immediatament cada trade al diari amb el seu setup i qualificació.');
    kaizenGoldenRules.push('Regla d\'Or 3: Prioritza l\'esperança matemàtica positiva per sobre de la taxa d\'encert.');
  }

  disciplineScore = Math.max(10, Math.min(100, disciplineScore));
  let rating: PostMortemDiagnosis['rating'] = 'Rigorós';
  if (disciplineScore >= 90) rating = 'Excel·lent';
  else if (disciplineScore >= 75) rating = 'Rigorós';
  else if (disciplineScore >= 60) rating = 'Acceptable';
  else if (disciplineScore >= 45) rating = 'Millorable';
  else rating = 'Risc Alt';

  const sortedByPnL = [...filtered].sort((a, b) => a.pnl - b.pnl);
  const worstTrades = sortedByPnL.slice(0, 3);
  const bestTrades = sortedByPnL.slice(-3).reverse();

  // 15. Simulacions What-If
  let whatIf5LossSum = 0;
  let whatIf5TradesModified = 0;
  filtered.forEach(t => {
    if (t.isLoss) {
      const acq = Number(t.acquisitionValue) || 0;
      const maxAllowedLoss = acq * 0.05;
      if (Math.abs(t.pnl) > maxAllowedLoss && maxAllowedLoss > 0) {
        whatIf5LossSum += maxAllowedLoss;
        whatIf5TradesModified++;
      } else {
        whatIf5LossSum += Math.abs(t.pnl);
      }
    }
  });
  const whatIf5NetPnL = roundCurrency(grossProfit - whatIf5LossSum);
  const whatIfStrictStopLoss5Pct: WhatIfSimulationResult = {
    currentNetPnL: netPnL,
    simulatedNetPnL: whatIf5NetPnL,
    pnlDifferenceEUR: roundCurrency(whatIf5NetPnL - netPnL),
    simulatedWinRate: winRate,
    simulatedProfitFactor: whatIf5LossSum > 0 ? roundCurrency(grossProfit / whatIf5LossSum) : 99.9,
    tradesModifiedCount: whatIf5TradesModified,
    explanation: `Si haguessis tallat totes les pèrdues de forma sistemàtica al -5%, hauries guanyat +${roundCurrency(whatIf5NetPnL - netPnL)} € addicionals en el conjunt de les teves operacions.`,
  };

  let whatIf8LossSum = 0;
  let whatIf8TradesModified = 0;
  filtered.forEach(t => {
    if (t.isLoss) {
      const acq = Number(t.acquisitionValue) || 0;
      const maxAllowedLoss = acq * 0.08;
      if (Math.abs(t.pnl) > maxAllowedLoss && maxAllowedLoss > 0) {
        whatIf8LossSum += maxAllowedLoss;
        whatIf8TradesModified++;
      } else {
        whatIf8LossSum += Math.abs(t.pnl);
      }
    }
  });
  const whatIf8NetPnL = roundCurrency(grossProfit - whatIf8LossSum);
  const whatIfStrictStopLoss8Pct: WhatIfSimulationResult = {
    currentNetPnL: netPnL,
    simulatedNetPnL: whatIf8NetPnL,
    pnlDifferenceEUR: roundCurrency(whatIf8NetPnL - netPnL),
    simulatedWinRate: winRate,
    simulatedProfitFactor: whatIf8LossSum > 0 ? roundCurrency(grossProfit / whatIf8LossSum) : 99.9,
    tradesModifiedCount: whatIf8TradesModified,
    explanation: `Amb un Stop Loss del -8%, la teva rendibilitat neta hauria augmentat en +${roundCurrency(whatIf8NetPnL - netPnL)} € modificant ${whatIf8TradesModified} operacions.`,
  };

  const whatIfNoWashSales: WhatIfSimulationResult = {
    currentNetPnL: netPnL,
    simulatedNetPnL: roundCurrency(netPnL + calculateSavingsTaxEUR(blockedWashSaleLossesEUR)),
    pnlDifferenceEUR: calculateSavingsTaxEUR(blockedWashSaleLossesEUR),
    simulatedWinRate: winRate,
    simulatedProfitFactor: profitFactor,
    tradesModifiedCount: washSaleTrades.length,
    explanation: hasWashSaleLock
      ? `Esperant 61 dies per recomprar hauries pogut desgravar immediatament ${blockedWashSaleLossesEUR} € de pèrdues, estalviant-te ${calculateSavingsTaxEUR(blockedWashSaleLossesEUR)} € en l'IRPF d'aquest exercici.`
      : `No tens pèrdues bloquejades per la regla dels 2 mesos en aquest període.`,
  };

  return {
    options,
    totalTrades,
    winningTrades,
    losingTrades,
    breakevenTrades,
    winRate,
    lossRate,
    totalVolume,
    grossProfit,
    grossLoss,
    netPnL,
    profitFactor,
    avgTrade,
    avgWin,
    avgLoss,
    payoffRatio,
    expectancyEUR,
    maxWin,
    maxLoss,
    maxConsecutiveWins: maxConsecWins,
    maxConsecutiveLosses: maxConsecLosses,
    maxDrawdownEUR,
    maxDrawdownPct,
    avgHoldingDays,
    avgHoldingDaysWins,
    avgHoldingDaysLosses,
    estimatedTaxSavingsBase,
    effectiveTaxRatePct,
    netPnLAfterTax,
    totalCommissionsAndExpenses,
    totalFrictionEUR,
    frictionPercentageOfProfits,
    sharpeRatio,
    sortinoRatio,
    riskMetrics,
    assetClasses,
    styles,
    setups,
    executionGrades,
    dailyCalendarHeatmap,
    dayOfWeekAnalytics,
    multiYearEvolution,
    equityCurve,
    postMortem: {
      disciplineScore,
      rating,
      dispositionEffectRatio,
      hasDispositionEffect,
      hasRevengeTrading,
      hasAsymmetricLossRisk,
      hasOvertradingFriction,
      hasWashSaleLock,
      blockedWashSaleLossesEUR,
      criticalMistakes,
      worstTrades,
      bestTrades,
      coachingRecommendations,
      kaizenGoldenRules,
    },
    whatIfStrictStopLoss5Pct,
    whatIfStrictStopLoss8Pct,
    whatIfNoWashSales,
    enrichedTrades: filtered,
  };
}
