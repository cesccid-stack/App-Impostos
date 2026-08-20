/**
 * @module types-compliance
 * Data types for Professional Compliance (Veri*Factu, BOE Books, Certifications)
 */

export interface VerifactuRecord {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  hashSignature: string;      // Cadena de hash per garantir la inalterabilitat
  qrCodeData: string;         // Dades per al QR de Veri*Factu
  submissionStatus: 'pending' | 'submitted' | 'accepted' | 'rejected_by_aeat';
  submissionDate?: string;
  aeatCvs?: string;           // Codi Segur de Verificació AEAT
}

export interface OfficialBook {
  bookType: 'issued_invoices' | 'received_invoices' | 'investment_assets' | 'intra_eu_operations';
  year: number;
  totalRecords: number;
  lastUpdated: string;
  isLocked: boolean; // Si ja està presentat, no es pot modificar
}

export interface ComplianceData {
  verifactuRecords: VerifactuRecord[];
  officialBooks: OfficialBook[];
  isVerifactuEnabled: boolean; // Si el contribuent s'ha acollit al sistema Veri*Factu voluntàriament
  digitalCertificateId?: string; // ID del certificat per a signar els enviaments
}
