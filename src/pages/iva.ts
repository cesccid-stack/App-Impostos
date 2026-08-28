/**
 * @module pages/iva
 * Mòdul Integral de Gestió de l'IVA (Models 303, 390, 349, Llibres Oficials i Vinculació).
 * Conforme amb la Llei 37/1992, Ordre HAC/773/2019 i Seu Electrònica de l'AEAT.
 */

import { store } from '../store.ts';
import { 
  QUARTERS, 
  IVA_FILING_DEADLINES, 
  calculateAllQuarters, 
  calculateModel390Annual, 
  extractModel349Entries, 
  auditIVARisks 
} from '../fiscal/iva-engine.ts';
import { 
  exportIssuedInvoicesCSV, 
  exportReceivedInvoicesCSV, 
  exportInvestmentAssetsCSV, 
  exportModel303SummaryCSV 
} from '../utils/iva-books-generator.ts';
import { formatCurrency } from '../utils/currency.ts';
import { showToast } from '../components/toast.ts';
import { FISCAL_YEARS, type FiscalYear } from '../fiscal/constants.ts';
import { runAutomatedComplianceChecks, isValidSpanishTaxId } from '../fiscal/auto-validator.ts';
import { openComplianceModal } from '../components/compliance-modal.ts';
import { openInvoiceDocumentModal } from '../components/invoice-document-modal.ts';
import { generateAndDownloadInspectionPackage } from '../utils/inspection-package-generator.ts';
import { saveInvoiceDocument } from '../utils/document-vault.ts';
import type { 
  IVAData, 
  IVAInvoiceIssued, 
  IVAInvoiceReceived, 
  IVABienInversion, 
  FiscalQuarter, 
  IVARate, 
  WithholdingRate,
  IssuedInvoiceCategory,
  ReceivedInvoiceCategory,
  Model303QuarterResult,
  Model390AnnualSummary,
  Model349Entry 
} from '../types-iva.ts';

