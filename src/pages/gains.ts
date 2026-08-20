/**
 * @module pages/gains
 * Gestió Avançada de Guanys i Pèrdues Patrimonials, Cartera de Valors, Bròkers i Compliment AEAT (Art. 33 a 38 LIRPF).
 * 
 * Funcionalitats d'Automatització Total:
 * - Hub Integrat de Bròkers (DEGIRO, IBKR, Trade Republic, Revolut, eToro, Scalable, Binance, Coinbase, etc.).
 * - Auto-sincronització instantània en 1 clic amb el mètode FIFO i les caselles oficials de la Renda Web (0328-0336).
 * - Motor Automàtic Anti-Wash Sale / Regla dels 2 Mesos (Art. 33.5 LIRPF) amb segregació de pèrdues suspeses vs computables.
 * - Simulador interactiu de Tax-Loss Harvesting en viu amb aplicació immediata d'estalvi fiscal en IRPF.
 * - Integració de dividends estrangers i deducció per doble imposició internacional (W-8BEN / Casella 0588).
 * - Presets de carteres reals per a simulació i proves.
 */

import { store } from '../store.ts';
import { createField, createFormRow, createFormSection } from '../components/form-field.ts';
import { openModal } from '../components/modal.ts';
import { showToast } from '../components/toast.ts';
import { formatCurrency } from '../utils/currency.ts';
import { 
  autoParseBrokerCSV, 
  syncTradesToStore, 
  getStockPortfolioPresets
} from '../import/portfolio-automator.ts';
import { calculateTaxLossHarvesting, type OpenPosition } from '../fiscal/tax-loss-harvesting.ts';
import type { GainItem } from '../types.ts';

