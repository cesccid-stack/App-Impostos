/**
 * @module pages/projeccio
 * Projecció Fiscal Multianual & Simulador de Creixement Patrimonial (5 Anys).
 * Modela l'impacte de la inflació, increments salarials, fons indexats, lloguers i deduccions acumulades.
 */

import { store } from '../store.ts';
import { calculateIRPF } from '../fiscal/irpf.ts';
import { formatCurrency } from '../utils/currency.ts';


export interface YearProjection {
  year: number;
  yearIndex: number;
  grossIncome: number;
  taxableBase: number;
  taxStandard: number;
  taxOptimized: number;
  taxSavings: number;
  accumulatedSavings: number;
  projectedWealth: number;
}

export function renderProjeccioPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container';

  // Paràmetres per defecte del simulador
  let incomeGrowthRate = 3.5;       // % creixement anual d'ingressos
  let inflationRate = 2.5;          // % inflació
  let investmentReturnRate = 6.0;   // % rendibilitat anual inversions
  let annualPensionContribution = 1500; // € aportació pla pensions
  let rentalGrowthRate = 2.0;       // % increment lloguers
  let horizonYears = 5;

  function render() {
    const data = store.getData();
    const currentYear = store.getYear();
    const activeProfile = store.getActiveProfile();

    const projections = computeProjections(data, {
      currentYear,
      incomeGrowthRate,
      inflationRate,
      investmentReturnRate,
      annualPensionContribution,
      rentalGrowthRate,
      horizonYears,
    });

    const total5YearSavings = projections.reduce((s, p) => s + p.taxSavings, 0);
    const finalYear = projections[projections.length - 1];

    page.innerHTML = `
      <!-- Capçalera -->
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-xl);">
        <div>
          <div style="display:flex; align-items:center; gap:var(--space-sm); margin-bottom:4px;">
            <h1 class="page-header__title" style="margin:0;">🔮 Projecció Fiscal Multianual (5 Anys)</h1>
            <span class="badge badge--primary" style="font-size:0.8rem;">Exercicis ${currentYear} – ${currentYear + horizonYears - 1}</span>
            <span class="badge badge--primary" style="font-size:0.8rem;">
              ${activeProfile.avatarIcon || '👤'} ${activeProfile.name}
            </span>
          </div>
          <p class="page-header__subtitle" style="margin:0;">
            Simula la teva factura fiscal futura, l'evolució del patrimoni net i l'estalvi acumulat aplicant una estratègia d'optimització fiscal
          </p>
        </div>
      </div>

      <!-- KPIs Destacats de la Projecció -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-xl);">
        <div class="card" style="padding:var(--space-md); border-left:4px solid var(--color-success); background:var(--bg-surface-elevated);">
          <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Estalvi Fiscal Acumulat (5 Anys)</div>
          <div style="font-size:2rem; font-weight:800; color:var(--color-success); margin-top:2px;">
            +${formatCurrency(total5YearSavings)}
          </div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Diners que no van a Hisenda</div>
        </div>

        <div class="card" style="padding:var(--space-md); border-left:4px solid var(--color-primary); background:var(--bg-surface-elevated);">
          <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Patrimoni Net Projectat (Any ${finalYear.year})</div>
          <div style="font-size:2rem; font-weight:800; color:var(--text-primary); margin-top:2px;">
            ${formatCurrency(finalYear.projectedWealth)}
          </div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Incloent rendiments i reinversió de l'estalvi</div>
        </div>

        <div class="card" style="padding:var(--space-md); border-left:4px solid #38bdf8; background:var(--bg-surface-elevated);">
          <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Ingressos Bruts Any ${finalYear.year}</div>
          <div style="font-size:2rem; font-weight:800; color:#38bdf8; margin-top:2px;">
            ${formatCurrency(finalYear.grossIncome)}
          </div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Amb creixement del ${incomeGrowthRate}% anual</div>
        </div>
      </div>

      <!-- Controls interactius de simulació -->
      <div class="card" style="margin-bottom:var(--space-xl); background:var(--bg-surface-elevated); border:1px solid var(--border-default);">
        <div class="card__header" style="margin-bottom:var(--space-md);">
          <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
            <span>⚙️ Paràmetres Macroeconòmics i Hipòtesis de Creixement</span>
            <span class="badge badge--info">Ajust en viu</span>
          </div>
          <div class="card__subtitle">Modifica les variables per recalcular automàticament els escenaris a 5 anys</div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:var(--space-lg);">
          <div>
            <label class="form-label" style="display:flex; justify-content:space-between;">
              <span>Increment salarial / activitat:</span>
              <strong style="color:var(--color-primary);" id="val-income-growth">${incomeGrowthRate}%</strong>
            </label>
            <input type="range" id="slider-income-growth" min="0" max="15" step="0.5" value="${incomeGrowthRate}" style="width:100%;">
          </div>

          <div>
            <label class="form-label" style="display:flex; justify-content:space-between;">
              <span>Rendibilitat inversions (Borsa/ETFs):</span>
              <strong style="color:var(--color-primary);" id="val-investment-return">${investmentReturnRate}%</strong>
            </label>
            <input type="range" id="slider-investment-return" min="0" max="15" step="0.5" value="${investmentReturnRate}" style="width:100%;">
          </div>

          <div>
            <label class="form-label" style="display:flex; justify-content:space-between;">
              <span>Aportació anual Pla Pensions:</span>
              <strong style="color:var(--color-primary);" id="val-pension-contrib">${formatCurrency(annualPensionContribution)}</strong>
            </label>
            <input type="range" id="slider-pension-contrib" min="0" max="1500" step="100" value="${annualPensionContribution}" style="width:100%;">
          </div>

          <div>
            <label class="form-label" style="display:flex; justify-content:space-between;">
              <span>Taxa d'inflació estimada:</span>
              <strong style="color:var(--color-primary);" id="val-inflation">${inflationRate}%</strong>
            </label>
            <input type="range" id="slider-inflation" min="1" max="8" step="0.5" value="${inflationRate}" style="width:100%;">
          </div>
        </div>
      </div>

      <!-- Gràfic Visual SVG de Projecció -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header">
          <div class="card__title">Comparativa de Quota IRPF: Escenari Base vs Optimitzat</div>
          <div class="card__subtitle">Evolució de la càrrega fiscal segons la trajectòria d'optimització</div>
        </div>
        <div id="projection-chart-container" style="width:100%; min-height:260px; position:relative;">
          ${renderProjectionSVG(projections)}
        </div>
      </div>

      <!-- Taula Detallada Any per Any -->
      <div class="card" style="padding:0; overflow:hidden;">
        <div class="card__header" style="padding:var(--space-lg); margin-bottom:0; border-bottom:1px solid var(--border-subtle);">
          <div class="card__title">Desglossament Detallat de la Projecció a 5 Anys</div>
        </div>
        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; margin:0;">
            <thead>
              <tr style="background:var(--bg-surface-elevated);">
                <th>Exercici</th>
                <th style="text-align:right;">Ingressos Bruts</th>
                <th style="text-align:right;">Base Imposable</th>
                <th style="text-align:right; color:var(--color-error);">IRPF Sense Optimitzar</th>
                <th style="text-align:right; color:var(--color-primary);">IRPF Optimitzat</th>
                <th style="text-align:right; color:var(--color-success);">Estalvi Anual</th>
                <th style="text-align:right; font-weight:700;">Patrimoni Acumulat</th>
              </tr>
            </thead>
            <tbody>
              ${projections.map((p) => `
                <tr>
                  <td>
                    <span class="badge ${p.yearIndex === 1 ? 'badge--info' : 'badge--secondary'}" style="font-weight:700;">
                      Exercici ${p.year}
                    </span>
                  </td>
                  <td style="text-align:right; font-family:var(--font-mono);">${formatCurrency(p.grossIncome)}</td>
                  <td style="text-align:right; font-family:var(--font-mono);">${formatCurrency(p.taxableBase)}</td>
                  <td style="text-align:right; font-family:var(--font-mono); color:var(--color-error);">${formatCurrency(p.taxStandard)}</td>
                  <td style="text-align:right; font-family:var(--font-mono); color:var(--color-primary); font-weight:700;">${formatCurrency(p.taxOptimized)}</td>
                  <td style="text-align:right; font-family:var(--font-mono); color:var(--color-success); font-weight:700;">+${formatCurrency(p.taxSavings)}</td>
                  <td style="text-align:right; font-family:var(--font-mono); font-weight:700;">${formatCurrency(p.projectedWealth)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Listeners dels sliders
    const sliderIncome = page.querySelector<HTMLInputElement>('#slider-income-growth');
    sliderIncome?.addEventListener('input', () => {
      incomeGrowthRate = parseFloat(sliderIncome.value);
      render();
    });

    const sliderInvest = page.querySelector<HTMLInputElement>('#slider-investment-return');
    sliderInvest?.addEventListener('input', () => {
      investmentReturnRate = parseFloat(sliderInvest.value);
      render();
    });

    const sliderPension = page.querySelector<HTMLInputElement>('#slider-pension-contrib');
    sliderPension?.addEventListener('input', () => {
      annualPensionContribution = parseFloat(sliderPension.value);
      render();
    });

    const sliderInfl = page.querySelector<HTMLInputElement>('#slider-inflation');
    sliderInfl?.addEventListener('input', () => {
      inflationRate = parseFloat(sliderInfl.value);
      render();
    });
  }

  render();
  return page;
}

