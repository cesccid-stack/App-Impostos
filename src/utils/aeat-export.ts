/**
 * @module utils/aeat-export
 * Utilitats per generar fitxers i guies de càrrega directa per a l'AEAT (Renta Web).
 * Cobertura oficial de l'Annex F2 (Accions i Fons), l'Annex A (Capital Immobiliari)
 * i el Llibre Registre de Béns d'Inversió i Amortitzacions segons Taula Simplificada AEAT.
 */

import type { AssetSummary, FIFOMatch } from '../types-portfolio.ts';
import type { PropertyFiscalResult, RentalProperty } from '../types-properties.ts';
import { getAEATAssetGroup, calculateItemAnnualAmortization } from '../fiscal/amortization-tables.ts';

/**
 * Genera el fitxer de text de l'Annex F2 per a la importació o còpia directa a Renta Web (Caselles 0326 a 0338).
 */
export function generateAEATAnnexF2(
  summaries: AssetSummary[],
  matches: FIFOMatch[],
  mode: 'grouped_by_isin' | 'detailed_trades' = 'grouped_by_isin'
): string {
  let doc = `================================================================================
AGÈNCIA TRIBUTÀRIA (AEAT) - RENTA WEB
ANNEX F2: GUANYS I PÈRDUES PATRIMONIALS D'ACCIONS I VALORS NEGOCIATS
================================================================================
Instruccions de càrrega:
1. Accedeix al teu esborrany a Renta Web (https://sede.agenciatributaria.gob.es).
2. Ves a l'apartat "Guanys i pèrdues patrimonials derivats de transmissions d'accions o participacions negociades en mercats oficials" (Pàgina de la Casella 0326).
3. Introdueix cadascun dels blocs següents. Si tens més de 50 títols, utilitza l'agrupació per ISIN.\n\n`;

  if (mode === 'grouped_by_isin') {
    doc += `--- MODE: AGRUPAT PER VALOR HOMOGENI / ISIN (Recomanat per a Renta Web) ---\n\n`;
    
    let totalTransmissio = 0;
    let totalAdquisicio = 0;
    let totalGuanys = 0;
    let totalSuspeses = 0;

    summaries.forEach((s, idx) => {
      if (s.totalSold === 0) return; // Cap venda

      const gain = s.realizedGain;
      totalTransmissio += s.totalSold;
      totalAdquisicio += (s.totalSold - s.realizedGain);
      totalGuanys += s.netTaxableGain;
      totalSuspeses += s.suspendedLosses;

      doc += `[Bloc #${idx + 1}] ${s.name} (${s.symbol}) - ISIN: ${s.isin || 'N/D'}\n`;
      doc += `  • [Casella 0327] NIF emissor / ISIN: ${s.isin || s.symbol}\n`;
      doc += `  • [Casella 0328] Valor de transmissió: ${s.totalSold.toFixed(2)} €\n`;
      doc += `  • [Casella 0330] Valor d'adquisició: ${(s.totalSold - s.realizedGain).toFixed(2)} €\n`;
      doc += `  • [Casella 0332] Resultat brut: ${gain.toFixed(2)} €\n`;

      if (s.suspendedLosses > 0) {
        doc += `  • [Casella 0335/0336] Pèrdua NO computable (Regla 2 mesos): ${s.suspendedLosses.toFixed(2)} €\n`;
        doc += `  • [Casella 0338] Guany/Pèrdua computable a l'exercici: ${s.netTaxableGain.toFixed(2)} €\n`;
        doc += `    ⚠️ ATENCIÓ: Has recomprat títols del mateix ISIN. Marca la casella de diferiment de pèrdua a l'exercici següent.\n`;
      } else {
        doc += `  • [Casella 0338] Guany/Pèrdua computable: ${gain.toFixed(2)} €\n`;
      }
      doc += `--------------------------------------------------------------------------------\n`;
    });

    doc += `\nTOTALS ANNEX F2 (ESTALVI):\n`;
    doc += `• Total Transmissions: ${totalTransmissio.toFixed(2)} €\n`;
    doc += `• Total Adquisicions: ${totalAdquisicio.toFixed(2)} €\n`;
    doc += `• Pèrdues suspeses a diferir: ${totalSuspeses.toFixed(2)} €\n`;
    doc += `• Rendiment net computable a la Base de l'Estalvi: ${totalGuanys.toFixed(2)} €\n`;

  } else {
    doc += `--- MODE: DETALLAT OPERACIÓ PER OPERACIÓ ---\n\n`;
    matches.forEach((m, idx) => {
      doc += `[Venda #${idx + 1}] Data: ${m.sellTrade.date.split('T')[0]} | ${m.sellTrade.quantity} ${m.sellTrade.symbol} (ISIN: ${m.sellTrade.isin || 'N/D'})\n`;
      doc += `  • [Casella 0328] Valor transmissió: ${m.totalTransferEUR.toFixed(2)} €\n`;
      doc += `  • [Casella 0330] Valor adquisició: ${m.totalAcquisitionEUR.toFixed(2)} €\n`;
      doc += `  • [Casella 0332] Guany/Pèrdua: ${m.totalGain.toFixed(2)} €\n`;
      if (m.suspendedLossEUR > 0) {
        doc += `  • [Casella 0335] Pèrdua suspesa: ${m.suspendedLossEUR.toFixed(2)} € (Recomprats ${m.repurchasedQuantity} títols)\n`;
        doc += `  • [Casella 0338] Computable: ${m.computedGainLossEUR.toFixed(2)} €\n`;
      }
      doc += `--------------------------------------------------------------------------------\n`;
    });
  }

  return doc;
}

