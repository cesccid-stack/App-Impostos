/**
 * @module utils/inspection-package-generator
 * Generador del Dossier Complet d'Inspecció Tributària per a l'AEAT.
 * Confecciona un paquet comprimit ZIP homologat que inclou:
 * 1. Llibres Registre Oficials en CSV segons l'Ordre HAC/773/2019.
 * 2. Índex / Manifest de correlació entre línies comptables i fitxers PDF.
 * 3. Tots els PDFs de factures originals organitzats per trimestres i anomenats amb la nomenclatura oficial AEAT.
 */

import JSZip from 'jszip';
import type { IVAData } from '../types-iva.ts';
import { 
  exportIssuedInvoicesCSV, 
  exportReceivedInvoicesCSV, 
  exportInvestmentAssetsCSV, 
  exportModel303SummaryCSV 
} from './iva-books-generator.ts';
import { getDocumentsForYear, type StoredDocument } from './document-vault.ts';
import { calculateAllQuarters } from '../fiscal/iva-engine.ts';

/**
 * Converteix una cadena Base64 Data URL a Uint8Array per a JSZip.
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Construeix el CSV d'Índex / Manifest de Requeriment que vincula cada factura amb el seu PDF.
 */
function generateInspectionManifestCSV(
  ivaData: IVAData,
  storedDocs: StoredDocument[],
  year: number
): string {
  const docMap = new Map<string, StoredDocument>();
  storedDocs.forEach(d => docMap.set(d.invoiceId, d));

  const headers = [
    'EXERCICI',
    'TRIMESTRE',
    'TIPUS_LLIBRE',
    'NUM_REGISTRE',
    'NUM_FACTURA',
    'DATA_EXPEDICIO',
    'NIF_CONTRAPART',
    'NOM_RAO_SOCIAL',
    'BASE_IMPOSABLE_EUR',
    'TIPUS_IVA_PCT',
    'QUOTA_IVA_EUR',
    'TOTAL_FACTURA_EUR',
    'ESTAT_DOCUMENT_PDF',
    'NOM_FITXER_ADJUNT_AEAT',
    'MIDA_KB',
    'RUTA_DINS_DOSSIER'
  ];

  const rows: string[][] = [];
  let regNum = 1;

  // 1. Factures Expedides
  for (const inv of ivaData.issuedInvoices || []) {
    const doc = docMap.get(inv.id);
    const hasDoc = !!doc;
    const path = hasDoc ? `${inv.quarter}/Expedides/${doc.standardizedName}` : 'NO_ADJUNT';

    rows.push([
      year.toString(),
      inv.quarter,
      'EXPEDIDES',
      (regNum++).toString(),
      `"${(inv.invoiceNumber || '').replace(/"/g, '""')}"`,
      inv.date || '',
      inv.clientNif || '',
      `"${(inv.clientName || '').replace(/"/g, '""')}"`,
      inv.taxableBase.toFixed(2),
      inv.vatRate.toString(),
      inv.vatAmount.toFixed(2),
      inv.totalInvoice.toFixed(2),
      hasDoc ? 'DOCUMENTAT' : 'PENDENT_PDF',
      doc?.standardizedName || '',
      doc ? (doc.size / 1024).toFixed(1) : '0',
      path
    ]);
  }

  // 2. Factures Rebudes
  for (const inv of ivaData.receivedInvoices || []) {
    const doc = docMap.get(inv.id);
    const hasDoc = !!doc;
    const path = hasDoc ? `${inv.quarter}/Rebudes/${doc.standardizedName}` : 'NO_ADJUNT';

    rows.push([
      year.toString(),
      inv.quarter,
      'REBUDES',
      (regNum++).toString(),
      `"${(inv.invoiceNumber || '').replace(/"/g, '""')}"`,
      inv.date || '',
      inv.supplierNif || '',
      `"${(inv.supplierName || '').replace(/"/g, '""')}"`,
      inv.taxableBase.toFixed(2),
      inv.vatRate.toString(),
      inv.vatAmount.toFixed(2),
      inv.totalInvoice.toFixed(2),
      hasDoc ? 'DOCUMENTAT' : 'PENDENT_PDF',
      doc?.standardizedName || '',
      doc ? (doc.size / 1024).toFixed(1) : '0',
      path
    ]);
  }

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  return '\uFEFF' + csvContent; // BOM UTF-8
}

/**
 * Genera i descarrega el paquet complet d'inspecció ZIP.
 */
