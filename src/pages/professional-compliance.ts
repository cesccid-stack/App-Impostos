import { store } from '../store.ts';
import { ProfessionalComplianceEngine } from '../fiscal/professional-compliance-engine.ts';
import type { VerifactuRecord, OfficialBook } from '../types-compliance.ts';
import type { IVAInvoiceIssued } from '../types-iva.ts';

export function renderProfessionalCompliance(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-container slide-in';

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-6';
  header.innerHTML = `
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Compliance & Veri*Factu</h1>
      <p class="text-gray-500 mt-2">Certificació de Llibres Oficials, enviament Veri*Factu AEAT i inalterabilitat Blockchain-like.</p>
    </div>
    <div class="flex gap-2">
      <button id="send-verifactu-btn" class="btn-primary">
        <span class="icon">📤</span> Enviar a Hisenda
      </button>
      <button id="lock-books-btn" class="btn-secondary text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/30">
        <span class="icon">🔒</span> Tancar Llibres 2024
      </button>
    </div>
  `;
  container.appendChild(header);

  const contentGrid = document.createElement('div');
  contentGrid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6';

  const verifactuContainer = document.createElement('div');
  verifactuContainer.id = 'verifactu-grid';
  contentGrid.appendChild(verifactuContainer);

  const booksContainer = document.createElement('div');
  booksContainer.id = 'books-grid';
  contentGrid.appendChild(booksContainer);

  container.appendChild(contentGrid);

  function renderData() {
    const data = store.getData();
    const compliance = data.compliance;
    
    if (!compliance) return;

    // Verifactu
    let vfHtml = `<h2 class="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-4 border-b pb-2">Registres Veri*Factu</h2>`;
    
    if (compliance.verifactuRecords.length === 0) {
      vfHtml += `<p class="text-gray-500 text-sm">No hi ha factures pendents d'enviament.</p>`;
    } else {
      vfHtml += `<div class="space-y-4">`;
      compliance.verifactuRecords.forEach((record: VerifactuRecord) => {
        let statusBadge = '';
        if (record.submissionStatus === 'pending') statusBadge = '<span class="px-2 py-1 text-xs rounded bg-amber-100 text-amber-800">Pendent</span>';
        if (record.submissionStatus === 'accepted') statusBadge = '<span class="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-800">Acceptada AEAT</span>';
        
        vfHtml += `
          <div class="card p-4 border ${record.submissionStatus === 'accepted' ? 'border-emerald-200' : 'border-gray-200'}">
            <div class="flex justify-between items-start mb-2">
              <span class="font-bold">Factura: ${record.invoiceNumber}</span>
              ${statusBadge}
            </div>
            <div class="text-xs text-gray-500 font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded mb-2 break-all">
              Hash: ${record.hashSignature}
            </div>
            ${record.aeatCvs ? `<div class="text-xs text-emerald-600 font-bold mb-2">CVS: ${record.aeatCvs}</div>` : ''}
            <div class="text-xs">
              <a href="${record.qrCodeData}" target="_blank" class="text-blue-500 hover:underline flex items-center">
                <span class="mr-1">🔗</span> URL de Verificació QR
              </a>
            </div>
          </div>
        `;
      });
      vfHtml += `</div>`;
    }
    verifactuContainer.innerHTML = vfHtml;

    // Books
    let booksHtml = `<h2 class="text-xl font-bold text-amber-600 dark:text-amber-400 mb-4 border-b pb-2">Llibres Oficials AEAT</h2>`;
    
    if (compliance.officialBooks.length === 0) {
      booksHtml += `<p class="text-gray-500 text-sm">Cap llibre tancat ni certificat oficialment.</p>`;
    } else {
      booksHtml += `<div class="grid grid-cols-1 gap-4">`;
      compliance.officialBooks.forEach((book: OfficialBook) => {
        const typeLabel = book.bookType === 'issued_invoices' ? 'Factures Emeses' : 
                          book.bookType === 'received_invoices' ? 'Factures Rebudes' : book.bookType;
                          
        booksHtml += `
          <div class="card p-4 border border-amber-200 dark:border-amber-900 bg-amber-50/30">
            <div class="flex justify-between items-center mb-2">
              <span class="font-bold text-lg">${typeLabel} ${book.year}</span>
              <span class="text-2xl">${book.isLocked ? '🔒' : '🔓'}</span>
            </div>
            <div class="text-sm space-y-1">
              <div class="flex justify-between"><span>Registres totals:</span> <span class="font-bold">${book.totalRecords}</span></div>
              <div class="flex justify-between text-gray-500"><span>Data certificació:</span> <span>${new Date(book.lastUpdated).toLocaleDateString()}</span></div>
              <div class="flex justify-between mt-2 pt-2 border-t text-amber-600 font-bold">
                <span>Estat:</span> <span>${book.isLocked ? 'Tancat i Inalterable' : 'Obert'}</span>
              </div>
            </div>
          </div>
        `;
      });
      booksHtml += `</div>`;
    }
    booksContainer.innerHTML = booksHtml;
  }

  setTimeout(() => {
    // Sincronitzar automàticament amb les factures emeses reals de l'IVA
    const initData = store.getData();
    const ivaIssued = store.getIVA().issuedInvoices;
    
    if (initData.compliance?.verifactuRecords.length === 0) {
      if (ivaIssued.length > 0) {
        let prevHash = '';
        const records: VerifactuRecord[] = [];
        for (const inv of ivaIssued) {
          const rec = ProfessionalComplianceEngine.generateVerifactuRecord(inv, prevHash);
          records.push(rec);
          prevHash = rec.hashSignature;
        }
        store.update('compliance', {
          ...initData.compliance,
          verifactuRecords: records
        });
      } else {
        const mockInvoice: IVAInvoiceIssued = {
          id: 'inv-test-vf',
          quarter: '3T',
          invoiceNumber: '2024/001',
          date: '2024-08-15',
          clientName: 'Consumidor Final',
          clientNif: '12345678Z',
          concept: 'Serveis Professionals',
          taxableBase: 1000,
          vatRate: 21,
          vatAmount: 210,
          totalInvoice: 1210,
          category: 'activity_service'
        };
        const record = ProfessionalComplianceEngine.generateVerifactuRecord(mockInvoice);
        store.update('compliance', {
          ...initData.compliance,
          verifactuRecords: [record]
        });
      }
    }

    document.getElementById('send-verifactu-btn')?.addEventListener('click', () => {
      const data = store.getData();
      if (!data.compliance) return;

      const submitted = ProfessionalComplianceEngine.submitToAEAT(data.compliance.verifactuRecords);

      store.update('compliance', {
        ...data.compliance,
        verifactuRecords: submitted
      });
      
      renderData();
    });
    
    document.getElementById('lock-books-btn')?.addEventListener('click', () => {
      const data = store.getData();
      if (!data.compliance) return;

      const iva = store.getIVA();
      let newCompliance = ProfessionalComplianceEngine.lockOfficialBook(data.compliance, 'issued_invoices', data.year || 2024);
      newCompliance = ProfessionalComplianceEngine.lockOfficialBook(newCompliance, 'received_invoices', data.year || 2024);

      newCompliance.officialBooks = newCompliance.officialBooks.map(b => ({
        ...b,
        totalRecords: b.bookType === 'issued_invoices' ? Math.max(1, iva.issuedInvoices.length) : Math.max(1, iva.receivedInvoices.length)
      }));

      store.update('compliance', newCompliance);
      
      renderData();
    });

    renderData();
  }, 0);

  return container;
}
