/**
 * @module pages/wizard
 * Assistent Guiat Pas a Pas per a la Declaració de la Renda.
 */

import { store } from '../store.ts';
import { calculateIRPF } from '../fiscal/irpf.ts';
import { formatCurrency } from '../utils/currency.ts';

export function renderWizard(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page';

  let currentStep = 1;
  const totalSteps = 6;

  const stepTitles = [
    '1. Dades Personals i Família',
    '2. Rendiments del Treball',
    '3. Immobles i Lloguers',
    '4. Estalvi i Inversions',
    '5. Deduccions Estatals i de Catalunya',
    '6. Resum Final i Liquidació',
  ];

  function renderCurrentStep() {
    const data = store.getData();
    const result = calculateIRPF(data);

    page.innerHTML = `
      <div class="page-header">
        <h1 class="page-header__title">🧙 Assistent Guiat Pas a Pas</h1>
        <p class="page-header__subtitle">Completa la teva declaració de la renda de forma guiada i optimitzada</p>
      </div>

      <!-- Barra de Progrés -->
      <div class="card" style="margin-bottom:var(--space-xl); background:var(--bg-surface-elevated);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-xs); font-size:var(--text-sm);">
          <strong>Pas ${currentStep} de ${totalSteps}: ${stepTitles[currentStep - 1]}</strong>
          <span style="color:var(--text-muted); font-weight:600;">${Math.round((currentStep / totalSteps) * 100)}% completat</span>
        </div>
        <div style="background:var(--bg-surface); height:8px; border-radius:var(--radius-full); overflow:hidden; border:1px solid var(--border-default);">
          <div style="background:var(--accent-gradient); width:${(currentStep / totalSteps) * 100}%; height:100%; transition:width var(--transition-base);"></div>
        </div>
      </div>

      <!-- Contingut del Pas -->
      <div class="card" id="wizard-step-card" style="margin-bottom:var(--space-xl);">
        ${getStepHtml(currentStep, data, result)}
      </div>

      <!-- Botons de Navegació del Wizard -->
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <button class="btn btn--secondary" id="wiz-prev-btn" ${currentStep === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
          ⬅️ Anterior
        </button>
        <div style="display:flex; gap:var(--space-sm);">
          ${currentStep === totalSteps ? `
            <button class="btn btn--primary" id="wiz-finish-btn">
              🎉 Anar al Resultat Completa
            </button>
          ` : `
            <button class="btn btn--primary" id="wiz-next-btn">
              Següent ➡️
            </button>
          `}
        </div>
      </div>
    `;

    // Listeners
    page.querySelector('#wiz-prev-btn')?.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        renderCurrentStep();
      }
    });

    page.querySelector('#wiz-next-btn')?.addEventListener('click', () => {
      if (currentStep < totalSteps) {
        currentStep++;
        renderCurrentStep();
      }
    });

    page.querySelector('#wiz-finish-btn')?.addEventListener('click', () => {
      window.location.hash = '#/resultat';
    });

    attachStepEvents(currentStep, page);
  }

  renderCurrentStep();
  return page;
}

