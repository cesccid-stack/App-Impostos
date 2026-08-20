/**
 * @module utils/iva-books-generator
 * Generador i exportador dels Llibres Registre Oficials d'IVA exigits per l'AEAT
 * (Ordre HAC/773/2019 i Llei 37/1992).
 * Formats CSV normalitzats i desglossaments oficials de liquidació (Models 303 i 390).
 */

import type { 
  IVAInvoiceIssued, 
  IVAInvoiceReceived, 
  IVABienInversion, 
  Model303QuarterResult,
  FiscalQuarter
} from '../types-iva.ts';

/**
 * Exporta el Llibre Registre de Factures Expedides en format CSV homologat AEAT.
 */
export function exportIssuedInvoicesCSV(
  invoices: IVAInvoiceIssued[], 
  download = true,
  filename = 'llibre_registre_factures_expedides_aeat.csv'
): string {
  const headers = [
    'Trimestre',
    'Data_Factura',
    'Num_Factura',
    'Serie',
    'NIF_Client',
    'Nom_Client',
    'Concepte',
    'Base_Imposable_EUR',
    'Tipus_IVA_PCT',
    'Quota_IVA_EUR',
    'Tipus_Recarrec_PCT',
    'Quota_Recarrec_EUR',
    'Tipus_Retencio_IRPF_PCT',
    'Retencio_IRPF_EUR',
    'Total_Factura_EUR',
    'Categoria_Operacio',
    'Document_PDF_Adjunt',
    'Notes'
  ];

  const rows = invoices.map(i => [
    i.quarter,
    i.date,
    `"${i.invoiceNumber}"`,
    `"${i.series || ''}"`,
    `"${i.clientNif}"`,
    `"${i.clientName}"`,
    `"${(i.concept || '').replace(/"/g, '""')}"`,
    (i.taxableBase || 0).toFixed(2),
    (i.vatRate || 0).toFixed(1),
    (i.vatAmount || 0).toFixed(2),
    (i.recargoRate || 0).toFixed(1),
    (i.recargoAmount || 0).toFixed(2),
    (i.withholdingRate || 0).toFixed(1),
    (i.withholdingAmount || 0).toFixed(2),
    (i.totalInvoice || 0).toFixed(2),
    i.category,
    i.hasAttachment ? `"${i.attachmentStandardizedName || 'DOCUMENTAT'}"` : 'SENSE_DOC',
    `"${(i.notes || '').replace(/"/g, '""')}"`
  ]);

  const content = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  if (download) {
    downloadCSV(content, filename);
  }
  return '\uFEFF' + content;
}

/**
 * Exporta el Llibre Registre de Factures Rebudes en format CSV homologat AEAT.
 */
export function exportReceivedInvoicesCSV(
  invoices: IVAInvoiceReceived[], 
  download = true,
  filename = 'llibre_registre_factures_rebudes_aeat.csv'
): string {
  const headers = [
    'Trimestre',
    'Data_Factura',
    'Num_Factura_Proveidor',
    'NIF_Proveidor',
    'Nom_Proveidor',
    'Concepte',
    'Base_Imposable_EUR',
    'Tipus_IVA_PCT',
    'Quota_IVA_Suportat_EUR',
    'Percentatge_Deduccio_PCT',
    'Quota_IVA_Deductible_EUR',
    'Retencio_IRPF_EUR',
    'Total_Factura_EUR',
    'Categoria_Despesa',
    'Es_Be_Inversio',
    'Document_PDF_Adjunt',
    'Notes'
  ];

  const rows = invoices.map(i => [
    i.quarter,
    i.date,
    `"${i.invoiceNumber}"`,
    `"${i.supplierNif}"`,
    `"${i.supplierName}"`,
    `"${(i.concept || '').replace(/"/g, '""')}"`,
    (i.taxableBase || 0).toFixed(2),
    (i.vatRate || 0).toFixed(1),
    (i.vatAmount || 0).toFixed(2),
    (i.deductiblePercentage ?? 100).toFixed(1),
    (i.deductibleVatAmount || 0).toFixed(2),
    (i.withholdingAmount || 0).toFixed(2),
    (i.totalInvoice || 0).toFixed(2),
    i.category,
    i.isInvestmentAsset ? 'SI' : 'NO',
    i.hasAttachment ? `"${i.attachmentStandardizedName || 'DOCUMENTAT'}"` : 'SENSE_DOC',
    `"${(i.notes || '').replace(/"/g, '""')}"`
  ]);

  const content = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  if (download) {
    downloadCSV(content, filename);
  }
  return '\uFEFF' + content;
}

/**
 * Exporta el Llibre Registre de Béns d'Inversió (Art. 107-110 LIVA).
 */
