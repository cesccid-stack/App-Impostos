/**
 * @module pages/trading-analytics
 * Pàgina d'Anàlisi Quantitativa de Trading, Backtesting Multianual, Tax-Loss Harvesting i Simulació Monte Carlo.
 */

import { store } from '../store.ts';
import { analyzeTradingPerformance } from '../fiscal/trading-analytics.ts';
import { calculateTaxLossHarvesting, type OpenPosition } from '../fiscal/tax-loss-harvesting.ts';
import { runMonteCarloSimulation } from '../fiscal/monte-carlo-engine.ts';
import { formatCurrency } from '../utils/currency.ts';
import { showToast } from '../components/toast.ts';

export function renderTradingAnalytics(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container';

  const data = store.getData();
  const metrics = analyzeTradingPerformance(data.gains?.items || []);

  // Posicions obertes per a Tax-Loss Harvesting (mock editable)
  const openPositions: OpenPosition[] = [
    { id: 'pos-1', tickerOrName: 'Tesla Inc (TSLA)', assetType: 'shares', currentMarketValue: 8500, totalAcquisitionCost: 11200, unrealizedPnL: -2700, lastPurchaseDate: '2024-02-15' },
    { id: 'pos-2', tickerOrName: 'Ethereum (ETH)', assetType: 'crypto', currentMarketValue: 3200, totalAcquisitionCost: 4400, unrealizedPnL: -1200, lastPurchaseDate: '2024-03-01' },
    { id: 'pos-3', tickerOrName: 'Nvidia Corp (NVDA)', assetType: 'shares', currentMarketValue: 14000, totalAcquisitionCost: 8000, unrealizedPnL: +6000, lastPurchaseDate: '2023-11-10' },
  ];

  let monteCarloHorizon = 100;
  let monteCarloCap = 10000;

  function renderView() {
    const isNetProfit = metrics.netPnL >= 0;
    const harvestPlan = calculateTaxLossHarvesting(data.gains?.items || [], openPositions);
    const mcResult = runMonteCarloSimulation(metrics, monteCarloCap, monteCarloHorizon);

    page.innerHTML = `
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-xl);">
        <div>
          <div style="display:flex; align-items:center; gap:var(--space-sm); margin-bottom:4px;">
            <h1 class="page-header__title" style="margin:0;">📈 Anàlisi Avançada de Trading & Backtesting</h1>
            <span class="badge badge--primary">Quant & Monte Carlo</span>
            <span class="badge badge--success">${metrics.totalTrades} operacions</span>
          </div>
          <p class="page-header__subtitle" style="margin:0;">
            Mètriques professionals, corba d'equitat, optimització de Tax-Loss Harvesting i simulació Monte Carlo (1.000 camins)
          </p>
        </div>
        <div style="display:flex; gap:var(--space-sm);">
          <a href="#/importar" class="btn btn--secondary btn--sm">📥 Importar Operacions CSV</a>
          <a href="#/guanys" class="btn btn--secondary btn--sm">📊 Veure Cartera FIFO</a>
        </div>
      </div>

      <!-- 1. Hero Card de Resultats i Impacte Fiscal -->
      <div class="card" style="margin-bottom:var(--space-xl); background:linear-gradient(135deg, var(--bg-surface-elevated), var(--bg-surface)); border:1px solid var(--border-default);">
        <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:var(--space-xl); align-items:center;">
          <div>
            <div style="font-size:var(--text-xs); text-transform:uppercase; font-weight:700; color:var(--text-muted); letter-spacing:0.05em;">
              P&L Net Total de la Cartera (Volum: ${formatCurrency(metrics.totalVolumeTraded)})
            </div>
            <div style="font-size:3rem; font-weight:800; line-height:1.1; margin:8px 0; color:${isNetProfit ? 'var(--color-success)' : 'var(--color-error)'};">
              ${isNetProfit ? '+' : ''}${formatCurrency(metrics.netPnL)}
            </div>
            <div style="font-size:var(--text-sm); color:var(--text-secondary);">
              Guanys Bruts: <strong class="text-success">+${formatCurrency(metrics.totalProfit)}</strong> | Pèrdues Brutes: <strong class="text-error">-${formatCurrency(metrics.totalLoss)}</strong>
            </div>
            <div style="margin-top:var(--space-sm); font-size:var(--text-xs); color:var(--text-muted); background:var(--bg-surface); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-default); display:inline-block;">
              🏛️ <strong>Impacte Fiscal AEAT (Estalvi):</strong> ~${formatCurrency(metrics.estimatedTaxesSavings)} d'impostos $\rightarrow$ <strong>P&L Net a la butxaca: ${formatCurrency(metrics.netPnLAfterTax)}</strong>
            </div>
          </div>

          <!-- KPIs Clau -->
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:var(--space-md); text-align:center; background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div>
              <div style="font-size:var(--text-xs); color:var(--text-muted);">Win Rate</div>
              <div style="font-size:var(--text-2xl); font-weight:800; color:var(--color-primary);">${metrics.winRate}%</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">${metrics.winningTrades}W / ${metrics.losingTrades}L</div>
            </div>
            <div>
              <div style="font-size:var(--text-xs); color:var(--text-muted);">Profit Factor</div>
              <div style="font-size:var(--text-2xl); font-weight:800; color:${metrics.profitFactor >= 1.5 ? 'var(--color-success)' : 'var(--color-warning)'};">${metrics.profitFactor.toFixed(2)}</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">${metrics.profitFactor >= 1.5 ? 'Rentable' : 'Millorable'}</div>
            </div>
            <div>
              <div style="font-size:var(--text-xs); color:var(--text-muted);">Payoff (R:R)</div>
              <div style="font-size:var(--text-2xl); font-weight:800; color:var(--accent-start);">${metrics.payoffRatio.toFixed(2)}</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">${formatCurrency(metrics.avgWin)} / ${formatCurrency(metrics.avgLoss)}</div>
            </div>
            <div>
              <div style="font-size:var(--text-xs); color:var(--text-muted);">Esperança / Trade</div>
              <div style="font-size:var(--text-2xl); font-weight:800; color:${metrics.expectancyEUR >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(metrics.expectancyEUR)}</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">Expectancy</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Corba d'Equitat (Cumulative Equity Curve) -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="margin-bottom:var(--space-md); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div class="card__title">📈 Corba d'Equitat Acumulada (Equity Curve)</div>
            <div class="card__subtitle">Evolució del capital trade a trade des de la primera operació</div>
          </div>
          <div style="font-size:var(--text-xs); color:var(--text-muted);">
            Max Drawdown: <strong class="text-error">-${formatCurrency(metrics.maxDrawdownEUR)} (${metrics.maxDrawdownPercent}%)</strong> | Sharpe: <strong>${metrics.sharpeRatio}</strong>
          </div>
        </div>
        <div style="overflow-x:auto;">
          ${renderEquityCurveSvg(metrics.equityCurve)}
        </div>
      </div>

      <!-- 3. SECCIÓ TAX-LOSS HARVESTING INTEL·LIGENT -->
      <div class="card" style="margin-bottom:var(--space-xl); background:var(--bg-surface-elevated); border:2px solid var(--color-success);">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-sm); margin-bottom:var(--space-md);">
          <div>
            <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
              <span>🌾 Algorisme de Tax-Loss Harvesting Intel·ligent</span>
              <span class="badge badge--success">Estalvi directe IRPF</span>
            </div>
            <p class="card__subtitle" style="margin:4px 0 0 0;">
              Propostes per tancar posicions amb pèrdues latents abans del 31/12 i reduir l'impost de l'estalvi a 0 €
            </p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Estalvi fiscal disponible</div>
            <div style="font-size:var(--text-2xl); font-weight:800; color:var(--color-success);">
              +${formatCurrency(harvestPlan.projectedTaxSavingsEUR)}
            </div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:var(--space-sm);">
          ${harvestPlan.recommendedSales.length > 0 ? harvestPlan.recommendedSales.map(rec => `
            <div style="background:var(--bg-surface); padding:12px 16px; border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
              <div>
                <strong>${rec.tickerOrName}</strong> — Pèrdua latent: <span class="text-error">-${formatCurrency(rec.unrealizedLoss)}</span>
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${rec.washSaleWarning}</div>
              </div>
              <div style="display:flex; gap:var(--space-sm); align-items:center;">
                <div style="text-align:right;">
                  <div style="font-size:0.75rem; color:var(--text-muted);">Venda recomanada:</div>
                  <strong>${formatCurrency(rec.amountToSellEUR)}</strong>
                </div>
                <button class="btn btn--secondary btn--sm" id="btn-harvest-sale-${rec.positionId}">
                  ⚡ Simular Venda
                </button>
              </div>
            </div>
          `).join('') : '<div class="text-muted text-sm" style="padding:12px; text-align:center;">No tens guanys pendents de compensar o no hi ha posicions amb pèrdues latents disponibles.</div>'}
        </div>
      </div>

      <!-- 4. SECCIÓ SIMULADOR MONTE CARLO (1.000 ITERACIONS) -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
          <div>
            <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
              <span>🔮 Simulador Estocàstic de Monte Carlo (1.000 Camins)</span>
              <span class="badge badge--primary">Projecció probabilística</span>
            </div>
            <div class="card__subtitle">Projecció de capital i avaluació del Risc de Fallida (Risk of Ruin)</div>
          </div>
          <div style="display:flex; gap:var(--space-sm); align-items:center;">
            <label style="font-size:var(--text-xs); color:var(--text-muted);">Horitzó:</label>
            <select class="form-select" id="mc-horizon-select" style="font-size:0.75rem; padding:4px 8px;">
              <option value="50" ${monteCarloHorizon === 50 ? 'selected' : ''}>50 trades</option>
              <option value="100" ${monteCarloHorizon === 100 ? 'selected' : ''}>100 trades</option>
              <option value="250" ${monteCarloHorizon === 250 ? 'selected' : ''}>250 trades (~1 any)</option>
              <option value="500" ${monteCarloHorizon === 500 ? 'selected' : ''}>500 trades (~2 anys)</option>
            </select>
          </div>
        </div>

        <!-- Resultats Monte Carlo -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-lg); text-align:center;">
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md);">
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Capital Mediana (P50)</div>
            <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-primary);">${formatCurrency(mcResult.medianFinalCapital)}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">Després d'IRPF: ${formatCurrency(mcResult.expectedAfterTaxWealth)}</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md);">
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Pitjor Cas (P5 - Stress Test)</div>
            <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-error);">${formatCurrency(mcResult.p5WorstCaseCapital)}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">Escenari advers 5%</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md);">
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Millor Cas (P95)</div>
            <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-success);">${formatCurrency(mcResult.p95BestCaseCapital)}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">Escenari òptim 95%</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md);">
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Risc de Drawdown >30%</div>
            <div style="font-size:var(--text-xl); font-weight:800; color:${mcResult.riskOfDrawdown30Pct > 15 ? 'var(--color-warning)' : 'var(--color-success)'};">${mcResult.riskOfDrawdown30Pct}%</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">Prob. de caiguda severa</div>
          </div>
        </div>

        <!-- Fan Chart SVG -->
        <div style="overflow-x:auto;">
          ${renderMonteCarloFanChartSvg(mcResult.fanChartPoints, mcResult.initialCapital)}
        </div>
      </div>

      <!-- 5. Comparativa vs Benchmark (S&P 500) -->
      <div class="card" style="margin-bottom:var(--space-xl); background:var(--bg-surface-elevated);">
        <div class="card__header" style="margin-bottom:var(--space-md);">
          <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
            <span>🎯 Comparativa vs Benchmark de Mercat (S&P 500 / Buy & Hold)</span>
            <span class="badge ${metrics.benchmarkComparison.alphaGeneratedPct >= 0 ? 'badge--success' : 'badge--warning'}">
              ${metrics.benchmarkComparison.alphaGeneratedPct >= 0 ? 'Generant Alfa (+)' : 'Sota el Benchmark'}
            </span>
          </div>
          <p class="card__subtitle" style="margin:0;">Compara el rendiment del teu trading actiu amb haver comprat i mantingut un índex de referència passiu</p>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:var(--space-md); text-align:center;">
          <div style="background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="font-size:var(--text-xs); color:var(--text-muted);">El teu Retorn de Trading</div>
            <div style="font-size:var(--text-2xl); font-weight:800; color:${metrics.benchmarkComparison.tradingReturnPct >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
              ${metrics.benchmarkComparison.tradingReturnPct >= 0 ? '+' : ''}${metrics.benchmarkComparison.tradingReturnPct}%
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted);">${formatCurrency(metrics.benchmarkComparison.tradingReturnTotalEUR)} nets</div>
          </div>
          <div style="background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Benchmark S&P 500 (Buy & Hold)</div>
            <div style="font-size:var(--text-2xl); font-weight:800; color:var(--color-info);">+${metrics.benchmarkComparison.benchmarkSp500Pct}%</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">Rendiment mitjà de mercat</div>
          </div>
          <div style="background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Alfa Generat (Edge)</div>
            <div style="font-size:var(--text-2xl); font-weight:800; color:${metrics.benchmarkComparison.alphaGeneratedPct >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
              ${metrics.benchmarkComparison.alphaGeneratedPct >= 0 ? '+' : ''}${metrics.benchmarkComparison.alphaGeneratedPct}%
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted);">${metrics.benchmarkComparison.alphaGeneratedPct >= 0 ? 'Bateixes el mercat' : 'Mercat més eficient'}</div>
          </div>
        </div>
      </div>
    `;

    // Horizon listener
    page.querySelector('#mc-horizon-select')?.addEventListener('change', (e) => {
      monteCarloHorizon = parseInt((e.target as HTMLSelectElement).value) || 100;
      renderView();
    });

    // Harvest simulate listeners
    harvestPlan.recommendedSales.forEach(rec => {
      page.querySelector(`#btn-harvest-sale-${rec.positionId}`)?.addEventListener('click', () => {
        const currentItems = [...(store.getData().gains?.items || [])];
        currentItems.push({
          id: `harvest-${Date.now()}`,
          description: `[HARVESTING] Venda fiscal ${rec.tickerOrName}`,
          type: 'shares',
          acquisitionDate: '2024-01-15',
          transferDate: new Date().toISOString().split('T')[0],
          acquisitionValue: rec.amountToSellEUR + rec.unrealizedLoss,
          transferValue: rec.amountToSellEUR,
          expenses: 0,
          isNonComputableLoss: false,
        });

        store.update('gains', { items: currentItems });
        showToast(`Venda fiscal ${rec.tickerOrName} registrada al mòdul de Guanys!`, 'success');
        renderView();
      });
    });
  }

  renderView();
  return page;
}