export function renderIVA(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page iva-page';

  let activeTab: 'dashboard' | 'model303' | 'invoices' | 'prorrata' | 'sync' | 'model390' = 'dashboard';
  let active303Quarter: FiscalQuarter = '1T';
  let activeInvoiceSubTab: 'issued' | 'received' | 'assets' = 'issued';
  let invoiceQuarterFilter: 'ALL' | FiscalQuarter = 'ALL';
  let invoicePdfFilter: 'ALL' | 'WITH_PDF' | 'WITHOUT_PDF' = 'ALL';
  let selectedPeriodFilter: 'ALL' | FiscalQuarter = 'ALL';
  let searchQuery = '';

  function render() {
    const ivaData = store.getIVA();
    const year = store.getYear() || 2024;
    const { quarters, finalPendingCarryover } = calculateAllQuarters(ivaData, year);
    const model390 = calculateModel390Annual(ivaData, year);
    const model349 = extractModel349Entries(ivaData);
    const riskAlerts = auditIVARisks(ivaData);
    const compliance = runAutomatedComplianceChecks(store.getData());

    page.innerHTML = `
      <!-- Header -->
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-md);">
        <div>
          <div style="display:flex; align-items:center; gap:var(--space-sm); flex-wrap:wrap;">
            <h1 class="page-header__title" style="margin:0;">🧾 Gestió Integral de l'IVA & Models AEAT</h1>
            <span class="badge badge--primary">Models 303 / 390 / 349</span>
            <span class="badge ${ivaData.config.hasProrrata ? 'badge--warning' : 'badge--info'}">
              ${ivaData.config.hasProrrata ? `Prorrata ${ivaData.config.prorrata.definitivePercentage}%` : 'Règim General 100%'}
            </span>
          </div>
          <p class="page-header__subtitle" style="margin:4px 0 0 0;">
            Autoliquidacions trimestrals, llibres registre de factures oficials, règim de prorrata i sincronització intel·ligent amb activitats i immobles
          </p>
        </div>
        <div style="display:flex; gap:var(--space-sm); flex-wrap:wrap;">
          <button class="btn btn--secondary btn--sm" id="btn-quick-sync" title="Sincronitzar amb Activitats i Immobles">
            🔄 Sincronització Ràpida
          </button>
          <button class="btn btn--primary btn--sm" id="btn-add-invoice-header">
            ➕ Nova Factura
          </button>
        </div>
      </div>

      <!-- Banner de Comprovacions Automàtiques en Temps Real -->
      ${compliance.status === 'perfect' ? `
        <div style="margin-bottom:var(--space-md); padding:8px 14px; border-radius:var(--radius-md); background:var(--bg-surface-elevated); border-left:4px solid var(--color-success); display:flex; justify-content:space-between; align-items:center; font-size:0.75rem;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span>✅</span>
            <span style="color:var(--text-secondary);">Comprovacions automàtiques d'IVA i Activitats: <strong>100% Correcte</strong> (Sense desquadres ni riscos d'inspecció detectats).</span>
          </div>
          <button class="btn btn--ghost btn--sm" id="btn-open-iva-compliance" style="font-size:0.75rem; padding:2px 8px;">
            🔍 Diagnòstic
          </button>
        </div>
      ` : `
        <div style="margin-bottom:var(--space-md); padding:10px 16px; border-radius:var(--radius-md); background:var(--bg-surface-elevated); border-left:4px solid ${compliance.criticalCount > 0 ? 'var(--color-error)' : 'var(--color-warning)'}; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
          <div style="display:flex; align-items:center; gap:var(--space-sm);">
            <span style="font-size:1.3rem;">${compliance.criticalCount > 0 ? '🔴' : '🟡'}</span>
            <div>
              <strong style="font-size:var(--text-sm);">S'han detectat ${compliance.criticalCount + compliance.warningCount} observacions de conformitat fiscal</strong>
              <p style="margin:0; font-size:0.75rem; color:var(--text-secondary);">${compliance.issues[0]?.message}</p>
            </div>
          </div>
          <button class="btn btn--secondary btn--sm" id="btn-open-iva-compliance">
            🔍 Veure Diagnòstic & Corregir
          </button>
        </div>
      `}

      <!-- Barra de Filtre de Període i Any Fiscal -->
      <div class="card" style="margin-bottom:var(--space-lg); padding:10px 16px; background:var(--bg-surface-elevated); border:1px solid var(--border-default); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-md);">
        <div style="display:flex; align-items:center; gap:var(--space-md); flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:var(--space-xs);">
            <span style="font-weight:600; font-size:var(--text-xs); color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.05em;">📅 Any Fiscal:</span>
            <select class="form-select" id="iva-year-selector" style="font-weight:bold; font-size:var(--text-xs); padding:4px 10px; background:var(--bg-base); color:var(--text-primary); border:1px solid var(--border-default); border-radius:var(--radius-sm); cursor:pointer;">
              ${FISCAL_YEARS.map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>Exercici ${y}</option>`).join('')}
            </select>
          </div>

          <div style="height:18px; width:1px; background:var(--border-default);"></div>

          <div style="display:flex; align-items:center; gap:var(--space-xs); flex-wrap:wrap;">
            <span style="font-weight:600; font-size:var(--text-xs); color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.05em;">⏰ Trimestre de Consulta:</span>
            <div style="display:flex; gap:3px;">
              <button class="btn ${selectedPeriodFilter === 'ALL' ? 'btn--primary' : 'btn--secondary'} btn--sm btn-header-quarter" data-quarter="ALL" style="padding:3px 8px; font-size:0.75rem;">
                Tot l'Any
              </button>
              <button class="btn ${selectedPeriodFilter === '1T' ? 'btn--primary' : 'btn--secondary'} btn--sm btn-header-quarter" data-quarter="1T" style="padding:3px 8px; font-size:0.75rem;">
                1T (Gen-Mar)
              </button>
              <button class="btn ${selectedPeriodFilter === '2T' ? 'btn--primary' : 'btn--secondary'} btn--sm btn-header-quarter" data-quarter="2T" style="padding:3px 8px; font-size:0.75rem;">
                2T (Abr-Jun)
              </button>
              <button class="btn ${selectedPeriodFilter === '3T' ? 'btn--primary' : 'btn--secondary'} btn--sm btn-header-quarter" data-quarter="3T" style="padding:3px 8px; font-size:0.75rem;">
                3T (Jul-Set)
              </button>
              <button class="btn ${selectedPeriodFilter === '4T' ? 'btn--primary' : 'btn--secondary'} btn--sm btn-header-quarter" data-quarter="4T" style="padding:3px 8px; font-size:0.75rem;">
                4T (Oct-Des)
              </button>
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:var(--space-xs); font-size:0.75rem; color:var(--text-muted);">
          <span>Declarant: <strong>${store.getActiveProfile().name}</strong></span>
        </div>
      </div>

      <!-- Pestanyes de navegació de l'IVA -->
      <div class="tabs-nav" style="display:flex; gap:var(--space-xs); border-bottom:1px solid var(--border-default); margin-bottom:var(--space-xl); overflow-x:auto; padding-bottom:var(--space-xs);">
        <button class="tab-btn ${activeTab === 'dashboard' ? 'tab-btn--active' : ''}" data-tab="dashboard" style="padding:8px 16px; border-radius:var(--radius-md); border:none; background:${activeTab === 'dashboard' ? 'var(--color-primary)' : 'transparent'}; color:${activeTab === 'dashboard' ? '#fff' : 'var(--text-secondary)'}; cursor:pointer; font-weight:600; font-size:var(--text-sm); display:flex; align-items:center; gap:6px;">
          📊 Dashboard & Calendari
        </button>
        <button class="tab-btn ${activeTab === 'model303' ? 'tab-btn--active' : ''}" data-tab="model303" style="padding:8px 16px; border-radius:var(--radius-md); border:none; background:${activeTab === 'model303' ? 'var(--color-primary)' : 'transparent'}; color:${activeTab === 'model303' ? '#fff' : 'var(--text-secondary)'}; cursor:pointer; font-weight:600; font-size:var(--text-sm); display:flex; align-items:center; gap:6px;">
          📝 Liquidacions Model 303
        </button>
        <button class="tab-btn ${activeTab === 'invoices' ? 'tab-btn--active' : ''}" data-tab="invoices" style="padding:8px 16px; border-radius:var(--radius-md); border:none; background:${activeTab === 'invoices' ? 'var(--color-primary)' : 'transparent'}; color:${activeTab === 'invoices' ? '#fff' : 'var(--text-secondary)'}; cursor:pointer; font-weight:600; font-size:var(--text-sm); display:flex; align-items:center; gap:6px;">
          📑 Llibres de Factures (${ivaData.issuedInvoices.length + ivaData.receivedInvoices.length})
        </button>
        <button class="tab-btn ${activeTab === 'prorrata' ? 'tab-btn--active' : ''}" data-tab="prorrata" style="padding:8px 16px; border-radius:var(--radius-md); border:none; background:${activeTab === 'prorrata' ? 'var(--color-primary)' : 'transparent'}; color:${activeTab === 'prorrata' ? '#fff' : 'var(--text-secondary)'}; cursor:pointer; font-weight:600; font-size:var(--text-sm); display:flex; align-items:center; gap:6px;">
          ⚖️ Prorrata & Béns Inversió
        </button>
        <button class="tab-btn ${activeTab === 'sync' ? 'tab-btn--active' : ''}" data-tab="sync" style="padding:8px 16px; border-radius:var(--radius-md); border:none; background:${activeTab === 'sync' ? 'var(--color-primary)' : 'transparent'}; color:${activeTab === 'sync' ? '#fff' : 'var(--text-secondary)'}; cursor:pointer; font-weight:600; font-size:var(--text-sm); display:flex; align-items:center; gap:6px;">
          🔄 Vinculació & Sincronització
        </button>
        <button class="tab-btn ${activeTab === 'model390' ? 'tab-btn--active' : ''}" data-tab="model390" style="padding:8px 16px; border-radius:var(--radius-md); border:none; background:${activeTab === 'model390' ? 'var(--color-primary)' : 'transparent'}; color:${activeTab === 'model390' ? '#fff' : 'var(--text-secondary)'}; cursor:pointer; font-weight:600; font-size:var(--text-sm); display:flex; align-items:center; gap:6px;">
          📑 Resum Anual 390 / 349
        </button>
      </div>

      <!-- Contingut de la pestanya activa -->
      <div id="iva-tab-content">
        ${renderActiveTabContent(ivaData, quarters, model390, model349, riskAlerts, finalPendingCarryover, year)}
      </div>
    `;

    bindEvents(ivaData, quarters, year);
  }

  function renderActiveTabContent(
    ivaData: IVAData,
    quarters: Record<FiscalQuarter, Model303QuarterResult>,
    model390: Model390AnnualSummary,
    model349: Model349Entry[],
    riskAlerts: ReturnType<typeof auditIVARisks>,
    finalPendingCarryover: number,
    year: number
  ): string {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboardTab(ivaData, quarters, riskAlerts, finalPendingCarryover, year);
      case 'model303':
        return renderModel303Tab(quarters, active303Quarter, year);
      case 'invoices':
        return renderInvoicesTab(ivaData);
      case 'prorrata':
        return renderProrrataTab(ivaData);
      case 'sync':
        return renderSyncTab(ivaData);
      case 'model390':
        return renderModel390Tab(model390, model349, year);
      default:
        return '';
    }
  }

  /* ─────────────────────────────────────────────────────────── */
  /* TAB 1: DASHBOARD & CALENDARI FISCAL                         */
  /* ─────────────────────────────────────────────────────────── */
  function renderDashboardTab(
    ivaData: IVAData,
    quarters: Record<FiscalQuarter, Model303QuarterResult>,
    riskAlerts: ReturnType<typeof auditIVARisks>,
    finalPendingCarryover: number,
    year: number
  ): string {
    const totalDevengado = QUARTERS.reduce((s, q) => s + quarters[q].totalDevengado, 0);
    const totalDeducible = QUARTERS.reduce((s, q) => s + quarters[q].totalDeducible, 0);
    const totalResult = QUARTERS.reduce((s, q) => s + quarters[q].resultadoLiquidacion, 0);

    return `
      <!-- Scorecards principals -->
      <div class="dashboard-stats" style="margin-bottom:var(--space-xl);">
        <div class="stat-card">
          <div class="stat-card__label">Total IVA Repercutit (Devengat)</div>
          <div class="stat-card__value text-primary">${formatCurrency(totalDevengado)}</div>
          <div class="stat-card__hint">${ivaData.issuedInvoices.length} factures expedides</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Total IVA Suportat Deduïble</div>
          <div class="stat-card__value text-success">${formatCurrency(totalDeducible)}</div>
          <div class="stat-card__hint">${ivaData.receivedInvoices.length} factures rebudes</div>
        </div>
        <div class="stat-card" style="background:var(--bg-surface-elevated); border:1px solid ${totalResult > 0 ? 'var(--color-warning)' : 'var(--color-success)'};">
          <div class="stat-card__label">Saldo Net Liquidacions (Any ${year})</div>
          <div class="stat-card__value ${totalResult > 0 ? 'text-warning' : 'text-success'} font-bold">
            ${formatCurrency(totalResult)}
          </div>
          <div class="stat-card__hint">${totalResult > 0 ? '⚠️ Quota acumulada a ingressar' : '✅ Quota a compensar o tornar'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Bossa d'IVA a Compensar</div>
          <div class="stat-card__value">${formatCurrency(finalPendingCarryover)}</div>
          <div class="stat-card__hint">Disponible per a exercicis futurs</div>
        </div>
      </div>

      <!-- Targetes dels 4 Trimestres -->
      <h3 style="margin:0 0 var(--space-md) 0; font-size:var(--text-md); display:flex; align-items:center; gap:var(--space-xs);">
        <span>📅 Estat de les Liquidacions Trimestrals (Model 303)</span>
      </h3>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-xl);">
        ${QUARTERS.map(q => {
          const qr = quarters[q];
          const dl = IVA_FILING_DEADLINES[q];
          const isPositive = qr.resultadoLiquidacion > 0;
          const isZero = qr.resultadoLiquidacion === 0;

          return `
            <div class="card" style="border-top:4px solid ${isPositive ? 'var(--color-warning)' : (isZero ? 'var(--border-default)' : 'var(--color-success)')};">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:var(--space-sm);">
                <div>
                  <h4 style="margin:0; font-size:var(--text-base);">${dl.label}</h4>
                  <span style="font-size:0.75rem; color:var(--text-muted);">Termini: ${dl.deadline}</span>
                </div>
                <span class="badge ${isPositive ? 'badge--warning' : (isZero ? 'badge--info' : 'badge--success')}">
                  ${qr.paymentType.toUpperCase()}
                </span>
              </div>
              
              <div style="font-size:var(--text-xs); display:flex; flex-direction:column; gap:4px; margin-bottom:var(--space-md);">
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--text-muted);">IVA Devengat:</span>
                  <strong>${formatCurrency(qr.totalDevengado)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--text-muted);">IVA Deduïble:</span>
                  <strong>-${formatCurrency(qr.totalDeducible)}</strong>
                </div>
                ${qr.cuotasCompensarPeriodosAnteriores > 0 ? `
                  <div style="display:flex; justify-content:space-between; color:var(--color-info);">
                    <span>Compensat previ:</span>
                    <strong>-${formatCurrency(qr.cuotasCompensarPeriodosAnteriores)}</strong>
                  </div>
                ` : ''}
                <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border-subtle); padding-top:4px; font-weight:bold; font-size:var(--text-sm);">
                  <span>Resultat (Casella 71):</span>
                  <span class="${isPositive ? 'text-warning' : 'text-success'}">${formatCurrency(qr.resultadoLiquidacion)}</span>
                </div>
              </div>

              <button class="btn btn--secondary btn--sm btn-view-quarter" data-quarter="${q}" style="width:100%;">
                🔍 Veure Caselles Model 303
              </button>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Radar de Riscos i Alertes Legals -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="margin-bottom:var(--space-md);">
          <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
            <span>🛡️ Radar de Riscos i Validacions Fiscals de l'IVA</span>
          </div>
          <p class="card__subtitle" style="margin:0;">Comprovacions automàtiques segons criteris d'inspecció de l'AEAT</p>
        </div>
        <div style="display:flex; flex-direction:column; gap:var(--space-sm);">
          ${riskAlerts.map(alert => `
            <div style="display:flex; gap:var(--space-sm); align-items:flex-start; padding:var(--space-sm) var(--space-md); border-radius:var(--radius-md); background:var(--bg-surface-elevated); border-left:4px solid var(--color-${alert.type});">
              <span style="font-size:1.2rem;">
                ${alert.type === 'error' ? '❌' : (alert.type === 'warning' ? '⚠️' : (alert.type === 'info' ? 'ℹ️' : '✅'))}
              </span>
              <div>
                <strong style="font-size:var(--text-sm);">${alert.title}</strong>
                <p style="margin:2px 0 0 0; font-size:0.8rem; color:var(--text-secondary);">${alert.message}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────────────────── */
  /* TAB 2: LIQUIDACIONS MODEL 303 (CASELLES OFICIALS)           */
  /* ─────────────────────────────────────────────────────────── */
  function renderModel303Tab(
    quarters: Record<FiscalQuarter, any>,
    selectedQuarter: FiscalQuarter,
    year: number
  ): string {
    const q = quarters[selectedQuarter];
    const isComp = !!q.isComplementary;
    const finalCompResult = q.resultadoComplementaria ?? (q.resultadoLiquidacion - (q.previousResultIngressat || 0));

    return `
      <!-- Selector de Trimestre i Botó de Complementària -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm); margin-bottom:var(--space-lg);">
        <div style="display:flex; gap:var(--space-xs); flex-wrap:wrap;">
          ${QUARTERS.map(t => `
            <button class="btn ${selectedQuarter === t ? 'btn--primary' : 'btn--secondary'} btn--sm btn-select-303-quarter" data-quarter="${t}">
              Trimestre ${t} ${quarters[t].isComplementary ? '⚡' : ''}
            </button>
          `).join('')}
        </div>
        <div style="display:flex; gap:var(--space-sm); flex-wrap:wrap;">
          <button class="btn ${isComp ? 'btn--warning' : 'btn--secondary'} btn--sm" id="btn-toggle-303-complementary">
            <span>${isComp ? '⚡' : '🔄'}</span>
            <span>${isComp ? 'Complementària Activa' : 'Fer Autoliquidació Complementària'}</span>
          </button>
          <button class="btn btn--secondary btn--sm" id="btn-export-303-csv">
            📥 Descarregar Resum Caselles (CSV)
          </button>
        </div>
      </div>

      <!-- Resum Oficial de Caselles -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="margin-bottom:var(--space-lg); border-bottom:1px solid var(--border-default); padding-bottom:var(--space-md);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
            <div>
              <h2 style="margin:0; font-size:var(--text-lg); display:flex; align-items:center; gap:var(--space-xs);">
                <span>📝 Model 303 — Autoliquidació Trimestre ${selectedQuarter} (${year})</span>
                ${isComp ? '<span class="badge badge--warning">⚡ COMPLEMENTÀRIA</span>' : ''}
              </h2>
              <p class="card__subtitle" style="margin:4px 0 0 0;">Estructura oficial de caselles per a la Seu Electrònica de l'AEAT</p>
            </div>
            <span class="badge ${q.resultadoLiquidacion > 0 ? 'badge--warning' : 'badge--success'}" style="font-size:0.9rem; padding:6px 12px;">
              Resultat: ${formatCurrency(isComp ? finalCompResult : q.resultadoLiquidacion)} (${q.paymentType.toUpperCase()})
            </span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-xl);">
          <!-- Columna Esquerra: IVA Devengat -->
          <div>
            <h3 style="font-size:var(--text-sm); text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:var(--space-md); border-bottom:2px solid var(--color-primary); padding-bottom:4px;">
              01. IVA DEVENGAT (Règim General)
            </h3>
            
            <table class="data-table" style="width:100%; font-size:var(--text-xs);">
              <thead>
                <tr>
                  <th>Casella</th>
                  <th>Descripció</th>
                  <th style="text-align:right;">Base (€)</th>
                  <th style="text-align:right;">Tipus</th>
                  <th style="text-align:right;">Quota (€)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span class="badge badge--sm">01 / 03</span></td>
                  <td>Règim general (21%)</td>
                  <td style="text-align:right;">${formatCurrency(q.base21)}</td>
                  <td style="text-align:right;">21%</td>
                  <td style="text-align:right;"><strong>${formatCurrency(q.cuota21)}</strong></td>
                </tr>
                <tr>
                  <td><span class="badge badge--sm">04 / 06</span></td>
                  <td>Règim general (10%)</td>
                  <td style="text-align:right;">${formatCurrency(q.base10)}</td>
                  <td style="text-align:right;">10%</td>
                  <td style="text-align:right;"><strong>${formatCurrency(q.cuota10)}</strong></td>
                </tr>
                <tr>
                  <td><span class="badge badge--sm">07 / 09</span></td>
                  <td>Règim general (4%)</td>
                  <td style="text-align:right;">${formatCurrency(q.base4)}</td>
                  <td style="text-align:right;">4%</td>
                  <td style="text-align:right;"><strong>${formatCurrency(q.cuota4)}</strong></td>
                </tr>
                <tr>
                  <td><span class="badge badge--sm">10 / 11</span></td>
                  <td>Adquisicions intracomunitàries</td>
                  <td style="text-align:right;">${formatCurrency(q.intraEuBase)}</td>
                  <td style="text-align:right;">—</td>
                  <td style="text-align:right;"><strong>${formatCurrency(q.intraEuCuota)}</strong></td>
                </tr>
                <tr>
                  <td><span class="badge badge--sm">12 / 13</span></td>
                  <td>Inversió del subjecte passiu (ISP)</td>
                  <td style="text-align:right;">${formatCurrency(q.ispBase)}</td>
                  <td style="text-align:right;">—</td>
                  <td style="text-align:right;"><strong>${formatCurrency(q.ispCuota)}</strong></td>
                </tr>
                <tr>
                  <td><span class="badge badge--sm">14 / 15</span></td>
                  <td>Modificació bases i quotes</td>
                  <td style="text-align:right;">${formatCurrency(q.modBase)}</td>
                  <td style="text-align:right;">—</td>
                  <td style="text-align:right;"><strong>${formatCurrency(q.modCuota)}</strong></td>
                </tr>
                <tr style="background:var(--bg-surface-elevated); font-weight:bold; font-size:var(--text-sm);">
                  <td><span class="badge badge--primary">27</span></td>
                  <td colspan="3">TOTAL QUOTA DEVENGADA</td>
                  <td style="text-align:right; color:var(--color-primary);">${formatCurrency(q.totalDevengado)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Columna Dreta: IVA Deduïble -->
          <div>
            <h3 style="font-size:var(--text-sm); text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:var(--space-md); border-bottom:2px solid var(--color-success); padding-bottom:4px;">
              02. IVA DEDUÏBLE
            </h3>

            <table class="data-table" style="width:100%; font-size:var(--text-xs);">
              <thead>
                <tr>
                  <th>Casella</th>
                  <th>Descripció</th>
                  <th style="text-align:right;">Base (€)</th>
                  <th style="text-align:right;">Quota (€)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span class="badge badge--sm">28 / 29</span></td>
                  <td>Operacions interiors corrents</td>
                  <td style="text-align:right;">${formatCurrency(q.deducibleCorrienteBase)}</td>
                  <td style="text-align:right;"><strong>${formatCurrency(q.deducibleCorrienteCuota)}</strong></td>
                </tr>
                <tr>
                  <td><span class="badge badge--sm">30 / 31</span></td>
                  <td>Béns d'inversió</td>
                  <td style="text-align:right;">${formatCurrency(q.deducibleInversionBase)}</td>
                  <td style="text-align:right;"><strong>${formatCurrency(q.deducibleInversionCuota)}</strong></td>
                </tr>
                <tr>
                  <td><span class="badge badge--sm">32 / 33</span></td>
                  <td>Importacions de béns corrents</td>
                  <td style="text-align:right;">${formatCurrency(q.deducibleImportacionesBase)}</td>
                  <td style="text-align:right;"><strong>${formatCurrency(q.deducibleImportacionesCuota)}</strong></td>
                </tr>
                <tr>
                  <td><span class="badge badge--sm">36 / 37</span></td>
                  <td>Adquisicions intracomunitàries corrents</td>
                  <td style="text-align:right;">${formatCurrency(q.deducibleIntraEuBase)}</td>
                  <td style="text-align:right;"><strong>${formatCurrency(q.deducibleIntraEuCuota)}</strong></td>
                </tr>
                <tr>
                  <td><span class="badge badge--sm">43</span></td>
                  <td>Regularització béns d'inversió</td>
                  <td style="text-align:right;">—</td>
                  <td style="text-align:right;"><strong>${formatCurrency(q.regularizacionBienesInversion)}</strong></td>
                </tr>
                <tr>
                  <td><span class="badge badge--sm">44</span></td>
                  <td>Regularització prorrata definitiva</td>
                  <td style="text-align:right;">—</td>
                  <td style="text-align:right;"><strong>${formatCurrency(q.regularizacionProrrata)}</strong></td>
                </tr>
                <tr style="background:var(--bg-surface-elevated); font-weight:bold; font-size:var(--text-sm);">
                  <td><span class="badge badge--success">45</span></td>
                  <td colspan="2">TOTAL A DEDUIR</td>
                  <td style="text-align:right; color:var(--color-success);">${formatCurrency(q.totalDeducible)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Resultat de la Liquidació Ordinària -->
        <div style="margin-top:var(--space-xl); background:var(--bg-surface-elevated); border-radius:var(--radius-md); padding:var(--space-md); border:1px solid var(--border-default);">
          <h3 style="font-size:var(--text-sm); text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:var(--space-sm);">
            03. RESULTAT DE LA LIQUIDACIÓ
          </h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-md); font-size:var(--text-sm);">
            <div>
              <div style="color:var(--text-muted);">Diferència (Casella 46 = 27 - 45):</div>
              <strong>${formatCurrency(q.diferencia)}</strong>
            </div>
            <div>
              <div style="color:var(--text-muted);">Compensació Prèvia (Casella 110):</div>
              <strong class="text-info">-${formatCurrency(q.cuotasCompensarPeriodosAnteriores)}</strong>
            </div>
            <div>
              <div style="color:var(--text-muted);">Resultat Ordinari (Casella 69):</div>
              <strong style="font-size:1.2rem;" class="${q.resultadoLiquidacion > 0 ? 'text-warning' : 'text-success'}">
                ${formatCurrency(q.resultadoLiquidacion)}
              </strong>
            </div>
            <div>
              <div style="color:var(--text-muted);">Tipus de Liquidació:</div>
              <span class="badge ${q.resultadoLiquidacion > 0 ? 'badge--warning' : 'badge--success'}">
                ${q.paymentType.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <!-- Bloc d'Autoliquidació Complementària del Trimestre (Caselles 70 / 71) -->
        ${isComp ? `
          <div style="margin-top:var(--space-lg); background:var(--bg-surface-elevated); border-radius:var(--radius-md); padding:var(--space-md); border:2px solid var(--color-warning);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; margin-bottom:var(--space-md);">
              <h3 style="font-size:var(--text-sm); text-transform:uppercase; letter-spacing:0.05em; color:var(--color-warning); margin:0; display:flex; align-items:center; gap:var(--space-xs);">
                <span>⚡ 04. AUTOLIQUIDACIÓ COMPLEMENTÀRIA DEL TRIMESTRE ${selectedQuarter}</span>
              </h3>
              <span class="badge badge--warning">Caselles 70 / 71 Model 303</span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-md);">
              <div>
                <label class="form-label" style="font-size:var(--text-xs); font-weight:600;">🧾 Justificant Autoliquidació Anterior (13 dígits):</label>
                <input type="text" class="form-input" id="comp-303-receipt" placeholder="Ex: 3032024010012" value="${q.previousReceiptNumber || ''}" style="width:100%; font-family:var(--font-mono);" />
              </div>
              <div>
                <label class="form-label" style="font-size:var(--text-xs); font-weight:600;">💶 Ingrés Efectuat en l'Anterior Autoliquidació [Casella 70] (€):</label>
                <input type="number" step="0.01" class="form-input" id="comp-303-prev-ingressat" placeholder="Ex: 350.00" value="${q.previousResultIngressat || 0}" style="width:100%;" />
              </div>
              <div>
                <label class="form-label" style="font-size:var(--text-xs); font-weight:600;">⏱️ Mesos de Retard (Recàrrec Art. 27 LGT):</label>
                <input type="number" min="0" max="48" class="form-input" id="comp-303-months-late" value="${q.extemporaneousMonths || 0}" style="width:100%;" />
              </div>
            </div>

            <!-- Taula de Resolució de la Complementària 303 -->
            <div style="border-radius:var(--radius-sm); overflow:hidden; border:1px solid var(--border-default);">
              <table class="data-table" style="width:100%; font-size:var(--text-xs);">
                <tbody>
                  <tr>
                    <td>Resultat de la Liquidació Actual (Devengat - Deduïble - Compensacions)</td>
                    <td><span class="badge badge--sm">Casella 69</span></td>
                    <td style="text-align:right; font-weight:600;">${formatCurrency(q.resultadoLiquidacion)}</td>
                  </tr>
                  <tr>
                    <td>(-) A deduir: Ingrés efectuat en la declaració anterior o devolució rebuda</td>
                    <td><span class="badge badge--sm">Casella 70</span></td>
                    <td style="text-align:right; color:var(--text-secondary);">${formatCurrency(q.previousResultIngressat || 0)}</td>
                  </tr>
                  <tr style="background:var(--bg-surface); font-weight:700;">
                    <td>(=) RESULTAT EFECTIU DE L'AUTOLIQUIDACIÓ COMPLEMENTÀRIA</td>
                    <td><span class="badge badge--primary badge--sm">Casella 71</span></td>
                    <td style="text-align:right; color:${finalCompResult > 0 ? 'var(--color-error)' : 'var(--color-success)'}; font-size:var(--text-sm);">
                      ${formatCurrency(finalCompResult)}
                    </td>
                  </tr>
                  ${(q.surchargeExtemporaneous || 0) > 0 ? `
                    <tr>
                      <td>(+) Recàrrec per Presentació Extemporània (Art. 27 LGT: ${q.extemporaneousRate || 1}% - 25% bonificació)</td>
                      <td><span class="badge badge--sm">Art. 27 LGT</span></td>
                      <td style="text-align:right; color:var(--color-warning); font-weight:600;">
                        +${formatCurrency(q.surchargeExtemporaneous || 0)}
                      </td>
                    </tr>
                  ` : ''}
                  <tr style="background:var(--color-warning-soft, rgba(234,179,8,0.15)); font-weight:800; font-size:var(--text-sm);">
                    <td>TOTAL EFECTIU A INGRESAR PER AQUEST TRIMESTRE ${selectedQuarter}</td>
                    <td><span class="badge badge--warning">TOTAL 303</span></td>
                    <td style="text-align:right; color:var(--color-warning); font-size:var(--text-base);">
                      ${formatCurrency(Math.max(0, finalCompResult + (q.surchargeExtemporaneous || 0)))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /* ─────────────────────────────────────────────────────────── */
  /* TAB 3: LLIBRES DE FACTURES (EMESES / REBUDES / INVERSIÓ)    */
  /* ─────────────────────────────────────────────────────────── */
  function renderInvoicesTab(ivaData: IVAData): string {
    const issued = ivaData.issuedInvoices || [];
    const received = ivaData.receivedInvoices || [];
    const assets = ivaData.investmentAssets || [];

    const filterQuarter = <T extends {
      quarter: FiscalQuarter;
      hasAttachment?: boolean;
      clientName?: string;
      supplierName?: string;
      description?: string;
      invoiceNumber?: string;
      concept?: string;
      clientNif?: string;
      supplierNif?: string;
    }>(invList: T[]): T[] => {
      let filtered = invList;
      if (invoiceQuarterFilter !== 'ALL') {
        filtered = filtered.filter(i => i.quarter === invoiceQuarterFilter);
      }
      if (invoicePdfFilter === 'WITH_PDF') {
        filtered = filtered.filter(i => i.hasAttachment);
      } else if (invoicePdfFilter === 'WITHOUT_PDF') {
        filtered = filtered.filter(i => !i.hasAttachment);
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(i => 
          (i.clientName || i.supplierName || i.description || '').toLowerCase().includes(q) ||
          (i.invoiceNumber || '').toLowerCase().includes(q) ||
          (i.concept || '').toLowerCase().includes(q) ||
          (i.clientNif || i.supplierNif || '').toLowerCase().includes(q)
        );
      }
      return filtered;
    };

    return `
      <!-- Barra de controls de factures -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-lg);">
        <div style="display:flex; gap:var(--space-xs); flex-wrap:wrap;">
          <button class="btn ${activeInvoiceSubTab === 'issued' ? 'btn--primary' : 'btn--secondary'} btn--sm btn-invoice-subtab" data-subtab="issued">
            📤 Factures Emeses (${issued.length})
          </button>
          <button class="btn ${activeInvoiceSubTab === 'received' ? 'btn--primary' : 'btn--secondary'} btn--sm btn-invoice-subtab" data-subtab="received">
            📥 Factures Rebudes (${received.length})
          </button>
          <button class="btn ${activeInvoiceSubTab === 'assets' ? 'btn--primary' : 'btn--secondary'} btn--sm btn-invoice-subtab" data-subtab="assets">
            🏢 Béns d'Inversió (${assets.length})
          </button>
        </div>

        <div style="display:flex; gap:var(--space-sm); align-items:center; flex-wrap:wrap;">
          <!-- Filtre Trimestre -->
          <select class="form-select" id="invoice-quarter-filter" style="font-size:0.8rem; padding:4px 8px; background:var(--bg-surface-elevated); color:var(--text-primary); border:1px solid var(--border-default); border-radius:var(--radius-sm);">
            <option value="ALL" ${invoiceQuarterFilter === 'ALL' ? 'selected' : ''}>Tots els Trimestres</option>
            <option value="1T" ${invoiceQuarterFilter === '1T' ? 'selected' : ''}>1r Trimestre (1T)</option>
            <option value="2T" ${invoiceQuarterFilter === '2T' ? 'selected' : ''}>2n Trimestre (2T)</option>
            <option value="3T" ${invoiceQuarterFilter === '3T' ? 'selected' : ''}>3r Trimestre (3T)</option>
            <option value="4T" ${invoiceQuarterFilter === '4T' ? 'selected' : ''}>4t Trimestre (4T)</option>
          </select>

          <!-- Filtre Estat PDF -->
          <select class="form-select" id="invoice-pdf-filter" style="font-size:0.8rem; padding:4px 8px; background:var(--bg-surface-elevated); color:var(--text-primary); border:1px solid var(--border-default); border-radius:var(--radius-sm);">
            <option value="ALL" ${invoicePdfFilter === 'ALL' ? 'selected' : ''}>Tots els Documents</option>
            <option value="WITH_PDF" ${invoicePdfFilter === 'WITH_PDF' ? 'selected' : ''}>📄 Amb PDF Adjunt</option>
            <option value="WITHOUT_PDF" ${invoicePdfFilter === 'WITHOUT_PDF' ? 'selected' : ''}>⚠️ Sense PDF</option>
          </select>

          <!-- Cercador -->
          <input type="text" id="invoice-search-input" placeholder="🔍 Cercar..." value="${searchQuery}" style="font-size:0.8rem; padding:4px 8px; background:var(--bg-surface-elevated); color:var(--text-primary); border:1px solid var(--border-default); border-radius:var(--radius-sm); width:130px;">

          <!-- Botons d'acció -->
          <button class="btn btn--secondary btn--sm" id="btn-export-current-book" title="Exportar Llibre Registre oficial en CSV">
            📥 Llibre CSV
          </button>
          <button class="btn btn--secondary btn--sm" id="btn-export-inspection-bundle" style="background:var(--bg-surface-elevated); border:1px solid var(--color-primary); color:var(--color-primary);" title="Descarregar paquet complet d'inspecció amb llibres i PDFs">
            📦 Dossier Inspecció AEAT (ZIP)
          </button>
          <button class="btn btn--primary btn--sm" id="btn-open-add-invoice-modal">
            ➕ Afegir Factura
          </button>
        </div>
      </div>

      <!-- Taula de contingut segons la subpestanya -->
      <div class="card" style="padding:0; overflow:hidden;">
        ${activeInvoiceSubTab === 'issued' ? renderIssuedTable(filterQuarter(issued)) : ''}
        ${activeInvoiceSubTab === 'received' ? renderReceivedTable(filterQuarter(received)) : ''}
        ${activeInvoiceSubTab === 'assets' ? renderAssetsTable(assets) : ''}
      </div>
    `;
  }

  function renderIssuedTable(invoices: IVAInvoiceIssued[]): string {
    if (invoices.length === 0) {
      return `
        <div style="padding:var(--space-2xl); text-align:center; color:var(--text-muted);">
          <p style="font-size:1.5rem; margin-bottom:var(--space-xs);">📄</p>
          <p>No hi ha factures emeses registrades amb aquests criteris.</p>
          <button class="btn btn--primary btn--sm" id="btn-empty-add-issued" style="margin-top:var(--space-sm);">➕ Registrar primera factura emesa</button>
        </div>
      `;
    }

    return `
      <div style="overflow-x:auto;">
        <table class="data-table" style="width:100%; font-size:var(--text-xs); border-collapse:collapse;">
          <thead>
            <tr style="background:var(--bg-surface-elevated); border-bottom:1px solid var(--border-default);">
              <th style="padding:10px;">Trimestre</th>
              <th style="padding:10px;">Núm. Factura</th>
              <th style="padding:10px;">Data</th>
              <th style="padding:10px;">Client / NIF</th>
              <th style="padding:10px;">Concepte</th>
              <th style="padding:10px; text-align:right;">Base (€)</th>
              <th style="padding:10px; text-align:right;">IVA</th>
              <th style="padding:10px; text-align:right;">Retenció</th>
              <th style="padding:10px; text-align:right;">Total (€)</th>
              <th style="padding:10px; text-align:center;">PDF AEAT</th>
              <th style="padding:10px; text-align:center;">Accions</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.map(inv => `
              <tr style="border-bottom:1px solid var(--border-subtle);">
                <td style="padding:10px;"><span class="badge badge--sm badge--primary">${inv.quarter}</span></td>
                <td style="padding:10px;"><strong>${inv.invoiceNumber}</strong></td>
                <td style="padding:10px;">${inv.date}</td>
                <td style="padding:10px;">
                  <div>${inv.clientName}</div>
                  <div style="font-size:0.7rem; color:var(--text-muted);">${inv.clientNif}</div>
                </td>
                <td style="padding:10px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${inv.concept}">
                  ${inv.concept}
                </td>
                <td style="padding:10px; text-align:right;">${formatCurrency(inv.taxableBase)}</td>
                <td style="padding:10px; text-align:right;">
                  <div>${inv.vatRate}%</div>
                  <div style="font-size:0.7rem; color:var(--color-primary);">${formatCurrency(inv.vatAmount)}</div>
                </td>
                <td style="padding:10px; text-align:right;">
                  ${inv.withholdingRate ? `${inv.withholdingRate}% (-${formatCurrency(inv.withholdingAmount || 0)})` : '—'}
                </td>
                <td style="padding:10px; text-align:right; font-weight:bold;">${formatCurrency(inv.totalInvoice)}</td>
                <td style="padding:10px; text-align:center;">
                  ${inv.hasAttachment ? `
                    <button class="btn btn--sm btn-manage-pdf" data-id="${inv.id}" data-type="issued" style="font-size:0.7rem; padding:2px 8px; background:var(--color-success); color:#fff; border:none; border-radius:var(--radius-sm); cursor:pointer;" title="${inv.attachmentStandardizedName || 'Documentat'}">
                      📄 Veure PDF
                    </button>
                  ` : `
                    <button class="btn btn--ghost btn--sm btn-manage-pdf" data-id="${inv.id}" data-type="issued" style="font-size:0.7rem; padding:2px 8px; color:var(--color-warning); border:1px dashed var(--color-warning); border-radius:var(--radius-sm); cursor:pointer;" title="Adjuntar PDF oficial">
                      ⚠️ + Adjuntar
                    </button>
                  `}
                </td>
                <td style="padding:10px; text-align:center;">
                  <button class="btn btn--ghost btn--sm btn--icon btn-delete-issued" data-id="${inv.id}" title="Eliminar factura">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderReceivedTable(invoices: IVAInvoiceReceived[]): string {
    if (invoices.length === 0) {
      return `
        <div style="padding:var(--space-2xl); text-align:center; color:var(--text-muted);">
          <p style="font-size:1.5rem; margin-bottom:var(--space-xs);">📑</p>
          <p>No hi ha factures rebudes registrades amb aquests criteris.</p>
          <button class="btn btn--primary btn--sm" id="btn-empty-add-received" style="margin-top:var(--space-sm);">➕ Registrar primera factura rebuda</button>
        </div>
      `;
    }

    return `
      <div style="overflow-x:auto;">
        <table class="data-table" style="width:100%; font-size:var(--text-xs); border-collapse:collapse;">
          <thead>
            <tr style="background:var(--bg-surface-elevated); border-bottom:1px solid var(--border-default);">
              <th style="padding:10px;">Trimestre</th>
              <th style="padding:10px;">Núm. Factura</th>
              <th style="padding:10px;">Data</th>
              <th style="padding:10px;">Proveïdor / NIF</th>
              <th style="padding:10px;">Concepte</th>
              <th style="padding:10px; text-align:right;">Base (€)</th>
              <th style="padding:10px; text-align:right;">IVA Suportat</th>
              <th style="padding:10px; text-align:right;">% Deduc.</th>
              <th style="padding:10px; text-align:right;">IVA Deduïble (€)</th>
              <th style="padding:10px; text-align:right;">Total (€)</th>
              <th style="padding:10px; text-align:center;">PDF AEAT</th>
              <th style="padding:10px; text-align:center;">Accions</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.map(inv => `
              <tr style="border-bottom:1px solid var(--border-subtle);">
                <td style="padding:10px;"><span class="badge badge--sm badge--success">${inv.quarter}</span></td>
                <td style="padding:10px;"><strong>${inv.invoiceNumber}</strong></td>
                <td style="padding:10px;">${inv.date}</td>
                <td style="padding:10px;">
                  <div>${inv.supplierName}</div>
                  <div style="font-size:0.7rem; color:var(--text-muted);">${inv.supplierNif}</div>
                </td>
                <td style="padding:10px; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${inv.concept}">
                  ${inv.concept}
                </td>
                <td style="padding:10px; text-align:right;">${formatCurrency(inv.taxableBase)}</td>
                <td style="padding:10px; text-align:right;">
                  <div>${inv.vatRate}%</div>
                  <div style="font-size:0.7rem; color:var(--text-muted);">${formatCurrency(inv.vatAmount)}</div>
                </td>
                <td style="padding:10px; text-align:right;">${inv.deductiblePercentage ?? 100}%</td>
                <td style="padding:10px; text-align:right; font-weight:bold; color:var(--color-success);">${formatCurrency(inv.deductibleVatAmount)}</td>
                <td style="padding:10px; text-align:right; font-weight:bold;">${formatCurrency(inv.totalInvoice)}</td>
                <td style="padding:10px; text-align:center;">
                  ${inv.hasAttachment ? `
                    <button class="btn btn--sm btn-manage-pdf" data-id="${inv.id}" data-type="received" style="font-size:0.7rem; padding:2px 8px; background:var(--color-success); color:#fff; border:none; border-radius:var(--radius-sm); cursor:pointer;" title="${inv.attachmentStandardizedName || 'Documentat'}">
                      📄 Veure PDF
                    </button>
                  ` : `
                    <button class="btn btn--ghost btn--sm btn-manage-pdf" data-id="${inv.id}" data-type="received" style="font-size:0.7rem; padding:2px 8px; color:var(--color-warning); border:1px dashed var(--color-warning); border-radius:var(--radius-sm); cursor:pointer;" title="Adjuntar PDF oficial">
                      ⚠️ + Adjuntar
                    </button>
                  `}
                </td>
                <td style="padding:10px; text-align:center;">
                  <button class="btn btn--ghost btn--sm btn--icon btn-delete-received" data-id="${inv.id}" title="Eliminar factura">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAssetsTable(assets: IVABienInversion[]): string {
    if (assets.length === 0) {
      return `
        <div style="padding:var(--space-2xl); text-align:center; color:var(--text-muted);">
          <p style="font-size:1.5rem; margin-bottom:var(--space-xs);">🏢</p>
          <p>No hi ha béns d'inversió registrats (Art. 107-110 LIVA).</p>
          <button class="btn btn--primary btn--sm" id="btn-empty-add-asset" style="margin-top:var(--space-sm);">➕ Donar d'alta bé d'inversió</button>
        </div>
      `;
    }

    return `
      <div style="overflow-x:auto;">
        <table class="data-table" style="width:100%; font-size:var(--text-xs); border-collapse:collapse;">
          <thead>
            <tr style="background:var(--bg-surface-elevated); border-bottom:1px solid var(--border-default);">
              <th style="padding:10px;">Descripció del Bé</th>
              <th style="padding:10px;">Tipus</th>
              <th style="padding:10px;">Data Adquisició</th>
              <th style="padding:10px; text-align:right;">Base Imposable (€)</th>
              <th style="padding:10px; text-align:right;">IVA Suportat (€)</th>
              <th style="padding:10px; text-align:right;">Prorrata Inicial</th>
              <th style="padding:10px; text-align:right;">Període Regularització</th>
              <th style="padding:10px; text-align:center;">Estat</th>
              <th style="padding:10px; text-align:center;">Accions</th>
            </tr>
          </thead>
          <tbody>
            ${assets.map(a => `
              <tr style="border-bottom:1px solid var(--border-subtle);">
                <td style="padding:10px;"><strong>${a.description}</strong></td>
                <td style="padding:10px;"><span class="badge badge--sm">${a.assetType}</span></td>
                <td style="padding:10px;">${a.acquisitionDate}</td>
                <td style="padding:10px; text-align:right;">${formatCurrency(a.taxableBase)}</td>
                <td style="padding:10px; text-align:right;">${formatCurrency(a.totalVatPaid)}</td>
                <td style="padding:10px; text-align:right;">${a.initialDeductionPercentage}%</td>
                <td style="padding:10px; text-align:right;">${a.regularizationYears} anys</td>
                <td style="padding:10px; text-align:center;">
                  <span class="badge ${a.status === 'active' ? 'badge--success' : 'badge--muted'}">
                    ${a.status === 'active' ? 'Actiu' : 'Donat de Baixa'}
                  </span>
                </td>
                <td style="padding:10px; text-align:center;">
                  <button class="btn btn--ghost btn--sm btn--icon btn-delete-asset" data-id="${a.id}" title="Eliminar actiu">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────────────────── */
  /* TAB 4: PRORRATA & BÉNS D'INVERSIÓ                           */
  /* ─────────────────────────────────────────────────────────── */
  function renderProrrataTab(ivaData: IVAData): string {
    const p = ivaData.config.prorrata;
    const hasProrrata = ivaData.config.hasProrrata;

    return `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:var(--space-xl); margin-bottom:var(--space-xl);">
        <!-- Targeta 1: Configuració de Prorrata -->
        <div class="card">
          <div class="card__header" style="margin-bottom:var(--space-md);">
            <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
              <span>⚖️ Règim de Prorrata de l'IVA (Art. 102 a 106 LIVA)</span>
            </div>
            <p class="card__subtitle" style="margin:0;">Aplicable quan es realitzen simultàniament operacions amb dret a deducció i operacions exemptes (ex: lloguer d'habitatges).</p>
          </div>

          <div style="display:flex; flex-direction:column; gap:var(--space-md);">
            <div class="form-group">
              <label class="form-label" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="chk-has-prorrata" ${hasProrrata ? 'checked' : ''}>
                <span>Activar aplicació de la Regla de Prorrata a l'IVA deduïble</span>
              </label>
            </div>

            <div class="form-group">
              <label class="form-label">Modalitat de Prorrata</label>
              <select class="form-select" id="sel-prorrata-type" ${!hasProrrata ? 'disabled' : ''}>
                <option value="general" ${p.type === 'general' ? 'selected' : ''}>Prorrata General (Art. 104 LIVA)</option>
                <option value="special" ${p.type === 'special' ? 'selected' : ''}>Prorrata Especial (Art. 106 LIVA - Sectors diferenciats)</option>
              </select>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-md);">
              <div class="form-group">
                <label class="form-label">% Provisional (1T-3T)</label>
                <input type="number" class="form-input" id="input-prorrata-prov" value="${p.provisionalPercentage}" min="0" max="100" ${!hasProrrata ? 'disabled' : ''}>
              </div>
              <div class="form-group">
                <label class="form-label">% Definitiu (Tancament 4T)</label>
                <input type="number" class="form-input" id="input-prorrata-def" value="${p.definitivePercentage}" min="0" max="100" ${!hasProrrata ? 'disabled' : ''}>
              </div>
            </div>

            <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); font-size:var(--text-xs); border:1px solid var(--border-default);">
              <div style="font-weight:bold; margin-bottom:4px;">Càlcul oficial segons el volum d'operacions:</div>
              <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                <span>Operacions amb dret a deducció:</span>
                <strong>${formatCurrency(p.totalOperationsWithDeduction)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>Volum total d'operacions:</span>
                <strong>${formatCurrency(p.totalOperationsVolume)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border-subtle); padding-top:4px; font-weight:bold;">
                <span>Percentatge calculat (Art. 104):</span>
                <span class="text-primary">${p.definitivePercentage}%</span>
              </div>
            </div>

            <button class="btn btn--secondary btn--sm" id="btn-recalc-prorrata" ${!hasProrrata ? 'disabled' : ''}>
              ⚡ Auto-calcular Prorrata des de les Factures
            </button>
          </div>
        </div>

        <!-- Targeta 2: Regularització de Béns d'Inversió -->
        <div class="card">
          <div class="card__header" style="margin-bottom:var(--space-md);">
            <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
              <span>🏢 Regularització Multianual de Béns d'Inversió (Art. 107-110 LIVA)</span>
            </div>
            <p class="card__subtitle" style="margin:0;">Obligació de regularitzar la deducció inicial si la prorrata varia en més de 10 punts (5 anys per mobles, 10 anys per immobles).</p>
          </div>

          <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-bottom:var(--space-md);">
            <p style="margin-bottom:var(--space-xs);">
              Els béns d'inversió amb un valor d'adquisició superior a 3.005,06 € estan subjectes a seguiment durant 5 o 10 anys naturals.
            </p>
            <div style="background:var(--bg-surface-elevated); padding:var(--space-sm); border-radius:var(--radius-sm); border-left:3px solid var(--color-info);">
              ℹ️ Qualsevol ajust anual resultant s'imputa directament a la <strong>Casella 43</strong> de la liquidació del 4t Trimestre (Model 303).
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>Actius en seguiment: <strong>${ivaData.investmentAssets.length}</strong></span>
            <button class="btn btn--primary btn--sm" id="btn-add-asset-from-prorrata">
              ➕ Afegir Bé d'Inversió
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────────────────── */
  /* TAB 5: VINCULACIÓ & SINCRONITZACIÓ INTEL·LIGENT             */
  /* ─────────────────────────────────────────────────────────── */
  function renderSyncTab(ivaData: IVAData): string {
    const data = store.getData();
    const act = data.activities || { income: 0, expenses: 0, withholdings: 0 };
    const propCount = (data.properties || []).length;
    const commercialProps = (data.properties || []).filter(p => p.usageType === 'commercial' || p.name?.toLowerCase().includes('local'));

    return `
      <div style="margin-bottom:var(--space-xl);">
        <h2 style="font-size:var(--text-lg); margin-bottom:var(--space-xs);">🔄 Panell de Sincronització Bidireccional</h2>
        <p style="color:var(--text-secondary); font-size:var(--text-sm); margin:0;">
          Enllaça i quadra en temps real la gestió de l'IVA amb el Rendiment d'Activitats Econòmiques (IRPF) i la Cartera d'Immobles en Lloguer.
        </p>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:var(--space-xl);">
        <!-- 1. Activitats Econòmiques (Autònoms) -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; border-top:4px solid var(--color-primary);">
          <div>
            <div style="display:flex; align-items:center; gap:var(--space-xs); margin-bottom:var(--space-sm);">
              <span style="font-size:1.3rem;">🏢</span>
              <h3 style="margin:0; font-size:var(--text-base);">Activitats Econòmiques (Autònoms)</h3>
            </div>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:var(--space-md);">
              Sincronitza els ingressos i despeses d'autònoms amb les factures emeses i rebudes del Model 303.
            </p>

            <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); font-size:var(--text-xs); margin-bottom:var(--space-md);">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-muted);">Ingressos IRPF declarats:</span>
                <strong>${formatCurrency(act.income)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-muted);">Despeses IRPF declarades:</span>
                <strong>${formatCurrency(act.expenses)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-muted);">Retencions IRPF facturades:</span>
                <strong>${formatCurrency(act.withholdings)}</strong>
              </div>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:var(--space-xs);">
            <button class="btn btn--primary btn--sm" id="btn-sync-act-to-iva" style="width:100%;">
              📥 Sincronitzar cap a l'IVA (Generar Factures)
            </button>
            <button class="btn btn--secondary btn--sm" id="btn-sync-iva-to-act" style="width:100%;">
              📤 Actualitzar IRPF des del Llibre d'IVA
            </button>
          </div>
        </div>

        <!-- 2. Immobles en Lloguer & Arrendaments -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; border-top:4px solid var(--color-success);">
          <div>
            <div style="display:flex; align-items:center; gap:var(--space-xs); margin-bottom:var(--space-sm);">
              <span style="font-size:1.3rem;">🏠</span>
              <h3 style="margin:0; font-size:var(--text-base);">Immobles en Lloguer & Locals</h3>
            </div>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:var(--space-md);">
              Detecta locals comercials (IVA 21% + Retenció 19%) i lloguers d'habitatge per a la fórmula de prorrata.
            </p>

            <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); font-size:var(--text-xs); margin-bottom:var(--space-md);">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-muted);">Total Immobles a la Cartera:</span>
                <strong>${propCount}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-muted);">Locals Comercials / Us Terciari:</span>
                <strong class="text-primary">${commercialProps.length}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-muted);">Inventari d'Actius vinculats:</span>
                <strong>${ivaData.investmentAssets.filter(a => a.linkedPropertyId).length}</strong>
              </div>
            </div>
          </div>

          <button class="btn btn--success btn--sm" id="btn-sync-props-to-iva" style="width:100%;">
            🏠 Auto-generar Factures de Lloguer i Prorrata
          </button>
        </div>

        <!-- 3. Gestió Patrimonial (Model 714) -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; border-top:4px solid var(--color-warning);">
          <div>
            <div style="display:flex; align-items:center; gap:var(--space-xs); margin-bottom:var(--space-sm);">
              <span style="font-size:1.3rem;">🏰</span>
              <h3 style="margin:0; font-size:var(--text-base);">Gestió Patrimonial & Deutes Fiscals</h3>
            </div>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:var(--space-md);">
              Integra les quotes pendents de liquidació d'IVA com a deutes deduïbles o crèdits a l'Impost sobre el Patrimoni.
            </p>

            <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); font-size:var(--text-xs); margin-bottom:var(--space-md);">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-muted);">Béns d'Inversió registrats:</span>
                <strong>${ivaData.investmentAssets.length}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-muted);">Saldo Final Liquidació IVA:</span>
                <strong class="${ivaData.quarters['4T'].resultadoLiquidacion > 0 ? 'text-warning' : 'text-success'}">
                  ${formatCurrency(ivaData.quarters['4T'].resultadoLiquidacion)}
                </strong>
              </div>
            </div>
          </div>

          <button class="btn btn--secondary btn--sm" id="btn-sync-wealth-info" style="width:100%;">
            🏰 Verificar Coherència amb Patrimoni (714)
          </button>
        </div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────────────────── */
  /* TAB 6: RESUM ANUAL MODEL 390 & MODEL 349                    */
  /* ─────────────────────────────────────────────────────────── */
  function renderModel390Tab(model390: Model390AnnualSummary, model349: Model349Entry[], year: number): string {
    return `
      <!-- Targeta Model 390 -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="margin-bottom:var(--space-md); border-bottom:1px solid var(--border-default); padding-bottom:var(--space-md);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
            <div>
              <h2 style="margin:0; font-size:var(--text-lg);">📑 Model 390 — Declaració Resum Anual d'IVA (${year})</h2>
              <p class="card__subtitle" style="margin:4px 0 0 0;">Consolidació anual i comprovació d'encreuament amb els 4 trimestres del Model 303</p>
            </div>
            <span class="badge ${model390.quartersReconciliation.isBalanced ? 'badge--success' : 'badge--error'}" style="padding:6px 12px; font-size:0.85rem;">
              ${model390.quartersReconciliation.isBalanced ? '✅ Cuadre 303 vs 390 Correcte' : '⚠️ Desquadre detectat'}
            </span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-lg);">
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md);">
            <div style="color:var(--text-muted); font-size:var(--text-xs);">Volum Total d'Operacions</div>
            <div style="font-size:var(--text-lg); font-weight:bold; color:var(--text-primary);">${formatCurrency(model390.totalVolumeOperations)}</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md);">
            <div style="color:var(--text-muted); font-size:var(--text-xs);">Total IVA Devengat Anual</div>
            <div style="font-size:var(--text-lg); font-weight:bold; color:var(--color-primary);">${formatCurrency(model390.totalDevengado)}</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md);">
            <div style="color:var(--text-muted); font-size:var(--text-xs);">Total IVA Deduïble Anual</div>
            <div style="font-size:var(--text-lg); font-weight:bold; color:var(--color-success);">${formatCurrency(model390.totalDeducible)}</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md);">
            <div style="color:var(--text-muted); font-size:var(--text-xs);">Resultat Anual Acumulat</div>
            <div style="font-size:var(--text-lg); font-weight:bold; color:${model390.totalAnnualResult > 0 ? 'var(--color-warning)' : 'var(--color-success)'};">
              ${formatCurrency(model390.totalAnnualResult)}
            </div>
          </div>
        </div>

        <!-- Comparativa de Prorrata General vs Especial (Art. 103 LIVA) -->
        ${model390.prorrataComparison ? `
          <div style="background:var(--bg-surface-elevated); border:1px solid ${model390.prorrataComparison.isSpecialProrrataMandatoryByLaw ? 'var(--color-error)' : 'var(--border-default)'}; border-radius:var(--radius-md); padding:var(--space-md); margin-bottom:var(--space-lg);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-xs); margin-bottom:var(--space-sm);">
              <div style="font-weight:700; font-size:var(--text-sm); display:flex; align-items:center; gap:6px;">
                <span>⚖️ Blindatge de Prorrata: General vs Especial (Art. 103.Dos.1r LIVA)</span>
              </div>
              <span class="badge ${model390.prorrataComparison.isSpecialProrrataMandatoryByLaw ? 'badge--error' : 'badge--success'}">
                ${model390.prorrataComparison.isSpecialProrrataMandatoryByLaw ? '⚠️ Prorrata Especial OBLIGATÒRIA (>10%)' : '✓ Modalitat Correcta'}
              </span>
            </div>
            
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-sm); font-size:var(--text-xs); margin-bottom:var(--space-xs);">
              <div>Deducció Prorrata General: <strong>${formatCurrency(model390.prorrataComparison.generalDeductionAmount)}</strong></div>
              <div>Deducció Prorrata Especial: <strong>${formatCurrency(model390.prorrataComparison.specialDeductionAmount)}</strong></div>
              <div>Desviació: <strong class="${model390.prorrataComparison.isSpecialProrrataMandatoryByLaw ? 'text-error' : 'text-primary'}">${model390.prorrataComparison.divergencePercentage}%</strong></div>
              <div>Règim Recomanat: <strong>${model390.prorrataComparison.recommendedRegime === 'special' ? 'Prorrata Especial' : 'Prorrata General'}</strong></div>
            </div>

            ${model390.prorrataComparison.warningMessage ? `
              <div style="margin-top:var(--space-xs); padding:var(--space-xs) var(--space-sm); background:rgba(239, 68, 68, 0.1); border-left:3px solid var(--color-error); font-size:var(--text-xs); color:var(--color-error); border-radius:4px;">
                ${model390.prorrataComparison.warningMessage}
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Targeta Model 349 -->
      <div class="card">
        <div class="card__header" style="margin-bottom:var(--space-md);">
          <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
            <span>🌍 Model 349 — Declaració Recapitulativa d'Operacions Intracomunitàries</span>
            <span class="badge badge--info">${model349.length} Operadors VIES</span>
          </div>
          <p class="card__subtitle" style="margin:0;">Lliuraments i adquisicions de béns i serveis amb operadors de la Unió Europea</p>
        </div>

        ${model349.length === 0 ? `
          <p style="color:var(--text-muted); font-size:var(--text-sm); margin:0;">No s'han registrat operacions intracomunitàries durant l'exercici.</p>
        ` : `
          <div style="overflow-x:auto;">
            <table class="data-table" style="width:100%; font-size:var(--text-xs);">
              <thead>
                <tr>
                  <th>País</th>
                  <th>NIF-IVA (VIES)</th>
                  <th>Operador / Raó Social</th>
                  <th>Clau d'Operació</th>
                  <th style="text-align:right;">Base Imposable (€)</th>
                </tr>
              </thead>
              <tbody>
                ${model349.map(m => `
                  <tr>
                    <td><strong>${m.countryCode}</strong></td>
                    <td>${m.operatorNif}</td>
                    <td>${m.operatorName}</td>
                    <td><span class="badge badge--sm">${m.key === 'E' ? 'E (Lliurament Béns)' : (m.key === 'A' ? 'A (Adquisició Béns)' : m.key)}</span></td>
                    <td style="text-align:right; font-weight:bold;">${formatCurrency(m.taxableBase)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  /* ─────────────────────────────────────────────────────────── */
  /* GESTIÓ D'EVENTS I MODALS INTERACTIUS                        */
  /* ─────────────────────────────────────────────────────────── */
  function bindEvents(ivaData: IVAData, quarters: Record<FiscalQuarter, any>, year: number) {
    // 0. Selector d'Any Fiscal i Trimestre de Capçalera
    page.querySelector('#btn-open-iva-compliance')?.addEventListener('click', () => {
      openComplianceModal(() => {
        render();
      });
    });

    const yearSel = page.querySelector<HTMLSelectElement>('#iva-year-selector');
    if (yearSel) {
      yearSel.addEventListener('change', () => {
        const newYear = parseInt(yearSel.value, 10) as FiscalYear;
        store.setYear(newYear);
        showToast(`Canviat a l'Exercici Fiscal ${newYear}`, 'info');
      });
    }

    page.querySelectorAll('.btn-header-quarter').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = ((btn as HTMLElement).dataset.quarter as FiscalQuarter | 'ALL') || 'ALL';
        selectedPeriodFilter = q;
        if (q !== 'ALL') {
          active303Quarter = q;
          invoiceQuarterFilter = q;
        } else {
          invoiceQuarterFilter = 'ALL';
        }
        render();
      });
    });

    // 1. Canvi de pestanya principal
    page.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = ((btn as HTMLElement).dataset.tab as typeof activeTab) || 'overview';
        render();
      });
    });

    // 2. Canvi de trimestre en la vista 303
    page.querySelectorAll('.btn-select-303-quarter, .btn-view-quarter').forEach(btn => {
      btn.addEventListener('click', () => {
        active303Quarter = (btn as HTMLElement).dataset.quarter as FiscalQuarter;
        activeTab = 'model303';
        render();
      });
    });

    // 2.1. Complementària Model 303
    page.querySelector('#btn-toggle-303-complementary')?.addEventListener('click', () => {
      const curQ = quarters[active303Quarter];
      const isCurrentlyComp = !!curQ.isComplementary;
      store.updateQuarterComplementary(active303Quarter, {
        isComplementary: !isCurrentlyComp,
        previousReceiptNumber: curQ.previousReceiptNumber || '',
        previousResultIngressat: curQ.previousResultIngressat || 0,
        extemporaneousMonths: curQ.extemporaneousMonths || 0,
      });
      showToast(isCurrentlyComp ? `Declaració ordinària del ${active303Quarter} restaurada` : `Autoliquidació Complementària del ${active303Quarter} activada`, 'info');
      render();
    });

    page.querySelector('#comp-303-receipt')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      store.updateQuarterComplementary(active303Quarter, { previousReceiptNumber: target.value });
    });

    page.querySelector('#comp-303-prev-ingressat')?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      store.updateQuarterComplementary(active303Quarter, { previousResultIngressat: parseFloat(target.value) || 0 });
      render();
    });

    page.querySelector('#comp-303-months-late')?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      store.updateQuarterComplementary(active303Quarter, { extemporaneousMonths: parseInt(target.value, 10) || 0 });
      render();
    });

    // 3. Canvi de subpestanya de factures
    page.querySelectorAll('.btn-invoice-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeInvoiceSubTab = ((btn as HTMLElement).dataset.subtab as typeof activeInvoiceSubTab) || 'issued';
        render();
      });
    });

    // 4. Filtre de trimestre, estat PDF i cerca
    const qFilter = page.querySelector<HTMLSelectElement>('#invoice-quarter-filter');
    if (qFilter) {
      qFilter.addEventListener('change', () => {
        invoiceQuarterFilter = (qFilter.value as typeof invoiceQuarterFilter) || 'ALL';
        render();
      });
    }

    const pFilter = page.querySelector<HTMLSelectElement>('#invoice-pdf-filter');
    if (pFilter) {
      pFilter.addEventListener('change', () => {
        invoicePdfFilter = (pFilter.value as typeof invoicePdfFilter) || 'ALL';
        render();
      });
    }

    const sInput = page.querySelector<HTMLInputElement>('#invoice-search-input');
    if (sInput) {
      sInput.addEventListener('input', () => {
        searchQuery = sInput.value;
        render();
      });
    }

    // 5. Botons d'exportació CSV i Dossier d'Inspecció AEAT
    page.querySelector('#btn-export-current-book')?.addEventListener('click', () => {
      if (activeInvoiceSubTab === 'issued') {
        exportIssuedInvoicesCSV(ivaData.issuedInvoices);
        showToast('Llibre de Factures Expedides exportat correctament', 'success');
      } else if (activeInvoiceSubTab === 'received') {
        exportReceivedInvoicesCSV(ivaData.receivedInvoices);
        showToast('Llibre de Factures Rebudes exportat correctament', 'success');
      } else {
        exportInvestmentAssetsCSV(ivaData.investmentAssets);
        showToast('Llibre de Béns d\'Inversió exportat correctament', 'success');
      }
    });

    page.querySelector('#btn-export-inspection-bundle')?.addEventListener('click', async () => {
      showToast('Preparant dossier d\'inspecció AEAT...', 'info');
      try {
        const res = await generateAndDownloadInspectionPackage(ivaData, year, store.getActiveProfile().name, (msg) => {
          showToast(msg, 'info');
        });
        showToast(`Dossier d'Inspecció AEAT descarregat (${res.totalFiles} fitxers, ${res.totalSizeMB} MB)`, 'success');
      } catch (err) {
        showToast('Error en generar el paquet: ' + String(err), 'error');
      }
    });

    page.querySelector('#btn-export-303-csv')?.addEventListener('click', () => {
      exportModel303SummaryCSV(quarters[active303Quarter], year);
      showToast(`Resum oficial Model 303 (${active303Quarter}) exportat`, 'success');
    });

    // 5.1 Obertura del Modal de Gestió de Document PDF Oficial
    page.querySelectorAll('.btn-manage-pdf').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id!;
        const docType = (e.currentTarget as HTMLElement).dataset.type as 'issued' | 'received';
        const inv = docType === 'issued'
          ? ivaData.issuedInvoices.find(i => i.id === id)
          : ivaData.receivedInvoices.find(i => i.id === id);
        if (inv) {
          openInvoiceDocumentModal(inv, docType, year, () => render());
        }
      });
    });

    // 6. Botons d'obertura de modal per afegir factura
    page.querySelector('#btn-add-invoice-header')?.addEventListener('click', () => openAddInvoiceModal());
    page.querySelector('#btn-open-add-invoice-modal')?.addEventListener('click', () => openAddInvoiceModal());
    page.querySelector('#btn-empty-add-issued')?.addEventListener('click', () => openAddInvoiceModal('issued'));
    page.querySelector('#btn-empty-add-received')?.addEventListener('click', () => openAddInvoiceModal('received'));
    page.querySelector('#btn-empty-add-asset')?.addEventListener('click', () => openAddAssetModal());
    page.querySelector('#btn-add-asset-from-prorrata')?.addEventListener('click', () => openAddAssetModal());

    // 7. Eliminació de factures / actius
    page.querySelectorAll('.btn-delete-issued').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id!;
        if (confirm('Segur que vols eliminar aquesta factura emesa?')) {
          store.deleteIssuedInvoice(id);
          showToast('Factura emesa eliminada', 'info');
          render();
        }
      });
    });

    page.querySelectorAll('.btn-delete-received').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id!;
        if (confirm('Segur que vols eliminar aquesta factura rebuda?')) {
          store.deleteReceivedInvoice(id);
          showToast('Factura rebuda eliminada', 'info');
          render();
        }
      });
    });

    page.querySelectorAll('.btn-delete-asset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id!;
        if (confirm('Segur que vols eliminar aquest bé d\'inversió?')) {
          store.deleteInvestmentAsset(id);
          showToast('Bé d\'inversió eliminat', 'info');
          render();
        }
      });
    });

    // 8. Sincronitzacions
    page.querySelector('#btn-quick-sync')?.addEventListener('click', () => {
      activeTab = 'sync';
      render();
    });

    page.querySelector('#btn-sync-act-to-iva')?.addEventListener('click', () => {
      const res = store.syncIVAFromActivities();
      showToast(`Sincronitzat amb èxit: +${res.addedIssued} factures emeses i +${res.addedReceived} factures rebudes creades`, 'success');
      render();
    });

    page.querySelector('#btn-sync-iva-to-act')?.addEventListener('click', () => {
      store.syncActivitiesFromIVA();
      showToast('Ingressos i despeses del mòdul d\'Activitats (IRPF) actualitzats des del Llibre d\'IVA', 'success');
      render();
    });

    page.querySelector('#btn-sync-props-to-iva')?.addEventListener('click', () => {
      const res = store.syncIVAFromProperties();
      showToast(`Immobles sincronitzats: +${res.addedCommercialRentals} factures comercials, +${res.addedTouristRentals} turístiques, +${res.addedExemptRentals} habitatge`, 'success');
      render();
    });

    page.querySelector('#btn-sync-wealth-info')?.addEventListener('click', () => {
      const q4 = quarters['4T'];
      showToast(`🏰 Patrimoni: ${ivaData.investmentAssets.length} béns d'inversió. Saldo IVA 4T: ${formatCurrency(q4.resultadoLiquidacion)} (${q4.resultadoLiquidacion > 0 ? 'Deute deduïble' : 'Crèdit computable'})`, 'info');
    });

    // 9. Controls de Prorrata
    const chkProrrata = page.querySelector<HTMLInputElement>('#chk-has-prorrata');
    if (chkProrrata) {
      chkProrrata.addEventListener('change', () => {
        store.updateIVA({
          config: {
            ...ivaData.config,
            hasProrrata: chkProrrata.checked,
          }
        });
        render();
      });
    }

    const selProrrataType = page.querySelector<HTMLSelectElement>('#sel-prorrata-type');
    if (selProrrataType) {
      selProrrataType.addEventListener('change', () => {
        store.updateIVA({
          config: {
            ...ivaData.config,
            prorrata: {
              ...ivaData.config.prorrata,
              type: (selProrrataType.value as 'general' | 'special') || 'general',
            }
          }
        });
        render();
      });
    }

    page.querySelector('#btn-recalc-prorrata')?.addEventListener('click', () => {
      store.updateIVA({
        config: {
          ...ivaData.config,
          prorrata: {
            ...ivaData.config.prorrata,
            isRegulatedAutomatically: true,
          }
        }
      });
      showToast('Percentatges de prorrata recalculats automàticament des de les factures', 'success');
      render();
    });
  }

  /* ─────────────────────────────────────────────────────────── */
  /* MODAL D'ALTA / EDICIÓ DE FACTURA                            */
  /* ─────────────────────────────────────────────────────────── */
  /* ─────────────────────────────────────────────────────────── */
  /* MODAL D'ALTA / EDICIÓ DE FACTURA AMB VALIDACIÓ PREVIA       */
  /* ─────────────────────────────────────────────────────────── */
  function openAddInvoiceModal(defaultType: 'issued' | 'received' = activeInvoiceSubTab === 'received' ? 'received' : 'issued') {
    const existingModal = document.getElementById('iva-invoice-modal');
    if (existingModal) existingModal.remove();

    const year = store.getYear() || 2024;
    const modal = document.createElement('div');
    modal.id = 'iva-invoice-modal';
    modal.className = 'modal-backdrop';
    modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.75); display:flex; justify-content:center; align-items:center; z-index:10000; padding:var(--space-md);';

    let currentType = defaultType;

    modal.innerHTML = `
      <div class="modal-content card" style="max-width:640px; width:100%; max-height:92vh; overflow-y:auto; background:var(--modal-bg); border:1px solid var(--border-default); border-radius:var(--radius-lg); padding:var(--space-xl); box-shadow:var(--shadow-lg);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-lg); border-bottom:1px solid var(--border-default); padding-bottom:var(--space-sm);">
          <div>
            <h3 style="margin:0; font-size:var(--text-lg);" id="modal-title">➕ Nova Factura Oficial</h3>
            <p style="margin:2px 0 0 0; font-size:0.75rem; color:var(--text-secondary);">Validació prèvia automàtica per al Llibre Registre de l'AEAT</p>
          </div>
          <button class="btn btn--ghost btn--sm btn--icon" id="btn-close-modal" style="font-size:1.2rem;">✕</button>
        </div>

        <div style="display:flex; gap:var(--space-sm); margin-bottom:var(--space-lg);">
          <button class="btn ${currentType === 'issued' ? 'btn--primary' : 'btn--secondary'} btn--sm" id="btn-modal-type-issued" style="flex:1;">
            📤 Factura Emesa (Vendes/Ingressos)
          </button>
          <button class="btn ${currentType === 'received' ? 'btn--primary' : 'btn--secondary'} btn--sm" id="btn-modal-type-received" style="flex:1;">
            📥 Factura Rebuda (Compres/Despeses)
          </button>
        </div>

        <form id="iva-invoice-form" style="display:flex; flex-direction:column; gap:var(--space-md);">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-md);">
            <div class="form-group">
              <label class="form-label" for="inv-quarter">Trimestre Fiscal</label>
              <select class="form-select" id="inv-quarter" required>
                <option value="1T">1r Trimestre (1T - Gen/Feb/Mar)</option>
                <option value="2T">2n Trimestre (2T - Abr/Mai/Jun)</option>
                <option value="3T">3r Trimestre (3T - Jul/Ago/Set)</option>
                <option value="4T">4t Trimestre (4T - Oct/Nov/Des)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="inv-date">Data d'Emissió</label>
              <input type="date" class="form-input" id="inv-date" value="${year}-03-15" required>
              <span id="date-match-hint" style="font-size:0.7rem; color:var(--text-muted); display:block; margin-top:2px;"></span>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-md);">
            <div class="form-group">
              <label class="form-label" for="inv-number">Número de Factura</label>
              <input type="text" class="form-input" id="inv-number" placeholder="Ex: FAC-${year}-001" required>
              <span id="inv-number-warning" style="font-size:0.7rem; color:var(--color-danger); display:none; margin-top:2px;"></span>
            </div>
            <div class="form-group">
              <label class="form-label" for="inv-category">Categoria d'Operació</label>
              <select class="form-select" id="inv-category">
                <option value="activity_service">Activitat Professional / Serveis</option>
                <option value="activity_goods">Venda de Béns / Mercaderies</option>
                <option value="property_commercial_rental">Arrendament Local / Terciari (IVA 21% + Ret. 19%)</option>
                <option value="property_tourist_rental">Lloguer Turístic amb Serveis (IVA 10%)</option>
                <option value="property_exempt_rental">Lloguer Habitatge Habitual (Exempt Art. 20)</option>
                <option value="activity_expense">Despesa d'Explotació Corrent</option>
                <option value="investment_asset">Bé d'Inversió (> 3.005,06 €)</option>
                <option value="intra_eu_delivery">Lliurament Intracomunitari UE</option>
                <option value="intra_eu_acquisition">Adquisició Intracomunitària UE</option>
              </select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:2fr 1fr; gap:var(--space-md);">
            <div class="form-group">
              <label class="form-label" for="inv-party-name" id="label-party-name">Nom / Raó Social del Client</label>
              <input type="text" class="form-input" id="inv-party-name" placeholder="Ex: Client Principal SL" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="inv-party-nif">NIF / CIF</label>
              <input type="text" class="form-input" id="inv-party-nif" placeholder="Ex: B12345678" required>
              <span id="nif-validation-hint" style="font-size:0.7rem; display:block; margin-top:2px;"></span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="inv-concept">Concepte o Descripció de l'Operació</label>
            <input type="text" class="form-input" id="inv-concept" placeholder="Ex: Serveis de consultoria tècnica" required>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-md);">
            <div class="form-group">
              <label class="form-label" for="inv-payment-method">Mètode de Pagament / Cobrament</label>
              <select class="form-select" id="inv-payment-method">
                <option value="transfer">Transferència Bancària</option>
                <option value="direct_debit">Domiciliació Bancària</option>
                <option value="card">Targeta</option>
                <option value="cash">Efectiu (Límit legal 1.000 €)</option>
                <option value="check">Xec Bancari</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="inv-file-upload">📎 PDF Original de la Factura (AEAT)</label>
              <input type="file" class="form-input" id="inv-file-upload" accept=".pdf,image/jpeg,image/png" style="font-size:0.75rem; padding:4px;">
            </div>
          </div>

          <div id="cash-warning-box" style="display:none; background:rgba(239, 68, 68, 0.15); border:1px solid var(--color-danger); border-radius:var(--radius-sm); padding:8px 12px; font-size:0.75rem; color:var(--color-danger);">
            ⛔ <strong>Alerta Llei Antifrau:</strong> L'Art. 7 de la Llei 11/2021 prohibeix cobraments o pagaments en efectiu > 1.000 € entre professionals o societats (Sanció del 25%).
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:var(--space-md); background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div class="form-group">
              <label class="form-label" for="inv-base">Base Imposable (€)</label>
              <input type="number" step="0.01" class="form-input" id="inv-base" placeholder="0,00" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="inv-vat-rate">Tipus IVA (%)</label>
              <select class="form-select" id="inv-vat-rate">
                <option value="21">21% (General)</option>
                <option value="10">10% (Reduït)</option>
                <option value="4">4% (Superreduït)</option>
                <option value="2">2% (Transitori)</option>
                <option value="0">0% (Exempt / ISP)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="inv-withholding">Retenció IRPF (%)</label>
              <select class="form-select" id="inv-withholding">
                <option value="0">0%</option>
                <option value="15">15% (Professional)</option>
                <option value="19">19% (Arrendament Local)</option>
                <option value="7">7% (Nous autònoms)</option>
              </select>
            </div>
          </div>

          <!-- Total i càlculs fiscals en temps real -->
          <div style="display:flex; justify-content:space-between; align-items:center; padding:var(--space-sm) var(--space-md); background:var(--bg-surface); border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
            <div>
              <span style="font-size:0.75rem; color:var(--text-muted);">Desglossament:</span>
              <span style="font-size:0.75rem; font-family:monospace; margin-left:6px;" id="inv-calc-breakdown">0,00 € + 0,00 € IVA = 0,00 €</span>
            </div>
            <div style="text-align:right;">
              <span style="font-size:var(--text-xs); color:var(--text-muted); display:block;">Total Factura:</span>
              <strong style="font-size:var(--text-lg); color:var(--color-primary);" id="inv-calc-total">0,00 €</strong>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:var(--space-sm); margin-top:var(--space-md);">
            <button type="button" class="btn btn--secondary" id="btn-cancel-modal">Cancel·lar</button>
            <button type="submit" class="btn btn--primary" id="btn-save-invoice">💾 Validar i Guardar Factura</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector<HTMLFormElement>('#iva-invoice-form')!;
    const baseInput = modal.querySelector<HTMLInputElement>('#inv-base')!;
    const vatRateSelect = modal.querySelector<HTMLSelectElement>('#inv-vat-rate')!;
    const withhSelect = modal.querySelector<HTMLSelectElement>('#inv-withholding')!;
    const totalDisplay = modal.querySelector<HTMLElement>('#inv-calc-total')!;
    const breakdownDisplay = modal.querySelector<HTMLElement>('#inv-calc-breakdown')!;
    const partyLabel = modal.querySelector<HTMLLabelElement>('#label-party-name')!;
    const partyNifInput = modal.querySelector<HTMLInputElement>('#inv-party-nif')!;
    const nifHint = modal.querySelector<HTMLElement>('#nif-validation-hint')!;
    const dateInput = modal.querySelector<HTMLInputElement>('#inv-date')!;
    const quarterSelect = modal.querySelector<HTMLSelectElement>('#inv-quarter')!;
    const dateHint = modal.querySelector<HTMLElement>('#date-match-hint')!;
    const paymentMethodSelect = modal.querySelector<HTMLSelectElement>('#inv-payment-method')!;
    const cashWarningBox = modal.querySelector<HTMLElement>('#cash-warning-box')!;
    const numberInput = modal.querySelector<HTMLInputElement>('#inv-number')!;
    const numberWarning = modal.querySelector<HTMLElement>('#inv-number-warning')!;

    function recalcModalTotal() {
      const b = parseFloat(baseInput.value) || 0;
      const vRate = parseFloat(vatRateSelect.value) || 0;
      const wRate = parseFloat(withhSelect.value) || 0;

      const vatAmount = Math.round(b * (vRate / 100) * 100) / 100;
      const withhAmount = Math.round(b * (wRate / 100) * 100) / 100;
      const total = currentType === 'issued' ? (b + vatAmount - withhAmount) : (b + vatAmount);

      totalDisplay.textContent = formatCurrency(total);
      breakdownDisplay.textContent = `${formatCurrency(b)} + ${formatCurrency(vatAmount)} IVA ${withhAmount > 0 ? `- ${formatCurrency(withhAmount)} Ret.` : ''}`;

      if (paymentMethodSelect.value === 'cash' && total > 1000) {
        cashWarningBox.style.display = 'block';
      } else {
        cashWarningBox.style.display = 'none';
      }
    }

    // Live NIF validation
    function validateNifInput() {
      const val = partyNifInput.value.trim();
      if (!val) {
        nifHint.textContent = '';
        return;
      }
      const isValid = isValidSpanishTaxId(val);
      if (isValid) {
        nifHint.textContent = '🟢 NIF/CIF vàlid (AEAT)';
        nifHint.style.color = 'var(--color-success)';
      } else {
        nifHint.textContent = '🔴 Format o dígit de control no vàlid';
        nifHint.style.color = 'var(--color-danger)';
      }
    }

    // Live Date & Quarter synchronization
    function validateDateQuarter() {
      const d = dateInput.value;
      if (!d) return;
      const month = parseInt(d.split('-')[1], 10);
      let expectedQ: FiscalQuarter = '1T';
      if (month >= 1 && month <= 3) expectedQ = '1T';
      else if (month >= 4 && month <= 6) expectedQ = '2T';
      else if (month >= 7 && month <= 9) expectedQ = '3T';
      else if (month >= 10 && month <= 12) expectedQ = '4T';

      if (quarterSelect.value !== expectedQ) {
        dateHint.textContent = `💡 La data correspon al ${expectedQ}. Ajustat automàticament.`;
        dateHint.style.color = 'var(--color-primary)';
        quarterSelect.value = expectedQ;
      } else {
        dateHint.textContent = `✓ Data alineada amb el ${quarterSelect.value}`;
        dateHint.style.color = 'var(--text-muted)';
      }
    }

    // Live Invoice Number duplicate check
    function validateNumberDuplicate() {
      const num = numberInput.value.trim();
      if (!num) {
        numberWarning.style.display = 'none';
        return;
      }
      const iva = store.getIVA();
      const isDup = currentType === 'issued'
        ? iva.issuedInvoices.some(i => i.invoiceNumber.trim().toLowerCase() === num.toLowerCase())
        : false;

      if (isDup) {
        numberWarning.textContent = `⚠️ Ja existeix una factura amb el número ${num}`;
        numberWarning.style.display = 'block';
      } else {
        numberWarning.style.display = 'none';
      }
    }

    baseInput.addEventListener('input', recalcModalTotal);
    vatRateSelect.addEventListener('change', recalcModalTotal);
    withhSelect.addEventListener('change', recalcModalTotal);
    paymentMethodSelect.addEventListener('change', recalcModalTotal);
    partyNifInput.addEventListener('input', validateNifInput);
    dateInput.addEventListener('change', validateDateQuarter);
    numberInput.addEventListener('input', validateNumberDuplicate);

    // Toggle Type
    modal.querySelector('#btn-modal-type-issued')!.addEventListener('click', () => {
      currentType = 'issued';
      partyLabel.textContent = 'Nom / Raó Social del Client';
      modal.querySelector('#btn-modal-type-issued')!.className = 'btn btn--primary btn--sm';
      modal.querySelector('#btn-modal-type-received')!.className = 'btn btn--secondary btn--sm';
      validateNumberDuplicate();
      recalcModalTotal();
    });

    modal.querySelector('#btn-modal-type-received')!.addEventListener('click', () => {
      currentType = 'received';
      partyLabel.textContent = 'Nom / Raó Social del Proveïdor';
      modal.querySelector('#btn-modal-type-issued')!.className = 'btn btn--secondary btn--sm';
      modal.querySelector('#btn-modal-type-received')!.className = 'btn btn--primary btn--sm';
      validateNumberDuplicate();
      recalcModalTotal();
    });

    // Close
    modal.querySelector('#btn-close-modal')!.addEventListener('click', () => modal.remove());
    modal.querySelector('#btn-cancel-modal')!.addEventListener('click', () => modal.remove());

    // Submit with rigorous pre-save checks
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = parseFloat(baseInput.value) || 0;
      const vRate = (parseFloat(vatRateSelect.value) || 0) as IVARate;
      const wRate = (parseFloat(withhSelect.value) || 0) as WithholdingRate;
      const quarter = (modal.querySelector<HTMLSelectElement>('#inv-quarter')!.value) as FiscalQuarter;
      const date = modal.querySelector<HTMLInputElement>('#inv-date')!.value;
      const number = modal.querySelector<HTMLInputElement>('#inv-number')!.value.trim();
      const partyName = modal.querySelector<HTMLInputElement>('#inv-party-name')!.value.trim();
      const partyNif = modal.querySelector<HTMLInputElement>('#inv-party-nif')!.value.trim().toUpperCase();
      const concept = modal.querySelector<HTMLInputElement>('#inv-concept')!.value.trim();
      const category = modal.querySelector<HTMLSelectElement>('#inv-category')!.value;
      const paymentMethod = modal.querySelector<HTMLSelectElement>('#inv-payment-method')!.value as IVAInvoiceIssued['paymentMethod'];
      const fileInput = modal.querySelector<HTMLInputElement>('#inv-file-upload');
      const file = fileInput?.files && fileInput.files.length > 0 ? fileInput.files[0] : null;

      // 1. Validació de NIF/CIF
      const isIntra = category === 'intra_eu_delivery' || category === 'intra_eu_acquisition';
      if (!isIntra && !isValidSpanishTaxId(partyNif)) {
        if (!confirm(`⚠️ ALERTA DE COMPLIMENT FISCAL:\n\nEl NIF/CIF "${partyNif}" no supera l'algorisme oficial de control de l'AEAT.\n\nVols guardar la factura igualment o prefereixes revisar-lo?`)) {
          return;
        }
      }

      // 2. Validació de Límit d'Efectiu (> 1.000 €)
      const vatAmount = Math.round(b * (vRate / 100) * 100) / 100;
      const withhAmount = Math.round(b * (wRate / 100) * 100) / 100;
      const total = currentType === 'issued' ? (b + vatAmount - withhAmount) : (b + vatAmount);

      if (paymentMethod === 'cash' && total > 1000) {
        alert(`⛔ OPERACIÓ EN EFECTIU NO PERMESA:\n\nL'import total (${formatCurrency(total)}) supera el límit legal de 1.000 € establert per la Llei 11/2021 de Prevenció del Frau Fiscal. Cal utilitzar transferència, targeta o xec bancari.`);
        return;
      }

      // 3. Alerta de manca de PDF en Despeses Deduïbles (Factures Rebudes)
      if (currentType === 'received' && !file && vatAmount > 0) {
        const proceedWithoutDoc = confirm(`⚠️ ALERTA D'INSPECCIÓ TRIBUTÀRIA (Art. 97 LIVA & Art. 106 LGT):\n\nAquesta factura de despesa té ${formatCurrency(vatAmount)} d'IVA deduïble però NO té cap PDF original adjunt.\n\nEn cas de requeriment o inspecció de l'AEAT, la deducció serà rebutjada automàticament sense el document justificatiu original.\n\nVols continuar i guardar-la sense PDF (podràs adjuntar-lo més tard des del llibre)?`);
        if (!proceedWithoutDoc) {
          return;
        }
      }

      if (currentType === 'issued') {
        const newIssued: IVAInvoiceIssued = {
          id: `inv_iss_${Date.now()}`,
          quarter,
          date,
          invoiceNumber: number,
          clientName: partyName,
          clientNif: partyNif,
          concept,
          taxableBase: b,
          vatRate: vRate,
          vatAmount,
          withholdingRate: wRate,
          withholdingAmount: withhAmount,
          totalInvoice: total,
          category: category as IssuedInvoiceCategory,
          paymentMethod,
          hasAttachment: !!file,
        };

        if (file) {
          try {
            const doc = await saveInvoiceDocument(newIssued.id, file, {
              type: 'issued',
              year,
              quarter: newIssued.quarter,
              invoiceNumber: newIssued.invoiceNumber,
              nif: newIssued.clientNif,
              entityName: newIssued.clientName,
            });
            newIssued.attachmentStandardizedName = doc.standardizedName;
            newIssued.attachmentFileName = doc.originalFileName;
            newIssued.attachmentMimeType = doc.mimeType;
            newIssued.attachmentSize = doc.size;
            newIssued.attachmentUploadedAt = doc.uploadedAt;
          } catch (err) {
            console.error('Error saving document:', err);
          }
        }

        store.addIssuedInvoice(newIssued);
        showToast(`Factura emesa ${number} registrada i validada correctament`, 'success');
      } else {
        const newReceived: IVAInvoiceReceived = {
          id: `inv_rec_${Date.now()}`,
          quarter,
          date,
          invoiceNumber: number,
          supplierName: partyName,
          supplierNif: partyNif,
          concept,
          taxableBase: b,
          vatRate: vRate,
          vatAmount,
          deductiblePercentage: 100,
          deductibleVatAmount: vatAmount,
          withholdingRate: wRate,
          withholdingAmount: withhAmount,
          totalInvoice: total,
          category: category as ReceivedInvoiceCategory,
          paymentMethod,
          isInvestmentAsset: category === 'investment_asset' || b >= 3000,
          hasAttachment: !!file,
        };

        if (file) {
          try {
            const doc = await saveInvoiceDocument(newReceived.id, file, {
              type: 'received',
              year,
              quarter: newReceived.quarter,
              invoiceNumber: newReceived.invoiceNumber,
              nif: newReceived.supplierNif,
              entityName: newReceived.supplierName,
            });
            newReceived.attachmentStandardizedName = doc.standardizedName;
            newReceived.attachmentFileName = doc.originalFileName;
            newReceived.attachmentMimeType = doc.mimeType;
            newReceived.attachmentSize = doc.size;
            newReceived.attachmentUploadedAt = doc.uploadedAt;
          } catch (err) {
            console.error('Error saving document:', err);
          }
        }

        store.addReceivedInvoice(newReceived);
        showToast(`Factura rebuda ${number} registrada i validada correctament`, 'success');
      }

      modal.remove();
      render();
    });
  }

  /* ─────────────────────────────────────────────────────────── */
  /* MODAL D'ALTA DE BÉ D'INVERSIÓ                               */
  /* ─────────────────────────────────────────────────────────── */
  function openAddAssetModal() {
    const existingModal = document.getElementById('iva-asset-modal');
    if (existingModal) existingModal.remove();

    const year = store.getYear() || 2024;
    const modal = document.createElement('div');
    modal.id = 'iva-asset-modal';
    modal.className = 'modal-backdrop';
    modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.75); display:flex; justify-content:center; align-items:center; z-index:10000; padding:var(--space-md);';

    modal.innerHTML = `
      <div class="modal-content card" style="max-width:540px; width:100%; max-height:90vh; overflow-y:auto; background:var(--modal-bg); border:1px solid var(--border-default); border-radius:var(--radius-lg); padding:var(--space-xl);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-lg); border-bottom:1px solid var(--border-default); padding-bottom:var(--space-sm);">
          <h3 style="margin:0; font-size:var(--text-lg);">🏢 Alta de Bé d'Inversió (Art. 107 LIVA)</h3>
          <button class="btn btn--ghost btn--sm btn--icon" id="btn-close-asset-modal" style="font-size:1.2rem;">✕</button>
        </div>

        <form id="iva-asset-form" style="display:flex; flex-direction:column; gap:var(--space-md);">
          <div class="form-group">
            <label class="form-label" for="asset-desc">Descripció del Bé</label>
            <input type="text" class="form-input" id="asset-desc" placeholder="Ex: Furgoneta de repartiment o Local comercial" required>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-md);">
            <div class="form-group">
              <label class="form-label" for="asset-type">Tipus de Bé</label>
              <select class="form-select" id="asset-type">
                <option value="furniture">Mobiliari / Instal·lacions (5 anys)</option>
                <option value="machinery">Maquinària / Equips (5 anys)</option>
                <option value="computer">Equips Informàtics (5 anys)</option>
                <option value="real_estate">Immoble Afecte / Local (10 anys)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="asset-date">Data d'Adquisició</label>
              <input type="date" class="form-input" id="asset-date" value="${year}-01-15" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-md);">
            <div class="form-group">
              <label class="form-label" for="asset-base">Base Imposable (€)</label>
              <input type="number" step="0.01" class="form-input" id="asset-base" placeholder="Ex: 5000,00" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="asset-prorrata">Prorrata Inicial (%)</label>
              <input type="number" class="form-input" id="asset-prorrata" value="100" min="0" max="100" required>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:var(--space-sm); margin-top:var(--space-md);">
            <button type="button" class="btn btn--secondary" id="btn-cancel-asset-modal">Cancel·lar</button>
            <button type="submit" class="btn btn--primary">💾 Guardar Bé d'Inversió</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btn-close-asset-modal')!.addEventListener('click', () => modal.remove());
    modal.querySelector('#btn-cancel-asset-modal')!.addEventListener('click', () => modal.remove());

    modal.querySelector<HTMLFormElement>('#iva-asset-form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const desc = modal.querySelector<HTMLInputElement>('#asset-desc')!.value;
      const type = modal.querySelector<HTMLSelectElement>('#asset-type')!.value;
      const date = modal.querySelector<HTMLInputElement>('#asset-date')!.value;
      const base = parseFloat(modal.querySelector<HTMLInputElement>('#asset-base')!.value) || 0;
      const prorrata = parseFloat(modal.querySelector<HTMLInputElement>('#asset-prorrata')!.value) || 100;

      const vatPaid = Math.round(base * 0.21 * 100) / 100;
      const initialDeducted = Math.round(vatPaid * (prorrata / 100) * 100) / 100;

      const newAsset: IVABienInversion = {
        id: `asset_${Date.now()}`,
        description: desc,
        assetType: (type as IVABienInversion['assetType']) || 'movable_machinery',
        acquisitionDate: date,
        startDate: date,
        taxableBase: base,
        vatRate: 21,
        totalVatPaid: vatPaid,
        initialDeductionPercentage: prorrata,
        initialDeductedVat: initialDeducted,
        regularizationYears: type === 'real_estate' ? 10 : 5,
        regularizations: [],
        status: 'active',
      };

      store.addInvestmentAsset(newAsset);
      showToast(`Bé d'inversió "${desc}" afegit correctament`, 'success');
      modal.remove();
      render();
    });
  }

  // Initial render
  render();
  return page;
}