export function exportInvestmentAssetsCSV(
  assets: IVABienInversion[], 
  download = true,
  filename = 'llibre_registre_bens_inversio_aeat.csv'
): string {
  const headers = [
    'ID_Actiu',
    'Descripcio',
    'Tipus_Actiu',
    'Data_Adquisicio',
    'Data_Inici_Utilitzacio',
    'Base_Imposable_EUR',
    'Tipus_IVA_PCT',
    'Total_IVA_Suportat_EUR',
    'Prorrata_Inicial_PCT',
    'IVA_Deduct_Inicial_EUR',
    'Anys_Regularitzacio',
    'Estat',
    'Data_Baixa',
    'Valor_Baixa_EUR'
  ];

  const rows = assets.map(a => [
    `"${a.id}"`,
    `"${(a.description || '').replace(/"/g, '""')}"`,
    a.assetType,
    a.acquisitionDate,
    a.startDate,
    (a.taxableBase || 0).toFixed(2),
    (a.vatRate || 0).toFixed(1),
    (a.totalVatPaid || 0).toFixed(2),
    (a.initialDeductionPercentage || 100).toFixed(1),
    (a.initialDeductedVat || 0).toFixed(2),
    a.regularizationYears,
    a.status,
    a.disposalDate || '',
    (a.disposalValue || 0).toFixed(2)
  ]);

  const content = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  if (download) {
    downloadCSV(content, filename);
  }
  return '\uFEFF' + content;
}

/**
 * Exporta el Resum Oficial de Caselles del Model 303 en format CSV per a la presentació telemàtica.
 */
export function exportModel303SummaryCSV(
  quarterResultOrQuarters: Model303QuarterResult | Record<FiscalQuarter, Model303QuarterResult>,
  year = 2024,
  download = true
): string {
  const isSingle = 'quarter' in quarterResultOrQuarters;
  const quartersList: Model303QuarterResult[] = isSingle 
    ? [quarterResultOrQuarters as Model303QuarterResult]
    : Object.values(quarterResultOrQuarters as Record<FiscalQuarter, Model303QuarterResult>);

  const lines: string[] = [
    `MODEL 303 - RESUM D'AUTOLIQUIDACIONS D'IVA - EXERCICI ${year}`,
    `Data de generació: ${new Date().toISOString().slice(0, 10)}`,
    '',
    'TRIMESTRE;CASELLA;CONCEPTE;BASE_EUR;TIPUS_PCT;QUOTA_EUR'
  ];

  for (const qr of quartersList) {
    lines.push(
      `${qr.quarter};01;Base imposable règim general (21%);${qr.base21.toFixed(2)};21.0;`,
      `${qr.quarter};03;Quota meritada (21%);;;${qr.cuota21.toFixed(2)}`,
      `${qr.quarter};04;Base imposable règim general (10%);${qr.base10.toFixed(2)};10.0;`,
      `${qr.quarter};06;Quota meritada (10%);;;${qr.cuota10.toFixed(2)}`,
      `${qr.quarter};07;Base imposable règim general (4%);${qr.base4.toFixed(2)};4.0;`,
      `${qr.quarter};09;Quota meritada (4%);;;${qr.cuota4.toFixed(2)}`,
      `${qr.quarter};10;Adquisicions intracomunitàries;${qr.intraEuBase.toFixed(2)};;`,
      `${qr.quarter};11;Quota meritada intracomunitària;;;${qr.intraEuCuota.toFixed(2)}`,
      `${qr.quarter};12;Inversió del subjecte passiu (ISP);${qr.ispBase.toFixed(2)};;`,
      `${qr.quarter};13;Quota ISP;;;${qr.ispCuota.toFixed(2)}`,
      `${qr.quarter};27;TOTAL QUOTA DEVENGADA;;;${qr.totalDevengado.toFixed(2)}`,
      `${qr.quarter};28;Deduïble operacions interiors corrents;${qr.deducibleCorrienteBase.toFixed(2)};;`,
      `${qr.quarter};29;Quota deduïble operacions corrents;;;${qr.deducibleCorrienteCuota.toFixed(2)}`,
      `${qr.quarter};30;Deduïble béns d'inversió;${qr.deducibleInversionBase.toFixed(2)};;`,
      `${qr.quarter};31;Quota deduïble béns d'inversió;;;${qr.deducibleInversionCuota.toFixed(2)}`,
      `${qr.quarter};43;Regularització béns d'inversió;;;${qr.regularizacionBienesInversion.toFixed(2)}`,
      `${qr.quarter};44;Regularització per percentatge definitiu prorrata;;;${qr.regularizacionProrrata.toFixed(2)}`,
      `${qr.quarter};45;TOTAL QUOTA DEDUÏBLE;;;${qr.totalDeducible.toFixed(2)}`,
      `${qr.quarter};46;Diferència (Casella 27 - Casella 45);;;${qr.diferencia.toFixed(2)}`,
      `${qr.quarter};110;Quotes a compensar aplicades de períodes anteriors;;;${qr.cuotasCompensarPeriodosAnteriores.toFixed(2)}`,
      `${qr.quarter};71;RESULTAT FINAL DE LA LIQUIDACIÓ;;;${qr.resultadoLiquidacion.toFixed(2)}`,
      `${qr.quarter};TIPUS_RESULTAT;${qr.paymentType.toUpperCase()};;;`
    );
  }

  const content = lines.join('\r\n');
  if (download) {
    downloadCSV(content, `model_303_${year}_resum_liquidacions.csv`);
  }
  return '\uFEFF' + content;
}

function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