function renderEquityCurveSvg(points: { tradeIndex: number; cumulativePnL: number }[]): string {
  if (points.length < 2) {
    return `<div class="empty-state" style="padding:var(--space-xl); text-align:center; color:var(--text-muted);">Cal tenir almenys 2 operacions per dibuixar la corba d'equitat.</div>`;
  }

  const width = 800;
  const height = 220;
  const padding = 40;

  const minPnL = Math.min(0, ...points.map(p => p.cumulativePnL));
  const maxPnL = Math.max(10, ...points.map(p => p.cumulativePnL));
  const pnlRange = maxPnL - minPnL || 1;

  const getX = (index: number) => padding + (index / (points.length - 1)) * (width - 2 * padding);
  const getY = (val: number) => height - padding - ((val - minPnL) / pnlRange) * (height - 2 * padding);
  const zeroY = getY(0);

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.cumulativePnL).toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${getX(points.length - 1).toFixed(1)} ${zeroY.toFixed(1)} L ${getX(0).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const isOverallGreen = points[points.length - 1].cumulativePnL >= 0;
  const strokeColor = isOverallGreen ? '#10b981' : '#ef4444';
  const fillColor = isOverallGreen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';

  return `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block; overflow:visible;" xmlns="http://www.w3.org/2000/svg">
      <line x1="${padding}" y1="${zeroY}" x2="${width - padding}" y2="${zeroY}" stroke="var(--border-default)" stroke-width="1.5" stroke-dasharray="4 4" />
      <text x="${padding - 8}" y="${zeroY + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="monospace">0 €</text>
      <path d="${areaD}" fill="${fillColor}" />
      <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

function renderMonteCarloFanChartSvg(points: { tradeNumber: number; p5WorstCase: number; p50Median: number; p95BestCase: number }[], initialCap: number): string {
  if (points.length < 2) return '';

  const width = 800;
  const height = 220;
  const padding = 40;

  const minVal = Math.min(initialCap * 0.5, ...points.map(p => p.p5WorstCase));
  const maxVal = Math.max(initialCap * 1.5, ...points.map(p => p.p95BestCase));
  const valRange = maxVal - minVal || 1;

  const getX = (i: number) => padding + (i / (points.length - 1)) * (width - 2 * padding);
  const getY = (val: number) => height - padding - ((val - minVal) / valRange) * (height - 2 * padding);

  // Àrea entre P5 i P95
  const topPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.p95BestCase).toFixed(1)}`).join(' ');
  const bottomPathReversed = [...points].reverse().map((p, i) => `L ${getX(points.length - 1 - i).toFixed(1)} ${getY(p.p5WorstCase).toFixed(1)}`).join(' ');
  const fanAreaD = `${topPath} ${bottomPathReversed} Z`;

  // Línia Mediana P50
  const medianPathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.p50Median).toFixed(1)}`).join(' ');

  return `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block; overflow:visible;" xmlns="http://www.w3.org/2000/svg">
      <!-- Fan Area P5 - P95 -->
      <path d="${fanAreaD}" fill="rgba(99, 102, 241, 0.18)" />
      <!-- Median line -->
      <path d="${medianPathD}" fill="none" stroke="var(--color-primary)" stroke-width="2.5" />
      <!-- Initial capital line -->
      <line x1="${padding}" y1="${getY(initialCap)}" x2="${width - padding}" y2="${getY(initialCap)}" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="3 3" />
      <text x="${width - padding + 6}" y="${getY(initialCap) + 4}" fill="var(--text-muted)" font-size="10" font-family="monospace">Capital Inicial</text>
    </svg>
  `;
}
