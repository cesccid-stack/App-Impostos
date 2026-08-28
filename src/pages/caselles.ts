/**
 * @module pages/caselles
 * Mapa Oficial de Caselles AEAT 2025/2026 (Model 100 Renda, Model 303 IVA, Model 714 Patrimoni).
 * Permet consultar, cercar, verificar i copiar directament cada valor cap a la Renta WEB de l'AEAT.
 */

import { store } from '../store.ts';
import { calculateIRPF } from '../fiscal/irpf.ts';
import { calculateModel390Annual } from '../fiscal/iva-engine.ts';
import { initializeEmptyIVAData } from '../fiscal/iva-integration.ts';
import { formatCurrency } from '../utils/currency.ts';
import { showToast } from '../components/toast.ts';
import { escapeHtml } from '../utils/dom.ts';
import type { DeclaracionData, FiscalResult } from '../types.ts';
import type { Model390AnnualSummary, Model303QuarterResult } from '../types-iva.ts';

export interface CasellaItem {
  model: '100' | '303' | '714' | '720';
  category: string;
  boxNumber: string;
  title: string;
  legalBasis: string;
  computedValue: number;
  routePath: string;
  notes?: string;
}

export function renderCasellesPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container';

  let selectedModelFilter: 'all' | '100' | '303' | '714' = 'all';
  let selectedCategoryFilter: string = 'all';
  let searchQuery: string = '';

  function render() {
    const data = store.getData();
    const result = calculateIRPF(data);
    const currentYear = store.getYear();
    const ivaSummary = calculateModel390Annual(data.iva || initializeEmptyIVAData(), currentYear);
    const activeProfile = store.getActiveProfile();

    const allCaselles = buildCasellesList(data, result, ivaSummary);


    const filteredCaselles = allCaselles.filter((c) => {
      const matchModel = selectedModelFilter === 'all' || c.model === selectedModelFilter;
      const matchCat = selectedCategoryFilter === 'all' || c.category === selectedCategoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        c.boxNumber.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.legalBasis.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q);

      return matchModel && matchCat && matchQuery;
    });

    const categories = Array.from(new Set(allCaselles.map((c) => c.category)));

    page.innerHTML = `
      <!-- Capçalera -->
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-xl);">
        <div>
          <div style="display:flex; align-items:center; gap:var(--space-sm); margin-bottom:4px;">
            <h1 class="page-header__title" style="margin:0;">🗺️ Mapa Oficial de Caselles AEAT</h1>
            <span class="badge badge--primary" style="font-size:0.8rem;">Exercici ${currentYear}</span>
            <span class="badge badge--info" style="font-size:0.8rem;">${activeProfile.name}</span>
          </div>
          <p class="page-header__subtitle" style="margin:0;">
            Correspondència oficial de codis de casella (Model 100 IRPF, Model 303 IVA, Model 714) per a la Renta WEB
          </p>
        </div>
        <div style="display:flex; gap:var(--space-sm); flex-wrap:wrap;">
          <button class="btn btn--secondary btn--sm" id="btn-export-caselles-csv">
            📊 Exportar CSV Caselles
          </button>
          <button class="btn btn--secondary btn--sm" id="btn-export-caselles-copy-all">
            📋 Copiar Resum Portapapers
          </button>
          <a href="#/resultat" class="btn btn--primary btn--sm" style="font-weight:700;">
            🧮 Veure Liquidació Final
          </a>
        </div>
      </div>

      <!-- Targeta Destacada de Casella 0610 (Resultat) -->
      <div class="card" style="margin-bottom:var(--space-xl); background:linear-gradient(135deg, var(--bg-surface-elevated), var(--bg-surface)); border:1px solid var(--border-accent);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-lg);">
          <div>
            <div style="font-size:var(--text-xs); text-transform:uppercase; font-weight:700; color:var(--text-accent); letter-spacing:0.05em;">
              Casella Clau Model 100 — 0610 (Resultat de la declaració)
            </div>
            <div style="font-size:2.25rem; font-weight:800; margin:4px 0;" class="${result.result < 0 ? 'text-success' : 'text-error'}">
              ${result.result < 0 ? '↩ A TORNAR: ' : '↗ A INGRESSAR: '} ${formatCurrency(Math.abs(result.result))}
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary);">
              Art. 97 LIRPF | Quota líquida: ${formatCurrency(result.netTax)} | Pagaments a compte (0609): ${formatCurrency(result.totalWithholdings)}
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="btn btn--secondary btn--sm" id="btn-copy-0610">
              📋 Copiar Casella 0610
            </button>
          </div>
        </div>
      </div>

      <!-- Filtres i Cerca -->
      <div class="card" style="margin-bottom:var(--space-xl); padding:var(--space-md); background:var(--bg-surface-elevated);">
        <div style="display:flex; flex-wrap:wrap; gap:var(--space-md); justify-content:space-between; align-items:center;">
          <!-- Cerca -->
          <div style="flex:1; min-width:240px; position:relative;">
            <input
              type="text"
              id="caselles-search-input"
              class="form-input"
              placeholder="🔍 Cerca per codi de casella (ex: 0022, 0610), concepte, base legal..."
              value="${searchQuery}"
              style="width:100%; padding-left:36px;"
            />
            <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); opacity:0.5;">🔍</span>
          </div>

          <!-- Filtre per Model -->
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="filter-pill ${selectedModelFilter === 'all' ? 'active' : ''}" data-model="all">Tots (${allCaselles.length})</button>
            <button class="filter-pill ${selectedModelFilter === '100' ? 'active' : ''}" data-model="100">Model 100 (Renda)</button>
            <button class="filter-pill ${selectedModelFilter === '303' ? 'active' : ''}" data-model="303">Model 303 (IVA)</button>
            <button class="filter-pill ${selectedModelFilter === '714' ? 'active' : ''}" data-model="714">Model 714 (Patrimoni)</button>
          </div>

          <!-- Filtre per Categoria -->
          <div>
            <select class="form-select" id="caselles-category-select" style="font-size:var(--text-xs); padding:6px 10px;">
              <option value="all" ${selectedCategoryFilter === 'all' ? 'selected' : ''}>Totes les Seccions (${allCaselles.length})</option>
              ${categories.map((cat) => `
                <option value="${cat}" ${selectedCategoryFilter === cat ? 'selected' : ''}>${cat}</option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Taula de Caselles -->
      <div class="card" style="padding:0; overflow:hidden;">
        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; margin:0;">
            <thead>
              <tr style="background:var(--bg-surface-elevated);">
                <th style="width:90px;">Casella</th>
                <th style="width:80px;">Model</th>
                <th>Descripció Oficial AEAT</th>
                <th style="width:140px;">Base Legal</th>
                <th style="text-align:right; width:130px;">Valor Calculat</th>
                <th style="text-align:center; width:140px;">Accions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCaselles.length > 0 ? filteredCaselles.map((c) => {
                const isNonZero = Math.abs(c.computedValue) > 0.001;
                return `
                  <tr style="${isNonZero ? 'background:rgba(99,102,241,0.03);' : ''}">
                    <td>
                      <span class="badge ${isNonZero ? 'badge--primary' : 'badge--secondary'}" style="font-family:var(--font-mono); font-weight:700; font-size:0.8rem;">
                        [${escapeHtml(c.boxNumber)}]
                      </span>
                    </td>
                    <td>
                      <span class="badge badge--info" style="font-size:0.7rem;">M.${escapeHtml(c.model)}</span>
                    </td>
                    <td>
                      <div style="font-weight:600; font-size:var(--text-sm); color:var(--text-primary);">${escapeHtml(c.title)}</div>
                      <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(c.category)} ${c.notes ? `• ${escapeHtml(c.notes)}` : ''}</div>
                    </td>
                    <td>
                      <span style="font-size:0.75rem; color:var(--text-secondary); font-family:var(--font-mono);">${escapeHtml(c.legalBasis)}</span>
                    </td>
                    <td style="text-align:right; font-family:var(--font-mono); font-weight:${isNonZero ? '700' : '400'}; color:${isNonZero ? 'var(--text-primary)' : 'var(--text-muted)'}; font-size:var(--text-sm);">
                      ${formatCurrency(c.computedValue)}
                    </td>
                    <td style="text-align:center;">
                      <div style="display:inline-flex; gap:4px;">
                        <button
                          class="btn btn--secondary btn--sm btn-copy-single-box"
                          data-box="${escapeHtml(c.boxNumber)}"
                          data-val="${c.computedValue}"
                          title="Copiar valor exactat al portapapers"
                          style="padding:4px 8px; font-size:0.75rem;"
                        >
                          📋 Copiar
                        </button>
                        <a
                          href="#${escapeHtml(c.routePath)}"
                          class="btn btn--ghost btn--sm"
                          title="Editar dades d'aquest apartat"
                          style="padding:4px 8px; font-size:0.75rem;"
                        >
                          ✏️
                        </a>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted);">
                    No s'han trobat caselles amb aquest filtre.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Listeners with event delegation
    page.querySelector('#caselles-search-input')?.addEventListener('input', (e) => {
      searchQuery = (e.target as HTMLInputElement).value;
      render();
    });

    page.querySelectorAll('.filter-pill[data-model]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedModelFilter = (btn.getAttribute('data-model') as 'all' | '100' | '303' | '714') || 'all';
        render();
      });
    });

    page.querySelector('#caselles-category-select')?.addEventListener('change', (e) => {
      selectedCategoryFilter = (e.target as HTMLSelectElement).value;
      render();
    });

    // Delegated copy single box handler
    page.querySelector('#caselles-table')?.addEventListener('click', (e) => {
      const copyBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('.btn-copy-single-box');
      if (copyBtn) {
        const box = copyBtn.getAttribute('data-box');
        const val = copyBtn.getAttribute('data-val');
        if (box && val !== null) {
          navigator.clipboard?.writeText(val);
          showToast(`Casella [${box}] valor (${formatCurrency(parseFloat(val))}) copiat!`, 'success');
        }
      }
    });

    // Copy 0610
    page.querySelector('#btn-copy-0610')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(String(result.result));
      showToast(`Resultat Casella [0610] (${formatCurrency(result.result)}) copiat!`, 'success');
    });

    // Export CSV
    page.querySelector('#btn-export-caselles-csv')?.addEventListener('click', () => {
      exportCasellesToCSV(allCaselles);
    });

    // Copy all summary
    page.querySelector('#btn-export-caselles-copy-all')?.addEventListener('click', () => {
      const summaryText = allCaselles
        .filter((c) => Math.abs(c.computedValue) > 0.001)
        .map((c) => `[Casella ${c.boxNumber}] ${c.title}: ${formatCurrency(c.computedValue)} (${c.legalBasis})`)
        .join('\n');

      navigator.clipboard?.writeText(summaryText);
      showToast('Resum complet de caselles copiat al portapapers!', 'success');
    });
  }

  render();
  return page;
}

function buildCasellesList(data: DeclaracionData, result: FiscalResult, ivaSummary: Model390AnnualSummary): CasellaItem[] {
  const workGross = (data.workIncome?.employers || []).reduce((s: number, e) => s + (e.grossSalary || 0) + (e.inKind || 0), 0);
  const workSS = (data.workIncome?.employers || []).reduce((s: number, e) => s + (e.socialSecurity || 0), 0);
  const workUnion = data.workIncome?.unionFees || 0;
  const workExpenses = workSS + workUnion + (data.workIncome?.otherDeductible || 0);
  const workNet = workGross - workExpenses;

  const propGross = (data.properties || []).reduce((s: number, p) => s + (p.grossRentalIncome || 0), 0);
  const propExp = (data.properties || []).reduce((s: number, p) => s + (p.mortgageInterests || 0) + (p.repairExpenses || 0) + (p.ibi || 0) + (p.communityFees || 0), 0);
  const propNet = Math.max(0, propGross - propExp);

  const actGross = data.activities?.income || 0;
  const actExp = (data.activities?.expenses || 0) + (data.activities?.socialSecuritySelfEmployed || 0);
  const actNet = actGross - actExp;

  const mobInt = data.capitalIncome?.interests || 0;
  const mobDiv = (data.capitalIncome?.dividends || 0) + (data.capitalIncome?.foreignDividends || 0);

  return [
    // ── Model 100: Rendiments del Treball ────────────────────────
    { model: '100', category: 'Rendiments del Treball', boxNumber: '0001', title: 'Retribucions dineràries íntegres', legalBasis: 'Art. 17 LIRPF', computedValue: workGross, routePath: '/treball' },
    { model: '100', category: 'Rendiments del Treball', boxNumber: '0011', title: 'Cotitzacions a la Seguretat Social', legalBasis: 'Art. 19.2.a LIRPF', computedValue: workSS, routePath: '/treball' },
    { model: '100', category: 'Rendiments del Treball', boxNumber: '0012', title: 'Quotes satisfetes a sindicats i col·legis', legalBasis: 'Art. 19.2.d LIRPF', computedValue: workUnion, routePath: '/treball' },
    { model: '100', category: 'Rendiments del Treball', boxNumber: '0018', title: 'Total despeses deduïbles del treball', legalBasis: 'Art. 19 LIRPF', computedValue: workExpenses, routePath: '/treball' },
    { model: '100', category: 'Rendiments del Treball', boxNumber: '0019', title: 'Rendiment net del treball', legalBasis: 'Art. 19 LIRPF', computedValue: workNet, routePath: '/treball' },
    { model: '100', category: 'Rendiments del Treball', boxNumber: '0022', title: 'Rendiment net reduït del treball', legalBasis: 'Art. 20 LIRPF', computedValue: workNet, routePath: '/treball' },

    // ── Model 100: Capital Mobiliari ────────────────────────────
    { model: '100', category: 'Capital Mobiliari', boxNumber: '0027', title: 'Interessos de comptes i dipòsits', legalBasis: 'Art. 25.2 LIRPF', computedValue: mobInt, routePath: '/capital' },
    { model: '100', category: 'Capital Mobiliari', boxNumber: '0029', title: 'Dividends i participació en beneficis', legalBasis: 'Art. 25.1 LIRPF', computedValue: mobDiv, routePath: '/capital' },
    { model: '100', category: 'Capital Mobiliari', boxNumber: '0037', title: 'Rendiment net del capital mobiliari a integrar a l\'estalvi', legalBasis: 'Art. 25 LIRPF', computedValue: mobInt + mobDiv, routePath: '/capital' },

    // ── Model 100: Capital Immobiliari ──────────────────────────
    { model: '100', category: 'Capital Immobiliari', boxNumber: '0102', title: 'Ingressos íntegres per arrendament d\'immobles', legalBasis: 'Art. 22 LIRPF', computedValue: propGross, routePath: '/immobles' },
    { model: '100', category: 'Capital Immobiliari', boxNumber: '0115', title: 'Despeses deduïbles (interessos, IBI, comunitat)', legalBasis: 'Art. 23.1 LIRPF', computedValue: propExp, routePath: '/immobles' },
    { model: '100', category: 'Capital Immobiliari', boxNumber: '0156', title: 'Rendiment net del capital immobiliari', legalBasis: 'Art. 24 LIRPF', computedValue: propNet, routePath: '/immobles' },

    // ── Model 100: Activitats Econòmiques ───────────────────────
    { model: '100', category: 'Activitats Econòmiques', boxNumber: '0181', title: 'Ingressos d\'explotació d\'activitats econòmiques', legalBasis: 'Art. 28 LIRPF', computedValue: actGross, routePath: '/activitats' },
    { model: '100', category: 'Activitats Econòmiques', boxNumber: '0220', title: 'Total despeses deduïbles d\'activitats', legalBasis: 'Art. 30 LIRPF', computedValue: actExp, routePath: '/activitats' },
    { model: '100', category: 'Activitats Econòmiques', boxNumber: '0235', title: 'Rendiment net d\'activitats econòmiques (estimació directa)', legalBasis: 'Art. 30 LIRPF', computedValue: actNet, routePath: '/activitats' },

    // ── Model 100: Bases Imposables i Liquidables ───────────────
    { model: '100', category: 'Bases Imposables', boxNumber: '0435', title: 'Base imposable general', legalBasis: 'Art. 48 LIRPF', computedValue: result.generalBase, routePath: '/resultat' },
    { model: '100', category: 'Bases Imposables', boxNumber: '0460', title: 'Base imposable de l\'estalvi', legalBasis: 'Art. 49 LIRPF', computedValue: result.savingsBase, routePath: '/resultat' },
    { model: '100', category: 'Bases Liquidables', boxNumber: '0495', title: 'Reducció per tributació conjunta', legalBasis: 'Art. 84 LIRPF', computedValue: result.jointTaxationReduction || 0, routePath: '/comparador' },
    { model: '100', category: 'Bases Liquidables', boxNumber: '0500', title: 'Base liquidable general', legalBasis: 'Art. 50 LIRPF', computedValue: result.liquidableGeneralBase, routePath: '/resultat' },
    { model: '100', category: 'Bases Liquidables', boxNumber: '0510', title: 'Base liquidable de l\'estalvi', legalBasis: 'Art. 51 LIRPF', computedValue: result.liquidableSavingsBase, routePath: '/resultat' },

    // ── Model 100: Mínim Personal i Familiar ────────────────────
    { model: '100', category: 'Mínims Familiars', boxNumber: '0511', title: 'Mínim del contribuent', legalBasis: 'Art. 57 LIRPF', computedValue: 5550, routePath: '/personal' },
    { model: '100', category: 'Mínims Familiars', boxNumber: '0513', title: 'Mínim per descendents', legalBasis: 'Art. 58 LIRPF', computedValue: Math.max(0, result.totalMinimum - 5550), routePath: '/personal' },
    { model: '100', category: 'Mínims Familiars', boxNumber: '0520', title: 'Total mínim personal i familiar', legalBasis: 'Art. 56 LIRPF', computedValue: result.totalMinimum, routePath: '/personal' },

    // ── Model 100: Quotes Íntegres i Deduccions ─────────────────
    { model: '100', category: 'Quotes Íntegres', boxNumber: '0545', title: 'Quota íntegra estatal', legalBasis: 'Art. 63 LIRPF', computedValue: result.generalTax / 2, routePath: '/resultat' },
    { model: '100', category: 'Quotes Íntegres', boxNumber: '0546', title: 'Quota íntegra autonòmica', legalBasis: 'Art. 74 LIRPF', computedValue: result.generalTax / 2, routePath: '/resultat' },
    { model: '100', category: 'Quotes Íntegres', boxNumber: '0552', title: 'Suma de quotes íntegres', legalBasis: 'Art. 62 LIRPF', computedValue: result.generalTax + result.savingsTax, routePath: '/resultat' },
    { model: '100', category: 'Deduccions', boxNumber: '0588', title: 'Doble imposició internacional', legalBasis: 'Art. 80 LIRPF', computedValue: result.foreignTaxCredit || 0, routePath: '/capital' },
    { model: '100', category: 'Deduccions', boxNumber: '0595', title: 'Total deduccions generals i autonòmiques', legalBasis: 'Art. 68/77 LIRPF', computedValue: result.totalDeductions, routePath: '/deduccions' },
    { model: '100', category: 'Liquidació Final', boxNumber: '0599', title: 'Quota líquida total', legalBasis: 'Art. 79 LIRPF', computedValue: result.netTax, routePath: '/resultat' },
    { model: '100', category: 'Liquidació Final', boxNumber: '0609', title: 'Pagaments a compte i retencions deduïdes', legalBasis: 'Art. 99 LIRPF', computedValue: result.totalWithholdings, routePath: '/resultat' },
    { model: '100', category: 'Liquidació Final', boxNumber: '0610', title: 'Resultat de la declaració (A ingressar / A tornar)', legalBasis: 'Art. 97 LIRPF', computedValue: result.result, routePath: '/resultat', notes: 'Casella clau de liquidació final' },
    ...(data.complementary?.isComplementary ? [
      { model: '100' as const, category: 'Declaració Complementària', boxNumber: '0120', title: 'Justificant declaració originària', legalBasis: 'Art. 122 LGT', computedValue: 1, routePath: '/resultat', notes: `Ref: ${data.complementary.previousReceiptNumber || 'Pendent'}` },
      { model: '100' as const, category: 'Declaració Complementària', boxNumber: '0611', title: 'Import ingressat / retornat prèviament', legalBasis: 'Art. 122 LGT', computedValue: data.complementary.previousResult || 0, routePath: '/resultat' },
      { model: '100' as const, category: 'Declaració Complementària', boxNumber: '0612', title: 'Resultat diferencial efectiu a ingressar', legalBasis: 'Art. 122 LGT', computedValue: result.finalAmountDue || (result.result - (data.complementary.previousResult || 0)), routePath: '/resultat' },
    ] : []),

    // ── Model 303: Gestió d'IVA Trimestral ───────────────────────
    { model: '303', category: 'IVA Devengat', boxNumber: '01', title: 'Base imposable al 21% (Règim General)', legalBasis: 'Art. 90 LIVA', computedValue: ivaSummary.totalGeneralRegimeBase || 0, routePath: '/iva' },
    { model: '303', category: 'IVA Devengat', boxNumber: '03', title: 'Quota meritada al 21%', legalBasis: 'Art. 90 LIVA', computedValue: ivaSummary.totalDevengado || 0, routePath: '/iva' },
    { model: '303', category: 'IVA Devengat', boxNumber: '27', title: 'Total quota meritada d\'IVA', legalBasis: 'Art. 91 LIVA', computedValue: ivaSummary.totalDevengado || 0, routePath: '/iva' },
    { model: '303', category: 'IVA Deduïble', boxNumber: '28', title: 'Base d\'operacions interiors corrents', legalBasis: 'Art. 92 LIVA', computedValue: ivaSummary.totalVolumeOperations || 0, routePath: '/iva' },
    { model: '303', category: 'IVA Deduïble', boxNumber: '29', title: 'Quota deduïble en operacions interiors', legalBasis: 'Art. 92 LIVA', computedValue: ivaSummary.totalDeducible || 0, routePath: '/iva' },
    { model: '303', category: 'IVA Deduïble', boxNumber: '45', title: 'Total quotes suportades deduïbles', legalBasis: 'Art. 99 LIVA', computedValue: ivaSummary.totalDeducible || 0, routePath: '/iva' },
    { model: '303', category: 'Liquidació IVA', boxNumber: '46', title: 'Resultat del règim general (Meritat - Deduïble)', legalBasis: 'Art. 100 LIVA', computedValue: (ivaSummary.totalDevengado || 0) - (ivaSummary.totalDeducible || 0), routePath: '/iva' },
    { model: '303', category: 'Liquidació IVA', boxNumber: '70', title: 'A deduir: Ingrés efectuat en autoliquidacions complementàries anteriors', legalBasis: 'Art. 70 M303', computedValue: (data.iva?.quarters ? Object.values(data.iva.quarters).reduce((s: number, q: Model303QuarterResult) => s + (q.previousResultIngressat || 0), 0) : 0), routePath: '/iva' },
    { model: '303', category: 'Liquidació IVA', boxNumber: '71', title: 'Resultat final liquidació Model 303 / 390', legalBasis: 'Art. 167 LIVA', computedValue: ivaSummary.totalAnnualResult || 0, routePath: '/iva' },

    // ── Model 714: Impost sobre el Patrimoni ────────────────────
    { model: '714', category: 'Patrimoni Net', boxNumber: 'PN01', title: 'Valor total dels béns i drets', legalBasis: 'Art. 9 LIP', computedValue: (data.wealth?.assets || []).reduce((s: number, a) => s + (a.grossValue || 0), 0), routePath: '/patrimoni' },
    { model: '714', category: 'Patrimoni Net', boxNumber: 'PN02', title: 'Deutes deduïbles de la base imposable', legalBasis: 'Art. 13 LIP', computedValue: (data.wealth?.debts || []).reduce((s: number, d) => s + (d.amount || 0), 0), routePath: '/patrimoni' },
  ];
}

function exportCasellesToCSV(caselles: CasellaItem[]): void {
  const headers = ['Model', 'Casella', 'Categoria', 'Descripcio', 'Base_Legal', 'Valor_Calculat'];
  const rows = caselles.map((c) => [
    `Model ${c.model}`,
    `[${c.boxNumber}]`,
    `"${c.category}"`,
    `"${c.title.replace(/"/g, '""')}"`,
    `"${c.legalBasis}"`,
    c.computedValue.toFixed(2),
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Mapa_Caselles_AEAT_${store.getYear()}_${store.getActiveProfile().name.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Fitxer CSV de caselles descarregat!', 'success');
}
