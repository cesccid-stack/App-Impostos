/**
 * @module pages/wealth-tax
 * Pàgina interactiva de l'Impost sobre el Patrimoni (Model 714) i Grans Fortunes (Model 718).
 * Totalment integrada amb el magatzem reactiu per perfil i exercici fiscal.
 */

import { store } from '../store.ts';
import { calculateIRPF } from '../fiscal/irpf.ts';
import { calculateWealthTax, type WealthTaxData, type WealthAssetItem, type WealthDebtItem } from '../fiscal/wealth-tax-engine.ts';
import { formatCurrency } from '../utils/currency.ts';
import { showToast } from '../components/toast.ts';
import type { DeclaracionData, GainItem, RentalProperty } from '../types.ts';

export function renderWealthTax(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page';

  const data = store.getData();
  const irpfResult = calculateIRPF(data);

  // Carregar estat existent del magatzem o auto-inicialitzar amb immobles i accions de la renda
  let currentWealth: WealthTaxData = data.wealth && data.wealth.assets && data.wealth.assets.length > 0
    ? data.wealth
    : initializeWealthFromIRPF(data);

  function saveAndRender() {
    store.update('wealth', currentWealth);
    renderView();
  }

  function renderView() {
    const res = calculateWealthTax(
      currentWealth,
      irpfResult.liquidableGeneralBase,
      irpfResult.liquidableSavingsBase,
      irpfResult.netTax
    );

    page.innerHTML = `
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md);">
        <div>
          <div style="display:flex; align-items:center; gap:var(--space-sm);">
            <h1 class="page-header__title" style="margin:0;">🏰 Impost sobre el Patrimoni & Grans Fortunes</h1>
            <span class="badge badge--primary">Model 714 (Catalunya)</span>
          </div>
          <p class="page-header__subtitle" style="margin:4px 0 0 0;">
            Càlcul oficial segons la Llei 19/1991, escala catalana (0,21%–3,48%), mínim exempt de 500k€ i blindatge del límit del 60%
          </p>
        </div>
        <div style="display:flex; gap:var(--space-sm);">
          <span class="badge ${res.isObligatedToDeclare ? 'badge--warning' : 'badge--success'}" style="font-size:0.8rem; padding:6px 12px;">
            ${res.isObligatedToDeclare ? '⚠️ Obligat a Declarar Model 714' : '✅ No obligat a declarar'}
          </span>
        </div>
      </div>

      <!-- Scorecard de Patrimoni i Liquidació -->
      <div class="dashboard-stats" style="margin-bottom:var(--space-xl);">
        <div class="stat-card">
          <div class="stat-card__label">Patrimoni Brut Total</div>
          <div class="stat-card__value text-primary">${formatCurrency(res.totalGrossAssets)}</div>
          <div class="stat-card__hint">Exempt: -${formatCurrency(res.totalExemptAssets)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Deutes Deduïbles</div>
          <div class="stat-card__value text-error">-${formatCurrency(res.totalDeductibleDebts)}</div>
          <div class="stat-card__hint">Hipoteques i préstecs</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Patrimoni Net Liquidable</div>
          <div class="stat-card__value font-bold">${formatCurrency(res.netWealth)}</div>
          <div class="stat-card__hint">Mínim exempt: -${formatCurrency(res.minimumExempt)}</div>
        </div>
        <div class="stat-card" style="background:var(--bg-surface-elevated); border:2px solid ${res.netWealthTax > 0 ? 'var(--color-warning)' : 'var(--color-success)'};">
          <div class="stat-card__label">Quota Final a Pagar (Model 714)</div>
          <div class="stat-card__value ${res.netWealthTax > 0 ? 'text-warning' : 'text-success'} font-bold">
            ${formatCurrency(res.netWealthTax)}
          </div>
          <div class="stat-card__hint">
            ${res.shieldReductionApplied > 0 ? `Blindatge -${formatCurrency(res.shieldReductionApplied)}` : 'Sense reducció límit 60%'}
          </div>
        </div>
      </div>

      <!-- Blindatge Legal: Límit Conjunt Renda - Patrimoni (Art. 31 LIP) -->
      <div class="card" style="margin-bottom:var(--space-xl); background:var(--bg-surface-elevated); border:1px solid var(--border-default);">
        <div class="card__header" style="margin-bottom:var(--space-md);">
          <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
            <span>🛡️ Blindatge Fiscal: Límit Conjunt Renda - Patrimoni (Art. 31 LIP)</span>
            <span class="badge badge--info">Límit del 60%</span>
          </div>
          <p class="card__subtitle" style="margin:0;">La suma de la quota d'IRPF més la quota de Patrimoni no pot superar el 60% de la base d'IRPF</p>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:var(--space-md); font-size:var(--text-sm);">
          <div>
            <div style="color:var(--text-muted);">Base Imposable IRPF Total:</div>
            <strong>${formatCurrency(irpfResult.liquidableGeneralBase + irpfResult.liquidableSavingsBase)}</strong>
          </div>
          <div>
            <div style="color:var(--text-muted);">Límit Màxim Conjunt (60%):</div>
            <strong>${formatCurrency(res.jointLimitBase60)}</strong>
          </div>
          <div>
            <div style="color:var(--text-muted);">Suma d'Impostos (IRPF + Patrimoni):</div>
            <strong class="${res.totalTaxesBeforeShield > res.jointLimitBase60 ? 'text-warning' : 'text-success'}">
              ${formatCurrency(res.totalTaxesBeforeShield)}
            </strong>
          </div>
          <div>
            <div style="color:var(--text-muted);">Estalvi aplicat pel Blindatge:</div>
            <strong class="text-success">-${formatCurrency(res.shieldReductionApplied)}</strong>
          </div>
        </div>
      </div>

      <!-- Llista d'Actius i Béns -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
          <div class="card__title">📋 Béns i Drets Computables (Actiu)</div>
          <button class="btn btn--secondary btn--sm" id="btn-add-asset">＋ Afegir Actiu</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${currentWealth.assets.map((a) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-surface-elevated); border-radius:var(--radius-md); border:1px solid var(--border-default); font-size:var(--text-sm);">
              <div>
                <strong>${a.description}</strong>
                ${a.isPrimaryResidence ? '<span class="badge badge--success" style="margin-left:8px;">Habitatge Habitual (Exempt fins a 300k)</span>' : ''}
              </div>
              <div style="display:flex; align-items:center; gap:var(--space-md);">
                <strong class="mono" style="font-size:var(--text-base);">${formatCurrency(a.grossValue)}</strong>
                <button class="btn btn--ghost btn--sm btn--icon" data-del-asset="${a.id}">🗑</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Llista de Deutes Deduïbles -->
      <div class="card">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
          <div class="card__title">📉 Deutes i Obligacions Deduïbles (Passiu)</div>
          <button class="btn btn--secondary btn--sm" id="btn-add-debt">＋ Afegir Deute</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${currentWealth.debts.map((d) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-surface-elevated); border-radius:var(--radius-md); border:1px solid var(--border-default); font-size:var(--text-sm);">
              <div>
                <strong>${d.description}</strong>
              </div>
              <div style="display:flex; align-items:center; gap:var(--space-md);">
                <strong class="mono text-error" style="font-size:var(--text-base);">-${formatCurrency(d.amount)}</strong>
                <button class="btn btn--ghost btn--sm btn--icon" data-del-debt="${d.id}">🗑</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Vinculació amb el Mòdul d'IVA i Béns d'Inversió -->
      <div class="card" style="margin-top:var(--space-xl); border-top:4px solid var(--color-warning);">
        <div class="card__header" style="margin-bottom:var(--space-md); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
          <div>
            <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
              <span>🧾 Béns d'Inversió & Deutes Tributaris d'IVA</span>
              <span class="badge badge--primary">Art. 107-110 LIVA</span>
            </div>
            <p class="card__subtitle" style="margin:4px 0 0 0;">
              Coordinació d'actius amortitzables i compensacions/deutes tributaris d'IVA amb el balanç del Model 714
            </p>
          </div>
          <button class="btn btn--secondary btn--sm" id="btn-wealth-goto-iva">
            🚀 Anar a Gestió de l'IVA
          </button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:var(--space-md); font-size:var(--text-xs);">
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="color:var(--text-muted);">Béns d'Inversió al Llibre d'IVA:</div>
            <strong style="font-size:var(--text-sm);">${store.getIVA().investmentAssets.length} actius</strong>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="color:var(--text-muted);">Saldo Liquidació IVA (4T):</div>
            <strong style="font-size:var(--text-sm);">${formatCurrency(store.getIVA().quarters['4T'].resultadoLiquidacion)}</strong>
          </div>
        </div>
      </div>
    `;

    // Listeners
    page.querySelector('#btn-wealth-goto-iva')?.addEventListener('click', () => {
      window.location.hash = '/iva';
    });
    page.querySelector('#btn-add-asset')?.addEventListener('click', () => {
      const desc = prompt('Descripció de l\'actiu (ex: Compte Corrent CaixaBank):');
      if (desc) {
        const val = parseFloat(prompt('Valor fiscal en euros (€):') || '0') || 0;
        currentWealth.assets.push({
          id: crypto.randomUUID(),
          category: 'other',
          description: desc,
          grossValue: val,
        });
        saveAndRender();
        showToast('Actiu afegit i guardat', 'success');
      }
    });

    page.querySelector('#btn-add-debt')?.addEventListener('click', () => {
      const desc = prompt('Descripció del deute (ex: Préstec personal):');
      if (desc) {
        const val = parseFloat(prompt('Import pendent en euros (€):') || '0') || 0;
        currentWealth.debts.push({
          id: crypto.randomUUID(),
          description: desc,
          amount: val,
        });
        saveAndRender();
        showToast('Deute afegit i guardat', 'success');
      }
    });

    page.querySelectorAll('[data-del-asset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.delAsset;
        currentWealth.assets = currentWealth.assets.filter(a => a.id !== id);
        saveAndRender();
      });
    });

    page.querySelectorAll('[data-del-debt]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.delDebt;
        currentWealth.debts = currentWealth.debts.filter(d => d.id !== id);
        saveAndRender();
      });
    });
  }

  renderView();
  return page;
}

