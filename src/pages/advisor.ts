/**
 * @module pages/advisor
 * Pàgina interactiva de l'Assistent Fiscal i Planificació d'Estalvi (Fiscal Advisor).
 */

import { store } from '../store.ts';
import { calculateIRPF } from '../fiscal/irpf.ts';
import { auditTaxReturn } from '../fiscal/advisor-engine.ts';
import { formatCurrency } from '../utils/currency.ts';

export function renderAdvisor(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page';

  function renderContent() {
    const data = store.getData();
    const result = calculateIRPF(data);
    const audit = auditTaxReturn(data, result);

    page.innerHTML = `
      <div class="page-header">
        <h1 class="page-header__title">💡 Assistent d'Estalvi i Planificació Fiscal</h1>
        <p class="page-header__subtitle">Auditoria intel·ligent per optimitzar la teva declaració abans del tancament de l'exercici fiscal</p>
      </div>

      <!-- Scorecard de Salut Fiscal i Tipus Marginals -->
      <div class="dashboard-stats" style="margin-bottom:var(--space-xl);">
        <div class="stat-card">
          <div class="stat-card__label">Tipus Marginal General</div>
          <div class="stat-card__value text-primary">${audit.marginalGeneralRate}%</div>
          <div class="stat-card__hint">Estalvi per cada 100 € deduïts a la feina/lloguers</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Tipus Marginal de l'Estalvi</div>
          <div class="stat-card__value text-info">${audit.marginalSavingsRate}%</div>
          <div class="stat-card__hint">Tributació d'interessos, dividends i guanys</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Tipus Mitjà Efectiu Global</div>
          <div class="stat-card__value text-secondary">${audit.effectiveRate}%</div>
          <div class="stat-card__hint">Percentatge real d'impostos sobre renda total</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Estalvi Potencial Identificat</div>
          <div class="stat-card__value text-success font-bold">${formatCurrency(audit.totalPotentialSavings)}</div>
          <div class="stat-card__hint">${audit.adviceList.length} recomanacions actives</div>
        </div>
      </div>

      <!-- Simulador Ràpid de Plans de Pensions -->
      <div class="card" style="margin-bottom:var(--space-xl); background:var(--bg-surface-elevated); border:1px solid var(--border-default);">
        <div class="card__header" style="margin-bottom:var(--space-md);">
          <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
            <span>🧮 Simulador Interactiu d'Aportació a Plans de Pensions</span>
            <span class="badge badge--success">Simulació en viu</span>
          </div>
          <p class="card__subtitle" style="margin:0;">Comprova exactament quants euros recuperaràs d'Hisenda segons el teu tram impositiu marginal</p>
        </div>
        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:var(--space-lg); align-items:center;">
          <div>
            <label class="form-label" style="display:flex; justify-content:space-between;">
              <span>Import addicional que vols aportar:</span>
              <strong id="sim-pension-val" style="color:var(--color-primary);">1.500 €</strong>
            </label>
            <input type="range" id="sim-pension-slider" min="100" max="1500" step="50" value="1500" style="width:100%;">
          </div>
          <div style="background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); text-align:center; border:1px solid var(--border-default);">
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Estalvi d'impostos directe</div>
            <div style="font-size:var(--text-2xl); font-weight:800; color:var(--color-success);" id="sim-pension-saving">
              ${formatCurrency(1500 * (audit.marginalGeneralRate / 100))}
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Cost real de la teva butxaca: <span id="sim-pension-cost">${formatCurrency(1500 * (1 - audit.marginalGeneralRate / 100))}</span></div>
          </div>
        </div>
      </div>

      <!-- Llista de Recomanacions de l'Auditoria -->
      <div style="display:flex; flex-direction:column; gap:var(--space-lg);">
        <h3 style="margin:0; font-size:var(--text-lg);">📋 Pla d'Acció i Oportunitats d'Optimització</h3>

        ${audit.adviceList.map((adv) => {
          const badgeClass = adv.badgeType === 'success' ? 'badge--success' : adv.badgeType === 'warning' ? 'badge--warning' : 'badge--primary';
          return `
            <div class="card" style="border:1px solid var(--border-default); display:flex; flex-direction:column; gap:var(--space-md);">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-sm);">
                <div>
                  <div style="display:flex; align-items:center; gap:var(--space-sm); flex-wrap:wrap;">
                    <h4 style="margin:0; font-size:var(--text-base); font-weight:700;">${adv.title}</h4>
                    <span class="badge ${badgeClass}">${adv.badge}</span>
                  </div>
                  <p style="margin:6px 0 0 0; color:var(--text-secondary); font-size:var(--text-sm);">
                    ${adv.description}
                  </p>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:var(--text-xs); color:var(--text-muted);">Estalvi estimat</div>
                  <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-success);">
                    +${formatCurrency(adv.potentialSavingsEUR)}
                  </div>
                </div>
              </div>
              <div style="background:var(--bg-surface-elevated); padding:8px 12px; border-radius:var(--radius-md); font-size:var(--text-xs); display:flex; justify-content:space-between; align-items:center;">
                <span style="color:var(--text-muted);">👉 <strong>Acció recomanada:</strong> ${adv.actionHint}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Slider listener
    const slider = page.querySelector('#sim-pension-slider') as HTMLInputElement;
    const valEl = page.querySelector('#sim-pension-val') as HTMLElement;
    const savingEl = page.querySelector('#sim-pension-saving') as HTMLElement;
    const costEl = page.querySelector('#sim-pension-cost') as HTMLElement;

    if (slider) {
      slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        valEl.textContent = formatCurrency(val);
        const saving = val * (audit.marginalGeneralRate / 100);
        savingEl.textContent = formatCurrency(saving);
        costEl.textContent = formatCurrency(val - saving);
      });
    }
  }

  renderContent();
  return page;
}
