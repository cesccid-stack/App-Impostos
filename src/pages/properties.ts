/**
 * @module pages/properties
 * Pàgina d'Explotació d'Immobles en Lloguer, Extracontable d'Actius, Gestió d'Altes/Baixes, Consulta al Cadastre i Amortitzacions AEAT.
 * Conforme amb l'Art. 23 LIRPF, Taula Simplificada AEAT, Criteris DGT i Llei 12/2023 pel Dret a l'Habitatge.
 * 
 * Funcionalitats d'Automatització Total:
 * - Escàner & Categoritzador intel·ligent de factures, despeses i extractes bancaris (NLP/Regles).
 * - Motor de gestió de contractes i actualització legal de renda (Límit 3% IPC / IRAV / Llei 12/2023).
 * - Gestor multianual de compensació de despeses a 4 anys (Art. 23.1.a LIRPF) amb assessor fiscal.
 * - Mètriques de Rendibilitat Immobiliària (Gross/Net Yield, Cash Flow, Cap Rate, Retorn net IRPF).
 * - Presets d'immobles carregables en 1 clic i Optimitzador Fiscal automàtic de la cartera.
 */

import { store } from '../store.ts';
import { calculatePropertyFiscalResult, calculateAllProperties } from '../fiscal/real-estate-engine.ts';
import { 
  AEAT_SIMPLIFIED_TABLE, 
  getAEATAssetGroup, 
  suggestAEATCategory, 
  calculateItemAnnualAmortization, 
  type AEATAssetGroupId 
} from '../fiscal/amortization-tables.ts';
import { 
  parsePropertyExpenses, 
  applyParsedExpensesToProperty, 
  calculateRentAdjustment, 
  calculateFourYearCarryoverPlan,
  getRealEstatePortfolioPresets,
  auditAndOptimizeProperties,
  type ParsedExpenseItem
} from '../fiscal/real-estate-automator.ts';
import { formatCurrency } from '../utils/currency.ts';
import { showToast } from '../components/toast.ts';
import { generateAEATAnnexA, generateAEATAmortizationBook, exportPropertiesInventoryCSV } from '../utils/aeat-export.ts';
import { lookupCadastreReference } from '../utils/cadastre-service.ts';
import { runAutomatedComplianceChecks } from '../fiscal/auto-validator.ts';
import { openComplianceModal } from '../components/compliance-modal.ts';
import { createRealEstateDashboard } from '../components/real-estate-dashboard.ts';
import { Model115And180Engine } from '../fiscal/model115-180-engine.ts';
import type { RentalProperty, PropertyInventoryItem, RentalReductionType, AssetDisposalReason } from '../types-properties.ts';
import type { Model115LeaseInput } from '../types-quarterly.ts';

