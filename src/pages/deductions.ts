/**
 * @module pages/deductions
 * Deduccions form page — Estatals i Autonòmiques de Catalunya.
 */

import { store } from '../store.ts';
import {
  createField,
  createFormRow,
  createFormSection,
  createToggle,
} from '../components/form-field.ts';
import { openModal } from '../components/modal.ts';
import { showToast } from '../components/toast.ts';
import { formatCurrency } from '../utils/currency.ts';
import { runAutomatedComplianceChecks } from '../fiscal/auto-validator.ts';
import { openComplianceModal } from '../components/compliance-modal.ts';
import type { DonationItem, DeductionsData } from '../types.ts';

export function renderDeductions(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page';

  const data = store.getData();
  const d = data.deductions;
  const personal = data.personal;
  const compliance = runAutomatedComplianceChecks(data);
  const dedIssues = compliance.issues.filter(i => i.id.startsWith('ded'));

  const descendants = personal.descendants || [];
  const childrenUnder3 = descendants.filter(desc => (desc.age || 0) < 3);
  const ascendants = personal.ascendants || [];
  const ascendantsOver75 = ascendants.filter(asc => (asc.age || 0) >= 75);

  page.innerHTML = `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md);">
      <div>
        <h1 class="page-header__title" style="margin:0;">🎯 Deduccions Estatals i de Catalunya</h1>
        <p class="page-header__subtitle" style="margin:4px 0 0 0;">Bonificacions autonòmiques (Catalunya), donatius Llei 49/2002, maternitat, habitatge i plans de pensions</p>
      </div>
      <button class="btn btn--secondary btn--sm" id="btn-open-ded-compliance">
        🛡️ ${compliance.complianceScore}% Auditoria Fiscal
      </button>
    </div>

    ${childrenUnder3.length > 0 || ascendantsOver75.length > 0 ? `
      <div class="card" style="margin-bottom:var(--space-lg); padding:12px 16px; border-left:4px solid var(--color-success); background:var(--bg-surface-elevated); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
        <div style="display:flex; align-items:center; gap:var(--space-sm);">
          <span style="font-size:1.4rem;">👶</span>
          <div>
            <strong style="font-size:var(--text-sm); color:var(--text-primary);">Oportunitats de Deducció Familiar Detectades</strong>
            <p style="margin:0; font-size:0.75rem; color:var(--text-secondary);">
              ${childrenUnder3.length > 0 ? `Tens ${childrenUnder3.length} fill/s menor/s de 3 anys registrats: activa la Deducció per Maternitat (fins a 1.200 € + 1.000 € escola bressol) i Naixement/Adopció.` : ''}
              ${ascendantsOver75.length > 0 ? ` Tens ${ascendantsOver75.length} ascendent/s >75 anys: aplicat mínim incrementat (2.550 €).` : ''}
            </p>
          </div>
        </div>
        <button class="btn btn--secondary btn--sm" id="btn-goto-personal-from-ded" style="font-size:0.75rem;">
          👤 Veure Situació Familiar
        </button>
      </div>
    ` : ''}

    ${dedIssues.length > 0 ? `
      <div class="card" style="margin-bottom:var(--space-lg); padding:10px 16px; border-left:4px solid var(--color-warning); background:var(--bg-surface-elevated); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
        <div style="display:flex; align-items:center; gap:var(--space-sm);">
          <span style="font-size:1.2rem;">⚠️</span>
          <div>
            <strong style="font-size:var(--text-sm);">${dedIssues[0].title}</strong>
            <p style="margin:0; font-size:0.75rem; color:var(--text-secondary);">${dedIssues[0].message}</p>
          </div>
        </div>
        <button class="btn btn--secondary btn--sm" id="btn-ded-compliance-modal-trigger" style="font-size:0.75rem;">
          🔍 Veure Diagnòstic
        </button>
      </div>
    ` : ''}
  `;

  page.querySelector('#btn-goto-personal-from-ded')?.addEventListener('click', () => {
    window.location.hash = '#/personal';
  });

  page.querySelector('#btn-open-ded-compliance')?.addEventListener('click', () => {
    openComplianceModal();
  });
  page.querySelector('#btn-ded-compliance-modal-trigger')?.addEventListener('click', () => {
    openComplianceModal();
  });

  // 1. Deduccions Autonòmiques de Catalunya
  const catalanCard = document.createElement('div');
  catalanCard.className = 'card';
  catalanCard.style.borderLeft = '4px solid var(--color-primary)';
  const catalanSection = createFormSection('🏛️ Deduccions Autonòmiques de Catalunya');

  catalanSection.appendChild(
    createToggle({
      id: 'catalan-rental-deduction',
      label: 'Lloguer d\'habitatge habitual (com a llogater / arrendatari)',
      checked: d.catalanRentalDeduction,
      onChange: (checked) => {
        store.update('deductions', { catalanRentalDeduction: checked });
      },
    }),
  );

  catalanSection.appendChild(
    createFormRow(
      createField({
        id: 'catalan-rental-amount',
        label: 'Quantitats satisfetes de lloguer a l\'any',
        value: d.catalanRentalAmount,
        suffix: '€',
        placeholder: '0,00',
        hint: 'Deducció del 10% (límit 300€ general o 600€ família nombrosa/monoparental)',
        onChange: (val) => {
          store.update('deductions', { catalanRentalAmount: parseFloat(val) || 0 });
        },
      }),
      createField({
        id: 'catalan-rental-situation',
        label: 'Situació personal del llogater',
        type: 'select',
        value: d.catalanRentalSituation || 'none',
        options: [
          { value: 'none', label: 'Cap de les següents (sense dret a deducció)' },
          { value: 'under32', label: 'Edat ≤ 32 anys (a 31 de desembre)' },
          { value: 'unemployed', label: 'Atur durant ≥ 183 dies' },
          { value: 'disabled65', label: 'Discapacitat ≥ 65%' },
          { value: 'widow65', label: 'Viduïtat i edat ≥ 65 anys' },
          { value: 'large_family', label: 'Família nombrosa (límit 600€)' },
          { value: 'single_parent', label: 'Família monoparental (límit 600€)' },
        ],
        onChange: (val) => {
          store.update('deductions', { catalanRentalSituation: val as DeductionsData['catalanRentalSituation'] });
        },
      }),
    )
  );

  catalanSection.appendChild(
    createFormRow(
      createField({
        id: 'catalan-birth',
        label: 'Fills nascuts o adoptats l\'any a Catalunya',
        value: d.catalanBirthAdoption,
        min: 0,
        step: 1,
        hint: '150 €/fill en declaració individual (300 € en conjunta / monoparental)',
        onChange: (val) => {
          store.update('deductions', { catalanBirthAdoption: parseInt(val, 10) || 0 });
        },
      }),
      createField({
        id: 'catalan-startup',
        label: 'Inversió en Startups / Empreses nova creació (Catalunya)',
        value: d.catalanStartupInvestment,
        suffix: '€',
        placeholder: '0,00',
        hint: 'Deducció del 30% (fins a 6.000 €) o 50% si és spin-off universitària (fins a 12.000 €)',
        onChange: (val) => {
          store.update('deductions', { catalanStartupInvestment: parseFloat(val) || 0 });
        },
      }),
    )
  );

  catalanSection.appendChild(
    createToggle({
      id: 'catalan-startup-research',
      label: 'La startup ha estat creada per universitats o centres de recerca (Deducció 50% fins a 12.000€)',
      checked: !!d.catalanStartupIsResearchOrUniversity,
      onChange: (checked) => {
        store.update('deductions', { catalanStartupIsResearchOrUniversity: checked });
      },
    }),
  );

  catalanSection.appendChild(
    createFormRow(
      createField({
        id: 'catalan-agaur-loans',
        label: 'Interessos de préstecs per a Màster i Doctorat (AGAUR)',
        value: d.catalanAgaurMasterLoanInterests || 0,
        suffix: '€',
        placeholder: '0,00',
        hint: 'Deducció del 100% dels interessos satisfets',
        onChange: (val) => {
          store.update('deductions', { catalanAgaurMasterLoanInterests: parseFloat(val) || 0 });
        },
      }),
      createField({
        id: 'catalan-language-donations',
        label: 'Donacions al foment de la Llengua Catalana / Aranesa',
        value: d.catalanLanguageDonations || 0,
        suffix: '€',
        placeholder: '0,00',
        hint: 'Deducció autonòmica del 15%',
        onChange: (val) => {
          store.update('deductions', { catalanLanguageDonations: parseFloat(val) || 0 });
        },
      }),
    )
  );

  catalanSection.appendChild(
    createFormRow(
      createField({
        id: 'catalan-biomedical-donations',
        label: 'Donacions a Recerca Biomèdica i Universitats Catalanes',
        value: d.catalanBiomedicalDonations || 0,
        suffix: '€',
        placeholder: '0,00',
        hint: 'Deducció autonòmica del 25%',
        onChange: (val) => {
          store.update('deductions', { catalanBiomedicalDonations: parseFloat(val) || 0 });
        },
      }),
      createField({
        id: 'catalan-home-rehab',
        label: 'Rehabilitació de l\'habitatge habitual a Catalunya',
        value: d.catalanHomeRehabilitation || 0,
        suffix: '€',
        placeholder: '0,00',
        hint: 'Deducció de l\'1,5% de les quantitats satisfetes (base màx. 9.040 €)',
        onChange: (val) => {
          store.update('deductions', { catalanHomeRehabilitation: parseFloat(val) || 0 });
        },
      }),
    )
  );

  catalanSection.appendChild(
    createFormRow(
      createToggle({
        id: 'catalan-widowhood',
        label: 'Persona vídua en l\'exercici a Catalunya (150 € / 300 €)',
        checked: !!d.catalanWidowhood,
        onChange: (checked) => {
          store.update('deductions', { catalanWidowhood: checked });
        },
      }),
      createToggle({
        id: 'catalan-widowhood-deps',
        label: 'Té un o més descendents a càrrec (300 €)',
        checked: !!d.catalanWidowhoodWithDependents,
        onChange: (checked) => {
          store.update('deductions', { catalanWidowhoodWithDependents: checked });
        },
      }),
    )
  );

  catalanCard.appendChild(catalanSection);
  page.appendChild(catalanCard);

  // 2. Donatius (Llei 49/2002)
  const donationsCard = document.createElement('div');
  donationsCard.className = 'card';
  const donationsSection = createFormSection('🤝 Donatius (Llei 49/2002 actualitzada)');

  const addDonationBtn = document.createElement('button');
  addDonationBtn.className = 'btn btn--secondary btn--sm';
  addDonationBtn.innerHTML = '＋ Afegir donatiu';
  addDonationBtn.addEventListener('click', () => openDonationModal(donationsList));
  donationsSection.appendChild(addDonationBtn);

  const donationsList = document.createElement('div');
  donationsList.id = 'donations-list';
  donationsList.style.marginTop = 'var(--space-lg)';
  renderDonationsList(donationsList, d.donations || []);
  donationsSection.appendChild(donationsList);

  donationsCard.appendChild(donationsSection);
  page.appendChild(donationsCard);

  // 3. Maternitat i Guarderies
  const maternityCard = document.createElement('div');
  maternityCard.className = 'card';
  const maternitySection = createFormSection('👶 Deducció per Maternitat i Guarderies');

  maternitySection.appendChild(
    createToggle({
      id: 'maternity-deduction',
      label: 'Mare treballadora amb fills menors de 3 anys',
      checked: d.maternityDeduction,
      onChange: (checked) => {
        store.update('deductions', { maternityDeduction: checked });
      },
    }),
  );

  maternitySection.appendChild(
    createFormRow(
      createField({
        id: 'maternity-months',
        label: 'Mesos amb dret a la deducció',
        value: d.maternityMonths,
        min: 0,
        max: 12,
        step: 1,
        hint: '100 €/mes, màx. 1.200 €/any',
        onChange: (val) => {
          store.update('deductions', { maternityMonths: parseInt(val, 10) || 0 });
        },
      }),
      createField({
        id: 'maternity-nursery',
        label: 'Despeses de guarderia / escola bressol autoritzada',
        value: d.maternityNurseryExpenses || 0,
        suffix: '€',
        placeholder: '0,00',
        hint: 'Increment addicional de fins a 1.000 €/any',
        onChange: (val) => {
          store.update('deductions', { maternityNurseryExpenses: parseFloat(val) || 0 });
        },
      }),
    )
  );

  maternityCard.appendChild(maternitySection);
  page.appendChild(maternityCard);

  // 4. Eficiència Energètica
  const energyCard = document.createElement('div');
  energyCard.className = 'card';
  const energySection = createFormSection('⚡ Obres d\'Eficiència Energètica en Habitatge (RD-Llei 19/2021)');

  energySection.appendChild(
    createFormRow(
      createField({
        id: 'energy-type',
        label: 'Tipus d\'actuació energètica',
        type: 'select',
        value: d.energyEfficiencyType || 'none',
        options: [
          { value: 'none', label: 'Cap actuació' },
          { value: 'heating_cooling_20', label: '20% - Reducció demanda calefacció/refrigeració ≥ 7% (màx 5.000€)' },
          { value: 'primary_energy_40', label: '40% - Reducció consum energia primària no renovable ≥ 30% (màx 7.500€)' },
          { value: 'building_rehab_60', label: '60% - Obres de rehabilitació energètica d\'edifici residencial (màx 5.000€/any)' },
        ],
        onChange: (val) => {
          store.update('deductions', { energyEfficiencyType: val as DeductionsData['energyEfficiencyType'] });
        },
      }),
      createField({
        id: 'energy-amount',
        label: 'Quantitats satisfetes en les obres',
        value: d.energyEfficiencyAmount || 0,
        suffix: '€',
        placeholder: '0,00',
        onChange: (val) => {
          store.update('deductions', { energyEfficiencyAmount: parseFloat(val) || 0 });
        },
      }),
    )
  );

  energyCard.appendChild(energySection);
  page.appendChild(energyCard);

  // 5. Plans de Pensions
  const pensionCard = document.createElement('div');
  pensionCard.className = 'card';
  const pensionSection = createFormSection('💼 Plans de Pensions i Previsió Social');

  pensionSection.appendChild(
    createFormRow(
      createField({
        id: 'pension-contributions',
        label: 'Aportacions individuals pròpies',
        value: d.pensionPlanContributions,
        suffix: '€',
        placeholder: '0,00',
        hint: 'Límit màxim individual: 1.500 €/any',
        onChange: (val) => {
          store.update('deductions', {
            pensionPlanContributions: parseFloat(val) || 0,
          });
        },
      }),
      createField({
        id: 'company-pension-contributions',
        label: 'Aportacions empresarials (plans d\'ocupació)',
        value: d.companyPensionContributions || 0,
        suffix: '€',
        placeholder: '0,00',
        hint: 'Límit ampliable fins a 8.500 € addicionals (total 10.000 €)',
        onChange: (val) => {
          store.update('deductions', {
            companyPensionContributions: parseFloat(val) || 0,
          });
        },
      }),
    )
  );

  pensionCard.appendChild(pensionSection);
  page.appendChild(pensionCard);

  // 6. Habitatge Habitual (Pre-2013)
  const housingCard = document.createElement('div');
  housingCard.className = 'card';
  const housingSection = createFormSection('🏠 Inversió en Habitatge Habitual (Règim Transitori Pre-2013)');

  housingSection.appendChild(
    createToggle({
      id: 'housing-deduction',
      label: 'Tinc dret a la deducció (adquisició d\'habitatge abans de l\'01/01/2013)',
      checked: d.housingDeduction,
      onChange: (checked) => {
        store.update('deductions', { housingDeduction: checked });
      },
    }),
  );

  housingSection.appendChild(
    createField({
      id: 'housing-amounts',
      label: 'Quantitats satisfetes a l\'any (hipoteca + assegurances vinculades)',
      value: d.housingAmountsPaid,
      suffix: '€',
      placeholder: '0,00',
      hint: 'Base màxima de deducció: 9.040 €/any. Deducció estatal i autonòmica: 15% (fins a 1.356 €)',
      onChange: (val) => {
        store.update('deductions', { housingAmountsPaid: parseFloat(val) || 0 });
      },
    }),
  );

  housingCard.appendChild(housingSection);
  page.appendChild(housingCard);

  return page;
}

