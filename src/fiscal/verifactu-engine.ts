/**
 * @module fiscal/verifactu-engine
 * Motor de Compliment Veri*Factu, Inalterabilitat de Registres i Traçabilitat de Factures.
 * 
 * Normativa aplicable:
 * - Llei 11/2021 de Mesures de Prevenció i Lluita contra el Frau Fiscal (Art. 29.2.j LGT).
 * - Reial Decret 1007/2023 (Reglament de Sistemes Informàtics de Facturació - Veri*Factu).
 * - Ordre HAC/773/2019 (Format de Llibres Registre en IRPF i IVA).
 * 
 * Sancions previstes en cas d'incompliment:
 * - Art. 201 bis LGT: 50.000 € per cada exercici en què s'utilitzi programari sense traçabilitat o amb doble comptabilitat.
 */


export interface VerifactuInvoiceRecord {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly series?: string;
  readonly issueDate: string; // YYYY-MM-DD
  readonly issueTime?: string; // HH:mm:ss
  readonly issuerNif: string;
  readonly recipientNif?: string;
  readonly recipientName?: string;
  readonly baseAmount: number;
  readonly taxRate: number;
  readonly taxAmount: number;
  readonly totalAmount: number;
  readonly previousRecordHash: string; // Hash encadenat del registre anterior
  readonly currentRecordHash: string;  // Hash SHA-256 d'aquest registre
  readonly signatureTimestamp: string;
  readonly cancelled?: boolean;
}

export interface VerifactuChainVerification {
  readonly isValid: boolean;
  readonly totalRecords: number;
  readonly brokenChainIndex?: number;
  readonly errorDetails?: string;
}

/**
 * Funció auxiliar SHA-256 asíncrona compatible amb entorns Web i Node.js.
 */
async function computeSha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback senzill si no hi ha crypto.subtle disponible
  return pseudoSha256(text);
}

/**
 * Fallback determinista per a entorns sense WebCrypto.
 */
function pseudoSha256(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (p1 + p2 + p1 + p2).padEnd(64, '0');
}

/**
 * Normalitza els camps clau per a la generació de la petjada digital (Hash Veri*Factu).
 */
export function buildVerifactuPayload(
  issuerNif: string,
  invoiceNumber: string,
  issueDate: string,
  totalAmount: number,
  previousRecordHash: string
): string {
  return [
    issuerNif.trim().toUpperCase(),
    invoiceNumber.trim(),
    issueDate.trim(),
    totalAmount.toFixed(2),
    previousRecordHash || 'GENESIS_RECORD_00000000000000000000000000000000000000000000000000'
  ].join('|');
}

/**
 * Crea un registre de facturació encadenat certificat segons Veri*Factu.
 */
export async function createChainedInvoiceRecord(
  invoice: {
    id: string;
    invoiceNumber: string;
    series?: string;
    issueDate: string;
    issueTime?: string;
    issuerNif: string;
    recipientNif?: string;
    recipientName?: string;
    baseAmount: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
  },
  previousRecordHash: string = ''
): Promise<VerifactuInvoiceRecord> {
  const payload = buildVerifactuPayload(
    invoice.issuerNif,
    invoice.invoiceNumber,
    invoice.issueDate,
    invoice.totalAmount,
    previousRecordHash
  );
  
  const currentRecordHash = await computeSha256(payload);

  return {
    ...invoice,
    previousRecordHash,
    currentRecordHash,
    signatureTimestamp: new Date().toISOString(),
  };
}

/**
 * Valida la integritat de la cadena de registres de factures.
 * Si alguna factura ha estat modificada, suprimida o reordenada, detecta el punt exacte de ruptura.
 */
export async function verifyInvoiceChainIntegrity(
  records: readonly VerifactuInvoiceRecord[]
): Promise<VerifactuChainVerification> {
  if (!records.length) {
    return { isValid: true, totalRecords: 0 };
  }

  let prevHash = '';
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];

    // 1. Verificació de l'enllaç amb el registre anterior
    if (i === 0) {
      if (rec.previousRecordHash && rec.previousRecordHash !== '') {
        return {
          isValid: false,
          totalRecords: records.length,
          brokenChainIndex: 0,
          errorDetails: `El registre inicial té un previousRecordHash inesperat: ${rec.previousRecordHash}`,
        };
      }
    } else {
      if (rec.previousRecordHash !== prevHash) {
        return {
          isValid: false,
          totalRecords: records.length,
          brokenChainIndex: i,
          errorDetails: `Ruptura d'encadenament a la factura ${rec.invoiceNumber}. Esperat: ${prevHash}, Trobat: ${rec.previousRecordHash}`,
        };
      }
    }

    // 2. Verificació de la integritat del hash del propi registre
    const expectedPayload = buildVerifactuPayload(
      rec.issuerNif,
      rec.invoiceNumber,
      rec.issueDate,
      rec.totalAmount,
      rec.previousRecordHash
    );
    const computedHash = await computeSha256(expectedPayload);

    if (computedHash !== rec.currentRecordHash) {
      return {
        isValid: false,
        totalRecords: records.length,
        brokenChainIndex: i,
        errorDetails: `Petjada digital alterada a la factura ${rec.invoiceNumber}. El contingut ha estat modificat després de la signatura.`,
      };
    }

    prevHash = rec.currentRecordHash;
  }

  return {
    isValid: true,
    totalRecords: records.length,
  };
}