export function renderProperties(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page';

  const data = store.getData();
  const properties = data.properties || [];
  const aggregate = calculateAllProperties(properties, data.year || 2024);
  const compliance = runAutomatedComplianceChecks(data);

  // Càlcul de rendibilitats agregades de la cartera
  const totalCostPortfolio = properties.reduce((s, p) => s + (p.acquisitionCost || p.totalCadastralValue || 0), 0);
  const avgGrossYield = totalCostPortfolio > 0 ? (aggregate.totalGrossIncome / totalCostPortfolio) * 100 : 0;
  const totalOperatingExp = aggregate.results.reduce((s, r) => s + r.totalCurrentExpenses + r.repairExpenses + r.mortgageInterests, 0);
  const totalNOI = aggregate.totalGrossIncome - totalOperatingExp;
  const avgNetYield = totalCostPortfolio > 0 ? (totalNOI / totalCostPortfolio) * 100 : 0;
  const totalTaxShieldPortfolio = aggregate.results.reduce((s, r) => s + (r.metrics?.estimatedSavingsAEAT || 0), 0);

  // Header
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div class="page-header__content">
      <div style="display:flex; align-items:center; gap:var(--space-sm); flex-wrap:wrap; margin-bottom:4px;">
        <h1 class="page-header__title" style="margin:0;">🏠 Gestió & Extracontable d'Immobles en Lloguer</h1>
        <span class="badge badge--primary">Automatització Total AEAT</span>
        <span class="badge badge--success">${properties.length} Immobles</span>
      </div>
      <p class="page-header__subtitle">
        Escàner de factures i extractes, actualització de lloguers (IPC/IRAV), control 4 anys d'excedents, rendibilitats i Taula Simplificada AEAT (30%-3%)
      </p>
    </div>
  `;

  const headerActions = document.createElement('div');
  headerActions.className = 'page-header__actions';
  headerActions.style.display = 'flex';
  headerActions.style.gap = 'var(--space-sm)';
  headerActions.style.flexWrap = 'wrap';

  // 1. Botó Optimitzador Fiscal
  const optimizeBtn = document.createElement('button');
  optimizeBtn.className = 'btn btn--secondary';
  optimizeBtn.style.borderColor = 'var(--color-primary)';
  optimizeBtn.style.color = 'var(--color-primary)';
  optimizeBtn.innerHTML = '⚡ Optimitzador Fiscal';
  optimizeBtn.addEventListener('click', () => {
    if (properties.length === 0) {
      showToast('Afegeix almenys un immoble per optimitzar la cartera', 'warning');
      return;
    }
    const audit = auditAndOptimizeProperties(properties);
    store.setSection('properties', audit.optimizedProperties);
    page.replaceWith(renderProperties());
    
    if (audit.improvementsApplied.length > 0) {
      const msg = `S'han aplicat ${audit.improvementsApplied.length} millores fiscals. Estalvi estimat: ~${formatCurrency(audit.estimatedTotalTaxSaved)}`;
      showToast(msg, 'success');
      alert(`🎉 AUDITORIA I OPTIMITZACIÓ FISCAL COMPLETADA:\n\n${audit.improvementsApplied.join('\n\n')}\n\n💰 Estalvi fiscal estimat en IRPF: +${formatCurrency(audit.estimatedTotalTaxSaved)}`);
    } else {
      showToast('La teva cartera d\'immobles ja està optimitzada al 100%!', 'success');
    }
  });

  // 2. Botó Escàner de Factures / Extracte Bancari
  const scanBtn = document.createElement('button');
  scanBtn.className = 'btn btn--secondary';
  scanBtn.innerHTML = '📥 Escàner Despeses / Factures';
  scanBtn.addEventListener('click', () => openExpenseScannerModal(null, page));

  // 3. Botó Presets de Cartera
  const presetsBtn = document.createElement('button');
  presetsBtn.className = 'btn btn--secondary';
  presetsBtn.innerHTML = '🎯 Presets d\'Immobles';
  presetsBtn.addEventListener('click', () => openPresetsModal(page));

  // 4. Botó Llibre Registre AEAT
  const bookBtn = document.createElement('button');
  bookBtn.className = 'btn btn--secondary';
  bookBtn.innerHTML = '📒 Llibre AEAT';
  bookBtn.addEventListener('click', () => {
    if (properties.length === 0) {
      showToast('No hi ha immobles per exportar', 'warning');
      return;
    }
    const txt = generateAEATAmortizationBook(properties, data.year || 2024);
    downloadFile(txt, `llibre_registre_amortitzacions_${data.year}.txt`, 'text/plain;charset=utf-8');
    showToast('Llibre Registre d\'Amortitzacions descarregat', 'success');
  });

  // 5. Botó CSV Inventari
  const csvBtn = document.createElement('button');
  csvBtn.className = 'btn btn--secondary';
  csvBtn.innerHTML = '📊 CSV Inventari';
  csvBtn.addEventListener('click', () => {
    if (properties.length === 0) {
      showToast('No hi ha inventari per exportar', 'warning');
      return;
    }
    const csv = exportPropertiesInventoryCSV(properties, data.year || 2024);
    downloadFile(csv, `inventari_actius_immobles_${data.year}.csv`, 'text/csv;charset=utf-8');
    showToast('Fitxer CSV d\'inventari descarregat', 'success');
  });

  // 6. Botó Annex A AEAT
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn--secondary';
  exportBtn.innerHTML = '📄 Guia Renta Web';
  exportBtn.addEventListener('click', () => {
    if (properties.length === 0) {
      showToast('No hi ha immobles per exportar', 'warning');
      return;
    }
    const txt = generateAEATAnnexA(aggregate.results, data.year || 2024);
    downloadFile(txt, `aeat_annex_a_immobles_${data.year}.txt`, 'text/plain;charset=utf-8');
    showToast('Guia Annex A descarregada', 'success');
  });

  // 7. Botó Sincronització IVA (Locals i Lloguers)
  const ivaBtn = document.createElement('button');
  ivaBtn.className = 'btn btn--secondary';
  ivaBtn.innerHTML = '🧾 Sincronitzar amb l\'IVA';
  ivaBtn.title = 'Generar factures d\'arrendament de locals i càlcul de prorrata per habitatges';
  ivaBtn.addEventListener('click', () => {
    if (properties.length === 0) {
      showToast('No hi ha immobles a la cartera per sincronitzar', 'warning');
      return;
    }
    const res = store.syncIVAFromProperties();
    showToast(`Immobles sincronitzats amb l'IVA: +${res.addedCommercialRentals} locals (21%), +${res.addedTouristRentals} turístics, +${res.addedExemptRentals} habitatges`, 'success');
  });

  // 8. Botó Diagnòstic de Conformitat
  const complianceBtn = document.createElement('button');
  complianceBtn.className = 'btn btn--secondary';
  complianceBtn.innerHTML = `🛡️ ${compliance.complianceScore}% Auditat`;
  complianceBtn.title = 'Auditoria i comprovacions automàtiques de la cartera immobiliària';
  complianceBtn.addEventListener('click', () => {
    openComplianceModal(() => page.replaceWith(renderProperties()));
  });

  // 9. Botó afegir immoble
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn--primary';
  addBtn.innerHTML = '＋ Afegir Immoble';
  addBtn.addEventListener('click', () => openPropertyModal(null, page));

  headerActions.appendChild(complianceBtn);
  headerActions.appendChild(optimizeBtn);
  headerActions.appendChild(scanBtn);
  headerActions.appendChild(presetsBtn);
  headerActions.appendChild(ivaBtn);
  headerActions.appendChild(bookBtn);
  headerActions.appendChild(csvBtn);
  headerActions.appendChild(exportBtn);
  headerActions.appendChild(addBtn);
  header.appendChild(headerActions);
  page.appendChild(header);

  // Targetes de Resum Global
  const statsRow = document.createElement('div');
  statsRow.className = 'dashboard-stats';
  statsRow.style.marginBottom = 'var(--space-xl)';
  
  const totalInventoryCount = properties.reduce((s, p) => s + (p.inventory?.length || 0), 0);

  statsRow.innerHTML = `
    <div class="stat-card">
      <div class="stat-card__label">Ingressos Totals Lloguer</div>
      <div class="stat-card__value text-primary">${formatCurrency(aggregate.totalGrossIncome)}</div>
      <div class="stat-card__hint">${properties.length} immobles | Yield Brut: <strong>${avgGrossYield.toFixed(2)}%</strong> (Net: <strong>${avgNetYield.toFixed(2)}%</strong>)</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__label">Amortitzacions Deduïdes AEAT (${data.year || 2024})</div>
      <div class="stat-card__value text-info">${formatCurrency(aggregate.totalAmortization)}</div>
      <div class="stat-card__hint">Construcció (3%) + ${totalInventoryCount} actius d'inventari (30%-3%)</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__label">Reduccions Habitatge Habitual</div>
      <div class="stat-card__value text-success">-${formatCurrency(aggregate.totalReductions)}</div>
      <div class="stat-card__hint">Llei 12/2023 (50%-90%)</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__label">Rendiment Net a Base General</div>
      <div class="stat-card__value font-bold">${formatCurrency(aggregate.totalNetReducedIncome)}</div>
      <div class="stat-card__hint">Casella 0105 | Escut Fiscal: <strong>+${formatCurrency(totalTaxShieldPortfolio)}</strong></div>
    </div>
  `;
  page.appendChild(statsRow);

  // Quadre de Comandament de Rendibilitat & Tendència (Global & Per Explotació)
  page.appendChild(createRealEstateDashboard(properties, data.year || 2024));

  // Taula Informativa de Coeficients Màxims d'Amortització AEAT
  const coefBanner = document.createElement('div');
  coefBanner.className = 'card';
  coefBanner.style.marginBottom = 'var(--space-xl)';
  coefBanner.style.background = 'var(--bg-surface-elevated)';
  coefBanner.innerHTML = `
    <details>
      <summary style="cursor: pointer; font-weight: 600; color: var(--color-primary); display: flex; align-items: center; justify-content: space-between;">
        <span>ℹ️ Taula Oficial d'Amortització Simplificada AEAT (Coeficients Màxims i Mínim Temps)</span>
        <span style="font-size: 0.8rem; color: var(--text-muted);">Clica per veure els 6 grups</span>
      </summary>
      <div style="margin-top: var(--space-md); overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: var(--text-xs);">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-default); text-align: left;">
              <th style="padding: 6px;">Grup</th>
              <th style="padding: 6px;">Categoria d'Actius</th>
              <th style="padding: 6px; text-align: center;">Coeficient Màxim</th>
              <th style="padding: 6px; text-align: center;">Temps Mínim d'Amortització</th>
              <th style="padding: 6px;">Exemples i Elements Típics</th>
            </tr>
          </thead>
          <tbody>
            ${AEAT_SIMPLIFIED_TABLE.map(g => `
              <tr style="border-bottom: 1px solid var(--border-default);">
                <td style="padding: 6px; font-weight: 700;">Grup ${g.groupNumber}</td>
                <td style="padding: 6px; font-weight: 600;">${g.name}</td>
                <td style="padding: 6px; text-align: center; color: var(--color-success); font-weight: 700;">${g.maxLinearRate}%</td>
                <td style="padding: 6px; text-align: center; font-weight: 600;">~${g.minYears} anys</td>
                <td style="padding: 6px; color: var(--text-muted);">${g.examples.join(', ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </details>
  `;
  page.appendChild(coefBanner);

  // Secció de Vinculació amb Models 115 i 180 (Retencions Arrendaments Comercials)
  const commercialProps = properties.filter(p => p.usageType === 'commercial');
  const totalCommercialRent = commercialProps.reduce((s, p) => s + (p.grossRentalIncome || 0), 0);
  const expectedWithholdings19 = totalCommercialRent * 0.19;
  const currentDeclaredWithholding = data.capitalIncome?.realEstateWithholdings || 0;

  const withholdingsSection = document.createElement('div');
  withholdingsSection.className = 'card';
  withholdingsSection.style.marginBottom = 'var(--space-xl)';
  withholdingsSection.style.border = '1px solid var(--color-warning-border, rgba(245, 158, 11, 0.3))';
  withholdingsSection.style.background = 'var(--bg-surface-elevated)';

  withholdingsSection.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-md);">
      <div>
        <div style="display: flex; align-items: center; gap: var(--space-sm);">
          <span style="font-size: 1.3rem;">🏢</span>
          <h3 style="margin: 0; font-size: 1rem; color: var(--color-warning, #f59e0b);">
            Control de Retencions d'Arrendaments Comercials (Models 115 / 180 AEAT)
          </h3>
          <span class="badge ${commercialProps.length > 0 ? 'badge--warning' : 'badge--neutral'}">
            ${commercialProps.length} Immobles Comercials / Locals
          </span>
        </div>
        <p style="margin: var(--space-xs) 0 0 0; font-size: var(--text-xs); color: var(--text-muted); max-width: 750px;">
          Els llogaters de locals i oficines estan obligats a ingressar el <strong>19% de retenció</strong> mitjançant el <strong>Model 115 (trimestral)</strong> i el <strong>Model 180 (resum anual)</strong>. Aquestes retencions s'imputen directament a favor teu a la <strong>Casella 0598 de la Renda</strong>.
        </p>
      </div>
      <div style="display: flex; align-items: center; gap: var(--space-lg);">
        <div style="text-align: right;">
          <div style="font-size: var(--text-xs); color: var(--text-muted);">Retenció Teòrica 19% (${commercialProps.length} locals):</div>
          <div style="font-size: 1.1rem; font-weight: 700; color: var(--color-warning, #f59e0b);">${formatCurrency(expectedWithholdings19)}</div>
          <div style="font-size: 0.75rem; color: ${Math.abs(expectedWithholdings19 - currentDeclaredWithholding) < 0.01 ? 'var(--color-success)' : 'var(--color-error)'};">
            ${Math.abs(expectedWithholdings19 - currentDeclaredWithholding) < 0.01 ? '✓ Sincronitzat a Casella 0598' : `⚠️ Desquadrament: ${formatCurrency(currentDeclaredWithholding)} declarat`}
          </div>
        </div>
        <button class="btn btn--secondary btn--sm" id="sync-withholdings-btn" style="white-space: nowrap;">
          ⚡ Sincronitzar amb Models 115/180 i Casella 0598
        </button>
      </div>
    </div>
  `;

  withholdingsSection.querySelector('#sync-withholdings-btn')?.addEventListener('click', () => {
    // 1. Sincronitzem a capitalIncome.realEstateWithholdings
    const updatedData = store.getData();
    store.update('capitalIncome', {
      ...updatedData.capitalIncome,
      realEstateWithholdings: expectedWithholdings19,
    });

    // 2. Generem/Actualitzem la conciliació als models trimestrals
    const leaseInputs: Model115LeaseInput[] = commercialProps.map((p, idx) => ({
      id: p.id || `commercial_lease_${idx}`,
      landlordNif: updatedData.personal?.nif || 'B12345678',
      landlordName: updatedData.personal?.name || 'Propietari Arrendador',
      cadastralReference: p.cadastralReference || '00000000000000000000',
      address: p.address || 'Local Comercial 1',
      postalCode: '08001',
      municipality: 'Barcelona',
      provinceCode: '08',
      propertySituation: '1',
      monthlyRent: (p.grossRentalIncome || 0) / 12,
      withholdingRate: 0.19,
      isExempt: false,
    }));

    const mod115_quarters = Model115And180Engine.calculateModel115AllQuarters(updatedData.year || 2024, leaseInputs);
    const mod180_annual = Model115And180Engine.generateModel180Annual(updatedData.year || 2024, leaseInputs, mod115_quarters);

    store.update('quarterlyTaxes', {
      ...(updatedData.quarterlyTaxes || { mod130: [], mod111: [] }),
      mod115: mod115_quarters,
      mod180: mod180_annual,
    });

    showToast(`S'han sincronitzat ${formatCurrency(expectedWithholdings19)} de retencions a la Casella 0598 i generat el Model 180`, 'success');
    
    // Re-render
    const newPage = renderProperties();
    page.replaceWith(newPage);
  });

  page.appendChild(withholdingsSection);

  // Llista d'Immobles
  const listContainer = document.createElement('div');
  listContainer.className = 'properties-list';
  listContainer.style.display = 'flex';
  listContainer.style.flexDirection = 'column';
  listContainer.style.gap = 'var(--space-xl)';

  if (properties.length === 0) {
    listContainer.innerHTML = `
      <div class="card" style="text-align:center; padding: var(--space-3xl); color: var(--text-muted);">
        <div style="font-size: 3rem; margin-bottom: var(--space-md);">🏘️</div>
        <h3>Cap immoble en lloguer registrat</h3>
        <p style="max-width: 550px; margin: 0 auto var(--space-lg) auto;">
          Afegeix els teus immobles en lloguer o carrega un preset per gaudir de l'automatització total: escanejar factures bancàries, actualitzar lloguers amb l'IPC, consultar el Cadastre i deduir amortitzacions de forma 100% legal.
        </p>
        <div style="display:flex; justify-content:center; gap:var(--space-md); flex-wrap:wrap;">
          <button class="btn btn--primary" id="empty-add-btn">＋ Donar d'alta immoble manualment</button>
          <button class="btn btn--secondary" id="empty-preset-btn">🎯 Carregar immobles d'exemple</button>
        </div>
      </div>
    `;
    listContainer.querySelector('#empty-add-btn')?.addEventListener('click', () => openPropertyModal(null, page));
    listContainer.querySelector('#empty-preset-btn')?.addEventListener('click', () => openPresetsModal(page));
  } else {
    aggregate.results.forEach((res, idx) => {
      listContainer.appendChild(createPropertyCard(res, idx, page));
    });
  }

  page.appendChild(listContainer);
  return page;
}

function createPropertyCard(res: ReturnType<typeof calculatePropertyFiscalResult>, idx: number, page: HTMLElement): HTMLElement {
  const p = res.property;
  const m = res.metrics || {
    grossYield: 0,
    netYield: 0,
    cashFlowAnnual: 0,
    capRate: 0,
    afterTaxReturn: 0,
    estimatedSavingsAEAT: 0,
  };

  const card = document.createElement('div');
  card.className = 'card property-card';
  card.style.border = '1px solid var(--border-default)';
  card.style.borderRadius = 'var(--radius-lg)';
  card.style.overflow = 'hidden';

  const usageLabels: Record<string, string> = {
    habitual: '🏠 Habitatge Habitual',
    temporary: '⏳ Lloguer Temporal',
    tourist: '🏖️ Lloguer Turístic',
    commercial: '🏢 Local Comercial / Altres',
  };

  const reductionLabels: Record<RentalReductionType, string> = {
    none: 'Sense reducció',
    transitional_60: '60% (Contracte previ a 26/05/2023)',
    general_50: '50% (Règim general nou contracte)',
    rehabilitated_60: '60% (Rehabilitació en 2 darrers anys)',
    young_tenant_70: '70% (Llogaters 18-35 anys en zona tensionada)',
    public_or_social_70: '70% (Administració Pública o habitatge social)',
    tensioned_rent_cut_90: '90% (Rebaixa renda >= 5% en zona tensionada)',
  };

  const invCount = p.inventory?.length || 0;
  const b = res.inventoryBreakdown || {
    group6Tools30: 0,
    group5Computer26: 0,
    group4Transport16: 0,
    group3Machinery12: 0,
    group2Furniture10: 0,
    group1Improvements3: 0,
    totalInventoryAmortization: 0,
  };

  card.innerHTML = `
    <div class="card__header" style="background: var(--bg-surface-elevated); padding: var(--space-lg); border-bottom: 1px solid var(--border-default); display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-md);">
      <div>
        <div style="display:flex; align-items:center; gap: var(--space-sm); flex-wrap: wrap;">
          <span style="font-size: var(--text-lg); font-weight: 700;">#${idx + 1} ${p.name || p.address}</span>
          <span class="badge badge--primary" style="font-size: 0.75rem;">${usageLabels[p.usageType] || p.usageType}</span>
          <span class="badge badge--neutral" style="font-size: 0.75rem;">Titularitat: ${p.ownershipPercentage}%</span>
          <span class="badge badge--success" style="font-size: 0.75rem;">📦 ${invCount} Actius a l'Inventari</span>
          <span class="badge badge--info" style="font-size: 0.75rem;">📈 Yield Brut: ${m.grossYield}% | Cap Rate: ${m.capRate}%</span>
        </div>
        <div style="color: var(--text-muted); font-size: var(--text-xs); margin-top: 4px;">
          <strong>Ref. Cadastral:</strong> ${p.cadastralReference || 'Pendent'} | <strong>Adreça:</strong> ${p.address || '—'}
          ${p.monthlyRent ? ` | <strong>Renda vigent:</strong> ${formatCurrency(p.monthlyRent)}/mes` : ''}
        </div>
      </div>
      <div style="display: flex; gap: var(--space-xs); align-items: center; flex-wrap: wrap;">
        <button class="btn btn--secondary btn--sm" id="scan-exp-btn-${p.id}">📥 Escanejar Despeses</button>
        <button class="btn btn--secondary btn--sm" id="manage-contract-btn-${p.id}">📜 Contracte & IPC</button>
        <button class="btn btn--secondary btn--sm" id="manage-carryover-btn-${p.id}">⏱️ 4 Anys Excedent</button>
        <button class="btn btn--secondary btn--sm" id="manage-inv-btn-${p.id}">📦 Inventari (${invCount})</button>
        <button class="btn btn--secondary btn--sm" id="edit-btn-${p.id}">✏️</button>
        <button class="btn btn--ghost btn--sm text-error" id="delete-btn-${p.id}">🗑</button>
      </div>
    </div>

    <div class="property-card__body" style="padding: var(--space-lg);">
      <!-- Mètriques financeres de l'immoble -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space-xs); margin-bottom: var(--space-md); padding: var(--space-sm); background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border-default); font-size: var(--text-xs);">
        <div>
          <span style="color:var(--text-muted);">Yield Brut:</span> <strong>${m.grossYield}%</strong>
        </div>
        <div>
          <span style="color:var(--text-muted);">Yield Net:</span> <strong class="text-primary">${m.netYield}%</strong>
        </div>
        <div>
          <span style="color:var(--text-muted);">Cash Flow Anual:</span> <strong class="${m.cashFlowAnnual >= 0 ? 'text-success' : 'text-error'}">${formatCurrency(m.cashFlowAnnual)}</strong>
        </div>
        <div>
          <span style="color:var(--text-muted);">Cap Rate:</span> <strong>${m.capRate}%</strong>
        </div>
        <div>
          <span style="color:var(--text-muted);">Estalvi AEAT:</span> <strong class="text-success">+${formatCurrency(m.estimatedSavingsAEAT)}</strong>
        </div>
      </div>

      <!-- Compte d'explotació fiscal -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-lg);">
        <div style="background: var(--bg-surface); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--border-default);">
          <div style="font-size: var(--text-xs); color: var(--text-muted);">1. Ingressos Íntegres</div>
          <div style="font-size: var(--text-lg); font-weight: 600; color: var(--color-primary);">${formatCurrency(res.grossIncome)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Casella 0066 AEAT</div>
        </div>
        <div style="background: var(--bg-surface); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--border-default);">
          <div style="font-size: var(--text-xs); color: var(--text-muted);">2. Despeses Limitades (Finanç. + Rep.)</div>
          <div style="font-size: var(--text-lg); font-weight: 600; color: var(--color-warning);">${formatCurrency(res.limitedExpensesDeducted)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            ${res.pendingRepairsForFutureYears > 0 ? `<span style="color:var(--color-error)">Excedent 4 anys: ${formatCurrency(res.pendingRepairsForFutureYears)}</span>` : 'Tot deduït aquest any'}
          </div>
        </div>
        <div style="background: var(--bg-surface); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--border-default);">
          <div style="font-size: var(--text-xs); color: var(--text-muted);">3. Despeses Corrents (IBI, Com...)</div>
          <div style="font-size: var(--text-lg); font-weight: 600;">${formatCurrency(res.totalCurrentExpenses)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Tributs, assegurança, gestoria</div>
        </div>
        <div style="background: var(--bg-surface); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--border-default);">
          <div style="font-size: var(--text-xs); color: var(--text-muted);">4. Amortitzacions Deduïdes AEAT</div>
          <div style="font-size: var(--text-lg); font-weight: 600; color: var(--color-info);">${formatCurrency(res.totalAmortization)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Construcció: ${formatCurrency(res.buildingAmortization)} | Inventari: ${formatCurrency(res.totalAmortization - res.buildingAmortization)}</div>
        </div>
      </div>

      <!-- Desglossament de Despeses d'Explotació Imputables (IBI, Brosses, Taxes, Assegurança, Comunitat) -->
      <div style="background: var(--bg-surface-elevated); padding: var(--space-md); border-radius: var(--radius-md); margin-bottom: var(--space-md); border: 1px solid var(--border-default);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--space-xs);">
          <strong style="font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-primary);">🧾 Despeses Imputables a l'Explotació (Art. 23.1 LIRPF):</strong>
          <span style="font-size:0.75rem; color:var(--text-muted);">Total Corrents + Limitades: <strong>${formatCurrency(res.totalCurrentExpenses + res.limitedExpensesDeducted)}</strong></span>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space-xs); font-size: var(--text-xs);">
          <div style="padding: 6px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-default);">
            <div style="color:var(--text-muted);">🏛️ IBI (Casella 0073)</div>
            <div style="font-weight:700; color:var(--text-primary);">${formatCurrency(res.ibiDeducted)}</div>
          </div>
          <div style="padding: 6px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-default);">
            <div style="color:var(--text-muted);">🗑️ Brosses / Residus</div>
            <div style="font-weight:700; color:var(--text-primary);">${formatCurrency(res.wasteTaxDeducted)}</div>
          </div>
          <div style="padding: 6px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-default);">
            <div style="color:var(--text-muted);">🧾 Taxes Locals</div>
            <div style="font-weight:700; color:var(--text-primary);">${formatCurrency(res.otherTaxesDeducted)}</div>
          </div>
          <div style="padding: 6px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-default);">
            <div style="color:var(--text-muted);">🛡️ Assegurança (C. 0075)</div>
            <div style="font-weight:700; color:var(--color-success);">${formatCurrency(res.insurance)}</div>
          </div>
          <div style="padding: 6px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-default);">
            <div style="color:var(--text-muted);">🏢 Comunitat (C. 0074)</div>
            <div style="font-weight:700;">${formatCurrency(res.communityFees)}</div>
          </div>
          <div style="padding: 6px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-default);">
            <div style="color:var(--text-muted);">🛠️ Reparacions (C. 0070)</div>
            <div style="font-weight:700; color:var(--color-warning);">${formatCurrency(res.repairExpenses)}</div>
          </div>
          <div style="padding: 6px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-default);">
            <div style="color:var(--text-muted);">🏦 Interessos (C. 0069)</div>
            <div style="font-weight:700; color:var(--color-warning);">${formatCurrency(res.mortgageInterests)}</div>
          </div>
        </div>
      </div>

      <!-- Desglossament d'Amortitzacions per Categories AEAT -->
      <div style="background: var(--bg-surface-elevated); padding: var(--space-md); border-radius: var(--radius-md); margin-bottom: var(--space-md); border: 1px solid var(--border-default);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--space-xs);">
          <strong style="font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">Desglossament d'Amortització per Grups AEAT:</strong>
          <button class="btn btn--ghost btn--sm" id="add-quick-inv-${p.id}" style="font-size:0.75rem; color:var(--color-primary); padding:2px 8px;">＋ Desglossar Factura</button>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--space-xs); font-size: var(--text-xs);">
          <div style="padding: 4px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-default);">
            <div style="color:var(--text-muted);">Útils / Eines (30%)</div>
            <div style="font-weight:700; color:var(--color-success);">${formatCurrency(b.group6Tools30)}</div>
          </div>
          <div style="padding: 4px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-default);">
            <div style="color:var(--text-muted);">TI / TV / Domòtica (26%)</div>
            <div style="font-weight:700; color:var(--color-success);">${formatCurrency(b.group5Computer26)}</div>
          </div>
          <div style="padding: 4px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-default);">
            <div style="color:var(--text-muted);">Transport (16%)</div>
            <div style="font-weight:700;">${formatCurrency(b.group4Transport16)}</div>
          </div>
          <div style="padding: 4px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-default);">
            <div style="color:var(--text-muted);">Maquinària/Clima (12%)</div>
            <div style="font-weight:700;">${formatCurrency(b.group3Machinery12)}</div>
          </div>
          <div style="padding: 4px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-default);">
            <div style="color:var(--text-muted);">Mobiliari/Electr. (10%)</div>
            <div style="font-weight:700;">${formatCurrency(b.group2Furniture10)}</div>
          </div>
          <div style="padding: 4px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-default);">
            <div style="color:var(--text-muted);">Obres Millora (3%)</div>
            <div style="font-weight:700;">${formatCurrency(res.improvementsAmortization)}</div>
          </div>
        </div>
      </div>

      <!-- Desglossament del Rendiment i Reducció -->
      <div style="background: var(--bg-surface); padding: var(--space-md); border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-md); border: 1px solid var(--border-default);">
        <div>
          <div><strong>Rendiment Net Previ:</strong> ${formatCurrency(res.netIncome)} (Casella 0090)</div>
          ${res.reductionRate > 0 ? `
            <div style="color: var(--color-success); font-size: var(--text-sm); margin-top: 4px;">
              <strong>Reducció aplicada (${res.reductionRate}%):</strong> -${formatCurrency(res.reductionAmount)} <br>
              <span style="color:var(--text-muted); font-size:0.75rem;">(${reductionLabels[p.reductionType]})</span>
            </div>
          ` : '<div style="color:var(--text-muted); font-size:0.75rem;">Sense reducció d\'habitatge habitual aplicable</div>'}
        </div>
        <div style="text-align: right;">
          <div style="font-size: var(--text-xs); color: var(--text-muted);">Rendiment Net Reduït (A Base General)</div>
          <div style="font-size: var(--text-xl); font-weight: 700; color: var(--color-success);">${formatCurrency(res.netReducedIncome)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Casella 0105 AEAT</div>
        </div>
      </div>
    </div>
  `;

  // Listeners
  card.querySelector(`#scan-exp-btn-${p.id}`)?.addEventListener('click', () => openExpenseScannerModal(p, page));
  card.querySelector(`#manage-contract-btn-${p.id}`)?.addEventListener('click', () => openContractModal(p, page));
  card.querySelector(`#manage-carryover-btn-${p.id}`)?.addEventListener('click', () => openCarryoverModal(p, page));
  card.querySelector(`#manage-inv-btn-${p.id}`)?.addEventListener('click', () => openInventoryModal(p, page));
  card.querySelector(`#add-quick-inv-${p.id}`)?.addEventListener('click', () => openInvoiceBreakdownModal(p, page));
  card.querySelector(`#edit-btn-${p.id}`)?.addEventListener('click', () => openPropertyModal(p, page));
  card.querySelector(`#delete-btn-${p.id}`)?.addEventListener('click', () => {
    if (confirm(`Segur que vols eliminar l'immoble "${p.name || p.address}"?`)) {
      const arr = (store.getData().properties || []).filter(item => item.id !== p.id);
      store.setSection('properties', arr);
      page.replaceWith(renderProperties());
      showToast('Immoble eliminat', 'success');
    }
  });

  return card;
}

/**
 * Modal Escàner & Categoritzador Intel·ligent de Despeses i Factures
 */
function openExpenseScannerModal(selectedProperty: RentalProperty | null, page: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.maxWidth = '900px';
  modal.style.maxHeight = '90vh';
  modal.style.overflowY = 'auto';

  const properties = store.getData().properties || [];
  let parsedItems: ParsedExpenseItem[] = [];

  modal.innerHTML = `
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:var(--space-xs);">
        <span style="font-size:1.5rem;">📥</span>
        <h2 class="modal-title">Escàner & Categoritzador Intel·ligent de Despeses</h2>
      </div>
      <button class="modal-close" id="modal-close-btn">&times;</button>
    </div>
    <div class="modal-body" style="display:flex; flex-direction:column; gap: var(--space-lg);">
      <p style="font-size:var(--text-sm); color:var(--text-muted); margin:0;">
        Enganxa extractes bancaris (CaixaBank, BBVA, Santander, etc.), llistats de factures o text lliure. El motor heurístic classificarà automàticament cada concepte en despesa corrent de l'IRPF (IBI, comunitat, reparacions, interessos) o en actiu d'inventari AEAT (3% a 30%).
      </p>

      <div style="display:grid; grid-template-columns: 2fr 1fr; gap:var(--space-md); align-items:flex-end;">
        <div>
          <label class="form-label">Immoble de destinació</label>
          <select class="form-input" id="scan-target-prop">
            ${properties.map(prop => `
              <option value="${prop.id}" ${selectedProperty && selectedProperty.id === prop.id ? 'selected' : ''}>
                ${prop.name || prop.address} (${prop.cadastralReference || 'Sense Ref'})
              </option>
            `).join('')}
          </select>
        </div>
        <div>
          <button class="btn btn--secondary" id="btn-load-sample-expenses" style="width:100%;">
            📝 Enganxar Exemple de Despeses
          </button>
        </div>
      </div>

      <div>
        <label class="form-label">Text de l'extracte o factures</label>
        <textarea class="form-input" id="scan-raw-text" rows="6" placeholder="Exemple:
15/01/2024 Rebut IBI Ajuntament 680,00 EUR
20/02/2024 Factura F-2024-88 Leroy Merlin Bomba de calor 2.200,00 €
01/03/2024 Quota Comunitat Propietaris 80,00 €
10/04/2024 MediaMarkt Smart TV 55 polzades 850,00 €
15/05/2024 Interessos Préstec Hipotecari CaixaBank 145,50 €
22/06/2024 Factura Lampista Reparació Fuita Cuina 230,00 €"></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button class="btn btn--primary" id="btn-run-parser">
          🔍 Analitzar i Categoritzar
        </button>
      </div>

      <!-- Taula de Resultats -->
      <div id="scan-results-container" style="display:none;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-xs);">
          <strong style="font-size:var(--text-sm);">Resultats Analitzats (<span id="scan-count">0</span> elements)</strong>
          <span style="font-size:var(--text-xs); color:var(--text-muted);">Total detectat: <strong id="scan-total" class="text-primary">0,00 €</strong></span>
        </div>
        <div style="max-height:260px; overflow-y:auto; border:1px solid var(--border-default); border-radius:var(--radius-md);">
          <table style="width:100%; border-collapse:collapse; font-size:var(--text-xs);">
            <thead>
              <tr style="background:var(--bg-surface-elevated); border-bottom:1px solid var(--border-default); text-align:left;">
                <th style="padding:6px 8px;">Data</th>
                <th style="padding:6px 8px;">Concepte</th>
                <th style="padding:6px 8px;">Import</th>
                <th style="padding:6px 8px;">Destinació AEAT</th>
                <th style="padding:6px 8px; text-align:center;">Tipus</th>
              </tr>
            </thead>
            <tbody id="scan-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="modal-footer" style="display:flex; justify-content:flex-end; gap: var(--space-md); padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--border-default);">
      <button class="btn btn--ghost" id="modal-cancel-btn">Tancar</button>
      <button class="btn btn--primary" id="modal-apply-btn" disabled>⚡ Aplicar i Distribuir a l'Immoble</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  modal.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#modal-cancel-btn')?.addEventListener('click', closeModal);

  const rawTextarea = modal.querySelector('#scan-raw-text') as HTMLTextAreaElement;
  const parseBtn = modal.querySelector('#btn-run-parser') as HTMLButtonElement;
  const applyBtn = modal.querySelector('#modal-apply-btn') as HTMLButtonElement;
  const resultsContainer = modal.querySelector('#scan-results-container') as HTMLElement;
  const tableBody = modal.querySelector('#scan-table-body') as HTMLElement;
  const sampleBtn = modal.querySelector('#btn-load-sample-expenses') as HTMLButtonElement;

  sampleBtn?.addEventListener('click', () => {
    rawTextarea.value = `15/01/2024 Rebut IBI Ajuntament 680,00 EUR
20/02/2024 Factura F-2024-88 Leroy Merlin Bomba de calor Aerotèrmia 2.200,00 €
01/03/2024 Quota Comunitat de Propietaris 80,00 €
10/04/2024 MediaMarkt Smart TV 55 polzades Samsung 850,00 €
15/05/2024 Interessos Préstec Hipotecari CaixaBank 145,50 €
22/06/2024 Factura FRA-99 Lampista Reparació Fuita Aigua 230,00 €
10/07/2024 Assegurança Llar Mapfre 280,00 €
18/08/2024 Ikea Sofà i Llits Dormitori 1.450,00 €`;
    parseBtn.click();
  });

  parseBtn?.addEventListener('click', () => {
    const text = rawTextarea.value.trim();
    if (!text) {
      showToast('Introdueix almenys una línia de despesa', 'warning');
      return;
    }

    parsedItems = parsePropertyExpenses(text);
    if (parsedItems.length === 0) {
      showToast('No s\'ha pogut identificar cap import monetari en el text', 'warning');
      return;
    }

    const total = parsedItems.reduce((s, it) => s + it.amount, 0);
    modal.querySelector('#scan-count')!.textContent = String(parsedItems.length);
    modal.querySelector('#scan-total')!.textContent = formatCurrency(total);

    tableBody.innerHTML = parsedItems.map(item => `
      <tr style="border-bottom:1px solid var(--border-default);">
        <td style="padding:6px 8px; color:var(--text-muted);">${item.date}</td>
        <td style="padding:6px 8px; font-weight:600;">${item.concept}</td>
        <td style="padding:6px 8px; font-weight:700; color:var(--color-primary);">${formatCurrency(item.amount)}</td>
        <td style="padding:6px 8px;">
          ${item.type === 'inventory' 
            ? `<span class="badge badge--success">${item.notes || 'Inventari'}</span>` 
            : `<span class="badge badge--neutral">${item.notes || item.operatingTarget}</span>`}
        </td>
        <td style="padding:6px 8px; text-align:center;">
          ${item.type === 'inventory' ? '📦 Actiu' : '🧾 Despesa'}
        </td>
      </tr>
    `).join('');

    resultsContainer.style.display = 'block';
    applyBtn.disabled = false;
    showToast(`S'han identificat ${parsedItems.length} conceptes correctament`, 'success');
  });

  applyBtn?.addEventListener('click', () => {
    const targetPropId = (modal.querySelector('#scan-target-prop') as HTMLSelectElement).value;
    const targetProp = properties.find(p => p.id === targetPropId);
    if (!targetProp) {
      showToast('Selecciona un immoble vàlid', 'warning');
      return;
    }

    const res = applyParsedExpensesToProperty(targetProp, parsedItems, store.getData().year || 2024);
    const updatedProperties = properties.map(p => p.id === res.updatedProperty.id ? res.updatedProperty : p);
    store.setSection('properties', updatedProperties);

    closeModal();
    page.replaceWith(renderProperties());
    showToast(`✅ Aplicades ${res.operatingExpensesAdded} despeses operatives i ${res.inventoryItemsAdded} actius a l'inventari (${formatCurrency(res.totalAmountApplied)})`, 'success');
  });
}

