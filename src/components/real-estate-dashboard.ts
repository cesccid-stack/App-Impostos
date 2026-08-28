/**
 * @module components/real-estate-dashboard
 * Quadre de Comandament Integral de Rendibilitat, Tendència i Anàlisi per Explotació Immobiliària.
 * Permet visualitzar la rendibilitat global de la cartera i fer zoom detallat a cada immoble individual.
 */

import { analyzePortfolioFinances, analyzePropertyFinances, type PortfolioAnalyticsReport, type PropertyAnalyticsReport } from '../fiscal/real-estate-analytics-engine.ts';
import { formatCurrency } from '../utils/currency.ts';
import type { RentalProperty } from '../types-properties.ts';

export function createRealEstateDashboard(properties: RentalProperty[], fiscalYear: number = 2024): HTMLElement {
  const container = document.createElement('div');
  container.className = 'real-estate-dashboard-container';
  container.style.marginBottom = 'var(--space-xl)';

  let activeMode: 'portfolio' | 'property' = 'portfolio';
  let selectedPropertyId: string = properties.length > 0 ? properties[0].id : '';

  function renderContent() {
    const portfolioReport: PortfolioAnalyticsReport = analyzePortfolioFinances(properties, fiscalYear);
    const selectedProp = properties.find(p => p.id === selectedPropertyId) || properties[0];
    const propertyReport: PropertyAnalyticsReport | null = selectedProp ? analyzePropertyFinances(selectedProp, fiscalYear) : null;

    container.innerHTML = `
      <div class="card" style="border:1px solid var(--border-accent); background:linear-gradient(145deg, rgba(99, 102, 241, 0.04), var(--bg-surface-elevated)); box-shadow:var(--shadow-md); padding:var(--space-lg);">
        
        <!-- Header del Quadre de Comandament -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-md); padding-bottom:var(--space-md); border-bottom:1px solid var(--border-default); margin-bottom:var(--space-lg);">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.4rem;">🏢</span>
              <h2 style="margin:0; font-size:1.2rem; font-weight:800; color:var(--text-primary);">
                Quadre de Comandament de Rendibilitat & Tendència Immobiliària
              </h2>
              <span class="badge badge--primary" style="font-size:0.75rem;">Explotació Art. 23 LIRPF</span>
            </div>
            <p style="margin:4px 0 0 0; font-size:0.85rem; color:var(--text-secondary);">
              Mètriques financeres avançades (Gross/Net Yield, NOI, Cash Flow, Escut Fiscal 3% i Projecció a 5 Anys).
            </p>
          </div>

          <!-- Botons de Mode (Global vs Per Explotació) -->
          <div style="display:flex; background:var(--bg-base); padding:3px; border-radius:var(--radius-md); border:1px solid var(--border-default); gap:4px; flex-wrap:wrap;">
            <button class="btn btn--sm mode-btn ${activeMode === 'portfolio' ? 'btn--primary' : 'btn--ghost'}" data-mode="portfolio" style="font-size:0.8rem; padding:5px 12px;">
              🌐 Cartera Global (${properties.length})
            </button>
            <button class="btn btn--sm mode-btn ${activeMode === 'property' ? 'btn--primary' : 'btn--ghost'}" data-mode="property" style="font-size:0.8rem; padding:5px 12px;">
              🔍 Per Explotació Individual
            </button>
          </div>
        </div>

        <!-- Contingut Segons Mode -->
        <div id="real-estate-dashboard-content">
          ${activeMode === 'portfolio' ? renderPortfolioView(portfolioReport) : renderPropertyView(propertyReport, properties)}
        </div>

      </div>
    `;

    // Event listeners per alternar de mode
    container.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        activeMode = (target.dataset.mode === 'property' ? 'property' : 'portfolio');
        renderContent();
      });
    });

    // Event listener per al selector d'immoble individual
    const propSelect = container.querySelector('#select-property-analytics') as HTMLSelectElement;
    propSelect?.addEventListener('change', () => {
      selectedPropertyId = propSelect.value;
      renderContent();
    });
  }

  // ── 1. VISTA GLOBAL DE LA CARTERA ──────────────────────────────────────────
  function renderPortfolioView(report: PortfolioAnalyticsReport): string {
    if (report.totalProperties === 0) {
      return `
        <div style="text-align:center; padding:var(--space-xl); color:var(--text-secondary);">
          <div style="font-size:2rem; margin-bottom:8px;">🏠</div>
          <div style="font-weight:700; font-size:1rem; margin-bottom:4px;">No hi ha immobles a la cartera</div>
          <p style="font-size:0.85rem; margin:0;">Afegeix immobles o carrega un preset per activar l'anàlisi de rendibilitat i tendències.</p>
        </div>
      `;
    }

    return `
      <div>
        <!-- KPIs Principals de la Cartera -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-lg);">
          
          <div style="background:var(--bg-surface); padding:12px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Patrimoni Immobiliari</div>
            <div style="font-size:1.25rem; font-weight:800; font-family:var(--font-mono); color:var(--text-primary); margin:2px 0;">
              ${formatCurrency(report.totalPortfolioCost)}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">${report.totalProperties} Actius en cartera</div>
          </div>

          <div style="background:var(--bg-surface); padding:12px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Ingressos Bruts Anuals</div>
            <div style="font-size:1.25rem; font-weight:800; font-family:var(--font-mono); color:var(--color-primary); margin:2px 0;">
              ${formatCurrency(report.totalGrossIncome)}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">${formatCurrency(report.totalGrossIncome / 12)} / mes</div>
          </div>

          <div style="background:var(--bg-surface); padding:12px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Rendibilitat Neta (Net Yield)</div>
            <div style="font-size:1.25rem; font-weight:800; font-family:var(--font-mono); color:var(--color-success); margin:2px 0;">
              ${report.avgNetYieldPercent.toFixed(2)}%
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">Yield Brut: <strong>${report.avgGrossYieldPercent.toFixed(2)}%</strong></div>
          </div>

          <div style="background:var(--bg-surface); padding:12px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Cash Flow Net Butxaca</div>
            <div style="font-size:1.25rem; font-weight:800; font-family:var(--font-mono); color:${report.totalCashFlowAnnual >= 0 ? 'var(--color-success)' : 'var(--color-error)'}; margin:2px 0;">
              ${formatCurrency(report.totalCashFlowAnnual)}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">${formatCurrency(report.totalCashFlowAnnual / 12)} / mes lliures</div>
          </div>

          <div style="background:var(--bg-surface); padding:12px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Escut Fiscal 3% AEAT</div>
            <div style="font-size:1.25rem; font-weight:800; font-family:var(--font-mono); color:var(--color-info); margin:2px 0;">
              +${formatCurrency(report.totalTaxShieldSavings)}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">Amortització: ${formatCurrency(report.totalAmortization)}</div>
          </div>

        </div>

        <!-- Rànquing d'Explotacions per Rendibilitat -->
        <div style="background:var(--bg-surface); border:1px solid var(--border-default); border-radius:var(--radius-md); padding:var(--space-md); margin-bottom:var(--space-lg);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
            <h3 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">
              🏆 Rànquing d'Eficiència & Rendibilitat de la Cartera
            </h3>
            <span class="badge badge--success" style="font-size:0.7rem;">Ordenat per Net Yield</span>
          </div>

          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; font-size:0.8rem;">
              <thead>
                <tr style="border-bottom:1px solid var(--border-default); text-align:left;">
                  <th style="padding:8px 10px;">Posició / Immoble</th>
                  <th style="padding:8px 10px;">Ús</th>
                  <th style="padding:8px 10px; text-align:right;">Ingressos Bruts</th>
                  <th style="padding:8px 10px; text-align:right;">Despeses (OpEx)</th>
                  <th style="padding:8px 10px; text-align:right;">NOI Net</th>
                  <th style="padding:8px 10px; text-align:right;">Yield Brut</th>
                  <th style="padding:8px 10px; text-align:right;">Yield Net</th>
                  <th style="padding:8px 10px; text-align:right;">Cash Flow Mensual</th>
                </tr>
              </thead>
              <tbody>
                ${report.propertiesRanked.map((m, idx) => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                    <td style="padding:8px 10px;">
                      <div style="display:flex; align-items:center; gap:8px;">
                        <span style="width:20px; height:20px; border-radius:50%; background:var(--bg-surface-elevated); border:1px solid var(--border-default); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.7rem; color:var(--color-primary);">
                          #${idx + 1}
                        </span>
                        <div>
                          <div style="font-weight:700; color:var(--text-primary);">${m.propertyName}</div>
                          <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted);">${m.cadastralReference}</div>
                        </div>
                      </div>
                    </td>
                    <td style="padding:8px 10px;">
                      <span class="badge badge--info" style="font-size:0.65rem;">${m.usageType}</span>
                    </td>
                    <td style="padding:8px 10px; text-align:right; font-family:var(--font-mono); font-weight:600;">${formatCurrency(m.grossIncome)}</td>
                    <td style="padding:8px 10px; text-align:right; font-family:var(--font-mono); color:var(--color-warning);">-${formatCurrency(m.operatingExpenses)}</td>
                    <td style="padding:8px 10px; text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--text-primary);">${formatCurrency(m.netOperatingIncome)}</td>
                    <td style="padding:8px 10px; text-align:right; font-family:var(--font-mono); font-weight:600; color:var(--color-primary);">${m.grossYieldPercent.toFixed(2)}%</td>
                    <td style="padding:8px 10px; text-align:right; font-family:var(--font-mono); font-weight:800; color:var(--color-success);">${m.netYieldPercent.toFixed(2)}%</td>
                    <td style="padding:8px 10px; text-align:right; font-family:var(--font-mono); font-weight:700; color:${m.cashFlowMonthly >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                      ${formatCurrency(m.cashFlowMonthly)}/m
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Taula de Tendència i Projecció a 5 Anys -->
        <div style="background:var(--bg-surface); border:1px solid var(--border-default); border-radius:var(--radius-md); padding:var(--space-md);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
            <div>
              <h3 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">
                📈 Tendència Multianual & Projecció de Cartera (5 Anys)
              </h3>
              <div style="font-size:0.75rem; color:var(--text-secondary);">
                Indexació de renda 2,5% (IRAV/IPC), inflació despeses 2,0%, revalorització d'actius 3,0% anual
              </div>
            </div>
            <span class="badge badge--primary" style="font-size:0.7rem;">Previsió Financera</span>
          </div>

          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; font-size:0.75rem;">
              <thead>
                <tr style="border-bottom:1px solid var(--border-default); text-align:left;">
                  <th style="padding:6px 8px;">Exercici</th>
                  <th style="padding:6px 8px; text-align:right;">Ingressos Previsibles</th>
                  <th style="padding:6px 8px; text-align:right;">Despeses Estimades</th>
                  <th style="padding:6px 8px; text-align:right;">Amortització 3%</th>
                  <th style="padding:6px 8px; text-align:right;">Cash Flow Anual</th>
                  <th style="padding:6px 8px; text-align:right;">Cash Flow Acumulat</th>
                  <th style="padding:6px 8px; text-align:right;">Valoració de Cartera</th>
                  <th style="padding:6px 8px; text-align:right;">Retorn Global Estimat</th>
                </tr>
              </thead>
              <tbody>
                ${report.portfolioFiveYearProjection.map((yr) => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                    <td style="padding:6px 8px; font-weight:800; color:var(--text-primary);">
                      Any ${yr.yearNumber} (${yr.calendarYear})
                    </td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); color:var(--color-primary);">${formatCurrency(yr.projectedGrossIncome)}</td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); color:var(--color-warning);">-${formatCurrency(yr.projectedOperatingExpenses)}</td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); color:var(--color-info);">${formatCurrency(yr.projectedAmortization)}</td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--color-success);">${formatCurrency(yr.projectedCashFlow)}</td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); font-weight:800; color:var(--text-primary);">${formatCurrency(yr.cumulativeCashFlow)}</td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); font-weight:600;">${formatCurrency(yr.projectedPropertyValue)}</td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); font-weight:800; color:var(--color-success); background:rgba(16,185,129,0.05);">
                      +${formatCurrency(yr.totalEstimatedReturn)}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ── 2. VISTA DETALLADA PER EXPLOTACIÓ INDIVIDUAL ───────────────────────────
  function renderPropertyView(report: PropertyAnalyticsReport | null, props: RentalProperty[]): string {
    if (!report || props.length === 0) {
      return `
        <div style="text-align:center; padding:var(--space-xl); color:var(--text-secondary);">
          No hi ha cap immoble seleccionat.
        </div>
      `;
    }

    const m = report.propertyMetrics;

    return `
      <div>
        <!-- Selector d'Immoble -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-md); background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
          <div style="display:flex; align-items:center; gap:8px;">
            <label for="select-property-analytics" style="font-size:0.8rem; font-weight:700; color:var(--text-primary);">
              📍 Selecciona Explotació:
            </label>
            <select id="select-property-analytics" class="form-select" style="font-size:0.8rem; padding:4px 8px; background:var(--bg-base); border:1px solid var(--border-default); border-radius:var(--radius-sm); color:var(--text-primary);">
              ${props.map(p => `
                <option value="${p.id}" ${p.id === m.propertyId ? 'selected' : ''}>
                  ${p.name || p.address} (${p.usageType})
                </option>
              `).join('')}
            </select>
          </div>

          <div style="display:flex; align-items:center; gap:6px;">
            <span class="badge badge--primary">${m.usageType.toUpperCase()}</span>
            <span class="badge ${m.riskRating === 'low' ? 'badge--success' : (m.riskRating === 'medium' ? 'badge--warning' : 'badge--error')}">
              Risc ${m.riskRating.toUpperCase()}
            </span>
          </div>
        </div>

        <!-- Mètriques Clau de l'Explotació -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-lg);">
          
          <div style="background:var(--bg-surface); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Cost d'Adquisició</div>
            <div style="font-size:1.2rem; font-weight:800; font-family:var(--font-mono); color:var(--text-primary);">${formatCurrency(m.acquisitionCost)}</div>
            <div style="font-size:0.65rem; color:var(--text-muted);">Construcció: ${formatCurrency(m.constructionCadastralValue)}</div>
          </div>

          <div style="background:var(--bg-surface); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Rendibilitat Neta</div>
            <div style="font-size:1.2rem; font-weight:800; font-family:var(--font-mono); color:var(--color-success);">${m.netYieldPercent.toFixed(2)}%</div>
            <div style="font-size:0.65rem; color:var(--text-secondary);">Yield Brut: <strong>${m.grossYieldPercent.toFixed(2)}%</strong></div>
          </div>

          <div style="background:var(--bg-surface); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Cash Flow Mensual</div>
            <div style="font-size:1.2rem; font-weight:800; font-family:var(--font-mono); color:${m.cashFlowMonthly >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(m.cashFlowMonthly)}/m</div>
            <div style="font-size:0.65rem; color:var(--text-secondary);">${formatCurrency(m.cashFlowAnnual)} anuals</div>
          </div>

          <div style="background:var(--bg-surface); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Escut Fiscal 3%</div>
            <div style="font-size:1.2rem; font-weight:800; font-family:var(--font-mono); color:var(--color-info);">+${formatCurrency(m.taxShieldSavings)}</div>
            <div style="font-size:0.65rem; color:var(--text-secondary);">Amort. deduïda: ${formatCurrency(m.totalAmortization)}</div>
          </div>

          <div style="background:var(--bg-surface); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Ràtio Despeses (OpEx)</div>
            <div style="font-size:1.2rem; font-weight:800; font-family:var(--font-mono); color:${m.operatingExpenseRatio < 30 ? 'var(--color-success)' : 'var(--color-warning)'};">${m.operatingExpenseRatio.toFixed(1)}%</div>
            <div style="font-size:0.65rem; color:var(--text-secondary);">Equilibri: ${m.breakEvenOccupancyMonths} mesos</div>
          </div>

        </div>

        <!-- Cascada Financera & Fiscal de l'Explotació -->
        <div style="background:var(--bg-surface); border:1px solid var(--border-default); border-radius:var(--radius-md); padding:var(--space-md); margin-bottom:var(--space-lg);">
          <h4 style="margin:0 0 var(--space-sm) 0; font-size:0.9rem; font-weight:700; color:var(--text-primary);">
            🌊 Cascada de Rendibilitat & Liquidació Fiscal d'aquesta Propietat
          </h4>

          <div style="display:flex; flex-direction:column; gap:6px; font-size:0.8rem;">
            
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:var(--bg-surface-elevated); border-radius:var(--radius-sm);">
              <span>1. Ingressos Íntegres de Lloguer (Casella 0102)</span>
              <strong style="font-family:var(--font-mono); color:var(--color-primary);">+${formatCurrency(m.grossIncome)}</strong>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:var(--bg-surface-elevated); border-radius:var(--radius-sm);">
              <span>2. Despeses Operatives (IBI, Comunitat, Assegurances, Reparacions)</span>
              <strong style="font-family:var(--font-mono); color:var(--color-warning);">-${formatCurrency(m.operatingExpenses)}</strong>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:var(--bg-surface-elevated); border-radius:var(--radius-sm);">
              <span>3. Interessos de Finançament / Hipoteca</span>
              <strong style="font-family:var(--font-mono); color:var(--color-warning);">-${formatCurrency(m.mortgageInterests)}</strong>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:var(--bg-surface-elevated); border-radius:var(--radius-sm);">
              <span>4. Amortització del 3% Construcció + Mobles (Casella 0118)</span>
              <strong style="font-family:var(--font-mono); color:var(--color-success);">-${formatCurrency(m.totalAmortization)}</strong>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:var(--bg-surface-elevated); border-radius:var(--radius-sm);">
              <span>5. Reducció per Arrendament d'Habitatge Habitual (Llei 12/2023)</span>
              <strong style="font-family:var(--font-mono); color:var(--color-info);">-${formatCurrency(m.reductionAmount)}</strong>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:linear-gradient(90deg, rgba(99,102,241,0.1), transparent); border-radius:var(--radius-sm); border-top:1px solid var(--border-accent);">
              <span style="font-weight:700; color:var(--text-primary);">➡️ Rendiment Net Computable a la Renda (Casella 0150)</span>
              <strong style="font-family:var(--font-mono); font-size:0.95rem; color:var(--text-primary);">${formatCurrency(m.netReducedIncome)}</strong>
            </div>

          </div>

          <!-- Recomanació Estratègica -->
          <div style="margin-top:var(--space-md); padding:10px 12px; background:rgba(99,102,241,0.08); border-left:3px solid var(--color-primary); border-radius:var(--radius-sm); font-size:0.75rem; color:var(--text-secondary);">
            💡 <strong>Diagnòstic de l'Assessor:</strong> ${m.strategicRecommendation}
          </div>
        </div>

        <!-- Projecció a 5 Anys d'aquesta Explotació -->
        <div style="background:var(--bg-surface); border:1px solid var(--border-default); border-radius:var(--radius-md); padding:var(--space-md);">
          <h4 style="margin:0 0 var(--space-sm) 0; font-size:0.9rem; font-weight:700; color:var(--text-primary);">
            📊 Projecció Multianual de l'Explotació (Any 1 a 5)
          </h4>

          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; font-size:0.75rem;">
              <thead>
                <tr style="border-bottom:1px solid var(--border-default); text-align:left;">
                  <th style="padding:6px 8px;">Exercici</th>
                  <th style="padding:6px 8px; text-align:right;">Ingressos</th>
                  <th style="padding:6px 8px; text-align:right;">Despeses</th>
                  <th style="padding:6px 8px; text-align:right;">NOI</th>
                  <th style="padding:6px 8px; text-align:right;">Cash Flow</th>
                  <th style="padding:6px 8px; text-align:right;">Cash Flow Acumulat</th>
                  <th style="padding:6px 8px; text-align:right;">Valor Actiu Estimat</th>
                </tr>
              </thead>
              <tbody>
                ${report.fiveYearProjection.map(yr => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                    <td style="padding:6px 8px; font-weight:700;">Any ${yr.yearNumber} (${yr.calendarYear})</td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); color:var(--color-primary);">${formatCurrency(yr.projectedGrossIncome)}</td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); color:var(--color-warning);">-${formatCurrency(yr.projectedOperatingExpenses)}</td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); font-weight:600;">${formatCurrency(yr.projectedNetOperatingIncome)}</td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--color-success);">${formatCurrency(yr.projectedCashFlow)}</td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); font-weight:800;">${formatCurrency(yr.cumulativeCashFlow)}</td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); font-weight:600; color:var(--color-primary);">${formatCurrency(yr.projectedPropertyValue)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }

  renderContent();
  return container;
}
