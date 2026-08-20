import { store } from '../store.ts';
import { Model130Engine } from '../fiscal/model130-engine.ts';
import { WithholdingsEngine } from '../fiscal/model111-engine.ts';
import { Model347Engine } from '../fiscal/model347-engine.ts';
import type { Model130Quarterly, Model111Quarterly, Model115Quarterly, Model347Entity } from '../types-quarterly.ts';
import type { EmployerItem } from '../types.ts';
import type { RentalProperty } from '../types-properties.ts';

export function renderQuarterlyTaxes(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-container slide-in';
  
  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-6';
  header.innerHTML = `
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Modelos Trimestrales y Obligaciones</h1>
      <p class="text-gray-500 mt-2">Pagos fraccionados (Mod. 130), retenciones (Mod. 111/115) y operaciones >3005€ (Mod. 347).</p>
    </div>
    <button id="recalc-btn" class="btn-primary">
      <span class="icon">🔄</span> Calcular Modelos
    </button>
  `;
  container.appendChild(header);

  const contentGrid = document.createElement('div');
  contentGrid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6';

  // Card Mod 130
  const mod130Card = document.createElement('div');
  mod130Card.className = 'card col-span-1 lg:col-span-2';
  mod130Card.id = 'mod130-container';
  contentGrid.appendChild(mod130Card);

  // Card Mod 111 & 115
  const withholdingsCard = document.createElement('div');
  withholdingsCard.className = 'card';
  withholdingsCard.id = 'withholdings-container';
  contentGrid.appendChild(withholdingsCard);

  // Card Mod 347
  const mod347Card = document.createElement('div');
  mod347Card.className = 'card';
  mod347Card.id = 'mod347-container';
  contentGrid.appendChild(mod347Card);

  container.appendChild(contentGrid);

  function renderData() {
    const data = store.getData();
    
    // Mod 130 View
    let mod130Html = `<h2 class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-4 border-b pb-2">Model 130 - Pagament Fraccionat IRPF</h2>`;
    if (!data.quarterlyTaxes?.mod130 || data.quarterlyTaxes.mod130.length === 0) {
      mod130Html += `<p class="text-gray-500">No hi ha dades calculades. Fes clic a Calcular Modelos.</p>`;
    } else {
      mod130Html += `<div class="grid grid-cols-1 md:grid-cols-4 gap-4">`;
      data.quarterlyTaxes.mod130.forEach((q: Model130Quarterly) => {
        mod130Html += `
          <div class="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
            <h3 class="font-bold text-lg mb-2">${q.quarter}</h3>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between"><span>Rendiment Net:</span> <strong>${q.netYield.toFixed(2)} €</strong></div>
              <div class="flex justify-between"><span>Quota (20%):</span> <span>${q.grossTax.toFixed(2)} €</span></div>
              <div class="flex justify-between"><span>Retencions ant:</span> <span>-${q.withholdingsPrevious.toFixed(2)} €</span></div>
              <div class="flex justify-between"><span>Pagaments ant:</span> <span>-${q.fractionalPaymentsPrevious.toFixed(2)} €</span></div>
              <div class="flex justify-between mt-2 pt-2 border-t font-bold text-emerald-600 dark:text-emerald-400">
                <span>Resultat:</span> <span>${q.netTax.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        `;
      });
      mod130Html += `</div>`;
    }
    mod130Card.innerHTML = mod130Html;

    // Mod 111 / 115 View
    let withHtml = `<h2 class="text-xl font-bold text-blue-600 dark:text-blue-400 mb-4 border-b pb-2">Retencions (Mod 111 i 115)</h2>`;
    if (!data.quarterlyTaxes?.mod111 || data.quarterlyTaxes.mod111.length === 0) {
      withHtml += `<p class="text-gray-500">Sense dades.</p>`;
    } else {
      const q4_111 = data.quarterlyTaxes.mod111.find((q: Model111Quarterly) => q.quarter === '4T');
      const q4_115 = data.quarterlyTaxes.mod115?.find((q: Model115Quarterly) => q.quarter === '4T');
      
      withHtml += `
        <div class="space-y-4">
          <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 class="font-bold">Mod. 111 (Exemple 4T)</h3>
            <p class="text-sm mt-1">Treballadors: ${q4_111?.workRecipientsCount || 0}</p>
            <p class="text-sm">Retencions Professionals: ${q4_111?.profWithholdings.toFixed(2) || '0.00'} €</p>
            <p class="font-bold text-blue-700 dark:text-blue-300 mt-2">A ingressar: ${q4_111?.totalToPay.toFixed(2) || '0.00'} €</p>
          </div>
          <div class="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <h3 class="font-bold">Mod. 115 (Exemple 4T)</h3>
            <p class="text-sm mt-1">Llogaters retinguts: ${q4_115?.recipientsCount || 0}</p>
            <p class="font-bold text-amber-700 dark:text-amber-300 mt-2">A ingressar: ${q4_115?.totalToPay.toFixed(2) || '0.00'} €</p>
          </div>
        </div>
      `;
    }
    withholdingsCard.innerHTML = withHtml;

    // Mod 347 View
    let mod347Html = `<h2 class="text-xl font-bold text-purple-600 dark:text-purple-400 mb-4 border-b pb-2">Mod 347 (> 3005.06€)</h2>`;
    const mod347 = data.quarterlyTaxes?.mod347;
    if (!mod347 || mod347.entities.length === 0) {
      mod347Html += `<p class="text-gray-500">Cap operació amb tercers supera el límit en l'exercici actual.</p>`;
    } else {
      mod347Html += `
        <div class="mb-4 text-sm font-bold flex justify-between bg-purple-50 dark:bg-purple-900/20 p-3 rounded">
          <span>Volum Clients: ${mod347.totalClientsVolume.toFixed(2)} €</span>
          <span>Volum Proveïdors: ${mod347.totalSuppliersVolume.toFixed(2)} €</span>
        </div>
        <ul class="space-y-2">
      `;
      mod347.entities.forEach((ent: Model347Entity) => {
        mod347Html += `
          <li class="flex justify-between items-center text-sm p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded">
            <div>
              <span class="font-bold">${ent.nif}</span>
              <span class="block text-gray-500 text-xs">${ent.name} (${ent.type})</span>
            </div>
            <div class="font-bold">${ent.totalAmount.toFixed(2)} €</div>
          </li>
        `;
      });
      mod347Html += `</ul>`;
    }
    mod347Card.innerHTML = mod347Html;
  }

  setTimeout(() => {
    document.getElementById('recalc-btn')?.addEventListener('click', () => {
      const data = store.getData();
      
      // Calculate 130
      const mod130 = Model130Engine.calculateFromYearlyActivities(data.activities, data.year, data.deductions.housingDeduction);
      
      // Calculate 111 & 115 (Mocking from generic data for demo purposes)
      const workWithhold = data.workIncome.employers.reduce((sum: number, e: EmployerItem) => sum + e.withholdings, 0);
      const mod111_q4 = WithholdingsEngine.calculateModel111('4T', data.year, data.workIncome.employers.length, data.workIncome.employers.reduce((s: number, e: EmployerItem) => s + e.grossSalary, 0), workWithhold, 0, 0, 0);
      
      const mod115_q4 = WithholdingsEngine.calculateModel115('4T', data.year, data.properties.length, data.properties.reduce((s: number, p: RentalProperty) => s + p.grossRentalIncome + p.otherIncomes, 0), data.capitalIncome.realEstateWithholdings);
      
      // Calculate 347
      const mod347 = Model347Engine.calculateFromInvoices(data.year, data.iva?.issuedInvoices || [], data.iva?.receivedInvoices || []);

      store.update('quarterlyTaxes', {
        mod130: mod130,
        mod111: [mod111_q4],
        mod115: [mod115_q4],
        mod347: mod347
      });
      
      renderData();
    });

    renderData();
  }, 0);

  return container;
}