/**
 * Modal de Gestió de Contractes i Actualització de Renda (IPC / IRAV / Llei 12/2023)
 */
function openContractModal(property: RentalProperty, page: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.maxWidth = '700px';

  const currentMonthlyRent = property.monthlyRent || (property.grossRentalIncome ? Math.round(property.grossRentalIncome / 12) : 900);
  const adj = calculateRentAdjustment(currentMonthlyRent, 'ipc', 3.0, store.getData().year || 2024);

  modal.innerHTML = `
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:var(--space-xs);">
        <span style="font-size:1.5rem;">📜</span>
        <h2 class="modal-title">Gestió de Contracte & Actualització Legal de Renda</h2>
      </div>
      <button class="modal-close" id="modal-close-btn">&times;</button>
    </div>
    <div class="modal-body" style="display:flex; flex-direction:column; gap: var(--space-lg);">
      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
        <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Immoble</div>
        <div style="font-size:var(--text-lg); font-weight:700;">${property.name || property.address}</div>
        <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:2px;">
          Llogaters: ${(property.tenantNIFs || []).join(', ') || 'No especificats'} | Ref: ${property.cadastralReference || 'Pendent'}
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:var(--space-md);">
        <div>
          <label class="form-label">Renda mensual vigent (€/mes)</label>
          <input type="number" step="0.01" class="form-input" id="contract-current-rent" value="${currentMonthlyRent}">
        </div>
        <div>
          <label class="form-label">Data formalització contracte</label>
          <input type="date" class="form-input" id="contract-start-date" value="${property.contractStartDate || property.contractDate || '2023-01-01'}">
        </div>
      </div>

      <!-- Calculadora d'Indexació Legal -->
      <fieldset style="border:1px solid var(--border-default); border-radius:var(--radius-md); padding:var(--space-md); background:var(--bg-surface);">
        <legend style="font-weight:600; padding:0 var(--space-xs); color:var(--color-primary);">
          📈 Calculadora d'Increment Legal (Llei 12/2023 / RDL 6/2022)
        </legend>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:var(--space-md); margin-bottom:var(--space-md);">
          <div>
            <label class="form-label">Tipus d'índex aplicable</label>
            <select class="form-input" id="contract-index-type">
              <option value="ipc">IPC (Límit legal màxim 3,0% - any 2024)</option>
              <option value="irav">Índex de Referència IRAV (2,5%)</option>
              <option value="custom">Personalitzat</option>
            </select>
          </div>
          <div>
            <label class="form-label">% d'increment aplicat</label>
            <input type="number" step="0.1" class="form-input" id="contract-rate-input" value="${adj.appliedRate}">
          </div>
        </div>

        <!-- Resultat de la simulació -->
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:var(--space-sm); text-align:center; padding:var(--space-sm); background:var(--bg-surface-elevated); border-radius:var(--radius-md); border:1px solid var(--border-default); font-size:var(--text-xs);">
          <div>
            <div style="color:var(--text-muted);">Nova Renda Mensual</div>
            <div style="font-size:var(--text-lg); font-weight:800; color:var(--color-success);" id="res-new-rent">${formatCurrency(adj.newMonthlyRent)}/mes</div>
          </div>
          <div>
            <div style="color:var(--text-muted);">Increment Mensual</div>
            <div style="font-size:var(--text-lg); font-weight:700; color:var(--color-primary);" id="res-diff-rent">+${formatCurrency(adj.monthlyIncrease)}</div>
          </div>
          <div>
            <div style="color:var(--text-muted);">Ingressos Anuals Nous</div>
            <div style="font-size:var(--text-lg); font-weight:700;" id="res-annual-rent">${formatCurrency(adj.newMonthlyRent * 12)}</div>
          </div>
        </div>

        <p style="font-size:0.75rem; color:var(--text-muted); margin:var(--space-sm) 0 0 0;" id="contract-legal-rec">
          ${adj.legalRecommendation}
        </p>
      </fieldset>
    </div>
    <div class="modal-footer" style="display:flex; justify-content:flex-end; gap: var(--space-md); padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--border-default);">
      <button class="btn btn--ghost" id="modal-cancel-btn">Cancel·lar</button>
      <button class="btn btn--primary" id="modal-save-contract-btn">💾 Actualitzar Renda i Ingressos</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  modal.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#modal-cancel-btn')?.addEventListener('click', closeModal);

  const rentInput = modal.querySelector('#contract-current-rent') as HTMLInputElement;
  const indexTypeSelect = modal.querySelector('#contract-index-type') as HTMLSelectElement;
  const rateInput = modal.querySelector('#contract-rate-input') as HTMLInputElement;
  const resNewRent = modal.querySelector('#res-new-rent') as HTMLElement;
  const resDiffRent = modal.querySelector('#res-diff-rent') as HTMLElement;
  const resAnnualRent = modal.querySelector('#res-annual-rent') as HTMLElement;

  function updateSimulation() {
    const curRent = parseFloat(rentInput.value) || 0;
    const type = (indexTypeSelect.value as 'ipc' | 'irav' | 'custom') || 'ipc';
    const customRate = parseFloat(rateInput.value) || 0;
    const result = calculateRentAdjustment(curRent, type, customRate, store.getData().year || 2024);

    resNewRent.textContent = `${formatCurrency(result.newMonthlyRent)}/mes`;
    resDiffRent.textContent = `+${formatCurrency(result.monthlyIncrease)}`;
    resAnnualRent.textContent = formatCurrency(result.newMonthlyRent * 12);
  }

  rentInput.addEventListener('input', updateSimulation);
  indexTypeSelect.addEventListener('change', () => {
    if (indexTypeSelect.value === 'ipc') rateInput.value = '3.0';
    if (indexTypeSelect.value === 'irav') rateInput.value = '2.5';
    updateSimulation();
  });
  rateInput.addEventListener('input', updateSimulation);

  modal.querySelector('#modal-save-contract-btn')?.addEventListener('click', () => {
    const curRent = parseFloat(rentInput.value) || 0;
    const customRate = parseFloat(rateInput.value) || 0;
    const result = calculateRentAdjustment(curRent, (indexTypeSelect.value as 'ipc' | 'irav' | 'custom') || 'ipc', customRate, store.getData().year || 2024);

    property.monthlyRent = result.newMonthlyRent;
    property.grossRentalIncome = Math.round(result.newMonthlyRent * 12);
    property.contractStartDate = (modal.querySelector('#contract-start-date') as HTMLInputElement).value;
    property.appliedIpcRate = result.appliedRate;
    property.lastIpcUpdate = new Date().toISOString().split('T')[0];

    saveProperty(property);
    closeModal();
    page.replaceWith(renderProperties());
    showToast(`Renda actualitzada a ${formatCurrency(result.newMonthlyRent)}/mes (+${formatCurrency(result.annualExtraGrossIncome)}/any)`, 'success');
  });
}

/**
 * Modal de Control i Optimització de l'Excedent a 4 Anys (Art. 23.1.a LIRPF)
 */
function openCarryoverModal(property: RentalProperty, page: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.maxWidth = '750px';

  const plan = calculateFourYearCarryoverPlan(property, store.getData().year || 2024);

  modal.innerHTML = `
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:var(--space-xs);">
        <span style="font-size:1.5rem;">⏱️</span>
        <h2 class="modal-title">Compensació de Despeses a 4 Anys (Art. 23.1.a LIRPF)</h2>
      </div>
      <button class="modal-close" id="modal-close-btn">&times;</button>
    </div>
    <div class="modal-body" style="display:flex; flex-direction:column; gap: var(--space-lg);">
      <p style="font-size:var(--text-sm); color:var(--text-muted); margin:0;">
        La llei de l'IRPF estableix que la suma dels interessos hipotecaris i les despeses de reparació no pot superar els ingressos íntegres de l'immoble. L'excés es pot compensar en els <strong>4 exercicis següents</strong> seguint l'ordre d'antiguitat.
      </p>

      <!-- Targetes d'anàlisi de l'exercici actual -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:var(--space-sm);">
        <div style="background:var(--bg-surface-elevated); padding:var(--space-sm); border-radius:var(--radius-md); border:1px solid var(--border-default);">
          <div style="font-size:0.7rem; color:var(--text-muted);">Ingressos Íntegres Any</div>
          <div style="font-size:var(--text-lg); font-weight:700; color:var(--color-primary);">${formatCurrency(plan.currentYearGrossIncome)}</div>
        </div>
        <div style="background:var(--bg-surface-elevated); padding:var(--space-sm); border-radius:var(--radius-md); border:1px solid var(--border-default);">
          <div style="font-size:0.7rem; color:var(--text-muted);">Reparació + Interessos</div>
          <div style="font-size:var(--text-lg); font-weight:700; color:var(--color-warning);">${formatCurrency(plan.currentYearRepairMortgage)}</div>
        </div>
        <div style="background:var(--bg-surface-elevated); padding:var(--space-sm); border-radius:var(--radius-md); border:1px solid var(--border-default);">
          <div style="font-size:0.7rem; color:var(--text-muted);">Absorbit Aquest Any</div>
          <div style="font-size:var(--text-lg); font-weight:700; color:var(--color-success);">${formatCurrency(plan.absorbedThisYear)}</div>
        </div>
        <div style="background:var(--bg-surface-elevated); padding:var(--space-sm); border-radius:var(--radius-md); border:1px solid var(--border-default);">
          <div style="font-size:0.7rem; color:var(--text-muted);">Excedent Propers 4 Anys</div>
          <div style="font-size:var(--text-lg); font-weight:700; color:var(--color-info);">${formatCurrency(plan.remainingCarryoverForNextYears)}</div>
        </div>
      </div>

      <!-- Desglossament dels 4 anys anteriors -->
      <fieldset style="border:1px solid var(--border-default); border-radius:var(--radius-md); padding:var(--space-md);">
        <legend style="font-weight:600; padding:0 var(--space-xs);">Excedents Pendents dels 4 Exercicis Previs</legend>
        
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:var(--space-sm);">
          <div>
            <label class="form-label" style="font-size:0.75rem;">Exercici N-4 (2020)</label>
            <input type="number" step="0.01" class="form-input" id="co-n4" value="${property.carryoverHistory?.yearMinus4 || 0}">
            <div style="font-size:0.65rem; color:${plan.expiringCarryoverLost > 0 ? 'var(--color-error)' : 'var(--text-muted)'}; margin-top:2px;">
              ${plan.expiringCarryoverLost > 0 ? `⚠️ Caduca: ${formatCurrency(plan.expiringCarryoverLost)}` : 'Deduït al 100%'}
            </div>
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">Exercici N-3 (2021)</label>
            <input type="number" step="0.01" class="form-input" id="co-n3" value="${property.carryoverHistory?.yearMinus3 || 0}">
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">Exercici N-2 (2022)</label>
            <input type="number" step="0.01" class="form-input" id="co-n2" value="${property.carryoverHistory?.yearMinus2 || 0}">
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">Exercici N-1 (2023)</label>
            <input type="number" step="0.01" class="form-input" id="co-n1" value="${property.carryoverHistory?.yearMinus1 || 0}">
          </div>
        </div>
      </fieldset>

      <div style="background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:700; font-size:var(--text-sm);">🛡️ Valor de l'Escut Fiscal Disponible:</div>
          <div style="font-size:var(--text-xs); color:var(--text-muted);">Estalvi fiscal futur estimat al tipus marginal del 35%</div>
        </div>
        <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-success);">
          +${formatCurrency(plan.projectedTaxShieldEUR)}
        </div>
      </div>
    </div>
    <div class="modal-footer" style="display:flex; justify-content:flex-end; gap: var(--space-md); padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--border-default);">
      <button class="btn btn--ghost" id="modal-cancel-btn">Tancar</button>
      <button class="btn btn--primary" id="modal-save-carryover-btn">💾 Guardar Historial 4 Anys</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  modal.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#modal-cancel-btn')?.addEventListener('click', closeModal);

  modal.querySelector('#modal-save-carryover-btn')?.addEventListener('click', () => {
    property.carryoverHistory = {
      yearMinus4: parseFloat((modal.querySelector('#co-n4') as HTMLInputElement).value) || 0,
      yearMinus3: parseFloat((modal.querySelector('#co-n3') as HTMLInputElement).value) || 0,
      yearMinus2: parseFloat((modal.querySelector('#co-n2') as HTMLInputElement).value) || 0,
      yearMinus1: parseFloat((modal.querySelector('#co-n1') as HTMLInputElement).value) || 0,
    };
    property.pendingRepairsPreviousYears = 
      property.carryoverHistory.yearMinus4 + 
      property.carryoverHistory.yearMinus3 + 
      property.carryoverHistory.yearMinus2 + 
      property.carryoverHistory.yearMinus1;

    saveProperty(property);
    closeModal();
    page.replaceWith(renderProperties());
    showToast('Historial d\'excedents a 4 anys desat correctament', 'success');
  });
}

