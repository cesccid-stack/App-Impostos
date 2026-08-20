/**
 * @module utils/activity-books-generator
 * Generador dels 4 Llibres Registre Oficials d'Activitats Econòmiques de l'AEAT
 * (Ordre HAC/773/2019 per a autònoms en estimació directa).
 */

export interface SalesBookEntry {
  date: string;
  invoiceNumber: string;
  clientName: string;
  clientNif: string;
  concept: string;
  taxableBase: number;
  vatRate: number;
  vatAmount: number;
  withholdingRate: number;
  withholdingAmount: number;
  totalInvoice: number;
}

export interface ExpensesBookEntry {
  date: string;
  invoiceNumber: string;
  supplierName: string;
  supplierNif: string;
  concept: string;
  deductibleExpenseIRPF: number;
  vatDeductible: number;
  totalExpense: number;
}

/**
 * Exporta el Llibre Registre de Vendes i Ingressos en format CSV homologat AEAT.
 */
export function exportSalesBookCSV(entries: SalesBookEntry[]): void {
  const headers = ['Data', 'Num_Factura', 'Nom_Client', 'NIF_Client', 'Concepte', 'Base_Imposable_EUR', 'Tipus_IVA_PCT', 'Quota_IVA_EUR', 'Tipus_Retencio_PCT', 'Retencio_IRPF_EUR', 'Total_Factura_EUR'];
  const rows = entries.map(e => [
    e.date,
    `"${e.invoiceNumber}"`,
    `"${e.clientName}"`,
    `"${e.clientNif}"`,
    `"${e.concept}"`,
    e.taxableBase.toFixed(2),
    e.vatRate.toFixed(1),
    e.vatAmount.toFixed(2),
    e.withholdingRate.toFixed(1),
    e.withholdingAmount.toFixed(2),
    e.totalInvoice.toFixed(2),
  ]);

  downloadCSV([headers.join(';'), ...rows.map(r => r.join(';'))].join('\n'), 'llibre_registre_vendes_ingressos_aeat.csv');
}

/**
 * Exporta el Llibre Registre de Compres i Despeses en format CSV homologat AEAT.
 */
export function exportExpensesBookCSV(entries: ExpensesBookEntry[]): void {
  const headers = ['Data', 'Num_Factura', 'Nom_Proveidor', 'NIF_Proveidor', 'Concepte', 'Despesa_Deductible_IRPF_EUR', 'IVA_Deductible_EUR', 'Total_EUR'];
  const rows = entries.map(e => [
    e.date,
    `"${e.invoiceNumber}"`,
    `"${e.supplierName}"`,
    `"${e.supplierNif}"`,
    `"${e.concept}"`,
    e.deductibleExpenseIRPF.toFixed(2),
    e.vatDeductible.toFixed(2),
    e.totalExpense.toFixed(2),
  ]);

  downloadCSV([headers.join(';'), ...rows.map(r => r.join(';'))].join('\n'), 'llibre_registre_compres_despeses_aeat.csv');
}

function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
