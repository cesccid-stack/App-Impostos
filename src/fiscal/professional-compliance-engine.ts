import type { ComplianceData, VerifactuRecord, OfficialBook } from '../types-compliance.ts';
import type { IVAInvoiceIssued } from '../types-iva.ts';

export class ProfessionalComplianceEngine {
  /**
   * Genera el registre Veri*Factu per a una factura emesa.
   * Simula la generació del Hash Encadenat (blockchain-like) exigit pel reglament
   * i prepara el payload de submission a l'AEAT.
   */
  public static generateVerifactuRecord(invoice: IVAInvoiceIssued, previousHash: string = ''): VerifactuRecord {
    // 1. Dades essencials per al hash
    const dataToHash = `${invoice.clientNif}-${invoice.invoiceNumber}-${invoice.date}-${invoice.totalInvoice.toFixed(2)}-${previousHash}`;
    
    // 2. Simulem un hash SHA-256
    const simulatedHash = `VF-${btoa(dataToHash).substring(0, 32).toUpperCase()}`;
    
    // 3. Simulem el codi QR
    const qrCodeUrl = `https://www2.agenciatributaria.gob.es/wlpl/inwinv/es/aeat/dit/adu/sivf/FacturasEmitidas?NIF=${invoice.clientNif}&Num=${invoice.invoiceNumber}&Data=${invoice.date}&Importe=${invoice.totalInvoice}`;
    
    return {
      id: `vf-${crypto.randomUUID()}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.date,
      hashSignature: simulatedHash,
      qrCodeData: qrCodeUrl,
      submissionStatus: 'pending' // Encara no s'ha enviat a Hisenda
    };
  }

  /**
   * Simula l'enviament per lots a l'AEAT via Serveis Web (SOAP/REST).
   */
  public static submitToAEAT(records: VerifactuRecord[]): VerifactuRecord[] {
    return records.map(record => {
      if (record.submissionStatus === 'pending') {
        // Simulem l'acceptació automàtica per la passarel·la
        return {
          ...record,
          submissionStatus: 'accepted',
          submissionDate: new Date().toISOString(),
          aeatCvs: `CVS-${Math.floor(Math.random() * 1000000000000)}`
        };
      }
      return record;
    });
  }

  /**
   * Tanca un llibre oficial de registre (ex. Llibre de Factures Emeses 2024).
   * Assegura que no es puguin esborrar ni alterar registres anteriors.
   */
  public static lockOfficialBook(complianceData: ComplianceData, bookType: OfficialBook['bookType'], year: number): ComplianceData {
    const bookIndex = complianceData.officialBooks.findIndex(b => b.bookType === bookType && b.year === year);
    
    const updatedBooks = [...complianceData.officialBooks];
    
    if (bookIndex >= 0) {
      updatedBooks[bookIndex] = {
        ...updatedBooks[bookIndex],
        isLocked: true,
        lastUpdated: new Date().toISOString()
      };
    } else {
      updatedBooks.push({
        bookType,
        year,
        totalRecords: 0, // En un sistema real això es calcularia creuant amb types-iva.ts
        lastUpdated: new Date().toISOString(),
        isLocked: true
      });
    }

    return {
      ...complianceData,
      officialBooks: updatedBooks
    };
  }
}
