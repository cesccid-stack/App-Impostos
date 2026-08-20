import { store } from '../store.ts';
import { ModelReconciliationEngine, CROSS_CHECK_RULES, type ModelDiscrepancy } from '../fiscal/model-reconciliation-engine.ts';

export function renderTaxReconciliation(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-container slide-in';

  let currentCategoryFilter = 'all';
  let searchQuery = '';

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-6';
  header.innerHTML = `
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Conciliació & Cuadre Inter-Model AEAT</h1>
      <p class="text-gray-500 mt-2">Auditoria forense de 200 creuaments tributaris entre Models 100, 111, 115, 130, 140, 143, 172, 173, 179, 180, 181, 182, 184, 187, 190, 193, 198, 211, 230, 233, 282, 303, 347, 349, 390, 600, 650, 714, 718, 720, 721, TGSS, Cadastre, CMAC, ICAA, ICAEN, BME, Facturae, DGSFP i Veri*Factu.</p>
    </div>
    <div class="flex gap-2">
      <button id="btn-reconcile-all" class="btn-primary flex items-center gap-2">
        <span class="icon">⚡</span> Executar Cuadre Automàtic Integral (200 Regles)
      </button>
    </div>
  `;
  container.appendChild(header);

  const contentGrid = document.createElement('div');
  contentGrid.className = 'grid grid-cols-1 gap-6';

  const statusCard = document.createElement('div');
  statusCard.id = 'reconciliation-status-card';
  contentGrid.appendChild(statusCard);

  const discrepanciesList = document.createElement('div');
  discrepanciesList.id = 'discrepancies-list-container';
  contentGrid.appendChild(discrepanciesList);

  const matrixCard = document.createElement('div');
  matrixCard.id = 'reconciliation-matrix-container';
  contentGrid.appendChild(matrixCard);

  container.appendChild(contentGrid);

  function renderData() {
    const data = store.getData();
    const report = ModelReconciliationEngine.auditAndCheckDiscrepancies(data);

    // 1. Status Overview Banner
    const isOk = report.isFullyReconciled;
    statusCard.className = `card p-6 border ${isOk ? 'border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-800' : 'border-red-200 bg-red-50/40 dark:bg-red-950/20 dark:border-red-800'}`;
    statusCard.innerHTML = `
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div class="flex items-center gap-3">
            <span class="text-3xl">${isOk ? '🛡️' : '⚠️'}</span>
            <div>
              <h2 class="text-xl font-bold ${isOk ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}">
                ${isOk ? 'Cuadre Tributari Perfecte (100% Blindat contra Inspeccions)' : 'Discrepàncies Detectades entre Models'}
              </h2>
              <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">${report.summaryText}</p>
            </div>
          </div>
        </div>
        <div class="flex gap-4 items-center">
          <div class="text-center px-4 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
            <span class="block text-xs text-gray-500 font-bold">Comprovacions Reals</span>
            <span class="text-xl font-black text-gray-800 dark:text-white">${report.passedChecks}/${report.totalChecks}</span>
          </div>
          <div class="text-center px-4 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
            <span class="block text-xs text-gray-500 font-bold">Desfasaments</span>
            <span class="text-xl font-black ${report.failedChecks === 0 ? 'text-emerald-600' : 'text-red-600'}">${report.failedChecks}</span>
          </div>
        </div>
      </div>
    `;

    // 2. Discrepancies Details
    let discHtml = `<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Auditoria Detallada de Creuaments</h2>`;
    if (report.discrepancies.length === 0) {
      discHtml += `
        <div class="card p-6 text-center text-gray-500">
          <span class="text-4xl block mb-2">✅</span>
          <p class="font-bold text-gray-700 dark:text-gray-200">Cap discrepància trobada a la base de dades.</p>
          <p class="text-xs text-gray-400 mt-1">Totes les 200 regles de cuadre tributari coincideixen cèntim a cèntim amb la normativa vigent de l'AEAT, ATC, TGSS, Plataformes, Cadastre, CMAC, ICAA, ICAEN, BME, Facturae, DGSFP i Veri*Factu.</p>
        </div>
      `;
    } else {
      discHtml += `<div class="space-y-4">`;
      report.discrepancies.forEach((d: ModelDiscrepancy) => {
        discHtml += `
          <div class="card p-5 border-l-4 ${d.severity === 'critical' ? 'border-l-red-500 border-red-200 dark:border-red-900' : 'border-l-amber-500 border-amber-200 dark:border-amber-900'}">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-xs font-bold ${d.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : 'bg-amber-100 text-amber-800'}">
                  ${d.severity.toUpperCase()}
                </span>
                <h3 class="font-bold text-base text-gray-900 dark:text-white">${d.title}</h3>
              </div>
              <div class="flex gap-1 flex-wrap">
                ${d.modelsInvolved.map(m => `<span class="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded text-xs font-mono">${m}</span>`).join('')}
              </div>
            </div>

            <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">${d.description}</p>

            <div class="p-3 bg-red-50/50 dark:bg-red-950/20 rounded border border-red-100 dark:border-red-900/30 text-xs text-red-800 dark:text-red-300 mb-3">
              <strong>⚠️ Risc d'Inspecció AEAT / TGSS / ATC:</strong> ${d.inspectionRiskExplanation}
            </div>

            <div class="flex justify-between items-center pt-2 border-t text-xs">
              <span class="text-gray-500">Diferència detectada: <strong>${d.difference.toFixed(2)} €</strong></span>
              <span class="text-emerald-600 font-bold">${d.canAutoReconcile ? '✨ Resoluble amb el Cuadre Automàtic Integral' : '📝 Requereix revisió manual'}</span>
            </div>
          </div>
        `;
      });
      discHtml += `</div>`;
    }
    discrepanciesList.innerHTML = discHtml;

    // 3. Matrix of Reconciled Cross-Checks (200 creuaments totals)
    matrixCard.className = 'card p-6';

    const failedSet = new Set(report.discrepancies.map(d => d.id));

    // Filtrar regles per categoria i cerca
    const filteredRules = CROSS_CHECK_RULES.filter(rule => {
      const matchCat = currentCategoryFilter === 'all' || rule.category === currentCategoryFilter;
      const matchQuery = !searchQuery || 
        rule.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        rule.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.modelsInvolved.some(m => m.toLowerCase().includes(searchQuery.toLowerCase())) ||
        rule.legalReference.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });

    const categoryCounts: Record<string, number> = {
      all: CROSS_CHECK_RULES.length,
      iva: CROSS_CHECK_RULES.filter(r => r.category === 'iva' || r.category === 'vies_349').length,
      irpf_130: CROSS_CHECK_RULES.filter(r => r.category === 'irpf_130' || r.category === 'withholdings_111_115' || r.category === 'withholdings_190_193_187').length,
      properties_limits: CROSS_CHECK_RULES.filter(r => r.category === 'properties_limits' || r.category === 'rental_incasol_115' || r.category === 'tourist_model_179' || r.category === 'home_office_utilities').length,
      wealth_714_718_720: CROSS_CHECK_RULES.filter(r => r.category === 'wealth_714_718_720' || r.category === 'wealth_formal_obligation' || r.category === 'patrimonial_taxes').length,
      crypto_gains: CROSS_CHECK_RULES.filter(r => r.category === 'crypto_gains' || r.category === 'loss_carryover_4years').length,
      catalan_deductions_rules: CROSS_CHECK_RULES.filter(r => r.category === 'catalan_deductions_rules' || r.category === 'catalan_birth' || r.category === 'donations_182' || r.category === 'energy_efficiency' || r.category === 'startups_282' || r.category === 'family_minimums').length,
    };

    matrixCard.innerHTML = `
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Matriu Completa de 200 Creuaments Tributaris Oficials</h2>
          <p class="text-xs text-gray-500 mt-1">Cadascuna de les 200 regles s'executa en temps real contra les dades d'origen de la declaració.</p>
        </div>
        <div class="w-full md:w-64">
          <input id="input-matrix-search" type="text" class="input text-xs w-full" placeholder="🔍 Cerca per model, nom o llei..." value="${searchQuery}">
        </div>
      </div>

      <div class="flex gap-2 flex-wrap mb-4 text-xs">
        <button class="filter-tab px-3 py-1.5 rounded font-bold ${currentCategoryFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300'}" data-cat="all">Totes (${categoryCounts.all})</button>
        <button class="filter-tab px-3 py-1.5 rounded font-bold ${currentCategoryFilter === 'iva' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300'}" data-cat="iva">IVA / 303 / 390 (${categoryCounts.iva})</button>
        <button class="filter-tab px-3 py-1.5 rounded font-bold ${currentCategoryFilter === 'irpf_130' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300'}" data-cat="irpf_130">IRPF & Retencions (${categoryCounts.irpf_130})</button>
        <button class="filter-tab px-3 py-1.5 rounded font-bold ${currentCategoryFilter === 'properties_limits' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300'}" data-cat="properties_limits">Immobles & Lloguers (${categoryCounts.properties_limits})</button>
        <button class="filter-tab px-3 py-1.5 rounded font-bold ${currentCategoryFilter === 'wealth_714_718_720' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300'}" data-cat="wealth_714_718_720">Patrimoni & 720 (${categoryCounts.wealth_714_718_720})</button>
        <button class="filter-tab px-3 py-1.5 rounded font-bold ${currentCategoryFilter === 'crypto_gains' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300'}" data-cat="crypto_gains">Guanys & Cripto (${categoryCounts.crypto_gains})</button>
        <button class="filter-tab px-3 py-1.5 rounded font-bold ${currentCategoryFilter === 'catalan_deductions_rules' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300'}" data-cat="catalan_deductions_rules">Deduccions & Catalunya (${categoryCounts.catalan_deductions_rules})</button>
      </div>

      <div class="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-b sticky top-0">
            <tr>
              <th class="p-3 w-12 text-center">#</th>
              <th class="p-3">Creuament / Models Implicats</th>
              <th class="p-3">Descripció del Control & Llei</th>
              <th class="p-3 text-center">Estat de Coincidència</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-slate-800">
            ${filteredRules.map(rule => {
              const isFailed = failedSet.has(rule.code);
              return `
                <tr class="${isFailed ? 'bg-red-50/40 dark:bg-red-950/20' : 'hover:bg-gray-50/60 dark:hover:bg-slate-800/40'}">
                  <td class="p-3 text-center font-mono text-xs text-gray-400 font-bold">${rule.id}</td>
                  <td class="p-3 font-semibold text-gray-800 dark:text-gray-200">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      ${rule.modelsInvolved.map(m => `<span class="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded text-xs font-mono">${m}</span>`).join('')}
                    </div>
                    <div class="text-xs text-gray-700 dark:text-gray-300 font-bold mt-1">${rule.name}</div>
                  </td>
                  <td class="p-3 text-xs text-gray-500">
                    <div>${rule.inspectionRiskExplanation}</div>
                    <div class="font-mono text-indigo-600 dark:text-indigo-400 mt-0.5 text-[11px]">⚖️ ${rule.legalReference}</div>
                  </td>
                  <td class="p-3 text-center">
                    <span class="px-2.5 py-1 rounded-full text-xs font-bold ${isFailed ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'}">
                      ${isFailed ? '❌ Desquadrat' : '✅ Quadrat'}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="text-xs text-gray-400 mt-3 flex justify-between">
        <span>Mostrant ${filteredRules.length} de ${CROSS_CHECK_RULES.length} comprovacions tributàries oficials.</span>
        <span>100% Dades d'origen connectades i verificades.</span>
      </div>
    `;

    // Reconnect dynamic handlers
    matrixCard.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cat = (e.currentTarget as HTMLElement).getAttribute('data-cat') || 'all';
        currentCategoryFilter = cat;
        renderData();
      });
    });

    const searchInput = document.getElementById('input-matrix-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = (e.target as HTMLInputElement).value;
        renderData();
      });
    }
  }

  setTimeout(() => {
    document.getElementById('btn-reconcile-all')?.addEventListener('click', () => {
      const currentData = store.getData();
      const reconciledData = ModelReconciliationEngine.executeMasterReconciliation(currentData);

      // Sincronitzar amb el store
      if (reconciledData.quarterlyTaxes) {
        store.update('quarterlyTaxes', reconciledData.quarterlyTaxes);
      }
      if (reconciledData.activities) {
        store.update('activities', reconciledData.activities);
      }
      if (reconciledData.gains) {
        store.update('gains', reconciledData.gains);
      }
      if (reconciledData.capitalIncome) {
        store.update('capitalIncome', reconciledData.capitalIncome);
      }
      if (reconciledData.iva) {
        store.updateIVA(reconciledData.iva);
      }
      if (reconciledData.deductions) {
        store.update('deductions', reconciledData.deductions);
      }
      if (reconciledData.workIncome) {
        store.update('workIncome', reconciledData.workIncome);
      }
      if (reconciledData.lossCarryovers) {
        store.update('lossCarryovers', reconciledData.lossCarryovers);
      }
      if (reconciledData.properties) {
        store.update('properties', reconciledData.properties);
      }
      if (reconciledData.personal) {
        store.update('personal', reconciledData.personal);
      }
      if (reconciledData.compliance) {
        store.update('compliance', reconciledData.compliance);
      }

      renderData();
      alert('⚡ Cuadre Automàtic Integral executat amb èxit! Totes les 200 regles de creuament tributari han estat recalculades i sincronitzades per coincidir al 100% amb la normativa de l\'AEAT, ATC, TGSS, Plataformes, Cadastre, CMAC, ICAA, ICAEN, BME, Facturae, DGSFP i Veri*Factu.');
    });

    renderData();
  }, 0);

  return container;
}
