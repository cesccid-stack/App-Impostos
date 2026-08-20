import { store } from '../store.ts';
import { AutonomoVsSLEngine } from '../fiscal/autonomo-vs-sl-engine.ts';
import { PensionsOptimizerEngine } from '../fiscal/pensions-optimizer.ts';
import type { AutonomoVsSLData, PensionRescueData } from '../types-strategy.ts';

export function renderStrategicAdvisor(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-container slide-in';

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-6';
  header.innerHTML = `
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Assessorament Estratègic & Optimització</h1>
      <p class="text-gray-500 mt-2">Simulacions financeres: Autònom vs S.L., i rescat òptim de Plans de Pensions.</p>
    </div>
    <div class="flex gap-2">
      <button id="add-sl-btn" class="btn-primary">
        <span class="icon">🏢</span> Simular S.L.
      </button>
      <button id="add-pension-btn" class="btn-secondary">
        <span class="icon">💰</span> Simular Pensions
      </button>
    </div>
  `;
  container.appendChild(header);

  const contentGrid = document.createElement('div');
  contentGrid.className = 'grid grid-cols-1 gap-6';

  const slContainer = document.createElement('div');
  slContainer.id = 'sl-grid';
  contentGrid.appendChild(slContainer);

  const pensionsContainer = document.createElement('div');
  pensionsContainer.id = 'pensions-grid';
  contentGrid.appendChild(pensionsContainer);

  container.appendChild(contentGrid);

  function renderData() {
    const data = store.getData();
    
    // Autonomo vs SL View
    let slHtml = `<h2 class="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-4 border-b pb-2">Comparativa Autònom vs Societat Limitada</h2>`;
    const slSims = data.strategicAdvising?.autonomoVsSL;
    
    if (!slSims || slSims.length === 0) {
      slHtml += `<p class="text-gray-500 text-sm">No hi ha simulacions actives.</p>`;
    } else {
      slSims.forEach((sim: AutonomoVsSLData) => {
        const recomendationClass = sim.recommendation === 'sl' ? 'bg-indigo-50 border-indigo-200 text-indigo-900 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-200' : 'bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-200';
        const recText = sim.recommendation === 'sl' ? 'Passar a S.L.' : 'Mantenir com a Autònom';
        
        slHtml += `
          <div class="card p-4 border border-gray-200 dark:border-gray-800 mb-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded">
                <h3 class="font-bold text-center mb-2">Com a Autònom</h3>
                <div class="text-sm space-y-1">
                  <div class="flex justify-between"><span>Rendiment Net:</span> <span>${(sim.expectedRevenue - sim.expectedExpenses).toFixed(2)} €</span></div>
                  <div class="flex justify-between text-red-500"><span>Càrrega Fiscal Total:</span> <span>-${sim.totalTaxesAutonomo.toFixed(2)} €</span></div>
                  <div class="flex justify-between font-bold border-t pt-1 mt-1"><span>Líquid Disponible:</span> <span>${sim.netIncomeAutonomo.toFixed(2)} €</span></div>
                </div>
              </div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded">
                <h3 class="font-bold text-center mb-2">Com a Societat Limitada</h3>
                <div class="text-sm space-y-1">
                  <div class="flex justify-between"><span>Rendiment Net Empresa:</span> <span>${(sim.expectedRevenue - sim.expectedExpenses).toFixed(2)} €</span></div>
                  <div class="flex justify-between text-red-500"><span>Càrrega Fiscal Total:</span> <span>-${sim.totalTaxesSL.toFixed(2)} €</span></div>
                  <div class="flex justify-between font-bold border-t pt-1 mt-1"><span>Líquid Disponible:</span> <span>${sim.netIncomeSL.toFixed(2)} €</span></div>
                </div>
              </div>
            </div>
            <div class="mt-4 p-3 rounded border text-center font-bold ${recomendationClass}">
              Recomanació: ${recText} (Estalvi Fiscal: ${sim.savings.toFixed(2)} €)
            </div>
          </div>
        `;
      });
    }
    slContainer.innerHTML = slHtml;

    // Pensions View
    let penHtml = `<h2 class="text-xl font-bold text-teal-600 dark:text-teal-400 mb-4 border-b pb-2">Optimització de Rescat de Plans de Pensions</h2>`;
    const penSims = data.strategicAdvising?.pensionRescues;
    
    if (!penSims || penSims.length === 0) {
      penHtml += `<p class="text-gray-500 text-sm">No hi ha simulacions actives.</p>`;
    } else {
      penSims.forEach((sim: PensionRescueData) => {
        penHtml += `
          <div class="card p-4 border border-teal-100 dark:border-teal-900 mb-4">
            <div class="mb-4 text-sm flex justify-between bg-teal-50 dark:bg-teal-900/20 p-2 rounded">
              <span>Valor Fons: ${sim.pensionFundValue.toFixed(2)} €</span>
              <span>Aportacions pre-2007: ${sim.pre2007Contributions.toFixed(2)} €</span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        `;
        
        sim.scenarios.forEach(scen => {
          const isBest = scen.name === sim.bestScenarioName;
          const bestClass = isBest ? 'border-2 border-teal-500 bg-teal-50/50 dark:bg-teal-900/20 shadow-md' : 'border border-gray-200 dark:border-gray-800 opacity-70 hover:opacity-100';
          
          penHtml += `
              <div class="p-3 rounded ${bestClass} relative">
                ${isBest ? '<div class="absolute -top-3 -right-3 text-2xl">🏆</div>' : ''}
                <h3 class="font-bold text-sm mb-1">${scen.name}</h3>
                <p class="text-xs text-gray-500 mb-3 h-10 overflow-hidden">${scen.description}</p>
                <div class="text-xs space-y-1">
                  <div class="flex justify-between"><span>Capital directe:</span> <span>${scen.capitalRescueAmount.toFixed(2)} €</span></div>
                  <div class="flex justify-between"><span>Renda anual:</span> <span>${scen.yearlyRentaAmount.toFixed(2)} €</span></div>
                  <div class="flex justify-between font-bold text-red-500 mt-2 border-t pt-1">
                    <span>Impacte Fiscal Total:</span> <span>${scen.taxCost.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
          `;
        });
        
        penHtml += `
            </div>
          </div>
        `;
      });
    }
    pensionsContainer.innerHTML = penHtml;
  }

  setTimeout(() => {
    document.getElementById('add-sl-btn')?.addEventListener('click', () => {
      const data = store.getData();
      
      const newSim: AutonomoVsSLData = {
        expectedRevenue: 120000,
        expectedExpenses: 30000,
        irpfMarginalRate: 0,
        autonomoQuota: 4500,
        corporateTaxRate: 25,
        dividendTaxRate: 0,
        slMaintenanceCost: 1500,
        societalSalary: 35000,
        netIncomeAutonomo: 0,
        totalTaxesAutonomo: 0,
        netIncomeSL: 0,
        totalTaxesSL: 0,
        recommendation: 'autonomo',
        savings: 0
      };

      const calculated = AutonomoVsSLEngine.simulate(newSim);

      store.update('strategicAdvising', {
        ...data.strategicAdvising,
        autonomoVsSL: [...(data.strategicAdvising?.autonomoVsSL || []), calculated]
      });
      renderData();
    });

    document.getElementById('add-pension-btn')?.addEventListener('click', () => {
      const data = store.getData();
      
      const newSim: PensionRescueData = {
        pensionFundValue: 100000,
        pre2007Contributions: 30000,
        yearsSinceRetirement: 1,
        otherYearlyIncome: 25000,
        scenarios: [],
        bestScenarioName: ''
      };

      const calculated = PensionsOptimizerEngine.optimizeRescue(newSim);

      store.update('strategicAdvising', {
        ...data.strategicAdvising,
        pensionRescues: [...(data.strategicAdvising?.pensionRescues || []), calculated]
      });
      renderData();
    });

    renderData();
  }, 0);

  return container;
}
