import { store } from '../store.ts';
import { ITPAndAJDEngine } from '../fiscal/itp-plusvalia-engine.ts';
import type { ITPAndAJDData, MunicipalPlusvaliaData } from '../types-patrimonial.ts';

export function renderRealEstateTaxes(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-container slide-in';

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-6';
  header.innerHTML = `
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">ITP, AJD y Plusvalía Municipal</h1>
      <p class="text-gray-500 mt-2">Modelos 600 y IIVTNU asociados a la transmisión de inmuebles.</p>
    </div>
    <div class="flex gap-2">
      <button id="add-itp-btn" class="btn-primary">
        <span class="icon">🏠</span> Nuevo ITP/AJD
      </button>
      <button id="add-plusvalia-btn" class="btn-secondary">
        <span class="icon">📈</span> Nueva Plusvalía
      </button>
    </div>
  `;
  container.appendChild(header);

  const contentGrid = document.createElement('div');
  contentGrid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6';

  const itpContainer = document.createElement('div');
  itpContainer.id = 'itp-grid';
  contentGrid.appendChild(itpContainer);

  const plusvaliaContainer = document.createElement('div');
  plusvaliaContainer.id = 'plusvalia-grid';
  contentGrid.appendChild(plusvaliaContainer);

  container.appendChild(contentGrid);

  function renderData() {
    const data = store.getData();
    
    // ITP
    let itpHtml = `<h2 class="text-xl font-bold text-blue-600 dark:text-blue-400 mb-4 border-b pb-2">ITP / AJD (Mod 600)</h2>`;
    if (!data.patrimonialTaxes?.itpAjd || data.patrimonialTaxes.itpAjd.length === 0) {
      itpHtml += `<p class="text-gray-500 text-sm">No hi ha simulacions ITP/AJD.</p>`;
    } else {
      itpHtml += `<div class="space-y-4">`;
      data.patrimonialTaxes.itpAjd.forEach((item: ITPAndAJDData) => {
        itpHtml += `
          <div class="card p-4 border border-blue-100 dark:border-blue-900">
            <div class="flex justify-between font-bold mb-2">
              <span>Operació: ${item.operationType}</span>
              <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">CCAA: ${item.community}</span>
            </div>
            <div class="text-sm space-y-1">
              <div class="flex justify-between"><span>Valor de referència:</span> <span>${item.propertyValue.toFixed(2)} €</span></div>
              <div class="flex justify-between"><span>Tipus Aplicable:</span> <span>${item.taxRate.toFixed(2)} %</span></div>
              <div class="flex justify-between font-bold text-blue-700 mt-2 border-t pt-2">
                <span>Quota a Ingressar:</span> <span>${(item.amountDue || 0).toFixed(2)} €</span>
              </div>
            </div>
          </div>
        `;
      });
      itpHtml += `</div>`;
    }
    itpContainer.innerHTML = itpHtml;

    // Plusvalia
    let plusvaliaHtml = `<h2 class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-4 border-b pb-2">Plusvàlua Municipal (IIVTNU)</h2>`;
    if (!data.patrimonialTaxes?.plusvalia || data.patrimonialTaxes.plusvalia.length === 0) {
      plusvaliaHtml += `<p class="text-gray-500 text-sm">No hi ha simulacions de Plusvàlua.</p>`;
    } else {
      plusvaliaHtml += `<div class="space-y-4">`;
      data.patrimonialTaxes.plusvalia.forEach((item: MunicipalPlusvaliaData) => {
        plusvaliaHtml += `
          <div class="card p-4 border border-emerald-100 dark:border-emerald-900">
            <div class="flex justify-between font-bold mb-2">
              <span>Transmissió (Anys: ${item.yearsOwned})</span>
              <span class="text-xs px-2 py-1 bg-emerald-100 text-emerald-800 rounded">Mètode: ${item.chosenMethod === 'real' ? 'Real' : 'Objectiu'}</span>
            </div>
            <div class="text-sm space-y-1 text-gray-600 dark:text-gray-400">
              <div class="flex justify-between"><span>Mètode Real (Base):</span> <span>${item.realBase.toFixed(2)} €</span></div>
              <div class="flex justify-between"><span>Mètode Objectiu (Base):</span> <span>${item.objectiveBase.toFixed(2)} €</span></div>
              <div class="flex justify-between text-gray-800 dark:text-gray-200"><span>Base Imposable (Menor):</span> <span>${(item.taxableBase || 0).toFixed(2)} €</span></div>
              <div class="flex justify-between"><span>Tipus impositiu local:</span> <span>${item.taxRate.toFixed(2)} %</span></div>
              <div class="flex justify-between font-bold text-emerald-700 dark:text-emerald-400 mt-2 border-t pt-2">
                <span>Quota a Ingressar:</span> <span>${(item.amountDue || 0).toFixed(2)} €</span>
              </div>
            </div>
          </div>
        `;
      });
      plusvaliaHtml += `</div>`;
    }
    plusvaliaContainer.innerHTML = plusvaliaHtml;
  }

  setTimeout(() => {
    document.getElementById('add-itp-btn')?.addEventListener('click', () => {
      const data = store.getData();
      const simITP: ITPAndAJDData = {
        operationType: 'TPO',
        date: new Date().toISOString().split('T')[0],
        community: data.personal.community as any || 'CAT',
        propertyValue: 200000,
        isPrimaryResidence: false,
        buyerAge: 35,
        disabilityDegree: 0,
        largeFamily: false,
        taxRate: 0,
        amountDue: 0
      };

      const calculated = ITPAndAJDEngine.calculateITPAJD(simITP);

      store.update('patrimonialTaxes', {
        itpAjd: [...(data.patrimonialTaxes?.itpAjd || []), calculated]
      });
      renderData();
    });

    document.getElementById('add-plusvalia-btn')?.addEventListener('click', () => {
      const data = store.getData();
      const simPlusvalia: MunicipalPlusvaliaData = {
        acquisitionDate: '2015-01-01',
        transferDate: new Date().toISOString().split('T')[0],
        cadastralLandValue: 60000,
        acquisitionPrice: 150000,
        transferPrice: 220000,
        municipalityCoef: 1.0,
        taxRate: 30, // Màxim legal
        yearsOwned: 9,
        objectiveBase: 0,
        realBase: 0,
        chosenMethod: 'objective',
        taxableBase: 0,
        amountDue: 0
      };

      const calculated = ITPAndAJDEngine.calculatePlusvalia(simPlusvalia);

      store.update('patrimonialTaxes', {
        plusvalia: [...(data.patrimonialTaxes?.plusvalia || []), calculated]
      });
      renderData();
    });

    renderData();
  }, 0);

  return container;
}