/**
 * Modal de Presets d'Immobles
 */
function openPresetsModal(page: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.maxWidth = '800px';

  const presets = getRealEstatePortfolioPresets();

  modal.innerHTML = `
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:var(--space-xs);">
        <span style="font-size:1.5rem;">🎯</span>
        <h2 class="modal-title">Presets d'Immobles Configurats (Demostració)</h2>
      </div>
      <button class="modal-close" id="modal-close-btn">&times;</button>
    </div>
    <div class="modal-body" style="display:flex; flex-direction:column; gap: var(--space-md);">
      <p style="font-size:var(--text-sm); color:var(--text-muted); margin:0;">
        Selecciona un dels models d'immoble pre-configurats per carregar dades reals amb totes les caselles d'IRPF, inventari AEAT i rendibilitats calculades:
      </p>

      <div style="display:flex; flex-direction:column; gap:var(--space-sm);">
        ${presets.map((preset, idx) => `
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
            <div style="max-width:550px;">
              <div style="font-weight:700; font-size:var(--text-md);">${preset.name}</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:2px;">${preset.description}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
                Ingressos: <strong>${formatCurrency(preset.property.grossRentalIncome)}</strong> | Adquisició: <strong>${formatCurrency(preset.property.acquisitionCost)}</strong> | Actius inventari: <strong>${preset.property.inventory.length}</strong>
              </div>
            </div>
            <button class="btn btn--primary btn--sm" id="btn-load-preset-${idx}">
              📥 Carregar Aquest
            </button>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center; padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--border-default);">
      <button class="btn btn--secondary" id="btn-load-all-presets">🌟 Carregar Cartera Completa (4 Immobles)</button>
      <button class="btn btn--ghost" id="modal-cancel-btn">Tancar</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  modal.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#modal-cancel-btn')?.addEventListener('click', closeModal);

  presets.forEach((preset, idx) => {
    modal.querySelector(`#btn-load-preset-${idx}`)?.addEventListener('click', () => {
      const current = [...(store.getData().properties || [])];
      const newProp = JSON.parse(JSON.stringify(preset.property));
      newProp.id = crypto.randomUUID();
      current.push(newProp);
      store.setSection('properties', current);
      closeModal();
      page.replaceWith(renderProperties());
      showToast(`Immoble "${preset.name}" carregat amb èxit`, 'success');
    });
  });

  modal.querySelector('#btn-load-all-presets')?.addEventListener('click', () => {
    const all = presets.map(p => {
      const clone = JSON.parse(JSON.stringify(p.property));
      clone.id = crypto.randomUUID();
      return clone;
    });
    store.setSection('properties', all);
    closeModal();
    page.replaceWith(renderProperties());
    showToast('S\'ha carregat la cartera completa amb els 4 immobles', 'success');
  });
}

