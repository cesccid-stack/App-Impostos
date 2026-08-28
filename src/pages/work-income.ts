/**
 * @module pages/work-income
 * Rendiments del treball form page amb múltiples pagadors, Art. 7.p i rendiments irregulars (Art. 18.2).
 */

import { store } from '../store.ts';
import { createField, createFormRow, createFormSection } from '../components/form-field.ts';
import { showToast } from '../components/toast.ts';
import { runAutomatedComplianceChecks } from '../fiscal/auto-validator.ts';
import { openComplianceModal } from '../components/compliance-modal.ts';
import { calculateEmployeeSalaryCost, type EmployeeRegimeType } from '../fiscal/social-security-engine.ts';
import { formatCurrency } from '../utils/currency.ts';
import type { EmployerItem } from '../types.ts';

export function renderWorkIncome(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page';

  const data = store.getData();
  const w = data.workIncome;
  const compliance = runAutomatedComplianceChecks(data);
  const workIssues = compliance.issues.filter(i => i.id.startsWith('work') || i.id.startsWith('pension'));

  const totalGrossSalary = (w.employers || []).reduce((acc, e) => acc + (e.grossSalary || 0), 0);

  page.innerHTML = `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md);">
      <div>
        <h1 class="page-header__title" style="margin:0;">Rendiments del treball</h1>
        <p class="page-header__subtitle" style="margin:4px 0 0 0;">Salaris, múltiples pagadors, exempció 7.p a l'estranger, deducció Seguretat Social i Cost d'Empresa</p>
      </div>
      <button class="btn btn--secondary btn--sm" id="btn-open-work-compliance">
        🛡️ ${compliance.complianceScore}% Auditoria Fiscal
      </button>
    </div>

    ${workIssues.length > 0 ? `
      <div class="card" style="margin-bottom:var(--space-lg); padding:10px 16px; border-left:4px solid var(--color-warning); background:var(--bg-surface-elevated); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
        <div style="display:flex; align-items:center; gap:var(--space-sm);">
          <span style="font-size:1.2rem;">⚠️</span>
          <div>
            <strong style="font-size:var(--text-sm);">${workIssues[0].title}</strong>
            <p style="margin:0; font-size:0.75rem; color:var(--text-secondary);">${workIssues[0].message}</p>
          </div>
        </div>
        <button class="btn btn--secondary btn--sm" id="btn-work-compliance-modal-trigger" style="font-size:0.75rem;">
          🔍 Veure Diagnòstic
        </button>
      </div>
    ` : ''}
  `;

  page.querySelector('#btn-open-work-compliance')?.addEventListener('click', () => {
    openComplianceModal();
  });
  page.querySelector('#btn-work-compliance-modal-trigger')?.addEventListener('click', () => {
    openComplianceModal();
  });

  // Global deductible expenses
  const expensesCard = document.createElement('div');
  expensesCard.className = 'card';
  expensesCard.appendChild(
    createFormSection(
      'Despeses globals deduïbles i reduccions especials',
      createFormRow(
        createField({
          id: 'union-fees',
          label: 'Quotes sindicals',
          value: w.unionFees,
          suffix: '€',
          placeholder: '0,00',
          onChange: (val) => store.update('workIncome', { unionFees: parseFloat(val) || 0 }),
        }),
        createField({
          id: 'other-deductible',
          label: 'Altres despeses deduïbles',
          value: w.otherDeductible,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Defensa jurídica, mobilitat geogràfica, etc.',
          onChange: (val) => store.update('workIncome', { otherDeductible: parseFloat(val) || 0 }),
        }),
      ),
      createFormRow(
        createField({
          id: 'pension-contributions',
          label: 'Aportacions a plans de pensions (empresa)',
          value: w.pensionContributions,
          suffix: '€',
          placeholder: '0,00',
          onChange: (val) => store.update('workIncome', { pensionContributions: parseFloat(val) || 0 }),
        }),
      ),
      createFormRow(
        createField({
          id: 'foreign-work-7p',
          label: 'Exempció treballs a l\'estranger (Art. 7.p LIRPF)',
          value: w.foreignWorkExemption7p || 0,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Sous per treballs efectius a l\'estranger per a empreses no residents (màx. 60.100 €)',
          onChange: (val) => store.update('workIncome', { foreignWorkExemption7p: parseFloat(val) || 0 }),
        }),
        createField({
          id: 'irregular-income',
          label: 'Rendiments irregulars o > 2 anys (Art. 18.2 LIRPF)',
          value: w.irregularIncomeAmount || 0,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Bonus plurianuals, indemnitzacions >180k (s\'aplicarà reducció del 30%)',
          onChange: (val) => store.update('workIncome', { irregularIncomeAmount: parseFloat(val) || 0 }),
        }),
      ),
    ),
  );
  page.appendChild(expensesCard);

  // ═════════════════════════════════════════════════════════════
  // CALCULADORA DE SEGURETAT SOCIAL I COST LABORAL D'EMPRESA
  // ═════════════════════════════════════════════════════════════
  const salaryCard = document.createElement('div');
  salaryCard.className = 'card';
  salaryCard.style.marginTop = 'var(--space-lg)';
  salaryCard.style.borderTop = '4px solid #6366f1';

  salaryCard.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm); margin-bottom:var(--space-md);">
      <div>
        <h3 style="margin:0; font-size:var(--text-base); font-weight:700; display:flex; align-items:center; gap:6px;">
          <span>💼</span> Anàlisi de Seguretat Social & Cost Total Laboral d'Empresa
        </h3>
        <p style="margin:2px 0 0 0; font-size:var(--text-xs); color:var(--text-secondary);">
          Compara el Sou Net a percebre, les cotitzacions del treballador (~6,47% deduïbles a l'IRPF) i el cost addicional de la Seguretat Social a càrrec de l'empresa (~31,40%)
        </p>
      </div>
      <span class="badge badge--primary">Règim General</span>
    </div>

    <!-- Controls de simulació ràpida -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-sm); margin-bottom:var(--space-md); background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
      <div>
        <label class="form-label" style="font-size:0.75rem;">Sou Brut Anual a Simular</label>
        <input type="number" class="form-input" id="calc-ss-gross" value="${totalGrossSalary > 0 ? totalGrossSalary : 30000}" style="padding:6px 10px; font-size:0.85rem;" />
      </div>
      <div>
        <label class="form-label" style="font-size:0.75rem;">Retenció IRPF Nòmina (%)</label>
        <input type="number" class="form-input" id="calc-ss-irpf-rate" value="15" min="0" max="45" step="0.5" style="padding:6px 10px; font-size:0.85rem;" />
      </div>
      <div>
        <label class="form-label" style="font-size:0.75rem;">Règim Laboral / Sector</label>
        <select class="form-input" id="calc-ss-contract" style="padding:6px 10px; font-size:0.85rem;">
          <option value="private_indefinite">🏢 Sector Privat - Indefinit (Atur 1.55% / 5.50%)</option>
          <option value="private_temporary">🏢 Sector Privat - Temporal (Atur 1.60% / 6.70%)</option>
          <option value="public_civil_servant">🏛️ Funcionari Públic - Règim General (Exempt d'Atur 0% i FOGASA 0%)</option>
          <option value="public_muface_a1">🏛️ Funcionari Classes Passives - MUFACE (Grup A1)</option>
          <option value="public_muface_a2">🏛️ Funcionari Classes Passives - MUFACE (Grup A2)</option>
          <option value="public_muface_c1">🏛️ Funcionari Classes Passives - MUFACE (Grup C1)</option>
          <option value="public_muface_c2">🏛️ Funcionari Classes Passives - MUFACE (Grup C2)</option>
        </select>
      </div>
      <div>
        <label class="form-label" style="font-size:0.75rem;">Nombre de Pagues</label>
        <select class="form-input" id="calc-ss-payments" style="padding:6px 10px; font-size:0.85rem;">
          <option value="12">12 pagues mensuals</option>
          <option value="14">14 pagues (amb extres)</option>
        </select>
      </div>
    </div>

    <div id="salary-breakdown-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:var(--space-md);">
      <!-- Contenidor dinàmic generat per renderSalaryBreakdown() -->
    </div>
  `;

  const renderSalaryBreakdown = () => {
    const grossVal = parseFloat((salaryCard.querySelector('#calc-ss-gross') as HTMLInputElement)?.value) || 0;
    const irpfRate = parseFloat((salaryCard.querySelector('#calc-ss-irpf-rate') as HTMLInputElement)?.value) || 0;
    const regime = ((salaryCard.querySelector('#calc-ss-contract') as HTMLSelectElement)?.value || 'private_indefinite') as EmployeeRegimeType;
    const payments = parseInt((salaryCard.querySelector('#calc-ss-payments') as HTMLSelectElement)?.value || '12', 10) as 12 | 14;

    const breakdown = calculateEmployeeSalaryCost(grossVal, irpfRate, regime, data.year || 2024, payments);
    const container = salaryCard.querySelector('#salary-breakdown-container');
    if (!container) return;

    container.innerHTML = `
      <!-- Targeta 1: Nòmina i Butxaca del Treballador -->
      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:var(--text-sm); color:var(--text-primary);">👤 Nòmina del Treballador</strong>
            <span class="badge badge--success" style="font-size:0.7rem;">${formatCurrency(breakdown.netSalaryMonthly)} / mes</span>
          </div>
          <div style="font-size:0.8rem; display:flex; flex-direction:column; gap:4px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-secondary);">Sou Brut Anual:</span>
              <strong>${formatCurrency(breakdown.grossSalaryAnnual)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; color:var(--color-error);">
              <span>- ${breakdown.isClassesPassives ? 'Drets Passius + MUFACE:' : breakdown.isCivilServant ? 'Seguretat Social Funcionari (~4,92%):' : 'Seguretat Social (~6,47%):'}</span>
              <span>-${formatCurrency(breakdown.totalEmployeeSSAnnual)}</span>
            </div>
            ${breakdown.isCivilServant && !breakdown.isClassesPassives ? `
              <div style="font-size:0.75rem; color:var(--color-success); padding-left:8px;">
                ✓ Atur: 0,00 € (Exempt de cotització segons Art. 264 LGSS)
              </div>
            ` : ''}
            ${breakdown.isClassesPassives ? `
              <div style="font-size:0.75rem; color:var(--text-muted); padding-left:8px;">
                • Drets Passius: ${formatCurrency(breakdown.employeePassiveRightsAnnual)} | MUFACE: ${formatCurrency(breakdown.employeeMutualismAnnual)}
              </div>
            ` : ''}
            <div style="display:flex; justify-content:space-between; color:var(--color-warning);">
              <span>- Retenció IRPF (${breakdown.irpfWithholdingRate}%):</span>
              <span>-${formatCurrency(breakdown.irpfWithholdingAnnual)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border-default); padding-top:4px; font-weight:700; color:var(--color-success); font-size:0.9rem;">
              <span>= Salari Net Líquid Anual:</span>
              <span>${formatCurrency(breakdown.netSalaryAnnual)}</span>
            </div>
          </div>
        </div>
        <div style="font-size:0.7rem; color:var(--text-muted); background:var(--bg-surface); padding:6px 8px; border-radius:var(--radius-sm);">
          💡 La quota de Seguretat Social / Drets Passius / MUFACE (${formatCurrency(breakdown.totalEmployeeSSAnnual)}) és 100% deduïble a la Casella 0013 de l'IRPF.
        </div>
      </div>

      <!-- Targeta 2: Cost Laboral d'Empresa / Administració -->
      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:var(--text-sm); color:var(--text-primary);">${breakdown.isCivilServant ? '🏛️ Cost per a l\'Administració Pública' : '🏢 Cost Laboral per a l\'Empresa'}</strong>
            <span class="badge badge--primary" style="font-size:0.7rem;">${formatCurrency(breakdown.totalCompanyCostMonthly)} / mes</span>
          </div>
          <div style="font-size:0.8rem; display:flex; flex-direction:column; gap:4px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-secondary);">Sou Brut Anual:</span>
              <span>${formatCurrency(breakdown.grossSalaryAnnual)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; color:#6366f1;">
              <span>+ Quota Patronal ${breakdown.isCivilServant ? '(~24,8%)' : '(~31,4%)'}:</span>
              <strong>+${formatCurrency(breakdown.totalEmployerSSAnnual)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); padding-left:8px;">
              <span>• Contingències comunes / Estat:</span>
              <span>${formatCurrency(breakdown.employerCommonContingencies)}</span>
            </div>
            ${!breakdown.isCivilServant ? `
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); padding-left:8px;">
                <span>• Atur + FOGASA + Formació:</span>
                <span>${formatCurrency(breakdown.employerUnemployment + breakdown.employerFOGASA + breakdown.employerTraining)}</span>
              </div>
            ` : `
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--color-success); padding-left:8px;">
                <span>• Atur & FOGASA Administració:</span>
                <span>0,00 € (Exempt)</span>
              </div>
            `}
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); padding-left:8px;">
              <span>• MEI / Formació:</span>
              <span>${formatCurrency(breakdown.employerMEI + breakdown.employerTraining)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border-default); padding-top:4px; font-weight:700; color:var(--text-primary); font-size:0.9rem;">
              <span>= Cost Total ${breakdown.isCivilServant ? 'Administració:' : 'd\'Empresa:'}</span>
              <span>${formatCurrency(breakdown.totalCompanyCostAnnual)}</span>
            </div>
          </div>
        </div>
        <div style="font-size:0.7rem; color:var(--text-muted); background:var(--bg-surface); padding:6px 8px; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center;">
          <span>Falca Fiscal Total (Tax Wedge):</span>
          <strong style="color:var(--color-warning); font-size:0.8rem;">${breakdown.taxWedgePercentage}%</strong>
        </div>
      </div>
    `;
  };

  ['#calc-ss-gross', '#calc-ss-irpf-rate', '#calc-ss-contract', '#calc-ss-payments'].forEach(id => {
    salaryCard.querySelector(id)?.addEventListener('input', renderSalaryBreakdown);
    salaryCard.querySelector(id)?.addEventListener('change', renderSalaryBreakdown);
  });

  renderSalaryBreakdown();
  page.appendChild(salaryCard);

  // Employers section
  const employersCard = document.createElement('div');
  employersCard.className = 'card';
  employersCard.style.marginTop = 'var(--space-lg)';
  const employersSection = createFormSection('Llista de Pagadors (Empreses)');
  
  const addEmployerBtn = document.createElement('button');
  addEmployerBtn.className = 'btn btn--secondary btn--sm';
  addEmployerBtn.innerHTML = '＋ Afegir Pagador';
  addEmployerBtn.addEventListener('click', () => {
    const newEmployer: EmployerItem = {
      id: crypto.randomUUID(),
      name: `Empresa ${w.employers.length + 1}`,
      grossSalary: 0,
      inKind: 0,
      withholdings: 0,
      socialSecurity: 0,
      dietsIncome: 0,
      dietsDays: 0,
      mileageIncome: 0,
      mileageKm: 0,
    };
    store.update('workIncome', { employers: [...store.getData().workIncome.employers, newEmployer] });
    renderEmployersList(employersList);
    showToast('Nou pagador afegit', 'success');
  });
  employersSection.appendChild(addEmployerBtn);

  const employersList = document.createElement('div');
  employersList.id = 'employers-list';
  employersList.style.marginTop = 'var(--space-lg)';
  renderEmployersList(employersList);
  employersSection.appendChild(employersList);

  employersCard.appendChild(employersSection);
  page.appendChild(employersCard);

  return page;
}

function renderEmployersList(container: HTMLElement) {
  container.innerHTML = '';
  const employers = store.getData().workIncome.employers || [];

  if (employers.length === 0) {
    container.innerHTML = `<div class="text-muted text-sm">Cap empresa registrada. Afegeix-ne una.</div>`;
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = 'var(--space-md)';

  employers.forEach((emp) => {
    const row = document.createElement('div');
    row.style.background = 'var(--bg-surface)';
    row.style.padding = 'var(--space-lg)';
    row.style.borderRadius = 'var(--radius-md)';
    row.style.border = '1px solid var(--border-default)';
    row.style.position = 'relative';

    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.marginBottom = 'var(--space-md)';
    
    headerRow.innerHTML = `<h3 style="margin:0; font-size:var(--text-md);">${emp.name || 'Nova Empresa'}</h3>`;
    
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn--icon btn--ghost';
    delBtn.innerHTML = '🗑';
    delBtn.title = 'Eliminar pagador';
    delBtn.addEventListener('click', () => {
      const arr = store.getData().workIncome.employers.filter(e => e.id !== emp.id);
      store.update('workIncome', { employers: arr });
      renderEmployersList(container);
    });
    headerRow.appendChild(delBtn);
    row.appendChild(headerRow);

    const updateEmployer = <K extends keyof EmployerItem>(field: K, val: EmployerItem[K] | string) => {
      const arr = [...store.getData().workIncome.employers];
      const target = arr.find(e => e.id === emp.id);
      if (!target) return;
      if (field === 'name' || field === 'id') {
        (target[field] as string) = String(val);
      } else {
        (target[field] as number) = typeof val === 'number' ? val : (parseFloat(String(val)) || 0);
      }
      store.update('workIncome', { employers: arr });
    };

    row.appendChild(
      createFormRow(
        createField({
          id: `emp-${emp.id}-name`,
          label: 'Nom del pagador',
          value: emp.name,
          onChange: (val) => updateEmployer('name', val)
        }),
      )
    );

    row.appendChild(
      createFormRow(
        createField({
          id: `emp-${emp.id}-gross`,
          label: 'Sou Brut',
          value: emp.grossSalary,
          suffix: '€',
          onChange: (val) => updateEmployer('grossSalary', val)
        }),
        createField({
          id: `emp-${emp.id}-inkind`,
          label: 'Espècie',
          value: emp.inKind,
          suffix: '€',
          onChange: (val) => updateEmployer('inKind', val)
        }),
      )
    );

    row.appendChild(
      createFormRow(
        createField({
          id: `emp-${emp.id}-withholdings`,
          label: 'Retencions IRPF',
          value: emp.withholdings,
          suffix: '€',
          onChange: (val) => updateEmployer('withholdings', val)
        }),
        createField({
          id: `emp-${emp.id}-ss`,
          label: 'Seguretat Social',
          value: emp.socialSecurity,
          suffix: '€',
          onChange: (val) => updateEmployer('socialSecurity', val)
        }),
      )
    );

    // Secció dietes i quilometratge
    const dietSection = document.createElement('div');
    dietSection.style.marginTop = 'var(--space-md)';
    dietSection.style.paddingTop = 'var(--space-md)';
    dietSection.style.borderTop = '1px dashed var(--border-default)';
    dietSection.innerHTML = `<h4 style="margin:0 0 var(--space-sm) 0; font-size:var(--text-sm);">Dietes i Desplaçaments</h4>`;

    dietSection.appendChild(
      createFormRow(
        createField({
          id: `emp-${emp.id}-diets`,
          label: 'Dietes Ingressades',
          value: emp.dietsIncome,
          suffix: '€',
          onChange: (val) => updateEmployer('dietsIncome', val)
        }),
        createField({
          id: `emp-${emp.id}-diets-days`,
          label: 'Dies pernoctats / justificats',
          value: emp.dietsDays,
          suffix: 'dies',
          hint: 'S\'aplicarà exempció de 26,67€ per dia segons llei',
          onChange: (val) => updateEmployer('dietsDays', val)
        }),
      )
    );

    dietSection.appendChild(
      createFormRow(
        createField({
          id: `emp-${emp.id}-mileage`,
          label: 'Quilometratge (Ingressos)',
          value: emp.mileageIncome,
          suffix: '€',
          onChange: (val) => updateEmployer('mileageIncome', val)
        }),
        createField({
          id: `emp-${emp.id}-mileage-km`,
          label: 'Quilòmetres recorreguts',
          value: emp.mileageKm,
          suffix: 'km',
          hint: 'S\'aplicarà exempció de 0,26€ per km segons llei',
          onChange: (val) => updateEmployer('mileageKm', val)
        }),
      )
    );

    row.appendChild(dietSection);
    list.appendChild(row);
  });

  container.appendChild(list);
}
