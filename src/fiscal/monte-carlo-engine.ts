/**
 * @module fiscal/monte-carlo-engine
 * Motor de simulació estocàstica de Monte Carlo (1.000 iteracions) per a projeccions de trading i gestió de patrimoni.
 */

import type { TradePerformanceMetrics } from './trading-analytics.ts';
import { calculateSavingsTaxEUR } from './investment-cockpit-engine.ts';

export interface MonteCarloPercentilePoint {
  tradeNumber: number;
  p5WorstCase: number;
  p25: number;
  p50Median: number;
  p75: number;
  p95BestCase: number;
}

export interface MonteCarloSimulationResult {
  iterations: number;
  tradeHorizon: number;
  initialCapital: number;
  
  medianFinalCapital: number;
  p5WorstCaseCapital: number;
  p95BestCaseCapital: number;
  
  riskOfDrawdown20Pct: number;    // % de simulacions amb DD > 20%
  riskOfDrawdown30Pct: number;    // % de simulacions amb DD > 30%
  riskOfDrawdown50Pct: number;    // % de simulacions amb DD > 50% (Risc de Ruïna)
  
  probabilityOfProfit: number;    // % de simulacions amb P&L final positiu
  expectedAfterTaxWealth: number; // Patrimoni net esperat després d'IRPF
  
  fanChartPoints: MonteCarloPercentilePoint[];
}

/**
 * Executa 1.000 simulacions de Monte Carlo a partir de les mètriques d'operativa reals de l'usuari.
 */
export function runMonteCarloSimulation(
  metrics: TradePerformanceMetrics,
  initialCapital: number = 10000,
  tradeHorizon: number = 100
): MonteCarloSimulationResult {
  const iterations = 1000;
  const winProb = metrics.totalTrades > 0 ? (metrics.winRate / 100) : 0.55;
  const avgWin = metrics.avgWin > 0 ? metrics.avgWin : 250;
  const avgLoss = metrics.avgLoss > 0 ? metrics.avgLoss : 150;

  let drawdown20Count = 0;
  let drawdown30Count = 0;
  let drawdown50Count = 0;
  let profitCount = 0;

  // Mostreig de punts temporals per al gràfic (~20 punts)
  const step = Math.max(1, Math.floor(tradeHorizon / 20));
  const sampleSteps: number[] = [];
  for (let t = 0; t <= tradeHorizon; t += step) {
    sampleSteps.push(t);
  }
  if (sampleSteps[sampleSteps.length - 1] !== tradeHorizon) {
    sampleSteps.push(tradeHorizon);
  }
  const numSamples = sampleSteps.length;

  // Buffer pla per als punts mostrejats: numSamples x iterations
  const sampledValues = new Float64Array(numSamples * iterations);

  for (let i = 0; i < iterations; i++) {
    let capital = initialCapital;
    let peak = initialCapital;
    let hit20 = false;
    let hit30 = false;
    let hit50 = false;
    let sampleIdx = 0;

    // Pas t = 0
    sampledValues[0 * iterations + i] = capital;
    sampleIdx = 1;

    for (let t = 1; t <= tradeHorizon; t++) {
      const isWin = Math.random() < winProb;
      const randomFactor = 0.7 + Math.random() * 0.6;
      const pnl = isWin ? (avgWin * randomFactor) : (-avgLoss * randomFactor);

      capital = Math.max(0, capital + pnl);

      if (capital > peak) peak = capital;
      const ddPct = peak > 0 ? ((peak - capital) / peak) * 100 : 0;

      if (ddPct >= 20) hit20 = true;
      if (ddPct >= 30) hit30 = true;
      if (ddPct >= 50) hit50 = true;

      if (sampleIdx < numSamples && t === sampleSteps[sampleIdx]) {
        sampledValues[sampleIdx * iterations + i] = capital;
        sampleIdx++;
      }
    }

    if (hit20) drawdown20Count++;
    if (hit30) drawdown30Count++;
    if (hit50) drawdown50Count++;
    if (capital > initialCapital) profitCount++;
  }

  // Càlcul eficient de percentils per a cada pas mostrejat
  const fanChartPoints: MonteCarloPercentilePoint[] = [];
  const p5Idx = Math.floor(iterations * 0.05);
  const p25Idx = Math.floor(iterations * 0.25);
  const p50Idx = Math.floor(iterations * 0.50);
  const p75Idx = Math.floor(iterations * 0.75);
  const p95Idx = Math.floor(iterations * 0.95);

  for (let s = 0; s < numSamples; s++) {
    const offset = s * iterations;
    const slice = sampledValues.subarray(offset, offset + iterations).slice().sort();
    fanChartPoints.push({
      tradeNumber: sampleSteps[s],
      p5WorstCase: slice[p5Idx],
      p25: slice[p25Idx],
      p50Median: slice[p50Idx],
      p75: slice[p75Idx],
      p95BestCase: slice[p95Idx],
    });
  }

  const finalSlice = sampledValues.subarray((numSamples - 1) * iterations, numSamples * iterations).slice().sort();
  const medianFinalCapital = finalSlice[p50Idx];
  const p5WorstCaseCapital = finalSlice[p5Idx];
  const p95BestCaseCapital = finalSlice[p95Idx];

  const totalNetGained = Math.max(0, medianFinalCapital - initialCapital);
  // Escala oficial de la base de l'estalvi d'IRPF
  const estimatedTax = calculateSavingsTaxEUR(totalNetGained);
  const expectedAfterTaxWealth = medianFinalCapital - estimatedTax;

  return {
    iterations,
    tradeHorizon,
    initialCapital,
    medianFinalCapital,
    p5WorstCaseCapital,
    p95BestCaseCapital,
    riskOfDrawdown20Pct: Math.round((drawdown20Count / iterations) * 1000) / 10,
    riskOfDrawdown30Pct: Math.round((drawdown30Count / iterations) * 1000) / 10,
    riskOfDrawdown50Pct: Math.round((drawdown50Count / iterations) * 1000) / 10,
    probabilityOfProfit: Math.round((profitCount / iterations) * 1000) / 10,
    expectedAfterTaxWealth,
    fanChartPoints,
  };
}