/**
 * Modal d'Alta / Edició d'Immoble amb Consulta al Cadastre i Control de 4 anys
 */
function openPropertyModal(existingProperty: RentalProperty | null, page: HTMLElement): void {
  const isEdit = !!existingProperty;
  const p: RentalProperty = existingProperty ? JSON.parse(JSON.stringify(existingProperty)) : {
    id: crypto.randomUUID(),
    name: '',
    cadastralReference: '',
    address: '',
    ownershipPercentage: 100,
    usageType: 'habitual',
    contractDate: new Date().toISOString().split('T')[0],
    tenantNIFs: [],
    monthlyRent: 0,
    grossRentalIncome: 0,
    otherIncomes: 0,
    mortgageInterests: 0,
    repairExpenses: 0,
    pendingRepairsPreviousYears: 0,
    ibi: 0,
    wasteTax: 0,
    communityFees: 0,
    insurance: 0,
    managementFees: 0,
    badDebts: 0,
    totalCadastralValue: 0,
    constructionCadastralValue: 0,
    acquisitionCost: 0,
    inventory: [],
    improvements: [],
    furniture: [],
    reductionType: 'general_50',
  };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.maxWidth = '850px';
  modal.style.maxHeight = '90vh';
  modal.style.overflowY = 'auto';

  modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${isEdit ? '✏️ Editar Immoble en Lloguer' : '🏠 Donar d\'Alta Nou Immoble en Lloguer'}</h2>
      <button class="modal-close" id="modal-close-btn">&times;</button>
    </div>
    <div class="modal-body" style="display:flex; flex-direction:column; gap: var(--space-lg);">
      
      <!-- 1. Dades Generals i Consulta al Cadastre -->
      <fieldset style="border:1px solid var(--border-default); border-radius:var(--radius-md); padding:var(--space-md);">
        <legend style="font-weight:600; padding:0 var(--space-xs);">1. Identificació de l'Immoble (AEAT Caselles 0060-0065)</legend>
        <div style="display:grid; grid-template-columns: 2fr 1fr; gap: var(--space-md); margin-bottom: var(--space-sm);">
          <div>
            <label class="form-label">Nom identificatiu / Àlies</label>
            <input type="text" class="form-input" id="prop-name" value="${p.name}" placeholder="Ex: Pis Carrer Aragó 123">
          </div>
          <div>
            <label class="form-label">% Titularitat</label>
            <input type="number" class="form-input" id="prop-own" value="${p.ownershipPercentage}" min="1" max="100">
          </div>
        </div>
        <div style="display:grid; grid-template-columns: 2fr 1fr; gap: var(--space-md); margin-bottom: var(--space-sm); align-items:flex-end;">
          <div>
            <label class="form-label">Referència Cadastral (20 caràcters)</label>
            <input type="text" class="form-input" id="prop-cadastre" value="${p.cadastralReference}" placeholder="Ex: 9872023VH5797S0001WX" maxlength="20">
          </div>
          <div>
            <button type="button" class="btn btn--secondary" id="btn-lookup-cadastre" style="width:100%;">
              🔍 Consultar Cadastre
            </button>
          </div>
        </div>
        <div style="margin-bottom: var(--space-sm);">
          <label class="form-label">Adreça completa</label>
          <input type="text" class="form-input" id="prop-address" value="${p.address}" placeholder="Ex: C/ Aragó 123, 2n 1a, Barcelona">
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
          <div>
            <label class="form-label">Tipus d'Arrendament</label>
            <select class="form-input" id="prop-usage">
              <option value="habitual" ${p.usageType === 'habitual' ? 'selected' : ''}>🏠 Habitatge habitual (amb dret a reducció)</option>
              <option value="temporary" ${p.usageType === 'temporary' ? 'selected' : ''}>⏳ Temporal / Estudiants</option>
              <option value="tourist" ${p.usageType === 'tourist' ? 'selected' : ''}>🏖️ Turístic</option>
              <option value="commercial" ${p.usageType === 'commercial' ? 'selected' : ''}>🏢 Local comercial / Altres</option>
            </select>
          </div>
          <div>
            <label class="form-label">NIF/NIE Arrendataris (separats per coma)</label>
            <input type="text" class="form-input" id="prop-tenants" value="${(p.tenantNIFs || []).join(', ')}" placeholder="Ex: 12345678Z, 87654321A">
          </div>
        </div>

        <!-- Ús Mixt (Art. 85 LIRPF) -->
        <div style="margin-top:var(--space-sm); padding-top:var(--space-sm); border-top:1px dashed var(--border-default);">
          <label style="display:flex; align-items:center; gap:var(--space-xs); font-size:var(--text-sm); cursor:pointer;">
            <input type="checkbox" id="prop-is-mixed" ${p.isMixedUsage ? 'checked' : ''}>
            <span><strong>Immoble d'Ús Mixt</strong> (llogat una part de l'any i a disposició particular la resta)</span>
          </label>
          <div id="prop-mixed-box" style="display:${p.isMixedUsage ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr 1fr; gap:var(--space-md); margin-top:var(--space-sm);">
            <div>
              <label class="form-label">Dies llogat l'any</label>
              <input type="number" class="form-input" id="prop-rental-days" value="${p.rentalDays ?? 60}">
            </div>
            <div>
              <label class="form-label">Dies a disposició pròpia</label>
              <input type="number" class="form-input" id="prop-own-days" value="${p.ownUseDays ?? 305}">
            </div>
            <div>
              <label class="form-label">Cadastre revisat (últims 10 anys)</label>
              <select class="form-input" id="prop-cad-revised">
                <option value="yes" ${p.isCadastralRevised ? 'selected' : ''}>Sí (Imputació 1,1%)</option>
                <option value="no" ${!p.isCadastralRevised ? 'selected' : ''}>No (Imputació 2,0%)</option>
              </select>
            </div>
          </div>
        </div>
      </fieldset>

      <!-- 2. Ingressos i Reducció Habitatge -->
      <fieldset style="border:1px solid var(--border-default); border-radius:var(--radius-md); padding:var(--space-md);">
        <legend style="font-weight:600; padding:0 var(--space-xs);">2. Ingressos i Bonificacions (Llei 12/2023 pel Dret a l'Habitatge)</legend>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); margin-bottom: var(--space-sm);">
          <div>
            <label class="form-label">Lloguers bruts facturats l'any (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-gross" value="${p.grossRentalIncome}">
          </div>
          <div>
            <label class="form-label">Altres ingressos / serveis repercutits (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-other-inc" value="${p.otherIncomes}">
          </div>
        </div>
        <div>
          <label class="form-label">Règim de Reducció d'Habitatge Habitual</label>
          <select class="form-input" id="prop-reduction">
            <option value="general_50" ${p.reductionType === 'general_50' ? 'selected' : ''}>50% - Règim general nou contracte (Llei 12/2023)</option>
            <option value="transitional_60" ${p.reductionType === 'transitional_60' ? 'selected' : ''}>60% - Contractes d'arrendament anteriors al 26/05/2023</option>
            <option value="rehabilitated_60" ${p.reductionType === 'rehabilitated_60' ? 'selected' : ''}>60% - Habitatge rehabilitat en els darrers 2 anys</option>
            <option value="young_tenant_70" ${p.reductionType === 'young_tenant_70' ? 'selected' : ''}>70% - Llogaters joves (18-35 anys) en zona de mercat tensionat</option>
            <option value="public_or_social_70" ${p.reductionType === 'public_or_social_70' ? 'selected' : ''}>70% - Arrendament a l'Administració Pública / Social</option>
            <option value="tensioned_rent_cut_90" ${p.reductionType === 'tensioned_rent_cut_90' ? 'selected' : ''}>90% - Rebaixa >= 5% de renda en zona tensionada</option>
            <option value="none" ${p.reductionType === 'none' ? 'selected' : ''}>Sense reducció (Ús diferent d'habitatge / Turístic)</option>
          </select>
        </div>
      </fieldset>

      <!-- 3. Despeses Limitades (Finançament + Reparació) -->
      <fieldset style="border:1px solid var(--border-default); border-radius:var(--radius-md); padding:var(--space-md);">
        <legend style="font-weight:600; padding:0 var(--space-xs);">3. Despeses Limitades a Ingressos (Art. 23.1.a LIRPF)</legend>
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-md);">
          <div>
            <label class="form-label">Interessos Hipoteca (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-mortgage" value="${p.mortgageInterests}">
          </div>
          <div>
            <label class="form-label">Reparació i Conservació (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-repairs" value="${p.repairExpenses}">
          </div>
          <div>
            <label class="form-label">Pendent 4 anys previs (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-pending-repairs" value="${p.pendingRepairsPreviousYears}">
          </div>
        </div>
      </fieldset>

      <!-- 4. Despeses Imputables a l'Explotació (Tributs, Assegurança, Comunitat...) -->
      <fieldset style="border:1px solid var(--border-default); border-radius:var(--radius-md); padding:var(--space-md); background:var(--bg-surface-elevated);">
        <legend style="font-weight:600; padding:0 var(--space-xs); color:var(--color-primary);">4. Despeses Imputables a l'Explotació (Tributs, Assegurança & Corrents - Art. 23.1.b LIRPF)</legend>
        
        <div style="font-size:var(--text-xs); color:var(--text-muted); margin-bottom:var(--space-sm);">
          Despeses corrents deduïbles íntegrament dels ingressos del lloguer (prorratejades segons titularitat i dies arrendats):
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-sm);">
          <div>
            <label class="form-label" style="font-size:0.75rem;">🏛️ IBI - Impost Béns Immobles (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-ibi" value="${p.ibi || 0}" placeholder="Casella 0073">
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">🗑️ Taxa d'Escombraries / Brosses (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-waste" value="${p.wasteTax || 0}" placeholder="Casella 0073">
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">🧾 Altres Taxes Municipals / Tributs (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-other-taxes" value="${p.otherTaxes || 0}" placeholder="Gual, clavegueram...">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-md);">
          <div>
            <label class="form-label" style="font-size:0.75rem;">🛡️ Assegurança Llar / RC / Impagament (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-insurance" value="${p.insurance || 0}" placeholder="Casella 0075">
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">🏢 Comunitat de Propietaris (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-community" value="${p.communityFees || 0}" placeholder="Casella 0074">
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">📑 Gestoria / Administració (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-management" value="${p.managementFees || 0}" placeholder="Casella 0076">
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">⚠️ Dubtós Cobrament > 6m (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-debts" value="${p.badDebts || 0}" placeholder="Casella 0077">
          </div>
        </div>
      </fieldset>

      <!-- 5. Amortització de l'Immoble -->
      <fieldset style="border:1px solid var(--border-default); border-radius:var(--radius-md); padding:var(--space-md);">
        <legend style="font-weight:600; padding:0 var(--space-xs);">5. Amortització de l'Immoble (Construcció 3%)</legend>
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-md);">
          <div>
            <label class="form-label">Cost Adquisició (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-acq-cost" value="${p.acquisitionCost}" placeholder="Compra + ITP + notaria">
          </div>
          <div>
            <label class="form-label">Valor Cadastral Total (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-cad-total" value="${p.totalCadastralValue}">
          </div>
          <div>
            <label class="form-label">Valor Cadastral Construcció (€)</label>
            <input type="number" step="0.01" class="form-input" id="prop-cad-const" value="${p.constructionCadastralValue}">
          </div>
        </div>
      </fieldset>

    </div>
    <div class="modal-footer" style="display:flex; justify-content:flex-end; gap: var(--space-md); padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--border-default);">
      <button class="btn btn--ghost" id="modal-cancel-btn">Cancel·lar</button>
      <button class="btn btn--primary" id="modal-save-btn">💾 Guardar Immoble</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  modal.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#modal-cancel-btn')?.addEventListener('click', closeModal);

  // Consulta al Cadastre
  modal.querySelector('#btn-lookup-cadastre')?.addEventListener('click', async () => {
    const cadInput = modal.querySelector('#prop-cadastre') as HTMLInputElement;
    const ref = cadInput.value.trim();
    if (!ref) {
      showToast('Introdueix una referència cadastral de 20 caràcters', 'warning');
      return;
    }
    const btn = modal.querySelector('#btn-lookup-cadastre') as HTMLButtonElement;
    btn.textContent = '⏳ Consultant...';
    btn.disabled = true;

    try {
      const res = await lookupCadastreReference(ref);
      if (res.isValid) {
        if (res.address) {
          (modal.querySelector('#prop-address') as HTMLInputElement).value = res.address;
        }
        if (!(modal.querySelector('#prop-name') as HTMLInputElement).value) {
          (modal.querySelector('#prop-name') as HTMLInputElement).value = res.address || `Immoble ${ref.substring(0, 7)}`;
        }
        showToast('Dades cadastrals validades amb èxit', 'success');
      } else {
        showToast(res.error || 'Referència cadastral no vàlida', 'error');
      }
    } catch {
      showToast('Error en consultar la Seu del Cadastre', 'error');
    } finally {
      btn.textContent = '🔍 Consultar Cadastre';
      btn.disabled = false;
    }
  });

  // Ús mixt toggle
  const mixedCheck = modal.querySelector('#prop-is-mixed') as HTMLInputElement;
  const mixedBox = modal.querySelector('#prop-mixed-box') as HTMLElement;
  mixedCheck?.addEventListener('change', () => {
    if (mixedBox) mixedBox.style.display = mixedCheck.checked ? 'grid' : 'none';
  });

  // Guardar dades
  modal.querySelector('#modal-save-btn')?.addEventListener('click', () => {
    p.name = (modal.querySelector('#prop-name') as HTMLInputElement).value.trim() || 'Immoble';
    p.ownershipPercentage = parseFloat((modal.querySelector('#prop-own') as HTMLInputElement).value) || 100;
    p.cadastralReference = (modal.querySelector('#prop-cadastre') as HTMLInputElement).value.trim();
    p.address = (modal.querySelector('#prop-address') as HTMLInputElement).value.trim();
    p.usageType = (modal.querySelector('#prop-usage') as HTMLSelectElement).value as RentalProperty['usageType'];
    p.tenantNIFs = (modal.querySelector('#prop-tenants') as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean);
    
    p.isMixedUsage = (modal.querySelector('#prop-is-mixed') as HTMLInputElement)?.checked || false;
    p.rentalDays = parseFloat((modal.querySelector('#prop-rental-days') as HTMLInputElement)?.value) || 0;
    p.ownUseDays = parseFloat((modal.querySelector('#prop-own-days') as HTMLInputElement)?.value) || 0;
    p.isCadastralRevised = (modal.querySelector('#prop-cad-revised') as HTMLSelectElement)?.value === 'yes';

    p.grossRentalIncome = parseFloat((modal.querySelector('#prop-gross') as HTMLInputElement).value) || 0;
    p.otherIncomes = parseFloat((modal.querySelector('#prop-other-inc') as HTMLInputElement).value) || 0;
    p.reductionType = (modal.querySelector('#prop-reduction') as HTMLSelectElement).value as RentalProperty['reductionType'];

    p.mortgageInterests = parseFloat((modal.querySelector('#prop-mortgage') as HTMLInputElement).value) || 0;
    p.repairExpenses = parseFloat((modal.querySelector('#prop-repairs') as HTMLInputElement).value) || 0;
    p.pendingRepairsPreviousYears = parseFloat((modal.querySelector('#prop-pending-repairs') as HTMLInputElement).value) || 0;

    p.ibi = parseFloat((modal.querySelector('#prop-ibi') as HTMLInputElement).value) || 0;
    p.wasteTax = parseFloat((modal.querySelector('#prop-waste') as HTMLInputElement).value) || 0;
    p.otherTaxes = parseFloat((modal.querySelector('#prop-other-taxes') as HTMLInputElement)?.value) || 0;
    p.communityFees = parseFloat((modal.querySelector('#prop-community') as HTMLInputElement).value) || 0;
    p.insurance = parseFloat((modal.querySelector('#prop-insurance') as HTMLInputElement).value) || 0;
    p.managementFees = parseFloat((modal.querySelector('#prop-management') as HTMLInputElement).value) || 0;
    p.badDebts = parseFloat((modal.querySelector('#prop-debts') as HTMLInputElement).value) || 0;

    p.acquisitionCost = parseFloat((modal.querySelector('#prop-acq-cost') as HTMLInputElement).value) || 0;
    p.totalCadastralValue = parseFloat((modal.querySelector('#prop-cad-total') as HTMLInputElement).value) || 0;
    p.constructionCadastralValue = parseFloat((modal.querySelector('#prop-cad-const') as HTMLInputElement).value) || 0;

    // Actualitzar store
    const currentProps = [...(store.getData().properties || [])];
    if (isEdit) {
      const editIdx = currentProps.findIndex(item => item.id === p.id);
      if (editIdx !== -1) currentProps[editIdx] = p;
    } else {
      currentProps.push(p);
    }

    store.setSection('properties', currentProps);
    closeModal();
    page.replaceWith(renderProperties());
    showToast(isEdit ? 'Immoble actualitzat' : 'Immoble donat d\'alta correctament', 'success');
  });
}

/**
 * Modal complet d'Inventari / Extracontable d'Actius i Factures de l'Immoble
 */
function openInventoryModal(p: RentalProperty, page: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.maxWidth = '1050px';
  modal.style.maxHeight = '92vh';
  modal.style.overflowY = 'auto';

  const data = store.getData();
  const fiscalYear = data.year || 2024;
  p.inventory = p.inventory || [];

  function renderModalContent() {
    let totalCost = 0;
    let totalAnnualAmort = 0;
    let totalPending = 0;
    let totalActiveCount = 0;
    let totalDisposedCount = 0;

    p.inventory.forEach(item => {
      const calc = calculateItemAnnualAmortization(
        item.amount,
        item.amortizationRate,
        item.previousAmortization,
        fiscalYear,
        item.acquisitionDate,
        item.disposalDate,
        item.status
      );

      totalCost += item.amount;
      totalAnnualAmort += calc.annualAmount;
      totalPending += calc.pendingValue;
      if (item.status === 'disposed') totalDisposedCount++;
      else totalActiveCount++;
    });

    modal.innerHTML = `
      <div class="modal-header">
        <div>
          <h2 class="modal-title">📦 Extracontable d'Actius i Factures (${p.name || p.address})</h2>
          <div style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 4px;">
            Taula Simplificada AEAT (Art. 23 LIRPF) | Exercici Fiscal: <strong>${fiscalYear}</strong>
          </div>
        </div>
        <button class="modal-close" id="modal-close-btn">&times;</button>
      </div>

      <div class="modal-body" style="display: flex; flex-direction: column; gap: var(--space-lg);">
        
        <!-- KPIs resum de l'inventari -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-md);">
          <div style="background: var(--bg-surface-elevated); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--border-default);">
            <div style="font-size: var(--text-xs); color: var(--text-muted);">Total Inversió Actius</div>
            <div style="font-size: var(--text-xl); font-weight: 700; color: var(--color-primary);">${formatCurrency(totalCost)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${totalActiveCount} actius actius, ${totalDisposedCount} baixes</div>
          </div>
          <div style="background: var(--bg-surface-elevated); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--border-default);">
            <div style="font-size: var(--text-xs); color: var(--text-muted);">Amortització Deducible ${fiscalYear}</div>
            <div style="font-size: var(--text-xl); font-weight: 700; color: var(--color-success);">${formatCurrency(totalAnnualAmort)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Deducció directa a l'IRPF</div>
          </div>
          <div style="background: var(--bg-surface-elevated); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--border-default);">
            <div style="font-size: var(--text-xs); color: var(--text-muted);">Pendent d'Amortitzar</div>
            <div style="font-size: var(--text-xl); font-weight: 700; color: var(--color-warning);">${formatCurrency(totalPending)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Valor net comptable</div>
          </div>
        </div>

        <!-- Botons d'acció de l'inventari -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-sm);">
          <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap;">
            <button class="btn btn--primary" id="btn-add-item">＋ Donar d'Alta Actiu / Factura</button>
            <button class="btn btn--secondary" id="btn-breakdown-invoice">📄 Desglossar Factura Completa</button>
          </div>
          <div style="display: flex; gap: var(--space-sm); align-items: center;">
            <label class="btn btn--secondary btn--sm" style="cursor: pointer;">
              📥 Importar CSV
              <input type="file" id="btn-import-csv" accept=".csv" style="display: none;">
            </label>
          </div>
        </div>

        <!-- Taula d'Actius d'Inventari -->
        <div style="overflow-x: auto; border: 1px solid var(--border-default); border-radius: var(--radius-md);">
          <table style="width: 100%; border-collapse: collapse; font-size: var(--text-xs);">
            <thead>
              <tr style="background: var(--bg-surface-elevated); border-bottom: 2px solid var(--border-default); text-align: left;">
                <th style="padding: 8px;">Núm. Fra. / Proveïdor</th>
                <th style="padding: 8px;">Concepte</th>
                <th style="padding: 8px;">Data Alta</th>
                <th style="padding: 8px;">Grup AEAT</th>
                <th style="padding: 8px; text-align: right;">Cost (€)</th>
                <th style="padding: 8px; text-align: center;">Coef. (%)</th>
                <th style="padding: 8px; text-align: right;">Amort. ${fiscalYear} (€)</th>
                <th style="padding: 8px; text-align: right;">Acumulada (€)</th>
                <th style="padding: 8px; text-align: center;">Estat</th>
                <th style="padding: 8px; text-align: center;">Accions</th>
              </tr>
            </thead>
            <tbody>
              ${p.inventory.length === 0 ? `
                <tr>
                  <td colspan="10" style="padding: var(--space-xl); text-align: center; color: var(--text-muted);">
                    Cap element o factura registrada en aquest immoble. Fes clic a "Donar d'Alta Actiu" o "Desglossar Factura".
                  </td>
                </tr>
              ` : p.inventory.map(item => {
                const grp = getAEATAssetGroup(item.category);
                const calc = calculateItemAnnualAmortization(
                  item.amount,
                  item.amortizationRate,
                  item.previousAmortization,
                  fiscalYear,
                  item.acquisitionDate,
                  item.disposalDate,
                  item.status
                );

                const isFullyAmortized = calc.isFullyAmortized;
                const isDisposed = item.status === 'disposed';

                return `
                  <tr style="border-bottom: 1px solid var(--border-default); ${isDisposed ? 'opacity: 0.6; background: rgba(0,0,0,0.02);' : ''}">
                    <td style="padding: 8px;">
                      <strong>${item.invoiceNumber || '—'}</strong><br>
                      <span style="color: var(--text-muted); font-size: 0.7rem;">${item.supplierName || '—'} ${item.supplierNif ? `(${item.supplierNif})` : ''}</span>
                    </td>
                    <td style="padding: 8px;">
                      <strong>${item.concept}</strong>
                      ${item.notes ? `<br><span style="color: var(--text-muted); font-size: 0.7rem;">${item.notes}</span>` : ''}
                    </td>
                    <td style="padding: 8px; white-space: nowrap;">${item.acquisitionDate}</td>
                    <td style="padding: 8px;">
                      <span class="badge badge--neutral" style="font-size: 0.7rem;">${grp.name}</span>
                    </td>
                    <td style="padding: 8px; text-align: right; font-weight: 600;">${formatCurrency(item.amount)}</td>
                    <td style="padding: 8px; text-align: center; color: var(--color-success); font-weight: 700;">${item.amortizationRate}%</td>
                    <td style="padding: 8px; text-align: right; font-weight: 700; color: var(--color-primary);">${formatCurrency(calc.annualAmount)}</td>
                    <td style="padding: 8px; text-align: right;">${formatCurrency(calc.accumulatedTotal)}</td>
                    <td style="padding: 8px; text-align: center;">
                      ${isDisposed 
                        ? `<span class="badge badge--danger" style="font-size: 0.65rem;">Baixa ${item.disposalDate || ''}</span>`
                        : isFullyAmortized 
                          ? `<span class="badge badge--neutral" style="font-size: 0.65rem;">Amortitzat 100%</span>`
                          : `<span class="badge badge--success" style="font-size: 0.65rem;">${calc.statusText || 'Actiu'}</span>`
                      }
                    </td>
                    <td style="padding: 8px; text-align: center; white-space: nowrap;">
                      <button class="btn btn--ghost btn--sm" id="edit-item-${item.id}" title="Editar" style="padding: 2px 6px;">✏️</button>
                      <button class="btn btn--ghost btn--sm text-warning" id="disposal-item-${item.id}" title="${isDisposed ? 'Reactivar' : 'Donar de Baixa'}" style="padding: 2px 6px;">${isDisposed ? '🔄' : '🚫'}</button>
                      <button class="btn btn--ghost btn--sm text-error" id="del-item-${item.id}" title="Eliminar" style="padding: 2px 6px;">🗑</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

      </div>

      <div class="modal-footer" style="display: flex; justify-content: flex-end; padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--border-default);">
        <button class="btn btn--primary" id="modal-done-btn">Finalitzar i Guardar</button>
      </div>
    `;

    // Listeners interns del modal
    modal.querySelector('#modal-close-btn')?.addEventListener('click', () => {
      overlay.remove();
      page.replaceWith(renderProperties());
    });
    modal.querySelector('#modal-done-btn')?.addEventListener('click', () => {
      overlay.remove();
      page.replaceWith(renderProperties());
    });

    modal.querySelector('#btn-add-item')?.addEventListener('click', () => {
      openItemModal(p, null, fiscalYear, () => renderModalContent());
    });

    modal.querySelector('#btn-breakdown-invoice')?.addEventListener('click', () => {
      openInvoiceBreakdownModal(p, page, () => renderModalContent());
    });

    // Importar CSV
    const csvInput = modal.querySelector('#btn-import-csv') as HTMLInputElement;
    csvInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const txt = await file.text();
        importInventoryFromCSV(p, txt);
        renderModalContent();
        showToast('Actius importats des del CSV', 'success');
      } catch {
        showToast('Error en importar el CSV', 'error');
      }
    });

    // Listeners per fila
    p.inventory.forEach(item => {
      modal.querySelector(`#edit-item-${item.id}`)?.addEventListener('click', () => {
        openItemModal(p, item, fiscalYear, () => renderModalContent());
      });

      modal.querySelector(`#disposal-item-${item.id}`)?.addEventListener('click', () => {
        if (item.status === 'disposed') {
          item.status = 'active';
          delete item.disposalDate;
          delete item.disposalReason;
          saveProperty(p);
          renderModalContent();
          showToast('Element reactivat com a actiu', 'success');
        } else {
          openDisposalModal(item, () => {
            saveProperty(p);
            renderModalContent();
          });
        }
      });

      modal.querySelector(`#del-item-${item.id}`)?.addEventListener('click', () => {
        if (confirm(`Eliminar l'element "${item.concept}" de l'inventari?`)) {
          p.inventory = p.inventory.filter(it => it.id !== item.id);
          saveProperty(p);
          renderModalContent();
          showToast('Element eliminat', 'success');
        }
      });
    });
  }

  renderModalContent();
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/**
 * Modal d'Alta / Edició d'un Element Individual d'Inventari
 */
function openItemModal(
  p: RentalProperty, 
  existingItem: PropertyInventoryItem | null, 
  fiscalYear: number, 
  onSave: () => void
): void {
  const isEdit = !!existingItem;
  const item: PropertyInventoryItem = existingItem ? JSON.parse(JSON.stringify(existingItem)) : {
    id: crypto.randomUUID(),
    invoiceNumber: '',
    supplierName: '',
    supplierNif: '',
    concept: '',
    category: 'group_2_furniture_10',
    acquisitionDate: `${fiscalYear}-01-15`,
    amount: 0,
    amortizationRate: 10,
    maxYears: 20,
    minYears: 10,
    previousAmortization: 0,
    status: 'active',
  };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '1100';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.maxWidth = '650px';

  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${isEdit ? '✏️ Editar Actiu / Línia de Factura' : '＋ Donar d\'Alta Actiu / Factura'}</h3>
      <button class="modal-close" id="submodal-close-btn">&times;</button>
    </div>
    <div class="modal-body" style="display: flex; flex-direction: column; gap: var(--space-md);">
      
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-md);">
        <div>
          <label class="form-label">Núm. Factura</label>
          <input type="text" class="form-input" id="item-inv-no" value="${item.invoiceNumber}" placeholder="Ex: FRA-2024-102">
        </div>
        <div>
          <label class="form-label">Proveïdor / Raó Social</label>
          <input type="text" class="form-input" id="item-supplier-name" value="${item.supplierName}" placeholder="Ex: Ikea, MediaMarkt">
        </div>
        <div>
          <label class="form-label">NIF/CIF Proveïdor</label>
          <input type="text" class="form-input" id="item-supplier-nif" value="${item.supplierNif}" placeholder="Ex: A-28824360">
        </div>
      </div>

      <div>
        <label class="form-label">Descripció del Concepte / Element</label>
        <input type="text" class="form-input" id="item-concept" value="${item.concept}" placeholder="Ex: Nevera No-Frost Balay, Bomba de calor Daikin, Smart TV">
      </div>

      <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: var(--space-md);">
        <div>
          <label class="form-label">Categoria d'Amortització AEAT</label>
          <select class="form-input" id="item-category">
            ${AEAT_SIMPLIFIED_TABLE.map(g => `
              <option value="${g.id}" ${item.category === g.id ? 'selected' : ''}>
                Grup ${g.groupNumber}: ${g.name} (Màx. ${g.maxLinearRate}%)
              </option>
            `).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Data Factura / Compra</label>
          <input type="date" class="form-input" id="item-date" value="${item.acquisitionDate}">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-md);">
        <div>
          <label class="form-label">Cost Total (€) (Base+IVA)</label>
          <input type="number" step="0.01" class="form-input" id="item-amount" value="${item.amount}">
        </div>
        <div>
          <label class="form-label">Coeficient Lineal (%)</label>
          <input type="number" step="0.1" class="form-input" id="item-rate" value="${item.amortizationRate}">
        </div>
        <div>
          <label class="form-label">Amortització Anys Previs (€)</label>
          <input type="number" step="0.01" class="form-input" id="item-prev" value="${item.previousAmortization}">
        </div>
      </div>

      <div>
        <label class="form-label">Observacions / Ubicació</label>
        <input type="text" class="form-input" id="item-notes" value="${item.notes || ''}" placeholder="Ex: Dormitori suite, Menjador, Cuina">
      </div>

    </div>
    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: var(--space-md); padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--border-default);">
      <button class="btn btn--ghost" id="submodal-cancel-btn">Cancel·lar</button>
      <button class="btn btn--primary" id="submodal-save-btn">💾 Guardar Element</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  modal.querySelector('#submodal-close-btn')?.addEventListener('click', close);
  modal.querySelector('#submodal-cancel-btn')?.addEventListener('click', close);

  // Auto-ajustar coeficient al canviar de categoria
  const catSelect = modal.querySelector('#item-category') as HTMLSelectElement;
  const rateInput = modal.querySelector('#item-rate') as HTMLInputElement;
  catSelect?.addEventListener('change', () => {
    const grp = getAEATAssetGroup(catSelect.value as AEATAssetGroupId);
    if (grp) {
      rateInput.value = String(grp.maxLinearRate);
    }
  });

  modal.querySelector('#submodal-save-btn')?.addEventListener('click', () => {
    item.invoiceNumber = (modal.querySelector('#item-inv-no') as HTMLInputElement).value.trim();
    item.supplierName = (modal.querySelector('#item-supplier-name') as HTMLInputElement).value.trim();
    item.supplierNif = (modal.querySelector('#item-supplier-nif') as HTMLInputElement).value.trim();
    item.concept = (modal.querySelector('#item-concept') as HTMLInputElement).value.trim() || 'Element sense nom';
    item.category = catSelect.value as AEATAssetGroupId;
    item.acquisitionDate = (modal.querySelector('#item-date') as HTMLInputElement).value;
    item.amount = parseFloat((modal.querySelector('#item-amount') as HTMLInputElement).value) || 0;
    item.amortizationRate = parseFloat(rateInput.value) || 10;
    item.previousAmortization = parseFloat((modal.querySelector('#item-prev') as HTMLInputElement).value) || 0;
    item.notes = (modal.querySelector('#item-notes') as HTMLInputElement).value.trim();

    const grp = getAEATAssetGroup(item.category);
    item.maxYears = grp.maxYears;
    item.minYears = grp.minYears;

    p.inventory = p.inventory || [];
    if (isEdit) {
      const idx = p.inventory.findIndex(it => it.id === item.id);
      if (idx !== -1) p.inventory[idx] = item;
    } else {
      p.inventory.push(item);
    }

    saveProperty(p);
    close();
    onSave();
    showToast(isEdit ? 'Element actualitzat' : 'Element afegit a l\'inventari', 'success');
  });
}

