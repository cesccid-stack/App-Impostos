/**
 * @module utils/export-csv
 * Generate CSV export of the fiscal result.
 */

import type { DeclaracionData, FiscalResult } from '../types.ts';

/**
 * Generate a CSV string with the full breakdown.
 */
export function generateCSV(data: DeclaracionData, result: FiscalResult): string {
  const lines: string[][] = [];

  lines.push(['Declaració de la Renda - Exercici ' + data.year]);
  lines.push([]);
  lines.push(['Concepte', 'Import (€)']);
  lines.push([]);

  // Bases
  lines.push(['=== BASES IMPOSABLES ===', '']);
  lines.push(['Base imposable general', fmt(result.generalBase)]);
  lines.push(['Base imposable de l\'estalvi', fmt(result.savingsBase)]);
  lines.push([]);

  // Reductions
  lines.push(['=== REDUCCIONS ===', '']);
  lines.push(['Reducció rendiments del treball', fmt(-result.workIncomeReduction)]);
  lines.push(['Reducció plans de pensions', fmt(-result.pensionReduction)]);
  lines.push(['Total reduccions', fmt(-result.totalReductions)]);
  lines.push([]);

  // Liquidable bases
  lines.push(['=== BASES LIQUIDABLES ===', '']);
  lines.push(['Base liquidable general', fmt(result.liquidableGeneralBase)]);
  lines.push(['Base liquidable de l\'estalvi', fmt(result.liquidableSavingsBase)]);
  lines.push([]);

  // Minimums
  lines.push(['=== MÍNIMS PERSONALS I FAMILIARS ===', '']);
  lines.push(['Mínim personal', fmt(result.personalMinimum)]);
  lines.push(['Mínim per descendents', fmt(result.descendantsMinimum)]);
  lines.push(['Mínim per ascendents', fmt(result.ascendantsMinimum)]);
  lines.push(['Total mínims', fmt(result.totalMinimum)]);
  lines.push([]);

  // Tax
  lines.push(['=== QUOTES ===', '']);
  lines.push(['Quota íntegra general', fmt(result.generalTax)]);
  lines.push(['Quota íntegra estalvi', fmt(result.savingsTax)]);
  lines.push(['Crèdit per mínim personal/familiar', fmt(-result.minimumTaxCredit)]);
  lines.push(['Quota íntegra total', fmt(result.grossTax)]);
  lines.push([]);

  // Deductions
  lines.push(['=== DEDUCCIONS ===', '']);
  lines.push(['Deducció habitatge habitual', fmt(-result.housingDeductionAmount)]);
  lines.push(['Deducció per donatius', fmt(-result.donationsDeductionAmount)]);
  lines.push(['Deducció per maternitat', fmt(-result.maternityDeductionAmount)]);
  lines.push(['Total deduccions', fmt(-result.totalDeductions)]);
  lines.push([]);

  // Result
  lines.push(['=== RESULTAT ===', '']);
  lines.push(['Quota líquida', fmt(result.netTax)]);
  lines.push(['Retencions i pagaments a compte', fmt(-result.totalWithholdings)]);
  lines.push(['QUOTA DIFERENCIAL', fmt(result.result)]);
  lines.push([result.result >= 0 ? 'A PAGAR' : 'A TORNAR', fmt(Math.abs(result.result))]);
  lines.push([]);

  // Gains detail
  if (data.gains.items.length > 0) {
    lines.push([]);
    lines.push(['=== DETALL OPERACIONS PATRIMONIALS ===', '']);
    lines.push(['Descripció', 'Tipus', 'Valor adquisició', 'Valor transmissió', 'Despeses', 'Resultat']);
    for (const item of data.gains.items) {
      const gain = item.transferValue - item.acquisitionValue - item.expenses;
      lines.push([
        item.description,
        item.type,
        fmt(item.acquisitionValue),
        fmt(item.transferValue),
        fmt(item.expenses),
        fmt(gain),
      ]);
    }
  }

  // Donations detail
  if (data.deductions.donations.length > 0) {
    lines.push([]);
    lines.push(['=== DETALL DONATIUS ===', '']);
    lines.push(['Entitat', 'Import', 'Prioritària', 'Recurrent']);
    for (const d of data.deductions.donations) {
      lines.push([d.entity, fmt(d.amount), d.priority ? 'Sí' : 'No', d.recurring ? 'Sí' : 'No']);
    }
  }

  return '\uFEFF' + lines.map((row) => row.map(escapeCSV).join(';')).join('\n');
}

function fmt(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function escapeCSV(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