/**
 * Genera el fitxer de text de l'Annex A (Rendiments del Capital Immobiliari, Caselles 0060 a 0105).
 */
export function generateAEATAnnexA(results: PropertyFiscalResult[], fiscalYear: number = 2024): string {
  let doc = `================================================================================
AGÈNCIA TRIBUTÀRIA (AEAT) - RENTA WEB (EXERCICI ${fiscalYear})
ANNEX A: RENDIMENTS DEL CAPITAL IMMOBILIARI (LLOGUERS I AMORTITZACIONS)
================================================================================\n\n`;

  if (results.length === 0) {
    doc += `Cap immoble registrat.\n`;
    return doc;
  }

  results.forEach((r, idx) => {
    const p = r.property;
    doc += `[Immoble #${idx + 1}] ${p.name || p.address} (Ref. Cadastral: ${p.cadastralReference || 'Pendent'})\n`;
    doc += `• [Casella 0061] Referència Cadastral: ${p.cadastralReference || '—'}\n`;
    doc += `• [Casella 0063] Titularitat: ${p.ownershipPercentage} %\n`;
    doc += `• [Casella 0064] Ús / Destinació: ${p.usageType === 'habitual' ? 'Arrendament habitatge habitual' : 'Altres arrendaments'}\n`;
    if (p.tenantNIFs && p.tenantNIFs.length > 0) {
      doc += `• [Casella 0065] NIF/NIE Arrendataris: ${p.tenantNIFs.join(', ')}\n`;
    }

    doc += `\n  --- INGRESSOS ÍNTEGRES ---\n`;
    doc += `  • [Casella 0066] Ingressos íntegres computats: ${r.grossIncome.toFixed(2)} €\n`;

    doc += `\n  --- DESPESES DEDUÏBLES ---\n`;
    doc += `  • [Casella 0069] Interessos de finançament: ${r.mortgageInterests.toFixed(2)} €\n`;
    doc += `  • [Casella 0070] Despeses de reparació i conservació: ${r.repairExpenses.toFixed(2)} €\n`;
    doc += `  • [Casella 0071] Total despeses limitades aplicades: ${r.limitedExpensesDeducted.toFixed(2)} €\n`;
    if (r.pendingRepairsForFutureYears > 0) {
      doc += `  • [Casella 0102/0103] Despeses pendents de compensar per als propers 4 anys: ${r.pendingRepairsForFutureYears.toFixed(2)} €\n`;
    }

    doc += `  • [Casella 0073] Tributs i recàrrecs no estatals (IBI, brosses, taxes municipals): ${r.taxes.toFixed(2)} €\n`;
    doc += `      - IBI (Impost sobre Béns Immobles): ${r.ibiDeducted.toFixed(2)} €\n`;
    doc += `      - Taxa d'escombraries i brosses: ${r.wasteTaxDeducted.toFixed(2)} €\n`;
    if (r.otherTaxesDeducted > 0) {
      doc += `      - Altres taxes municipals (gual, clavegueram): ${r.otherTaxesDeducted.toFixed(2)} €\n`;
    }
    doc += `  • [Casella 0074] Despeses de comunitat de propietaris: ${r.communityFees.toFixed(2)} €\n`;
    doc += `  • [Casella 0075] Assegurances (llar, responsabilitat civil, impagament): ${r.insurance.toFixed(2)} €\n`;
    doc += `  • [Casella 0076] Administració i gestoria: ${r.managementFees.toFixed(2)} €\n`;
    doc += `  • [Casella 0077] Saldos de dubtós cobrament: ${r.badDebts.toFixed(2)} €\n`;

    doc += `\n  --- AMORTITZACIONS (Caselles 0079 a 0083) - TAULA SIMPLIFICADA AEAT ---\n`;
    doc += `  • [Casella 0079] Amortització de l'immoble (3% construcció): ${r.buildingAmortization.toFixed(2)} €\n`;
    doc += `  • [Casella 0080] Amortització d'obres de millora (3% anual): ${r.improvementsAmortization.toFixed(2)} €\n`;
    doc += `  • [Casella 0081] Amortització de mobles, estris, equips i eines: ${r.furnitureAmortization.toFixed(2)} €\n`;
    
    if (r.inventoryBreakdown) {
      doc += `      - Grup 6 Útils i eines (30% màx): ${r.inventoryBreakdown.group6Tools30.toFixed(2)} €\n`;
      doc += `      - Grup 5 Equips TI / Domòtica / TV (26% màx): ${r.inventoryBreakdown.group5Computer26.toFixed(2)} €\n`;
      doc += `      - Grup 4 Elements de transport (16% màx): ${r.inventoryBreakdown.group4Transport16.toFixed(2)} €\n`;
      doc += `      - Grup 3 Maquinària / Climatització (12% màx): ${r.inventoryBreakdown.group3Machinery12.toFixed(2)} €\n`;
      doc += `      - Grup 2 Mobiliari i electrodomèstics (10% màx): ${r.inventoryBreakdown.group2Furniture10.toFixed(2)} €\n`;
      doc += `      - Grup 1 Obres de millora (3% màx): ${r.inventoryBreakdown.group1Improvements3.toFixed(2)} €\n`;
    }
    
    doc += `  • Total amortitzacions deduïdes: ${r.totalAmortization.toFixed(2)} €\n`;

    doc += `\n  --- RENDIMENT I REDUCCIONS ---\n`;
    doc += `  • [Casella 0090] Rendiment net previ: ${r.netIncome.toFixed(2)} €\n`;
    if (r.reductionAmount > 0) {
      doc += `  • [Casella 0100] Reducció per arrendament d'habitatge (${r.reductionRate}% - Llei 12/2023): -${r.reductionAmount.toFixed(2)} €\n`;
      doc += `  • [Casella 0105] Rendiment net reduït (Base Imposable General): ${r.netReducedIncome.toFixed(2)} €\n`;
    } else {
      doc += `  • [Casella 0105] Rendiment net (Base Imposable General): ${r.netReducedIncome.toFixed(2)} €\n`;
    }
    doc += `================================================================================\n\n`;
  });

  return doc;
}

