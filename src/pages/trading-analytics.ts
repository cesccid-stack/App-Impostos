/**
 * @module pages/trading-analytics
 * Quadre de Comandament d'Inversions, Trading, Laboratori de Backtest Institucional & Kaizen 360°.
 * Avalua el rendiment, tècniques operatives (Borsa, Cripto, Fons), gestió de risc (Kelly/VaR),
 * simulació de backtesting multi-estratègia, mapa de calor calendari i pla de millora contínua.
 */

import { store } from '../store.ts';
import { 
  analyzeInvestmentCockpit, 
  type InvestmentCockpitOptions, 
  type InvestmentAssetClass, 
  type TradingHoldingStyle,
  type InvestmentCockpitReport,
  type EnrichedTradeItem
} from '../fiscal/investment-cockpit-engine.ts';
import { 
  runInstitutionalBacktest, 
  type BacktestParameters, 
  type BacktestReport,
  DEFAULT_BACKTEST_PARAMETERS
} from '../fiscal/backtest-engine.ts';
import { analyzeTradingPerformance } from '../fiscal/trading-analytics.ts';
import { calculateTaxLossHarvesting, type OpenPosition } from '../fiscal/tax-loss-harvesting.ts';
import { runMonteCarloSimulation } from '../fiscal/monte-carlo-engine.ts';
import { formatCurrency } from '../utils/currency.ts';
import { showToast } from '../components/toast.ts';
import type { DeclaracionData } from '../types.ts';