function getStepHtml(step: number, data: ReturnType<typeof store.getData>, result: ReturnType<typeof calculateIRPF>): string {
  switch (step) {
    case 1:
      return `
        <h3>1. Dades Personals i Familiars</h3>
        <p style="color:var(--text-muted); font-size:var(--text-sm);">Configura l'edat, comunitat autònoma i fills a càrrec per calcular el mínim exempt d'impostos.</p>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-md); margin-top:var(--space-md);">
          <div>
            <label class="form-label">Edat del declarant</label>
            <input type="number" class="form-input" id="wiz-age" value="${data.personal.age}">
          </div>
          <div>
            <label class="form-label">Comunitat Autònoma</label>
            <select class="form-input" id="wiz-community">
              <option value="CAT" selected>Catalunya</option>
              <option value="MAD">Madrid</option>
              <option value="VAL">Comunitat Valenciana</option>
              <option value="AND">Andalucía</option>
            </select>
          </div>
          <div>
            <label class="form-label">Grau de discapacitat (%)</label>
            <input type="number" class="form-input" id="wiz-disability" value="${data.personal.disability}">
          </div>
        </div>
      `;
    case 2:
      const totalSalary = (data.workIncome.employers || []).reduce((s, e) => s + (e.grossSalary || 0), 0);
      const totalSS = (data.workIncome.employers || []).reduce((s, e) => s + (e.socialSecurity || 0), 0);
      return `
        <h3>2. Rendiments del Treball (Nòmines)</h3>
        <p style="color:var(--text-muted); font-size:var(--text-sm);">Introdueix els sous bruts i cotitzacions de la Seguretat Social de les teves nòmines.</p>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:var(--space-md); margin-top:var(--space-md);">
          <div>
            <label class="form-label">Sou Brut Anual Total (€)</label>
            <input type="number" step="0.01" class="form-input" id="wiz-salary" value="${totalSalary}">
          </div>
          <div>
            <label class="form-label">Cotitzacions Seguretat Social (€)</label>
            <input type="number" step="0.01" class="form-input" id="wiz-ss" value="${totalSS}">
          </div>
          <div>
            <label class="form-label">Quotes sindicals / Col·legis (€)</label>
            <input type="number" step="0.01" class="form-input" id="wiz-union" value="${data.workIncome.unionFees || 0}">
          </div>
        </div>
      `;
    case 3:
      return `
        <h3>3. Immobles i Lloguers</h3>
        <p style="color:var(--text-muted); font-size:var(--text-sm);">Gestiona els teus immobles en lloguer i beneficia't de les reduccions de la Llei 12/2023 i amortitzacions de la taula simplificada AEAT (fins al 30%).</p>
        <div style="margin-top:var(--space-md); background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md);">
          <div>Tens <strong>${(data.properties || []).length} immobles</strong> registrats amb una amortització total de <strong>${formatCurrency(result.netTax >= 0 ? 0 : 0)}</strong>.</div>
          <div style="margin-top:var(--space-sm);">
            <a href="#/immobles" class="btn btn--secondary btn--sm">🏢 Obrir Gestor d'Immobles i Extracontable</a>
          </div>
        </div>
      `;
    case 4:
      return `
        <h3>4. Estalvi, Dividends i Guanys Patrimonials</h3>
        <p style="color:var(--text-muted); font-size:var(--text-sm);">Interessos bancaris, dividends nacionals/estrangers (W-8BEN) i transmissions d'accions per mètode FIFO.</p>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-md); margin-top:var(--space-md);">
          <div>
            <label class="form-label">Interessos de comptes / dipòsits (€)</label>
            <input type="number" step="0.01" class="form-input" id="wiz-interests" value="${data.capitalIncome.interests || 0}">
          </div>
          <div>
            <label class="form-label">Dividends nacionals (€)</label>
            <input type="number" step="0.01" class="form-input" id="wiz-dividends" value="${data.capitalIncome.dividends || 0}">
          </div>
          <div>
            <label class="form-label">Dividends estrangers (€) (Casella 0588)</label>
            <input type="number" step="0.01" class="form-input" id="wiz-foreign-div" value="${data.capitalIncome.foreignDividends || 0}">
          </div>
          <div>
            <label class="form-label">Retenció estrangera pagada (€)</label>
            <input type="number" step="0.01" class="form-input" id="wiz-foreign-tax" value="${data.capitalIncome.foreignTaxWithheld || 0}">
          </div>
        </div>
      `;
    case 5:
      return `
        <h3>5. Deduccions Estatals i Autonòmiques (Catalunya)</h3>
        <p style="color:var(--text-muted); font-size:var(--text-sm);">Aplica deduccions per donatius Llei 49/2002 (80%), lloguer d'habitatge habitual a Catalunya, naixements i plans de pensions.</p>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:var(--space-md); margin-top:var(--space-md);">
          <div>
            <label class="form-label">Aportacions a Plans de Pensions (€)</label>
            <input type="number" step="0.01" class="form-input" id="wiz-pension" value="${data.deductions.pensionPlanContributions || 0}">
          </div>
          <div>
            <label class="form-label">Lloguer satisfet a Catalunya (€)</label>
            <input type="number" step="0.01" class="form-input" id="wiz-cat-rent" value="${data.deductions.catalanRentalAmount || 0}">
          </div>
        </div>
      `;
    case 6:
      const isRefund = result.result < 0;
      return `
        <div style="text-align:center; padding:var(--space-lg) 0;">
          <div style="font-size:3.5rem; margin-bottom:var(--space-sm);">${isRefund ? '🎉' : '📑'}</div>
          <h2>Liquidació de la Declaració de la Renda (${data.year})</h2>
          <div style="font-size:var(--text-3xl); font-weight:800; margin:var(--space-md) 0;" class="${isRefund ? 'text-success' : 'text-error'}">
            ${isRefund ? 'A TORNAR: ' : 'A PAGAR: '} ${formatCurrency(Math.abs(result.result))}
          </div>
          <div style="max-width:550px; margin:0 auto; color:var(--text-secondary); font-size:var(--text-sm);">
            Base Imposable General: <strong>${formatCurrency(result.generalBase)}</strong> | Base de l'Estalvi: <strong>${formatCurrency(result.savingsBase)}</strong><br>
            Quota Líquida: <strong>${formatCurrency(result.netTax)}</strong> | Retencions practicades: <strong>${formatCurrency(result.totalWithholdings)}</strong>
          </div>
        </div>
      `;
    default:
      return '';
  }
}

