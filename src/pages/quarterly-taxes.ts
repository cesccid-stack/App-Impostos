import { store } from '../store.ts';
import { Model130Engine } from '../fiscal/model130-engine.ts';
import { WithholdingsEngine } from '../fiscal/model111-engine.ts';
import { Model115And180Engine } from '../fiscal/model115-180-engine.ts';
import { Model347Engine } from '../fiscal/model347-engine.ts';
import type { Model130Quarterly, Model111Quarterly, Model115Quarterly, Model347Entity, Model115LeaseInput } from '../types-quarterly.ts';
import type { EmployerItem } from '../types.ts';
import type { RentalProperty } from '../types-properties.ts';

export function renderQuarterlyTaxes(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-container slide-in';
  
  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-6';
  header.innerHTML = `
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Models Trimestrals i Obligacions AEAT</h1>
      <p class="text-gray-500 mt-2">Pagaments fraccionats (Mod. 130), retencions treball (Mod. 111), retencions lloguers (Mod. 115/180) i operacions tercers (Mod. 347).</p>
    </div>
    <button id="recalc-btn" class="btn-primary">
      <span class="icon">🔄</span> Calcular i Conciliar Models
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

  // Card Mod 115 & 180 (Lloguers)
  const leasesCard = document.createElement('div');
  leasesCard.className = 'card col-span-1 lg:col-span-2';
  leasesCard.id = 'leases-115-180-container';
  contentGrid.appendChild(leasesCard);

  // Card Mod 111
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
    
    // 1. Mod 130 View
    let mod130Html = `<h2 class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-4 border-b pb-2">Model 130 - Pagament Fraccionat IRPF (20%)</h2>`;
    if (!data.quarterlyTaxes?.mod130 || data.quarterlyTaxes.mod130.length === 0) {
      mod130Html += `<p class="text-gray-500">No hi ha dades calculades. Fes clic a Calcular i Conciliar Models.</p>`;
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

    // 2. Mod 115 & 180 View (Arrendaments Urbans)
    const mod115List = data.quarterlyTaxes?.mod115 || [];
    const mod180 = data.quarterlyTaxes?.mod180;
    let leasesHtml = `
      <div class="flex justify-between items-center mb-4 border-b pb-2">
        <div>
          <h2 class="text-xl font-bold text-amber-600 dark:text-amber-400">Control de Lloguers: Model 115 (Trimestral 19%) i Model 180 (Resum Anual)</h2>
          <p class="text-xs text-gray-500 mt-1">Art. 75.2.a RIRPF - Retencions sobre arrendaments d'immobles urbans afectes a activitats.</p>
        </div>
        ${mod180?.reconciliationWith115Status === 'perfect' 
          ? '<span class="px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 text-xs font-bold rounded-full">✓ 115 i 180 Conciliats</span>'
          : '<span class="px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 text-xs font-bold rounded-full">Pendent de Conciliació</span>'}
      </div>
    `;

    if (mod115List.length === 0) {
      leasesHtml += `<p class="text-gray-500 text-sm">No s'han generat càlculs per al Model 115/180. Premeu el botó superior per a calcular.</p>`;
    } else {
      leasesHtml += `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3">Declaracions Trimestrals Model 115 (1T a 4T)</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      `;
      mod115List.forEach((q: Model115Quarterly) => {
        leasesHtml += `
          <div class="bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/40 text-xs space-y-1">
            <div class="font-bold text-amber-800 dark:text-amber-300">${q.quarter}</div>
            <div class="text-gray-600 dark:text-gray-400">Perceptors: <strong>${q.recipientsCount}</strong></div>
            <div class="text-gray-600 dark:text-gray-400">Base: ${q.baseTotal.toFixed(2)} €</div>
            <div class="font-bold text-amber-700 dark:text-amber-400 border-t pt-1">Retenció (19%): ${q.totalToPay.toFixed(2)} €</div>
          </div>
        `;
      });
      leasesHtml += `
            </div>
          </div>
          <div>
            <h3 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3">Resum Anual Model 180 (Generació Oficial)</h3>
            <div class="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
              <div class="flex justify-between py-1"><span>Total Perceptors (Arrendadors):</span> <strong>${mod180?.totalRecipientsCount || 0}</strong></div>
              <div class="flex justify-between py-1"><span>Base Anual Total Arrendaments:</span> <strong>${(mod180?.totalBaseAnnual || 0).toFixed(2)} €</strong></div>
              <div class="flex justify-between py-1 border-t mt-2 pt-2 text-amber-700 dark:text-amber-400 font-bold">
                <span>Retencions Anuals Model 180:</span> <span>${(mod180?.totalWithholdingsAnnual || 0).toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    leasesCard.innerHTML = leasesHtml;

    // 3. Mod 111 View
    let withHtml = `<h2 class="text-xl font-bold text-blue-600 dark:text-blue-400 mb-4 border-b pb-2">Model 111 (Treball i Professionals)</h2>`;
    if (!data.quarterlyTaxes?.mod111 || data.quarterlyTaxes.mod111.length === 0) {
      withHtml += `<p class="text-gray-500">Sense dades calculades.</p>`;
    } else {
      const q4_111 = data.quarterlyTaxes.mod111.find((q: Model111Quarterly) => q.quarter === '4T') || data.quarterlyTaxes.mod111[0];
      withHtml += `
        <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2 text-sm">
          <h3 class="font-bold text-blue-800 dark:text-blue-300">Model 111 (${q4_111?.quarter || '1T'})</h3>
          <div class="flex justify-between"><span>Perceptors de treball:</span> <strong>${q4_111?.workRecipientsCount || 0}</strong></div>
          <div class="flex justify-between"><span>Base Treball:</span> <span>${(q4_111?.workBaseTotal || 0).toFixed(2)} €</span></div>
          <div class="flex justify-between"><span>Retencions Professionals:</span> <span>${(q4_111?.profWithholdings || 0).toFixed(2)} €</span></div>
          <div class="flex justify-between font-bold text-blue-700 dark:text-blue-300 pt-2 border-t">
            <span>Resultat a ingressar:</span> <span>${(q4_111?.totalToPay || 0).toFixed(2)} €</span>
          </div>
        </div>
      `;
    }
    withholdingsCard.innerHTML = withHtml;

    // 4. Mod 347 View
    let mod347Html = `<h2 class="text-xl font-bold text-purple-600 dark:text-purple-400 mb-4 border-b pb-2">Model 347 (Operacions > 3.005,06 €)</h2>`;
    const mod347 = data.quarterlyTaxes?.mod347;
    if (!mod347 || mod347.entities.length === 0) {
      mod347Html += `<p class="text-gray-500 text-sm">Cap client ni proveïdor supera el llindar de 3.005,06 € en l'exercici.</p>`;
    } else {
      mod347Html += `
        <div class="mb-4 text-xs font-bold flex justify-between bg-purple-50 dark:bg-purple-900/20 p-2.5 rounded">
          <span>Volum Clients: ${mod347.totalClientsVolume.toFixed(2)} €</span>
          <span>Volum Proveïdors: ${mod347.totalSuppliersVolume.toFixed(2)} €</span>
        </div>
        <ul class="space-y-2">
      `;
      mod347.entities.forEach((ent: Model347Entity) => {
        mod347Html += `
          <li class="flex justify-between items-center text-xs p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded border border-gray-100 dark:border-slate-700">
            <div>
              <span class="font-bold">${ent.nif}</span>
              <span class="block text-gray-500">${ent.name} (${ent.type === 'client' ? 'Client' : 'Proveïdor'})</span>
            </div>
            <div class="font-bold text-purple-700 dark:text-purple-300">${ent.totalAmount.toFixed(2)} €</div>
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
      
      // 1. Calculate Model 130
      const mod130 = Model130Engine.calculateFromYearlyActivities(data.activities, data.year, data.deductions.housingDeduction);
      
      // 2. Calculate Model 111
      const workWithhold = data.workIncome.employers.reduce((sum: number, e: EmployerItem) => sum + e.withholdings, 0);
      const workGross = data.workIncome.employers.reduce((s: number, e: EmployerItem) => s + e.grossSalary, 0);
      const mod111_quarters = (['1T', '2T', '3T', '4T'] as const).map(q => 
        WithholdingsEngine.calculateModel111(q, data.year, data.workIncome.employers.length, workGross / 4, workWithhold / 4, 0, 0, 0)
      );

      // 3. Calculate Model 115 & Model 180 (Arrendaments)
      // Construïm la llista d'immobles arrendats a partir de properties o despeses d'arrendament d'activitats
      const leases: Model115LeaseInput[] = (data.properties || []).map((p: RentalProperty, idx: number) => ({
        id: p.id || `lease_${idx}`,
        landlordNif: data.personal?.nif || 'B12345678',
        landlordName: data.personal?.name || 'Arrendador Principal',
        cadastralReference: p.cadastralReference || '00000000000000000000',
        address: p.address || 'Carrer Major 1',
        postalCode: '08001',
        municipality: 'Barcelona',
        provinceCode: '08',
        propertySituation: '1',
        monthlyRent: (p.grossRentalIncome || 12000) / 12,
        withholdingRate: 0.19,
        isExempt: false,
      }));

      const mod115_quarters = Model115And180Engine.calculateModel115AllQuarters(data.year, leases);
      const mod180_annual = Model115And180Engine.generateModel180Annual(data.year, leases, mod115_quarters);

      // 4. Calculate Model 347
      const mod347 = Model347Engine.calculateFromInvoices(data.year, data.iva?.issuedInvoices || [], data.iva?.receivedInvoices || []);

      store.update('quarterlyTaxes', {
        mod130,
        mod111: mod115_quarters.length ? mod111_quarters : [],
        mod115: mod115_quarters,
        mod180: mod180_annual,
        mod347,
      });
      
      renderData();
    });

    renderData();
  }, 0);

  return container;
}

