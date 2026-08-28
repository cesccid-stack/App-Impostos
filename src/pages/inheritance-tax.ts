import { store } from '../store.ts';
import { InheritanceTaxEngine } from '../fiscal/inheritance-tax-engine.ts';
import type { InheritanceDonationData, AutonomousCommunity } from '../types-patrimonial.ts';

export function renderInheritanceTax(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-container slide-in';

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-6';
  header.innerHTML = `
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Sucesiones y Donaciones (650/651)</h1>
      <p class="text-gray-500 mt-2">Cálculo de impuestos de transmisiones lucrativas, herencias y pactos sucesorios.</p>
    </div>
    <button id="add-inheritance-btn" class="btn-primary">
      <span class="icon">➕</span> Nueva Simulación
    </button>
  `;
  container.appendChild(header);

  const contentGrid = document.createElement('div');
  contentGrid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6';
  contentGrid.id = 'inheritance-grid';
  container.appendChild(contentGrid);

  function renderData() {
    const data = store.getData();
    let html = '';

    if (!data.patrimonialTaxes?.inheritance || data.patrimonialTaxes.inheritance.length === 0) {
      contentGrid.innerHTML = `<div class="col-span-1 lg:col-span-2 text-center text-gray-500 py-10">No hay simulaciones guardadas.</div>`;
      return;
    }

    data.patrimonialTaxes.inheritance.forEach((item: InheritanceDonationData) => {
      const typeLabel = item.type === 'inheritance' ? 'Successió (650)' : 'Donació (651)';
      const totalMasa = item.realEstateValue + item.financialAssetsValue + item.lifeInsuranceValue;

      html += `
        <div class="card">
          <div class="flex justify-between items-center border-b pb-3 mb-4">
            <h2 class="text-xl font-bold text-gray-800 dark:text-white">${typeLabel} - CCAA: ${item.community}</h2>
            <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">Grup Parentiu: ${item.kinshipGroup}</span>
          </div>
          
          <div class="space-y-2 text-sm mb-4">
            <div class="flex justify-between"><span>Valor Immobles:</span> <span>${item.realEstateValue.toFixed(2)} €</span></div>
            <div class="flex justify-between"><span>Valor Financer:</span> <span>${item.financialAssetsValue.toFixed(2)} €</span></div>
            <div class="flex justify-between"><span>Assegurances Vida:</span> <span>${item.lifeInsuranceValue.toFixed(2)} €</span></div>
            <div class="flex justify-between text-gray-500 border-t pt-1 mt-1"><span>Cabal Relicte (Masa):</span> <span>${totalMasa.toFixed(2)} €</span></div>
            
            <div class="flex justify-between mt-2 text-red-400"><span>Deutes i Despeses:</span> <span>-${(item.deductibleDebts + item.deductibleExpenses).toFixed(2)} €</span></div>
            <div class="flex justify-between font-bold text-gray-700 dark:text-gray-300"><span>Base Imposable:</span> <span>${(item.taxableBase || 0).toFixed(2)} €</span></div>
            
            <div class="flex justify-between text-blue-400"><span>Reduccions (Hab/Empresa/Parentiu):</span> <span>-${((item.taxableBase || 0) - (item.liquidableBase || 0)).toFixed(2)} €</span></div>
            <div class="flex justify-between font-bold text-gray-800 dark:text-gray-200"><span>Base Liquidable:</span> <span>${(item.liquidableBase || 0).toFixed(2)} €</span></div>
            
            <div class="flex justify-between mt-3"><span>Quota Íntegra:</span> <span>${(item.grossTax || 0).toFixed(2)} €</span></div>
            <div class="flex justify-between text-xs text-gray-500"><span>Coeficient Multiplicador:</span> <span>x${(item.multiplierBase || 1).toFixed(4)}</span></div>
            <div class="flex justify-between border-t pt-1 mt-1"><span>Quota Tributària:</span> <span>${(item.netTax || 0).toFixed(2)} €</span></div>
            
            <div class="flex justify-between text-green-500"><span>Bonificació Autonòmica:</span> <span>-${(item.autonomicBonus || 0).toFixed(2)} €</span></div>
          </div>
          
          <div class="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex justify-between items-center mt-4">
            <span class="font-bold text-red-700 dark:text-red-300">Total a Ingressar:</span>
            <span class="text-xl font-bold text-red-800 dark:text-red-200">${(item.amountDue || 0).toFixed(2)} €</span>
          </div>
        </div>
      `;
    });

    contentGrid.innerHTML = html;
  }

  setTimeout(() => {
    document.getElementById('add-inheritance-btn')?.addEventListener('click', () => {
      const data = store.getData();
      
      // MOCK DATA PARA DEMO
      const newSim: InheritanceDonationData = {
        type: 'inheritance',
        date: new Date().toISOString().split('T')[0],
        community: (data.personal.community as AutonomousCommunity) || 'CAT',
        kinshipGroup: 'I',
        preExistingWealth: 150000,
        disabilityDegree: 0,
        realEstateValue: 250000,
        financialAssetsValue: 50000,
        lifeInsuranceValue: 0,
        householdFurnishingsValue: 0,
        deductibleDebts: 0,
        deductibleExpenses: 3000,
        reductionPrimaryResidence: 0,
        reductionFamilyBusiness: 0,
        taxableBase: 0,
        liquidableBase: 0,
        grossTax: 0,
        multiplierBase: 1,
        netTax: 0,
        autonomicBonus: 0,
        amountDue: 0
      };

      const calculated = InheritanceTaxEngine.calculate(newSim);

      store.update('patrimonialTaxes', {
        inheritance: [...(data.patrimonialTaxes?.inheritance || []), calculated]
      });

      renderData();
    });

    renderData();
  }, 0);

  return container;
}