function renderDonationsList(container: HTMLElement, donations: DonationItem[]): void {
  container.innerHTML = '';

  if (donations.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:var(--space-xl);color:var(--text-muted);font-size:var(--text-sm);">
        Cap donatiu registrat. Afegeix donatius per aplicar la deducció del 80% als primers 250 € (Llei 49/2002).
      </div>
    `;
    return;
  }

  const list = document.createElement('div');
  list.className = 'item-list';

  for (const donation of donations) {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div class="item-row__content">
        <div class="item-row__field">
          <span class="item-row__field-label">Entitat</span>
          <span class="item-row__field-value">${donation.entity || '—'}</span>
        </div>
        <div class="item-row__field">
          <span class="item-row__field-label">Import</span>
          <span class="item-row__field-value">${formatCurrency(donation.amount)}</span>
        </div>
        <div class="item-row__field">
          <span class="item-row__field-label">Tipus i Deducció</span>
          <span class="item-row__field-value">
            ${donation.priority ? '<span class="badge badge--success">Llei 49/2002 (80% primers 250€)</span>' : '<span class="badge badge--warning">General (10%)</span>'}
            ${donation.recurring ? ' <span class="badge badge--primary">Recurrent ≥3 anys (45%)</span>' : ''}
          </span>
        </div>
      </div>
      <div class="item-row__actions">
        <button class="btn btn--ghost btn--sm btn--icon text-error" data-delete="${donation.id}" title="Eliminar">🗑</button>
      </div>
    `;

    row.querySelector(`[data-delete="${donation.id}"]`)!.addEventListener('click', () => {
      const deductions = store.getData().deductions;
      const newDonations = (deductions.donations || []).filter((d) => d.id !== donation.id);
      store.update('deductions', { donations: newDonations });
      renderDonationsList(container, newDonations);
      showToast('Donatiu eliminat', 'success');
    });

    list.appendChild(row);
  }

  container.appendChild(list);
}

