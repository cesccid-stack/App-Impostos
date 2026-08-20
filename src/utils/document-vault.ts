/**
 * @module utils/document-vault
 * Magatzem Digital Segur de Documents i Factures Originals per a Inspecció de l'AEAT.
 * Utilitza IndexedDB per persistir documents PDF i imatges de gran volum al navegador,
 * amb nomenclatura normalitzada oficial segons els criteris de requeriment de l'Agència Tributària.
 */

import type { FiscalQuarter } from '../types-iva.ts';

export interface StoredDocument {
  id: string;                    // Sol ser l'invoiceId
  invoiceId: string;
  originalFileName: string;
  standardizedName: string;      // Nom preestablert oficial AEAT
  mimeType: string;
  size: number;                  // Mida en bytes
  uploadedAt: string;            // ISO Date
  dataUrl: string;               // Base64 Data URL (Blob convertible)
  meta: {
    type: 'issued' | 'received' | 'asset';
    year: number;
    quarter?: FiscalQuarter;
    invoiceNumber: string;
    nif: string;
    entityName: string;
  };
}

const DB_NAME = 'HaciendaDocVault_DB';
const DB_VERSION = 1;
const STORE_NAME = 'invoice_documents';

let dbInstance: IDBDatabase | null = null;

/**
 * Obre i inicialitza la base de dades IndexedDB per als documents.
 */
function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'invoiceId' });
        store.createIndex('year', 'meta.year', { unique: false });
        store.createIndex('type', 'meta.type', { unique: false });
        store.createIndex('quarter', 'meta.quarter', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Neteja cadenes de text per formar noms de fitxer segurs i normalitzats.
 */
export function sanitizeForFilename(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina accents
    .replace(/[^a-zA-Z0-9_-]/g, '_') // Substitueix caràcters especials per _
    .replace(/_+/g, '_')             // Evita múltiples guions baixos
    .substring(0, 35);               // Limita longitud màxima
}

/**
 * Genera la nomenclatura oficial preestablerta per a la Hisenda Tributària (AEAT):
 * Format: [ANY]_[TRIMESTRE]_[TIPUS]_[NUM_FACTURA]_[NIF]_[NOM_CLIENT_PROVEIDOR].pdf
 * Exemple: "2024_1T_EXP_FAC-2024-001_B12345678_Client_Empresa_SL.pdf"
 */
export function generateStandardizedAeatPdfName(meta: {
  type: 'issued' | 'received' | 'asset';
  year: number;
  quarter?: FiscalQuarter;
  invoiceNumber: string;
  nif: string;
  entityName: string;
  originalExtension?: string;
}): string {
  const typeCode = meta.type === 'issued' ? 'EXP' : (meta.type === 'received' ? 'REC' : 'INV');
  const quarterPart = meta.quarter || 'ANUAL';
  const cleanNum = sanitizeForFilename(meta.invoiceNumber || 'SENSE_NUM');
  const cleanNif = sanitizeForFilename(meta.nif || 'SENSE_NIF');
  const cleanName = sanitizeForFilename(meta.entityName || 'ENTITAT');
  const ext = meta.originalExtension || 'pdf';

  return `${meta.year}_${quarterPart}_${typeCode}_${cleanNum}_${cleanNif}_${cleanName}.${ext}`;
}

/**
 * Converteix un fitxer File a Base64 Data URL per a emmagatzematge segur.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Desa un document associat a una factura al Magatzem Digital.
 */
export async function saveInvoiceDocument(
  invoiceId: string,
  file: File,
  meta: {
    type: 'issued' | 'received' | 'asset';
    year: number;
    quarter?: FiscalQuarter;
    invoiceNumber: string;
    nif: string;
    entityName: string;
  }
): Promise<StoredDocument> {
  const db = await getDB();
  const dataUrl = await fileToDataUrl(file);

  const ext = file.name.split('.').pop() || 'pdf';
  const standardizedName = generateStandardizedAeatPdfName({
    ...meta,
    originalExtension: ext,
  });

  const doc: StoredDocument = {
    id: invoiceId,
    invoiceId,
    originalFileName: file.name,
    standardizedName,
    mimeType: file.type || 'application/pdf',
    size: file.size,
    uploadedAt: new Date().toISOString(),
    dataUrl,
    meta,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(doc);

    req.onsuccess = () => resolve(doc);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Recupera un document associat a una factura.
 */
export async function getInvoiceDocument(invoiceId: string): Promise<StoredDocument | null> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(invoiceId);

    req.onsuccess = () => resolve((req.result as StoredDocument) || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Elimina un document del magatzem.
 */
export async function deleteInvoiceDocument(invoiceId: string): Promise<boolean> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(invoiceId);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Obté tots els documents guardats per a un exercici fiscal determinat.
 */
export async function getDocumentsForYear(year: number): Promise<StoredDocument[]> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const all = (req.result as StoredDocument[]) || [];
      resolve(all.filter(d => d.meta.year === year));
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Descarrega directament un fitxer amb el seu nom oficial preestablert.
 */
export function downloadStoredDocument(doc: StoredDocument): void {
  const link = document.createElement('a');
  link.href = doc.dataUrl;
  link.download = doc.standardizedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
