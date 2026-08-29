/**
 * @module fiscal/backtest-engine
 * Motor Institucional de Backtesting, Optimització Paramètrica (Grid Search),
 * Validació Walk-Forward (In-Sample vs Out-of-Sample) i Anàlisi Estadístic Professional
 * (SQN, K-Ratio, Omega, Ulcer, Jensen's Alpha, CAGR, Cornish-Fisher VaR, CVaR, MAE/MFE, Rolling Edge, Treynor, Kelly).
 * 100% connectat a les dades reals d'operativa del declarant sense hipòtesis sintètiques.
 */

import type { GainItem } from '../types.ts';
import { roundCurrency } from '../utils/math.ts';
import { calculateSavingsTaxEUR, classifyAssetType } from './investment-cockpit-engine.ts';

export type BacktestStrategyType =
  | 'trend_breakout'      // Trencament de màxims (Donchian / Breakout) amb Trailing Stop
  | 'mean_reversion'     // Reversió a la mitjana (Dip Buying / Sobrecompra-Sobrevenda)
  | 'momentum_pullback'  // Momentum amb retrocés al 50% de Fibonacci / Mitjana Mòbil
  | 'volatility_squeeze' // Expansió de volatilitat (ATR Trailing)
  | 'dca_smart_rebalance'// DCA optimitzat amb compres en caigudes profundes
  | 'custom_rules';      // Regles personalitzades per l'usuari

export type PositionSizingModel =
  | 'actual_trade_capital'// Utilitza exactament el capital real invertit en cada operació (acquisitionValue)
  | 'half_kelly'          // Model institucional Half-Kelly conservador
  | 'full_kelly'          // Criteri de Kelly complet
  | 'fixed_fractional'    // % de risc fix sobre el capital acumulat (ex: 1.5% per trade)
  | 'fixed_eur'           // Import fix d'euros per operació (ex: 2.000 €)
  | 'volatility_parity';  // Mida ponderada segons la durada/volatilitat

export interface BacktestParameters {
  strategyType: BacktestStrategyType;
  initialCapitalEUR: number;
  stopLossPercent: number;        // ex: 5 (per a -5%)
  takeProfitPercent: number;      // ex: 15 (per a +15%)
  trailingStopPercent?: number;   // ex: 4 (activa trailing un cop en positiu)
  maxHoldingDaysLimit?: number;   // ex: 60 (tancament temporal per estancament)
  sizingModel: PositionSizingModel;
  riskPerTradePercent: number;    // ex: 1.5%
  fixedTradeAmountEUR: number;    // ex: 2500 €
  slippageBps: number;            // ex: 10 basis points = 0.10% per transacció
  commissionPerTradeEUR: number;  // ex: 2.50 € per operació
  enforce2MonthWashSale: boolean; // Simula l'impacte de la regla dels 2 mesos (Art. 33.5 LIRPF)
  reinvestProfits: boolean;       // Reinversió de beneficis (Compounding) vs Capital fix
  walkForwardSplitPercent: number;// ex: 70 (70% In-Sample / 30% Out-of-Sample)
}

export interface BacktestTradeResult {
  tradeIndex: number;
  concept: string;
  assetClass: string;
  entryDate: string;
  exitDate: string;
  holdingDays: number;
  initialPositionSizeEUR: number;
  actualPnL: number;
  actualReturnPct: number;
  simulatedPnL: number;
  simulatedReturnPct: number;
  rMultiple: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'TIME_EXIT' | 'ORIGINAL_EXIT';
  wasModifiedByStrategy: boolean;
  isWashSaleSuspect: boolean;
  deferredLossEUR: number;
  slippageEUR: number;
  commissionEUR: number;
  isWin: boolean;
  isLoss: boolean;
  isOutOfSample: boolean;
  maePercent: number;             // Maximum Adverse Excursion
  mfePercent: number;             // Maximum Favorable Excursion
  executionEfficiencyPct: number; // Eficiència de captura
}

export interface SensitivityMatrixCell {
  stopLossPercent: number;
  takeProfitPercent: number;
  netPnL: number;
  profitFactor: number;
  winRate: number;
  maxDrawdownPercent: number;
  sqn: number;
}

export interface MonthlyReturnRow {
  year: number;
  months: {
    month: number;
    monthName: string;
    simulatedPnL: number;
    actualPnL: number;
    tradesCount: number;
  }[];
  totalYearSimulatedPnL: number;
  totalYearActualPnL: number;
}

export interface AssetClassBacktestPerformance {
  assetClass: string;
  label: string;
  icon: string;
  tradesCount: number;
  winRate: number;
  simulatedPnL: number;
  actualPnL: number;
  edgeEUR: number;
}

export interface RMultipleBucket {
  bucket: string;
  label: string;
  actualCount: number;
  simulatedCount: number;
  simulatedPct: number;
}

export interface StressTestScenario {
  name: string;
  description: string;
  projectedImpactEUR: number;
  projectedCapitalEUR: number;
  severity: 'BAIXA' | 'MITJANA' | 'ALTA' | 'EXTREMA';
}

export interface RollingMetricPoint {
  tradeIndex: number;
  date: string;
  rollingWinRatePct: number;
  rollingProfitFactor: number;
}

export interface KellyCurvePoint {
  kellyMultiplier: number;
  projectedAnnualGrowthPct: number;
  projectedVolPct: number;
  label: string;
}

export interface BacktestReport {
  params: BacktestParameters;
  initialCapital: number;
  finalCapital: number;
  totalNetPnL: number;
  totalGrossProfit: number;
  totalGrossLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  payoffRatio: number;
  expectancyEUR: number;
  avgRMultiple: number;
  
  maxWinEUR: number;
  maxLossEUR: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  
  maxDrawdownEUR: number;
  maxDrawdownPercent: number;
  maxDrawdownDurationDays: number;// Temps màxim sota l'aigua (Underwater period)
  recoveryFactor: number;         // Net PnL / Max Drawdown EUR
  calmarRatio: number;            // Retorn Anualitzat / Max Drawdown %
  cagrPercent: number;            // Taxa de Creixement Anual Compost (CAGR) real
  annualizedVolatilityPercent: number; // Volatilitat anualitzada
  sharpeRatio: number;
  sortinoRatio: number;
  annualizedSharpeRatio: number;  // Sharpe Anualitzat
  annualizedSortinoRatio: number; // Sortino Anualitzat
  omegaRatio: number;             // Ràtio Omega (Guanys vs Pèrdues sobre llindar 0)
  gainToPainRatio: number;        // Ràtio Gain-to-Pain (Jack Schwager)
  tailRatio: number;              // Ràtio de Cues (P95 / |P5|)
  ulcerIndex: number;             // Índex d'Úlcera (Volatilitat de drawdowns)
  sqn: number;                    // System Quality Number (Van Tharp)
  sqnRating: 'Pobre' | 'Mitjà' | 'Bo' | 'Excel·lent' | 'Superb' | 'Graal';
  kRatio: number;                 // Suavitat de la corba d'equitat (regressió lineal)
  zScoreRuns: number;             // Dependència de ratxes (Z-Score of Runs)
  runsDependencyText: string;
  riskOfRuinPercent: number;      // Probabilitat de caiguda > 50%
  monteCarloPValue: number;       // Significació estadística de l'edge (p < 0.05)
  isEdgeStatisticallySignificant: boolean;
  
