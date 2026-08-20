/**
 * @module pages/capital
 * Rendiments del capital (mobiliari nacional, estranger amb doble imposició + immobiliari).
 */

import { store } from '../store.ts';
import { createField, createFormRow, createFormSection } from '../components/form-field.ts';
import { calculateAllProperties } from '../fiscal/real-estate-engine.ts';
import { formatCurrency } from '../utils/currency.ts';
import { showToast } from '../components/toast.ts';

export function renderCapital(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page';

  const data = store.getData();
  const c = data.capitalIncome;
  const properties = data.properties || [];
  const propResults = calculateAllProperties(properties, data.year || 2024);

  page.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Rendiments del capital</h1>
      <p class="page-header__subtitle">Mobiliari nacional, dividends internacionals (Doble Imposició Casella 0588) i immobiliari</p>
    </div>
  `;

  const updater = (field: keyof typeof c) => (val: string) => {
    store.update('capitalIncome', { [field]: parseFloat(val) || 0 });
  };

  // Capital mobiliari nacional
  const mobCard = document.createElement('div');
  mobCard.className = 'card';
  mobCard.appendChild(
    createFormSection(
      'Capital mobiliari nacional (base de l\'estalvi)',
      createFormRow(
        createField({
          id: 'interests',
          label: 'Interessos de comptes i dipòsits nacionals',
          value: c.interests,
          suffix: '€',
          placeholder: '0,00',
          onChange: updater('interests'),
        }),
        createField({
          id: 'dividends',
          label: 'Dividends d\'empreses espanyoles',
          value: c.dividends,
          suffix: '€',
          placeholder: '0,00',
          onChange: updater('dividends'),
        }),
      ),
      createFormRow(
        createField({
          id: 'insurance-gains',
          label: 'Rendiments d\'assegurances de vida/inversió',
          value: c.insuranceGains,
          suffix: '€',
          placeholder: '0,00',
          onChange: updater('insuranceGains'),
        }),
        createField({
          id: 'other-mobiliary',
          label: 'Altres rendiments mobiliaris',
          value: c.otherMobiliary,
          suffix: '€',
          placeholder: '0,00',
          onChange: updater('otherMobiliary'),
        }),
      ),
      createFormRow(
        createField({
          id: 'mobiliary-withholdings',
          label: 'Retencions nacionals practicades (19%)',
          value: c.mobiliaryWithholdings,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Retencions d\'IRPF practicades pel banc o broker espanyol',
          onChange: updater('mobiliaryWithholdings'),
        }),
      ),
    ),
  );
  page.appendChild(mobCard);

  // Capital mobiliari estranger i Doble Imposició Internacional (Art. 80 LIRPF - Casella 0588)
  const foreignCard = document.createElement('div');
  foreignCard.className = 'card';
  foreignCard.innerHTML = `
    <div class="alert alert--info" style="margin-bottom: var(--space-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-sm);">
      <div>
        <strong>📊 Tens accions i cobres dividends internacionals?</strong>
        Pots importar directament l'extracte del teu bròker (DEGIRO, IBKR, Trade Republic, Revolut) per extreure automàticament els dividends i les retencions en origen (W-8BEN 15%).
      </div>
      <div style="display: flex; gap: var(--space-xs);">
        <a href="#/importar" class="btn btn--secondary btn--sm" style="white-space: nowrap;">📥 Importar Bròker</a>
        <a href="#/guanys" class="btn btn--secondary btn--sm" style="white-space: nowrap;">📈 Veure Guanys FIFO</a>
      </div>
    </div>
  `;
  foreignCard.appendChild(
    createFormSection(
      'Dividends internacionals i Doble Imposició (Casella 0588 AEAT)',
      createFormRow(
        createField({
          id: 'foreign-dividends',
          label: 'Dividends bruts internacionals (EUA, Europa, etc.)',
          value: c.foreignDividends || 0,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Ex: Dividends d\'Apple, Microsoft, ASML...',
          onChange: updater('foreignDividends'),
        }),
        createField({
          id: 'foreign-tax-withheld',
          label: 'Impost satisfet a l\'estranger (Retenció en origen)',
          value: c.foreignTaxWithheld || 0,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Ex: 15% retingut als EUA amb formulari W-8BEN',
          onChange: updater('foreignTaxWithheld'),
        }),
      ),
    ),
  );
  page.appendChild(foreignCard);

  // Capital immobiliari banner & form
  const immCard = document.createElement('div');
  immCard.className = 'card';
  
  const propCount = properties.length;
  immCard.innerHTML = `
    <div class="alert alert--info" style="margin-bottom: var(--space-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-sm);">
      <div>
        <strong>🏠 Tens immobles en lloguer?</strong> 
        ${propCount > 0 ? `Tens <strong>${propCount} immoble/s</strong> gestionat/s amb extracontable i amortització detallada.` : 'Gestiona cada propietat de forma individual amb càlcul automàtic del 3% de construcció i taula simplificada d\'actius (fins al 30%).'}
      </div>
      <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap;">
        ${propCount > 0 ? `
          <button class="btn btn--secondary btn--sm" id="sync-properties-btn" style="white-space: nowrap;">⚡ Sincronitzar Valors</button>
        ` : ''}
        <button class="btn btn--primary btn--sm" id="go-properties-btn" style="white-space: nowrap;">Anar a Immobles ➔</button>
      </div>
    </div>

    ${propCount > 0 ? `
      <div style="background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-subtle); margin-bottom:var(--space-md); display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:var(--space-sm);">
        <div>
          <div style="font-size:0.7rem; color:var(--text-muted);">Ingressos Lloguer Cartera</div>
          <div style="font-size:1rem; font-weight:700; color:var(--color-primary);">${formatCurrency(propResults.totalGrossIncome)}</div>
        </div>
        <div>
          <div style="font-size:0.7rem; color:var(--text-muted);">Despeses & Amortització AEAT</div>
          <div style="font-size:1rem; font-weight:700; color:var(--text-secondary);">${formatCurrency(propResults.totalExpenses + propResults.totalAmortization)}</div>
        </div>
        <div>
          <div style="font-size:0.7rem; color:var(--text-muted);">Rendiment Net Reduït (Casella 0105)</div>
          <div style="font-size:1rem; font-weight:700; color:var(--color-success);">${formatCurrency(propResults.totalNetReducedIncome)}</div>
        </div>
        <div>
          <div style="font-size:0.7rem; color:var(--text-muted);">Imputació Rendes Ús Propi</div>
          <div style="font-size:1rem; font-weight:700; color:var(--color-warning);">${formatCurrency(propResults.totalImputedIncome)}</div>
        </div>
      </div>
    ` : ''}
  `;

  immCard.querySelector('#go-properties-btn')?.addEventListener('click', () => {
    window.location.hash = '#/immobles';
  });

  immCard.querySelector('#sync-properties-btn')?.addEventListener('click', () => {
    store.update('capitalIncome', {
      rentalIncome: propResults.totalGrossIncome,
      rentalExpenses: propResults.totalExpenses + propResults.totalAmortization,
      rentalIBI: propResults.results.reduce((s, r) => s + (r.ibiDeducted || 0), 0),
      rentalWasteTax: propResults.results.reduce((s, r) => s + (r.wasteTaxDeducted || 0), 0),
      rentalOtherTaxes: propResults.results.reduce((s, r) => s + (r.otherTaxesDeducted || 0), 0),
      rentalInsurance: propResults.results.reduce((s, r) => s + (r.insurance || 0), 0),
      rentalCommunityFees: propResults.results.reduce((s, r) => s + (r.communityFees || 0), 0),
      rentalMortgageInterests: propResults.results.reduce((s, r) => s + (r.mortgageInterests || 0), 0),
      rentalRepairs: propResults.results.reduce((s, r) => s + (r.repairExpenses || 0), 0),
      rentalAmortization: propResults.totalAmortization,
      imputedIncome: propResults.totalImputedIncome,
    });
    showToast('Valors consolidats d\'immobles sincronitzats correctament', 'success');
    page.replaceWith(renderCapital());
  });

  immCard.appendChild(
    createFormSection(
      'Capital immobiliari (Valors manuals / globals)',
      createFormRow(
        createField({
          id: 'rental-income',
          label: 'Ingressos per lloguer',
          value: c.rentalIncome,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Casella 0066 AEAT',
          onChange: updater('rentalIncome'),
        }),
        createField({
          id: 'rental-expenses',
          label: 'Despeses deduïbles globals del lloguer',
          value: c.rentalExpenses,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Suma de tributs (IBI/brosses), assegurança, comunitat, reparacions...',
          onChange: updater('rentalExpenses'),
        }),
      ),
      createFormRow(
        createField({
          id: 'rental-ibi',
          label: '🏛️ IBI - Impost Béns Immobles',
          value: c.rentalIBI || 0,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Casella 0073',
          onChange: (v) => {
            updater('rentalIBI')(v);
          },
        }),
        createField({
          id: 'rental-waste-tax',
          label: '🗑️ Taxa d\'Escombraries / Brosses & Altres Taxes',
          value: (c.rentalWasteTax || 0) + (c.rentalOtherTaxes || 0),
          suffix: '€',
          placeholder: '0,00',
          hint: 'Casella 0073 (Brosses, gual, clavegueram)',
          onChange: (v) => {
            updater('rentalWasteTax')(v);
          },
        }),
      ),
      createFormRow(
        createField({
          id: 'rental-insurance',
          label: '🛡️ Assegurances (Llar, RC, Impagament)',
          value: c.rentalInsurance || 0,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Casella 0075',
          onChange: (v) => {
            updater('rentalInsurance')(v);
          },
        }),
        createField({
          id: 'rental-community-fees',
          label: '🏢 Despeses de Comunitat',
          value: c.rentalCommunityFees || 0,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Casella 0074',
          onChange: (v) => {
            updater('rentalCommunityFees')(v);
          },
        }),
      ),
      createFormRow(
        createField({
          id: 'imputed-income',
          label: 'Imputació de rendes immobiliàries',
          value: c.imputedIncome,
          suffix: '€',
          placeholder: '0,00',
          hint: 'Immobles no arrendats (1,1%-2% valor cadastral)',
          onChange: updater('imputedIncome'),
        }),
        createField({
          id: 'real-estate-withholdings',
          label: 'Retencions capital immobiliari',
          value: c.realEstateWithholdings,
          suffix: '€',
          placeholder: '0,00',
          onChange: updater('realEstateWithholdings'),
        }),
      ),
    ),
  );
  page.appendChild(immCard);

  // Auto-save indicator
  const infoBar = document.createElement('div');
  infoBar.style.cssText =
    'text-align:center;padding:var(--space-lg) 0;color:var(--text-muted);font-size:var(--text-xs);';
  infoBar.textContent = '💾 Les dades es guarden automàticament';
  page.appendChild(infoBar);

  return page;
}