export async function generateAndDownloadInspectionPackage(
  ivaData: IVAData,
  year: number,
  profileName: string,
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; totalFiles: number; totalSizeMB: number }> {
  if (onProgress) onProgress('Iniciant la preparació del Dossier d\'Inspecció...');

  const zip = new JSZip();
  const rootFolder = zip.folder(`Dossier_Inspeccio_AEAT_${year}_${profileName.replace(/\s+/g, '_')}`)!;

  // 1. Obtenir documents emmagatzemats a IndexedDB
  if (onProgress) onProgress('Recuperant factures i PDFs originals del magatzem segur...');
  const storedDocs = await getDocumentsForYear(year);
  const docMap = new Map<string, StoredDocument>();
  storedDocs.forEach(d => docMap.set(d.invoiceId, d));

  // 2. Generar Llibres Registre Oficials en CSV
  if (onProgress) onProgress('Generant Llibres Registre Oficials (Ordre HAC/773/2019)...');
  const csvFolder = rootFolder.folder('00_Llibres_Oficials_AEAT_CSV')!;
  
  // CSVs oficials
  const { quarters } = calculateAllQuarters(ivaData, year);
  
  // Create CSV contents directly
  const expCSV = generateCSVFromExportFunction(() => exportIssuedInvoicesCSV(ivaData.issuedInvoices, false));
  const recCSV = generateCSVFromExportFunction(() => exportReceivedInvoicesCSV(ivaData.receivedInvoices, false));
  const invCSV = generateCSVFromExportFunction(() => exportInvestmentAssetsCSV(ivaData.investmentAssets, false));
  const m303CSV = generateCSVFromExportFunction(() => exportModel303SummaryCSV(quarters, year, false));

  csvFolder.file(`1_Llibre_Factures_Expedides_${year}.csv`, expCSV);
  csvFolder.file(`2_Llibre_Factures_Rebudes_${year}.csv`, recCSV);
  csvFolder.file(`3_Llibre_Bens_Inversio_${year}.csv`, invCSV);
  csvFolder.file(`4_Resum_Liquidacions_Model303_${year}.csv`, m303CSV);

  // 3. Generar Índex / Manifest de Relació de Documents
  if (onProgress) onProgress('Confeccionant Índex Manifest de correspondència...');
  const manifestCSV = generateInspectionManifestCSV(ivaData, storedDocs, year);
  rootFolder.file(`00_INDEX_MANIFEST_INSPECCIO_${year}.csv`, manifestCSV);

  // 4. Afegir els PDFs organitzats per carpetes de trimestre
  if (onProgress) onProgress('Organitzant PDFs en carpetes trimestrals amb nomenclatura oficial...');
  
  let filesCount = 4; // 4 CSVs inicials

  // Factures Expedides
  for (const inv of ivaData.issuedInvoices || []) {
    const doc = docMap.get(inv.id);
    if (doc && doc.dataUrl) {
      const bytes = dataUrlToUint8Array(doc.dataUrl);
      rootFolder.file(`${inv.quarter}/Expedides/${doc.standardizedName}`, bytes);
      filesCount++;
    }
  }

  // Factures Rebudes
  for (const inv of ivaData.receivedInvoices || []) {
    const doc = docMap.get(inv.id);
    if (doc && doc.dataUrl) {
      const bytes = dataUrlToUint8Array(doc.dataUrl);
      rootFolder.file(`${inv.quarter}/Rebudes/${doc.standardizedName}`, bytes);
      filesCount++;
    }
  }

  // Béns d'Inversió
  for (const asset of ivaData.investmentAssets || []) {
    const doc = docMap.get(asset.id);
    if (doc && doc.dataUrl) {
      const bytes = dataUrlToUint8Array(doc.dataUrl);
      rootFolder.file(`Bens_Inversio/${doc.standardizedName}`, bytes);
      filesCount++;
    }
  }

  // 5. Generar i descarregar el fitxer ZIP
  if (onProgress) onProgress('Comprimint el Dossier d\'Inspecció...');
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Dossier_Inspeccio_AEAT_${year}_${profileName.replace(/\s+/g, '_')}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  if (onProgress) onProgress('Dossier d\'Inspecció generat i descarregat amb èxit!');

  return {
    success: true,
    totalFiles: filesCount,
    totalSizeMB: Math.round((zipBlob.size / (1024 * 1024)) * 10) / 10
  };
}

/**
 * Utilitat auxiliar per capturar el contingut CSV generat pels exportadors.
 */
function generateCSVFromExportFunction(fn: () => string | void): string {
  try {
    const res = fn();
    return typeof res === 'string' ? res : '';
  } catch {
    return '';
  }
}