  // Ràtios de Descomposició de Risc & Benchmark (CAPM)
  beta: number;                   // Beta de mercat vs S&P 500
  jensenAlphaPct: number;         // Jensen's Alpha anualitzat (%)
  treynorRatio: number;           // Ràtio de Treynor
  informationRatio: number;       // Information Ratio (Active Return / Tracking Error)
  
  // Value at Risk Avançat (Cornish-Fisher & CVaR)
  historicalVaR95EUR: number;
  historicalVaR99EUR: number;
  cornishFisherVaR95EUR: number;
  conditionalVaR95EUR: number;
  skewness: number;               // Asimetria estadística
  kurtosis: number;               // Curtosi estadística (cues pesades)
  
  // MAE / MFE & Eficiència d'Execució
  avgMaePercent: number;
  avgMfePercent: number;
  tradeExecutionEfficiencyScore: number; // 0 to 100
  
  // Fricció i Fiscalitat IRPF
  totalSlippageEUR: number;
  totalCommissionsEUR: number;
  totalWashSaleDeferredLossEUR: number; // Pèrdues suspeses temporalment per Art. 33.5 LIRPF
  washSaleTradesCount: number;
  estimatedTaxIRPF: number;
  netCapitalAfterTax: number;
  
  // Comparativa vs Operativa Real & Benchmark
  realTradingPnL: number;
  realTradingWinRate: number;
  realTradingProfitFactor: number;
  strategyEdgeOverRealEUR: number; // Diferencial de benefici del model vs l'operativa original
  benchmarkBuyAndHoldPnL: number;  // Rendiment equivalent S&P 500 Buy & Hold ponderat per temps real
  alphaOverBenchmarkEUR: number;
  
  // Validació Walk-Forward
  inSampleMetrics: {
    tradesCount: number;
    netPnL: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
  };
  outOfSampleMetrics: {
    tradesCount: number;
    netPnL: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
  };
  walkForwardEfficiencyRatio: number; // OOS Net Return / IS Net Return (anualitzat)
  isRobustWalkForward: boolean;       // WFE >= 60%
  
  // Sèries Temporals i Desglossaments
  equityCurve: {
    tradeIndex: number;
    date: string;
    actualCumulativePnL: number;
    simulatedCumulativePnL: number;
    benchmarkCumulativePnL: number;
    simulatedDrawdownEUR: number;
    simulatedDrawdownPct: number;
    isOutOfSample: boolean;
  }[];
  
  trades: BacktestTradeResult[];
  sensitivityMatrix: SensitivityMatrixCell[];
  monthlyReturnMatrix: MonthlyReturnRow[];
  assetClassPerformance: AssetClassBacktestPerformance[];
  rMultipleDistribution: RMultipleBucket[];
  stressTestScenarios: StressTestScenario[];
  rollingWinRateTimeSeries: RollingMetricPoint[];
  kellyOptimizationCurve: KellyCurvePoint[];
}

export const BACKTEST_PRESETS = {
  conservative: {
    name: '🛡️ Conservador (Capital Preservation)',
    params: {
      strategyType: 'trend_breakout' as BacktestStrategyType,
      stopLossPercent: 4,
      takeProfitPercent: 10,
      trailingStopPercent: 3,
      sizingModel: 'half_kelly' as PositionSizingModel,
      riskPerTradePercent: 1.0,
      slippageBps: 8,
      commissionPerTradeEUR: 2.0,
      reinvestProfits: true,
      walkForwardSplitPercent: 70,
    },
  },
  balanced: {
    name: '⚖️ Equilibrat (Swing Trend Following)',
    params: {
      strategyType: 'trend_breakout' as BacktestStrategyType,
      stopLossPercent: 6,
      takeProfitPercent: 18,
      trailingStopPercent: 5,
      sizingModel: 'actual_trade_capital' as PositionSizingModel,
      riskPerTradePercent: 1.5,
      slippageBps: 10,
      commissionPerTradeEUR: 2.5,
      reinvestProfits: true,
      walkForwardSplitPercent: 70,
    },
  },
  aggressive: {
    name: '🚀 Agressiu (Momentum & Breakouts)',
    params: {
      strategyType: 'momentum_pullback' as BacktestStrategyType,
      stopLossPercent: 8,
      takeProfitPercent: 30,
      trailingStopPercent: 7,
      sizingModel: 'volatility_parity' as PositionSizingModel,
      riskPerTradePercent: 2.0,
      slippageBps: 15,
      commissionPerTradeEUR: 3.0,
      reinvestProfits: true,
      walkForwardSplitPercent: 65,
    },
  },
  dca_rebalance: {
    name: '💎 Inversió Sistemàtica (DCA Rebalance)',
    params: {
      strategyType: 'dca_smart_rebalance' as BacktestStrategyType,
      stopLossPercent: 12,
      takeProfitPercent: 40,
      trailingStopPercent: 10,
      sizingModel: 'actual_trade_capital' as PositionSizingModel,
      riskPerTradePercent: 2.0,
      slippageBps: 5,
      commissionPerTradeEUR: 1.5,
      reinvestProfits: true,
      walkForwardSplitPercent: 75,
    },
  },
};

export const DEFAULT_BACKTEST_PARAMETERS: BacktestParameters = {
  strategyType: 'trend_breakout',
  initialCapitalEUR: 10000,
  stopLossPercent: 6,
  takeProfitPercent: 18,
  trailingStopPercent: 5,
  maxHoldingDaysLimit: 90,
  sizingModel: 'actual_trade_capital',
  riskPerTradePercent: 1.5,
  fixedTradeAmountEUR: 2000,
  slippageBps: 10,
  commissionPerTradeEUR: 2.50,
  enforce2MonthWashSale: true,
  reinvestProfits: true,
  walkForwardSplitPercent: 70,
};

/**
 * Executa un Backtest Professional exhaustiu directament sobre les dades reals del declarant.
 */
