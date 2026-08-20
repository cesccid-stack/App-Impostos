/**
 * @module pages/simulator
 * Comparador d'escenaris fiscals i Simulador Llei Beckham (Art. 93 LIRPF - Model 151).
 */

import { store } from '../store.ts';
import { calculateIRPF } from '../fiscal/irpf.ts';
import { compareBeckhamRegime } from '../fiscal/beckham-engine.ts';
import { formatCurrency } from '../utils/currency.ts';
import type { DeclaracionData, FiscalResult } from '../types.ts';

export function renderSimulator(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container';

  page.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Simulador i Comparador d'Escenaris</h1>
      <p class="page-header__subtitle">Compara decisions fiscals en temps real i avalua el règim especial d'impatriats (Llei Beckham)</p>
    </div>
  `;

  // Base data is the current state
  const baseData = store.getData();
  const baseResult = calculateIRPF(baseData);
  const beckhamComparison = compareBeckhamRegime(baseData);

  // Escenari 1: Aportació extra a pla de pensions (+1000€)
  const scenario1Data: DeclaracionData = JSON.parse(JSON.stringify(baseData));
  scenario1Data.deductions.pensionPlanContributions = (scenario1Data.deductions.pensionPlanContributions || 0) + 1000;
  const scenario1Result = calculateIRPF(scenario1Data);

  // Escenari 2: Venda amb pèrdues (-2000€)
  const scenario2Data: DeclaracionData = JSON.parse(JSON.stringify(baseData));
  scenario2Data.gains.items.push({
    id: 'sim-loss',
    description: 'Venda simulada pèrdues',
    type: 'shares',
    acquisitionDate: '2023-01-01',
    transferDate: '2024-12-31',
    acquisitionValue: 5000,
    transferValue: 3000,
    expenses: 0
  });
  const scenario2Result = calculateIRPF(scenario2Data);

  const grid = document.createElement('div');
  grid.className = 'dashboard-charts';
  
  grid.appendChild(createScenarioCard('Actual (Base)', baseResult, true));
  grid.appendChild(createScenarioCard('+1.000€ Pla Pensions', scenario1Result, false, baseResult));
  grid.appendChild(createScenarioCard('Aflorar pèrdues (-2.000€)', scenario2Result, false, baseResult));

  page.appendChild(grid);

  // ═════════════════════════════════════════════════════════════
  // SECCIÓ LLEI BECKHAM (Art. 93 LIRPF - Model 151)
  // ═════════════════════════════════════════════════════════════
  const beckhamCard = document.createElement('div');
  beckhamCard.className = 'card';
  beckhamCard.style.marginTop = 'var(--space-xl)';
  beckhamCard.style.border = `2px solid ${beckhamComparison.isBeckhamBetter ? 'var(--color-success)' : 'var(--border-default)'}`;

  beckhamCard.innerHTML = `
    <div class="card__header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-sm);">
      <div>
        <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
          <span>🌐 Comparador Llei Beckham vs Règim Ordinari (Model 151)</span>
          <span class="badge ${beckhamComparison.isBeckhamBetter ? 'badge--success' : 'badge--primary'}">
            ${beckhamComparison.isBeckhamBetter ? 'Beckham Recomanada' : 'Règim Ordinari Recomanat'}
          </span>
        </div>
        <p class="card__subtitle" style="margin:4px 0 0 0;">
          Règim especial per a treballadors desplaçats a Espanya: Tarifa plana del 24% fins a 600.000 € i exempció d'estalvi a l'estranger
        </p>
      </div>
    </div>

    <div style="margin-top:var(--space-lg); display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:var(--space-lg);">
      <!-- Ordinari -->
      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
        <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Règim General Ordinari (Model 100)</div>
        <div style="font-size:var(--text-2xl); font-weight:800; margin:var(--space-xs) 0; color:var(--text-primary);">
          ${formatCurrency(beckhamComparison.ordinaryTax)}
        </div>
        <div style="font-size:var(--text-xs); color:var(--text-secondary);">
          Tipus efectiu: <strong>${beckhamComparison.ordinaryEffectiveRate.toFixed(1)}%</strong> (Escala progressiva 19%–50%)
        </div>
      </div>

      <!-- Beckham -->
      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
        <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Llei Beckham (Model 151)</div>
        <div style="font-size:var(--text-2xl); font-weight:800; margin:var(--space-xs) 0; color:${beckhamComparison.isBeckhamBetter ? 'var(--color-success)' : 'var(--text-primary)'};">
          ${formatCurrency(beckhamComparison.beckhamTotalTax)}
        </div>
        <div style="font-size:var(--text-xs); color:var(--text-secondary);">
          Tipus efectiu: <strong>${beckhamComparison.beckhamEffectiveRate.toFixed(1)}%</strong> (Tarifa plana 24%)
        </div>
      </div>
    </div>

    <div style="margin-top:var(--space-md); background:${beckhamComparison.isBeckhamBetter ? 'var(--color-success-soft)' : 'var(--bg-surface-elevated)'}; padding:12px 16px; border-radius:var(--radius-md); font-size:var(--text-sm);">
      💡 <strong>Dictamen de l'anàlisi:</strong> ${beckhamComparison.explanation}
    </div>
  `;

  page.appendChild(beckhamCard);

  return page;
}

function createScenarioCard(
  title: string, 
  result: FiscalResult, 
  isBase: boolean = false,
  baseResult?: FiscalResult
): HTMLElement {
  const card = document.createElement('div');
  card.className = `card ${isBase ? 'card--accent' : ''}`;
  
  const isRefund = result.result < 0;
  
  let diffHtml = '';
  if (!isBase && baseResult) {
    const diff = result.result - baseResult.result;
    const isBetter = diff < 0;
    diffHtml = `
      <div style="margin-top:var(--space-md); font-size:var(--text-sm); font-weight:600; color: ${isBetter ? 'var(--color-success)' : 'var(--color-error)'}">
        Diferència: ${isBetter ? 'Estalvi' : 'Cost extra'} de ${formatCurrency(Math.abs(diff))}
      </div>
    `;
  }

  card.innerHTML = `
    <div class="card__header">
      <div class="card__title">${title}</div>
    </div>
    <div style="margin-top:var(--space-lg); text-align:center;">
      <div style="font-size:var(--text-xs); text-transform:uppercase; color:var(--text-muted); font-weight:600; letter-spacing:0.05em;">
        Resultat
      </div>
      <div style="font-size:2.5rem; font-weight:700; margin:var(--space-sm) 0; color: ${isRefund ? 'var(--color-success)' : 'var(--color-error)'}">
        ${formatCurrency(Math.abs(result.result))}
      </div>
      <div style="font-size:var(--text-sm); color:var(--text-muted);">
        ${isRefund ? 'A tornar per Hisenda' : 'A pagar a Hisenda'}
      </div>
      ${diffHtml}
    </div>
    
    <hr style="border:0; border-top:1px solid var(--border-default); margin:var(--space-lg) 0;">
    
    <div style="display:flex; flex-direction:column; gap:var(--space-sm); font-size:var(--text-sm);">
      <div style="display:flex; justify-content:space-between;">
        <span class="text-muted">Base Imposable General</span>
        <span class="mono">${formatCurrency(result.generalBase)}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span class="text-muted">Base Imposable Estalvi</span>
        <span class="mono">${formatCurrency(result.savingsBase)}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span class="text-muted">Total Deduccions</span>
        <span class="mono">${formatCurrency(-result.totalDeductions)}</span>
      </div>
    </div>
  `;
  
  return card;
}