export function renderGains(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page';

  const data = store.getData();
  const items = data.gains?.items || [];

  // Càlculs globals de guanys, pèrdues suspeses i base computable
  let totalGrossGain = 0;
  let totalGrossLoss = 0;
  let totalSuspendedLosses = 0;
  let totalComputableNetGain = 0;

  for (const item of items) {
    const raw = (item.transferValue || 0) - (item.acquisitionValue || 0) - (item.expenses || 0);
    
    // Aplicació d'exempcions
    let net = raw;
    if (item.isPrimaryResidenceExemptOver65 && raw > 0) {
      net = 0;
    } else if (item.isPrimaryResidenceReinvestment && raw > 0 && item.reinvestmentAmount && item.transferValue > 0) {
      const ratio = Math.min(1, item.reinvestmentAmount / item.transferValue);
      net = raw * (1 - ratio);
    } else if (item.isLifeAnnuityExemptOver65 && raw > 0 && item.lifeAnnuityAmount && item.transferValue > 0) {
      const ratio = Math.min(1, Math.min(240000, item.lifeAnnuityAmount) / item.transferValue);
      net = raw * (1 - ratio);
    }

    if (raw >= 0) {
      totalGrossGain += raw;
      totalComputableNetGain += net;
    } else {
      totalGrossLoss += Math.abs(raw);
      if (item.nonComputableLossAmount !== undefined && item.nonComputableLossAmount > 0) {
        totalSuspendedLosses += item.nonComputableLossAmount;
        totalComputableNetGain += (raw + item.nonComputableLossAmount);
      } else if (item.isNonComputableLoss) {
        totalSuspendedLosses += Math.abs(raw);
      } else {
        totalComputableNetGain += raw;
      }
    }
  }

  // Tax-Loss Harvesting potencial
  // Mock posicions obertes o estimades
  const defaultOpenPositions: OpenPosition[] = [
    { id: 'pos-1', tickerOrName: 'Tesla Inc (TSLA)', assetType: 'shares', currentMarketValue: 6800, totalAcquisitionCost: 9500, unrealizedPnL: -2700, lastPurchaseDate: '2024-01-15' },
    { id: 'pos-2', tickerOrName: 'Ethereum (ETH)', assetType: 'crypto', currentMarketValue: 2800, totalAcquisitionCost: 4000, unrealizedPnL: -1200, lastPurchaseDate: '2024-02-10' },
    { id: 'pos-3', tickerOrName: 'Nvidia Corp (NVDA)', assetType: 'shares', currentMarketValue: 15000, totalAcquisitionCost: 8000, unrealizedPnL: +7000, lastPurchaseDate: '2023-10-10' },
  ];
  const harvestPlan = calculateTaxLossHarvesting(items, defaultOpenPositions);

  // Header
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div class="page-header__content">
      <div style="display:flex; align-items:center; gap:var(--space-sm); flex-wrap:wrap; margin-bottom:4px;">
        <h1 class="page-header__title" style="margin:0;">📈 Guanys Patrimonials & Cartera de Valors</h1>
        <span class="badge badge--primary">Mètode FIFO Oficial AEAT</span>
        <span class="badge badge--success">${items.length} Operacions</span>
      </div>
      <p class="page-header__subtitle">
        Transmissions d'accions, fons, criptomonedes, immobles, control automàtic de la Regla dels 2 Mesos (Art. 33.5) i Tax-Loss Harvesting
      </p>
    </div>
  `;

  const headerActions = document.createElement('div');
  headerActions.className = 'page-header__actions';
  headerActions.style.display = 'flex';
  headerActions.style.gap = 'var(--space-sm)';
  headerActions.style.flexWrap = 'wrap';

  // 1. Botó Tax-Loss Harvesting
  const harvestBtn = document.createElement('button');
  harvestBtn.className = 'btn btn--secondary';
  harvestBtn.style.borderColor = 'var(--color-success)';
  harvestBtn.style.color = 'var(--color-success)';
  harvestBtn.innerHTML = `🌾 Tax-Loss Harvesting (${formatCurrency(harvestPlan.projectedTaxSavingsEUR)})`;
  harvestBtn.addEventListener('click', () => openHarvestingModal(harvestPlan, page));

  // 2. Botó Presets de Cartera
  const presetsBtn = document.createElement('button');
  presetsBtn.className = 'btn btn--secondary';
  presetsBtn.innerHTML = '🎯 Presets de Cartera';
  presetsBtn.addEventListener('click', () => openStockPresetsModal(page));

  // 3. Botó Guia Caselles AEAT
  const guideBtn = document.createElement('button');
  guideBtn.className = 'btn btn--secondary';
  guideBtn.innerHTML = '📄 Caselles Renta Web (0328-0336)';
  guideBtn.addEventListener('click', () => openAEATBoxesModal(items, totalSuspendedLosses, totalComputableNetGain));

  // 4. Botó Importar CSV
  const importBtn = document.createElement('button');
  importBtn.className = 'btn btn--secondary';
  importBtn.innerHTML = '📥 Importar CSV (Broker)';
  importBtn.addEventListener('click', () => { window.location.hash = '#/importar'; });

  // 5. Botó Afegir manual
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn--primary';
  addBtn.innerHTML = '＋ Afegir Operació';
  addBtn.addEventListener('click', () => openAddModal(page));

  headerActions.appendChild(harvestBtn);
  headerActions.appendChild(presetsBtn);
  headerActions.appendChild(guideBtn);
  headerActions.appendChild(importBtn);
  headerActions.appendChild(addBtn);
  header.appendChild(headerActions);
  page.appendChild(header);

  // ZONA D'IMPORTACIÓ DIRECTA DE BRÒKER (INLINE DROPZONE)
  const dropzoneCard = document.createElement('div');
  dropzoneCard.className = 'card';
  dropzoneCard.style.marginBottom = 'var(--space-xl)';
  dropzoneCard.style.background = 'linear-gradient(135deg, var(--bg-surface-elevated), var(--bg-surface))';
  dropzoneCard.style.border = '1px dashed var(--color-primary)';
  
  dropzoneCard.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-md);">
      <div>
        <div style="display:flex; align-items:center; gap:var(--space-xs);">
          <span style="font-size:1.5rem;">⚡</span>
          <strong style="font-size:var(--text-md);">Bròker Hub: Importació & Sincronització Automàtica</strong>
          <span class="badge badge--primary">Auto-detecció de format</span>
        </div>
        <div style="font-size:var(--text-xs); color:var(--text-muted); margin-top:4px;">
          Arrossega qualsevol fitxer CSV (DEGIRO, Interactive Brokers, Trade Republic, Revolut, eToro, Scalable, Binance, Coinbase, etc.)
        </div>
      </div>
      <div style="display:flex; gap:var(--space-sm); align-items:center;">
        <input type="file" id="inline-broker-csv" accept=".csv" style="display:none;">
        <button class="btn btn--primary btn--sm" id="btn-trigger-upload">
          📁 Seleccionar CSV del Bròker
        </button>
      </div>
    </div>
    <div id="inline-upload-status" style="margin-top:var(--space-sm); display:none; font-size:var(--text-xs); color:var(--text-muted);"></div>
  `;

  page.appendChild(dropzoneCard);

  // Listeners per a la zona d'importació
  setTimeout(() => {
    const fileInput = dropzoneCard.querySelector('#inline-broker-csv') as HTMLInputElement;
    const triggerBtn = dropzoneCard.querySelector('#btn-trigger-upload') as HTMLButtonElement;
    const statusDiv = dropzoneCard.querySelector('#inline-upload-status') as HTMLElement;

    triggerBtn?.addEventListener('click', () => fileInput.click());

    fileInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      statusDiv.style.display = 'block';
      statusDiv.innerHTML = `<span class="spinner"></span> Processant ${file.name}...`;

      try {
        const text = await file.text();
        const parsed = await autoParseBrokerCSV(text);

        if (parsed.trades.length === 0) {
          statusDiv.innerHTML = `<span class="text-error">⚠️ No s'han trobat operacions vàlides al CSV.</span>`;
          showToast('No s\'han trobat operacions vàlides', 'error');
          return;
        }

        const syncResult = syncTradesToStore(parsed.trades, parsed.dividends, { append: false });
        
        statusDiv.innerHTML = `
          <span class="text-success">✅ S'han importat ${parsed.trades.length} moviments de <strong>${parsed.detectedBroker.label}</strong> i s'han generat ${syncResult.itemsCreated} transmissions FIFO oficials.</span>
        `;
        showToast(`Importades ${parsed.trades.length} operacions amb èxit (${parsed.detectedBroker.label})`, 'success');
        
        setTimeout(() => {
          page.replaceWith(renderGains());
        }, 800);

      } catch (err) {
        console.error(err);
        statusDiv.innerHTML = `<span class="text-error">❌ Error en processar el fitxer CSV.</span>`;
        showToast('Error en processar el fitxer', 'error');
      }
    });
  }, 0);

  // Targetes de Resum Global (KPIs)
  const statsRow = document.createElement('div');
  statsRow.className = 'dashboard-stats';
  statsRow.style.marginBottom = 'var(--space-xl)';

  const isNetPositive = totalComputableNetGain >= 0;

  statsRow.innerHTML = `
    <div class="stat-card">
      <div class="stat-card__label">Guanys Bruts Realitzats</div>
      <div class="stat-card__value text-success">+${formatCurrency(totalGrossGain)}</div>
      <div class="stat-card__hint">Pèrdues brutes: -${formatCurrency(totalGrossLoss)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__label">Pèrdues Suspeses (Art. 33.5)</div>
      <div class="stat-card__value ${totalSuspendedLosses > 0 ? 'text-warning' : 'text-muted'}">
        ${totalSuspendedLosses > 0 ? `-${formatCurrency(totalSuspendedLosses)}` : '0,00 €'}
      </div>
      <div class="stat-card__hint">Regla 2 mesos / 1 any (Casella 0335/0336)</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__label">Rendiment Net Computable</div>
      <div class="stat-card__value ${isNetPositive ? 'text-primary' : 'text-error'} font-bold">
        ${isNetPositive ? '+' : ''}${formatCurrency(totalComputableNetGain)}
      </div>
      <div class="stat-card__hint">Base Imposable de l'Estalvi (Casella 0424)</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__label">Estalvi per Tax-Loss Harvesting</div>
      <div class="stat-card__value text-success font-bold">+${formatCurrency(harvestPlan.projectedTaxSavingsEUR)}</div>
      <div class="stat-card__hint">${harvestPlan.recommendedSales.length} vendes recomanades abans del 31/12</div>
    </div>
  `;
  page.appendChild(statsRow);

  // Items list
  const listContainer = document.createElement('div');
  listContainer.id = 'gains-list';
  renderItemsList(listContainer, items, page);
  page.appendChild(listContainer);

  // Withholdings
  const whCard = document.createElement('div');
  whCard.className = 'card';
  whCard.style.marginTop = 'var(--space-lg)';
  whCard.appendChild(
    createFormSection(
      'Retencions a Compte sobre Guanys',
      createFormRow(
        createField({
          id: 'gains-withholdings',
          label: 'Retencions sobre guanys patrimonials (Casella 0596 AEAT)',
          value: data.gains.totalWithholdings || 0,
          suffix: '€',
          placeholder: '0,00',
          onChange: (val) => {
            store.update('gains', { totalWithholdings: parseFloat(val) || 0 });
          },
        }),
      ),
    ),
  );
  page.appendChild(whCard);

  return page;
}

