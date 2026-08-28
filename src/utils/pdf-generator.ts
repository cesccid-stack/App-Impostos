/**
 * @module utils/pdf-generator
 * Generador Oficial de Documents PDF de la Declaració de la Renda (Model 100 AEAT).
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DeclaracionData, FiscalResult } from '../types.ts';
import { calculatePropertyFiscalResult } from '../fiscal/real-estate-engine.ts';
import { formatCurrency } from './currency.ts';

interface AutoTableJsPDF extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
}

/**
 * Genera i descarrega el document oficial PDF de la Declaració de la Renda (Model 100).
 */
export function generateModel100PDF(data: DeclaracionData, result: FiscalResult): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as AutoTableJsPDF;

  const year = data.year || 2024;
  const primaryColor: [number, number, number] = [99, 102, 241];   // #6366f1
  const darkTextColor: [number, number, number] = [15, 23, 42];     // #0f172a
  const mutedTextColor: [number, number, number] = [100, 116, 139]; // #64748b

  // ═════════════════════════════════════════════════════════════
  // PÀGINA 1: MODEL 100 - RESUM DE LIQUIDACIÓ
  // ═════════════════════════════════════════════════════════════
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 35, 'F');

  doc.setFontSize(18);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(`MODEL 100 — IRPF ${year}`, 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.text("Document oficial de liquidació i simulació d'acord amb la normativa de l'AEAT", 14, 25);
  doc.text(`Data d'emissió: ${new Date().toLocaleDateString('ca-ES')}`, 145, 25);

  // Dades identificatives
  autoTable(doc, {
    startY: 38,
    theme: 'grid',
    head: [['Identificació del Declarant / Unitat Familiar', 'Dades Fiscals']],
    body: [
      [`Nom: ${data.personal?.name || 'Declarant Principal'}`, `Comunitat Autònoma: Catalunya (${data.personal?.community || 'CAT'})`],
      [`NIF/NIE: ${data.personal?.nif || '—'}`, `Modalitat: ${data.personal?.taxDeclarationType === 'joint' ? 'Tributació Conjunta (3.400 €)' : 'Tributació Individual'}`],
      [`Edat: ${data.personal?.age || 35} anys`, `Descendents: ${(data.personal?.descendants || []).length} | Ascendents: ${(data.personal?.ascendants || []).length}`],
    ],
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: darkTextColor },
  });

  // Bases i Quotes
  const lastY = doc.lastAutoTable.finalY + 6;

  autoTable(doc, {
    startY: lastY,
    theme: 'striped',
    head: [['Casella', 'Concepte Liquidatori', 'Base General (€)', 'Base Estalvi (€)', 'Total (€)']],
    body: [
      ['0435 / 0460', 'Bases Imposables Prèvies', formatCurrency(result.generalBase), formatCurrency(result.savingsBase), formatCurrency(result.generalBase + result.savingsBase)],
      ['0438', 'Reducció per Rendiments del Treball', `-${formatCurrency(result.workIncomeReduction)}`, '—', `-${formatCurrency(result.workIncomeReduction)}`],
      ['0465', 'Reducció per Plans de Pensions (Art. 51)', `-${formatCurrency(result.pensionReduction)}`, '—', `-${formatCurrency(result.pensionReduction)}`],
      ['0466', 'Reducció per Tributació Conjunta (Art. 84)', result.jointTaxationReduction ? `-${formatCurrency(result.jointTaxationReduction)}` : '0,00 €', '—', result.jointTaxationReduction ? `-${formatCurrency(result.jointTaxationReduction)}` : '0,00 €'],
      ['0500 / 0505', 'Bases Liquidables Generals i de l\'Estalvi', formatCurrency(result.liquidableGeneralBase), formatCurrency(result.liquidableSavingsBase), formatCurrency(result.liquidableGeneralBase + result.liquidableSavingsBase)],
      ['0511 - 0520', 'Mínim Personal i Familiar Exempt', formatCurrency(result.totalMinimum), '—', formatCurrency(result.totalMinimum)],
      ['0545 / 0546', 'Quota Íntegra Estatal (General + Estalvi)', formatCurrency(result.stateGeneralTax), formatCurrency(result.stateSavingsTax), formatCurrency(result.stateGeneralTax + result.stateSavingsTax)],
      ['0547 / 0548', 'Quota Íntegra Autonòmica Catalunya', formatCurrency(result.autonomicGeneralTax), formatCurrency(result.autonomicSavingsTax), formatCurrency(result.autonomicGeneralTax + result.autonomicSavingsTax)],
      ['0595', 'Deduccions Totals (Habitatge, Donatius, Catalunya)', '—', '—', `-${formatCurrency(result.totalDeductions)}`],
      ['0599', 'Quota Líquida Total (Impostos Meritats)', '—', '—', formatCurrency(result.netTax)],
      ['0609', 'Retencions i Pagaments a Compte Practicats', '—', '—', `-${formatCurrency(result.totalWithholdings)}`],
    ],
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: darkTextColor },
  });

  // Resultat Final Banner
  const resultY = doc.lastAutoTable.finalY + 8;
  const isRefund = result.result < 0;
  const isComp = !!data.complementary?.isComplementary;

  doc.setFillColor(isRefund ? 240 : 254, isRefund ? 253 : 242, isRefund ? 244 : 242);
  doc.setDrawColor(isRefund ? 16 : 239, isRefund ? 185 : 68, isRefund ? 129 : 68);
  doc.roundedRect(14, resultY, 182, isComp ? 32 : 24, 3, 3, 'FD');

  doc.setFontSize(10);
  doc.setTextColor(isRefund ? 16 : 220, isRefund ? 140 : 38, isRefund ? 80 : 38);
  doc.setFont('helvetica', 'bold');
  doc.text(`RESULTAT FINAL DE LA DECLARACIÓ (Casella 0610 AEAT):`, 20, resultY + 8);

  doc.setFontSize(14);
  doc.text(
    `${isRefund ? 'A TORNAR D\'HISENDA: ' : 'A PAGAR A HISENDA: '} ${formatCurrency(Math.abs(result.result))}`,
    20,
    resultY + 16
  );

  if (isComp) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 88, 12);
    const diff = result.differentialResult ?? (result.result - (data.complementary?.previousResult || 0));
    doc.text(
      `⚡ AUTOLIQUIDACIÓ COMPLEMENTÀRIA: Diferencial a liquidar: ${formatCurrency(diff)} | Recàrrec Art. 27: +${formatCurrency(result.surchargeExtemporaneous || 0)} | TOTAL: ${formatCurrency(result.finalAmountDue || diff)}`,
      20,
      resultY + 26
    );
  }

  // ═════════════════════════════════════════════════════════════
  // PÀGINA 2: RENDIMENTS DEL TREBALL, CAPITAL I ACTIVITATS
  // ═════════════════════════════════════════════════════════════
  doc.addPage();

  doc.setFontSize(14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("ANNEX 1: Rendiments del Treball, Capital i Activitats", 14, 16);

  // Treball
  const employersBody = (data.workIncome?.employers || []).map((e, i) => [
    `#${i + 1} ${e.name}`,
    formatCurrency(e.grossSalary),
    formatCurrency(e.inKind),
    formatCurrency(e.socialSecurity),
    formatCurrency(e.withholdings),
  ]);

  autoTable(doc, {
    startY: 22,
    head: [['Empresa / Pagador', 'Salari Brut (€)', 'En Espècie (€)', 'Seguretat Social (€)', 'Retencions (€)']],
    body: employersBody.length > 0 ? employersBody : [['Sense rendiments del treball registrats', '0,00 €', '0,00 €', '0,00 €', '0,00 €']],
    headStyles: { fillColor: [79, 70, 229], fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
  });

  // Capital Mobiliari & Estranger
  const capY = doc.lastAutoTable.finalY + 8;
  autoTable(doc, {
    startY: capY,
    head: [['Rendiments del Capital Mobiliari', 'Import Brut (€)', 'Retenció / Impost Estranger (€)', 'Casella AEAT']],
    body: [
      ['Interessos de comptes i dipòsits', formatCurrency(data.capitalIncome?.interests || 0), '—', '0027'],
      ['Dividends d\'accions nacionals', formatCurrency(data.capitalIncome?.dividends || 0), '—', '0029'],
      ['Dividends internacionals (EUA / Europa)', formatCurrency(data.capitalIncome?.foreignDividends || 0), formatCurrency(data.capitalIncome?.foreignTaxWithheld || 0), '0029 / 0588'],
      ['Deducció per Doble Imposició Internacional (Art. 80)', '—', formatCurrency(result.foreignTaxCredit || 0), '0588'],
    ],
    headStyles: { fillColor: [30, 41, 59], fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
  });

  // ═════════════════════════════════════════════════════════════
  // PÀGINA 3: IMMOBLES I LLIBRE REGISTRE D'AMORTITZACIONS
  // ═════════════════════════════════════════════════════════════
  doc.addPage();

  doc.setFontSize(14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("ANNEX 2: Extracontable d'Immobilitzat i Amortitzacions AEAT", 14, 16);

  const propResults = (data.properties || []).map(p => calculatePropertyFiscalResult(p, year));
  const propTableBody = propResults.map((res, i) => [
    `#${i + 1} ${res.property.name || res.property.address}`,
    res.property.cadastralReference || '—',
    formatCurrency(res.grossIncome),
    formatCurrency(res.totalExpenses),
    formatCurrency(res.totalAmortization),
    `${res.reductionRate}%`,
    formatCurrency(res.netReducedIncome),
  ]);

  autoTable(doc, {
    startY: 22,
    head: [['Immoble', 'Ref. Cadastral', 'Ingressos (€)', 'Despeses (€)', 'Amortització (€)', 'Reducció', 'Rendiment Net (€)']],
    body: propTableBody.length > 0 ? propTableBody : [['Cap immoble registrat', '—', '0,00 €', '0,00 €', '0,00 €', '0%', '0,00 €']],
    headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
  });

  // Detall d'Actius d'Inventari
  const allInventoryItems: string[][] = [];
  (data.properties || []).forEach(p => {
    (p.inventory || []).forEach(inv => {
      allInventoryItems.push([
        p.name || 'Immoble',
        inv.acquisitionDate || '—',
        inv.invoiceNumber || 'S/N',
        inv.concept,
        `${inv.amortizationRate}%`,
        formatCurrency(inv.amount),
        inv.status === 'disposed' ? `Baixa (${inv.disposalDate || ''})` : 'Actiu',
      ]);
    });
  });

  const invY = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text("Llibre Registre d'Actius i Béns d'Inversió (Taula Simplificada AEAT):", 14, invY);

  autoTable(doc, {
    startY: invY + 4,
    head: [['Immoble', 'Data Alta', 'Factura', 'Concepte / Descripció', 'Taxa', 'Cost (€)', 'Estat']],
    body: allInventoryItems.length > 0 ? allInventoryItems : [['Sense actius registrats a l\'inventari', '—', '—', '—', '—', '0,00 €', '—']],
    headStyles: { fillColor: [30, 41, 59], fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
  });

  // ═════════════════════════════════════════════════════════════
  // PÀGINA 4: GUANYS PATRIMONIALS, DEDUCCIONS CATALUNYA I ADVISOR
  // ═════════════════════════════════════════════════════════════
  doc.addPage();

  doc.setFontSize(14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("ANNEX 3: Guanys Patrimonials (FIFO) i Deduccions de Catalunya", 14, 16);

  // Guanys
  const gainsBody = (data.gains?.items || []).map(g => [
    g.description || 'Transmissió',
    g.acquisitionDate || '—',
    g.transferDate || '—',
    formatCurrency(g.acquisitionValue),
    formatCurrency(g.transferValue),
    formatCurrency(g.transferValue - g.acquisitionValue - g.expenses),
    g.isNonComputableLoss ? 'No computable (0335)' : 'Computable',
  ]);

  autoTable(doc, {
    startY: 22,
    head: [['Descripció Actiu', 'Adquisició', 'Transmissió', 'Valor Compra (€)', 'Valor Venda (€)', 'Guany/Pèrdua (€)', 'Estat AEAT']],
    body: gainsBody.length > 0 ? gainsBody : [['Sense operacions de guanys patrimonials', '—', '—', '0,00 €', '0,00 €', '0,00 €', '—']],
    headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
  });

  // Deduccions Catalunya
  const catDeducY = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text("Deduccions Autonòmiques de la Comunitat Autònoma de Catalunya:", 14, catDeducY);

  autoTable(doc, {
    startY: catDeducY + 4,
    head: [['Concepte Deducció Autonòmica', 'Estat / Base Aplicada', 'Deducció Obtinguda (€)']],
    body: [
      ['Lloguer d\'habitatge habitual (≤32 anys o atur)', data.deductions?.catalanRentalDeduction ? `Aplicat (${formatCurrency(data.deductions.catalanRentalAmount)})` : 'No aplicat', formatCurrency(result.catalanDeductionsAmount > 0 && data.deductions?.catalanRentalDeduction ? Math.min(300, data.deductions.catalanRentalAmount * 0.1) : 0)],
      ['Naixement o adopció de fills', `${data.deductions?.catalanBirthAdoption || 0} fills`, formatCurrency((data.deductions?.catalanBirthAdoption || 0) * 150)],
      ['Inversió en startups / noves empreses', formatCurrency(data.deductions?.catalanStartupInvestment || 0), formatCurrency((data.deductions?.catalanStartupInvestment || 0) * 0.3)],
      ['TOTAL DEDUCCIONS AUTONÒMIQUES CATALUNYA', '—', formatCurrency(result.catalanDeductionsAmount)],
    ],
    headStyles: { fillColor: [30, 41, 59], fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
  });

  // Descarregar PDF
  doc.save(`declaracio_renda_${year}_model100.pdf`);
}
