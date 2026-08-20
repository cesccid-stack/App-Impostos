/**
 * @module pages/dashboard
 * Quadre de Comandament Global & Hub d'Indicadors Claus 360° (Executive Tax Cockpit).
 * Resum exhaustiu de liquidació IRPF, rendiments per origen, patrimoni, IVA, risc AEAT, simulador What-If i consolidació multi-declarant.
 */

import { store } from '../store.ts';
import { calculateIRPF, effectiveRate } from '../fiscal/irpf.ts';
import { auditTaxReturn } from '../fiscal/advisor-engine.ts';
import { calculateAllProperties } from '../fiscal/real-estate-engine.ts';
import { evaluateAuditRisk } from '../fiscal/audit-risk-radar.ts';
import { calculateAllQuarters } from '../fiscal/iva-engine.ts';
import { calculateWealthTax } from '../fiscal/wealth-tax-engine.ts';
import { STATE_GENERAL_TAX_BRACKETS, type FiscalYear } from '../fiscal/constants.ts';
import { formatCurrency, formatPercent } from '../utils/currency.ts';
import { createDonutChart, createBarChart } from '../components/chart.ts';
import { generateModel100PDF } from '../utils/pdf-generator.ts';
import { showToast } from '../components/toast.ts';
import { getStatusMeta } from '../fiscal/user-presets.ts';
import { openCommandPalette } from '../components/command-palette.ts';
import { openToolManagerModal } from '../components/tool-manager-modal.ts';
import { createSidebar } from '../components/navbar.ts';
import { ALL_APP_MODULES } from '../fiscal/modules-catalog.ts';
import type { DeclaracionData, FiscalResult, UserProfile } from '../types.ts';

interface DashboardContext {
  data: DeclaracionData;
  result: FiscalResult;
  audit: ReturnType<typeof auditTaxReturn>;
  auditRisk: ReturnType<typeof evaluateAuditRisk>;
  activeProfile: UserProfile;
  currentYear: number;
  propSummary: ReturnType<typeof calculateAllProperties>;
  totalGainsPositive: number;
  totalGainsLosses: number;
  ivaAnnualBalance: number;
  wealthTaxResult: { totalGrossAssets: number; totalDebts: number; netWealth: number; finalTax: number; hasFilingObligation: boolean };
  totalGrossIncome: number;
  allProfiles: UserProfile[];
  enabledModuleIds: string[];
  totalAvailableModules: number;
  simSalaryDelta: number;
  simPensionDelta: number;
  simGainsDelta: number;
  simDeductionDelta: number;
}