/**
 * Modal per desglossar una factura en múltiples línies amb categories AEAT diferents
 */
function openInvoiceBreakdownModal(p: RentalProperty, page: HTMLElement, onSave?: () => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '1100';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.maxWidth = '850px';

  const data = store.getData();
  const fiscalYear = data.year || 2024;

  let invoiceLines: Array<{
    id: string;
    concept: string;
    category: AEATAssetGroupId;
    amount: number;
    rate: number;
  }> = [
    { id: '1', concept: 'Rentadora Balay 8kg', category: 'group_2_furniture_10', amount: 450, rate: 10 },
    { id: '2', concept: 'Smart TV Samsung 50"', category: 'group_5_computer_26', amount: 550, rate: 26 },
  ];

  function renderBreakdownContent() {
    const totalLines = invoiceLines.reduce((s, l) => s + (l.amount || 0), 0);

    modal.innerHTML = `
      <div class="modal-header">
        <div>
          <h3 class="modal-title">📄 Desglossar Factura Multilínia (AEAT)</h3>
          <div style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px;">
            Permet donar d'alta una mateixa factura amb elements de diferents grups AEAT (30%-3%)
          </div>
        </div>
        <button class="modal-close" id="breakdown-close-btn">&times;</button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: var(--space-md);">
        
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: var(--space-sm);">
          <div>
            <label class="form-label">Núm. Factura</label>
            <input type="text" class="form-input" id="bf-inv-no" value="FRA-${fiscalYear}-01">
          </div>
          <div>
            <label class="form-label">Proveïdor</label>
            <input type="text" class="form-input" id="bf-supplier" value="Leroy Merlin / MediaMarkt">
          </div>
          <div>
            <label class="form-label">NIF Proveïdor</label>
            <input type="text" class="form-input" id="bf-nif" value="A-28824360">
          </div>
          <div>
            <label class="form-label">Data Factura</label>
            <input type="date" class="form-input" id="bf-date" value="${fiscalYear}-04-10">
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-sm);">
          <strong>Línies i Conceptes de la Factura:</strong>
          <button class="btn btn--secondary btn--sm" id="btn-add-line">＋ Afegir Línia</button>
        </div>

        <div style="border: 1px solid var(--border-default); border-radius: var(--radius-md); overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: var(--text-xs);">
            <thead>
              <tr style="background: var(--bg-surface-elevated); border-bottom: 1px solid var(--border-default); text-align: left;">
                <th style="padding: 6px 8px;">Concepte</th>
                <th style="padding: 6px 8px;">Categoria AEAT</th>
                <th style="padding: 6px 8px; text-align: center;">Coef. (%)</th>
                <th style="padding: 6px 8px; text-align: right;">Import (€)</th>
                <th style="padding: 6px 8px; text-align: center;"></th>
              </tr>
            </thead>
            <tbody>
              ${invoiceLines.map((line, idx) => `
                <tr style="border-bottom: 1px solid var(--border-default);">
                  <td style="padding: 6px 8px;">
                    <input type="text" class="form-input" style="padding: 4px;" value="${line.concept}" id="line-concept-${idx}">
                  </td>
                  <td style="padding: 6px 8px;">
                    <select class="form-input" style="padding: 4px;" id="line-cat-${idx}">
                      ${AEAT_SIMPLIFIED_TABLE.map(g => `
                        <option value="${g.id}" ${line.category === g.id ? 'selected' : ''}>
                          Grup ${g.groupNumber}: ${g.name} (${g.maxLinearRate}%)
                        </option>
                      `).join('')}
                    </select>
                  </td>
                  <td style="padding: 6px 8px; text-align: center;">
                    <input type="number" class="form-input" style="padding: 4px; width: 60px; text-align: center;" value="${line.rate}" id="line-rate-${idx}">
                  </td>
                  <td style="padding: 6px 8px; text-align: right;">
                    <input type="number" step="0.01" class="form-input" style="padding: 4px; width: 100px; text-align: right;" value="${line.amount}" id="line-amt-${idx}">
                  </td>
                  <td style="padding: 6px 8px; text-align: center;">
                    <button class="btn btn--ghost btn--sm text-error" id="del-line-${idx}" style="padding: 2px 6px;">🗑</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background: var(--bg-surface-elevated); font-weight: 700;">
                <td colspan="3" style="padding: 8px; text-align: right;">Total Factura:</td>
                <td style="padding: 8px; text-align: right; color: var(--color-primary);">${formatCurrency(totalLines)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
      <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: var(--space-md); padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--border-default);">
        <button class="btn btn--ghost" id="breakdown-cancel-btn">Cancel·lar</button>
        <button class="btn btn--primary" id="breakdown-save-btn">💾 Incorporar Totes les Línies</button>
      </div>
    `;

    // Listeners
    modal.querySelector('#breakdown-close-btn')?.addEventListener('click', () => overlay.remove());
    modal.querySelector('#breakdown-cancel-btn')?.addEventListener('click', () => overlay.remove());

    modal.querySelector('#btn-add-line')?.addEventListener('click', () => {
      saveCurrentLinesState();
      invoiceLines.push({
        id: crypto.randomUUID(),
        concept: 'Nou element',
        category: 'group_2_furniture_10',
        amount: 100,
        rate: 10,
      });
      renderBreakdownContent();
    });

    invoiceLines.forEach((_, idx) => {
      modal.querySelector(`#del-line-${idx}`)?.addEventListener('click', () => {
        saveCurrentLinesState();
        invoiceLines.splice(idx, 1);
        renderBreakdownContent();
      });

      const catSel = modal.querySelector(`#line-cat-${idx}`) as HTMLSelectElement;
      const rateInp = modal.querySelector(`#line-rate-${idx}`) as HTMLInputElement;
      catSel?.addEventListener('change', () => {
        const grp = getAEATAssetGroup(catSel.value as AEATAssetGroupId);
        if (grp) rateInp.value = String(grp.maxLinearRate);
      });
    });

    modal.querySelector('#breakdown-save-btn')?.addEventListener('click', () => {
      saveCurrentLinesState();

      const invNo = (modal.querySelector('#bf-inv-no') as HTMLInputElement).value.trim();
      const supplier = (modal.querySelector('#bf-supplier') as HTMLInputElement).value.trim();
      const nif = (modal.querySelector('#bf-nif') as HTMLInputElement).value.trim();
      const date = (modal.querySelector('#bf-date') as HTMLInputElement).value;

      p.inventory = p.inventory || [];

      invoiceLines.forEach(l => {
        const grp = getAEATAssetGroup(l.category);
        p.inventory.push({
          id: crypto.randomUUID(),
          invoiceNumber: invNo,
          supplierName: supplier,
          supplierNif: nif,
          concept: l.concept,
          category: l.category,
          acquisitionDate: date,
          amount: l.amount,
          amortizationRate: l.rate,
          maxYears: grp.maxYears,
          minYears: grp.minYears,
          previousAmortization: 0,
          status: 'active',
        });
      });

      saveProperty(p);
      overlay.remove();
      if (onSave) onSave();
      else page.replaceWith(renderProperties());
      showToast(`S'han afegit ${invoiceLines.length} línies d'inventari a l'immoble`, 'success');
    });
  }

  function saveCurrentLinesState() {
    invoiceLines.forEach((line, idx) => {
      const c = modal.querySelector(`#line-concept-${idx}`) as HTMLInputElement;
      const cat = modal.querySelector(`#line-cat-${idx}`) as HTMLSelectElement;
      const r = modal.querySelector(`#line-rate-${idx}`) as HTMLInputElement;
      const a = modal.querySelector(`#line-amt-${idx}`) as HTMLInputElement;

      if (c) line.concept = c.value;
      if (cat) line.category = cat.value as AEATAssetGroupId;
      if (r) line.rate = parseFloat(r.value) || 10;
      if (a) line.amount = parseFloat(a.value) || 0;
    });
  }

  renderBreakdownContent();
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/**
 * Modal de Baixa d'un Element d'Inventari
 */