/**
 * Genera el Llibre Registre Oficial de Béns d'Inversió i Amortitzacions de l'AEAT per als immobles en lloguer.
 * Document formal per a requeriments o inspeccions tributàries.
 */
export function generateAEATAmortizationBook(properties: RentalProperty[], fiscalYear: number = 2024): string {
  let doc = `========================================================================================================================
LLIBRE REGISTRE DE BÉNS D'INVERSIÓ I AMORTITZACIONS (ART. 23.1.b LIRPF)
AGÈNCIA ESTATAL D'ADMINISTRACIÓ TRIBUTÀRIA (AEAT) - EXERCICI ${fiscalYear}
========================================================================================================================\n\n`;

  if (properties.length === 0) {
    doc += `Cap immoble registrat.\n`;
    return doc;
  }

  properties.forEach((p, pIdx) => {
    doc += `IMMOBLE #${pIdx + 1}: ${p.name || p.address}\n`;
    doc += `Referència Cadastral: ${p.cadastralReference || 'Pendent'} | Adreça: ${p.address || '—'} | Titularitat: ${p.ownershipPercentage}%\n`;
    doc += `------------------------------------------------------------------------------------------------------------------------\n`;
    doc += `DETALL DE BÉNS D'INVERSIÓ I ELEMENTS AMORTITZABLES:\n\n`;
    doc += `${'NÚM. FACTURA'.padEnd(16)} | ${'DATA'.padEnd(10)} | ${'PROVEÏDOR / NIF'.padEnd(24)} | ${'CONCEPTE / ELEMENT'.padEnd(30)} | ${'GRUP AEAT'.padEnd(20)} | ${'COST (€)'.padStart(10)} | ${'% ANY'.padStart(6)} | ${'AMORT. ANY (€)'.padStart(14)} | ${'PENDENT (€)'.padStart(12)}\n`;
    doc += `${'-'.repeat(16)}-+-${'-'.repeat(10)}-+-${'-'.repeat(24)}-+-${'-'.repeat(30)}-+-${'-'.repeat(20)}-+-${'-'.repeat(10)}-+-${'-'.repeat(6)}-+-${'-'.repeat(14)}-+-${'-'.repeat(12)}\n`;

    let totalCost = 0;
    let totalAnnual = 0;
    let totalPending = 0;

    // 1. Inmoble / Construcció
    const constructionPercentage = (p.totalCadastralValue > 0 && p.constructionCadastralValue > 0)
      ? Math.min(1, Math.max(0.1, p.constructionCadastralValue / p.totalCadastralValue))
      : 0.7;
    const acqWithoutLand = (p.acquisitionCost || 0) * constructionPercentage;
    const baseConst = Math.max(p.constructionCadastralValue || 0, acqWithoutLand);
    const constAmort = baseConst * 0.03 * ((p.ownershipPercentage || 100) / 100);
    
    if (baseConst > 0) {
      doc += `${'Escriptura'.padEnd(16)} | ${'—'.padEnd(10)} | ${'Compra immoble'.padEnd(24)} | ${'Construcció (exclòs sòl)'.padEnd(30)} | ${'Grup 1 (3%)'.padEnd(20)} | ${baseConst.toFixed(2).padStart(10)} | ${'3.00%'.padStart(6)} | ${constAmort.toFixed(2).padStart(14)} | ${'—'.padStart(12)}\n`;
      totalCost += baseConst;
      totalAnnual += constAmort;
    }

    // 2. Elements d'inventari
    (p.inventory || []).forEach(item => {
      const grp = getAEATAssetGroup(item.category);
      const calc = calculateItemAnnualAmortization(
        item.amount,
        item.amortizationRate,
        item.previousAmortization,
        fiscalYear,
        item.acquisitionDate
      );
      const annual = calc.annualAmount * ((p.ownershipPercentage || 100) / 100);

      totalCost += item.amount;
      totalAnnual += annual;
      totalPending += calc.pendingValue;

      const invNo = (item.invoiceNumber || 'S/N').slice(0, 15).padEnd(16);
      const date = (item.acquisitionDate || '—').slice(0, 10).padEnd(10);
      const prov = `${item.supplierName || 'Proveïdor'} (${item.supplierNif || 'S/N'})`.slice(0, 23).padEnd(24);
      const concept = (item.concept || 'Element inventari').slice(0, 29).padEnd(30);
      const grpStr = grp.shortName.slice(0, 19).padEnd(20);

      doc += `${invNo} | ${date} | ${prov} | ${concept} | ${grpStr} | ${item.amount.toFixed(2).padStart(10)} | ${(item.amortizationRate + '%').padStart(6)} | ${annual.toFixed(2).padStart(14)} | ${calc.pendingValue.toFixed(2).padStart(12)}\n`;
    });

    doc += `${'-'.repeat(16)}-+-${'-'.repeat(10)}-+-${'-'.repeat(24)}-+-${'-'.repeat(30)}-+-${'-'.repeat(20)}-+-${'-'.repeat(10)}-+-${'-'.repeat(6)}-+-${'-'.repeat(14)}-+-${'-'.repeat(12)}\n`;
    doc += `${'TOTALS IMMOBLE'.padEnd(16)} | ${''.padEnd(10)} | ${''.padEnd(24)} | ${''.padEnd(30)} | ${''.padEnd(20)} | ${totalCost.toFixed(2).padStart(10)} | ${''.padStart(6)} | ${totalAnnual.toFixed(2).padStart(14)} | ${totalPending.toFixed(2).padStart(12)}\n\n`;
    doc += `========================================================================================================================\n\n`;
  });

  return doc;
}

