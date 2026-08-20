import type { Model347Entity, Model347Yearly } from '../types-quarterly.ts';
import type { IVAInvoiceIssued, IVAInvoiceReceived } from '../types-iva.ts';

export class Model347Engine {
  /**
   * Identifica les operacions amb terceres persones superiors a 3005.06€
   * a partir dels llibres de factures emeses i rebudes.
   */
  public static calculateFromInvoices(
    year: number,
    issuedInvoices: IVAInvoiceIssued[],
    receivedInvoices: IVAInvoiceReceived[]
  ): Model347Yearly {
    const entitiesMap = new Map<string, Model347Entity>();

    // Processar factures emeses (Clients)
    for (const inv of issuedInvoices) {
      if (!inv.date.startsWith(year.toString())) continue;
      
      const nif = inv.clientNif.toUpperCase().trim();
      if (!entitiesMap.has(nif)) {
        entitiesMap.set(nif, {
          nif,
          name: inv.clientName,
          type: 'client',
          provinceCode: '00', // S'hauria de derivar del CP
          q1Amount: 0,
          q2Amount: 0,
          q3Amount: 0,
          q4Amount: 0,
          totalAmount: 0
        });
      }
      
      const entity = entitiesMap.get(nif)!;
      entity.totalAmount += inv.totalInvoice;
      
      if (inv.quarter === '1T') entity.q1Amount += inv.totalInvoice;
      else if (inv.quarter === '2T') entity.q2Amount += inv.totalInvoice;
      else if (inv.quarter === '3T') entity.q3Amount += inv.totalInvoice;
      else if (inv.quarter === '4T') entity.q4Amount += inv.totalInvoice;
    }

    // Processar factures rebudes (Proveïdors)
    for (const inv of receivedInvoices) {
      if (!inv.date.startsWith(year.toString())) continue;
      
      const nif = inv.supplierNif.toUpperCase().trim();
      if (!entitiesMap.has(nif)) {
        entitiesMap.set(nif, {
          nif,
          name: inv.supplierName,
          type: 'supplier',
          provinceCode: '00',
          q1Amount: 0,
          q2Amount: 0,
          q3Amount: 0,
          q4Amount: 0,
          totalAmount: 0
        });
      }
      
      const entity = entitiesMap.get(nif)!;
      entity.totalAmount += inv.totalInvoice;
      
      if (inv.quarter === '1T') entity.q1Amount += inv.totalInvoice;
      else if (inv.quarter === '2T') entity.q2Amount += inv.totalInvoice;
      else if (inv.quarter === '3T') entity.q3Amount += inv.totalInvoice;
      else if (inv.quarter === '4T') entity.q4Amount += inv.totalInvoice;
    }

    // Filtrar només els que superen 3.005,06 €
    const threshold = 3005.06;
    const finalEntities = Array.from(entitiesMap.values()).filter(e => e.totalAmount > threshold);
    
    let totalClientsVolume = 0;
    let totalSuppliersVolume = 0;
    
    for (const e of finalEntities) {
      if (e.type === 'client') totalClientsVolume += e.totalAmount;
      if (e.type === 'supplier') totalSuppliersVolume += e.totalAmount;
    }

    return {
      year,
      entities: finalEntities,
      totalClientsVolume,
      totalSuppliersVolume
    };
  }
}