function computeProjections(
  data: any,
  params: {
    currentYear: number;
    incomeGrowthRate: number;
    inflationRate: number;
    investmentReturnRate: number;
    annualPensionContribution: number;
    rentalGrowthRate: number;
    horizonYears: number;
  }
): YearProjection[] {
  const resultCurrent = calculateIRPF(data);

  const baseWork = (data.workIncome?.employers || []).reduce((s: number, e: any) => s + (e.grossSalary || 0) + (e.inKind || 0), 0);
  const baseActivities = data.activities?.income || 0;
  const baseRentals = (data.properties || []).reduce((s: number, p: any) => s + (p.grossRentalIncome || 0), 0);
  const baseDividends = (data.capitalIncome?.interests || 0) + (data.capitalIncome?.dividends || 0) + (data.capitalIncome?.foreignDividends || 0);

  let currentWealth = (data.wealth?.assets || []).reduce((s: number, a: any) => s + (a.value || 0), 0);
  if (currentWealth === 0) currentWealth = 25000; // Valor per defecte raonable si està buit

  const projections: YearProjection[] = [];
  let accumulatedSavings = 0;

  for (let i = 0; i < params.horizonYears; i++) {
    const yearIndex = i + 1;
    const year = params.currentYear + i;
    const growthMultiplier = Math.pow(1 + params.incomeGrowthRate / 100, i);
    const rentalMultiplier = Math.pow(1 + params.rentalGrowthRate / 100, i);

    const projectedWork = baseWork * growthMultiplier;
    const projectedActivities = baseActivities * growthMultiplier;
    const projectedRentals = baseRentals * rentalMultiplier;
    const projectedDividends = baseDividends * Math.pow(1 + params.investmentReturnRate / 100, i);

    const grossIncome = projectedWork + projectedActivities + projectedRentals + projectedDividends;
    const taxableBase = Math.max(0, grossIncome * 0.85); // Estimació de despeses i seguretat social

    // Impost sense optimitzar
    const baseEffectiveRate = resultCurrent.generalBase > 0 ? (resultCurrent.netTax / (resultCurrent.generalBase + resultCurrent.savingsBase)) : 0.22;
    const taxStandard = taxableBase * Math.min(0.45, Math.max(0.15, baseEffectiveRate + (i * 0.005)));

    // Impost optimitzat (estalvi per pla de pensions + deduccions autonòmiques + amortitzacions)
    const marginalRate = Math.min(0.47, baseEffectiveRate + 0.12);
    const pensionTaxSaving = params.annualPensionContribution * marginalRate;
    const optimizationBoost = 450 + (i * 120); // Millores en deduccions i despeses
    const taxSavings = pensionTaxSaving + optimizationBoost;
    const taxOptimized = Math.max(0, taxStandard - taxSavings);

    accumulatedSavings += taxSavings;

    // Projecció de patrimoni net
    const investmentGain = currentWealth * (params.investmentReturnRate / 100);
    const annualSavingsFromSalary = Math.max(0, grossIncome - taxOptimized - 20000); // 20k cost de vida estimat
    currentWealth = currentWealth + investmentGain + annualSavingsFromSalary + taxSavings;

    projections.push({
      year,
      yearIndex,
      grossIncome,
      taxableBase,
      taxStandard,
      taxOptimized,
      taxSavings,
      accumulatedSavings,
      projectedWealth: currentWealth,
    });
  }

  return projections;
}

