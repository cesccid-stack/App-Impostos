/**
 * @module pages/activities
 * Activitats econòmiques (autònoms) form page i generador de Llibres Registre Oficials AEAT.
 */

import { store } from '../store.ts';
import { createField, createFormRow, createFormSection } from '../components/form-field.ts';
import { exportSalesBookCSV, exportExpensesBookCSV, type SalesBookEntry, type ExpensesBookEntry } from '../utils/activity-books-generator.ts';
import { showToast } from '../components/toast.ts';
import { runAutomatedComplianceChecks } from '../fiscal/auto-validator.ts';
import { openComplianceModal } from '../components/compliance-modal.ts';
import { calculateRETACotization } from '../fiscal/social-security-engine.ts';
import { formatCurrency } from '../utils/currency.ts';

export function renderActivities(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page';

  const data = store.getData();
  const a = data.activities;
  const compliance = runAutomatedComplianceChecks(data);
  const actIssues = compliance.issues.filter(i => i.module === 'activities' || i.id.includes('cross'));

  page.innerHTML = `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md);">
      <div>
        <h1 class="page-header__title" style="margin:0;">Activitats econòmiques</h1>
        <p class="page-header__subtitle" style="margin:4px 0 0 0;">Ingressos i despeses d'autònoms i llibres registre oficials de l'AEAT</p>
      </div>
      <button class="btn btn--secondary btn--sm" id="btn-open-act-compliance">
        🛡️ ${compliance.complianceScore}% Conformitat Fiscal
      </button>
    </div>

    ${actIssues.length > 0 ? `
      <div class="card" style="margin-bottom:var(--space-lg); padding:10px 16px; border-left:4px solid var(--color-warning); background:var(--bg-surface-elevated); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
        <div style="display:flex; align-items:center; gap:var(--space-sm);">
          <span style="font-size:1.2rem;">⚠️</span>
          <div>
            <strong style="font-size:var(--text-sm);">${actIssues[0].title}</strong>
            <p style="margin:0; font-size:0.75rem; color:var(--text-secondary);">${actIssues[0].message}</p>
          </div>
        </div>
        <button class="btn btn--primary btn--sm" id="btn-act-quick-autofix" style="font-size:0.75rem;">
          ⚡ Auto-Corregir / Sincronitzar
        </button>
      </div>
    ` : ''}
  `;

  page.querySelector('#btn-open-act-compliance')?.addEventListener('click', () => {
    openComplianceModal(() => {
      page.replaceWith(renderActivities());
    });
  });

  page.querySelector('#btn-act-quick-autofix')?.addEventListener('click', () => {
    openComplianceModal(() => {
      page.replaceWith(renderActivities());
    });
  });

  const updater = (field: keyof typeof a) => (val: string) => {
    store.update('activities', { [field]: parseFloat(val) || 0 });
  };

  // Estimation type
  const typeCard = document.createElement('div');
  typeCard.className = 'card';
  typeCard.appendChild(
    createFormSection(
      'Mètode d\'estimació',
      createField({
        id: 'estimation-type',
        label: 'Tipus d\'estimació',
        type: 'select',
        value: a.estimationType,
        options: [
          { value: 'direct_simplified', label: 'Estimació directa simplificada (5% despeses difícil justificació)' },
          { value: 'direct_normal', label: 'Estimació directa normal' },
        ],
        onChange: (val) => {
          store.update('activities', {
            estimationType: val as 'direct_simplified' | 'direct_normal',
          });
        },
      }),
    ),
  );
  page.appendChild(typeCard);

  // Income & expenses
  const incomeCard = document.createElement('div');
  incomeCard.className = 'card';
  incomeCard.appendChild(
    createFormSection(
      'Ingressos i despeses de l\'exercici',
      createFormRow(
        createField({
          id: 'activity-income',
          label: 'Ingressos íntegres facturats',
          value: a.income,
          suffix: '€',
          placeholder: '0,00',
          onChange: updater('income'),
        }),
        createField({
          id: 'activity-expenses',
          label: 'Despeses deduïbles d\'activitat',
          value: a.expenses,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Subministraments, material, serveis professionals...',
          onChange: updater('expenses'),
        }),
      ),
      createFormRow(
        createField({
          id: 'activity-ss',
          label: 'Quota autònom (Seguretat Social / RETA)',
          value: a.socialSecuritySelfEmployed,
          suffix: '€',
          placeholder: '0,00',
          onChange: updater('socialSecuritySelfEmployed'),
        }),
        createField({
          id: 'activity-withholdings',
          label: 'Retencions IRPF suportades (factures)',
          value: a.withholdings,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Retencions del 7% o 15% aplicades a les factures emeses',
          onChange: updater('withholdings'),
        }),
      ),
    ),
  );
  page.appendChild(incomeCard);

  // ═════════════════════════════════════════════════════════════
  // ASSISTENTS INTEL·LIGENTS DE DEDUCCIÓ PER A AUTÒNOMS (LIRPF)
  // ═════════════════════════════════════════════════════════════
  const helperCard = document.createElement('div');
  helperCard.className = 'card';
  helperCard.style.marginTop = 'var(--space-xl)';
  helperCard.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm); margin-bottom:var(--space-md);">
      <div>
        <h3 style="margin:0; font-size:var(--text-base); font-weight:700; display:flex; align-items:center; gap:6px;">
          <span>🧮</span> Assistent de Deduccions Especials per a Autònoms (Art. 30 LIRPF)
        </h3>
        <p style="margin:2px 0 0 0; font-size:var(--text-xs); color:var(--text-secondary);">
          Calcula automàticament despeses de teletreball i manutenció per incorporar-les directament a les despeses deduïbles
        </p>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:var(--space-md);">
      <!-- 1. Teletreball a l'habitatge habitual -->
      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="font-weight:700; font-size:var(--text-sm); margin-bottom:4px;">🏠 Subministraments Teletreball (Art. 30.2.5ª.b)</div>
          <p style="font-size:0.75rem; color:var(--text-muted); margin:0 0 10px 0;">
            Deducció del 30% a la proporció de m² afectes a l'activitat respecte a la superfície total de l'habitatge habitual.
          </p>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
            <div>
              <label class="form-label" style="font-size:0.7rem;">m² Despatx/Activitat</label>
              <input type="number" class="form-input" id="tele-m2-work" value="20" style="padding:4px 8px; font-size:0.8rem;">
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">m² Totals Habitatge</label>
              <input type="number" class="form-input" id="tele-m2-total" value="100" style="padding:4px 8px; font-size:0.8rem;">
            </div>
          </div>

          <div style="margin-bottom:8px;">
            <label class="form-label" style="font-size:0.7rem;">Despeses Anuals Llum, Aigua, Gas, Internet (€)</label>
            <input type="number" class="form-input" id="tele-supplies-total" value="2400" style="padding:4px 8px; font-size:0.8rem;">
          </div>

          <div style="background:var(--bg-surface); padding:6px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-size:0.75rem; color:var(--text-secondary);">Deducció Calculada (30% s/ràtio):</span>
            <strong style="color:var(--color-success); font-size:0.9rem;" id="tele-result-val">144,00 €</strong>
          </div>
        </div>

        <button class="btn btn--secondary btn--sm" id="btn-add-teleworking-expense" style="width:100%;">
          ➕ Incorporar a Despeses Deduïbles
        </button>
      </div>

      <!-- 2. Dietes i Manutenció -->
      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="font-weight:700; font-size:var(--text-sm); margin-bottom:4px;">🍽️ Dietes i Manutenció (Art. 30.2.5ª.c)</div>
          <p style="font-size:0.75rem; color:var(--text-muted); margin:0 0 10px 0;">
            Despeses d'àpats en establiments de restauració abonades per mitjans electrònics en municipi diferent.
          </p>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
            <div>
              <label class="form-label" style="font-size:0.7rem;">Dies a Espanya (26,67€/d)</label>
              <input type="number" class="form-input" id="diet-days-es" value="10" style="padding:4px 8px; font-size:0.8rem;">
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Dies Estranger (48,08€/d)</label>
              <input type="number" class="form-input" id="diet-days-intl" value="0" style="padding:4px 8px; font-size:0.8rem;">
            </div>
          </div>

          <div style="background:var(--bg-surface); padding:6px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; margin-top:28px;">
            <span style="font-size:0.75rem; color:var(--text-secondary);">Deducció Calculada:</span>
            <strong style="color:var(--color-success); font-size:0.9rem;" id="diet-result-val">266,70 €</strong>
          </div>
        </div>

        <button class="btn btn--secondary btn--sm" id="btn-add-diet-expense" style="width:100%;">
          ➕ Incorporar a Despeses Deduïbles
        </button>
      </div>
    </div>
  `;

  // Listeners del calculador de teletreball
  const calcTeleworking = () => {
    const m2Work = parseFloat((helperCard.querySelector('#tele-m2-work') as HTMLInputElement)?.value) || 0;
    const m2Total = parseFloat((helperCard.querySelector('#tele-m2-total') as HTMLInputElement)?.value) || 1;
    const supplies = parseFloat((helperCard.querySelector('#tele-supplies-total') as HTMLInputElement)?.value) || 0;
    const ratio = Math.min(1, Math.max(0, m2Work / m2Total));
    const ded = Math.round(supplies * ratio * 0.30 * 100) / 100;
    const resultEl = helperCard.querySelector('#tele-result-val');
    if (resultEl) resultEl.textContent = `${ded.toFixed(2)} €`;
    return ded;
  };

  const calcDiets = () => {
    const daysEs = parseFloat((helperCard.querySelector('#diet-days-es') as HTMLInputElement)?.value) || 0;
    const daysIntl = parseFloat((helperCard.querySelector('#diet-days-intl') as HTMLInputElement)?.value) || 0;
    const ded = Math.round(((daysEs * 26.67) + (daysIntl * 48.08)) * 100) / 100;
    const resultEl = helperCard.querySelector('#diet-result-val');
    if (resultEl) resultEl.textContent = `${ded.toFixed(2)} €`;
    return ded;
  };

  ['#tele-m2-work', '#tele-m2-total', '#tele-supplies-total'].forEach(id => {
    helperCard.querySelector(id)?.addEventListener('input', calcTeleworking);
  });

  ['#diet-days-es', '#diet-days-intl'].forEach(id => {
    helperCard.querySelector(id)?.addEventListener('input', calcDiets);
  });

  helperCard.querySelector('#btn-add-teleworking-expense')?.addEventListener('click', () => {
    const amount = calcTeleworking();
    if (amount > 0) {
      const currentExpenses = store.getData().activities.expenses || 0;
      store.update('activities', { expenses: currentExpenses + amount });
      showToast(`+${amount.toFixed(2)} € de despeses de teletreball afegides`, 'success');
      page.replaceWith(renderActivities());
    }
  });

  helperCard.querySelector('#btn-add-diet-expense')?.addEventListener('click', () => {
    const amount = calcDiets();
    if (amount > 0) {
      const currentExpenses = store.getData().activities.expenses || 0;
      store.update('activities', { expenses: currentExpenses + amount });
      showToast(`+${amount.toFixed(2)} € de despeses de manutenció afegides`, 'success');
      page.replaceWith(renderActivities());
    }
  });

  page.appendChild(helperCard);

  // ═════════════════════════════════════════════════════════════
  // OPTIMITZADOR RETA PER INGRESSOS REALS & REGULARITZACIÓ SS
  // ═════════════════════════════════════════════════════════════
  const retaCard = document.createElement('div');
  retaCard.className = 'card';
  retaCard.style.marginTop = 'var(--space-xl)';
  retaCard.style.borderTop = '4px solid #10b981';

  retaCard.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm); margin-bottom:var(--space-md);">
      <div>
        <h3 style="margin:0; font-size:var(--text-base); font-weight:700; display:flex; align-items:center; gap:6px;">
          <span>🏛️</span> Optimitzador RETA & Regularització de la Seguretat Social (Ingressos Reals)
        </h3>
        <p style="margin:2px 0 0 0; font-size:var(--text-xs); color:var(--text-secondary);">
          Nou sistema de cotització per trams (RD-Llei 13/2022). Calcula la teva base oficial, la quota recomanada i la regularització anual amb la Seguretat Social
        </p>
      </div>
      <span class="badge badge--success">RETA 2024-2026 (15 Trams)</span>
    </div>

    <!-- Opcions de l'autònom (Societari / Tarifa Plana / Quota Pagada) -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:var(--space-sm); margin-bottom:var(--space-md); background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
      <div>
        <label class="form-label" style="font-size:0.75rem;">Tipus d'Autònom</label>
        <select class="form-input" id="reta-autonomo-type" style="padding:6px 10px; font-size:0.85rem;">
          <option value="individual">Autònom Persona Física (Deducció genèrica 7%)</option>
          <option value="societario">Autònom Societari (Deducció genèrica 3% i base mín. 1.000€)</option>
        </select>
      </div>
      <div>
        <label class="form-label" style="font-size:0.75rem;">Règim de Bonificació</label>
        <select class="form-input" id="reta-flat-rate" style="padding:6px 10px; font-size:0.85rem;">
          <option value="standard">Règim General per Trams Reals</option>
          <option value="flat80">Tarifa Plana Nous Autònoms (80 €/mes)</option>
        </select>
      </div>
      <div>
        <label class="form-label" style="font-size:0.75rem;">Quota RETA Realment Pagada Anual (€)</label>
        <input type="number" class="form-input" id="reta-actual-paid" value="${a.socialSecuritySelfEmployed || 0}" placeholder="0,00" style="padding:6px 10px; font-size:0.85rem;" />
      </div>
    </div>

    <div id="reta-calculation-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:var(--space-md);">
      <!-- Contenidor dinàmic generat per renderRETACalculation() -->
    </div>
  `;

  const renderRETACalculation = () => {
    const isSocietario = (retaCard.querySelector('#reta-autonomo-type') as HTMLSelectElement)?.value === 'societario';
    const hasFlatRate = (retaCard.querySelector('#reta-flat-rate') as HTMLSelectElement)?.value === 'flat80';
    const actualPaid = parseFloat((retaCard.querySelector('#reta-actual-paid') as HTMLInputElement)?.value) || (a.socialSecuritySelfEmployed || 0);

    const retaResult = calculateRETACotization(
      a.income || 0,
      a.expenses || 0,
      actualPaid,
      isSocietario,
      hasFlatRate,
      data.year || 2024
    );

    const container = retaCard.querySelector('#reta-calculation-container');
    if (!container) return;

    const tram = retaResult.assignedTram;
    const diff = retaResult.regularizationDifferenceAnnual;
    const isUnderpaid = retaResult.regularizationStatus === 'underpaid_must_pay';
    const isOverpaid = retaResult.regularizationStatus === 'overpaid_refund_eligible';

    container.innerHTML = `
      <!-- Targeta 1: Tram Oficial i Quota Recomanada -->
      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:var(--text-sm); color:var(--text-primary);">📊 Tram de Cotització Oficial</strong>
            <span class="badge badge--primary" style="font-size:0.75rem;">Tram ${tram.tramNumber} de 15</span>
          </div>
          <div style="font-size:0.8rem; display:flex; flex-direction:column; gap:4px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-secondary);">Rendiment Net Computable:</span>
              <strong>${formatCurrency(retaResult.computableNetIncomeMonthly)} / mes</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted);">
              <span>Rang del Tram ${tram.tramNumber}:</span>
              <span>${formatCurrency(tram.minNetIncomeMonthly)} - ${tram.maxNetIncomeMonthly > 90000 ? '> 6.000 €' : formatCurrency(tram.maxNetIncomeMonthly)}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-secondary);">Base Mínima Cotització:</span>
              <span>${formatCurrency(retaResult.recommendedBaseMonthly)} / mes</span>
            </div>
            <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border-default); padding-top:4px; font-weight:700; color:var(--color-primary); font-size:0.9rem;">
              <span>Quota RETA Recomanada:</span>
              <span>${formatCurrency(retaResult.recommendedMonthlyQuota)} / mes (${formatCurrency(retaResult.recommendedAnnualQuota)} / any)</span>
            </div>
          </div>
        </div>
        <button class="btn btn--secondary btn--sm" id="btn-sync-reta-to-activity" style="width:100%; font-weight:600;">
          ⚡ Sincronitzar Quota a Despeses IRPF (${formatCurrency(retaResult.recommendedAnnualQuota)})
        </button>
      </div>

      <!-- Targeta 2: Regularització Anual amb la Seguretat Social -->
      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid ${isUnderpaid ? 'var(--color-error)' : isOverpaid ? 'var(--color-success)' : 'var(--border-subtle)'}; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:var(--text-sm); color:var(--text-primary);">⚖️ Regularització Anual Seguretat Social</strong>
            <span class="badge ${isUnderpaid ? 'badge--error' : isOverpaid ? 'badge--success' : 'badge--primary'}" style="font-size:0.75rem;">
              ${isUnderpaid ? '⚠️ Quota Insuficient' : isOverpaid ? '↩ Excés de Cotització' : '✅ En Equilibri'}
            </span>
          </div>
          <div style="font-size:0.8rem; display:flex; flex-direction:column; gap:4px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-secondary);">Quota Abonada Real:</span>
              <span>${formatCurrency(actualPaid)}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-secondary);">Quota Segons Rendiments Reals:</span>
              <span>${formatCurrency(retaResult.recommendedAnnualQuota)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border-default); padding-top:4px; font-weight:700; font-size:0.9rem; color:${isUnderpaid ? 'var(--color-error)' : isOverpaid ? 'var(--color-success)' : 'var(--text-primary)'};">
              <span>${isUnderpaid ? '⚠️ Ingrés Complementari Exigible:' : isOverpaid ? '↩ Devolució d\'Ofici Estimada:' : 'Diferència Regularització:'}</span>
              <span>${formatCurrency(Math.abs(diff))}</span>
            </div>
          </div>
        </div>
        <div style="font-size:0.7rem; color:var(--text-muted); background:var(--bg-surface); padding:6px 8px; border-radius:var(--radius-sm);">
          ${isUnderpaid 
            ? `⚠️ Segons la teva facturació has cotitzat per sota del teu tram real. La Seguretat Social et notificarà la liquidació de la diferència (${formatCurrency(diff)}).`
            : isOverpaid 
            ? `💡 Has cotitzat per sobre del tram mínim corresponent als teus ingressos reals. Pots sol·licitar la devolució de l'excés (${formatCurrency(Math.abs(diff))}) o mantenir la base més alta.`
            : `✅ Les quotes cotitzades coincideixen amb el tram assignat pels teus rendiments nets d'activitat.`}
        </div>
      </div>
    `;

    retaCard.querySelector('#btn-sync-reta-to-activity')?.addEventListener('click', () => {
      store.update('activities', { socialSecuritySelfEmployed: retaResult.recommendedAnnualQuota });
      showToast(`Quota de Seguretat Social actualitzada a ${formatCurrency(retaResult.recommendedAnnualQuota)}`, 'success');
      page.replaceWith(renderActivities());
    });
  };

  ['#reta-autonomo-type', '#reta-flat-rate'].forEach(id => {
    retaCard.querySelector(id)?.addEventListener('change', renderRETACalculation);
  });
  retaCard.querySelector('#reta-actual-paid')?.addEventListener('input', renderRETACalculation);

  renderRETACalculation();
  page.appendChild(retaCard);

  // ═════════════════════════════════════════════════════════════
  // SECCIÓ VINCULACIÓ AMB EL MÒDUL D'IVA (MODEL 303/390)
  // ═════════════════════════════════════════════════════════════
  const ivaLinkCard = document.createElement('div');
  ivaLinkCard.className = 'card';
  ivaLinkCard.style.marginTop = 'var(--space-xl)';
  ivaLinkCard.style.borderTop = '4px solid var(--color-primary)';
  const ivaData = store.getIVA();
  const issuedCount = ivaData.issuedInvoices.length;
  const receivedCount = ivaData.receivedInvoices.length;

  ivaLinkCard.innerHTML = `
    <div class="card__header" style="margin-bottom:var(--space-md); display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-sm);">
      <div>
        <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
          <span>🧾 Vinculació amb el Mòdul de Gestió de l'IVA</span>
          <span class="badge badge--primary">Model 303 / 390</span>
        </div>
        <p class="card__subtitle" style="margin:4px 0 0 0;">
          Sincronització bidireccional entre la facturació de l'activitat i les autoliquidacions trimestrals d'IVA
        </p>
      </div>
      <button class="btn btn--primary btn--sm" id="btn-goto-iva">
        🚀 Obrir Mòdul d'IVA
      </button>
    </div>

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-md);">
      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
        <div style="font-size:0.75rem; color:var(--text-muted);">Factures al Llibre d'IVA</div>
        <div style="font-size:1.2rem; font-weight:bold; margin-top:2px;">
          ${issuedCount} emeses / ${receivedCount} rebudes
        </div>
      </div>
      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; gap:var(--space-xs); align-items:center;">
        <button class="btn btn--secondary btn--sm" id="btn-sync-to-iva-from-act" style="flex:1;">
          📥 Sincronitzar cap a l'IVA
        </button>
        <button class="btn btn--secondary btn--sm" id="btn-sync-from-iva-to-act" style="flex:1;">
          📤 Carregar des de l'IVA
        </button>
      </div>
    </div>
  `;

  ivaLinkCard.querySelector('#btn-goto-iva')?.addEventListener('click', () => {
    window.location.hash = '/iva';
  });

  ivaLinkCard.querySelector('#btn-sync-to-iva-from-act')?.addEventListener('click', () => {
    const res = store.syncIVAFromActivities();
    showToast(`Sincronitzat amb èxit amb el Mòdul d'IVA (+${res.addedIssued} factures emeses, +${res.addedReceived} rebudes)`, 'success');
    page.replaceWith(renderActivities());
  });

  ivaLinkCard.querySelector('#btn-sync-from-iva-to-act')?.addEventListener('click', () => {
    store.syncActivitiesFromIVA();
    showToast('Ingressos i despeses actualitzats des del Llibre d\'IVA', 'success');
    page.replaceWith(renderActivities());
  });

  page.appendChild(ivaLinkCard);

  // ═════════════════════════════════════════════════════════════
  // SECCIÓ LLIBRES REGISTRE OFICIALS AEAT (Ordre HAC/773/2019)
  // ═════════════════════════════════════════════════════════════
  const booksCard = document.createElement('div');
  booksCard.className = 'card';
  booksCard.style.marginTop = 'var(--space-xl)';
  booksCard.innerHTML = `
    <div class="card__header" style="margin-bottom:var(--space-md); display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-sm);">
      <div>
        <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
          <span>📚 Llibres Registre Oficials de l'AEAT (Ordre HAC/773/2019)</span>
          <span class="badge badge--primary">Obligatori Autònoms</span>
        </div>
        <p class="card__subtitle" style="margin:4px 0 0 0;">
          Generació i descàrrega dels llibres oficials normalitzats exigits per l'Agència Tributària en cas d'inspecció
        </p>
      </div>
    </div>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:var(--space-md);">
      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <h4 style="margin:0 0 4px 0; font-size:var(--text-sm);">1. Llibre de Vendes i Ingressos</h4>
          <p style="font-size:0.75rem; color:var(--text-muted); margin:0 0 var(--space-md) 0;">Detall de factures emeses amb base imposable, IVA i retenció IRPF.</p>
        </div>
        <button class="btn btn--secondary btn--sm" id="btn-export-sales-book">📥 Exportar CSV Vendes</button>
      </div>

      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <h4 style="margin:0 0 4px 0; font-size:var(--text-sm);">2. Llibre de Compres i Despeses</h4>
          <p style="font-size:0.75rem; color:var(--text-muted); margin:0 0 var(--space-md) 0;">Detall de despeses deduïbles amb NIF de proveïdors i IVA suportat.</p>
        </div>
        <button class="btn btn--secondary btn--sm" id="btn-export-expenses-book">📥 Exportar CSV Despeses</button>
      </div>
    </div>
  `;

  booksCard.querySelector('#btn-export-sales-book')?.addEventListener('click', () => {
    let sales: SalesBookEntry[] = [];
    if (data.iva?.issuedInvoices && data.iva.issuedInvoices.length > 0) {
      sales = data.iva.issuedInvoices.map(inv => ({
        date: inv.date || `${data.year}-03-15`,
        invoiceNumber: inv.invoiceNumber || `F-${data.year}-001`,
        clientName: inv.clientName || 'Client Principal SL',
        clientNif: inv.clientNif || 'B-65432109',
        concept: inv.concept || 'Serveis professionals',
        taxableBase: inv.taxableBase || 0,
        vatRate: inv.vatRate || 21,
        vatAmount: inv.vatAmount || ((inv.taxableBase || 0) * (inv.vatRate || 21) / 100),
        withholdingRate: inv.withholdingRate || 0,
        withholdingAmount: inv.withholdingAmount || 0,
        totalInvoice: inv.totalInvoice || ((inv.taxableBase || 0) + (inv.vatAmount || 0)),
      }));
    } else {
      sales = [
        {
          date: `${data.year}-03-15`,
          invoiceNumber: `F-${data.year}-001`,
          clientName: 'Client Principal SL',
          clientNif: 'B-65432109',
          concept: 'Serveis professionals de consultoria',
          taxableBase: a.income > 0 ? a.income : 5000,
          vatRate: 21,
          vatAmount: (a.income > 0 ? a.income : 5000) * 0.21,
          withholdingRate: 15,
          withholdingAmount: (a.income > 0 ? a.income : 5000) * 0.15,
          totalInvoice: (a.income > 0 ? a.income : 5000) * 1.06,
        }
      ];
    }
    exportSalesBookCSV(sales);
    showToast(`Llibre de Vendes i Ingressos exportat (${sales.length} registres)`, 'success');
  });

  booksCard.querySelector('#btn-export-expenses-book')?.addEventListener('click', () => {
    let expenses: ExpensesBookEntry[] = [];
    if (data.iva?.receivedInvoices && data.iva.receivedInvoices.length > 0) {
      expenses = data.iva.receivedInvoices.map(inv => ({
        date: inv.date || `${data.year}-02-10`,
        invoiceNumber: inv.invoiceNumber || 'INV-001',
        supplierName: inv.supplierName || 'Proveïdor',
        supplierNif: inv.supplierNif || 'A-00000000',
        concept: inv.concept || 'Despesa d\'activitat',
        deductibleExpenseIRPF: inv.taxableBase || 0,
        vatDeductible: inv.vatAmount || ((inv.taxableBase || 0) * (inv.vatRate || 21) / 100),
        totalExpense: inv.totalInvoice || ((inv.taxableBase || 0) + (inv.vatAmount || 0)),
      }));
    } else {
      expenses = [
        {
          date: `${data.year}-02-10`,
          invoiceNumber: 'INV-2024-88',
          supplierName: 'Proveïdor Tecnològic SA',
          supplierNif: 'A-28824360',
          concept: 'Software, servidors i material d\'oficina',
          deductibleExpenseIRPF: a.expenses > 0 ? a.expenses : 1200,
          vatDeductible: (a.expenses > 0 ? a.expenses : 1200) * 0.21,
          totalExpense: (a.expenses > 0 ? a.expenses : 1200) * 1.21,
        }
      ];
    }
    exportExpensesBookCSV(expenses);
    showToast(`Llibre de Compres i Despeses exportat (${expenses.length} registres)`, 'success');
  });

  page.appendChild(booksCard);

  // Auto-save info
  const infoBar = document.createElement('div');
  infoBar.style.cssText =
    'text-align:center;padding:var(--space-lg) 0;color:var(--text-muted);font-size:var(--text-xs);';
  infoBar.textContent = '💾 Les dades es guarden automàticament';
  page.appendChild(infoBar);

  return page;
}