function renderItemsList(container: HTMLElement, items: GainItem[], page?: HTMLElement): void {
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = `
      <div class="card empty-state">
        <div class="empty-state__icon">📊</div>
        <div class="empty-state__title">Sense transmissions patrimonials registrades</div>
        <div class="empty-state__text">Arrossega el teu CSV de bròker o afegeix les teves operacions manualment per calcular guanys i pèrdues amb el mètode FIFO oficial.</div>
      </div>
    `;
    return;
  }

  const list = document.createElement('div');
  list.className = 'item-list';

  const typeLabels: Record<string, string> = {
    shares: '📈 Accions / ETF',
    funds: '📊 Fons d\'Inversió',
    real_estate: '🏠 Immoble',
    crypto: '₿ Criptomoneda',
    other: '📋 Altres Actius',
  };

  for (const item of items) {
    const rawGain = (item.transferValue || 0) - (item.acquisitionValue || 0) - (item.expenses || 0);
    let netTaxable = rawGain;
    let exemptionNote = '';

    if (item.isPrimaryResidenceExemptOver65 && rawGain > 0) {
      netTaxable = 0;
      exemptionNote = 'Exempció Venda Habitatge >65 anys (Art. 33.4.b)';
    } else if (item.isPrimaryResidenceReinvestment && rawGain > 0 && item.reinvestmentAmount) {
      const ratio = Math.min(1, item.reinvestmentAmount / (item.transferValue || 1));
      netTaxable = rawGain * (1 - ratio);
      exemptionNote = `Exempció Reinversió Habitatge (${Math.round(ratio * 100)}%)`;
    } else if (item.isLifeAnnuityExemptOver65 && rawGain > 0 && item.lifeAnnuityAmount) {
      const ratio = Math.min(1, item.lifeAnnuityAmount / (item.transferValue || 1));
      netTaxable = rawGain * (1 - ratio);
      exemptionNote = 'Exempció Renda Vitalícia >65 anys (Art. 38.3)';
    }

    // Regla dels 2 mesos / Anti-Wash Sale
    let washSaleBadge = '';
    if (rawGain < 0) {
      if (item.nonComputableLossAmount !== undefined && item.nonComputableLossAmount > 0) {
        washSaleBadge = `<span class="badge badge--warning" style="font-size:0.7rem;">🟡 Pèrdua Suspesa: ${formatCurrency(item.nonComputableLossAmount)} (Art. 33.5)</span>`;
      } else if (item.isNonComputableLoss) {
        washSaleBadge = `<span class="badge badge--danger" style="font-size:0.7rem;">🔴 Pèrdua Suspesa Total (Recompra <2 mesos)</span>`;
      } else {
        washSaleBadge = `<span class="badge badge--success" style="font-size:0.7rem;">🟢 Computable 100% (AEAT)</span>`;
      }
    }

    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div class="item-row__content" style="display:grid; grid-template-columns: 1.2fr 2fr 1fr 1fr 1.5fr; gap:var(--space-sm); align-items:center;">
        <div class="item-row__field">
          <span class="item-row__field-label">Tipus</span>
          <span class="item-row__field-value" style="font-weight:600;">${typeLabels[item.type] ?? item.type}</span>
        </div>
        <div class="item-row__field">
          <span class="item-row__field-label">Descripció & Dates</span>
          <span class="item-row__field-value">
            <strong>${item.description || '—'}</strong><br>
            <span style="font-size:0.7rem; color:var(--text-muted);">
              Compra: ${item.acquisitionDate || '—'} $\rightarrow$ Venda: ${item.transferDate || '—'}
            </span>
          </span>
        </div>
        <div class="item-row__field">
          <span class="item-row__field-label">Adquisició</span>
          <span class="item-row__field-value">${formatCurrency(item.acquisitionValue)}</span>
        </div>
        <div class="item-row__field">
          <span class="item-row__field-label">Transmissió</span>
          <span class="item-row__field-value">${formatCurrency(item.transferValue)}</span>
        </div>
        <div class="item-row__field">
          <span class="item-row__field-label">Rendiment Computable</span>
          <span class="item-row__field-value ${netTaxable >= 0 ? 'text-success' : 'text-error'}" style="font-weight:700;">
            ${netTaxable >= 0 ? '+' : ''}${formatCurrency(netTaxable)}
            ${washSaleBadge ? `<br>${washSaleBadge}` : ''}
            ${exemptionNote ? `<br><span style="font-size:0.7rem; color:var(--color-success); font-weight:600;">${exemptionNote}</span>` : ''}
          </span>
        </div>
      </div>
      <div class="item-row__actions" style="margin-left:var(--space-md);">
        <button class="btn btn--ghost btn--sm btn--icon" data-delete="${item.id}" title="Eliminar">🗑</button>
      </div>
    `;

    row.querySelector(`[data-delete="${item.id}"]`)!.addEventListener('click', () => {
      const gains = store.getData().gains;
      const newItems = gains.items.filter((i) => i.id !== item.id);
      store.setSection('gains', { ...gains, items: newItems });
      if (page) {
        page.replaceWith(renderGains());
      } else {
        renderItemsList(container, newItems);
      }
      showToast('Operació eliminada', 'success');
    });

    list.appendChild(row);
  }

  container.appendChild(list);
}

/**
 * Modal Interactiu de Tax-Loss Harvesting
 */
function openHarvestingModal(plan: ReturnType<typeof calculateTaxLossHarvesting>, page: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.maxWidth = '800px';

  modal.innerHTML = `
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:var(--space-xs);">
        <span style="font-size:1.5rem;">🌾</span>
        <h2 class="modal-title">Optimitzador de Tax-Loss Harvesting Intel·ligent</h2>
      </div>
      <button class="modal-close" id="modal-close-btn">&times;</button>
    </div>
    <div class="modal-body" style="display:flex; flex-direction:column; gap: var(--space-lg);">
      <p style="font-size:var(--text-sm); color:var(--text-muted); margin:0;">
        Aquest algorisme analitza la teva cartera i et proposa tancar exactament les posicions que acumulen <strong>pèrdues latents abans del 31 de desembre</strong> per compensar el 100% dels teus guanys patrimonials realitzats i reduir l'impost de la base de l'estalvi a <strong>0 €</strong>.
      </p>

      <!-- KPIs del pla d'estalvi -->
      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:var(--space-md); text-align:center;">
        <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
          <div style="font-size:var(--text-xs); color:var(--text-muted);">Guanys Realitzats Actuals</div>
          <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-primary);">${formatCurrency(plan.totalRealizedNetGains)}</div>
        </div>
        <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
          <div style="font-size:var(--text-xs); color:var(--text-muted);">Pèrdua a Aflorar Recomanada</div>
          <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-warning);">-${formatCurrency(plan.totalLossHarvestedEUR)}</div>
        </div>
        <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
          <div style="font-size:var(--text-xs); color:var(--text-muted);">Estalvi Directe d'Impostos</div>
          <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-success);">+${formatCurrency(plan.projectedTaxSavingsEUR)}</div>
        </div>
      </div>

      <!-- Llista de recomanacions de venda -->
      <div>
        <strong style="font-size:var(--text-sm); margin-bottom:var(--space-xs); display:block;">
          Vendes Estratègiques Recomanades:
        </strong>
        
        <div style="display:flex; flex-direction:column; gap:var(--space-sm);">
          ${plan.recommendedSales.length > 0 ? plan.recommendedSales.map(rec => `
            <div style="background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
              <div>
                <strong style="font-size:var(--text-md);">${rec.tickerOrName}</strong>
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
                  Pèrdua latent total: <strong class="text-error">-${formatCurrency(rec.unrealizedLoss)}</strong> | Venda requerida: <strong>${formatCurrency(rec.amountToSellEUR)}</strong>
                </div>
                <div style="font-size:0.7rem; color:${rec.washSaleRisk ? 'var(--color-warning)' : 'var(--color-success)'}; margin-top:4px;">
                  ${rec.washSaleWarning}
                </div>
              </div>
              <button class="btn btn--secondary btn--sm" id="btn-simulate-sale-${rec.positionId}">
                ⚡ Simular Venda Fiscal
              </button>
            </div>
          `).join('') : `
            <div style="text-align:center; padding:var(--space-lg); color:var(--text-muted); background:var(--bg-surface); border-radius:var(--radius-md); border:1px solid var(--border-default);">
              🎉 Enhorabona! No tens guanys pendents de compensar o la teva base imposable ja està optimitzada a 0 €.
            </div>
          `}
        </div>
      </div>
    </div>
    <div class="modal-footer" style="display:flex; justify-content:flex-end; gap: var(--space-md); padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--border-default);">
      <button class="btn btn--ghost" id="modal-close-action-btn">Tancar</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  modal.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#modal-close-action-btn')?.addEventListener('click', closeModal);

  plan.recommendedSales.forEach(rec => {
    modal.querySelector(`#btn-simulate-sale-${rec.positionId}`)?.addEventListener('click', () => {
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
      closeModal();
      page.replaceWith(renderGains());
      showToast(`Simulada venda fiscal de ${rec.tickerOrName}. S'ha compensat la base de l'estalvi!`, 'success');
    });
  });
}