function initializeWealthFromIRPF(data: DeclaracionData): WealthTaxData {
  const autoAssets: WealthAssetItem[] = [];
  (data.properties || []).forEach((p, idx: number) => {
    const val = Math.max(p.acquisitionCost || 0, p.totalCadastralValue || 0);
    autoAssets.push({
      id: `prop-${idx}`,
      category: 'real_estate',
      description: `🏠 ${p.name || p.address || 'Immoble'}`,
      grossValue: val,
      isPrimaryResidence: idx === 0 && p.usageType === 'habitual',
    });
  });

  const totalGainsValue = (data.gains?.items || []).reduce((s: number, i: GainItem) => s + (i.transferValue || i.acquisitionValue || 0), 0);
  if (totalGainsValue > 0) {
    autoAssets.push({
      id: 'shares-auto',
      category: 'shares_funds',
      description: '📈 Cartera d\'Accions i Fons d\'Inversió',
      grossValue: totalGainsValue,
    });
  }

  const autoDebts: WealthDebtItem[] = [];
  (data.properties || []).forEach((p: RentalProperty, idx: number) => {
    if ((p.mortgageInterests || 0) > 0) {
      autoDebts.push({
        id: `debt-prop-${idx}`,
        description: `Hipoteca restant ${p.name || 'Immoble'}`,
        amount: (p.mortgageInterests || 0) * 20,
      });
    }
  });

  return {
    assets: autoAssets.length > 0 ? autoAssets : [
      { id: '1', category: 'real_estate', description: '🏠 Habitatge Habitual', grossValue: 350000, isPrimaryResidence: true },
      { id: '2', category: 'bank_accounts', description: '🏦 Comptes bancaris i dipòsits', grossValue: 200000 },
      { id: '3', category: 'shares_funds', description: '📈 Fons d\'inversió i accions', grossValue: 400000 },
    ],
    debts: autoDebts.length > 0 ? autoDebts : [
      { id: 'd1', description: 'Préstec hipotecari restant', amount: 80000 },
    ],
    community: 'CAT',
  };
}
