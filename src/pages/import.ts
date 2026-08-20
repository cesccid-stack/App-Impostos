/**
 * @module pages/import
 * Mass import page for parsing CSVs and calculating FIFO.
 */

import { store } from '../store.ts';
import { createField } from '../components/form-field.ts';
import { showToast } from '../components/toast.ts';
import { formatCurrency } from '../utils/currency.ts';
import { parseDegiro } from '../import/parser-degiro.ts';
import { parseGeneric } from '../import/parser-generic.ts';
import { calculateFIFO, matchesToGainItems } from '../import/fifo-engine.ts';
import type { TradeRecord, FIFOMatch, AssetSummary } from '../types-portfolio.ts';

export function renderImport(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page';

  page.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Importació Massiva i FIFO</h1>
      <p class="page-header__subtitle">Puja el teu historial d'operacions (CSV) per calcular guanys patrimonials automàticament</p>
    </div>
  `;

  const configCard = document.createElement('div');
  configCard.className = 'card';
  configCard.innerHTML = `<div class="card__header"><div class="card__title">1. Selecció de Bròker</div></div>`;
  
  let selectedBroker = 'degiro';
  let parsedTrades: TradeRecord[] = [];
  let fifoResult: { matches: FIFOMatch[], summaries: AssetSummary[] } | null = null;

  const brokerSelect = createField({
    id: 'broker-select',
    label: 'Bròker / Format',
    type: 'select',
    value: 'degiro',
    options: [
      { value: 'degiro', label: 'DEGIRO (Transactions.csv)' },
      { value: 'ibkr', label: 'Interactive Brokers (Flex Query CSV)' },
      { value: 'traderepublic', label: 'Trade Republic (CSV)' },
      { value: 'revolut', label: 'Revolut (CSV)' },
      { value: 'quantfury', label: 'Quantfury (CSV)' },
      { value: 'generic', label: 'Genèric (Auto-detecció bàsica)' },
    ],
    onChange: (val) => { selectedBroker = val; },
  });
  configCard.appendChild(brokerSelect);

  const fileInputContainer = document.createElement('div');
  fileInputContainer.style.marginTop = 'var(--space-lg)';
  fileInputContainer.innerHTML = `
    <label class="form-field__label">Fitxer CSV</label>
    <div class="file-drop-zone" style="border:2px dashed var(--border-default); padding:var(--space-xl); text-align:center; border-radius:var(--radius-lg); cursor:pointer;">
      <div style="font-size:2rem; margin-bottom:var(--space-sm);">📄</div>
      <div>Fes clic per seleccionar el teu CSV</div>
    </div>
    <input type="file" id="csv-upload" accept=".csv" style="display:none;" />
  `;

  configCard.appendChild(fileInputContainer);
  page.appendChild(configCard);

  const previewCard = document.createElement('div');
  previewCard.className = 'card';
  previewCard.style.marginTop = 'var(--space-lg)';
  previewCard.style.display = 'none';
  page.appendChild(previewCard);

  // Event listeners for file upload
  setTimeout(() => {
    const dropZone = fileInputContainer.querySelector('.file-drop-zone') as HTMLElement;
    const input = fileInputContainer.querySelector('#csv-upload') as HTMLInputElement;

    dropZone.addEventListener('click', () => input.click());
    input.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      dropZone.innerHTML = `<div class="spinner"></div><div>Processant ${file.name}...</div>`;

      try {
        const text = await file.text();
        parsedTrades = await processCSV(text, selectedBroker);
        
        if (parsedTrades.length === 0) {
           showToast('No s\'han trobat operacions vàlides al CSV', 'error');
           resetDropZone(dropZone);
           return;
        }

        showToast(`Processades ${parsedTrades.length} operacions`, 'success');
        fifoResult = calculateFIFO(parsedTrades);
        renderPreview(previewCard, fifoResult);
        previewCard.style.display = 'block';
        resetDropZone(dropZone, file.name);

      } catch (err) {
        console.error(err);
        showToast('Error en processar el fitxer', 'error');
        resetDropZone(dropZone);
      }
    });
  }, 0);

  return page;
}

function resetDropZone(zone: HTMLElement, filename?: string) {
  if (filename) {
     zone.innerHTML = `<div style="font-size:2rem; margin-bottom:var(--space-sm);">✅</div><div class="text-success">${filename} carregat</div>`;
  } else {
     zone.innerHTML = `<div style="font-size:2rem; margin-bottom:var(--space-sm);">📄</div><div>Fes clic per seleccionar el teu CSV</div>`;
  }
}

async function processCSV(csv: string, broker: string): Promise<TradeRecord[]> {
  if (broker === 'degiro') {
    try {
      const degiroTrades = await parseDegiro(csv);
      if (degiroTrades.length > 0) return degiroTrades;
    } catch {
      // Fallback to generic auto-detect
    }
  }

  // Universal smart auto-detection parser (handles IBKR, Trade Republic, Revolut, eToro, Binance, Coinbase, etc.)
  return parseGeneric(csv, undefined, broker as any);
}

function renderPreview(container: HTMLElement, result: { matches: FIFOMatch[], summaries: AssetSummary[] }) {
  container.innerHTML = `
    <div class="card__header">
      <div class="card__title">2. Resultat del Mètode FIFO</div>
      <div class="card__subtitle">${result.matches.length} vendes conciliades amb compres anteriors</div>
    </div>
  `;

  // Summary Table
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-wrapper';
  
  let totalRealized = 0;
  
  let html = `
    <table class="table" style="margin-bottom:var(--space-lg);">
      <thead>
        <tr>
          <th>Actiu</th>
          <th style="text-align:right;">Posició Oberta</th>
          <th style="text-align:right;">Total Comprat</th>
          <th style="text-align:right;">Total Venut</th>
          <th style="text-align:right;">Guany/Pèrdua Realitzada</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const s of result.summaries) {
    if (s.totalBought === 0 && s.totalSold === 0) continue;
    totalRealized += s.realizedGain;
    html += `
      <tr>
        <td><strong>${s.symbol}</strong></td>
        <td style="text-align:right;">${s.openPosition}</td>
        <td style="text-align:right;">${formatCurrency(s.totalBought)}</td>
        <td style="text-align:right;">${formatCurrency(s.totalSold)}</td>
        <td style="text-align:right; font-weight:bold;" class="${s.realizedGain >= 0 ? 'text-success' : 'text-error'}">
          ${formatCurrency(s.realizedGain)}
        </td>
      </tr>
    `;
  }

  html += `
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4"><strong>TOTAL RENDIMENT (any fiscal a determinar)</strong></td>
          <td style="text-align:right; font-size:var(--text-lg); font-weight:bold;" class="${totalRealized >= 0 ? 'text-success' : 'text-error'}">
            ${formatCurrency(totalRealized)}
          </td>
        </tr>
      </tfoot>
    </table>
  `;

  tableWrapper.innerHTML = html;
  container.appendChild(tableWrapper);

  // Detail list of matches
  const details = document.createElement('div');
  details.innerHTML = `<h4>Detall d'operacions subjectes a tributació (Vendes)</h4>`;
  
  const list = document.createElement('div');
  list.className = 'item-list';
  list.style.marginTop = 'var(--space-md)';
  
  for (const match of result.matches) {
    const isAnti = match.antiApplicationRuleApplied;
    const row = document.createElement('div');
    row.className = 'item-row';
    if (isAnti) row.style.opacity = '0.7';
    
    row.innerHTML = `
      <div class="item-row__content">
        <div class="item-row__field">
          <span class="item-row__field-label">Data Venda</span>
          <span class="item-row__field-value">${match.sellTrade.date}</span>
        </div>
        <div class="item-row__field">
          <span class="item-row__field-label">Actiu</span>
          <span class="item-row__field-value"><strong>${match.sellTrade.symbol}</strong></span>
        </div>
        <div class="item-row__field">
          <span class="item-row__field-label">Guany / Pèrdua</span>
          <span class="item-row__field-value ${match.totalGain >= 0 ? 'text-success' : 'text-error'}" style="font-weight:bold;">
            ${formatCurrency(match.totalGain)}
          </span>
        </div>
        <div class="item-row__field">
          <span class="item-row__field-label">Estat</span>
          <span class="item-row__field-value">
            ${isAnti ? '<span class="badge badge--error">Regla 2 mesos (No compensable)</span>' : '<span class="badge badge--success">Compensable</span>'}
          </span>
        </div>
      </div>
    `;
    list.appendChild(row);
  }

  details.appendChild(list);
  container.appendChild(details);

  // Save actions
  const actions = document.createElement('div');
  actions.style.marginTop = 'var(--space-xl)';
  actions.style.display = 'flex';
  actions.style.justifyContent = 'flex-end';
  
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn--primary';
  saveBtn.textContent = 'Integrar a la Declaració Actual';
  saveBtn.addEventListener('click', () => {
    // Determine the active year to only include trades from that year
    const activeYear = store.getYear().toString();
    
    const gainItems = matchesToGainItems(result.matches);
    
    // Filter by year
    const yearItems = gainItems.filter(item => item.transferDate.startsWith(activeYear));
    
    if (yearItems.length === 0) {
      showToast(`No hi ha operacions de l'any ${activeYear} per integrar.`, 'warning');
      return;
    }

    const gains = store.getData().gains;
    store.setSection('gains', {
      ...gains,
      items: [...gains.items, ...yearItems],
    });

    showToast(`S'han afegit ${yearItems.length} operacions al patrimoni`, 'success');
    
    // Redirect to gains
    window.location.hash = '#/guanys';
  });

  actions.appendChild(saveBtn);
  container.appendChild(actions);
}