function attachStepEvents(step: number, page: HTMLElement): void {
  if (step === 1) {
    page.querySelector('#wiz-age')?.addEventListener('change', (e) => {
      store.update('personal', { age: parseInt((e.target as HTMLInputElement).value) || 35 });
    });
    page.querySelector('#wiz-disability')?.addEventListener('change', (e) => {
      store.update('personal', { disability: parseInt((e.target as HTMLInputElement).value) || 0 });
    });
  } else if (step === 2) {
    page.querySelector('#wiz-salary')?.addEventListener('change', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value) || 0;
      const emps = [...(store.getData().workIncome.employers || [])];
      if (emps.length === 0) {
        emps.push({ id: crypto.randomUUID(), name: 'Empresa', grossSalary: val, inKind: 0, withholdings: val * 0.15, socialSecurity: val * 0.0635, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0 });
      } else {
        emps[0].grossSalary = val;
      }
      store.update('workIncome', { employers: emps });
    });
    page.querySelector('#wiz-union')?.addEventListener('change', (e) => {
      store.update('workIncome', { unionFees: parseFloat((e.target as HTMLInputElement).value) || 0 });
    });
  } else if (step === 4) {
    page.querySelector('#wiz-interests')?.addEventListener('change', (e) => {
      store.update('capitalIncome', { interests: parseFloat((e.target as HTMLInputElement).value) || 0 });
    });
    page.querySelector('#wiz-dividends')?.addEventListener('change', (e) => {
      store.update('capitalIncome', { dividends: parseFloat((e.target as HTMLInputElement).value) || 0 });
    });
    page.querySelector('#wiz-foreign-div')?.addEventListener('change', (e) => {
      store.update('capitalIncome', { foreignDividends: parseFloat((e.target as HTMLInputElement).value) || 0 });
    });
    page.querySelector('#wiz-foreign-tax')?.addEventListener('change', (e) => {
      store.update('capitalIncome', { foreignTaxWithheld: parseFloat((e.target as HTMLInputElement).value) || 0 });
    });
  } else if (step === 5) {
    page.querySelector('#wiz-pension')?.addEventListener('change', (e) => {
      store.update('deductions', { pensionPlanContributions: parseFloat((e.target as HTMLInputElement).value) || 0 });
    });
    page.querySelector('#wiz-cat-rent')?.addEventListener('change', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value) || 0;
      store.update('deductions', { catalanRentalAmount: val, catalanRentalDeduction: val > 0 });
    });
  }
}