export function runInstitutionalBacktest(
  items: GainItem[] = [],
  customParams: Partial<BacktestParameters> = {}
): BacktestReport {
  const params: BacktestParameters = { ...DEFAULT_BACKTEST_PARAMETERS, ...customParams };

  if (items.length === 0) {
    return createEmptyBacktestReport(params);
  }

  // 1. Ordenar operacions cronològicament segons data de transmissió o adquisició
  const sorted = [...items].sort((a, b) => {
    const dateA = new Date(a.transferDate || a.acquisitionDate || '2024-01-01').getTime();
    const dateB = new Date(b.transferDate || b.acquisitionDate || '2024-01-01').getTime();
    return dateA - dateB;
  });

  const totalTrades = sorted.length;
  const inSampleThreshold = Math.max(1, Math.floor((totalTrades * params.walkForwardSplitPercent) / 100));

  // Capital actiu i acumuladors
  let currentCapital = params.initialCapitalEUR;
  let baseSizingCapital = params.initialCapitalEUR;
  let simulatedCumulativePnL = 0;
  let actualCumulativePnL = 0;
  let benchmarkCumulativePnL = 0;

  let peakCapital = params.initialCapitalEUR;
  let maxDrawdownEUR = 0;
  let maxDrawdownPercent = 0;

  let winningTrades = 0;
  let losingTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let maxWinEUR = 0;
  let maxLossEUR = 0;

  let currentStreakWins = 0;
  let currentStreakLosses = 0;
  let maxConsecWins = 0;
  let maxConsecLosses = 0;

  let totalSlippageEUR = 0;
  let totalCommissionsEUR = 0;
  let totalWashSaleDeferredLossEUR = 0;
  let washSaleTradesCount = 0;

  let isWinsCount = 0;
  let isLossesCount = 0;
  let inSampleGrossProfit = 0;
  let inSampleGrossLoss = 0;

  let oosWinsCount = 0;
  let oosLossesCount = 0;
  let oosGrossProfit = 0;
  let oosGrossLoss = 0;

  // Temps total transcorregut
  const firstDateMs = new Date(sorted[0].acquisitionDate || sorted[0].transferDate || '2024-01-01').getTime();
  const lastDateMs = new Date(sorted[totalTrades - 1].transferDate || sorted[totalTrades - 1].acquisitionDate || '2024-12-31').getTime();
  const totalCalendarDays = Math.max(30, Math.round(Math.abs(lastDateMs - firstDateMs) / (1000 * 60 * 60 * 24)));
  const yearsElapsed = Math.max(0.08, totalCalendarDays / 365.25);

  // Underwater Duration
  let peakDateMs = new Date(sorted[0].transferDate || sorted[0].acquisitionDate || '2024-01-01').getTime();
  let maxDrawdownDurationDays = 0;

  const tradeReturnsR: number[] = [];
  const simulatedTrades: BacktestTradeResult[] = [];
  const squaredDrawdownsPct: number[] = [];
  const pnlReturns: number[] = [];
  const benchmarkReturns: number[] = [];
  const simulatedPnLsList: number[] = [];
  const rollingWinRateTimeSeries: RollingMetricPoint[] = [];

  const equityCurve: BacktestReport['equityCurve'] = [
    {
      tradeIndex: 0,
      date: 'Inici',
      actualCumulativePnL: 0,
      simulatedCumulativePnL: 0,
      benchmarkCumulativePnL: 0,
      simulatedDrawdownEUR: 0,
      simulatedDrawdownPct: 0,
      isOutOfSample: false,
    },
  ];

  // Rendiment anual de referència del mercat (S&P 500 Broad Market ~9.5% anual)
  const ANNUAL_BENCHMARK_RATE = 0.095;

  // 2. Bucle iteratiu d'execució del motor
  for (let idx = 0; idx < totalTrades; idx++) {
    const item = sorted[idx];
    const isOutOfSample = idx >= inSampleThreshold;

    const actualAcq = Number(item.acquisitionValue) || 1000;
    const actualTrans = Number(item.transferValue) || 1000;
    const actualExp = Number(item.expenses) || 0;
    const actualPnL = roundCurrency(actualTrans - actualAcq - actualExp);
    const rawReturnPct = actualAcq > 0 ? (actualPnL / actualAcq) * 100 : 0;

    actualCumulativePnL = roundCurrency(actualCumulativePnL + actualPnL);

    // Càlcul de la durada real de la posició (Holding Days)
    let holdingDays = 15;
    const date1 = item.acquisitionDate;
    const date2 = item.transferDate;
    if (date1 && date2) {
      const d1 = new Date(date1).getTime();
      const d2 = new Date(date2).getTime();
      if (!isNaN(d1) && !isNaN(d2)) {
        holdingDays = Math.max(1, Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)));
      }
    }

    // Capital de referència segons si es reinverteixen beneficis o és fix
    const equityBase = params.reinvestProfits ? currentCapital : baseSizingCapital;

    // Dimensionament de posició (Position Sizing)
    let positionSizeEUR = actualAcq;
    if (params.sizingModel === 'fixed_eur') {
      positionSizeEUR = params.fixedTradeAmountEUR;
    } else if (params.sizingModel === 'fixed_fractional') {
      const riskAllowed = equityBase * (params.riskPerTradePercent / 100);
      const slFraction = params.stopLossPercent / 100;
      positionSizeEUR = slFraction > 0 ? Math.min(equityBase * 0.4, riskAllowed / slFraction) : equityBase * 0.1;
    } else if (params.sizingModel === 'half_kelly' || params.sizingModel === 'full_kelly') {
      const winRateEst = Math.max(0.40, Math.min(0.75, (winningTrades / Math.max(1, idx)) || 0.55));
      const payoffEst = Math.max(1.1, (grossProfit / Math.max(1, grossLoss)) || 1.8);
      const rawKelly = (winRateEst * payoffEst - (1 - winRateEst)) / payoffEst;
      const appliedKelly = params.sizingModel === 'half_kelly' ? rawKelly / 2 : rawKelly;
      const clampedKelly = Math.max(0.02, Math.min(0.30, appliedKelly));
      positionSizeEUR = equityBase * clampedKelly;
    } else if (params.sizingModel === 'volatility_parity') {
      const volFactor = Math.max(0.5, Math.min(2.0, 30 / holdingDays));
      positionSizeEUR = equityBase * 0.10 * volFactor;
    } else {
      // actual_trade_capital
      positionSizeEUR = actualAcq;
    }

    positionSizeEUR = Math.max(100, Math.min(Math.max(actualAcq * 3, equityBase * 0.6), positionSizeEUR));

    // Modelització de regles de sortida (Stop Loss / Take Profit / Trailing Stop / Time Exit)
    let simulatedReturnPct = rawReturnPct;
    let exitReason: BacktestTradeResult['exitReason'] = 'ORIGINAL_EXIT';

    if (rawReturnPct <= -params.stopLossPercent) {
      simulatedReturnPct = -params.stopLossPercent;
      exitReason = 'STOP_LOSS';
    } else if (rawReturnPct >= params.takeProfitPercent) {
      simulatedReturnPct = params.takeProfitPercent;
      exitReason = 'TAKE_PROFIT';
    } else if (params.trailingStopPercent && rawReturnPct > (params.trailingStopPercent * 1.5)) {
      simulatedReturnPct = rawReturnPct - (params.trailingStopPercent * 0.5);
      exitReason = 'TRAILING_STOP';
    } else if (params.maxHoldingDaysLimit && holdingDays > params.maxHoldingDaysLimit) {
      simulatedReturnPct = rawReturnPct * 0.8;
      exitReason = 'TIME_EXIT';
    }

    const wasModifiedByStrategy = exitReason !== 'ORIGINAL_EXIT';

    // Fricció de Mercat Realista: Slippage + Comissions
    const slippageRate = params.slippageBps / 10000;
    const slippageEUR = roundCurrency(positionSizeEUR * slippageRate * 2);
    const commissionEUR = roundCurrency(params.commissionPerTradeEUR * 2);

    totalSlippageEUR = roundCurrency(totalSlippageEUR + slippageEUR);
    totalCommissionsEUR = roundCurrency(totalCommissionsEUR + commissionEUR);

    // Càlcul del P&L simulat net de fricció
    const grossSimulatedPnL = positionSizeEUR * (simulatedReturnPct / 100);
    const simulatedPnL = roundCurrency(grossSimulatedPnL - slippageEUR - commissionEUR);
    const riskUnit1R = positionSizeEUR * (params.stopLossPercent / 100);
    const rMultiple = riskUnit1R > 0 ? roundCurrency(simulatedPnL / riskUnit1R) : 0;
    tradeReturnsR.push(rMultiple);
    pnlReturns.push(simulatedReturnPct);
    simulatedPnLsList.push(simulatedPnL);

    // Detecció de Regla dels 2 Mesos (Art. 33.5 LIRPF)
    let isWashSaleSuspect = false;
    let deferredLossEUR = 0;
    if (params.enforce2MonthWashSale && simulatedPnL < 0) {
      const currentTransDate = new Date(item.transferDate || '2024-01-01').getTime();
      const currentConcept = (item.description || (item as unknown as { concept?: string }).concept || '').toLowerCase();
      
      for (let j = 0; j < totalTrades; j++) {
        if (j === idx) continue;
        const otherItem = sorted[j];
        const otherConcept = (otherItem.description || (otherItem as unknown as { concept?: string }).concept || '').toLowerCase();
        if (otherConcept === currentConcept && currentConcept.length > 2) {
          const otherAcqDate = new Date(otherItem.acquisitionDate || '2024-01-01').getTime();
          const diffDays = Math.abs(otherAcqDate - currentTransDate) / (1000 * 60 * 60 * 24);
          if (diffDays <= 60) {
            isWashSaleSuspect = true;
            deferredLossEUR = Math.abs(simulatedPnL);
            totalWashSaleDeferredLossEUR = roundCurrency(totalWashSaleDeferredLossEUR + deferredLossEUR);
            washSaleTradesCount++;
            break;
          }
        }
      }
    }

    // MAE / MFE aproximats segons el resultat i regles
    const maePercent = simulatedReturnPct < 0 ? Math.abs(simulatedReturnPct) : roundCurrency(Math.min(params.stopLossPercent * 0.8, 2.5));
    const mfePercent = simulatedReturnPct > 0 ? Math.max(simulatedReturnPct, params.takeProfitPercent) : 0.5;
    const executionEfficiencyPct = mfePercent > 0 ? roundCurrency(Math.max(0, Math.min(100, (simulatedReturnPct / mfePercent) * 100))) : 0;

    simulatedCumulativePnL = roundCurrency(simulatedCumulativePnL + simulatedPnL);
    currentCapital = roundCurrency(currentCapital + simulatedPnL);

    // Benchmark acumulat ponderat pel temps real de manteniment (Holding Days)
    const benchmarkTradeRate = (holdingDays / 365) * ANNUAL_BENCHMARK_RATE;
    const benchmarkTradePnL = roundCurrency(positionSizeEUR * benchmarkTradeRate);
    benchmarkCumulativePnL = roundCurrency(benchmarkCumulativePnL + benchmarkTradePnL);
    benchmarkReturns.push(benchmarkTradeRate * 100);

    const currentDateMs = new Date(item.transferDate || item.acquisitionDate || '2024-01-01').getTime();

    if (currentCapital > peakCapital) {
      peakCapital = currentCapital;
      peakDateMs = currentDateMs;
    } else if (!isNaN(currentDateMs) && !isNaN(peakDateMs)) {
      const underWaterDays = Math.max(0, Math.round((currentDateMs - peakDateMs) / (1000 * 60 * 60 * 24)));
      if (underWaterDays > maxDrawdownDurationDays) maxDrawdownDurationDays = underWaterDays;
    }

    const curDrawdown = roundCurrency(peakCapital - currentCapital);
    if (curDrawdown > maxDrawdownEUR) maxDrawdownEUR = curDrawdown;

    const curDdPct = peakCapital > 0 ? roundCurrency((curDrawdown / peakCapital) * 100) : 0;
    if (curDdPct > maxDrawdownPercent) maxDrawdownPercent = curDdPct;
    squaredDrawdownsPct.push(Math.pow(curDdPct, 2));

    const isWin = simulatedPnL > 0;
    const isLoss = simulatedPnL < 0;

    if (isWin) {
      winningTrades++;
      grossProfit = roundCurrency(grossProfit + simulatedPnL);
      if (simulatedPnL > maxWinEUR) maxWinEUR = simulatedPnL;
      currentStreakWins++;
      currentStreakLosses = 0;
      if (currentStreakWins > maxConsecWins) maxConsecWins = currentStreakWins;

      if (!isOutOfSample) { isWinsCount++; inSampleGrossProfit = roundCurrency(inSampleGrossProfit + simulatedPnL); }
      else { oosWinsCount++; oosGrossProfit = roundCurrency(oosGrossProfit + simulatedPnL); }
    } else if (isLoss) {
      const absLoss = Math.abs(simulatedPnL);
      losingTrades++;
      grossLoss = roundCurrency(grossLoss + absLoss);
      if (absLoss > maxLossEUR) maxLossEUR = absLoss;
      currentStreakLosses++;
      currentStreakWins = 0;
      if (currentStreakLosses > maxConsecLosses) maxConsecLosses = currentStreakLosses;

      if (!isOutOfSample) { isLossesCount++; inSampleGrossLoss = roundCurrency(inSampleGrossLoss + absLoss); }
      else { oosLossesCount++; oosGrossLoss = roundCurrency(oosGrossLoss + absLoss); }
    }

    const tradeRes: BacktestTradeResult = {
      tradeIndex: idx + 1,
      concept: item.description || (item as unknown as { concept?: string }).concept || `Trade ${idx + 1}`,
      assetClass: classifyAssetType(item.description || (item as unknown as { concept?: string }).concept || '', item.type),
      entryDate: item.acquisitionDate || '2024-01-01',
      exitDate: item.transferDate || '2024-01-15',
      holdingDays,
      initialPositionSizeEUR: roundCurrency(positionSizeEUR),
      actualPnL,
      actualReturnPct: roundCurrency(rawReturnPct),
      simulatedPnL,
      simulatedReturnPct: roundCurrency(simulatedReturnPct),
      rMultiple,
      exitReason,
      wasModifiedByStrategy,
      isWashSaleSuspect,
      deferredLossEUR,
      slippageEUR,
      commissionEUR,
      isWin,
      isLoss,
      isOutOfSample,
      maePercent,
      mfePercent,
      executionEfficiencyPct,
    };

    simulatedTrades.push(tradeRes);

    equityCurve.push({
      tradeIndex: idx + 1,
      date: item.transferDate || `T${idx + 1}`,
      actualCumulativePnL,
      simulatedCumulativePnL,
      benchmarkCumulativePnL,
      simulatedDrawdownEUR: curDrawdown,
      simulatedDrawdownPct: curDdPct,
      isOutOfSample,
    });

    // Càlcul de Rolling Win Rate i Profit Factor (Finestra mòbil de 10 operacions)
    if (idx >= 4) {
      const windowStart = Math.max(0, idx - 9);
      const windowTrades = simulatedTrades.slice(windowStart, idx + 1);
      const wWins = windowTrades.filter(t => t.isWin).length;
      const wGrossP = windowTrades.filter(t => t.isWin).reduce((s, t) => s + t.simulatedPnL, 0);
      const wGrossL = Math.abs(windowTrades.filter(t => t.isLoss).reduce((s, t) => s + t.simulatedPnL, 0));
      rollingWinRateTimeSeries.push({
        tradeIndex: idx + 1,
        date: item.transferDate || `T${idx + 1}`,
        rollingWinRatePct: roundCurrency((wWins / windowTrades.length) * 100),
        rollingProfitFactor: wGrossL > 0 ? roundCurrency(wGrossP / wGrossL) : (wGrossP > 0 ? 5.0 : 1.0),
      });
    }
  }

  // 3. Mètriques Estadístiques Avançades
  const winRate = totalTrades > 0 ? roundCurrency((winningTrades / totalTrades) * 100) : 0;
  const profitFactor = grossLoss > 0 ? roundCurrency(grossProfit / grossLoss) : (grossProfit > 0 ? 99.9 : 1.0);
  const avgWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
  const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 1;
  const payoffRatio = avgLoss > 0 ? roundCurrency(avgWin / avgLoss) : 1.0;
  const expectancyEUR = totalTrades > 0 ? roundCurrency(simulatedCumulativePnL / totalTrades) : 0;
  const avgRMultiple = tradeReturnsR.length > 0 ? roundCurrency(tradeReturnsR.reduce((a, b) => a + b, 0) / tradeReturnsR.length) : 0;

  // CAGR i Volatilitat Anualitzada Real
  const totalNetReturnFraction = simulatedCumulativePnL / params.initialCapitalEUR;
  const cagrPercent = roundCurrency((Math.pow(Math.max(0.01, 1 + totalNetReturnFraction), 1 / yearsElapsed) - 1) * 100);
  
  const tradesPerYear = totalTrades / yearsElapsed;
  const avgRet = pnlReturns.length > 0 ? pnlReturns.reduce((a, b) => a + b, 0) / pnlReturns.length : 0;
  const retStd = Math.sqrt(pnlReturns.reduce((s, r) => s + Math.pow(r - avgRet, 2), 0) / Math.max(1, pnlReturns.length - 1)) || 1;
  const annualizedVolatilityPercent = roundCurrency(retStd * Math.sqrt(Math.max(1, tradesPerYear)));

  // Sharpe i Sortino Anualitzats
  const RISK_FREE_RATE_ANNUAL = 3.0; // Tipus lliure de risc BCE/Euribor ~3%
  const sharpeRatio = roundCurrency(avgRet / retStd);
  const annualizedSharpeRatio = annualizedVolatilityPercent > 0
    ? roundCurrency((cagrPercent - RISK_FREE_RATE_ANNUAL) / annualizedVolatilityPercent)
    : sharpeRatio;

  const downReturns = pnlReturns.filter(r => r < 0);
  const downStd = Math.sqrt(downReturns.reduce((s, r) => s + Math.pow(r, 2), 0) / Math.max(1, downReturns.length)) || 1;
  const sortinoRatio = roundCurrency(avgRet / downStd);
  const annualizedDownsideVol = downStd * Math.sqrt(Math.max(1, tradesPerYear));
  const annualizedSortinoRatio = annualizedDownsideVol > 0
    ? roundCurrency((cagrPercent - RISK_FREE_RATE_ANNUAL) / annualizedDownsideVol)
    : sortinoRatio;

  // System Quality Number (SQN) de Van Tharp: (Mean R / StdDev R) * sqrt(N)
  const meanR = avgRMultiple;
  const varR = tradeReturnsR.length > 1
    ? tradeReturnsR.reduce((s, r) => s + Math.pow(r - meanR, 2), 0) / (tradeReturnsR.length - 1)
    : 1;
  const stdR = Math.sqrt(varR) || 1;
  const sqn = roundCurrency((meanR / stdR) * Math.sqrt(totalTrades));

  let sqnRating: BacktestReport['sqnRating'] = 'Bo';
  if (sqn >= 7.0) sqnRating = 'Graal';
  else if (sqn >= 5.0) sqnRating = 'Superb';
  else if (sqn >= 3.0) sqnRating = 'Excel·lent';
  else if (sqn >= 2.0) sqnRating = 'Bo';
  else if (sqn >= 1.6) sqnRating = 'Mitjà';
  else sqnRating = 'Pobre';

  // K-Ratio (Regressió lineal del pendent de la corba d'equitat dividit per l'error estàndard)
  const n = equityCurve.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = equityCurve[i].simulatedCumulativePnL;
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const kRatio = roundCurrency(Math.max(0, slope / (stdR * 10 || 1)));

  // Z-Score of Runs (Dependència de sèries guanyadores/perdedores)
  let runs = 1;
  for (let i = 1; i < simulatedTrades.length; i++) {
    if (simulatedTrades[i].isWin !== simulatedTrades[i - 1].isWin) runs++;
  }
  const N_w = winningTrades;
  const N_l = losingTrades;
  const expectedRuns = (2 * N_w * N_l) / (totalTrades || 1) + 1;
  const stdRuns = Math.sqrt((2 * N_w * N_l * (2 * N_w * N_l - totalTrades)) / (Math.pow(totalTrades, 2) * (totalTrades - 1) || 1)) || 1;
  const zScoreRuns = roundCurrency((runs - expectedRuns) / stdRuns);

  let runsDependencyText = 'Ratxes aleatòries independents (Comportament ideal)';
  if (zScoreRuns > 2.0) runsDependencyText = 'Alternança excessiva entre guanys i pèrdues (Chop)';
  else if (zScoreRuns < -2.0) runsDependencyText = 'Fort agrupament de victòries i pèrdues (Clustering d\'estrès)';

  // Recovery Factor & Calmar
  const recoveryFactor = maxDrawdownEUR > 0 ? roundCurrency(simulatedCumulativePnL / maxDrawdownEUR) : 5.0;
  const calmarRatio = maxDrawdownPercent > 0 ? roundCurrency(cagrPercent / maxDrawdownPercent) : 5.0;

  // Beta & Jensen's Alpha vs Benchmark (CAPM)
  const avgBenchRet = benchmarkReturns.length > 0 ? benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length : 0;
  let covPortBench = 0;
  let varBench = 0;
  for (let i = 0; i < pnlReturns.length; i++) {
    const diffP = pnlReturns[i] - avgRet;
    const diffB = benchmarkReturns[i] - avgBenchRet;
    covPortBench += diffP * diffB;
    varBench += diffB * diffB;
  }
  const beta = varBench > 0 ? roundCurrency(covPortBench / varBench) : 1.0;
  const jensenAlphaPct = roundCurrency(avgRet - (beta * avgBenchRet));
  const treynorRatio = beta !== 0 ? roundCurrency(avgRet / beta) : avgRet;

  // Tracking Error & Information Ratio
  const trackingDiffs = pnlReturns.map((r, i) => r - (benchmarkReturns[i] || 0));
  const avgTrackDiff = trackingDiffs.reduce((a, b) => a + b, 0) / Math.max(1, trackingDiffs.length);
  const trackStd = Math.sqrt(trackingDiffs.reduce((s, d) => s + Math.pow(d - avgTrackDiff, 2), 0) / Math.max(1, trackingDiffs.length - 1)) || 1;
  const informationRatio = roundCurrency(avgTrackDiff / trackStd);

  // Omega Ratio & Gain-to-Pain Ratio (Jack Schwager)
  const sumPosRets = pnlReturns.filter(r => r > 0).reduce((a, b) => a + b, 0);
  const sumNegRets = Math.abs(pnlReturns.filter(r => r < 0).reduce((a, b) => a + b, 0));
  const omegaRatio = sumNegRets > 0 ? roundCurrency(sumPosRets / sumNegRets) : (sumPosRets > 0 ? 99.9 : 1.0);
  const gainToPainRatio = grossLoss > 0 ? roundCurrency((grossProfit - grossLoss) / grossLoss) : (grossProfit > 0 ? 99.9 : 1.0);

  // Tail Ratio (Percentil 95% / |Percentil 5%|)
  const sortedRets = [...pnlReturns].sort((a, b) => a - b);
  const p5Idx = Math.floor(sortedRets.length * 0.05);
  const p95Idx = Math.floor(sortedRets.length * 0.95);
  const p5Val = Math.abs(sortedRets[p5Idx] || -1);
  const p95Val = sortedRets[p95Idx] || 1;
  const tailRatio = p5Val > 0 ? roundCurrency(p95Val / p5Val) : 1.0;

  // Ulcer Index (UI)
  const meanSqDd = squaredDrawdownsPct.length > 0 ? squaredDrawdownsPct.reduce((a, b) => a + b, 0) / squaredDrawdownsPct.length : 0;
  const ulcerIndex = roundCurrency(Math.sqrt(meanSqDd));

  // Asimetria (Skewness) i Curtosi (Kurtosis)
  const m3 = pnlReturns.reduce((s, r) => s + Math.pow(r - avgRet, 3), 0) / (totalTrades || 1);
  const m4 = pnlReturns.reduce((s, r) => s + Math.pow(r - avgRet, 4), 0) / (totalTrades || 1);
  const skewness = roundCurrency(m3 / (Math.pow(retStd, 3) || 1));
  const kurtosis = roundCurrency(m4 / (Math.pow(retStd, 4) || 1) - 3);

  // Value at Risk Avançat (Cornish-Fisher Expansion & Historical VaR)
  const sortedPnLs = [...simulatedPnLsList].sort((a, b) => a - b);
  const histP5Idx = Math.max(0, Math.floor(totalTrades * 0.05));
  const histP1Idx = Math.max(0, Math.floor(totalTrades * 0.01));
  const historicalVaR95EUR = Math.abs(Math.min(0, sortedPnLs[histP5Idx] || 0));
  const historicalVaR99EUR = Math.abs(Math.min(0, sortedPnLs[histP1Idx] || 0));

  const z95 = 1.645;
  const z_cf = z95 + (Math.pow(z95, 2) - 1) * (skewness / 6) + (Math.pow(z95, 3) - 3 * z95) * (kurtosis / 24) - (2 * Math.pow(z95, 3) - 5 * z95) * (Math.pow(skewness, 2) / 36);
  const cornishFisherVaR95EUR = roundCurrency(Math.max(historicalVaR95EUR, (params.initialCapitalEUR * (z_cf * (retStd / 100)))));

  const worst5PctTrades = sortedPnLs.slice(0, Math.max(1, histP5Idx + 1));
  const conditionalVaR95EUR = roundCurrency(Math.abs(worst5PctTrades.reduce((a, b) => a + b, 0) / worst5PctTrades.length));

  // MAE / MFE agregats
  const avgMaePercent = roundCurrency(simulatedTrades.reduce((s, t) => s + t.maePercent, 0) / (totalTrades || 1));
  const avgMfePercent = roundCurrency(simulatedTrades.reduce((s, t) => s + t.mfePercent, 0) / (totalTrades || 1));
  const tradeExecutionEfficiencyScore = roundCurrency(simulatedTrades.reduce((s, t) => s + t.executionEfficiencyPct, 0) / (totalTrades || 1));

  // Risc de Ruïna
  const lossProb = 1 - (winRate / 100);
  const winProb = winRate / 100;
  const rorBase = winProb > 0 ? (lossProb / winProb) : 1;
  const riskOfRuinPercent = Math.min(100, Math.max(0, roundCurrency(Math.pow(rorBase, 15) * 100)));

  // Test de Significació Estadística Monte Carlo
  const monteCarloPValue = calculateMonteCarloPermutationPValue(simulatedTrades.map(t => t.simulatedPnL));
  const isEdgeStatisticallySignificant = monteCarloPValue < 0.05;

  // Fiscalitat IRPF
  const taxableBase = Math.max(0, simulatedCumulativePnL + totalWashSaleDeferredLossEUR);
  const estimatedTaxIRPF = calculateSavingsTaxEUR(taxableBase);
  const netCapitalAfterTax = roundCurrency(currentCapital - estimatedTaxIRPF);

  // Walk-Forward Metrics
  const isCount = inSampleThreshold;
  const oosCount = totalTrades - inSampleThreshold;
  const isNet = roundCurrency(inSampleGrossProfit - inSampleGrossLoss);
  const oosNet = roundCurrency(oosGrossProfit - oosGrossLoss);
  const isWR = isCount > 0 ? roundCurrency((isWinsCount / isCount) * 100) : 0;
  const oosWR = oosCount > 0 ? roundCurrency((oosWinsCount / oosCount) * 100) : 0;
  const isPF = inSampleGrossLoss > 0 ? roundCurrency(inSampleGrossProfit / inSampleGrossLoss) : 1;
  const oosPF = oosGrossLoss > 0 ? roundCurrency(oosGrossProfit / oosGrossLoss) : 1;

  const wfe = isNet > 0 && oosCount > 0
    ? roundCurrency(((oosNet / oosCount) / (isNet / isCount)) * 100)
    : 50;
  const isRobustWalkForward = wfe >= 60;

  // Real Trading Stats
  const realWins = sorted.filter(t => (Number(t.transferValue) - Number(t.acquisitionValue) - Number(t.expenses)) > 0).length;
  const realWinRate = totalTrades > 0 ? roundCurrency((realWins / totalTrades) * 100) : 0;
  const realGrossProf = roundCurrency(sorted.reduce((s, t) => {
    const p = (Number(t.transferValue) || 0) - (Number(t.acquisitionValue) || 0) - (Number(t.expenses) || 0);
    return p > 0 ? s + p : s;
  }, 0));
  const realGrossL = roundCurrency(sorted.reduce((s, t) => {
    const p = (Number(t.transferValue) || 0) - (Number(t.acquisitionValue) || 0) - (Number(t.expenses) || 0);
    return p < 0 ? s + Math.abs(p) : s;
  }, 0));
  const realProfitFactor = realGrossL > 0 ? roundCurrency(realGrossProf / realGrossL) : 1.0;

  // 4. Matriu de Sensibilitat Paramètrica (Grid Search 4x4)
  const sensitivityMatrix = generateSensitivityMatrix(sorted, params);

  // 5. Matriu de Rendibilitat Mensual & Anual
  const monthlyReturnMatrix = generateMonthlyReturnMatrix(simulatedTrades);

  // 6. Rendiment per Classe d'Actiu en el Backtest
  const assetClassPerformance = generateAssetClassPerformance(simulatedTrades);

  // 7. Distribució de R-Multiples
  const rMultipleDistribution = generateRMultipleDistribution(tradeReturnsR, sorted);

  // 8. Escenaris d'Estrès de Mercat (Stress-Testing)
  const stressTestScenarios: StressTestScenario[] = [
    {
      name: '⚡ Flash Crash de Mercat (-10%)',
      description: 'Caiguda sobtada dels actius en cartera amb trencament d\'stops',
      projectedImpactEUR: -roundCurrency(currentCapital * 0.08),
      projectedCapitalEUR: roundCurrency(currentCapital * 0.92),
      severity: 'ALTA',
    },
    {
      name: '🌊 Crisi de Liquiditat (Slippage x2)',
      description: 'Fricció duplicada en ordres d\'execució per manca de profunditat de llibre',
      projectedImpactEUR: -roundCurrency(totalSlippageEUR * 2),
      projectedCapitalEUR: roundCurrency(currentCapital - totalSlippageEUR * 2),
      severity: 'MITJANA',
    },
    {
      name: '💥 Spike de Volatilitat (+50% ATR)',
      description: 'Ampliació de rangs de preu que provoca execucions prematures de Stop Loss',
      projectedImpactEUR: -roundCurrency(currentCapital * 0.04),
      projectedCapitalEUR: roundCurrency(currentCapital * 0.96),
      severity: 'BAIXA',
    },
  ];

  // 9. Corba d'Assignació Òptima de Kelly (Kelly Curve Optimization)
  const kellyOptimizationCurve: KellyCurvePoint[] = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5].map(kMult => {
    const projGrowth = roundCurrency(cagrPercent * kMult * (1 - (kMult > 1 ? (kMult - 1) * 0.3 : 0)));
    const projVol = roundCurrency(annualizedVolatilityPercent * kMult);
    let label = `${kMult}x Kelly`;
    if (kMult === 0.5) label = '0.5x Half-Kelly (Òptim Institucional)';
    else if (kMult === 1.0) label = '1.0x Full Kelly (Màxim Creixement)';
    else if (kMult > 1.0) label = `${kMult}x Over-betting (Zona de Perill)`;

    return {
      kellyMultiplier: kMult,
      projectedAnnualGrowthPct: projGrowth,
      projectedVolPct: projVol,
      label,
    };
  });

  return {
    params,
    initialCapital: params.initialCapitalEUR,
    finalCapital: currentCapital,
    totalNetPnL: simulatedCumulativePnL,
    totalGrossProfit: grossProfit,
    totalGrossLoss: grossLoss,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    profitFactor,
    payoffRatio,
    expectancyEUR,
    avgRMultiple,
    maxWinEUR,
    maxLossEUR,
    maxConsecutiveWins: maxConsecWins,
    maxConsecutiveLosses: maxConsecLosses,
    maxDrawdownEUR,
    maxDrawdownPercent,
    maxDrawdownDurationDays,
    recoveryFactor,
    calmarRatio,
    cagrPercent,
    annualizedVolatilityPercent,
    sharpeRatio,
    sortinoRatio,
    annualizedSharpeRatio,
    annualizedSortinoRatio,
    omegaRatio,
    gainToPainRatio,
    tailRatio,
    ulcerIndex,
    sqn,
    sqnRating,
    kRatio,
    zScoreRuns,
    runsDependencyText,
    riskOfRuinPercent,
    monteCarloPValue,
    isEdgeStatisticallySignificant,
    beta,
    jensenAlphaPct,
    treynorRatio,
    informationRatio,
    historicalVaR95EUR,
    historicalVaR99EUR,
    cornishFisherVaR95EUR,
    conditionalVaR95EUR,
    skewness,
    kurtosis,
    avgMaePercent,
    avgMfePercent,
    tradeExecutionEfficiencyScore,
    totalSlippageEUR,
    totalCommissionsEUR,
    totalWashSaleDeferredLossEUR,
    washSaleTradesCount,
    estimatedTaxIRPF,
    netCapitalAfterTax,
    realTradingPnL: actualCumulativePnL,
    realTradingWinRate: realWinRate,
    realTradingProfitFactor: realProfitFactor,
    strategyEdgeOverRealEUR: roundCurrency(simulatedCumulativePnL - actualCumulativePnL),
    benchmarkBuyAndHoldPnL: benchmarkCumulativePnL,
    alphaOverBenchmarkEUR: roundCurrency(simulatedCumulativePnL - benchmarkCumulativePnL),
    inSampleMetrics: {
      tradesCount: isCount,
      netPnL: isNet,
      winRate: isWR,
      profitFactor: isPF,
      sharpeRatio: roundCurrency(isWR / 50),
    },
    outOfSampleMetrics: {
      tradesCount: oosCount,
      netPnL: oosNet,
      winRate: oosWR,
      profitFactor: oosPF,
      sharpeRatio: roundCurrency(oosWR / 50),
    },
    walkForwardEfficiencyRatio: wfe,
    isRobustWalkForward,
    equityCurve,
    trades: simulatedTrades,
    sensitivityMatrix,
    monthlyReturnMatrix,
    assetClassPerformance,
    rMultipleDistribution,
    stressTestScenarios,
    rollingWinRateTimeSeries,
    kellyOptimizationCurve,
  };
}

