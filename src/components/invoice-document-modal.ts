/**
 * @module components/invoice-document-modal
 * Modal interactiu per visualitzar, adjuntar, descarregar i gestionar el PDF original
 * d'una factura amb la nomenclatura oficial normalitzada per a la inspecció de l'AEAT.
 */

import { 
  getInvoiceDocument, 
  saveInvoiceDocument, 
  deleteInvoiceDocument, 
  downloadStoredDocument 
} from '../utils/document-vault.ts';
import { store } from '../store.ts';
import { showToast } from './toast.ts';
import type { IVAInvoiceIssued, IVAInvoiceReceived } from '../types-iva.ts';

export async function openInvoiceDocumentModal(
  invoice: IVAInvoiceIssued | IVAInvoiceReceived,
  type: 'issued' | 'received',
  year: number,
  onUpdated?: () => void
): Promise<void> {
  const existing = document.getElementById('invoice-doc-modal');
  if (existing) existing.remove();

  let currentDoc = await getInvoiceDocument(invoice.id);

  const modal = document.createElement('div');
  modal.id = 'invoice-doc-modal';
  modal.className = 'modal-backdrop';
  modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:10000; padding:var(--space-md); backdrop-filter:blur(4px);';

  function render() {
    const isIssued = type === 'issued';
    const contrapartyName = isIssued ? (invoice as IVAInvoiceIssued).clientName : (invoice as IVAInvoiceReceived).supplierName;
    const contrapartyNif = isIssued ? (invoice as IVAInvoiceIssued).clientNif : (invoice as IVAInvoiceReceived).supplierNif;

    modal.innerHTML = `
      <div class="modal-content card" style="max-width:800px; width:100%; max-height:92vh; display:flex; flex-direction:column; background:var(--modal-bg); border:1px solid var(--border-default); border-radius:var(--radius-lg); padding:var(--space-lg); box-shadow:var(--shadow-lg);">
        
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:var(--space-md); border-bottom:1px solid var(--border-default); padding-bottom:var(--space-sm);">
          <div>
            <div style="display:flex; align-items:center; gap:var(--space-xs);">
              <h2 style="margin:0; font-size:var(--text-md);">📎 Gestió de Document PDF Oficial — Factura ${invoice.invoiceNumber}</h2>
              <span class="badge ${currentDoc ? 'badge--success' : 'badge--warning'}">
                ${currentDoc ? 'Documentat' : 'Sense PDF'}
              </span>
            </div>
            <p class="card__subtitle" style="margin:2px 0 0 0; font-size:0.75rem;">
              ${isIssued ? 'Client' : 'Proveïdor'}: <strong>${contrapartyName} (${contrapartyNif})</strong> | Data: ${invoice.date} | Import: <strong>${invoice.totalInvoice.toFixed(2)} €</strong>
            </p>
          </div>
          <button class="btn btn--ghost btn--sm btn--icon" id="btn-close-doc-modal" style="font-size:1.2rem;">✕</button>
        </div>

        <!-- Cos del Modal: Visor o Zona de Càrrega -->
        <div style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:var(--space-md); min-height:360px;">
          ${currentDoc ? `
            <!-- Informació del fitxer normalitzat AEAT -->
            <div style="background:var(--bg-surface-elevated); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
              <div>
                <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Nomenclatura Oficial AEAT (Inspecció):</div>
                <div style="font-size:0.85rem; font-weight:bold; font-family:monospace; color:var(--color-primary); word-break:break-all;">
                  📄 ${currentDoc.standardizedName}
                </div>
                <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:2px;">
                  Original: ${currentDoc.originalFileName} (${(currentDoc.size / 1024).toFixed(1)} KB) | Pajat: ${new Date(currentDoc.uploadedAt).toLocaleDateString()}
                </div>
              </div>
              <div style="display:flex; gap:var(--space-xs);">
                <button class="btn btn--secondary btn--sm" id="btn-download-doc" style="font-size:0.75rem; padding:4px 10px;">
                  ⬇️ Descarregar
                </button>
                <button class="btn btn--danger btn--sm" id="btn-delete-doc" style="font-size:0.75rem; padding:4px 10px;">
                  🗑️ Eliminar
                </button>
              </div>
            </div>

            <!-- Visor Integrat -->
            <div style="flex:1; min-height:320px; border:1px solid var(--border-default); border-radius:var(--radius-md); overflow:hidden; background:#222; display:flex; justify-content:center; align-items:center;">
              ${currentDoc.mimeType.includes('pdf') ? `
                <iframe src="${currentDoc.dataUrl}" style="width:100%; height:100%; min-height:340px; border:none;"></iframe>
              ` : `
                <img src="${currentDoc.dataUrl}" alt="Factura" style="max-width:100%; max-height:340px; object-fit:contain;" />
              `}
            </div>
          ` : `
            <!-- Dropzone per pujar el PDF -->
            <div id="dropzone-doc" style="border:2px dashed var(--color-primary); border-radius:var(--radius-lg); padding:var(--space-xl); text-align:center; background:var(--bg-surface-elevated); cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:var(--space-sm); min-height:280px;">
              <div style="font-size:3rem;">📄</div>
              <h3 style="margin:0; font-size:var(--text-base);">Arrossega aquí la Factura en PDF o Imatge</h3>
              <p style="margin:0; font-size:var(--text-xs); color:var(--text-secondary); max-width:420px;">
                L'aplicació reanomenarà automàticament el fitxer amb el format oficial de l'AEAT per tenir-lo preparat en cas d'inspecció fiscal.
              </p>
              <input type="file" id="file-input-doc" accept=".pdf,image/jpeg,image/png" style="display:none;" />
              <button class="btn btn--primary btn--sm" id="btn-select-file" style="margin-top:var(--space-xs);">
                📂 Seleccionar Fitxer PDF
              </button>
            </div>
          `}
        </div>

        <!-- Footer -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-default); padding-top:var(--space-sm); margin-top:var(--space-md);">
          <div style="font-size:0.7rem; color:var(--text-muted);">
            ⚖️ Compliment Art. 97 LIVA i Art. 106 de la Llei General Tributària (LGT).
          </div>
          <button class="btn btn--secondary btn--sm" id="btn-close-bottom">
            Tancar
          </button>
        </div>
      </div>
    `;

    // Listeners
    modal.querySelector('#btn-close-doc-modal')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#btn-close-bottom')?.addEventListener('click', () => modal.remove());

    // Download
    modal.querySelector('#btn-download-doc')?.addEventListener('click', () => {
      if (currentDoc) {
        downloadStoredDocument(currentDoc);
        showToast('Document descarregat amb nom oficial AEAT', 'success');
      }
    });

    // Delete
    modal.querySelector('#btn-delete-doc')?.addEventListener('click', async () => {
      if (confirm('Segur que vols eliminar aquest PDF adjunt?')) {
        await deleteInvoiceDocument(invoice.id);
        
        // Update invoice metadata in store
        invoice.hasAttachment = false;
        invoice.attachmentFileName = undefined;
        invoice.attachmentStandardizedName = undefined;
        invoice.attachmentMimeType = undefined;
        invoice.attachmentSize = undefined;
        invoice.attachmentUploadedAt = undefined;

        if (type === 'issued') {
          const iva = store.getIVA();
          store.updateIVA({ issuedInvoices: iva.issuedInvoices });
        } else {
          const iva = store.getIVA();
          store.updateIVA({ receivedInvoices: iva.receivedInvoices });
        }

        currentDoc = null;
        showToast('PDF eliminat correctament', 'info');
        render();
        if (onUpdated) onUpdated();
      }
    });

    // Upload via dropzone or button
    const dropzone = modal.querySelector('#dropzone-doc');
    const fileInput = modal.querySelector<HTMLInputElement>('#file-input-doc');
    const selectBtn = modal.querySelector('#btn-select-file');

    selectBtn?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('click', (e) => {
      if (e.target !== selectBtn) fileInput?.click();
    });

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      (dropzone as HTMLElement).style.borderColor = 'var(--color-success)';
      (dropzone as HTMLElement).style.background = 'var(--bg-base)';
    });

    dropzone?.addEventListener('dragleave', () => {
      (dropzone as HTMLElement).style.borderColor = 'var(--color-primary)';
      (dropzone as HTMLElement).style.background = 'var(--bg-surface-elevated)';
    });

    dropzone?.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = (e as DragEvent).dataTransfer?.files;
      if (files && files.length > 0) {
        await handleFileUpload(files[0]);
      }
    });

    fileInput?.addEventListener('change', async () => {
      if (fileInput.files && fileInput.files.length > 0) {
        await handleFileUpload(fileInput.files[0]);
      }
    });
  }

  async function handleFileUpload(file: File) {
    try {
      const isIssued = type === 'issued';
      const contrapartyName = isIssued ? (invoice as IVAInvoiceIssued).clientName : (invoice as IVAInvoiceReceived).supplierName;
      const contrapartyNif = isIssued ? (invoice as IVAInvoiceIssued).clientNif : (invoice as IVAInvoiceReceived).supplierNif;

      const doc = await saveInvoiceDocument(invoice.id, file, {
        type,
        year,
        quarter: invoice.quarter,
        invoiceNumber: invoice.invoiceNumber,
        nif: contrapartyNif,
        entityName: contrapartyName,
      });

      // Update invoice metadata in store
      invoice.hasAttachment = true;
      invoice.attachmentFileName = doc.originalFileName;
      invoice.attachmentStandardizedName = doc.standardizedName;
      invoice.attachmentMimeType = doc.mimeType;
      invoice.attachmentSize = doc.size;
      invoice.attachmentUploadedAt = doc.uploadedAt;

      if (type === 'issued') {
        const iva = store.getIVA();
        store.updateIVA({ issuedInvoices: iva.issuedInvoices });
      } else {
        const iva = store.getIVA();
        store.updateIVA({ receivedInvoices: iva.receivedInvoices });
      }

      currentDoc = doc;
      showToast(`Factura guardada com a ${doc.standardizedName}`, 'success');
      render();
      if (onUpdated) onUpdated();
    } catch (err) {
      showToast('Error en desar el document: ' + String(err), 'error');
    }
  }

  document.body.appendChild(modal);
  render();
}