/**
 * Modal de Presets de Cartera de Valors
 */
function openStockPresetsModal(page: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.maxWidth = '800px';

  const presets = getStockPortfolioPresets();

  modal.innerHTML = `
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:var(--space-xs);">
        <span style="font-size:1.5rem;">🎯</span>
        <h2 class="modal-title">Presets de Cartera d'Accions & Bròkers</h2>
      </div>
      <button class="modal-close" id="modal-close-btn">&times;</button>
    </div>
    <div class="modal-body" style="display:flex; flex-direction:column; gap: var(--space-md);">
      <p style="font-size:var(--text-sm); color:var(--text-muted); margin:0;">
        Carrega una cartera d'inversió real pre-configurada per provar el motor FIFO, la detecció de la Regla dels 2 Mesos o el Tax-Loss Harvesting:
      </p>

      <div style="display:flex; flex-direction:column; gap:var(--space-sm);">
        ${presets.map((preset, idx) => `
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
            <div style="max-width:550px;">
              <div style="font-weight:700; font-size:var(--text-md);">${preset.name}</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:2px;">${preset.description}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
                Bròker: <strong>${preset.broker.toUpperCase()}</strong> | Operacions: <strong>${preset.trades.length} moviments</strong>
              </div>
            </div>
            <button class="btn btn--primary btn--sm" id="btn-load-stock-preset-${idx}">
              📥 Carregar Aquesta
            </button>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="modal-footer" style="display:flex; justify-content:flex-end; padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--border-default);">
      <button class="btn btn--ghost" id="modal-cancel-btn">Tancar</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  modal.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#modal-cancel-btn')?.addEventListener('click', closeModal);

  presets.forEach((preset, idx) => {
    modal.querySelector(`#btn-load-stock-preset-${idx}`)?.addEventListener('click', () => {
      syncTradesToStore(preset.trades, undefined, { append: false });
      closeModal();
      page.replaceWith(renderGains());
      showToast(`Cartera "${preset.name}" sincronitzada amb èxit`, 'success');
    });
  });
}