function openDonationModal(listContainer: HTMLElement): void {
  const { body, footer, close } = openModal({ title: 'Nou donatiu' });

  const form: Partial<DonationItem> = {
    entity: '',
    amount: 0,
    recurring: false,
    priority: true,
  };

  const fields = document.createElement('div');
  fields.style.display = 'flex';
  fields.style.flexDirection = 'column';
  fields.style.gap = 'var(--space-lg)';

  fields.appendChild(
    createField({
      id: 'donation-entity',
      label: 'Entitat beneficiària (ONG / Fundació / Associació)',
      type: 'text',
      placeholder: 'Ex: Creu Roja, Càritas, MSF, La Marató TV3...',
      onChange: (val) => { form.entity = val; },
    }),
  );

  fields.appendChild(
    createField({
      id: 'donation-amount',
      label: 'Import donat',
      suffix: '€',
      placeholder: '0,00',
      onChange: (val) => { form.amount = parseFloat(val) || 0; },
    }),
  );

  fields.appendChild(
    createToggle({
      id: 'donation-priority',
      label: 'Entitat acollida a la Llei 49/2002 (80% fins a 250 € i 40% resta)',
      checked: true,
      onChange: (checked) => { form.priority = checked; },
    }),
  );

  fields.appendChild(
    createToggle({
      id: 'donation-recurring',
      label: 'Donació recurrent (mateixa entitat durant ≥ 3 anys consecutius: 45% resta)',
      checked: false,
      onChange: (checked) => { form.recurring = checked; },
    }),
  );

  body.appendChild(fields);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn--ghost';
  cancelBtn.textContent = 'Cancel·lar';
  cancelBtn.addEventListener('click', close);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn--primary';
  saveBtn.textContent = 'Afegir donatiu';
  saveBtn.addEventListener('click', () => {
    const newDonation: DonationItem = {
      id: crypto.randomUUID(),
      entity: form.entity ?? '',
      amount: form.amount ?? 0,
      recurring: form.recurring ?? false,
      priority: form.priority ?? true,
    };

    const deductions = store.getData().deductions;
    store.update('deductions', {
      donations: [...(deductions.donations || []), newDonation],
    });

    close();
    showToast('Donatiu afegit correctament', 'success');
    renderDonationsList(listContainer, store.getData().deductions.donations);
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
}