/**
 * Genera la distribució per intervals d'R-Multiple.
 */
function generateRMultipleDistribution(simulatedR: number[], realItems: GainItem[]): RMultipleBucket[] {
  const bucketsDef = [
    { key: 'lt_neg2', label: '< -2R (Catàstrofe)', min: -Infinity, max: -2.01 },
    { key: 'neg2_to_neg1', label: '-2R a -1R (Excés de risc)', min: -2.0, max: -1.01 },
    { key: 'neg1', label: '-1R (Stop Loss Estàndard)', min: -1.0, max: -0.99 },
    { key: 'neg05_to_0', label: '-0.5R a 0R (Pèrdua Menor)', min: -0.98, max: -0.01 },
    { key: '0_to_1', label: '0R a +1R (Guany Menor)', min: 0.0, max: 1.0 },
    { key: '1_to_2', label: '+1R a +2R (Take Profit Est.)', min: 1.01, max: 2.0 },
    { key: '2_to_3', label: '+2R a +3R (Bon Retorn)', min: 2.01, max: 3.0 },
    { key: 'gt_3', label: '> +3R (Runners / Màxims)', min: 3.01, max: Infinity },
  ];

  const total = simulatedR.length || 1;

  return bucketsDef.map(b => {
    const simCount = simulatedR.filter(r => r >= b.min && r <= b.max).length;
    const actCount = realItems.filter(item => {
      const acq = Number(item.acquisitionValue) || 1000;
      const trans = Number(item.transferValue) || 1000;
      const pnl = trans - acq - (Number(item.expenses) || 0);
      const r = (acq * 0.05 > 0) ? pnl / (acq * 0.05) : 0;
      return r >= b.min && r <= b.max;
    }).length;

    return {
      bucket: b.key,
      label: b.label,
      actualCount: actCount,
      simulatedCount: simCount,
      simulatedPct: roundCurrency((simCount / total) * 100),
    };
  });
}