function openDisposalModal(item: PropertyInventoryItem, onSave: () => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '1200';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.maxWidth = '500px';

  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">🚫 Donar de Baixa Element d'Inventari</h3>
      <button class="modal-close" id="disp-close-btn">&times;</button>
    </div>
    <div class="modal-body" style="display: flex; flex-direction: column; gap: var(--space-md);">
      <p style="font-size: var(--text-sm); color: var(--text-muted); margin: 0;">
        Element: <strong>${item.concept}</strong> (Cost original: ${formatCurrency(item.amount)})
      </p>

      <div>
        <label class="form-label">Data de Baixa / Cessament</label>
        <input type="date" class="form-input" id="disp-date" value="${new Date().toISOString().split('T')[0]}">
      </div>

      <div>
        <label class="form-label">Motiu de la Baixa</label>
        <select class="form-input" id="disp-reason">
          <option value="replaced">Substitució per un element nou</option>
          <option value="damaged">Avaria / Trencament irreparable</option>
          <option value="sale">Venda individual de l'element</option>
          <option value="personal_use">Destinat a ús personal</option>
          <option value="other">Altre motiu</option>
        </select>
      </div>

      <div>
        <label class="form-label">Valor de Recuperació / Venda (€)</label>
        <input type="number" step="0.01" class="form-input" id="disp-val" value="0.00">
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Normalment 0 € si s'ha llençat o substituït</div>
      </div>
    </div>
    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: var(--space-md); padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--border-default);">
      <button class="btn btn--ghost" id="disp-cancel-btn">Cancel·lar</button>
      <button class="btn btn--danger" id="disp-confirm-btn">Confirmar Baixa</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  modal.querySelector('#disp-close-btn')?.addEventListener('click', close);
  modal.querySelector('#disp-cancel-btn')?.addEventListener('click', close);

  modal.querySelector('#disp-confirm-btn')?.addEventListener('click', () => {
    item.status = 'disposed';
    item.disposalDate = (modal.querySelector('#disp-date') as HTMLInputElement).value;
    item.disposalReason = (modal.querySelector('#disp-reason') as HTMLSelectElement).value as AssetDisposalReason;
    item.disposalValue = parseFloat((modal.querySelector('#disp-val') as HTMLInputElement).value) || 0;

    close();
    onSave();
    showToast('Element donat de baixa. S\'ha prorratejat l\'amortització fins a la data de baixa.', 'success');
  });
}

