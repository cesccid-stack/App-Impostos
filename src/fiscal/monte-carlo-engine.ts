/**
 * @module fiscal/monte-carlo-engine
 * Motor de simulació estocàstica de Monte Carlo (1.000 iteracions) per a projeccions de trading i gestió de patrimoni.
 */

import type { TradePerformanceMetrics } from './trading-analytics.ts';

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

  // Matriu d'equitat: iterations x (tradeHorizon + 1)
  const allTrajetories: number[][] = [];

  for (let i = 0; i < iterations; i++) {
    const trajectory: number[] = [initialCapital];
    let capital = initialCapital;
    let peak = initialCapital;
    let hit20 = false;
    let hit30 = false;
    let hit50 = false;

    for (let t = 1; t <= tradeHorizon; t++) {
      const isWin = Math.random() < winProb;
      // Afegir una mica de variabilitat normal a la mida del trade
      const randomFactor = 0.7 + Math.random() * 0.6; // 0.7x a 1.3x
      const pnl = isWin ? (avgWin * randomFactor) : (-avgLoss * randomFactor);

      capital = Math.max(0, capital + pnl);
      trajectory.push(capital);

      if (capital > peak) peak = capital;
      const ddPct = peak > 0 ? ((peak - capital) / peak) * 100 : 0;

      if (ddPct >= 20) hit20 = true;
      if (ddPct >= 30) hit30 = true;
      if (ddPct >= 50) hit50 = true;
    }

    if (hit20) drawdown20Count++;
    if (hit30) drawdown30Count++;
    if (hit50) drawdown50Count++;
    if (capital > initialCapital) profitCount++;

    allTrajetories.push(trajectory);
  }

  // Calcular percentils per a cada punt temporal
  const fanChartPoints: MonteCarloPercentilePoint[] = [];
  const step = Math.max(1, Math.floor(tradeHorizon / 20)); // ~20 punts al gràfic

  for (let t = 0; t <= tradeHorizon; t += step) {
    const valuesAtT: number[] = allTrajetories.map(traj => traj[t]).sort((a, b) => a - b);
    fanChartPoints.push({
      tradeNumber: t,
      p5WorstCase: valuesAtT[Math.floor(iterations * 0.05)],
      p25: valuesAtT[Math.floor(iterations * 0.25)],
      p50Median: valuesAtT[Math.floor(iterations * 0.50)],
      p75: valuesAtT[Math.floor(iterations * 0.75)],
      p95BestCase: valuesAtT[Math.floor(iterations * 0.95)],
    });
  }

  // Si l'últim punt no és tradeHorizon, l'afegim
  if (fanChartPoints[fanChartPoints.length - 1].tradeNumber !== tradeHorizon) {
    const valuesAtEnd: number[] = allTrajetories.map(traj => traj[tradeHorizon]).sort((a, b) => a - b);
    fanChartPoints.push({
      tradeNumber: tradeHorizon,
      p5WorstCase: valuesAtEnd[Math.floor(iterations * 0.05)],
      p25: valuesAtEnd[Math.floor(iterations * 0.25)],
      p50Median: valuesAtEnd[Math.floor(iterations * 0.50)],
      p75: valuesAtEnd[Math.floor(iterations * 0.75)],
      p95BestCase: valuesAtEnd[Math.floor(iterations * 0.95)],
    });
  }

  const finalValues = allTrajetories.map(traj => traj[tradeHorizon]).sort((a, b) => a - b);
  const medianFinalCapital = finalValues[Math.floor(iterations * 0.50)];
  const p5WorstCaseCapital = finalValues[Math.floor(iterations * 0.05)];
  const p95BestCaseCapital = finalValues[Math.floor(iterations * 0.95)];

  const totalNetGained = Math.max(0, medianFinalCapital - initialCapital);
  // Estimació fiscal de l'estalvi (~21% mitjà)
  const estimatedTax = totalNetGained * 0.21;
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