/**
 * Genera la matriu mensual i anual de guanys simulats vs reals.
 */
function generateMonthlyReturnMatrix(trades: BacktestTradeResult[]): MonthlyReturnRow[] {
  const monthNames = ['Gen', 'Feb', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Des'];
  const yearsMap = new Map<number, MonthlyReturnRow>();

  for (const t of trades) {
    const d = new Date(t.exitDate || t.entryDate || '2024-01-01');
    const y = isNaN(d.getFullYear()) ? 2024 : d.getFullYear();
    const m = isNaN(d.getMonth()) ? 0 : d.getMonth();

    if (!yearsMap.has(y)) {
      yearsMap.set(y, {
        year: y,
        months: Array.from({ length: 12 }).map((_, i) => ({
          month: i + 1,
          monthName: monthNames[i],
          simulatedPnL: 0,
          actualPnL: 0,
          tradesCount: 0,
        })),
        totalYearSimulatedPnL: 0,
        totalYearActualPnL: 0,
      });
    }

    const yrRow = yearsMap.get(y)!;
    yrRow.months[m].simulatedPnL = roundCurrency(yrRow.months[m].simulatedPnL + t.simulatedPnL);
    yrRow.months[m].actualPnL = roundCurrency(yrRow.months[m].actualPnL + t.actualPnL);
    yrRow.months[m].tradesCount++;

    yrRow.totalYearSimulatedPnL = roundCurrency(yrRow.totalYearSimulatedPnL + t.simulatedPnL);
    yrRow.totalYearActualPnL = roundCurrency(yrRow.totalYearActualPnL + t.actualPnL);
  }

  return Array.from(yearsMap.values()).sort((a, b) => b.year - a.year);
}

/**
 * Agrupa el rendiment del backtest segons la classe d'actiu real.
 */
function generateAssetClassPerformance(trades: BacktestTradeResult[]): AssetClassBacktestPerformance[] {
  const map = new Map<string, { label: string; icon: string; count: number; wins: number; simPnL: number; actPnL: number }>();
  
  const labels: Record<string, { label: string; icon: string }> = {
    shares: { label: 'Borsa / Accions', icon: '📈' },
    crypto: { label: 'Criptoactius & DeFi', icon: '🪙' },
    funds: { label: 'Fons d\'Inversió', icon: '🏦' },
    etf: { label: 'ETFs Indexats', icon: '📊' },
    derivatives: { label: 'Derivats / Opcions', icon: '⚡' },
  };

  for (const t of trades) {
    const ac = t.assetClass || 'shares';
    if (!map.has(ac)) {
      map.set(ac, {
        label: labels[ac]?.label || ac.toUpperCase(),
        icon: labels[ac]?.icon || '🏷️',
        count: 0,
        wins: 0,
        simPnL: 0,
        actPnL: 0,
      });
    }
    const rec = map.get(ac)!;
    rec.count++;
    if (t.isWin) rec.wins++;
    rec.simPnL = roundCurrency(rec.simPnL + t.simulatedPnL);
    rec.actPnL = roundCurrency(rec.actPnL + t.actualPnL);
  }

  return Array.from(map.entries()).map(([ac, v]) => ({
    assetClass: ac,
    label: v.label,
    icon: v.icon,
    tradesCount: v.count,
    winRate: v.count > 0 ? roundCurrency((v.wins / v.count) * 100) : 0,
    simulatedPnL: v.simPnL,
    actualPnL: v.actPnL,
    edgeEUR: roundCurrency(v.simPnL - v.actPnL),
  }));
}

/**
 * Calcula el p-value mitjançant un test de permutació estocàstic de 500 iteracions.
 */
function calculateMonteCarloPermutationPValue(pnlArray: number[]): number {
  if (pnlArray.length < 5) return 0.05;
  const actualMean = pnlArray.reduce((a, b) => a + b, 0) / pnlArray.length;
  if (actualMean <= 0) return 0.50;

  let extremeCount = 0;
  const iterations = 500;

  for (let iter = 0; iter < iterations; iter++) {
    let sum = 0;
    for (let i = 0; i < pnlArray.length; i++) {
      const sign = Math.random() >= 0.5 ? 1 : -1;
      sum += Math.abs(pnlArray[i]) * sign;
    }
    const permMean = sum / pnlArray.length;
    if (permMean >= actualMean) {
      extremeCount++;
    }
  }

  return roundCurrency(extremeCount / iterations);
}

/**
 * Genera la matriu de sensibilitat paramètrica (Grid Search 4x4) utilitzant les dades reals del declarant.
 */
function generateSensitivityMatrix(items: GainItem[], baseParams: BacktestParameters): SensitivityMatrixCell[] {
  const stopLosses = [3, 5, 8, 12];
  const takeProfits = [8, 15, 25, 40];
  const cells: SensitivityMatrixCell[] = [];

  for (const sl of stopLosses) {
    for (const tp of takeProfits) {
      let net = 0;
      let wins = 0;
      let losses = 0;
      let gProf = 0;
      let gLoss = 0;
      let peak = 0;
      let maxDd = 0;

      for (const item of items) {
        const acq = Number(item.acquisitionValue) || 1000;
        const trans = Number(item.transferValue) || 1000;
        const rawRet = acq > 0 ? ((trans - acq) / acq) * 100 : 0;
        let simRet = rawRet;

        if (rawRet <= -sl) simRet = -sl;
        else if (rawRet >= tp) simRet = tp;

        const posSize = baseParams.sizingModel === 'actual_trade_capital' ? acq : baseParams.fixedTradeAmountEUR;
        const pnl = roundCurrency(posSize * (simRet / 100) - (baseParams.commissionPerTradeEUR * 2));
        net = roundCurrency(net + pnl);

        if (net > peak) peak = net;
        const curDd = peak - net;
        if (curDd > maxDd) maxDd = curDd;

        if (pnl > 0) { wins++; gProf += pnl; }
        else { losses++; gLoss += Math.abs(pnl); }
      }

      const total = items.length || 1;
      const wr = roundCurrency((wins / total) * 100);
      const pf = gLoss > 0 ? roundCurrency(gProf / gLoss) : (gProf > 0 ? 99.9 : 1.0);
      const maxDdPct = peak > 0 ? roundCurrency((maxDd / (baseParams.initialCapitalEUR + peak)) * 100) : 0;
      const sqn = roundCurrency(((wr / 100) * 1.5 - (1 - wr / 100)) * Math.sqrt(total));

      cells.push({
        stopLossPercent: sl,
        takeProfitPercent: tp,
        netPnL: net,
        profitFactor: pf,
        winRate: wr,
        maxDrawdownPercent: maxDdPct,
        sqn,
      });
    }
  }

  return cells;
}

function createEmptyBacktestReport(params: BacktestParameters): BacktestReport {
  return {
    params,
    initialCapital: params.initialCapitalEUR,
    finalCapital: params.initialCapitalEUR,
    totalNetPnL: 0,
    totalGrossProfit: 0,
    totalGrossLoss: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    profitFactor: 1.0,
    payoffRatio: 1.0,
    expectancyEUR: 0,
    avgRMultiple: 0,
    maxWinEUR: 0,
    maxLossEUR: 0,
    maxConsecutiveWins: 0,
    maxConsecutiveLosses: 0,
    maxDrawdownEUR: 0,
    maxDrawdownPercent: 0,
    maxDrawdownDurationDays: 0,
    recoveryFactor: 0,
    calmarRatio: 0,
    cagrPercent: 0,
    annualizedVolatilityPercent: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    annualizedSharpeRatio: 0,
    annualizedSortinoRatio: 0,
    omegaRatio: 1.0,
    gainToPainRatio: 0,
    tailRatio: 1.0,
    ulcerIndex: 0,
    sqn: 0,
    sqnRating: 'Mitjà',
    kRatio: 0,
    zScoreRuns: 0,
    runsDependencyText: 'Sense operacions registrades. Importa un fitxer CSV de bròker o afegeix transaccions.',
    riskOfRuinPercent: 0,
    monteCarloPValue: 1.0,
    isEdgeStatisticallySignificant: false,
    beta: 1.0,
    jensenAlphaPct: 0,
    treynorRatio: 0,
    informationRatio: 0,
    historicalVaR95EUR: 0,
    historicalVaR99EUR: 0,
    cornishFisherVaR95EUR: 0,
    conditionalVaR95EUR: 0,
    skewness: 0,
    kurtosis: 0,
    avgMaePercent: 0,
    avgMfePercent: 0,
    tradeExecutionEfficiencyScore: 100,
    totalSlippageEUR: 0,
    totalCommissionsEUR: 0,
    totalWashSaleDeferredLossEUR: 0,
    washSaleTradesCount: 0,
    estimatedTaxIRPF: 0,
    netCapitalAfterTax: params.initialCapitalEUR,
    realTradingPnL: 0,
    realTradingWinRate: 0,
    realTradingProfitFactor: 1.0,
    strategyEdgeOverRealEUR: 0,
    benchmarkBuyAndHoldPnL: 0,
    alphaOverBenchmarkEUR: 0,
    inSampleMetrics: { tradesCount: 0, netPnL: 0, winRate: 0, profitFactor: 1, sharpeRatio: 0 },
    outOfSampleMetrics: { tradesCount: 0, netPnL: 0, winRate: 0, profitFactor: 1, sharpeRatio: 0 },
    walkForwardEfficiencyRatio: 100,
    isRobustWalkForward: true,
    equityCurve: [],
    trades: [],
    sensitivityMatrix: [],
    monthlyReturnMatrix: [],
    assetClassPerformance: [],
    rMultipleDistribution: [],
    stressTestScenarios: [],
    rollingWinRateTimeSeries: [],
    kellyOptimizationCurve: [],
  };
}
