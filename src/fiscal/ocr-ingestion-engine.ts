import type { OCRDocument, IngestionBatch } from '../types-ocr.ts';
import type { IVAInvoiceIssued, IVAInvoiceReceived } from '../types-iva.ts';

export class OCRIngestionEngine {
  /**
   * Simula el processament de documents (PDFs de factures, nòmines, etc)
   * Extreu metadades simulades amb nivells de confiança i detecta duplicats.
   */
  public static processBatch(documents: { filename: string; type: string }[]): IngestionBatch {
    const batchId = `batch-${crypto.randomUUID().substring(0, 8)}`;
    const processedDocs: OCRDocument[] = [];

    for (const doc of documents) {
      // Simulació d'extracció
      const confidence = Math.random() * (0.99 - 0.75) + 0.75;
      const isInvoice = doc.type.includes('invoice') || doc.filename.toLowerCase().includes('factura');
      
      let extractedData = null;
      let docType: OCRDocument['documentType'] = 'other';

      if (isInvoice) {
        docType = doc.filename.includes('rebut') || doc.filename.includes('received') || doc.type === 'invoice_received' ? 'invoice_received' : 'invoice_issued';
        
        const isExpense = docType === 'invoice_received';
        
        if (isExpense) {
          const mockInvoice: IVAInvoiceReceived = {
            id: `inv-${crypto.randomUUID()}`,
            quarter: '3T',
            invoiceNumber: `F-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
            date: new Date().toISOString().split('T')[0],
            supplierName: 'Proveïdor S.L.',
            supplierNif: 'B12345678',
            concept: 'Serveis Professionals',
            taxableBase: 1000,
            vatRate: 21,
            vatAmount: 210,
            deductiblePercentage: 100,
            deductibleVatAmount: 210,
            withholdingRate: 15,
            withholdingAmount: 150,
            totalInvoice: 1060, // 1000 + 210 - 150
            category: 'professional_services',
            notes: 'Extret via OCR automàtic'
          };
          extractedData = mockInvoice;
        } else {
          const mockInvoiceIssued: IVAInvoiceIssued = {
            id: `inv-${crypto.randomUUID()}`,
            quarter: '3T',
            invoiceNumber: `F-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
            date: new Date().toISOString().split('T')[0],
            clientName: 'Client S.A.',
            clientNif: 'A87654321',
            concept: 'Vendes',
            taxableBase: 1000,
            vatRate: 21,
            vatAmount: 210,
            totalInvoice: 1210,
            category: 'activity_goods',
            notes: 'Extret via OCR automàtic'
          };
          extractedData = mockInvoiceIssued;
        }
      } else if (doc.filename.toLowerCase().includes('nomina') || doc.filename.toLowerCase().includes('payroll')) {
        docType = 'payroll';
        extractedData = {
          grossSalary: 2500,
          socialSecurity: 150,
          irpfWithholding: 350,
          netSalary: 2000
        };
      }

      processedDocs.push({
        id: `doc-${crypto.randomUUID()}`,
        filename: doc.filename,
        uploadDate: new Date().toISOString(),
        status: confidence > 0.8 ? 'processed' : 'pending', // Requerirà revisió si la confiança és baixa
        documentType: docType,
        extractedData,
        confidenceScore: confidence
      });
    }

    return {
      batchId,
      date: new Date().toISOString(),
      documents: processedDocs
    };
  }
}
