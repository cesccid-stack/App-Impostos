/**
 * @module pages/export
 * Export page — PDF, CSV, JSON.
 */

import { store } from '../store.ts';
import { calculateIRPF } from '../fiscal/irpf.ts';
import { calculateAllProperties } from '../fiscal/real-estate-engine.ts';
import { showToast } from '../components/toast.ts';
import { generateCSV } from '../utils/export-csv.ts';
import { generateAEATAnnexF2, generateAEATAnnexA } from '../utils/aeat-export.ts';
import type { DeclaracionData, FiscalResult } from '../types.ts';

export function renderExport(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container';

  page.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Exportar dades</h1>
      <p class="page-header__subtitle">Descarrega el resum de la teva declaració</p>
    </div>
  `;

  const grid = document.createElement('div');
  grid.className = 'export-grid stagger';

  // Renta Web Guide
  const rentaWebCard = createExportCard({
    icon: '🏛️',
    title: 'Guia Global Renta Web (Migració)',
    description: 'Genera un document complet amb el llistat exacte de "Casillas" (treball, capital, immobles, accions, deduccions).',
    onClick: () => {
      try {
        const data = store.getData();
        const result = calculateIRPF(data);
        const guideText = generateRentaWebGuide(data, result);
        downloadFile(guideText, `guia_renta_web_${data.year}.txt`, 'text/plain');
        showToast('Guia Renta Web descarregada', 'success');
      } catch (e) {
        showToast('Error en generar la guia', 'error');
      }
    },
  });
  grid.appendChild(rentaWebCard);

  // Annex A (Immobles)
  const annexACard = createExportCard({
    icon: '🏠',
    title: 'AEAT Annex A (Immobles en Lloguer)',
    description: 'Descarrega el desglossament detallat de rendiments immobiliaris, amortització de construcció, obres i mobles (Caselles 0060-0105).',
    onClick: () => {
      const data = store.getData();
      const { results } = calculateAllProperties(data.properties || [], data.year);
      const txt = generateAEATAnnexA(results);
      downloadFile(txt, `aeat_annex_a_immobles_${data.year}.txt`, 'text/plain');
      showToast('Annex A descarregat', 'success');
    },
  });
  grid.appendChild(annexACard);

  // Annex F2 (Accions i Fons)
  const annexF2Card = createExportCard({
    icon: '📈',
    title: 'AEAT Annex F2 (Accions i Valors Negociats)',
    description: 'Descarrega la guia oficial per a la Casella 0327 i següents, amb agrupació per ISIN i regla dels 2 mesos.',
    onClick: () => {
      const data = store.getData();
      const gains = data.gains.items || [];
      const dummySummaries = gains.map(g => ({
        isin: g.description.match(/\[(.*?)\]/)?.[1] || '',
        symbol: g.description.split(' ')[1] || g.description,
        name: g.description,
        assetClass: g.type,
        totalBought: g.acquisitionValue,
        totalSold: g.transferValue,
        realizedGain: g.transferValue - g.acquisitionValue - g.expenses,
        suspendedLosses: g.isNonComputableLoss ? Math.max(0, g.acquisitionValue + g.expenses - g.transferValue) : 0,
        netTaxableGain: (g.isNonComputableLoss && (g.transferValue - g.acquisitionValue - g.expenses) < 0) ? 0 : (g.transferValue - g.acquisitionValue - g.expenses),
        unrealizedGain: 0,
        openPosition: 0,
        tradesCount: 1,
      }));
      const txt = generateAEATAnnexF2(dummySummaries, []);
      downloadFile(txt, `aeat_annex_f2_accions_${data.year}.txt`, 'text/plain');
      showToast('Annex F2 descarregat', 'success');
    },
  });
  grid.appendChild(annexF2Card);

  // CSV export
  const csvCard = createExportCard({
    icon: '📊',
    title: 'Exportar a CSV',
    description: 'Descarrega un fitxer CSV amb el desglossament complet del càlcul. Compatible amb Excel i Google Sheets.',
    onClick: () => {
      try {
        const data = store.getData();
        const result = calculateIRPF(data);
        const csv = generateCSV(data, result);
        downloadFile(csv, `renta_${data.year}_desglossament.csv`, 'text/csv');
        showToast('CSV descarregat correctament', 'success');
      } catch (e) {
        showToast('Error en generar el CSV', 'error');
      }
    },
  });
  grid.appendChild(csvCard);

  // JSON export
  const jsonCard = createExportCard({
    icon: '🗂',
    title: 'Exportar dades (JSON)',
    description: 'Descarrega totes les dades introduïdes en format JSON. Útil per fer còpies de seguretat o importar a un altre navegador.',
    onClick: () => {
      try {
        const json = store.exportAll();
        const data = store.getData();
        downloadFile(json, `renta_backup_${data.year}.json`, 'application/json');
        showToast('Backup descarregat correctament', 'success');
      } catch (e) {
        showToast('Error en generar el backup', 'error');
      }
    },
  });
  grid.appendChild(jsonCard);

  // JSON import
  const importCard = createExportCard({
    icon: '📥',
    title: 'Importar dades (JSON)',
    description: 'Restaura les dades des d\'un fitxer JSON prèviament exportat. Sobreescriurà les dades actuals.',
    onClick: () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            store.importData(reader.result as string);
            showToast('Dades importades correctament', 'success');
          } catch {
            showToast('Error en importar les dades. Format invàlid.', 'error');
          }
        };
        reader.readAsText(file);
      });
      input.click();
    },
  });
  grid.appendChild(importCard);

  // Print
  const printCard = createExportCard({
    icon: '🖨',
    title: 'Imprimir resum',
    description: 'Obre el diàleg d\'impressió del navegador per imprimir o guardar com a PDF el resum de la declaració.',
    onClick: () => {
      window.print();
    },
  });
  grid.appendChild(printCard);

  page.appendChild(grid);

  // Danger zone
  const dangerCard = document.createElement('div');
  dangerCard.className = 'card';
  dangerCard.style.marginTop = 'var(--space-2xl)';
  dangerCard.style.borderColor = 'rgba(239, 68, 68, 0.2)';
  dangerCard.innerHTML = `
    <div class="card__header">
      <div>
        <div class="card__title" style="color:var(--color-error);">Zona de perill</div>
        <div class="card__subtitle">Accions irreversibles</div>
      </div>
    </div>
  `;

  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn btn--danger';
  resetBtn.textContent = '🗑 Esborrar totes les dades de l\'exercici actual';
  resetBtn.addEventListener('click', () => {
    if (confirm(`Segur que vols esborrar totes les dades de l'exercici ${store.getYear()}?`)) {
      store.reset();
      showToast('Dades esborrades correctament', 'success');
    }
  });
  dangerCard.appendChild(resetBtn);
  page.appendChild(dangerCard);

  return page;
}