function saveProperty(p: RentalProperty): void {
  const currentProps = [...(store.getData().properties || [])];
  const idx = currentProps.findIndex(item => item.id === p.id);
  if (idx !== -1) {
    currentProps[idx] = p;
  } else {
    currentProps.push(p);
  }
  store.setSection('properties', currentProps);
}

function importInventoryFromCSV(p: RentalProperty, csvContent: string): void {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length <= 1) return;

  p.inventory = p.inventory || [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.replace(/^"|"$/g, '').trim());
    if (cols.length < 5) continue;

    const invNo = cols[2] || '';
    const date = cols[3] || new Date().toISOString().split('T')[0];
    const supplier = cols[4] || '';
    const nif = cols[5] || '';
    const concept = cols[6] || 'Element importat';
    const rate = parseFloat(cols[8]) || 10;
    const amount = parseFloat(cols[9]) || 0;
    const prev = parseFloat(cols[10]) || 0;
    const notes = cols[13] || '';

    const category = suggestAEATCategory(concept);
    const grp = getAEATAssetGroup(category);

    p.inventory.push({
      id: crypto.randomUUID(),
      invoiceNumber: invNo,
      supplierName: supplier,
      supplierNif: nif,
      concept,
      category,
      acquisitionDate: date,
      amount,
      amortizationRate: rate > 0 ? rate : grp.maxLinearRate,
      maxYears: grp.maxYears,
      minYears: grp.minYears,
      previousAmortization: prev,
      notes,
      status: 'active',
    });
  }

  saveProperty(p);
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