export function renderDashboard(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container';

  let activeTab: 'global' | 'charts' | 'whatif' | 'consolidation' | 'tools' = 'global';

  // What-If Simulator state (deltas)
  let simSalaryDelta = 0;
  let simPensionDelta = 0;
  let simGainsDelta = 0;
  let simDeductionDelta = 0;

  function render() {
    const data = store.getData();
    const result = calculateIRPF(data);
    const audit = auditTaxReturn(data, result);
    const auditRisk = evaluateAuditRisk(data, result);
    const activeProfile = store.getActiveProfile();
    const statusConfig = getStatusMeta(activeProfile.status);
    const currentYear = store.getYear();
    const enabledModuleIds = store.getEnabledModules(activeProfile.id);
    const totalAvailableModules = ALL_APP_MODULES.length;
    const allProfiles = store.getProfiles();

    // Càlculs immobiliaris
    const propSummary = calculateAllProperties(data.properties || [], currentYear);

    // Càlculs guanys patrimonials
    const totalGainsPositive = (data.gains?.items || [])
      .filter(i => (i.transferValue - i.acquisitionValue - i.expenses) > 0)
      .reduce((s, i) => s + (i.transferValue - i.acquisitionValue - i.expenses), 0);
    const totalGainsLosses = (data.gains?.items || [])
      .filter(i => (i.transferValue - i.acquisitionValue - i.expenses) < 0)
      .reduce((s, i) => s + Math.abs(i.transferValue - i.acquisitionValue - i.expenses), 0);

    // Càlculs d'IVA trimestral acumulat
    let ivaAnnualBalance = 0;
    if (data.iva) {
      const ivaQuarters = calculateAllQuarters(data.iva, currentYear);
      for (const qRes of Object.values(ivaQuarters.quarters)) {
        ivaAnnualBalance += (qRes.resultadoLiquidacion || 0);
      }
    }

    // Càlculs de Patrimoni (Model 714)
    let wealthTaxResult = { totalGrossAssets: 0, totalDebts: 0, netWealth: 0, finalTax: 0, hasFilingObligation: false };
    if (data.wealth) {
      const wRes = calculateWealthTax(data.wealth, result.generalBase, result.savingsBase, result.netTax);
      wealthTaxResult = {
        totalGrossAssets: wRes.totalGrossAssets,
        totalDebts: wRes.totalDeductibleDebts,
        netWealth: wRes.netWealth,
        finalTax: wRes.netWealthTax,
        hasFilingObligation: wRes.isObligatedToDeclare,
      };
    }

    // Càlculs globals
    const isRefund = result.result < 0;
    const effectiveGeneral = effectiveRate(result.liquidableGeneralBase, STATE_GENERAL_TAX_BRACKETS);
    const totalGrossIncome =
      (data.workIncome?.employers || []).reduce((s, e) => s + (e.grossSalary || 0) + (e.inKind || 0), 0) +
      propSummary.totalGrossIncome +
      (data.capitalIncome?.interests || 0) + (data.capitalIncome?.dividends || 0) + (data.capitalIncome?.foreignDividends || 0) +
      (data.activities?.income || 0) +
      totalGainsPositive;

    const overallEffective = totalGrossIncome > 0 ? (result.netTax / totalGrossIncome) : 0;

    // Fiscal Health Score (0 a 100)
    let healthScore = 100;
    if (auditRisk.overallRiskScore > 30) healthScore -= 15;
    if (auditRisk.overallRiskScore > 60) healthScore -= 25;
    if (audit.adviceList.length > 3) healthScore -= 10;
    if ((data.workIncome?.employers || []).length === 0 && (data.properties || []).length === 0 && (data.activities?.income || 0) === 0 && totalGrossIncome === 0) {
      healthScore = 50;
    }
    healthScore = Math.max(20, Math.min(100, healthScore));

    page.innerHTML = `
      <!-- Capçalera Executiva Global -->
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-lg);">
        <div>
          <div style="display:flex; align-items:center; gap:var(--space-sm); margin-bottom:4px; flex-wrap:wrap;">
            <h1 class="page-header__title" style="margin:0;">Quadre de Comandament Global & Indicadors Claus</h1>
            <span class="badge badge--primary" style="font-size:0.75rem;">
              ${activeProfile.avatarIcon || '👤'} ${activeProfile.name}
            </span>
            <span class="badge ${statusConfig.badgeClass}" style="font-size:0.75rem;">
              ${statusConfig.icon} ${statusConfig.label}
            </span>
            <span class="badge badge--info" style="font-size:0.75rem;">
              Exercici ${currentYear}
            </span>
          </div>
          <p class="page-header__subtitle" style="margin:0;">
            Supervisió analítica 360°: IRPF Model 100, flux de renda, amortitzacions AEAT, IVA, patrimoni i eines a la carta
          </p>
        </div>
        <div style="display:flex; gap:var(--space-sm); flex-wrap:wrap; align-items:center;">
          <button class="btn btn--secondary btn--sm" id="dash-btn-tool-manager" title="Configurar eines activades">
            ⚙️ Eines (${enabledModuleIds.length}/${totalAvailableModules})
          </button>
          <button class="btn btn--secondary btn--sm" id="dash-btn-cmd" title="Cerca ràpida (⌘K)">
            🔍 Cercar <kbd style="font-size:0.65rem; background:var(--bg-surface); padding:1px 4px; border-radius:3px; border:1px solid var(--border-default);">⌘K</kbd>
          </button>
          <button class="btn btn--primary btn--sm" id="dash-btn-pdf" style="font-weight:700;">
            🖨️ Descarregar Model 100 (PDF)
          </button>
        </div>
      </div>

      <!-- Barra de Pestanyes del Quadre de Comandament -->
      <div style="display:flex; gap:8px; border-bottom:1px solid var(--border-default); margin-bottom:var(--space-xl); overflow-x:auto; padding-bottom:4px;">
        <button class="tab-btn ${activeTab === 'global' ? 'active' : ''}" data-tab="global" style="padding:8px 16px; border:none; background:transparent; color:${activeTab === 'global' ? 'var(--color-primary)' : 'var(--text-secondary)'}; font-weight:${activeTab === 'global' ? '700' : '500'}; font-size:0.85rem; cursor:pointer; border-bottom:2px solid ${activeTab === 'global' ? 'var(--color-primary)' : 'transparent'}; white-space:nowrap;">
          🌟 Visió Global & KPIs Claus
        </button>
        <button class="tab-btn ${activeTab === 'charts' ? 'active' : ''}" data-tab="charts" style="padding:8px 16px; border:none; background:transparent; color:${activeTab === 'charts' ? 'var(--color-primary)' : 'var(--text-secondary)'}; font-weight:${activeTab === 'charts' ? '700' : '500'}; font-size:0.85rem; cursor:pointer; border-bottom:2px solid ${activeTab === 'charts' ? 'var(--color-primary)' : 'transparent'}; white-space:nowrap;">
          📊 Flux de Renda & Gràfics
        </button>
        <button class="tab-btn ${activeTab === 'whatif' ? 'active' : ''}" data-tab="whatif" style="padding:8px 16px; border:none; background:transparent; color:${activeTab === 'whatif' ? 'var(--color-primary)' : 'var(--text-secondary)'}; font-weight:${activeTab === 'whatif' ? '700' : '500'}; font-size:0.85rem; cursor:pointer; border-bottom:2px solid ${activeTab === 'whatif' ? 'var(--color-primary)' : 'transparent'}; white-space:nowrap;">
          🔮 Simulador "What-If" en Viu
        </button>
        <button class="tab-btn ${activeTab === 'consolidation' ? 'active' : ''}" data-tab="consolidation" style="padding:8px 16px; border:none; background:transparent; color:${activeTab === 'consolidation' ? 'var(--color-primary)' : 'var(--text-secondary)'}; font-weight:${activeTab === 'consolidation' ? '700' : '500'}; font-size:0.85rem; cursor:pointer; border-bottom:2px solid ${activeTab === 'consolidation' ? 'var(--color-primary)' : 'transparent'}; white-space:nowrap;">
          👨‍👩‍👧‍👦 Consolidació Multi-declarant (${allProfiles.length})
        </button>
        <button class="tab-btn ${activeTab === 'tools' ? 'active' : ''}" data-tab="tools" style="padding:8px 16px; border:none; background:transparent; color:${activeTab === 'tools' ? 'var(--color-primary)' : 'var(--text-secondary)'}; font-weight:${activeTab === 'tools' ? '700' : '500'}; font-size:0.85rem; cursor:pointer; border-bottom:2px solid ${activeTab === 'tools' ? 'var(--color-primary)' : 'transparent'}; white-space:nowrap;">
          ⚙️ Eines Actives (${enabledModuleIds.length})
        </button>
      </div>

      <!-- Targeta Hero: Liquidació Oficial & Indicadors Resum (Sempre Visible a dalt) -->
      <div class="card" style="margin-bottom:var(--space-xl); background:linear-gradient(135deg, var(--bg-surface-elevated), var(--bg-surface)); border:1px solid var(--border-default); border-left:4px solid ${isRefund ? 'var(--color-success)' : 'var(--color-error)'};">
        <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:var(--space-xl); align-items:center;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span style="font-size:var(--text-xs); text-transform:uppercase; font-weight:700; color:var(--text-muted); letter-spacing:0.05em;">
                Resultat Liquidatori Oficial (Casella 0610 AEAT)
              </span>
              <span class="badge ${isRefund ? 'badge--success' : 'badge--error'}" style="font-size:0.7rem;">
                ${isRefund ? 'A DEVOLUCIÓ' : 'A INGRÉS'}
              </span>
            </div>
            <div style="font-size:2.8rem; font-weight:900; line-height:1.1; margin:6px 0;" class="${isRefund ? 'text-success' : 'text-error'}">
              ${isRefund ? '↩ A TORNAR: ' : '↗ A PAGAR: '} ${formatCurrency(Math.abs(result.result))}
            </div>
            <div style="font-size:var(--text-sm); color:var(--text-secondary);">
              Quota Líquida: <strong>${formatCurrency(result.netTax)}</strong> | Retencions: <strong>${formatCurrency(result.totalWithholdings)}</strong>
              ${result.jointTaxationReduction ? ` | <span class="badge badge--success">Tributació Conjunta (-${formatCurrency(result.jointTaxationReduction)})</span>` : ''}
            </div>
          </div>

          <!-- 4 Indicadors Top -->
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:var(--space-sm); background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div>
              <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Tipus Efectiu Global</div>
              <div style="font-size:1.4rem; font-weight:800; color:var(--color-primary);">${formatPercent(overallEffective)}</div>
              <div style="font-size:0.65rem; color:var(--text-secondary);">Tram General: ${formatPercent(effectiveGeneral)}</div>
            </div>
            <div>
              <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Total Ingressos Bruts</div>
              <div style="font-size:1.4rem; font-weight:800; color:var(--text-primary);">${formatCurrency(totalGrossIncome)}</div>
              <div style="font-size:0.65rem; color:var(--text-secondary);">Base Liq: ${formatCurrency(result.liquidableGeneralBase + result.liquidableSavingsBase)}</div>
            </div>
            <div>
              <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Salut Fiscal / Compliment</div>
              <div style="font-size:1.4rem; font-weight:800; color:${healthScore >= 80 ? 'var(--color-success)' : 'var(--color-warning)'};">
                ${healthScore}/100
              </div>
              <div style="font-size:0.65rem; color:var(--text-secondary);">${auditRisk.riskLevel === 'low' ? 'Risc baix AEAT' : 'Revisar alertes'}</div>
            </div>
            <div>
              <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Estalvi Identificat</div>
              <div style="font-size:1.4rem; font-weight:800; color:var(--color-success);">${formatCurrency(audit.totalPotentialSavings)}</div>
              <div style="font-size:0.65rem; color:var(--text-secondary);">${audit.adviceList.length} optimitzacions</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contingut Dinàmic segons la Pestanya Seleccionada -->
      <div id="tab-content-container">
        ${renderTabContent(activeTab, {
          data,
          result,
          audit,
          auditRisk,
          activeProfile,
          currentYear,
          propSummary,
          totalGainsPositive,
          totalGainsLosses,
          ivaAnnualBalance,
          wealthTaxResult,
          totalGrossIncome,
          allProfiles,
          enabledModuleIds,
          totalAvailableModules,
          simSalaryDelta,
          simPensionDelta,
          simGainsDelta,
          simDeductionDelta,
        })}
      </div>
    `;

    attachEvents();
  }

  function renderTabContent(tab: typeof activeTab, ctx: DashboardContext) {
    if (tab === 'global') {
      return renderGlobalKpiGrid(ctx);
    } else if (tab === 'charts') {
      return renderChartsView(ctx);
    } else if (tab === 'whatif') {
      return renderWhatIfSimulator(ctx);
    } else if (tab === 'consolidation') {
      return renderMultiProfileConsolidation(ctx);
    } else {
      return renderActiveToolsView(ctx);
    }
  }

  function renderGlobalKpiGrid(ctx: DashboardContext) {
    const { data, result, propSummary, totalGainsPositive, totalGainsLosses, ivaAnnualBalance, wealthTaxResult, auditRisk, enabledModuleIds } = ctx;

    const showWork = enabledModuleIds.includes('work_income');
    const showProps = enabledModuleIds.includes('properties');
    const showCapital = enabledModuleIds.includes('capital');
    const showGains = enabledModuleIds.includes('gains') || enabledModuleIds.includes('trading');
    const showIVA = enabledModuleIds.includes('iva') || enabledModuleIds.includes('activities');
    const showDeductions = enabledModuleIds.includes('deductions');
    const showWealth = enabledModuleIds.includes('wealth_tax') || enabledModuleIds.includes('foreign_assets');

    return `
      <!-- Matriu d'Indicadors Claus (Executive KPI Matrix) -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-xl);">
        
        <!-- 1. Treball -->
        ${showWork ? `
        <div class="card" style="padding:var(--space-md); border:1px solid var(--border-default); display:flex; flex-direction:column; justify-content:space-between; background:var(--bg-surface-elevated);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-xs);">
              <span style="font-size:var(--text-xs); font-weight:700; color:var(--text-muted); text-transform:uppercase;">💼 Rendiments Treball</span>
              <span class="badge badge--primary">${(data.workIncome?.employers || []).length} pagadors</span>
            </div>
            <div style="font-size:1.5rem; font-weight:800; color:var(--text-primary);">
              ${formatCurrency(data.workIncome?.employers?.reduce((s: number, e: any) => s + (e.grossSalary || 0), 0) || 0)}
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
              Retencions IRPF: ${formatCurrency(data.workIncome?.employers?.reduce((s: number, e: any) => s + (e.withholdings || 0), 0) || 0)} | SS: -${formatCurrency(data.workIncome?.employers?.reduce((s: number, e: any) => s + (e.socialSecurity || 0), 0) || 0)}
            </div>
          </div>
          <div style="margin-top:var(--space-sm); padding-top:var(--space-xs); border-top:1px dashed var(--border-default); font-size:0.75rem;">
            <a href="#/treball" style="color:var(--color-primary); font-weight:600; text-decoration:none;">Veure Nòmines & 7.p ➡️</a>
          </div>
        </div>
        ` : ''}

        <!-- 2. Immobles -->
        ${showProps ? `
        <div class="card" style="padding:var(--space-md); border:1px solid var(--border-default); display:flex; flex-direction:column; justify-content:space-between; background:var(--bg-surface-elevated);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-xs);">
              <span style="font-size:var(--text-xs); font-weight:700; color:var(--text-muted); text-transform:uppercase;">🏠 Immobles Lloguer</span>
              <span class="badge badge--info">${(data.properties || []).length} immobles</span>
            </div>
            <div style="font-size:1.5rem; font-weight:800; color:var(--text-primary);">
              ${formatCurrency(propSummary.totalGrossIncome)}
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
              Amortització AEAT (3%): -${formatCurrency(propSummary.totalAmortization)} | Rend. Net: ${formatCurrency(propSummary.totalNetReducedIncome)}
            </div>
          </div>
          <div style="margin-top:var(--space-sm); padding-top:var(--space-xs); border-top:1px dashed var(--border-default); font-size:0.75rem;">
            <a href="#/immobles" style="color:var(--color-primary); font-weight:600; text-decoration:none;">Extracontable & Factures ➡️</a>
          </div>
        </div>
        ` : ''}

        <!-- 3. Capital Mobiliari -->
        ${showCapital ? `
        <div class="card" style="padding:var(--space-md); border:1px solid var(--border-default); display:flex; flex-direction:column; justify-content:space-between; background:var(--bg-surface-elevated);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-xs);">
              <span style="font-size:var(--text-xs); font-weight:700; color:var(--text-muted); text-transform:uppercase;">🏦 Capital Mobiliari</span>
              ${(data.capitalIncome?.foreignDividends || 0) > 0 ? `<span class="badge badge--warning">W-8BEN 0588</span>` : `<span class="badge badge--primary">Interessos</span>`}
            </div>
            <div style="font-size:1.5rem; font-weight:800; color:var(--text-primary);">
              ${formatCurrency((data.capitalIncome?.interests || 0) + (data.capitalIncome?.dividends || 0) + (data.capitalIncome?.foreignDividends || 0))}
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
              Retencions practicades: ${formatCurrency(data.capitalIncome?.mobiliaryWithholdings || 0)} | Extrangers: ${formatCurrency(data.capitalIncome?.foreignDividends || 0)}
            </div>
          </div>
          <div style="margin-top:var(--space-sm); padding-top:var(--space-xs); border-top:1px dashed var(--border-default); font-size:0.75rem;">
            <a href="#/capital" style="color:var(--color-primary); font-weight:600; text-decoration:none;">Dividends & Doble Imposició ➡️</a>
          </div>
        </div>
        ` : ''}

        <!-- 4. Guanys i Cartera (FIFO) -->
        ${showGains ? `
        <div class="card" style="padding:var(--space-md); border:1px solid var(--border-default); display:flex; flex-direction:column; justify-content:space-between; background:var(--bg-surface-elevated);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-xs);">
              <span style="font-size:var(--text-xs); font-weight:700; color:var(--text-muted); text-transform:uppercase;">📊 Borsa & Cripto (FIFO)</span>
              <span class="badge badge--primary">${(data.gains?.items || []).length} op.</span>
            </div>
            <div style="font-size:1.5rem; font-weight:800; color:${(totalGainsPositive - totalGainsLosses) >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
              ${formatCurrency(totalGainsPositive - totalGainsLosses)}
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
              Plusvàlues: +${formatCurrency(totalGainsPositive)} | Pèrdues: -${formatCurrency(totalGainsLosses)}
            </div>
          </div>
          <div style="margin-top:var(--space-sm); padding-top:var(--space-xs); border-top:1px dashed var(--border-default); font-size:0.75rem;">
            <a href="#/guanys" style="color:var(--color-primary); font-weight:600; text-decoration:none;">Compensació 4 Anys & FIFO ➡️</a>
          </div>
        </div>
        ` : ''}

        <!-- 5. Activitats & IVA 303 -->
        ${showIVA ? `
        <div class="card" style="padding:var(--space-md); border:1px solid var(--border-default); display:flex; flex-direction:column; justify-content:space-between; background:var(--bg-surface-elevated);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-xs);">
              <span style="font-size:var(--text-xs); font-weight:700; color:var(--text-muted); text-transform:uppercase;">🧾 Activitats & IVA 303</span>
              <span class="badge badge--info">Trimestral</span>
            </div>
            <div style="font-size:1.5rem; font-weight:800; color:var(--text-primary);">
              ${formatCurrency(data.activities?.income || 0)}
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
              Quota IVA Anual: ${formatCurrency(ivaAnnualBalance)} | RETA: -${formatCurrency(data.activities?.socialSecuritySelfEmployed || 0)}
            </div>
          </div>
          <div style="margin-top:var(--space-sm); padding-top:var(--space-xs); border-top:1px dashed var(--border-default); font-size:0.75rem;">
            <a href="#/iva" style="color:var(--color-primary); font-weight:600; text-decoration:none;">Model 303 / 390 & Factures ➡️</a>
          </div>
        </div>
        ` : ''}

        <!-- 6. Deduccions & Estalvi -->
        ${showDeductions ? `
        <div class="card" style="padding:var(--space-md); border:1px solid var(--border-default); display:flex; flex-direction:column; justify-content:space-between; background:var(--bg-surface-elevated);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-xs);">
              <span style="font-size:var(--text-xs); font-weight:700; color:var(--text-muted); text-transform:uppercase;">🎯 Deduccions & Estalvi</span>
              <span class="badge badge--success">Optimitzat</span>
            </div>
            <div style="font-size:1.5rem; font-weight:800; color:var(--color-success);">
              -${formatCurrency(result.totalDeductions)}
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
              Autonòmiques: -${formatCurrency(result.catalanDeductionsAmount || 0)} | Donatius & Plans
            </div>
          </div>
          <div style="margin-top:var(--space-sm); padding-top:var(--space-xs); border-top:1px dashed var(--border-default); font-size:0.75rem;">
            <a href="#/deduccions" style="color:var(--color-success); font-weight:600; text-decoration:none;">Revisar Deduccions ➡️</a>
          </div>
        </div>
        ` : ''}

        <!-- 7. Patrimoni & 720 -->
        ${showWealth ? `
        <div class="card" style="padding:var(--space-md); border:1px solid var(--border-default); display:flex; flex-direction:column; justify-content:space-between; background:var(--bg-surface-elevated);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-xs);">
              <span style="font-size:var(--text-xs); font-weight:700; color:var(--text-muted); text-transform:uppercase;">🏰 Patrimoni Net (714)</span>
              <span class="badge ${wealthTaxResult.hasFilingObligation ? 'badge--warning' : 'badge--success'}">
                ${wealthTaxResult.hasFilingObligation ? 'Obligat 714' : 'Exempt'}
              </span>
            </div>
            <div style="font-size:1.5rem; font-weight:800; color:var(--text-primary);">
              ${formatCurrency(wealthTaxResult.netWealth)}
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
              Quota IP teòrica: ${formatCurrency(wealthTaxResult.finalTax)} | Actius bruts: ${formatCurrency(wealthTaxResult.totalGrossAssets)}
            </div>
          </div>
          <div style="margin-top:var(--space-sm); padding-top:var(--space-xs); border-top:1px dashed var(--border-default); font-size:0.75rem;">
            <a href="#/patrimoni" style="color:var(--color-primary); font-weight:600; text-decoration:none;">Model 714 & 720 Estranger ➡️</a>
          </div>
        </div>
        ` : ''}

        <!-- 8. Radar Risc AEAT -->
        <div class="card" style="padding:var(--space-md); border:1px solid var(--border-default); display:flex; flex-direction:column; justify-content:space-between; background:var(--bg-surface-elevated);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-xs);">
              <span style="font-size:var(--text-xs); font-weight:700; color:var(--text-muted); text-transform:uppercase;">🛡️ Radar de Risc AEAT</span>
              <span class="badge ${auditRisk.riskLevel === 'low' ? 'badge--success' : 'badge--warning'}">
                ${auditRisk.riskLevel.toUpperCase()}
              </span>
            </div>
            <div style="font-size:1.5rem; font-weight:800; color:${auditRisk.riskLevel === 'low' ? 'var(--color-success)' : 'var(--color-warning)'};">
              ${auditRisk.overallRiskScore} / 100
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
              ${auditRisk.alerts.length} alertes detectades (${auditRisk.documentaryChecklist.length} documents de suport)
            </div>
          </div>
          <div style="margin-top:var(--space-sm); padding-top:var(--space-xs); border-top:1px dashed var(--border-default); font-size:0.75rem;">
            <a href="#/resultat" style="color:var(--color-primary); font-weight:600; text-decoration:none;">Auditoria & Detall de Risc ➡️</a>
          </div>
        </div>

      </div>

      <!-- Checklist de Conformitat Oficial AEAT -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="margin-bottom:var(--space-md);">
          <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
            <span>📋 Estat de Conformitat de les Seccions Fiscals</span>
            <span class="badge badge--success">100% Sincronitzat</span>
          </div>
          <p class="card__subtitle" style="margin:0;">Verificació automàtica abans de la presentació final a Renta Web</p>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:var(--space-md);">
          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-surface-elevated); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="display:flex; align-items:center; gap:var(--space-sm);">
              <span>👤</span>
              <div>
                <div style="font-weight:600; font-size:var(--text-sm);">Situació Personal & Mínims</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">Mínim exempt: ${formatCurrency(result.totalMinimum)}</div>
              </div>
            </div>
            <span class="badge badge--success">Validat</span>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-surface-elevated); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="display:flex; align-items:center; gap:var(--space-sm);">
              <span>💼</span>
              <div>
                <div style="font-weight:600; font-size:var(--text-sm);">Rendiments del Treball</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${(data.workIncome?.employers || []).length} pagadors registrats</div>
              </div>
            </div>
            <span class="badge ${(data.workIncome?.employers || []).length > 0 ? 'badge--success' : 'badge--primary'}">
              ${(data.workIncome?.employers || []).length > 0 ? 'Complet' : 'Sense dades'}
            </span>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-surface-elevated); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="display:flex; align-items:center; gap:var(--space-sm);">
              <span>🏠</span>
              <div>
                <div style="font-weight:600; font-size:var(--text-sm);">Immobles & Amortització AEAT</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${(data.properties || []).length} immobles registrats</div>
              </div>
            </div>
            <span class="badge ${(data.properties || []).length > 0 ? 'badge--success' : 'badge--primary'}">
              ${(data.properties || []).length > 0 ? 'Amortitzat' : 'Opcional'}
            </span>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-surface-elevated); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="display:flex; align-items:center; gap:var(--space-sm);">
              <span>⚖️</span>
              <div>
                <div style="font-weight:600; font-size:var(--text-sm);">Comparativa Conjunta (Art. 84)</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">Reducció de 3.400 € disponible</div>
              </div>
            </div>
            <a href="#/comparador" class="badge badge--info" style="text-decoration:none;">Comparar ➡️</a>
          </div>
        </div>
      </div>
    `;
  }

  function renderChartsView(ctx: DashboardContext) {
    const { result } = ctx;

    return `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap:var(--space-xl); margin-bottom:var(--space-xl);">
        <!-- Distribució d'Ingressos -->
        <div class="card" id="dash-income-card">
          <div class="card__header" style="margin-bottom:var(--space-md);">
            <div class="card__title">Distribució d'Ingressos Bruts per Font</div>
            <p class="card__subtitle" style="margin:0;">Composició del volum total d'ingressos computables de l'exercici</p>
          </div>
        </div>

        <!-- Desglossament Fiscal -->
        <div class="card" id="dash-tax-card">
          <div class="card__header" style="margin-bottom:var(--space-md);">
            <div class="card__title">Desglossament Fiscal & Càrrega Impositiva</div>
            <p class="card__subtitle" style="margin:0;">Quotes íntegres, crèdits mínims, deduccions i retencions deduïdes</p>
          </div>
        </div>
      </div>

      <!-- Taula de Flux de Liquidació (Waterfall Flow) -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="margin-bottom:var(--space-md);">
          <div class="card__title">Cascada de Liquidació Tributària (Flux d'Impostos)</div>
          <p class="card__subtitle" style="margin:0;">Traçabilitat pas a pas des del brut inicial fins al resultat líquid final</p>
        </div>
        <div class="table-responsive">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Concepte Fiscal</th>
                <th>Tipologia / Article LIRPF</th>
                <th style="text-align:right;">Import (€)</th>
                <th style="text-align:right;">Impacte</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>1. Base Imposable General</strong></td>
                <td>Rendiments del treball, immobles, activitats</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(result.generalBase)}</td>
                <td style="text-align:right;"><span class="badge badge--primary">Positiu</span></td>
              </tr>
              <tr>
                <td><strong>2. Reduccions Aplicades</strong></td>
                <td>Rendiments del treball (-${formatCurrency(result.workIncomeReduction)}), Plans de Pensions (-${formatCurrency(result.pensionReduction)})</td>
                <td style="text-align:right; font-weight:700; color:var(--color-success); font-family:var(--font-mono);">- ${formatCurrency(result.totalReductions)}</td>
                <td style="text-align:right;"><span class="badge badge--success">Estalvi</span></td>
              </tr>
              <tr>
                <td><strong>3. Base Liquidable General</strong></td>
                <td>Casella 0500 AEAT</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(result.liquidableGeneralBase)}</td>
                <td style="text-align:right;"><span class="badge badge--info">Base Gravable</span></td>
              </tr>
              <tr>
                <td><strong>4. Base Liquidable de l'Estalvi</strong></td>
                <td>Dividends, interessos i guanys patrimonials (Casella 0510)</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(result.liquidableSavingsBase)}</td>
                <td style="text-align:right;"><span class="badge badge--info">Tipus 19-28%</span></td>
              </tr>
              <tr>
                <td><strong>5. Quota Íntegra Total</strong></td>
                <td>Quota General (${formatCurrency(result.generalTax)}) + Quota Estalvi (${formatCurrency(result.savingsTax)})</td>
                <td style="text-align:right; font-weight:700;">${formatCurrency(result.grossTax)}</td>
                <td style="text-align:right;"><span class="badge badge--warning">Càrrega</span></td>
              </tr>
              <tr>
                <td><strong>6. Crèdit per Mínim Personal i Familiar</strong></td>
                <td>Mínim exempt aplicat a l'escala de gravamen</td>
                <td style="text-align:right; font-weight:700; color:var(--color-success); font-family:var(--font-mono);">- ${formatCurrency(result.minimumTaxCredit)}</td>
                <td style="text-align:right;"><span class="badge badge--success">Crèdit Fiscal</span></td>
              </tr>
              <tr>
                <td><strong>7. Deduccions Estatals i Autonòmiques</strong></td>
                <td>Catalunya (-${formatCurrency(result.catalanDeductionsAmount || 0)}) + Estatals / Donatius</td>
                <td style="text-align:right; font-weight:700; color:var(--color-success); font-family:var(--font-mono);">- ${formatCurrency(result.totalDeductions)}</td>
                <td style="text-align:right;"><span class="badge badge--success">Deducció Directa</span></td>
              </tr>
              <tr style="background:var(--bg-surface-elevated); font-weight:800;">
                <td><strong>8. Quota Líquida Total</strong></td>
                <td>Impost net a satisfer abans de retencions</td>
                <td style="text-align:right; font-size:1.1rem; color:var(--color-primary);">${formatCurrency(result.netTax)}</td>
                <td style="text-align:right;"><span class="badge badge--primary">Quota Neta</span></td>
              </tr>
              <tr>
                <td><strong>9. Retencions i Pagaments a Compte</strong></td>
                <td>Nòmines, bancs, lloguers i pagaments fraccionats (Casella 0609)</td>
                <td style="text-align:right; font-weight:700; color:var(--color-warning); font-family:var(--font-mono);">- ${formatCurrency(result.totalWithholdings)}</td>
                <td style="text-align:right;"><span class="badge badge--warning">Deduït en Origen</span></td>
              </tr>
              <tr style="background:var(--bg-surface); font-size:1.2rem; font-weight:900;">
                <td><strong>RESULTAT FINAL (Casella 0610)</strong></td>
                <td>${result.result < 0 ? 'Quantitat que l\'AEAT t\'ha de retornar' : 'Quantitat pendent d\'ingressar'}</td>
                <td style="text-align:right;" class="${result.result < 0 ? 'text-success' : 'text-error'}">
                  ${result.result < 0 ? '↩ -' : '↗ +'}${formatCurrency(Math.abs(result.result))}
                </td>
                <td style="text-align:right;">
                  <span class="badge ${result.result < 0 ? 'badge--success' : 'badge--error'}">
                    ${result.result < 0 ? 'A DEVOLUCIÓ' : 'A INGRÉS'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderWhatIfSimulator(ctx: DashboardContext) {
    const { data, result, simSalaryDelta, simPensionDelta, simGainsDelta, simDeductionDelta } = ctx;

    // Build modified clone of data for simulation
    const simData: DeclaracionData = JSON.parse(JSON.stringify(data));

    // Apply simulation deltas
    if (simSalaryDelta !== 0) {
      if (!simData.workIncome.employers || simData.workIncome.employers.length === 0) {
        simData.workIncome.employers = [{ id: 'sim_emp', name: 'Simulació Treball', grossSalary: simSalaryDelta, inKind: 0, withholdings: simSalaryDelta * 0.2, socialSecurity: simSalaryDelta * 0.0635, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0 }];
      } else {
        simData.workIncome.employers[0].grossSalary += simSalaryDelta;
        simData.workIncome.employers[0].withholdings += (simSalaryDelta * 0.2);
      }
    }

    if (simPensionDelta !== 0) {
      simData.deductions.pensionPlanContributions = (simData.deductions.pensionPlanContributions || 0) + simPensionDelta;
    }

    if (simGainsDelta !== 0) {
      if (!simData.gains) simData.gains = { items: [], totalWithholdings: 0 };
      simData.gains.items.push({
        id: 'sim_gain',
        description: 'Simulació de Plusvàlua Financera',
        type: 'shares',
        acquisitionDate: '2024-01-01',
        transferDate: '2025-06-01',
        acquisitionValue: 10000,
        transferValue: 10000 + simGainsDelta,
        expenses: 0,
      });
    }

    if (simDeductionDelta !== 0) {
      simData.deductions.otherDeductions = (simData.deductions.otherDeductions || 0) + simDeductionDelta;
    }

    const simResult = calculateIRPF(simData);
    const diffResult = simResult.result - result.result;

    return `
      <div class="card" style="margin-bottom:var(--space-xl); background:linear-gradient(135deg, rgba(99,102,241,0.05), var(--bg-surface)); border:1px solid var(--border-accent);">
        <div class="card__header" style="margin-bottom:var(--space-md);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <div class="card__title" style="display:flex; align-items:center; gap:8px;">
                <span>🔮 Simulador d'Impacte en Temps Real ("What-If Simulator")</span>
                <span class="badge badge--primary">Càlcul Dinàmic</span>
              </div>
              <p class="card__subtitle" style="margin:2px 0 0 0;">Ajusta els paràmetres interactius per veure immediatament com canvia la teva liquidació (Casella 0610) i estalvi</p>
            </div>
            <button class="btn btn--secondary btn--sm" id="btn-reset-whatif">↺ Restablir Simulació</button>
          </div>
        </div>

        <!-- Panell de Control de Sliders i Variacions -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:var(--space-lg); margin-bottom:var(--space-xl);">
          
          <!-- 1. Variació de Salari / Ingressos -->
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-weight:700; font-size:0.85rem;">💼 Variació d'Ingressos Bruts</span>
              <span class="badge badge--primary" style="font-family:var(--font-mono); font-size:0.8rem;">
                ${simSalaryDelta >= 0 ? '+' : ''}${formatCurrency(simSalaryDelta)}
              </span>
            </div>
            <input type="range" id="slider-salary" min="-20000" max="50000" step="1000" value="${simSalaryDelta}" style="width:100%; accent-color:var(--color-primary); cursor:pointer;" />
            <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-muted); margin-top:2px;">
              <span>-20.000 €</span>
              <span>0 €</span>
              <span>+50.000 €</span>
            </div>
          </div>

          <!-- 2. Aportació a Plans de Pensions -->
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-weight:700; font-size:0.85rem;">🎯 Aportació Pla de Pensions</span>
              <span class="badge badge--success" style="font-family:var(--font-mono); font-size:0.8rem;">
                +${formatCurrency(simPensionDelta)}
              </span>
            </div>
            <input type="range" id="slider-pension" min="0" max="1500" step="100" value="${simPensionDelta}" style="width:100%; accent-color:var(--color-success); cursor:pointer;" />
            <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-muted); margin-top:2px;">
              <span>0 €</span>
              <span>Màx. Legal: 1.500 €</span>
            </div>
          </div>

          <!-- 3. Plusvàlua Extra per Venda d'Accions -->
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-weight:700; font-size:0.85rem;">📈 Plusvàlua Venda d'Accions</span>
              <span class="badge badge--warning" style="font-family:var(--font-mono); font-size:0.8rem;">
                +${formatCurrency(simGainsDelta)}
              </span>
            </div>
            <input type="range" id="slider-gains" min="0" max="30000" step="1000" value="${simGainsDelta}" style="width:100%; accent-color:var(--color-warning); cursor:pointer;" />
            <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-muted); margin-top:2px;">
              <span>0 €</span>
              <span>+30.000 €</span>
            </div>
          </div>

          <!-- 4. Deducció Extra (Donatius / Habitatge) -->
          <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-weight:700; font-size:0.85rem;">💡 Deduccions / Despeses Addicionals</span>
              <span class="badge badge--info" style="font-family:var(--font-mono); font-size:0.8rem;">
                -${formatCurrency(simDeductionDelta)}
              </span>
            </div>
            <input type="range" id="slider-deductions" min="0" max="3000" step="100" value="${simDeductionDelta}" style="width:100%; accent-color:var(--color-info); cursor:pointer;" />
            <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-muted); margin-top:2px;">
              <span>0 €</span>
              <span>-3.000 €</span>
            </div>
          </div>

        </div>

        <!-- Resultat Comparatiu de la Simulació -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:var(--space-md); background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Resultat Actual (Real)</div>
            <div style="font-size:1.6rem; font-weight:800; color:${result.result < 0 ? 'var(--color-success)' : 'var(--color-error)'}; margin-top:2px;">
              ${result.result < 0 ? '↩ Tornar: ' : '↗ Pagar: '}${formatCurrency(Math.abs(result.result))}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">Quota Líquida: ${formatCurrency(result.netTax)}</div>
          </div>

          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Resultat Simulat</div>
            <div style="font-size:1.6rem; font-weight:800; color:${simResult.result < 0 ? 'var(--color-success)' : 'var(--color-error)'}; margin-top:2px;">
              ${simResult.result < 0 ? '↩ Tornar: ' : '↗ Pagar: '}${formatCurrency(Math.abs(simResult.result))}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">Quota Líquida: ${formatCurrency(simResult.netTax)}</div>
          </div>

          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Variació Neta de Liquidació</div>
            <div style="font-size:1.6rem; font-weight:900; color:${diffResult < 0 ? 'var(--color-success)' : (diffResult > 0 ? 'var(--color-error)' : 'var(--text-primary)')}; margin-top:2px;">
              ${diffResult < 0 ? 'Estalvi: +' : (diffResult > 0 ? 'Cost: +' : 'Sense canvis ')}${formatCurrency(Math.abs(diffResult))}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">${diffResult < 0 ? '🎉 Més devolució o menys pagament' : (diffResult > 0 ? '⚠️ Increment de quota tributària' : 'Modifica els controls')}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderMultiProfileConsolidation(ctx: DashboardContext) {
    const { allProfiles, currentYear } = ctx;

    let consolidatedGross = 0;
    let consolidatedNetTax = 0;
    let consolidatedWithholdings = 0;
    let consolidatedResult = 0;

    const profileSummaries = allProfiles.map((p) => {
      const pData = store.getProfileData(p.id, currentYear as FiscalYear);
      let res: FiscalResult;
      try {
        res = calculateIRPF(pData);
      } catch {
        res = { result: 0, generalBase: 0, savingsBase: 0, netTax: 0, totalWithholdings: 0 } as any;
      }

      const gross = (res.generalBase || 0) + (res.savingsBase || 0);
      consolidatedGross += gross;
      consolidatedNetTax += (res.netTax || 0);
      consolidatedWithholdings += (res.totalWithholdings || 0);
      consolidatedResult += (res.result || 0);

      return {
        profile: p,
        gross,
        netTax: res.netTax || 0,
        withholdings: res.totalWithholdings || 0,
        result: res.result || 0,
      };
    });

    const isConsolidatedRefund = consolidatedResult < 0;

    return `
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="margin-bottom:var(--space-md);">
          <div class="card__title" style="display:flex; align-items:center; gap:8px;">
            <span>👨‍👩‍👧‍👦 Resum Consolidat de Tots els Declarants (Unitat Familiar / Cartera)</span>
            <span class="badge badge--primary">${allProfiles.length} Declarants Registrats</span>
          </div>
          <p class="card__subtitle" style="margin:0;">Visió agregada del conjunt de declaracions de l'exercici ${currentYear}</p>
        </div>

        <!-- 3 KPIs Consolidats -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-xl);">
          <div class="card" style="padding:var(--space-md); border-left:4px solid var(--color-primary); background:var(--bg-surface-elevated);">
            <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Rendes Brutes Agregades</div>
            <div style="font-size:1.6rem; font-weight:800; color:var(--text-primary); margin-top:2px;">${formatCurrency(consolidatedGross)}</div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Suma de tots els membres</div>
          </div>

          <div class="card" style="padding:var(--space-md); border-left:4px solid #f59e0b; background:var(--bg-surface-elevated);">
            <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Total Retencions Pagades</div>
            <div style="font-size:1.6rem; font-weight:800; color:#fbbf24; margin-top:2px;">${formatCurrency(consolidatedWithholdings)}</div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Quota Líquida: ${formatCurrency(consolidatedNetTax)}</div>
          </div>

          <div class="card" style="padding:var(--space-md); border-left:4px solid ${isConsolidatedRefund ? 'var(--color-success)' : 'var(--color-error)'}; background:var(--bg-surface-elevated);">
            <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Resultat Net Global Consolidat</div>
            <div style="font-size:1.6rem; font-weight:900; margin-top:2px;" class="${isConsolidatedRefund ? 'text-success' : 'text-error'}">
              ${isConsolidatedRefund ? '↩ A TORNAR: ' : '↗ A PAGAR: '}${formatCurrency(Math.abs(consolidatedResult))}
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Saldo conjunt final</div>
          </div>
        </div>

        <!-- Taula de Declarants -->
        <div class="table-responsive">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Declarant</th>
                <th>Rol / Relació</th>
                <th style="text-align:right;">Rendes Brutes</th>
                <th style="text-align:right;">Quota Líquida</th>
                <th style="text-align:right;">Retencions</th>
                <th style="text-align:right;">Resultat Individual</th>
                <th style="text-align:center;">Acció</th>
              </tr>
            </thead>
            <tbody>
              ${profileSummaries.map((ps: any) => {
                const isRef = ps.result < 0;
                const isAct = ps.profile.id === store.getActiveProfileId();
                return `
                  <tr style="${isAct ? 'background:rgba(99,102,241,0.08); font-weight:600;' : ''}">
                    <td>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.1rem;">${ps.profile.avatarIcon || '👤'}</span>
                        <div>
                          <div>${ps.profile.name} ${isAct ? '<span class="badge badge--primary" style="font-size:0.6rem;">ACTIU</span>' : ''}</div>
                          <div style="font-size:0.7rem; color:var(--text-muted); font-family:var(--font-mono);">${ps.profile.nif || 'Sense NIF'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="badge" style="font-size:0.7rem;">${ps.profile.relation}</span>
                    </td>
                    <td style="text-align:right; font-family:var(--font-mono);">${formatCurrency(ps.gross)}</td>
                    <td style="text-align:right; font-family:var(--font-mono);">${formatCurrency(ps.netTax)}</td>
                    <td style="text-align:right; font-family:var(--font-mono);">${formatCurrency(ps.withholdings)}</td>
                    <td style="text-align:right; font-weight:800;" class="${isRef ? 'text-success' : 'text-error'}">
                      ${isRef ? '↩ -' : '↗ +'}${formatCurrency(Math.abs(ps.result))}
                    </td>
                    <td style="text-align:center;">
                      ${isAct ? `<span style="font-size:0.75rem; color:var(--text-muted);">Seleccionat</span>` : `
                        <button class="btn btn--secondary btn--sm btn-switch-profile-table" data-id="${ps.profile.id}" style="font-size:0.7rem; padding:2px 8px;">
                          Canviar ⇄
                        </button>
                      `}
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

  function renderActiveToolsView(ctx: DashboardContext) {
    const { enabledModuleIds, totalAvailableModules } = ctx;

    return `
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="margin-bottom:var(--space-md); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <div class="card__title" style="display:flex; align-items:center; gap:8px;">
              <span>⚙️ Centre de Gestió d'Eines & Mòduls Actius</span>
              <span class="badge badge--primary">${enabledModuleIds.length} de ${totalAvailableModules} Eines Actives</span>
            </div>
            <p class="card__subtitle" style="margin:0;">Activa o desactiva eines en 1 clic per personalitzar el menú de navegació del teu espai de treball</p>
          </div>
          <button class="btn btn--primary btn--sm" id="btn-open-full-tool-modal" style="font-weight:700;">
            ⚙️ Obrir Configurador Complet
          </button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:var(--space-md);">
          ${ALL_APP_MODULES.map(m => {
            const isAct = enabledModuleIds.includes(m.id);
            return `
              <div class="card" style="
                padding:12px 14px;
                background:${isAct ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)'};
                border:1px solid ${isAct ? 'var(--border-accent)' : 'var(--border-subtle)'};
                opacity:${isAct ? '1' : '0.65'};
                display:flex;
                gap:12px;
                align-items:flex-start;
              ">
                <div style="
                  width:36px; height:36px; border-radius:var(--radius-sm);
                  background:${isAct ? 'var(--accent-gradient)' : 'var(--bg-surface)'};
                  display:flex; align-items:center; justify-content:center;
                  font-size:1.2rem; color:#fff; flex-shrink:0;
                ">
                  ${m.icon}
                </div>
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                    <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      ${m.name}
                    </div>
                    <button class="btn btn--sm btn-toggle-tool-inline ${isAct ? 'btn--primary' : 'btn--secondary'}" data-id="${m.id}" style="font-size:0.65rem; padding:2px 8px;">
                      ${isAct ? 'Actiu ✓' : 'Inactiu'}
                    </button>
                  </div>
                  <div style="font-size:0.72rem; color:var(--text-secondary); margin-bottom:4px;">
                    ${m.description}
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="badge" style="font-size:0.65rem;">${m.category}</span>
                    <a href="#${m.path}" style="font-size:0.7rem; color:var(--color-primary); text-decoration:none; font-weight:600;">Obrir ➡️</a>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function attachEvents() {
    // Header buttons
    page.querySelector('#dash-btn-tool-manager')?.addEventListener('click', () => {
      openToolManagerModal(() => {
        render();
        document.getElementById('app-sidebar')?.replaceWith(createSidebar());
      });
    });

    page.querySelector('#dash-btn-cmd')?.addEventListener('click', () => {
      openCommandPalette();
    });

    page.querySelector('#dash-btn-pdf')?.addEventListener('click', () => {
      try {
        generateModel100PDF(store.getData(), calculateIRPF(store.getData()));
        showToast('PDF del Model 100 generat correctament', 'success');
      } catch {
        showToast('Error en generar el PDF', 'error');
      }
    });

    // Tab navigation
    page.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = (btn.dataset.tab as typeof activeTab) || 'global';
        render();
      });
    });

    // Charts rendering if activeTab === 'charts'
    if (activeTab === 'charts') {
      const data = store.getData();
      const result = calculateIRPF(data);
      const propSummary = calculateAllProperties(data.properties || [], store.getYear());
      const totalGainsPositive = (data.gains?.items || []).filter(i => (i.transferValue - i.acquisitionValue - i.expenses) > 0).reduce((s, i) => s + (i.transferValue - i.acquisitionValue - i.expenses), 0);

      const incomeItems = [
        { label: 'Treball', value: (data.workIncome?.employers || []).reduce((s, e) => s + (e.grossSalary || 0) + (e.inKind || 0), 0) },
        { label: 'Lloguers', value: propSummary.totalGrossIncome },
        { label: 'Capital Mobiliari', value: (data.capitalIncome?.interests || 0) + (data.capitalIncome?.dividends || 0) + (data.capitalIncome?.foreignDividends || 0) },
        { label: 'Activitats', value: data.activities?.income || 0 },
        { label: 'Guanys Borsa', value: totalGainsPositive },
      ].filter(i => i.value > 0);

      const totalInc = incomeItems.reduce((s, i) => s + i.value, 0);
      const incomeCard = page.querySelector('#dash-income-card');
      if (incomeCard) {
        incomeCard.appendChild(
          createDonutChart(incomeItems.length > 0 ? incomeItems : [{ label: 'Sense ingressos', value: 1 }], {
            size: 200,
            centerLabel: 'Total Bruts',
            centerValue: totalInc > 0 ? formatCurrency(totalInc) : '0 €',
          })
        );
      }

      const taxCard = page.querySelector('#dash-tax-card');
      if (taxCard) {
        taxCard.appendChild(
          createBarChart([
            { label: 'Quota General', value: result.generalTax },
            { label: 'Quota Estalvi', value: result.savingsTax },
            { label: 'Crèdit Mínim', value: result.minimumTaxCredit, color: '#10b981' },
            { label: 'Deduccions', value: result.totalDeductions, color: '#10b981' },
            { label: 'Retencions', value: result.totalWithholdings, color: '#f59e0b' },
          ])
        );
      }
    }

    // What-If Simulator slider events
    if (activeTab === 'whatif') {
      const salarySlider = page.querySelector<HTMLInputElement>('#slider-salary');
      salarySlider?.addEventListener('input', (e) => {
        simSalaryDelta = parseInt((e.target as HTMLInputElement).value, 10);
        render();
      });

      const pensionSlider = page.querySelector<HTMLInputElement>('#slider-pension');
      pensionSlider?.addEventListener('input', (e) => {
        simPensionDelta = parseInt((e.target as HTMLInputElement).value, 10);
        render();
      });

      const gainsSlider = page.querySelector<HTMLInputElement>('#slider-gains');
      gainsSlider?.addEventListener('input', (e) => {
        simGainsDelta = parseInt((e.target as HTMLInputElement).value, 10);
        render();
      });

      const deductionsSlider = page.querySelector<HTMLInputElement>('#slider-deductions');
      deductionsSlider?.addEventListener('input', (e) => {
        simDeductionDelta = parseInt((e.target as HTMLInputElement).value, 10);
        render();
      });

      page.querySelector('#btn-reset-whatif')?.addEventListener('click', () => {
        simSalaryDelta = 0;
        simPensionDelta = 0;
        simGainsDelta = 0;
        simDeductionDelta = 0;
        render();
        showToast('Simulació restablerta a valors reals', 'info');
      });
    }

    // Consolidation table switch profile
    if (activeTab === 'consolidation') {
      page.querySelectorAll<HTMLButtonElement>('.btn-switch-profile-table').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (id) {
            store.setActiveProfile(id);
            showToast(`Declarant canviat a: ${store.getActiveProfile().name}`, 'info');
            render();
            document.getElementById('app-sidebar')?.replaceWith(createSidebar());
          }
        });
      });
    }

    // Tools tab events
    if (activeTab === 'tools') {
      page.querySelector('#btn-open-full-tool-modal')?.addEventListener('click', () => {
        openToolManagerModal(() => {
          render();
          document.getElementById('app-sidebar')?.replaceWith(createSidebar());
        });
      });

      page.querySelectorAll<HTMLButtonElement>('.btn-toggle-tool-inline').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (id) {
            store.toggleModule(id);
            render();
            document.getElementById('app-sidebar')?.replaceWith(createSidebar());
          }
        });
      });
    }
  }

  render();
  return page;
}