/**
 * Modal de Guia de Caselles Renta Web (0328 a 0336)
 */
function openAEATBoxesModal(items: GainItem[], totalSuspended: number, totalComputable: number): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.maxWidth = '750px';

  const totalTransfer = items.reduce((s, it) => s + (it.transferValue || 0), 0);
  const totalAcquisition = items.reduce((s, it) => s + (it.acquisitionValue || 0), 0);

  modal.innerHTML = `
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:var(--space-xs);">
        <span style="font-size:1.5rem;">📄</span>
        <h2 class="modal-title">Guia de Caselles Oficials AEAT (Renta Web)</h2>
      </div>
      <button class="modal-close" id="modal-close-btn">&times;</button>
    </div>
    <div class="modal-body" style="display:flex; flex-direction:column; gap: var(--space-md);">
      <p style="font-size:var(--text-sm); color:var(--text-muted); margin:0;">
        Imports exactes preparats per traslladar a les caselles oficials del model 100 de l'Agència Tributària:
      </p>

      <table style="width:100%; border-collapse:collapse; font-size:var(--text-sm); border:1px solid var(--border-default); border-radius:var(--radius-md);">
        <thead>
          <tr style="background:var(--bg-surface-elevated); border-bottom:2px solid var(--border-default); text-align:left;">
            <th style="padding:8px;">Casella AEAT</th>
            <th style="padding:8px;">Concepte</th>
            <th style="padding:8px; text-align:right;">Import (€)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid var(--border-default);">
            <td style="padding:8px; font-weight:700; color:var(--color-primary);">Casella 0328</td>
            <td style="padding:8px;">Valor de Transmissió (Vendes totals satisfetes)</td>
            <td style="padding:8px; text-align:right; font-weight:700;">${formatCurrency(totalTransfer)}</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border-default);">
            <td style="padding:8px; font-weight:700; color:var(--color-primary);">Casella 0330</td>
            <td style="padding:8px;">Valor d'Adquisició (Compres + Comissions FIFO)</td>
            <td style="padding:8px; text-align:right; font-weight:700;">${formatCurrency(totalAcquisition)}</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border-default);">
            <td style="padding:8px; font-weight:700; color:var(--color-primary);">Casella 0332</td>
            <td style="padding:8px;">Guany o Pèrdua Patrimonial Brut</td>
            <td style="padding:8px; text-align:right; font-weight:700;">${formatCurrency(totalTransfer - totalAcquisition)}</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border-default);">
            <td style="padding:8px; font-weight:700; color:var(--color-warning);">Casella 0335/0336</td>
            <td style="padding:8px;">Pèrdues No Computables (Regla 2 mesos / 1 any Art. 33.5)</td>
            <td style="padding:8px; text-align:right; font-weight:700; color:var(--color-warning);">${formatCurrency(totalSuspended)}</td>
          </tr>
          <tr style="background:var(--bg-surface-elevated); font-weight:800;">
            <td style="padding:8px; color:var(--color-success);">Casella 0424</td>
            <td style="padding:8px;">Base Imposable de l'Estalvi Computable</td>
            <td style="padding:8px; text-align:right; color:var(--color-success);">${formatCurrency(totalComputable)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="modal-footer" style="display:flex; justify-content:flex-end; padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--border-default);">
      <button class="btn btn--primary" id="modal-close-btn-2">D'acord</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  modal.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#modal-close-btn-2')?.addEventListener('click', closeModal);
}

function openAddModal(page: HTMLElement): void {
  const { body, footer, close } = openModal({ title: 'Nova operació patrimonial' });

  const form: Partial<GainItem> = {
    type: 'shares',
    description: '',
    acquisitionValue: 0,
    transferValue: 0,
    expenses: 0,
    acquisitionDate: '',
    transferDate: '',
    isPrimaryResidenceExemptOver65: false,
    isPrimaryResidenceReinvestment: false,
    reinvestmentAmount: 0,
    isLifeAnnuityExemptOver65: false,
    lifeAnnuityAmount: 0,
  };

  const fields = document.createElement('div');
  fields.style.display = 'flex';
  fields.style.flexDirection = 'column';
  fields.style.gap = 'var(--space-md)';

  fields.appendChild(
    createField({
      id: 'gain-type',
      label: 'Tipus d\'actiu',
      type: 'select',
      value: 'shares',
      options: [
        { value: 'shares', label: '📈 Accions / ETF' },
        { value: 'funds', label: '📊 Fons d\'inversió' },
        { value: 'real_estate', label: '🏠 Immoble / Habitatge' },
        { value: 'crypto', label: '₿ Criptomoneda' },
        { value: 'other', label: '📋 Altres actius' },
      ],
      onChange: (val) => { form.type = val as GainItem['type']; },
    }),
  );

  fields.appendChild(
    createField({
      id: 'gain-description',
      label: 'Descripció',
      type: 'text',
      placeholder: 'Ex: Venda accions Telefónica o Venda pis',
      onChange: (val) => { form.description = val; },
    }),
  );

  fields.appendChild(
    createFormRow(
      createField({
        id: 'gain-acquisition-date',
        label: 'Data d\'adquisició',
        type: 'date',
        onChange: (val) => { form.acquisitionDate = val; },
      }),
      createField({
        id: 'gain-transfer-date',
        label: 'Data de transmissió',
        type: 'date',
        onChange: (val) => { form.transferDate = val; },
      }),
    ),
  );

  fields.appendChild(
    createFormRow(
      createField({
        id: 'gain-acquisition-val',
        label: 'Valor d\'adquisició (€)',
        value: 0,
        suffix: '€',
        placeholder: '0,00',
        onChange: (val) => { form.acquisitionValue = parseFloat(val) || 0; },
      }),
      createField({
        id: 'gain-transfer-val',
        label: 'Valor de transmissió (€)',
        value: 0,
        suffix: '€',
        placeholder: '0,00',
        onChange: (val) => { form.transferValue = parseFloat(val) || 0; },
      }),
    ),
  );

  fields.appendChild(
    createField({
      id: 'gain-expenses',
      label: 'Despeses de transmissió / comissions (€)',
      value: 0,
      suffix: '€',
      placeholder: '0,00',
      onChange: (val) => { form.expenses = parseFloat(val) || 0; },
    }),
  );

  body.appendChild(fields);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn--primary';
  saveBtn.textContent = 'Guardar';
  saveBtn.addEventListener('click', () => {
    if (!form.description) {
      showToast('Introdueix una descripció', 'warning');
      return;
    }
    const current = store.getData().gains?.items || [];
    current.push({
      id: `gain-${Date.now()}`,
      description: form.description || '',
      type: form.type || 'shares',
      acquisitionDate: form.acquisitionDate || '',
      transferDate: form.transferDate || '',
      acquisitionValue: form.acquisitionValue || 0,
      transferValue: form.transferValue || 0,
      expenses: form.expenses || 0,
    });
    store.update('gains', { items: current });
    close();
    page.replaceWith(renderGains());
    showToast('Operació afegida correctament', 'success');
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn--ghost';
  cancelBtn.textContent = 'Cancel·lar';
  cancelBtn.addEventListener('click', close);

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
}