/**
 * Exporta la totalitat de l'inventari a format CSV descarregable.
 */
export function exportPropertiesInventoryCSV(properties: RentalProperty[], fiscalYear: number = 2024): string {
  const headers = [
    'Immoble',
    'Referència Cadastral',
    'Núm. Factura',
    'Data Factura',
    'Proveïdor',
    'NIF Proveïdor',
    'Concepte Element',
    'Grup AEAT',
    'Taxa Amortització (%)',
    'Import (€)',
    'Amortització Acumulada Prèvia (€)',
    'Amortització Exercici Actual (€)',
    'Valor Pendent (€)',
    'Observacions / Ubicació',
  ];

  const rows: string[][] = [headers];

  properties.forEach(p => {
    (p.inventory || []).forEach(item => {
      const grp = getAEATAssetGroup(item.category);
      const calc = calculateItemAnnualAmortization(
        item.amount,
        item.amortizationRate,
        item.previousAmortization,
        fiscalYear,
        item.acquisitionDate
      );

      rows.push([
        `"${p.name || p.address}"`,
        `"${p.cadastralReference || ''}"`,
        `"${item.invoiceNumber || ''}"`,
        `"${item.acquisitionDate || ''}"`,
        `"${item.supplierName || ''}"`,
        `"${item.supplierNif || ''}"`,
        `"${item.concept || ''}"`,
        `"${grp.name}"`,
        `${item.amortizationRate}`,
        `${item.amount.toFixed(2)}`,
        `${(item.previousAmortization || 0).toFixed(2)}`,
        `${calc.annualAmount.toFixed(2)}`,
        `${calc.pendingValue.toFixed(2)}`,
        `"${item.notes || ''}"`,
      ]);
    });
  });

  return rows.map(r => r.join(';')).join('\r\n');
}