function renderProjectionSVG(projections: YearProjection[]): string {
  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };

  const maxTax = Math.max(...projections.map((p) => p.taxStandard)) * 1.15 || 10000;
  const minTax = 0;

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getX = (idx: number) => padding.left + (idx / (projections.length - 1)) * chartW;
  const getY = (val: number) => padding.top + chartH - ((val - minTax) / (maxTax - minTax)) * chartH;

  const standardPoints = projections.map((p, idx) => `${getX(idx)},${getY(p.taxStandard)}`).join(' ');
  const optimizedPoints = projections.map((p, idx) => `${getX(idx)},${getY(p.taxOptimized)}`).join(' ');

  // Polygon for savings area
  const areaPoints = `${standardPoints} ${projections.map((_, idx) => {
    const revIdx = projections.length - 1 - idx;
    return `${getX(revIdx)},${getY(projections[revIdx].taxOptimized)}`;
  }).join(' ')}`;

  return `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:100%; overflow:visible;">
      <defs>
        <linearGradient id="savingsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.05" />
        </linearGradient>
      </defs>

      <!-- Grid lines -->
      <line x1="${padding.left}" y1="${padding.top}" x2="${width - padding.right}" y2="${padding.top}" stroke="var(--border-subtle)" stroke-dasharray="4" />
      <line x1="${padding.left}" y1="${padding.top + chartH / 2}" x2="${width - padding.right}" y2="${padding.top + chartH / 2}" stroke="var(--border-subtle)" stroke-dasharray="4" />
      <line x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}" stroke="var(--border-default)" />

      <!-- Area of savings -->
      <polygon points="${areaPoints}" fill="url(#savingsGrad)" />

      <!-- Standard line (Red) -->
      <polyline points="${standardPoints}" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />

      <!-- Optimized line (Green/Blue) -->
      <polyline points="${optimizedPoints}" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" />

      <!-- Dots & Labels -->
      ${projections.map((p, idx) => `
        <circle cx="${getX(idx)}" cy="${getY(p.taxStandard)}" r="5" fill="#ef4444" />
        <circle cx="${getX(idx)}" cy="${getY(p.taxOptimized)}" r="5" fill="#10b981" />

        <text x="${getX(idx)}" y="${height - 10}" text-anchor="middle" font-size="11" fill="var(--text-secondary)" font-weight="600">
          ${p.year}
        </text>
      `).join('')}

      <!-- Y Axis Labels -->
      <text x="${padding.left - 10}" y="${padding.top + 4}" text-anchor="end" font-size="10" fill="var(--text-muted)">
        ${formatCurrency(maxTax)}
      </text>
      <text x="${padding.left - 10}" y="${padding.top + chartH / 2 + 4}" text-anchor="end" font-size="10" fill="var(--text-muted)">
        ${formatCurrency(maxTax / 2)}
      </text>
      <text x="${padding.left - 10}" y="${padding.top + chartH}" text-anchor="end" font-size="10" fill="var(--text-muted)">
        0 €
      </text>
    </svg>

    <!-- Legend -->
    <div style="display:flex; justify-content:center; gap:24px; margin-top:12px; font-size:var(--text-xs);">
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="width:12px; height:3px; background:#ef4444; border-radius:2px;"></span>
        <span style="color:var(--text-secondary);">Escenari Estàndard (Sense Optimitzar)</span>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="width:12px; height:3px; background:#10b981; border-radius:2px;"></span>
        <span style="color:var(--text-secondary); font-weight:700;">Escenari Optimitzat (Antigravity)</span>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="width:12px; height:12px; background:rgba(16,185,129,0.2); border:1px solid #10b981; border-radius:2px;"></span>
        <span style="color:var(--color-success); font-weight:700;">Àrea d'Estalvi Fiscal</span>
      </div>
    </div>
  `;
}
