import { store } from '../store.ts';
import { OCRIngestionEngine } from '../fiscal/ocr-ingestion-engine.ts';
import type { OCRDocument, IngestionBatch } from '../types-ocr.ts';
import type { IVAInvoiceIssued, IVAInvoiceReceived } from '../types-iva.ts';

export function renderDocumentIngestion(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-container slide-in';

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-6';
  header.innerHTML = `
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Bústia d'Ingesta Intel·ligent</h1>
      <p class="text-gray-500 mt-2">Pujada de documents (PDF/Imatges) i extracció automàtica de dades mitjançant OCR AI.</p>
    </div>
    <div class="flex gap-2">
      <button id="upload-docs-btn" class="btn-primary">
        <span class="icon">📤</span> Pujar Documents
      </button>
      <button id="import-all-btn" class="btn-secondary">
        <span class="icon">📥</span> Volcar a Factures IVA
      </button>
    </div>
  `;
  container.appendChild(header);

  const contentGrid = document.createElement('div');
  contentGrid.className = 'grid grid-cols-1 gap-6';

  const batchesContainer = document.createElement('div');
  batchesContainer.id = 'batches-grid';
  contentGrid.appendChild(batchesContainer);

  container.appendChild(contentGrid);

  function renderData() {
    const data = store.getData();
    const batches = data.ocrBatches || [];
    
    let html = `<h2 class="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-4 border-b pb-2">Llots Processats</h2>`;
    
    if (batches.length === 0) {
      html += `<p class="text-gray-500 text-sm">No s'ha pujat cap document encara.</p>`;
    } else {
      batches.forEach((batch: IngestionBatch) => {
        html += `
          <div class="card p-4 border border-indigo-200 dark:border-indigo-900 mb-4">
            <div class="flex justify-between mb-3 border-b pb-2">
              <span class="font-bold text-indigo-800 dark:text-indigo-300">Llot: ${batch.batchId}</span>
              <span class="text-xs text-gray-500">${new Date(batch.date).toLocaleString()}</span>
            </div>
            <ul class="space-y-3">
        `;
        
        batch.documents.forEach((doc: OCRDocument) => {
          let statusColor = 'text-emerald-500 bg-emerald-50';
          let icon = '✅';
          if (doc.status === 'pending') {
            statusColor = 'text-amber-600 bg-amber-50';
            icon = '⚠️';
          } else if (doc.status === 'error') {
            statusColor = 'text-red-500 bg-red-50';
            icon = '❌';
          }

          html += `
              <li class="p-3 border rounded text-sm flex flex-col md:flex-row justify-between items-start md:items-center">
                <div class="mb-2 md:mb-0">
                  <span class="font-bold block">${doc.filename}</span>
                  <span class="text-xs text-gray-500 block">Tipus Detectat: ${doc.documentType}</span>
                </div>
                <div class="text-right">
                  <span class="px-2 py-1 rounded text-xs font-bold ${statusColor}">${icon} ${doc.status.toUpperCase()} (Conf: ${((doc.confidenceScore || 0) * 100).toFixed(1)}%)</span>
                  ${doc.extractedData ? `<span class="block mt-1 text-xs text-indigo-500">Dades extretes llestes per volcar al Llibre Registre</span>` : ''}
                </div>
              </li>
          `;
        });
        
        html += `
            </ul>
          </div>
        `;
      });
    }
    
    batchesContainer.innerHTML = html;
  }

  setTimeout(() => {
    document.getElementById('upload-docs-btn')?.addEventListener('click', () => {
      const data = store.getData();
      
      const mockDocsToUpload = [
        { filename: 'factura_amazon_agost.pdf', type: 'invoice_received' },
        { filename: 'nomina_juliol.pdf', type: 'payroll' },
        { filename: 'ticket_taxi.jpg', type: 'ticket' }
      ];

      const batch = OCRIngestionEngine.processBatch(mockDocsToUpload);

      store.update('ocrBatches', [
        batch,
        ...(data.ocrBatches || [])
      ]);
      
      renderData();
    });

    document.getElementById('import-all-btn')?.addEventListener('click', () => {
      const data = store.getData();
      const batches = data.ocrBatches || [];
      let importedCount = 0;

      for (const batch of batches) {
        for (const doc of batch.documents) {
          if (doc.extractedData && doc.documentType === 'invoice_received') {
            store.addReceivedInvoice(doc.extractedData as IVAInvoiceReceived);
            importedCount++;
          } else if (doc.extractedData && doc.documentType === 'invoice_issued') {
            store.addIssuedInvoice(doc.extractedData as IVAInvoiceIssued);
            importedCount++;
          }
        }
      }

      if (importedCount > 0) {
        alert(`S'han importat ${importedCount} factures directament al Llibre Registre d'IVA (Model 303)!`);
      } else {
        alert('No hi ha factures extretes pendents per importar.');
      }
    });

    renderData();
  }, 0);

  return container;
}