export function renderTradingAnalytics(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container slide-in';

  // Filtres d'estat interactius
  let selectedYear: number | 'ALL' = 'ALL';
  let selectedAssetClass: InvestmentAssetClass | 'ALL' = 'ALL';
  let selectedStyle: TradingHoldingStyle | 'ALL' = 'ALL';
  let selectedSetup: string | 'ALL' = 'ALL';
  let activeTab: 'cockpit' | 'backtest' | 'calendar' | 'setups' | 'journal' | 'kaizen' | 'whatif' | 'harvesting' = 'cockpit';
  let searchQuery = '';
  let backtestTradeFilter: 'ALL' | 'MODIFIED' | 'STOP_LOSS' | 'TAKE_PROFIT' = 'ALL';
  let monteCarloHorizon = 100;
  const monteCarloCap = 10000;

  // Estat del Laboratori de Backtest
  const backtestParams: BacktestParameters = { ...DEFAULT_BACKTEST_PARAMETERS };

  // Posicions obertes per a Tax-Loss Harvesting (simulador de carteres)
  const openPositions: OpenPosition[] = [
    { id: 'pos-1', tickerOrName: 'Tesla Inc (TSLA)', assetType: 'shares', currentMarketValue: 8500, totalAcquisitionCost: 11200, unrealizedPnL: -2700, lastPurchaseDate: '2024-02-15' },
    { id: 'pos-2', tickerOrName: 'Ethereum (ETH)', assetType: 'crypto', currentMarketValue: 3200, totalAcquisitionCost: 4400, unrealizedPnL: -1200, lastPurchaseDate: '2024-03-01' },
    { id: 'pos-3', tickerOrName: 'Nvidia Corp (NVDA)', assetType: 'shares', currentMarketValue: 14000, totalAcquisitionCost: 8000, unrealizedPnL: +6000, lastPurchaseDate: '2023-11-10' },
    { id: 'pos-4', tickerOrName: 'Solana (SOL)', assetType: 'crypto', currentMarketValue: 2100, totalAcquisitionCost: 3100, unrealizedPnL: -1000, lastPurchaseDate: '2024-04-10' },
  ];

  function render() {
    const data: DeclaracionData = store.getData();
    const allGainItems = data.gains?.items || [];

    const options: InvestmentCockpitOptions = {
      filterYear: selectedYear,
      filterAssetClass: selectedAssetClass,
      filterStyle: selectedStyle,
      filterSetup: selectedSetup,
    };

    const report: InvestmentCockpitReport = analyzeInvestmentCockpit(allGainItems, options);
    const backtestReport: BacktestReport = runInstitutionalBacktest(allGainItems, backtestParams);
    const harvestPlan = calculateTaxLossHarvesting(allGainItems, openPositions);
    const quantMetrics = analyzeTradingPerformance(allGainItems);
    const mcResult = runMonteCarloSimulation(
      quantMetrics,
      monteCarloCap,
      monteCarloHorizon
    );

    const isNetProfit = report.netPnL >= 0;

    page.innerHTML = `
      <!-- Header amb Títol i Accions Globals -->
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-lg);">
        <div>
          <div style="display:flex; align-items:center; gap:var(--space-sm); margin-bottom:4px; flex-wrap:wrap;">
            <h1 class="page-header__title" style="margin:0; font-size:1.75rem; font-weight:800;">
              📈 Quadre de Comandament d'Inversions & Backtest Institucional
            </h1>
            <span class="badge badge--primary">Quant & Walk-Forward</span>
            <span class="badge badge--success">${report.totalTrades} operacions reals</span>
          </div>
          <p class="page-header__subtitle" style="margin:0; color:var(--text-secondary); font-size:0.9rem;">
            Analítica quantitativa 360°, motor de backtesting institucional (Walk-Forward / SQN), ràtios Kelly/VaR i millora contínua Kaizen.
          </p>
        </div>
        <div style="display:flex; gap:var(--space-sm); flex-wrap:wrap;">
          <a href="#/importar" class="btn btn--secondary btn--sm">📥 Importar CSV / Brokers</a>
          <a href="#/guanys" class="btn btn--secondary btn--sm">📊 Cartera FIFO</a>
        </div>
      </div>

      <!-- Barra de Filtres Dinàmics -->
      <div class="card" style="padding:var(--space-md); margin-bottom:var(--space-lg); background:var(--bg-surface-elevated); border:1px solid var(--border-default);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-md);">
          
          <!-- Filtre per Exercici Fiscal -->
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:0.8rem; font-weight:700; color:var(--text-secondary);">📅 Exercici:</label>
            <div class="btn-group" id="filter-year-group">
              <button class="btn btn--sm ${selectedYear === 'ALL' ? 'btn--primary' : 'btn--secondary'} btn-filter-year" data-year="ALL">Tots</button>
              <button class="btn btn--sm ${selectedYear === 2024 ? 'btn--primary' : 'btn--secondary'} btn-filter-year" data-year="2024">2024</button>
              <button class="btn btn--sm ${selectedYear === 2023 ? 'btn--primary' : 'btn--secondary'} btn-filter-year" data-year="2023">2023</button>
              <button class="btn btn--sm ${selectedYear === 2022 ? 'btn--primary' : 'btn--secondary'} btn-filter-year" data-year="2022">2022</button>
              <button class="btn btn--sm ${selectedYear === 2021 ? 'btn--primary' : 'btn--secondary'} btn-filter-year" data-year="2021">2021</button>
            </div>
          </div>

          <!-- Filtre per Classe d'Actiu -->
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:0.8rem; font-weight:700; color:var(--text-secondary);">🏷️ Actiu:</label>
            <select class="form-select" id="filter-asset-select" style="font-size:0.8rem; padding:4px 10px;">
              <option value="ALL" ${selectedAssetClass === 'ALL' ? 'selected' : ''}>Totes les Classes</option>
              <option value="shares" ${selectedAssetClass === 'shares' ? 'selected' : ''}>📈 Borsa / Accions</option>
              <option value="crypto" ${selectedAssetClass === 'crypto' ? 'selected' : ''}>🪙 Criptoactius & DeFi</option>
              <option value="funds" ${selectedAssetClass === 'funds' ? 'selected' : ''}>🏦 Fons d'Inversió</option>
              <option value="etf" ${selectedAssetClass === 'etf' ? 'selected' : ''}>📊 ETFs Indexats</option>
              <option value="derivatives" ${selectedAssetClass === 'derivatives' ? 'selected' : ''}>⚡ Derivats / Opcions</option>
            </select>
          </div>

          <!-- Filtre per Estil Temporal -->
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:0.8rem; font-weight:700; color:var(--text-secondary);">⏱️ Estil:</label>
            <select class="form-select" id="filter-style-select" style="font-size:0.8rem; padding:4px 10px;">
              <option value="ALL" ${selectedStyle === 'ALL' ? 'selected' : ''}>Tots els Horitzons</option>
              <option value="scalping" ${selectedStyle === 'scalping' ? 'selected' : ''}>⚡ Scalping (< 24h)</option>
              <option value="swing" ${selectedStyle === 'swing' ? 'selected' : ''}>🌊 Swing (1-30 dies)</option>
              <option value="positional" ${selectedStyle === 'positional' ? 'selected' : ''}>🎯 Posicional (1-12m)</option>
              <option value="long_term" ${selectedStyle === 'long_term' ? 'selected' : ''}>💎 Llarg Termini (> 1 any)</option>
            </select>
          </div>

        </div>
      </div>

      <!-- Navegació per 8 Pestanyes del Quadre -->
      <div style="display:flex; gap:var(--space-xs); border-bottom:1px solid var(--border-default); margin-bottom:var(--space-xl); overflow-x:auto;">
        <button class="tab-btn ${activeTab === 'cockpit' ? 'tab-btn--active' : ''} nav-tab-btn" data-tab="cockpit">
          🎯 Panell 360° & Risc
        </button>
        <button class="tab-btn ${activeTab === 'backtest' ? 'tab-btn--active' : ''} nav-tab-btn" data-tab="backtest" style="font-weight:800; color:var(--color-primary);">
          🧪 Laboratori de Backtesting
        </button>
        <button class="tab-btn ${activeTab === 'calendar' ? 'tab-btn--active' : ''} nav-tab-btn" data-tab="calendar">
          📅 Calendari & Mapa P&L
        </button>
        <button class="tab-btn ${activeTab === 'setups' ? 'tab-btn--active' : ''} nav-tab-btn" data-tab="setups">
          🏷️ Anàlisi per Setups
        </button>
        <button class="tab-btn ${activeTab === 'journal' ? 'tab-btn--active' : ''} nav-tab-btn" data-tab="journal">
          📝 Diari d'Operacions & Tagging
        </button>
        <button class="tab-btn ${activeTab === 'kaizen' ? 'tab-btn--active' : ''} nav-tab-btn" data-tab="kaizen">
          🧘 Millora Kaizen & Checklist
        </button>
        <button class="tab-btn ${activeTab === 'whatif' ? 'tab-btn--active' : ''} nav-tab-btn" data-tab="whatif">
          🔮 Simulador What-If & Monte Carlo
        </button>
        <button class="tab-btn ${activeTab === 'harvesting' ? 'tab-btn--active' : ''} nav-tab-btn" data-tab="harvesting">
          🌾 Tax-Loss Harvesting
        </button>
      </div>

      <!-- Contingut Dinàmic de la Pestanya Activa -->
      <div id="cockpit-tab-content">
        ${renderTabContent(report, backtestReport, harvestPlan, mcResult, isNetProfit)}
      </div>
    `;

    attachEventListeners(page, report, backtestReport);
  }

  function renderTabContent(
    report: InvestmentCockpitReport,
    backtestReport: BacktestReport,
    harvestPlan: ReturnType<typeof calculateTaxLossHarvesting>,
    mcResult: ReturnType<typeof runMonteCarloSimulation>,
    isNetProfit: boolean
  ): string {
    switch (activeTab) {
      case 'cockpit':
        return renderCockpitOverview(report, isNetProfit);
      case 'backtest':
        return renderBacktestLaboratoryView(backtestReport);
      case 'calendar':
        return renderCalendarHeatmapView(report);
      case 'setups':
        return renderSetupsView(report);
      case 'journal':
        return renderJournalView(report);
      case 'kaizen':
        return renderKaizenView(report);
      case 'whatif':
        return renderWhatIfView(report, mcResult);
      case 'harvesting':
        return renderHarvestingView(harvestPlan);
      default:
        return renderCockpitOverview(report, isNetProfit);
    }
  }

  // ── 1. PANELL PRINCIPAL 360° & RISC AVANÇAT ─────────────────────────────────
  function renderCockpitOverview(report: InvestmentCockpitReport, isNetProfit: boolean): string {
    const rm = report.riskMetrics;

    return `
      <!-- Hero KPI Banner -->
      <div class="card" style="margin-bottom:var(--space-xl); background:linear-gradient(135deg, var(--bg-surface-elevated), var(--bg-surface)); border:1px solid var(--border-accent); box-shadow:var(--shadow-md);">
        <div style="display:grid; grid-template-columns: 1.3fr 1fr; gap:var(--space-xl); align-items:center;">
          <div>
            <div style="font-size:0.75rem; text-transform:uppercase; font-weight:800; color:var(--text-secondary); letter-spacing:0.08em;">
              P&L Net Total (Volum: ${formatCurrency(report.totalVolume)})
            </div>
            <div style="font-size:3.2rem; font-weight:900; line-height:1.1; margin:8px 0; font-family:var(--font-mono); color:${isNetProfit ? 'var(--color-success)' : 'var(--color-error)'};">
              ${isNetProfit ? '+' : ''}${formatCurrency(report.netPnL)}
            </div>
            <div style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:var(--space-sm);">
              Guanys Bruts: <strong style="color:var(--color-success);">+${formatCurrency(report.grossProfit)}</strong> | Pèrdues Brutes: <strong style="color:var(--color-error);">-${formatCurrency(report.grossLoss)}</strong>
            </div>
            
            <!-- Caixa de Fricció Fiscal & Comissions -->
            <div style="background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border-default); display:inline-flex; align-items:center; gap:var(--space-md); flex-wrap:wrap;">
              <div>
                <span style="font-size:0.75rem; color:var(--text-muted);">🏛️ Impost IRPF Estalvi (Est.):</span>
                <strong style="font-size:0.85rem; color:var(--color-warning);">~${formatCurrency(report.estimatedTaxSavingsBase)} (${report.effectiveTaxRatePct}%)</strong>
              </div>
              <div style="border-left:1px solid var(--border-default); padding-left:var(--space-md);">
                <span style="font-size:0.75rem; color:var(--text-muted);">💰 Net a la butxaca:</span>
                <strong style="font-size:0.95rem; color:${report.netPnLAfterTax >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                  ${formatCurrency(report.netPnLAfterTax)}
                </strong>
              </div>
            </div>
          </div>

          <!-- Matriu de Ràtios Tècniques Clau -->
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:var(--space-md); text-align:center; background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-lg); border:1px solid var(--border-default);">
            <div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Win Rate</div>
              <div style="font-size:1.8rem; font-weight:900; color:var(--color-primary);">${report.winRate}%</div>
              <div style="font-size:0.7rem; color:var(--text-secondary);">${report.winningTrades}W / ${report.losingTrades}L (${report.breakevenTrades} BE)</div>
            </div>
            <div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Profit Factor</div>
              <div style="font-size:1.8rem; font-weight:900; color:${report.profitFactor >= 1.5 ? 'var(--color-success)' : (report.profitFactor >= 1 ? 'var(--color-warning)' : 'var(--color-error)')};">
                ${report.profitFactor >= 99 ? '∞' : report.profitFactor.toFixed(2)}
              </div>
              <div style="font-size:0.7rem; color:var(--text-secondary);">${report.profitFactor >= 1.5 ? 'Rentable' : 'Risc Operatiu'}</div>
            </div>
            <div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Ràtio Payoff (R:R)</div>
              <div style="font-size:1.8rem; font-weight:900; color:var(--accent-start);">${report.payoffRatio >= 99 ? '∞' : report.payoffRatio.toFixed(2)}</div>
              <div style="font-size:0.7rem; color:var(--text-secondary);">+${formatCurrency(report.avgWin)} / -${formatCurrency(report.avgLoss)}</div>
            </div>
            <div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Esperança / Trade</div>
              <div style="font-size:1.8rem; font-weight:900; color:${report.expectancyEUR >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                ${formatCurrency(report.expectancyEUR)}
              </div>
              <div style="font-size:0.7rem; color:var(--text-secondary);">Edge Matemàtic</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Caixa de Gestió de Risc Professional (Kelly, VaR, Calmar, Ulcer Index) -->
      <div class="card" style="margin-bottom:var(--space-xl); border:1px solid var(--border-default);">
        <h3 style="margin:0 0 var(--space-md) 0; font-size:1rem; font-weight:800; display:flex; align-items:center; gap:8px;">
          <span>🛡️ Mètriques de Gestió de Risc & Money Management</span>
          <span class="badge badge--primary">Quant Risk Control</span>
        </h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:var(--space-md); text-align:center;">
          <div style="background:var(--bg-surface-elevated); padding:12px; border-radius:var(--radius-md);">
            <div style="font-size:0.75rem; color:var(--text-muted);">Criteri de Kelly (Half)</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--color-primary); font-family:var(--font-mono);">${rm.halfKellyPct}%</div>
            <div style="font-size:0.65rem; color:var(--text-muted);">Full Kelly: ${rm.kellyFractionPct}%</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:12px; border-radius:var(--radius-md);">
            <div style="font-size:0.75rem; color:var(--text-muted);">Value at Risk (VaR 95%)</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--color-warning); font-family:var(--font-mono);">${formatCurrency(rm.var95EUR)}</div>
            <div style="font-size:0.65rem; color:var(--text-muted);">Pèrdua màx esperada en 95%</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:12px; border-radius:var(--radius-md);">
            <div style="font-size:0.75rem; color:var(--text-muted);">Expected Shortfall (CVaR)</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--color-error); font-family:var(--font-mono);">${formatCurrency(rm.cvarExpectedShortfallEUR)}</div>
            <div style="font-size:0.65rem; color:var(--text-muted);">Mitjana del 5% pitjor</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:12px; border-radius:var(--radius-md);">
            <div style="font-size:0.75rem; color:var(--text-muted);">Ràtio Calmar</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--color-success); font-family:var(--font-mono);">${rm.calmarRatio.toFixed(2)}</div>
            <div style="font-size:0.65rem; color:var(--text-muted);">Retorn / Max Drawdown</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:12px; border-radius:var(--radius-md);">
            <div style="font-size:0.75rem; color:var(--text-muted);">R-Multiples Nets</div>
            <div style="font-size:1.4rem; font-weight:800; color:${rm.totalRAccumulated >= 0 ? 'var(--color-success)' : 'var(--color-error)'}; font-family:var(--font-mono);">
              ${rm.totalRAccumulated >= 0 ? '+' : ''}${rm.totalRAccumulated}R
            </div>
            <div style="font-size:0.65rem; color:var(--text-muted);">Avg +${rm.avgRWin}R / -${rm.avgRLoss}R</div>
          </div>
        </div>
      </div>

      <!-- Corba d'Equitat & Drawdown Underwater Chart -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md); flex-wrap:wrap; gap:var(--space-sm);">
          <div>
            <div class="card__title" style="display:flex; align-items:center; gap:8px;">
              <span>📈 Corba d'Equitat & Evolució del Capital</span>
              <span class="badge badge--info" style="font-size:0.7rem;">Sèrie Cronològica</span>
            </div>
            <div class="card__subtitle" style="font-size:0.8rem; color:var(--text-secondary);">
              Trajectòria acumulada trade a trade des de la primera execució
            </div>
          </div>
          <div style="font-size:0.75rem; color:var(--text-secondary); text-align:right;">
            Max Drawdown: <strong style="color:var(--color-error);">${formatCurrency(report.maxDrawdownEUR)} (${report.maxDrawdownPct}%)</strong> | Sharpe: <strong>${report.sharpeRatio}</strong> | Sortino: <strong>${report.sortinoRatio}</strong>
          </div>
        </div>
        <div style="overflow-x:auto;">
          ${renderEquityCurveSvg(report.equityCurve)}
        </div>
      </div>

      <!-- Desglossament per Classe d'Actiu & Estil Temporal -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap:var(--space-lg); margin-bottom:var(--space-xl);">
        
        <div class="card">
          <h3 style="margin:0 0 var(--space-md) 0; font-size:1rem; font-weight:800; display:flex; align-items:center; gap:8px;">
            <span>🏷️ Rendiment per Classe d'Actiu</span>
          </h3>
          <div style="display:flex; flex-direction:column; gap:var(--space-sm);">
            ${report.assetClasses.map(ac => `
              <div style="background:var(--bg-surface-elevated); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:1.2rem;">${ac.icon}</span>
                  <div>
                    <div style="font-weight:700; font-size:0.85rem;">${ac.label}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted);">${ac.tradesCount} trades | Win Rate: ${ac.winRate}%</div>
                  </div>
                </div>
                <div style="text-align:right;">
                  <div style="font-weight:800; font-family:var(--font-mono); color:${ac.netPnL >= 0 ? 'var(--color-success)' : 'var(--color-error)'}; font-size:0.95rem;">
                    ${ac.netPnL >= 0 ? '+' : ''}${formatCurrency(ac.netPnL)}
                  </div>
                  <div style="font-size:0.7rem; color:var(--text-muted);">PF: ${ac.profitFactor.toFixed(2)} | IRPF: ~${formatCurrency(ac.taxDragEUR)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 var(--space-md) 0; font-size:1rem; font-weight:800; display:flex; align-items:center; gap:8px;">
            <span>⏱️ Eficiència segons el Temps de Permanència</span>
          </h3>
          <div style="display:flex; flex-direction:column; gap:var(--space-sm);">
            ${report.styles.map(st => `
              <div style="background:var(--bg-surface-elevated); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-weight:700; font-size:0.85rem;">${st.label}</div>
                  <div style="font-size:0.7rem; color:var(--text-muted);">${st.tradesCount} trades | Permanència mitjana: ${st.avgHoldingDays} dies</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-weight:800; font-family:var(--font-mono); color:${st.netPnL >= 0 ? 'var(--color-success)' : 'var(--color-error)'}; font-size:0.95rem;">
                    ${st.netPnL >= 0 ? '+' : ''}${formatCurrency(st.netPnL)}
                  </div>
                  <div style="font-size:0.7rem; color:var(--text-muted);">WR: ${st.winRate}% | Mitjà: ${formatCurrency(st.avgPnLPerTrade)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;
  }

  // ── 2. LABORATORI DE BACKTESTING INSTITUCIONAL ─────────────────────────────
  function renderBacktestLaboratoryView(bt: BacktestReport): string {
    const isOutperforming = bt.strategyEdgeOverRealEUR >= 0;

    // Filtrar operacions per a la taula d'inspecció
    const filteredTrades = bt.trades.filter(t => {
      if (backtestTradeFilter === 'MODIFIED') return t.wasModifiedByStrategy;
      if (backtestTradeFilter === 'STOP_LOSS') return t.exitReason === 'STOP_LOSS';
      if (backtestTradeFilter === 'TAKE_PROFIT') return t.exitReason === 'TAKE_PROFIT';
      return true;
    });

    return `
      <!-- Panell de Configuració Paramètrica del Backtest -->
      <div class="card" style="margin-bottom:var(--space-xl); background:linear-gradient(135deg, var(--bg-surface-elevated), var(--bg-surface)); border:1px solid var(--border-accent);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-md);">
          <div>
            <h2 style="margin:0 0 4px 0; font-size:1.3rem; font-weight:900; display:flex; align-items:center; gap:8px;">
              <span>🧪 Laboratori de Backtesting Quant & Optimització Walk-Forward</span>
            </h2>
            <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">
              Simulació exacta sobre les teves dades reals sense hipòtesis sintètiques. Ajusta regles, slippage i comissions.
            </p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn--secondary btn--sm" id="btn-export-backtest-csv">
              📥 Descarregar CSV Backtest
            </button>
            <button class="btn btn--primary btn--sm" id="btn-re-run-backtest">
              ⚡ Recalcular Backtest
            </button>
          </div>
        </div>

        <!-- Controls Interactius de Paràmetres -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-md); background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
          
          <div>
            <label class="form-label" style="font-size:0.75rem; font-weight:700;">Estratègia de Backtest:</label>
            <select class="form-select" id="bt-strategy-type" style="font-size:0.8rem; width:100%;">
              <option value="trend_breakout" ${backtestParams.strategyType === 'trend_breakout' ? 'selected' : ''}>📈 Trend Breakout + Trailing</option>
              <option value="mean_reversion" ${backtestParams.strategyType === 'mean_reversion' ? 'selected' : ''}>🌊 Mean Reversion / Dip Buying</option>
              <option value="momentum_pullback" ${backtestParams.strategyType === 'momentum_pullback' ? 'selected' : ''}>⚡ Momentum Pullback (50% Ret.)</option>
              <option value="volatility_squeeze" ${backtestParams.strategyType === 'volatility_squeeze' ? 'selected' : ''}>💥 Volatility Squeeze (ATR)</option>
              <option value="dca_smart_rebalance" ${backtestParams.strategyType === 'dca_smart_rebalance' ? 'selected' : ''}>💎 DCA Smart Rebalance</option>
            </select>
          </div>

          <div>
            <label class="form-label" style="font-size:0.75rem; font-weight:700;">Stop Loss (%):</label>
            <div style="display:flex; align-items:center; gap:6px;">
              <input type="range" id="bt-sl-range" min="1" max="15" step="0.5" value="${backtestParams.stopLossPercent}" style="flex:1;" />
              <span id="bt-sl-val" style="font-family:var(--font-mono); font-weight:800; font-size:0.85rem; width:38px;">-${backtestParams.stopLossPercent}%</span>
            </div>
          </div>

          <div>
            <label class="form-label" style="font-size:0.75rem; font-weight:700;">Take Profit (%):</label>
            <div style="display:flex; align-items:center; gap:6px;">
              <input type="range" id="bt-tp-range" min="3" max="40" step="1" value="${backtestParams.takeProfitPercent}" style="flex:1;" />
              <span id="bt-tp-val" style="font-family:var(--font-mono); font-weight:800; font-size:0.85rem; width:38px;">+${backtestParams.takeProfitPercent}%</span>
            </div>
          </div>

          <div>
            <label class="form-label" style="font-size:0.75rem; font-weight:700;">Dimensionament (Sizing):</label>
            <select class="form-select" id="bt-sizing-model" style="font-size:0.8rem; width:100%;">
              <option value="actual_trade_capital" ${backtestParams.sizingModel === 'actual_trade_capital' ? 'selected' : ''}>💎 Capital Real per Operació (Exacte)</option>
              <option value="half_kelly" ${backtestParams.sizingModel === 'half_kelly' ? 'selected' : ''}>🛡️ Half-Kelly Conservador</option>
              <option value="fixed_fractional" ${backtestParams.sizingModel === 'fixed_fractional' ? 'selected' : ''}>📊 1.5% Risc Fix per Trade</option>
              <option value="fixed_eur" ${backtestParams.sizingModel === 'fixed_eur' ? 'selected' : ''}>💶 2.000 € Import Fix</option>
              <option value="volatility_parity" ${backtestParams.sizingModel === 'volatility_parity' ? 'selected' : ''}>⚖️ Paritat de Volatilitat</option>
            </select>
          </div>

          <div>
            <label class="form-label" style="font-size:0.75rem; font-weight:700;">Split Walk-Forward:</label>
            <select class="form-select" id="bt-wf-split" style="font-size:0.8rem; width:100%;">
              <option value="70" ${backtestParams.walkForwardSplitPercent === 70 ? 'selected' : ''}>70% In-Sample / 30% OOS</option>
              <option value="80" ${backtestParams.walkForwardSplitPercent === 80 ? 'selected' : ''}>80% In-Sample / 20% OOS</option>
              <option value="60" ${backtestParams.walkForwardSplitPercent === 60 ? 'selected' : ''}>60% In-Sample / 40% OOS</option>
            </select>
          </div>

        </div>
      </div>

      <!-- Resultats Clau del Backtest: Scorecards -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-xl); text-align:center;">
        
        <div class="card" style="border-top:4px solid var(--color-primary);">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">P&L Simulat Backtest</div>
          <div style="font-size:1.8rem; font-weight:900; font-family:var(--font-mono); color:${bt.totalNetPnL >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
            ${bt.totalNetPnL >= 0 ? '+' : ''}${formatCurrency(bt.totalNetPnL)}
          </div>
          <div style="font-size:0.7rem; color:var(--text-secondary);">
            Edge vs Real: <strong style="color:${isOutperforming ? 'var(--color-success)' : 'var(--color-error)'};">${isOutperforming ? '+' : ''}${formatCurrency(bt.strategyEdgeOverRealEUR)}</strong>
          </div>
        </div>

        <div class="card" style="border-top:4px solid var(--accent-start);">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">System Quality Number (SQN)</div>
          <div style="font-size:1.8rem; font-weight:900; font-family:var(--font-mono); color:var(--accent-start);">
            ${bt.sqn.toFixed(2)}
            <span class="badge badge--success" style="font-size:0.7rem; vertical-align:middle;">${bt.sqnRating}</span>
          </div>
          <div style="font-size:0.7rem; color:var(--text-secondary);">Van Tharp Quality Score</div>
        </div>

        <div class="card" style="border-top:4px solid ${bt.isRobustWalkForward ? 'var(--color-success)' : 'var(--color-warning)'};">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Walk-Forward Efficiency (WFE)</div>
          <div style="font-size:1.8rem; font-weight:900; font-family:var(--font-mono); color:${bt.isRobustWalkForward ? 'var(--color-success)' : 'var(--color-warning)'};">
            ${bt.walkForwardEfficiencyRatio}%
          </div>
          <div style="font-size:0.7rem; color:var(--text-secondary);">${bt.isRobustWalkForward ? '✅ Model Robust (Sense Curve-Fitting)' : '⚠️ Risc de Sobreajust'}</div>
        </div>

        <div class="card" style="border-top:4px solid ${bt.isEdgeStatisticallySignificant ? 'var(--color-success)' : 'var(--color-info)'};">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Test Monte Carlo (p-value)</div>
          <div style="font-size:1.8rem; font-weight:900; font-family:var(--font-mono); color:${bt.isEdgeStatisticallySignificant ? 'var(--color-success)' : 'var(--color-info)'};">
            p = ${bt.monteCarloPValue}
          </div>
          <div style="font-size:0.7rem; color:var(--text-secondary);">${bt.isEdgeStatisticallySignificant ? '⭐ Edge Estadístic Significatiu (p < 0.05)' : 'Edge Dins de l\'Atzar Normal'}</div>
        </div>

        <div class="card" style="border-top:4px solid var(--color-info);">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Profit Factor & Payoff</div>
          <div style="font-size:1.8rem; font-weight:900; font-family:var(--font-mono); color:var(--color-info);">
            ${bt.profitFactor.toFixed(2)}
          </div>
          <div style="font-size:0.7rem; color:var(--text-secondary);">Payoff: <strong>${bt.payoffRatio.toFixed(2)}</strong> | WR: <strong>${bt.winRate}%</strong></div>
        </div>

      </div>

      <!-- Corba d'Equitat Comparativa Triple: Backtest vs Real vs Benchmark -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm); margin-bottom:var(--space-md);">
          <div>
            <div class="card__title" style="display:flex; align-items:center; gap:8px;">
              <span>📈 Comparativa de Corba d'Equitat (Backtest vs Real vs S&P 500 Ponderat)</span>
            </div>
            <div class="card__subtitle" style="font-size:0.8rem; color:var(--text-secondary);">
              Línia divisòria discontinua: In-Sample (Entrenament) vs Out-of-Sample (Validació Cega)
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:12px; font-size:0.75rem;">
            <span style="display:flex; align-items:center; gap:4px;">
              <span style="display:inline-block; width:12px; height:3px; background:var(--color-primary);"></span>
              <strong>Estratègia Optimizada</strong>
            </span>
            <span style="display:flex; align-items:center; gap:4px;">
              <span style="display:inline-block; width:12px; height:3px; background:#10b981;"></span>
              <strong>Operativa Real</strong>
            </span>
            <span style="display:flex; align-items:center; gap:4px;">
              <span style="display:inline-block; width:12px; height:3px; background:#6366f1;"></span>
              <strong>Benchmark S&P 500</strong>
            </span>
          </div>
        </div>

        <div style="overflow-x:auto;">
          ${renderBacktestEquityCurveSvg(bt.equityCurve)}
        </div>
      </div>

      <!-- Taula de Validació Walk-Forward (In-Sample vs Out-of-Sample) -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap:var(--space-lg); margin-bottom:var(--space-xl);">
        
        <div class="card" style="border-left:4px solid var(--color-info);">
          <h3 style="margin:0 0 var(--space-sm) 0; font-size:1rem; font-weight:800;">
            📊 Fase In-Sample (${backtestParams.walkForwardSplitPercent}% Dades Històriques)
          </h3>
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:var(--space-sm); font-size:0.85rem;">
            <div>Operacions: <strong>${bt.inSampleMetrics.tradesCount}</strong></div>
            <div>P&L: <strong style="color:${bt.inSampleMetrics.netPnL >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(bt.inSampleMetrics.netPnL)}</strong></div>
            <div>Win Rate: <strong>${bt.inSampleMetrics.winRate}%</strong></div>
            <div>Profit Factor: <strong>${bt.inSampleMetrics.profitFactor.toFixed(2)}</strong></div>
          </div>
        </div>

        <div class="card" style="border-left:4px solid ${bt.isRobustWalkForward ? 'var(--color-success)' : 'var(--color-warning)'};">
          <h3 style="margin:0 0 var(--space-sm) 0; font-size:1rem; font-weight:800;">
            🎯 Fase Out-of-Sample (${100 - backtestParams.walkForwardSplitPercent}% Validació Cega)
          </h3>
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:var(--space-sm); font-size:0.85rem;">
            <div>Operacions: <strong>${bt.outOfSampleMetrics.tradesCount}</strong></div>
            <div>P&L: <strong style="color:${bt.outOfSampleMetrics.netPnL >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(bt.outOfSampleMetrics.netPnL)}</strong></div>
            <div>Win Rate: <strong>${bt.outOfSampleMetrics.winRate}%</strong></div>
            <div>Profit Factor: <strong>${bt.outOfSampleMetrics.profitFactor.toFixed(2)}</strong></div>
          </div>
        </div>

      </div>

      <!-- Matriu de Sensibilitat Paramètrica 4x4 (Grid Search Heatmap) -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="margin-bottom:var(--space-md);">
          <div class="card__title" style="display:flex; align-items:center; gap:8px;">
            <span>🔬 Matriu de Sensibilitat Paramètrica (Grid Search 4x4)</span>
            <span class="badge badge--secondary">Dades Reals del Compte</span>
          </div>
          <div class="card__subtitle" style="font-size:0.8rem; color:var(--text-secondary);">
            Comprova si el rendiment es manté estable en un rang ampli de Stop Loss i Take Profit o si depèn d'un pic sobreoptimitzat
          </div>
        </div>

        <div class="table-responsive">
          <table class="table" style="width:100%; text-align:center;">
            <thead>
              <tr>
                <th style="text-align:left;">Stop Loss \\ Take Profit</th>
                <th>TP +8%</th>
                <th>TP +15%</th>
                <th>TP +25%</th>
                <th>TP +40%</th>
              </tr>
            </thead>
            <tbody>
              ${[3, 5, 8, 12].map(sl => `
                <tr>
                  <td style="text-align:left; font-weight:800;">SL -${sl}%</td>
                  ${[8, 15, 25, 40].map(tp => {
                    const match = bt.sensitivityMatrix.find(m => m.stopLossPercent === sl && m.takeProfitPercent === tp);
                    const pnl = match ? match.netPnL : 0;
                    const pf = match ? match.profitFactor : 1;
                    const isPos = pnl > 0;
                    return `
                      <td style="background:${isPos ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'}; border:1px solid var(--border-default);">
                        <div style="font-weight:900; font-family:var(--font-mono); color:${isPos ? 'var(--color-success)' : 'var(--color-error)'}; font-size:0.85rem;">
                          ${isPos ? '+' : ''}${formatCurrency(pnl)}
                        </div>
                        <div style="font-size:0.65rem; color:var(--text-muted);">PF: ${pf.toFixed(2)}</div>
                      </td>
                    `;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Inspector Detallat Trade a Trade (Dades 100% Reals) -->
      <div class="card">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-md);">
          <div>
            <div class="card__title" style="display:flex; align-items:center; gap:8px;">
              <span>📋 Auditoria Detallada d'Execució Trade a Trade</span>
              <span class="badge badge--primary">${filteredTrades.length} operacions</span>
            </div>
            <div class="card__subtitle" style="font-size:0.8rem; color:var(--text-secondary);">
              Inspecciona com hauria actuat el model en cada posició real del teu compte
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <label style="font-size:0.75rem; font-weight:700; color:var(--text-secondary);">Filtrar:</label>
            <select class="form-select" id="bt-trade-filter-select" style="font-size:0.75rem; padding:4px 8px;">
              <option value="ALL" ${backtestTradeFilter === 'ALL' ? 'selected' : ''}>Totes les Operacions</option>
              <option value="MODIFIED" ${backtestTradeFilter === 'MODIFIED' ? 'selected' : ''}>⚡ Només Modificades per Estratègia</option>
              <option value="STOP_LOSS" ${backtestTradeFilter === 'STOP_LOSS' ? 'selected' : ''}>🛑 Només Stop Loss Executats</option>
              <option value="TAKE_PROFIT" ${backtestTradeFilter === 'TAKE_PROFIT' ? 'selected' : ''}>🎯 Només Take Profit Executats</option>
            </select>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>#</th>
                <th>Actiu / Ticker</th>
                <th>Dates & Durada</th>
                <th style="text-align:right;">Capital Real</th>
                <th style="text-align:right;">P&L Real</th>
                <th style="text-align:right;">P&L Simulat</th>
                <th style="text-align:center;">Sortida Estratègia</th>
                <th style="text-align:right;">R-Multiple</th>
                <th style="text-align:center;">Fase</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTrades.map(t => {
                let badgeClass = 'badge--secondary';
                if (t.exitReason === 'STOP_LOSS') badgeClass = 'badge--error';
                else if (t.exitReason === 'TAKE_PROFIT') badgeClass = 'badge--success';
                else if (t.exitReason === 'TRAILING_STOP') badgeClass = 'badge--info';
                
                return `
                  <tr style="${t.wasModifiedByStrategy ? 'background:rgba(99, 102, 241, 0.04);' : ''}">
                    <td><strong>${t.tradeIndex}</strong></td>
                    <td>
                      <strong>${t.concept}</strong>
                      ${t.wasModifiedByStrategy ? '<span class="badge badge--primary" style="font-size:0.65rem; margin-left:4px;">Modificat</span>' : ''}
                    </td>
                    <td>
                      <div style="font-size:0.75rem;">${t.entryDate} → ${t.exitDate}</div>
                      <div style="font-size:0.65rem; color:var(--text-muted);">${t.holdingDays} dies</div>
                    </td>
                    <td style="text-align:right; font-family:var(--font-mono);">${formatCurrency(t.initialPositionSizeEUR)}</td>
                    <td style="text-align:right; font-family:var(--font-mono); color:${t.actualPnL >= 0 ? 'var(--color-success)' : 'var(--color-error)'}; font-weight:700;">
                      ${t.actualPnL >= 0 ? '+' : ''}${formatCurrency(t.actualPnL)} (${t.actualReturnPct}%)
                    </td>
                    <td style="text-align:right; font-family:var(--font-mono); color:${t.simulatedPnL >= 0 ? 'var(--color-success)' : 'var(--color-error)'}; font-weight:900;">
                      ${t.simulatedPnL >= 0 ? '+' : ''}${formatCurrency(t.simulatedPnL)} (${t.simulatedReturnPct}%)
                    </td>
                    <td style="text-align:center;">
                      <span class="badge ${badgeClass}" style="font-size:0.7rem;">${t.exitReason}</span>
                    </td>
                    <td style="text-align:right; font-weight:800; font-family:var(--font-mono); color:${t.rMultiple >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                      ${t.rMultiple >= 0 ? '+' : ''}${t.rMultiple}R
                    </td>
                    <td style="text-align:center;">
                      <span class="badge ${t.isOutOfSample ? 'badge--warning' : 'badge--info'}" style="font-size:0.65rem;">
                        ${t.isOutOfSample ? 'OOS' : 'IS'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── 3. CALENDARI & MAPA DE CALOR P&L DIARI ─────────────────────────────────
  function renderCalendarHeatmapView(report: InvestmentCockpitReport): string {
    const days = report.dailyCalendarHeatmap;
    const dayOfWeek = report.dayOfWeekAnalytics;

    return `
      <!-- Mapa de Calor P&L Diari -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="margin-bottom:var(--space-md); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
          <div>
            <div class="card__title" style="display:flex; align-items:center; gap:8px;">
              <span>📅 Mapa de Calor de Rendibilitat Diària</span>
              <span class="badge badge--primary">${days.length} dies amb activitat</span>
            </div>
            <div class="card__subtitle" style="font-size:0.8rem; color:var(--text-secondary);">
              Supervisió cronològica de sessions guanyadores i perdedores al llarg de l'any
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; font-size:0.75rem; color:var(--text-muted);">
            <span>Pèrdua forta</span>
            <span style="display:inline-block; width:12px; height:12px; border-radius:2px; background:#ef4444;"></span>
            <span style="display:inline-block; width:12px; height:12px; border-radius:2px; background:#f87171;"></span>
            <span style="display:inline-block; width:12px; height:12px; border-radius:2px; background:var(--bg-surface-elevated); border:1px solid var(--border-default);"></span>
            <span style="display:inline-block; width:12px; height:12px; border-radius:2px; background:#34d399;"></span>
            <span style="display:inline-block; width:12px; height:12px; border-radius:2px; background:#10b981;"></span>
            <span>Guany fort</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:8px; margin-bottom:var(--space-lg);">
          ${days.map(d => {
            const isPos = d.pnl > 0;
            const isNeg = d.pnl < 0;
            let bg = 'var(--bg-surface-elevated)';
            let borderColor = 'var(--border-default)';
            if (isPos) {
              bg = d.intensity >= 3 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.12)';
              borderColor = 'rgba(16, 185, 129, 0.5)';
            } else if (isNeg) {
              bg = d.intensity >= 3 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.12)';
              borderColor = 'rgba(239, 68, 68, 0.5)';
            }
            return `
              <div style="background:${bg}; border:1px solid ${borderColor}; padding:8px 10px; border-radius:var(--radius-sm); text-align:center;">
                <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">${d.date}</div>
                <div style="font-size:0.95rem; font-weight:900; font-family:var(--font-mono); color:${isPos ? 'var(--color-success)' : (isNeg ? 'var(--color-error)' : 'var(--text-secondary)')};">
                  ${isPos ? '+' : ''}${formatCurrency(d.pnl)}
                </div>
                <div style="font-size:0.65rem; color:var(--text-secondary);">${d.tradesCount} operacion/s</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Rendiment per Dia de la Setmana -->
      <div class="card">
        <h3 style="margin:0 0 var(--space-md) 0; font-size:1rem; font-weight:800; display:flex; align-items:center; gap:8px;">
          <span>📊 Rendibilitat per Dia de la Setmana</span>
        </h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:var(--space-md); text-align:center;">
          ${dayOfWeek.map(dw => `
            <div style="background:var(--bg-surface-elevated); padding:12px; border-radius:var(--radius-md); border:1px solid var(--border-default);">
              <div style="font-size:0.8rem; font-weight:700; color:var(--text-primary);">${dw.dayName}</div>
              <div style="font-size:1.3rem; font-weight:900; font-family:var(--font-mono); margin:4px 0; color:${dw.netPnL >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                ${dw.netPnL >= 0 ? '+' : ''}${formatCurrency(dw.netPnL)}
              </div>
              <div style="font-size:0.7rem; color:var(--text-muted);">
                ${dw.tradesCount} trades | WR: <strong>${dw.winRate}%</strong>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ── 4. ANÀLISI PER SETUPS & ESTRATÈGIES ─────────────────────────────────────
  function renderSetupsView(report: InvestmentCockpitReport): string {
    const setups = report.setups;

    return `
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="margin-bottom:var(--space-md);">
          <div class="card__title" style="display:flex; align-items:center; gap:8px;">
            <span>🏷️ Rànquing d'Eficiència per Setups & Estratègies</span>
            <span class="badge badge--primary">Estratègies Auditades</span>
          </div>
          <div class="card__subtitle" style="font-size:0.8rem; color:var(--text-secondary);">
            Descobreix quins patrons tècnics generen el teu 'Edge' matemàtic real i quins has d'eliminar de la teva operativa
          </div>
        </div>

        <div class="table-responsive">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Setup / Estratègia</th>
                <th style="text-align:right;">Operacions</th>
                <th style="text-align:right;">Win Rate</th>
                <th style="text-align:right;">Profit Factor</th>
                <th style="text-align:right;">Retorn Mitjà</th>
                <th style="text-align:right;">Avg R-Multiple</th>
                <th style="text-align:right;">Guanys Bruts</th>
                <th style="text-align:right;">Pèrdues Brutes</th>
                <th style="text-align:right;">P&L Net</th>
              </tr>
            </thead>
            <tbody>
              ${setups.map((s, idx) => `
                <tr style="${idx === 0 && s.netPnL > 0 ? 'background:rgba(16, 185, 129, 0.04);' : ''}">
                  <td>
                    <strong>${s.setup}</strong>
                    ${idx === 0 && s.netPnL > 0 ? '<span class="badge badge--success" style="font-size:0.65rem; margin-left:6px;">Top Performer</span>' : ''}
                  </td>
                  <td style="text-align:right;">${s.tradesCount}</td>
                  <td style="text-align:right; font-weight:700; color:${s.winRate >= 50 ? 'var(--color-success)' : 'var(--color-error)'};">${s.winRate}%</td>
                  <td style="text-align:right; font-weight:700;">${s.profitFactor.toFixed(2)}</td>
                  <td style="text-align:right;">${s.avgReturnPct >= 0 ? '+' : ''}${s.avgReturnPct}%</td>
                  <td style="text-align:right; font-weight:700; color:${s.avgRMultiple >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                    ${s.avgRMultiple >= 0 ? '+' : ''}${s.avgRMultiple}R
                  </td>
                  <td style="text-align:right; color:var(--color-success); font-family:var(--font-mono);">+${formatCurrency(s.grossProfit)}</td>
                  <td style="text-align:right; color:var(--color-error); font-family:var(--font-mono);">-${formatCurrency(s.grossLoss)}</td>
                  <td style="text-align:right; font-weight:900; font-family:var(--font-mono); color:${s.netPnL >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                    ${s.netPnL >= 0 ? '+' : ''}${formatCurrency(s.netPnL)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── 5. DIARI D'OPERACIONS & TAGGING ────────────────────────────────────────
  function renderJournalView(report: InvestmentCockpitReport): string {
    const list = report.enrichedTrades.filter(t => {
      if (searchQuery.trim() === '') return true;
      const q = searchQuery.toLowerCase();
      return (t.concept || '').toLowerCase().includes(q) ||
             (t.setup || '').toLowerCase().includes(q) ||
             (t.emotionTag || '').toLowerCase().includes(q) ||
             (t.notes || '').toLowerCase().includes(q);
    });

    return `
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-md);">
          <div>
            <div class="card__title" style="display:flex; align-items:center; gap:8px;">
              <span>📝 Diari d'Operacions & Tagging Professional</span>
              <span class="badge badge--primary">${list.length} registres</span>
            </div>
            <div class="card__subtitle" style="font-size:0.8rem; color:var(--text-secondary);">
              Anota setups, emocions, ràtios R-Multiple i lliçons apreses per a cada posició
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <input type="text" id="journal-search-input" class="form-input" placeholder="🔍 Cercar per ticker, setup o nota..." value="${searchQuery}" style="font-size:0.8rem; padding:4px 10px; width:220px;" />
          </div>
        </div>

        <div class="table-responsive">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Data / Actiu</th>
                <th>Setup</th>
                <th>Emoció / Nota</th>
                <th style="text-align:center;">Grau</th>
                <th style="text-align:right;">R-Multiple</th>
                <th style="text-align:right;">P&L (€)</th>
                <th style="text-align:right;">Retorn %</th>
                <th style="text-align:center;">Acció</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(t => `
                <tr>
                  <td>
                    <strong>${t.concept}</strong>
                    <div style="font-size:0.7rem; color:var(--text-muted);">${t.dateStr} | ${t.assetClass.toUpperCase()}</div>
                  </td>
                  <td>
                    <span class="badge badge--secondary" style="font-size:0.7rem;">${t.setup}</span>
                  </td>
                  <td>
                    <div style="font-size:0.8rem; font-weight:600;">${t.emotionTag}</div>
                    ${t.notes ? `<div style="font-size:0.7rem; color:var(--text-secondary); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">💬 ${t.notes}</div>` : ''}
                  </td>
                  <td style="text-align:center;">
                    <span class="badge ${t.executionGrade === 'A+' || t.executionGrade === 'A' ? 'badge--success' : (t.executionGrade === 'B' ? 'badge--info' : 'badge--warning')}" style="font-size:0.75rem;">
                      ${t.executionGrade}
                    </span>
                  </td>
                  <td style="text-align:right; font-weight:800; font-family:var(--font-mono); color:${t.rMultiple >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                    ${t.rMultiple >= 0 ? '+' : ''}${t.rMultiple}R
                  </td>
                  <td style="text-align:right; font-weight:900; font-family:var(--font-mono); color:${t.pnl >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                    ${t.pnl >= 0 ? '+' : ''}${formatCurrency(t.pnl)}
                  </td>
                  <td style="text-align:right; font-weight:700; color:${t.returnPct >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                    ${t.returnPct >= 0 ? '+' : ''}${t.returnPct}%
                  </td>
                  <td style="text-align:center;">
                    <button class="btn btn--secondary btn--sm btn-edit-journal-item" data-id="${t.id}">
                      ✏️ Editar
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── 6. MILLORA KAIZEN & CHECKLIST ──────────────────────────────────────────
  function renderKaizenView(report: InvestmentCockpitReport): string {
    const pm = report.postMortem;

    return `
      <!-- Banner Kaizen 1% -->
      <div class="card" style="margin-bottom:var(--space-xl); background:linear-gradient(135deg, var(--bg-surface-elevated), var(--bg-surface)); border:1px solid var(--border-accent);">
        <h2 style="margin:0 0 6px 0; font-size:1.3rem; font-weight:800;">
          🧘 Filosofia Kaizen: Millora l'1% de la teva operativa cada dia
        </h2>
        <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">
          La consistència no neix de la sort sinó de regles estrictes, anàlisi de fallades i eliminació sistemàtica de biaixos.
        </p>
      </div>

      <!-- Regles d'Or Kaizen Personalitzades -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <h3 style="margin:0 0 var(--space-md) 0; font-size:1rem; font-weight:800; display:flex; align-items:center; gap:8px;">
          <span>📜 Les teves Regles d'Or Personalitzades (Basades en les teves Dades)</span>
        </h3>
        <div style="display:flex; flex-direction:column; gap:var(--space-sm);">
          ${pm.kaizenGoldenRules.map((rule) => `
            <div style="background:var(--bg-surface-elevated); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; align-items:center; gap:var(--space-md);">
              <span style="font-size:1.2rem;">⭐</span>
              <div style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">${rule}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Checklist Pre-Sessió & Post-Sessió -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap:var(--space-lg);">
        
        <div class="card">
          <h3 style="margin:0 0 var(--space-md) 0; font-size:1rem; font-weight:800; color:var(--color-primary);">
            ☀️ Checklist Pre-Sessió (Abans d'obrir qualsevol posició)
          </h3>
          <div style="display:flex; flex-direction:column; gap:var(--space-sm);">
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;">
              <input type="checkbox" checked /> El mercat acompanya la tendència general del setup
            </label>
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;">
              <input type="checkbox" checked /> Stop Loss tècnic definit abans d'enviar l'ordre
            </label>
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;">
              <input type="checkbox" checked /> Risc màxim calculat segons el Criteri de Kelly / 1R
            </label>
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;">
              <input type="checkbox" checked /> Estat mental neutre (sense venjança ni pressa per recuperar)
            </label>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 var(--space-md) 0; font-size:1rem; font-weight:800; color:var(--color-success);">
            🌙 Checklist Post-Sessió (En tancar la jornada)
          </h3>
          <div style="display:flex; flex-direction:column; gap:var(--space-sm);">
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;">
              <input type="checkbox" checked /> Totes les operacions registrades al Diari de Trading
            </label>
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;">
              <input type="checkbox" checked /> Qualificació d'execució (A+, A, B, C, F) assignada
            </label>
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;">
              <input type="checkbox" checked /> Cap pèrdua supera el límit diari permès
            </label>
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;">
              <input type="checkbox" checked /> Reflexió de la lliçó principal apresa avui anotada
            </label>
          </div>
        </div>

      </div>
    `;
  }

  // ── 7. SIMULADOR WHAT-IF & MONTE CARLO ──────────────────────────────────────
  function renderWhatIfView(report: InvestmentCockpitReport, mcResult: ReturnType<typeof runMonteCarloSimulation>): string {
    const s5 = report.whatIfStrictStopLoss5Pct;
    const s8 = report.whatIfStrictStopLoss8Pct;
    const sW = report.whatIfNoWashSales;

    return `
      <!-- Escenaris Comparatius What-If -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:var(--space-lg); margin-bottom:var(--space-xl);">
        
        <div class="card" style="border-top:4px solid var(--color-success);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-sm);">
            <h3 style="margin:0; font-size:0.95rem; font-weight:800;">🛑 Stop Loss Estricte al -5%</h3>
            <span class="badge badge--success">${s5.tradesModifiedCount} trades tallats</span>
          </div>
          <div style="font-size:1.8rem; font-weight:900; color:var(--color-success); font-family:var(--font-mono); margin-bottom:4px;">
            ${s5.simulatedNetPnL >= 0 ? '+' : ''}${formatCurrency(s5.simulatedNetPnL)}
          </div>
          <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:var(--space-sm);">
            Guany extra vs Real: <strong style="color:var(--color-success);">+${formatCurrency(s5.pnlDifferenceEUR)}</strong>
          </div>
          <p style="font-size:0.75rem; color:var(--text-muted); line-height:1.4; margin:0;">
            ${s5.explanation}
          </p>
        </div>

        <div class="card" style="border-top:4px solid var(--accent-start);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-sm);">
            <h3 style="margin:0; font-size:0.95rem; font-weight:800;">🛡️ Stop Loss Estricte al -8%</h3>
            <span class="badge badge--primary">${s8.tradesModifiedCount} trades tallats</span>
          </div>
          <div style="font-size:1.8rem; font-weight:900; color:var(--accent-start); font-family:var(--font-mono); margin-bottom:4px;">
            ${s8.simulatedNetPnL >= 0 ? '+' : ''}${formatCurrency(s8.simulatedNetPnL)}
          </div>
          <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:var(--space-sm);">
            Guany extra vs Real: <strong style="color:var(--color-success);">+${formatCurrency(s8.pnlDifferenceEUR)}</strong>
          </div>
          <p style="font-size:0.75rem; color:var(--text-muted); line-height:1.4; margin:0;">
            ${s8.explanation}
          </p>
        </div>

        <div class="card" style="border-top:4px solid var(--color-warning);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-sm);">
            <h3 style="margin:0; font-size:0.95rem; font-weight:800;">🏛️ Optimització Regla 2 Mesos</h3>
            <span class="badge badge--warning">${sW.tradesModifiedCount} recomptes</span>
          </div>
          <div style="font-size:1.8rem; font-weight:900; color:var(--color-warning); font-family:var(--font-mono); margin-bottom:4px;">
            +${formatCurrency(sW.pnlDifferenceEUR)}
          </div>
          <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:var(--space-sm);">
            Deducció fiscal líquida addicional
          </div>
          <p style="font-size:0.75rem; color:var(--text-muted); line-height:1.4; margin:0;">
            ${sW.explanation}
          </p>
        </div>

      </div>

      <!-- Simulador Estocàstic Monte Carlo (1.000 Camins) -->
      <div class="card">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md); flex-wrap:wrap; gap:var(--space-sm);">
          <div>
            <div class="card__title" style="display:flex; align-items:center; gap:8px;">
              <span>🔮 Projecció Estocàstica Monte Carlo (1.000 Camins)</span>
              <span class="badge badge--primary">Probabilitat & Drawdown</span>
            </div>
            <div class="card__subtitle" style="font-size:0.8rem; color:var(--text-secondary);">
              Simulació d'estrès probabilístic sobre la teva esperança matemàtica actual
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <label style="font-size:0.75rem; color:var(--text-muted);">Horitzó:</label>
            <select class="form-select" id="mc-horizon-select" style="font-size:0.75rem; padding:4px 8px;">
              <option value="50" ${monteCarloHorizon === 50 ? 'selected' : ''}>50 trades</option>
              <option value="100" ${monteCarloHorizon === 100 ? 'selected' : ''}>100 trades</option>
              <option value="250" ${monteCarloHorizon === 250 ? 'selected' : ''}>250 trades (~1 any)</option>
              <option value="500" ${monteCarloHorizon === 500 ? 'selected' : ''}>500 trades (~2 anys)</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-lg); text-align:center;">
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="font-size:0.75rem; color:var(--text-muted);">Capital Mediana (P50)</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--color-primary); font-family:var(--font-mono);">${formatCurrency(mcResult.medianFinalCapital)}</div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">Net IRPF: ${formatCurrency(mcResult.expectedAfterTaxWealth)}</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="font-size:0.75rem; color:var(--text-muted);">Pitjor Escenari (P5)</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--color-error); font-family:var(--font-mono);">${formatCurrency(mcResult.p5WorstCaseCapital)}</div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">Percentil 5% advers</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="font-size:0.75rem; color:var(--text-muted);">Millor Escenari (P95)</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--color-success); font-family:var(--font-mono);">${formatCurrency(mcResult.p95BestCaseCapital)}</div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">Percentil 95% òptim</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="font-size:0.75rem; color:var(--text-muted);">Prob. Drawdown >30%</div>
            <div style="font-size:1.4rem; font-weight:800; color:${mcResult.riskOfDrawdown30Pct > 15 ? 'var(--color-warning)' : 'var(--color-success)'}; font-family:var(--font-mono);">${mcResult.riskOfDrawdown30Pct}%</div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">${mcResult.riskOfDrawdown30Pct > 15 ? 'Risc Elevat' : 'Risc Controlat'}</div>
          </div>
        </div>

        <div style="overflow-x:auto;">
          ${renderMonteCarloFanChartSvg(mcResult.fanChartPoints, mcResult.initialCapital)}
        </div>
      </div>
    `;
  }

  // ── 8. TAX-LOSS HARVESTING ────────────────────────────────────────────────
  function renderHarvestingView(harvestPlan: ReturnType<typeof calculateTaxLossHarvesting>): string {
    return `
      <div class="card" style="margin-bottom:var(--space-xl); background:var(--bg-surface-elevated); border:2px solid var(--color-success);">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-sm); margin-bottom:var(--space-md);">
          <div>
            <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
              <span>🌾 Algorisme de Tax-Loss Harvesting Intel·ligent</span>
              <span class="badge badge--success">Estalvi directe IRPF</span>
            </div>
            <p class="card__subtitle" style="margin:4px 0 0 0; font-size:0.85rem; color:var(--text-secondary);">
              Propostes per tancar posicions amb pèrdues latents abans del 31/12 i reduir l'impost de l'estalvi a 0 €
            </p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Estalvi fiscal disponible</div>
            <div style="font-size:2rem; font-weight:800; color:var(--color-success); font-family:var(--font-mono);">
              +${formatCurrency(harvestPlan.projectedTaxSavingsEUR)}
            </div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:var(--space-sm);">
          ${harvestPlan.recommendedSales.length > 0 ? harvestPlan.recommendedSales.map(rec => `
            <div style="background:var(--bg-surface); padding:12px 16px; border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
              <div>
                <strong>${rec.tickerOrName}</strong> — Pèrdua latent: <span class="text-error">-${formatCurrency(rec.unrealizedLoss)}</span>
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${rec.washSaleWarning || 'Apte per a recol·lecció'}</div>
              </div>
              <div style="display:flex; gap:var(--space-sm); align-items:center;">
                <div style="text-align:right;">
                  <div style="font-size:0.75rem; color:var(--text-muted);">Venda recomanada:</div>
                  <strong>${formatCurrency(rec.amountToSellEUR)}</strong>
                </div>
                <button class="btn btn--secondary btn--sm btn-simulate-harvest" data-id="${rec.positionId}" data-ticker="${rec.tickerOrName}" data-amount="${rec.amountToSellEUR}" data-loss="${rec.unrealizedLoss}">
                  ⚡ Simular Venda
                </button>
              </div>
            </div>
          `).join('') : '<div class="text-muted text-sm" style="padding:16px; text-align:center;">No tens guanys pendents de compensar o no hi ha posicions amb pèrdues latents disponibles.</div>'}
        </div>
      </div>
    `;
  }

  // ── MODAL D'EDICIÓ DEL DIARI ───────────────────────────────────────────────
  function openJournalEditModal(trade: EnrichedTradeItem) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.65); backdrop-filter:blur(4px); display:flex; justify-content:center; align-items:center; z-index:9999; padding:var(--space-md);';

    modalOverlay.innerHTML = `
      <div class="card" style="width:100%; max-width:550px; background:var(--bg-surface); border:1px solid var(--border-accent); box-shadow:var(--shadow-xl); max-height:90vh; overflow-y:auto;">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
          <h3 style="margin:0; font-size:1.1rem; font-weight:800;">📝 Anotació al Diari de Trading</h3>
          <button class="btn btn--secondary btn--sm" id="btn-close-journal-modal" style="padding:2px 8px;">✕</button>
        </div>

        <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:var(--space-md); padding-bottom:var(--space-xs); border-bottom:1px solid var(--border-default);">
          Operació: <strong>${trade.concept}</strong> | P&L: <strong style="color:${trade.pnl >= 0 ? 'var(--color-success)' : 'var(--color-error)'}; font-family:var(--font-mono);">${formatCurrency(trade.pnl)}</strong> (${trade.dateStr})
        </div>

        <div style="display:flex; flex-direction:column; gap:var(--space-md);">
          <div>
            <label class="form-label" style="font-size:0.8rem; font-weight:700;">🏷️ Setup / Estratègia:</label>
            <select class="form-select" id="modal-trade-setup" style="width:100%;">
              <option value="Breakout" ${trade.setup === 'Breakout' ? 'selected' : ''}>Breakout (Trencament de Resistència/Suport)</option>
              <option value="Dip Buying / Reversió" ${trade.setup === 'Dip Buying / Reversió' ? 'selected' : ''}>Dip Buying / Reversió a la Mitjana</option>
              <option value="Trend Following" ${trade.setup === 'Trend Following' ? 'selected' : ''}>Trend Following (Seguiment de Tendència)</option>
              <option value="DCA / Acumulació" ${trade.setup === 'DCA / Acumulació' ? 'selected' : ''}>DCA / Inversió Periòdica Acumulativa</option>
              <option value="Earnings Play" ${trade.setup === 'Earnings Play' ? 'selected' : ''}>Earnings Play (Publicació de Resultats)</option>
              <option value="DeFi Yield / Staking" ${trade.setup === 'DeFi Yield / Staking' ? 'selected' : ''}>DeFi Yield / Staking Cripto</option>
              <option value="Swing Momentum" ${trade.setup === 'Swing Momentum' ? 'selected' : ''}>Swing Momentum</option>
              <option value="Intradia Momentum" ${trade.setup === 'Intradia Momentum' ? 'selected' : ''}>Intradia Momentum</option>
              <option value="Posicional Fonamental" ${trade.setup === 'Posicional Fonamental' ? 'selected' : ''}>Posicional Fonamental</option>
            </select>
          </div>

          <div>
            <label class="form-label" style="font-size:0.8rem; font-weight:700;">🧠 Emoció / Psicologia d'Entrada:</label>
            <select class="form-select" id="modal-trade-emotion" style="width:100%;">
              <option value="Pla Executat" ${trade.emotionTag === 'Pla Executat' ? 'selected' : ''}>🟢 Pla Executat amb Disciplina</option>
              <option value="FOMO" ${trade.emotionTag === 'FOMO' ? 'selected' : ''}>🔴 FOMO (Por a quedar-se fora)</option>
              <option value="Chasing Price" ${trade.emotionTag === 'Chasing Price' ? 'selected' : ''}>🟠 Chasing Price (Perseguir el preu a l'alça)</option>
              <option value="Panic Exit" ${trade.emotionTag === 'Panic Exit' ? 'selected' : ''}>🔴 Panic Exit (Sortida impulsiva per pànic)</option>
              <option value="Sortida Prematura" ${trade.emotionTag === 'Sortida Prematura' ? 'selected' : ''}>🟠 Sortida Prematura (Tallar guanys massa aviat)</option>
              <option value="Late Stop-Loss" ${trade.emotionTag === 'Late Stop-Loss' ? 'selected' : ''}>🔴 Late Stop-Loss (No respectar el stop inicial)</option>
              <option value="Averaging Down" ${trade.emotionTag === 'Averaging Down' ? 'selected' : ''}>🔴 Averaging Down (Mitjana a la baixa)</option>
              <option value="Execució Estàndard" ${trade.emotionTag === 'Execució Estàndard' ? 'selected' : ''}>⚪ Execució Estàndard</option>
            </select>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-md);">
            <div>
              <label class="form-label" style="font-size:0.8rem; font-weight:700;">⭐ Qualificació d'Execució:</label>
              <select class="form-select" id="modal-trade-grade" style="width:100%;">
                <option value="A+" ${trade.executionGrade === 'A+' ? 'selected' : ''}>A+ (Execució Perfecta)</option>
                <option value="A" ${trade.executionGrade === 'A' ? 'selected' : ''}>A (Bona Execució)</option>
                <option value="B" ${trade.executionGrade === 'B' ? 'selected' : ''}>B (Acceptable)</option>
                <option value="C" ${trade.executionGrade === 'C' ? 'selected' : ''}>C (Errors Menors)</option>
                <option value="F" ${trade.executionGrade === 'F' ? 'selected' : ''}>F (Indisciplina Total)</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size:0.8rem; font-weight:700;">🛡️ Risc Planificat 1R (€):</label>
              <input type="number" class="form-input" id="modal-trade-risk" value="${trade.riskAmountEUR || 50}" style="width:100%; font-family:var(--font-mono);" />
            </div>
          </div>

          <div>
            <label class="form-label" style="font-size:0.8rem; font-weight:700;">💬 Diari de Reflexió & Lliçons Apreses:</label>
            <textarea class="form-textarea" id="modal-trade-notes" rows="3" placeholder="Què vas fer bé? Què podries millorar la propera vegada?">${trade.notes || ''}</textarea>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:var(--space-sm); margin-top:var(--space-lg); border-top:1px solid var(--border-default); padding-top:var(--space-md);">
          <button class="btn btn--secondary btn--sm" id="btn-cancel-journal-modal">Cancel·lar</button>
          <button class="btn btn--primary btn--sm" id="btn-save-journal-modal">💾 Guardar al Diari</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    const closeModal = () => modalOverlay.remove();
    modalOverlay.querySelector('#btn-close-journal-modal')?.addEventListener('click', closeModal);
    modalOverlay.querySelector('#btn-cancel-journal-modal')?.addEventListener('click', closeModal);

    modalOverlay.querySelector('#btn-save-journal-modal')?.addEventListener('click', () => {
      const newSetup = (modalOverlay.querySelector('#modal-trade-setup') as HTMLSelectElement).value;
      const newEmotion = (modalOverlay.querySelector('#modal-trade-emotion') as HTMLSelectElement).value;
      const newGrade = (modalOverlay.querySelector('#modal-trade-grade') as HTMLSelectElement).value as 'A+' | 'A' | 'B' | 'C' | 'F';
      const newRisk = parseFloat((modalOverlay.querySelector('#modal-trade-risk') as HTMLInputElement).value) || 50;
      const newNotes = (modalOverlay.querySelector('#modal-trade-notes') as HTMLTextAreaElement).value.trim();

      const curItems = [...(store.getData().gains?.items || [])];
      const matchIdx = curItems.findIndex(i => i.id === trade.id);

      if (matchIdx >= 0) {
        curItems[matchIdx] = {
          ...curItems[matchIdx],
          setup: newSetup,
          emotionTag: newEmotion,
          executionGrade: newGrade,
          riskAmountEUR: newRisk,
          notes: newNotes,
        };
        store.update('gains', { items: curItems });
        showToast(`Diari d'operacions actualitzat per a ${trade.concept}!`, 'success');
      }

      closeModal();
      render();
    });
  }

  // ── EXPORTACIÓ CSV DEL BACKTEST ─────────────────────────────────────────────
  function exportBacktestCsv(bt: BacktestReport) {
    const headers = [
      'Trade #',
      'Actiu / Concepte',
      'Data Entrada',
      'Data Sortida',
      'Durada (dies)',
      'Capital Invertit (€)',
      'P&L Real (€)',
      'Retorn Real (%)',
      'P&L Simulat (€)',
      'Retorn Simulat (%)',
      'Motiu Sortida',
      'Modificat per Model',
      'R-Multiple',
      'Fase Walk-Forward',
      'Slippage (€)',
      'Comissions (€)'
    ];

    const rows = bt.trades.map(t => [
      t.tradeIndex,
      `"${(t.concept || '').replace(/"/g, '""')}"`,
      t.entryDate,
      t.exitDate,
      t.holdingDays,
      t.initialPositionSizeEUR,
      t.actualPnL,
      t.actualReturnPct,
      t.simulatedPnL,
      t.simulatedReturnPct,
      t.exitReason,
      t.wasModifiedByStrategy ? 'SI' : 'NO',
      t.rMultiple,
      t.isOutOfSample ? 'Out-of-Sample' : 'In-Sample',
      t.slippageEUR,
      t.commissionEUR,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `informe_backtest_trading_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Informe CSV de Backtest descarregat amb èxit!', 'success');
  }

  // ── ATTACH LISTENERS ───────────────────────────────────────────────────────
  function attachEventListeners(container: HTMLElement, report: InvestmentCockpitReport, btReport: BacktestReport) {
    // Pestanyes
    container.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        activeTab = (target.dataset.tab as typeof activeTab) || 'cockpit';
        render();
      });
    });

    // Filtre Any
    container.querySelectorAll('.btn-filter-year').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const val = target.dataset.year;
        selectedYear = val === 'ALL' ? 'ALL' : parseInt(val || '2024', 10);
        render();
      });
    });

    // Filtre Actiu
    const assetSelect = container.querySelector<HTMLSelectElement>('#filter-asset-select');
    assetSelect?.addEventListener('change', () => {
      selectedAssetClass = (assetSelect.value as typeof selectedAssetClass) || 'ALL';
      render();
    });

    // Filtre Estil
    const styleSelect = container.querySelector<HTMLSelectElement>('#filter-style-select');
    styleSelect?.addEventListener('change', () => {
      selectedStyle = (styleSelect.value as typeof selectedStyle) || 'ALL';
      render();
    });

    // Cerca Journal
    const searchInput = container.querySelector<HTMLInputElement>('#journal-search-input');
    searchInput?.addEventListener('input', () => {
      searchQuery = searchInput.value;
      render();
    });

    // Filtre taula Backtest
    const btTradeFilterSelect = container.querySelector<HTMLSelectElement>('#bt-trade-filter-select');
    btTradeFilterSelect?.addEventListener('change', () => {
      backtestTradeFilter = (btTradeFilterSelect.value as typeof backtestTradeFilter) || 'ALL';
      render();
    });

    // Export CSV Backtest
    container.querySelector('#btn-export-backtest-csv')?.addEventListener('click', () => {
      exportBacktestCsv(btReport);
    });

    // Sliders i controls de Backtest
    const slRange = container.querySelector<HTMLInputElement>('#bt-sl-range');
    slRange?.addEventListener('input', () => {
      backtestParams.stopLossPercent = parseFloat(slRange.value) || 5;
      const valEl = container.querySelector('#bt-sl-val');
      if (valEl) valEl.textContent = `-${backtestParams.stopLossPercent}%`;
    });

    const tpRange = container.querySelector<HTMLInputElement>('#bt-tp-range');
    tpRange?.addEventListener('input', () => {
      backtestParams.takeProfitPercent = parseFloat(tpRange.value) || 15;
      const valEl = container.querySelector('#bt-tp-val');
      if (valEl) valEl.textContent = `+${backtestParams.takeProfitPercent}%`;
    });

    const stratSelect = container.querySelector<HTMLSelectElement>('#bt-strategy-type');
    stratSelect?.addEventListener('change', () => {
      backtestParams.strategyType = (stratSelect.value as typeof backtestParams.strategyType) || 'trend_breakout';
    });

    const sizingSelect = container.querySelector<HTMLSelectElement>('#bt-sizing-model');
    sizingSelect?.addEventListener('change', () => {
      backtestParams.sizingModel = (sizingSelect.value as typeof backtestParams.sizingModel) || 'actual_trade_capital';
    });

    const wfSelect = container.querySelector<HTMLSelectElement>('#bt-wf-split');
    wfSelect?.addEventListener('change', () => {
      backtestParams.walkForwardSplitPercent = parseInt(wfSelect.value, 10) || 70;
    });

    // Botó Re-executar Backtest
    container.querySelector('#btn-re-run-backtest')?.addEventListener('click', () => {
      render();
      showToast('Backtest institucional actualitzat!', 'success');
    });

    // Horizon Monte Carlo
    const horizonSelect = container.querySelector<HTMLSelectElement>('#mc-horizon-select');
    horizonSelect?.addEventListener('change', () => {
      monteCarloHorizon = parseInt(horizonSelect.value, 10) || 100;
      render();
    });

    // Botó Editar Diari
    container.querySelectorAll('.btn-edit-journal-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const id = target.dataset.id;
        const matched = report.enrichedTrades.find(t => t.id === id);
        if (matched) {
          openJournalEditModal(matched);
        }
      });
    });

    // Simulador Harvest
    container.querySelectorAll('.btn-simulate-harvest').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const ticker = target.dataset.ticker || 'Actiu';
        const amount = parseFloat(target.dataset.amount || '0');
        const loss = parseFloat(target.dataset.loss || '0');

        const currentItems = [...(store.getData().gains?.items || [])];
        currentItems.push({
          id: `harvest-${Date.now()}`,
          description: `[HARVESTING] Venda fiscal ${ticker}`,
          type: 'shares',
          acquisitionDate: '2024-01-15',
          transferDate: new Date().toISOString().split('T')[0],
          acquisitionValue: amount + loss,
          transferValue: amount,
          expenses: 0,
          isNonComputableLoss: false,
        });

        store.update('gains', { items: currentItems });
        showToast(`Venda fiscal ${ticker} registrada correctament!`, 'success');
        render();
      });
    });
  }

  // Subscripció reactiva al store
  store.subscribeKey('gains', () => render());

  render();
  return page;
}

// ── SVG RENDERERS ────────────────────────────────────────────────────────────

function renderEquityCurveSvg(points: { index: number; cumulativePnL: number }[]): string {
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

function renderBacktestEquityCurveSvg(points: BacktestReport['equityCurve']): string {
  if (points.length < 2) {
    return `<div class="empty-state" style="padding:var(--space-xl); text-align:center; color:var(--text-muted);">Cal tenir dades suficients per graficar la comparativa de backtesting.</div>`;
  }

  const width = 800;
  const height = 240;
  const padding = 40;

  const allVals = [
    ...points.map(p => p.simulatedCumulativePnL),
    ...points.map(p => p.actualCumulativePnL),
    ...points.map(p => p.benchmarkCumulativePnL),
    0
  ];
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(100, ...allVals);
  const valRange = maxVal - minVal || 1;

  const getX = (i: number) => padding + (i / (points.length - 1)) * (width - 2 * padding);
  const getY = (v: number) => height - padding - ((v - minVal) / valRange) * (height - 2 * padding);
  const zeroY = getY(0);

  // Path Simulat (Backtest)
  const simPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.simulatedCumulativePnL).toFixed(1)}`).join(' ');
  
  // Path Real
  const realPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.actualCumulativePnL).toFixed(1)}`).join(' ');
  
  // Path Benchmark
  const benchPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.benchmarkCumulativePnL).toFixed(1)}`).join(' ');

  // Punt de tall Walk-Forward (primer punt Out-of-Sample)
  const oosIdx = points.findIndex(p => p.isOutOfSample);
  const oosLineX = oosIdx >= 0 ? getX(oosIdx) : 0;

  return `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block; overflow:visible;" xmlns="http://www.w3.org/2000/svg">
      <!-- Línia Zero -->
      <line x1="${padding}" y1="${zeroY}" x2="${width - padding}" y2="${zeroY}" stroke="var(--border-default)" stroke-width="1.5" stroke-dasharray="4 4" />
      <text x="${padding - 8}" y="${zeroY + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="monospace">0 €</text>

      <!-- Divisor Walk-Forward In-Sample / Out-of-Sample -->
      ${oosIdx >= 0 ? `
        <line x1="${oosLineX}" y1="${padding - 10}" x2="${oosLineX}" y2="${height - padding + 10}" stroke="var(--color-warning)" stroke-width="2" stroke-dasharray="4 4" />
        <text x="${oosLineX - 6}" y="${padding - 12}" text-anchor="end" fill="var(--text-muted)" font-size="9" font-weight="700">IN-SAMPLE</text>
        <text x="${oosLineX + 6}" y="${padding - 12}" text-anchor="start" fill="var(--color-warning)" font-size="9" font-weight="700">OUT-OF-SAMPLE (OOS)</text>
      ` : ''}

      <!-- Benchmark (Blau) -->
      <path d="${benchPath}" fill="none" stroke="#6366f1" stroke-width="2" stroke-dasharray="3 3" opacity="0.8" />

      <!-- Real (Verd / Vermell) -->
      <path d="${realPath}" fill="none" stroke="#10b981" stroke-width="2.5" opacity="0.85" />

      <!-- Simulat Optimizat (Lila / Primari) -->
      <path d="${simPath}" fill="none" stroke="var(--color-primary)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
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

  const topPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.p95BestCase).toFixed(1)}`).join(' ');
  const bottomPathReversed = [...points].reverse().map((p, i) => `L ${getX(points.length - 1 - i).toFixed(1)} ${getY(p.p5WorstCase).toFixed(1)}`).join(' ');
  const fanAreaD = `${topPath} ${bottomPathReversed} Z`;

  const medianPathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.p50Median).toFixed(1)}`).join(' ');

  return `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block; overflow:visible;" xmlns="http://www.w3.org/2000/svg">
      <path d="${fanAreaD}" fill="rgba(99, 102, 241, 0.18)" />
      <path d="${medianPathD}" fill="none" stroke="var(--color-primary)" stroke-width="2.5" />
      <line x1="${padding}" y1="${getY(initialCap)}" x2="${width - padding}" y2="${getY(initialCap)}" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="3 3" />
      <text x="${width - padding + 6}" y="${getY(initialCap) + 4}" fill="var(--text-muted)" font-size="10" font-family="monospace">Capital Inicial</text>
    </svg>
  `;
}