function createExportCard(opts: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card export-card';
  card.innerHTML = `
    <div class="export-card__icon">${opts.icon}</div>
    <div class="export-card__title">${opts.title}</div>
    <div class="export-card__description">${opts.description}</div>
  `;
  card.addEventListener('click', opts.onClick);
  return card;
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generateRentaWebGuide(data: DeclaracionData, result: FiscalResult): string {
  let guide = `===========================================================
GUIA DE MIGRACIÓ A RENTA WEB - EXERCICI ${data.year}
===========================================================
Aquest document t'ajuda a traslladar les xifres de l'aplicació
als formularis oficials de la Renta Web (Borrador d'Hisenda).
-----------------------------------------------------------

=== RENDIMENTS DEL TREBALL ===
`;

  let totalGross = 0;
  let totalSS = 0;
  let totalWithholdings = 0;

  for (const emp of data.workIncome.employers) {
    const dietsExempt = emp.dietsDays * 26.67;
    const mileageExempt = emp.mileageKm * 0.26;
    const taxableDiets = Math.max(0, emp.dietsIncome - dietsExempt);
    const taxableMileage = Math.max(0, emp.mileageIncome - mileageExempt);
    const empGross = emp.grossSalary + emp.inKind + taxableDiets + taxableMileage;
    
    totalGross += empGross;
    totalSS += emp.socialSecurity;
    totalWithholdings += emp.withholdings;
    
    if (emp.dietsIncome > 0 || emp.mileageIncome > 0) {
      guide += `\n[Nota Info Pagador: ${emp.name}]
  - Dietes Ingressades: ${emp.dietsIncome.toFixed(2)} €
  - Dietes Exemptes per Llei (${emp.dietsDays} dies x 26,67 €): ${dietsExempt.toFixed(2)} €
  - Dietes Imputables a Base (Excés): ${taxableDiets.toFixed(2)} €
  - Km Ingressats: ${emp.mileageIncome.toFixed(2)} €
  - Km Exempts per Llei (${emp.mileageKm} km x 0,26 €): ${mileageExempt.toFixed(2)} €
  - Km Imputables a Base (Excés): ${taxableMileage.toFixed(2)} €\n`;
    }
  }

  guide += `[Casilla 0003] Retribucions dineràries: ${totalGross.toFixed(2)} €\n`;
  guide += `[Casilla 0013] Cotitzacions Seguretat Social: ${totalSS.toFixed(2)} €\n`;
  
  if (data.workIncome.unionFees > 0) {
    guide += `[Casilla 0014] Quotes satisfetes a sindicats: ${data.workIncome.unionFees.toFixed(2)} €\n`;
  }
  if (data.workIncome.otherDeductible > 0) {
    guide += `[Casilla 0016] Altres despeses deduïbles: ${data.workIncome.otherDeductible.toFixed(2)} €\n`;
  }

  guide += `\n=== RENDIMENTS DEL CAPITAL MOBILIARI ===\n`;
  if (data.capitalIncome.interests > 0) guide += `[Casilla 0027] Interessos de comptes i dipòsits: ${data.capitalIncome.interests.toFixed(2)} €\n`;
  if (data.capitalIncome.dividends > 0) guide += `[Casilla 0029] Dividends i accions: ${data.capitalIncome.dividends.toFixed(2)} €\n`;
  if (data.capitalIncome.otherMobiliary > 0) guide += `[Casilla 0033/0040] Altres rendiments del capital mobiliari: ${data.capitalIncome.otherMobiliary.toFixed(2)} €\n`;

  // Immobles
  const props = data.properties || [];
  if (props.length > 0) {
    const { results, totalNetReducedIncome } = calculateAllProperties(props);
    guide += `\n=== RENDIMENTS DEL CAPITAL IMMOBILIARI (ANNEX A) ===\n`;
    guide += `Total immobles en explotació: ${props.length}\n`;
    results.forEach((r, i) => {
      guide += `  • Immoble #${i+1} (${r.property.name || r.property.address}) [Ref. Cadastral ${r.property.cadastralReference}]:\n`;
      guide += `    - [Casilla 0066] Ingressos: ${r.grossIncome.toFixed(2)} €\n`;
      guide += `    - [Casilla 0071] Despeses limitades aplicades: ${r.limitedExpensesDeducted.toFixed(2)} €\n`;
      guide += `    - [Casilla 0079] Amortització immoble: ${r.buildingAmortization.toFixed(2)} €\n`;
      guide += `    - [Casilla 0080] Amortització obres millora: ${r.improvementsAmortization.toFixed(2)} €\n`;
      guide += `    - [Casilla 0081] Amortització mobles: ${r.furnitureAmortization.toFixed(2)} €\n`;
      if (r.reductionAmount > 0) {
        guide += `    - [Casilla 0100] Reducció arrendament (${r.reductionRate}%): -${r.reductionAmount.toFixed(2)} €\n`;
      }
      guide += `    - [Casilla 0105] Rendiment net reduït: ${r.netReducedIncome.toFixed(2)} €\n`;
    });
    guide += `[Casilla 0105 TOTAL] Total Rendiment Immobiliari a Base General: ${totalNetReducedIncome.toFixed(2)} €\n`;
  }

  guide += `\n=== GUANYS I PÈRDUES PATRIMONIALS (ACCIONS I FONS) ===\n`;
  const gains = data.gains.items;
  if (gains.length > 0) {
    guide += `[Secció F2 - Accions negociades (Casilla 0327 i següents)]\n`;
    guide += `Has de detallar les següents agrupacions de vendes o introduir-les amb eines automàtiques (si tens més de 50). Verifica la regla dels 2 mesos on correspongui.\n`;
    for (const g of gains) {
      guide += `  - ${g.description}: Adquisició ${g.acquisitionValue.toFixed(2)}€, Transmissió ${g.transferValue.toFixed(2)}€`;
      if (g.isNonComputableLoss && (g.transferValue - g.acquisitionValue - g.expenses) < 0) {
        guide += ` [ATENCIÓ: Casilla 0335/0336 "Pérdida patrimonial a integrar en ejercicios siguientes" per Regla de 2 mesos]\n`;
      } else {
        guide += `\n`;
      }
    }
  } else {
    guide += `Sense operacions aquest exercici.\n`;
  }

  guide += `\n=== RETENCIONS I PAGAMENTS A COMPTE ===\n`;
  guide += `[Casilla 0596] Retencions del treball: ${totalWithholdings.toFixed(2)} €\n`;
  if (data.capitalIncome.mobiliaryWithholdings > 0) guide += `[Casilla 0597] Retencions de capital mobiliari: ${data.capitalIncome.mobiliaryWithholdings.toFixed(2)} €\n`;
  
  guide += `\n=== DEDUCCIONS AUTONÒMIQUES (CATALUNYA) ===\n`;
  if (data.deductions.catalanRentalDeduction) {
    guide += `[Casilla 1003] Lloguer d'habitatge habitual (Catalunya) - Quantitats: ${data.deductions.catalanRentalAmount.toFixed(2)} €\n`;
  }
  if (data.deductions.catalanBirthAdoption > 0) {
    guide += `[Casilla 1000] Naixement o adopció fills: ${data.deductions.catalanBirthAdoption} fills\n`;
  }
  if (data.deductions.catalanStartupInvestment > 0) {
    guide += `[Casilla 1006] Inversió empreses nova creació: ${data.deductions.catalanStartupInvestment.toFixed(2)} €\n`;
  }

  guide += `\n===========================================================\n`;
  guide += `RESULTAT FINAL ESTIMAT PER L'APP: ${result.result.toFixed(2)} €\n`;
  guide += `(Positiu: a pagar, Negatiu: a tornar)\n`;
  
  return guide;
}
