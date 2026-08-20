/**
 * @module types-ocr
 * Tipus per a l'ingesta intel·ligent (OCR i Data Entry)
 */

export interface OCRDocument {
  id: string;
  filename: string;
  uploadDate: string;
  status: 'pending' | 'processing' | 'processed' | 'error';
  documentType?: 'invoice_received' | 'invoice_issued' | 'ticket' | 'payroll' | 'other';
  extractedData?: any;
  confidenceScore?: number; // 0.0 to 1.0
  errorMessage?: string;
}

export interface IngestionBatch {
  batchId: string;
  date: string;
  documents: OCRDocument[];
}
