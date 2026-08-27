/**
 * @module fiscal/auto-validator
 * Motor Centralitzat de Comprovacions i Validacions Fiscals Automàtiques en Temps Real.
 * Audita contínuament i de forma exhaustiva la coherència comptable i legal entre:
 * 1. Mòdul d'IVA (Llei 37/1992, RIVA, Ordre HAC/773/2019, Models 303/390/349, RD 1619/2012, Llei 11/2021).
 * 2. Rendiments del Treball, Pensions, Retencions i Exempcions (Art. 7.p, Art. 18, Art. 19, Art. 20, Art. 51, Art. 96 LIRPF).
 * 3. Rendiments del Capital Mobiliari i Doble Imposició Internacional (Art. 25, Art. 26, Art. 80 LIRPF).
 * 4. Rendiments del Capital Immobiliari (Art. 22, Art. 23, Art. 24, Art. 85 LIRPF, Llei 12/2023).
 * 5. Activitats Econòmiques en Estimació Directa (Art. 27 a 32 LIRPF, RD 439/2007).
 * 6. Guanys i Pèrdues Patrimonials, Criptomonedes i Bossa de 4 Anys (Art. 33 a 49 LIRPF).
 * 7. Mínims Personals i Familiars per Descendents, Ascendents i Discapacitat (Art. 56 a 61 LIRPF).
 * 8. Deduccions Estatals i Autonòmiques de Catalunya (Llei 31/2002, Llei 49/2002, DT 18a LIRPF).
 * 9. Gestió Patrimonial i Impost sobre el Patrimoni (Model 714 / Llei 19/1991).
 */

import type { DeclaracionData } from '../types.ts';
import { calculateModel390Annual } from './iva-engine.ts';
import { formatCurrency } from '../utils/currency.ts';
import { store } from '../store.ts';
import { ModelReconciliationEngine } from './model-reconciliation-engine.ts';
import { isExclusiveVehicleActivity } from './vehicle-deduction-engine.ts';

export type ValidationSeverity = 'critical' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  module: 'iva' | 'activities' | 'properties' | 'wealth' | 'general';
  severity: ValidationSeverity;
  title: string;
  message: string;
  legalReference: string;
  autoFixable: boolean;
  autoFixLabel?: string;
  autoFixKey?: string;
}

export interface ValidationReport {
  timestamp: string;
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  complianceScore: number; // 0% a 100%
  status: 'perfect' | 'warnings' | 'errors';
  issues: ValidationIssue[];
}

/**
 * Llista oficial de codis de país de la Unió Europea per al cens VIES (Model 349).
 */
const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 
  'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 
  'PT', 'RO', 'SE', 'SI', 'SK'
]);

/**
 * Valida l'estructura i algorisme oficial del NIF / NIE / CIF espanyol segons la normativa de l'AEAT.
 */
export function isValidSpanishTaxId(taxId: string): boolean {
  if (!taxId) return false;
  const clean = taxId.trim().toUpperCase().replace(/[\s-]/g, '');
  if (clean.length !== 9) return false;

  const controlLetters = 'TRWAGMYFPDXBNJZSQVHLCKE';

  // 1. DNI (8 dígits + lletra)
  const dniMatch = clean.match(/^(\d{8})([A-Z])$/);
  if (dniMatch) {
    const num = parseInt(dniMatch[1], 10);
    const expectedLetter = controlLetters[num % 23];
    return dniMatch[2] === expectedLetter;
  }

  // 2. NIE (X, Y, Z + 7 dígits + lletra)
  const nieMatch = clean.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (nieMatch) {
    const prefixMap: Record<string, string> = { X: '0', Y: '1', Z: '2' };
    const fullNumStr = prefixMap[nieMatch[1]] + nieMatch[2];
    const num = parseInt(fullNumStr, 10);
    const expectedLetter = controlLetters[num % 23];
    return nieMatch[3] === expectedLetter;
  }

  // 3. CIF (Lletra d'entitat + 7 dígits + dígit o lletra de control)
  const cifMatch = clean.match(/^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/);
  if (cifMatch) {
    const letter = cifMatch[1];
    const digits = cifMatch[2];
    const control = cifMatch[3];

    let evenSum = 0;
    let oddSum = 0;

    for (let i = 0; i < 7; i++) {
      const d = parseInt(digits[i], 10);
      if (i % 2 === 0) {
        const doubled = d * 2;
        oddSum += Math.floor(doubled / 10) + (doubled % 10);
      } else {
        evenSum += d;
      }
    }

    const totalSum = evenSum + oddSum;
    const lastDigit = totalSum % 10;
    const complement = lastDigit === 0 ? 0 : 10 - lastDigit;

    const cifControlLetters = 'JABCDEFGHI';
    const expectedLetter = cifControlLetters[complement];
    const expectedDigit = complement.toString();

    if (['P', 'Q', 'S', 'R', 'W'].includes(letter)) {
      return control === expectedLetter;
    }
    if (['A', 'B', 'E', 'H'].includes(letter)) {
      return control === expectedDigit;
    }
    return control === expectedDigit || control === expectedLetter;
  }

  return false;
}

/**
 * Valida el format i estructura d'una Referència Cadastral espanyola (20 caràcters alfanumèrics).
 */
export function isValidCadastralReference(ref: string): boolean {
  if (!ref) return false;
  const clean = ref.trim().toUpperCase().replace(/[\s-]/g, '');
  if (clean.length !== 20) return false;
  return /^[0-9A-Z]{20}$/.test(clean);
}

/**
 * Executa totes les comprovacions automàtiques sobre la declaració activa (IRPF & IVA).
 */
export function runAutomatedComplianceChecks(data: DeclaracionData): ValidationReport {
  const issues: ValidationIssue[] = [];
  const year = data.year || 2024;
  
  const iva = data.iva || {
    config: {
      regime: 'general',
      settlementFrequency: 'quarterly',
      isREDEME: false,
      hasProrrata: false,
      prorrata: { type: 'general', provisionalPercentage: 100, definitivePercentage: 100, isRegulatedAutomatically: true, totalOperationsWithDeduction: 0, totalOperationsVolume: 0 },
      initialPendingCarryover: 0,
    },
    issuedInvoices: [],
    receivedInvoices: [],
    investmentAssets: [],
    quarters: {} as any,
  };

  const act = data.activities || { income: 0, expenses: 0, withholdings: 0, socialSecuritySelfEmployed: 0, estimationType: 'direct_simplified' };
  const properties = data.properties || [];
  const work = data.workIncome || { employers: [], unionFees: 0, otherDeductible: 0, pensionContributions: 0 };
  const cap = data.capitalIncome || { interests: 0, dividends: 0, foreignDividends: 0, foreignTaxWithheld: 0, insuranceGains: 0, otherMobiliary: 0, mobiliaryWithholdings: 0, rentalIncome: 0, rentalExpenses: 0, imputedIncome: 0, realEstateWithholdings: 0 };
  const deductions = data.deductions || {} as any;
  const gains = data.gains || { items: [], totalWithholdings: 0 };
  const personal = data.personal || { name: '', nif: '', age: 35, disability: 0, descendants: [], ascendants: [], community: 'CAT', taxDeclarationType: 'individual' };

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 1: COMPROVACIONS DETALLADES D'IRPF — RENDIMENTS DEL TREBALL (ARTS. 17-20 LIRPF)
  // ═══════════════════════════════════════════════════════════════════════════

  // 1.1 Aportacions a Plans de Pensions Individuals (> 1.500 € / Art. 51.1 LIRPF)
  const pensionContrib = work.pensionContributions || 0;
  if (pensionContrib > 1500) {
    issues.push({
      id: 'pension-individual-limit-exceeded',
      module: 'general',
      severity: 'warning',
      title: `Aportació a Plans de Pensions individuals (${formatCurrency(pensionContrib)}) superior al límit legal de 1.500 €`,
      message: `El límit fiscal màxim de reducció a la base imposable per aportacions a plans de pensions individuals és de 1.500 € anuals. L'excés de ${formatCurrency(pensionContrib - 1500)} es pot traslladar als 5 exercicis següents.`,
      legalReference: 'Art. 51.1 Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: false,
    });
  }

  // 1.2 Aportacions a Plans de Pensions d'Ocupació / Empresa (> 8.500 € / Art. 51.1 LIRPF)
  const companyPension = deductions.companyPensionContributions || 0;
  if (companyPension > 8500) {
    issues.push({
      id: 'pension-company-limit-exceeded',
      module: 'general',
      severity: 'warning',
      title: `Aportació empresarial a plans d'ocupació (${formatCurrency(companyPension)}) superior al sostre de 8.500 €`,
      message: `L'increment del límit per aportacions empresarials a plans de pensions d'ocupació té un sostre de 8.500 € anuals.`,
      legalReference: 'Art. 51.1.2n Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: false,
    });
  }

  // 1.3 Retenció del Treball Anormalment Baixa (< 2%)
  const employers = work.employers || [];
  for (const emp of employers) {
    if ((emp.grossSalary || 0) > 15000 && ((emp.withholdings || 0) / emp.grossSalary) < 0.02) {
      issues.push({
        id: `work-low-retention-${emp.id}`,
        module: 'general',
        severity: 'warning',
        title: `Tipus de retenció molt baix a l'empresa ${emp.name || 'Ocupador'} (< 2%)`,
        message: `El percentatge de retenció és inferior al 2% sobre un salari brut de ${formatCurrency(emp.grossSalary)}. Això provocarà una quota diferencial a pagar elevada a la declaració.`,
        legalReference: 'Art. 80 a 88 del Reglament de l\'IRPF (RD 439/2007)',
        autoFixable: false,
      });
    }
  }

  // 1.4 Obligació de Declarar per Pluralitat de Pagadors (Límit 1.500 € del segon pagador / Art. 96.2 LIRPF)
  if (employers.length > 1) {
    const sorted = [...employers].sort((a, b) => (b.grossSalary || 0) - (a.grossSalary || 0));
    const secondaryTotal = sorted.slice(1).reduce((s, e) => s + (e.grossSalary || 0), 0);
    const totalGross = employers.reduce((s, e) => s + (e.grossSalary || 0), 0);
    if (secondaryTotal > 1500 && totalGross > 15000) {
      issues.push({
        id: 'work-multiple-employers-mandatory',
        module: 'general',
        severity: 'info',
        title: `Obligació de presentar Declaració de Renda per 2 o més pagadors`,
        message: `Has percebut ${formatCurrency(secondaryTotal)} del segon i posteriors pagadors (superant el límit de 1.500 €). El llindar exempt baixa de 22.000 € a 15.000 € anuals.`,
        legalReference: 'Art. 96.2 Llei de l\'IRPF (Llei 35/2006)',
        autoFixable: false,
      });
    }
  }

  // 1.5 Exempció 7.p per Treballs a l'Estranger (> 60.100 €)
  if ((work.foreignWorkExemption7p || 0) > 60100) {
    issues.push({
      id: 'work-7p-exemption-limit-exceeded',
      module: 'general',
      severity: 'critical',
      title: `Exempció 7.p per feina a l'estranger (${formatCurrency(work.foreignWorkExemption7p || 0)}) superior al màxim de 60.100 €`,
      message: `El límit màxim exempt per rendiments de treballs efectivament realitzats a l'estranger és de 60.100 € anuals. L'excés ha de tributar com a rendiment del treball ordinari.`,
      legalReference: 'Art. 7.p de la Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: true,
      autoFixLabel: 'Ajustar exempció al màxim de 60.100 €',
      autoFixKey: 'fix_cap_7p_exemption',
    });
  }

  // 1.6 Despeses Deduïbles Incrementades per Treballadors Actius amb Discapacitat (Art. 19.2.f LIRPF)
  if (personal.disability >= 33 && employers.length > 0 && (work.otherDeductible || 0) < 3500) {
    issues.push({
      id: 'work-disabled-deduction-missing',
      module: 'general',
      severity: 'info',
      title: `Despesa deduïble incrementada per treballador actiu amb discapacitat no aplicada`,
      message: `Com a treballador actiu amb un grau de discapacitat del ${personal.disability}%, tens dret a deduir 3.500 € addicionals (o 7.750 € si necessites ajuda de tercers) en concepte de despeses de treball.`,
      legalReference: 'Art. 19.2.f de la Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: true,
      autoFixLabel: 'Aplicar despesa deduïble de 3.500 € a rendiments del treball',
      autoFixKey: 'fix_apply_disabled_worker_deduction',
    });
  }

  // 1.7 Sostre Legal de Despeses de Quotes a Col·legis Professionals (500 € / Art. 19.2.d LIRPF)
  if ((work.unionFees || 0) > 500) {
    issues.push({
      id: 'work-union-fees-limit-exceeded',
      module: 'general',
      severity: 'info',
      title: `Quotes a col·legis professionals (${formatCurrency(work.unionFees)}) per sobre del límit de 500 €`,
      message: `Les quotes satisfetes a col·legis professionals són deduïbles fins a un màxim legal de 500 € anuals quan la col·legiació sigui obligatòria per exercir la feina.`,
      legalReference: 'Art. 19.2.d Llei de l\'IRPF i Art. 10 del RIRPF',
      autoFixable: false,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 2: RENDIMENTS DEL CAPITAL MOBILIARI I INTERNACIONAL (ARTS. 25, 26, 80 LIRPF)
  // ═══════════════════════════════════════════════════════════════════════════

  // 2.1 Deducció per Doble Imposició Internacional en Dividends Estrangers (Casella 0588)
  if (cap.foreignDividends > 0 && cap.foreignTaxWithheld > 0) {
    issues.push({
      id: 'cap-foreign-tax-credit-available',
      module: 'general',
      severity: 'info',
      title: `Dividends internacionals (${formatCurrency(cap.foreignDividends)}): deducció per doble imposició a la Casella 0588`,
      message: `Has suportat ${formatCurrency(cap.foreignTaxWithheld)} de retenció en origen (W-8BEN als EUA o similar). S'ha d'aplicar la deducció per doble imposició internacional per recuperar la retenció exterior.`,
      legalReference: 'Art. 80 de la Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: false,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 3: RENDIMENTS DEL CAPITAL IMMOBILIARI (ARTS. 22-24, 85 LIRPF)
  // ═══════════════════════════════════════════════════════════════════════════

  // 3.1 Manca de NIF de Llogater en Habitatge Habitual (Preceptiu per a la Casella 0065)
  const habitualWithoutTenant = properties.filter(
    p => p.usageType === 'habitual' && p.grossRentalIncome > 0 && (!p.tenantNIFs || p.tenantNIFs.length === 0 || p.tenantNIFs.some(n => !n.trim()))
  );
  if (habitualWithoutTenant.length > 0) {
    issues.push({
      id: 'prop-habitual-missing-tenant-nif',
      module: 'properties',
      severity: 'critical',
      title: 'Falta el NIF del llogater a l\'arrendament d\'habitatge habitual',
      message: `L'AEAT requereix obligatòriament el NIF/NIE del llogater a la Casella 0065 per poder aplicar la reducció per arrendament d'habitatge.`,
      legalReference: 'Art. 23.2 Llei de l\'IRPF i Llei 12/2023 pel Dret a l\'Habitatge',
      autoFixable: false,
    });
  }

  // 3.2 Incongruència del Valor Cadastral de la Construcció (Construcció > Total)
  for (const p of properties) {
    if (p.constructionCadastralValue > 0 && p.totalCadastralValue > 0 && p.constructionCadastralValue > p.totalCadastralValue) {
      issues.push({
        id: `prop-invalid-construction-val-${p.id}`,
        module: 'properties',
        severity: 'critical',
        title: `Valor cadastral de la construcció superior al total a ${p.name || 'Immoble'}`,
        message: `El valor de la construcció (${formatCurrency(p.constructionCadastralValue)}) no pot ser superior al valor cadastral total (${formatCurrency(p.totalCadastralValue)}). Cal corregir el valor del rebut de l'IBI.`,
        legalReference: 'Art. 23.1.b Llei de l\'IRPF i Art. 14 del RIRPF',
        autoFixable: false,
      });
    }

    // 3.3 Manca de Cost d'Adquisició o Valor Cadastral per a l'Amortització del 3%
    if (p.grossRentalIncome > 0 && (!p.acquisitionCost || p.acquisitionCost === 0) && (!p.totalCadastralValue || p.totalCadastralValue === 0)) {
      issues.push({
        id: `prop-missing-amort-base-${p.id}`,
        module: 'properties',
        severity: 'warning',
        title: `Falta el valor d'adquisició o cadastral a ${p.name || 'Immoble'}`,
        message: `Per deduir l'amortització del 3% de l'immoble arrendat (Caselles 0079 a 0083), és obligatori informar el cost d'adquisició o el valor cadastral.`,
        legalReference: 'Art. 23.1.b Llei de l\'IRPF (Llei 35/2006)',
        autoFixable: false,
      });
    }
  }

  // 3.4 Excedent de Despeses de Reparació i Finançament (Bossa de 4 Anys / Art. 23.1.a LIRPF)
  for (const p of properties) {
    if (p.grossRentalIncome > 0) {
      const limitedExp = (p.mortgageInterests || 0) + (p.repairExpenses || 0);
      if (limitedExp > p.grossRentalIncome) {
        const excess = limitedExp - p.grossRentalIncome;
        issues.push({
          id: `prop-excess-repairs-${p.id}`,
          module: 'properties',
          severity: 'info',
          title: `Excedent de despeses de reparació a ${p.name || 'Immoble'} (${formatCurrency(excess)})`,
          message: `Les despeses de finançament i conservació superen els ingressos íntegres. L'excedent no es perd, es compensarà durant els 4 exercicis següents.`,
          legalReference: 'Art. 23.1.a Llei de l\'IRPF (Llei 35/2006)',
          autoFixable: false,
        });
      }
    }
  }

  // 3.5 Imputació de Rendes Immobiliàries en Immobles Buits o d'Ús Propi (Casella 0089 / Art. 85 LIRPF)
  const vacantProperties = properties.filter(p => p.grossRentalIncome === 0 && p.usageType !== 'habitual');
  if (vacantProperties.length > 0) {
    issues.push({
      id: 'prop-vacant-imputation-required',
      module: 'properties',
      severity: 'info',
      title: `${vacantProperties.length} immoble/s buit/s o a disposició amb imputació de rendes (Casella 0089)`,
      message: `Els immobles urbans que no constitueixen habitatge habitual ni estan llogats generen una imputació de rendes de l'1,1% (cadastre revisat) o 2% del valor cadastral.`,
      legalReference: 'Art. 85 Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: false,
    });
  }

  // 3.6 Retencions d'Arrendaments Comercials (Models 115/180) vs Casella 0598
  const commercialPropsWithhold = properties.filter(p => p.usageType === 'commercial' && (p.grossRentalIncome || 0) > 0);
  if (commercialPropsWithhold.length > 0) {
    const totalCommercialRent = commercialPropsWithhold.reduce((s, p) => s + (p.grossRentalIncome || 0), 0);
    const expected19Withholding = totalCommercialRent * 0.19;
    const currentWithholding = data.capitalIncome?.realEstateWithholdings || 0;

    if (Math.abs(expected19Withholding - currentWithholding) > 1.0) {
      issues.push({
        id: 'prop-commercial-withholdings-mismatch',
        module: 'properties',
        severity: 'warning',
        title: 'Retencions de Lloguer Comercial (Model 180) no imputades a la Renda',
        message: `Tens ${commercialPropsWithhold.length} immoble/s comercial/s amb ingressos de ${formatCurrency(totalCommercialRent)}. Els llogaters estan obligats a ingressar ${formatCurrency(expected19Withholding)} al Model 115/180. Aquest import ha de constar a la Casella 0598 per a minorar el teu IRPF.`,
        legalReference: 'Art. 75.2.a i Art. 100 del Reglament de l\'IRPF (RD 439/2007)',
        autoFixable: true,
        autoFixLabel: `Imputar ${formatCurrency(expected19Withholding)} a la Casella 0598`,
        autoFixKey: 'fix_sync_commercial_withholdings_180',
      });
    }
  }

  // 3.7 Validació de Format de Referència Cadastral (20 caràcters / Llei del Cadastre)
  const invalidCadastreProps = properties.filter(p => p.cadastralReference && !isValidCadastralReference(p.cadastralReference));
  if (invalidCadastreProps.length > 0) {
    issues.push({
      id: 'prop-invalid-cadastral-reference',
      module: 'properties',
      severity: 'warning',
      title: `${invalidCadastreProps.length} immoble/s amb referència cadastral de format no reglamentari`,
      message: `Les referències cadastrals com ${invalidCadastreProps.slice(0, 2).map(p => p.cadastralReference).join(', ')} no tenen l'estructura oficial de 20 caràcters alfanumèrics requerida per la seu electrònica de l'AEAT.`,
      legalReference: 'Reial Decret Legislatiu 1/2004 (Text Refós de la Llei del Cadastre Immobiliari)',
      autoFixable: false,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 4: ACTIVITATS ECONÒMIQUES & AUTÒNOMS (ARTS. 27-32 LIRPF)
  // ═══════════════════════════════════════════════════════════════════════════

  // 4.1 Desquadre d'Ingressos Facturats vs Ingressos IRPF
  const actIssuedBase = (iva.issuedInvoices || [])
    .filter(i => i.category === 'activity_service' || i.category === 'activity_goods')
    .reduce((s, i) => s + (i.taxableBase || 0), 0);

  if (act.income > 0 && actIssuedBase > 0 && Math.abs(act.income - actIssuedBase) > 1.0) {
    issues.push({
      id: 'cross-income-mismatch',
      module: 'activities',
      severity: 'warning',
      title: 'Incongruència d\'Ingressos entre IRPF i Llibre d\'IVA',
      message: `Els ingressos declarats a l'IRPF (${formatCurrency(act.income)}) no coincideixen amb la base facturada al llibre d'IVA (${formatCurrency(actIssuedBase)}). Discrepància: ${formatCurrency(Math.abs(act.income - actIssuedBase))}.`,
      legalReference: 'Criteris de Creuament d\'Inspecció AEAT (IRPF vs Model 303/390)',
      autoFixable: true,
      autoFixLabel: 'Sincronitzar Ingressos IRPF ↔ IVA',
      autoFixKey: 'fix_sync_activities_iva',
    });
  }

  // 4.2 Despeses d'activitat sense factures al llibre d'IVA
  if (act.expenses > 0 && (iva.receivedInvoices || []).length === 0) {
    issues.push({
      id: 'cross-expenses-missing-invoices',
      module: 'activities',
      severity: 'warning',
      title: 'Despeses d\'IRPF declarades sense factures al Llibre d\'IVA',
      message: `Has declarat ${formatCurrency(act.expenses)} en despeses d'autònom però el Llibre de Factures Rebudes d'IVA està buit. No estàs deduint l'IVA suportat corresponent.`,
      legalReference: 'Ordre HAC/773/2019 de Llibres Registre Oficials',
      autoFixable: true,
      autoFixLabel: 'Generar factures de despesa al Llibre d\'IVA',
      autoFixKey: 'fix_sync_activities_iva',
    });
  }

  // 4.3 Quota de Seguretat Social d'Autònoms (RETA) Buida
  if (act.income > 3000 && (!act.socialSecuritySelfEmployed || act.socialSecuritySelfEmployed === 0)) {
    issues.push({
      id: 'act-missing-reta',
      module: 'activities',
      severity: 'warning',
      title: 'Quota de Seguretat Social d\'Autònoms (RETA) no informada',
      message: `Has declarat ${formatCurrency(act.income)} d'ingressos d'autònom però 0 € de quotes a la Seguretat Social. Aquesta despesa és 100% deduïble en l'IRPF.`,
      legalReference: 'Art. 30.2.1a Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: true,
      autoFixLabel: 'Aplicar quota estàndard RETA (3.600 € / any)',
      autoFixKey: 'fix_set_reta_standard',
    });
  }

  // 4.4 Límit de Despeses de Difícil Justificació (2.000 € màxim)
  if (act.estimationType === 'direct_simplified' && act.income > act.expenses) {
    const netBefore = act.income - act.expenses - (act.socialSecuritySelfEmployed || 0);
    const calculated5pct = netBefore * 0.05;
    if (calculated5pct > 2000) {
      issues.push({
        id: 'act-diff-expenses-capped',
        module: 'activities',
        severity: 'info',
        title: 'Límit legal de Despeses de Difícil Justificació aplicat (2.000 €)',
        message: `El 5% del rendiment net (${formatCurrency(calculated5pct)}) supera el sostre legal de 2.000 € anuals. S'ha aplicat el límit màxim permès.`,
        legalReference: 'Art. 30.2 del Reglament de l\'IRPF (RD 439/2007)',
        autoFixable: false,
      });
    }
  }

  // 4.5 Despeses de Manutenció i Restauració d'Autònoms (> 26,67 € / dia)
  const excessiveMeals = (iva.receivedInvoices || []).filter(i => {
    const c = (i.concept || '').toLowerCase();
    const isMeal = c.includes('restaurant') || c.includes('dinar') || c.includes('menjar') || c.includes('manutencio');
    return isMeal && (i.totalInvoice || 0) > 26.67;
  });
  if (excessiveMeals.length > 0) {
    issues.push({
      id: 'act-meals-daily-limit',
      module: 'activities',
      severity: 'info',
      title: `${excessiveMeals.length} despesa/es de restauració superiors al límit diari legal (26,67 €)`,
      message: `La llei limita la deducció de despeses de manutenció a 26,67 €/dia a territori espanyol pagades per via electrònica. L'excés no és deduïble sense justificant de pernocta o desplaçament.`,
      legalReference: 'Art. 30.5.c Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: false,
    });
  }

  // 4.6 Obligació de Pagaments Fraccionats (Model 130 vs Regla del 70% de Retenció)
  if (act.income > 0) {
    const withhRatio = (act.withholdings || 0) / act.income;
    if (withhRatio >= 0.70) {
      issues.push({
        id: 'act-model-130-exempt',
        module: 'activities',
        severity: 'info',
        title: `Exempció de presentació del Model 130 (${(withhRatio * 100).toFixed(0)}% retenció)`,
        message: `Més del 70% dels ingressos han estat sotmesos a retenció d'IRPF. Estàs legalment exempt de presentar els pagaments fraccionats trimestrals del Model 130.`,
        legalReference: 'Art. 109 del Reglament de l\'IRPF (RD 439/2007)',
        autoFixable: false,
      });
    } else if (act.withholdings === 0 && act.income > 5000) {
      issues.push({
        id: 'act-model-130-mandatory',
        module: 'activities',
        severity: 'warning',
        title: `Obligació de presentar el Model 130 trimestral (sense retencions a compte)`,
        message: `Com que menys del 70% dels teus ingressos tenen retenció d'IRPF, estàs obligat a ingressar trimestralment el 20% del rendiment net mitjançant el Model 130.`,
        legalReference: 'Art. 109 i 110 del Reglament de l\'IRPF (RD 439/2007)',
        autoFixable: false,
      });
    }
  }

  // 4.7 Desacoblament de Vehicles: IVA (50%) vs IRPF (0%) (Art. 95 LIVA vs Art. 22 RIRPF)
  const vehicleInvoices = (iva.receivedInvoices || []).filter(i => {
    const c = (i.concept || '').toLowerCase();
    return c.includes('combustible') || c.includes('benzina') || c.includes('gasoil') || c.includes('peatge') || c.includes('reparacio vehicle') || c.includes('renting vehicle') || c.includes('assegurança vehicle');
  });

  if (vehicleInvoices.length > 0 && !isExclusiveVehicleActivity(act.iae)) {
    const totalVehicleExpense = vehicleInvoices.reduce((s, i) => s + (i.totalInvoice || 0), 0);
    issues.push({
      id: 'act-vehicle-decoupling-alert',
      module: 'activities',
      severity: 'info',
      title: 'Desacoblament de despeses de vehicle aplicat (IVA 50% vs IRPF 0%)',
      message: `S'han detectat ${vehicleInvoices.length} despesa/es de vehicle (${formatCurrency(totalVehicleExpense)}). Per l'epígraf IAE declarat, l'IVA suportat es dedueix al 50% (Art. 95 LIVA) però la despesa a l'IRPF és del 0% per no ser un vehicle d'ús 100% exclusiu (Art. 22 RIRPF), evitant sancions de l'Art. 191 LGT.`,
      legalReference: 'Art. 95.Tres Llei de l\'IVA vs Art. 22 Reglament de l\'IRPF',
      autoFixable: false,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 5: GUANYS PATRIMONIALS & REGLA DELS 2 MESOS (ARTS. 33 A 49 LIRPF)
  // ═══════════════════════════════════════════════════════════════════════════

  // 5.1 Venda d'Habitatge Habitual per Majors de 65 Anys (100% Exempta)
  if (personal.age >= 65) {
    const homeGain = (gains.items || []).find(g => g.type === 'real_estate' && g.description?.toLowerCase().includes('habitual'));
    if (homeGain) {
      issues.push({
        id: 'gains-senior-65-exempt-home',
        module: 'general',
        severity: 'info',
        title: `Exempció total per transmissió d'habitatge habitual en majors de 65 anys`,
        message: `Com que el contribuent té $\ge 65$ anys, el guany patrimonial derivat de la venda del seu habitatge habitual està 100% exempt d'IRPF per llei.`,
        legalReference: 'Art. 33.4.b de la Llei de l\'IRPF (Llei 35/2006)',
        autoFixable: false,
      });
    }
  }

  // 5.2 Regla Antiaplicació de Pèrdues Patrimonials en Valors Homogenis (Regla dels 2 mesos / Art. 33.5.f LIRPF)
  const suspendedLosses = (gains.items || []).filter(g => g.isNonComputableLoss && (g.nonComputableLossAmount || 0) > 0);
  if (suspendedLosses.length > 0) {
    const totalSuspended = suspendedLosses.reduce((s, g) => s + (g.nonComputableLossAmount || 0), 0);
    issues.push({
      id: 'gains-suspended-losses-2months',
      module: 'general',
      severity: 'info',
      title: `Pèrdues suspeses per recompra de valors homogenis (${formatCurrency(totalSuspended)})`,
      message: `En aplicació de la regla dels 2 mesos (Art. 33.5.f LIRPF), les pèrdues de valors recomprats queden suspeses i no es poden compensar fins a la transmissió definitiva.`,
      legalReference: 'Art. 33.5.f de la Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: false,
    });
  }

  // 5.3 Validació de Prescripció de la Bossa de Pèrdues de 4 Anys (Art. 49 LIRPF & Art. 66 LGT)
  const lossCarryovers = data.lossCarryovers;
  if (lossCarryovers) {
    const expiredLosses: number[] = [];
    [
      ...(lossCarryovers.pendingGeneralLosses || []),
      ...(lossCarryovers.pendingMobiliaryLosses || []),
      ...(lossCarryovers.pendingCapitalLosses || [])
    ].forEach(item => {
      if (item.year && (year - item.year) > 4 && item.amount > 0) {
        expiredLosses.push(item.year);
      }
    });

    if (expiredLosses.length > 0) {
      issues.push({
        id: 'gains-loss-carryover-expired',
        module: 'general',
        severity: 'critical',
        title: 'Pèrdues patrimonials pendents prescrites (> 4 exercicis anteriors)',
        message: `S'han detectat pèrdues registrades d'exercicis anteriors al ${year - 4} (anys ${Array.from(new Set(expiredLosses)).join(', ')}). L'Art. 49 LIRPF limita estrictament la compensació als 4 exercicis immediatament posteriors. Les pèrdues anteriors estan caducades i prescrites.`,
        legalReference: 'Art. 49 Llei de l\'IRPF i Art. 66 de la Llei General Tributària (LGT)',
        autoFixable: false,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 6: MÍNIMS PERSONALS, FAMILIARS I DISCAPACITAT (ARTS. 56-61 LIRPF)
  // ═══════════════════════════════════════════════════════════════════════════

  // 6.1 Mínim per Discapacitat del Contribuent no Informat
  if (personal.disability >= 33) {
    const minAmount = personal.disability >= 65 ? 9000 : 3000;
    issues.push({
      id: 'personal-disability-minimum-applied',
      module: 'general',
      severity: 'info',
      title: `Mínim per discapacitat del contribuent (${formatCurrency(minAmount)}) aplicat correctament`,
      message: `Per tenir un grau de discapacitat reconegut del ${personal.disability}%, el teu mínim personal s'incrementa en ${formatCurrency(minAmount)} anuals.`,
      legalReference: 'Art. 60 de la Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: false,
    });
  }

  // 6.2 Verificació de Descendents i Ascendents amb Discapacitat
  const disabledDescendants = (personal.descendants || []).filter(d => d.disability >= 33);
  if (disabledDescendants.length > 0) {
    issues.push({
      id: 'personal-descendant-disability-applied',
      module: 'general',
      severity: 'info',
      title: `${disabledDescendants.length} descendent(s) amb dret al mínim per discapacitat familiar`,
      message: `S'aplica el mínim addicional per discapacitat de descendents (3.000 € per $\ge 33\%$ o 9.000 € per $\ge 65\%$).`,
      legalReference: 'Art. 60.2 de la Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: false,
    });
  }

  // 6.3 Incompatibilitat d'Edat en Descendents (> 25 anys sense discapacitat >= 33%)
  const ineligibleDescendants = (personal.descendants || []).filter(d => d.age > 25 && (d.disability || 0) < 33);
  if (ineligibleDescendants.length > 0) {
    issues.push({
      id: 'personal-descendant-age-ineligible',
      module: 'general',
      severity: 'critical',
      title: `${ineligibleDescendants.length} descendent(s) major(s) de 25 anys sense dret al mínim familiar`,
      message: `Segons l'Art. 58 LIRPF, els fills majors de 25 anys no donen dret al mínim per descendents llevat que tinguin un grau de discapacitat reconegut >= 33%.`,
      legalReference: 'Art. 58 de la Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: false,
    });
  }

  // 6.4 Incompatibilitat d'Edat en Ascendents (< 65 anys sense discapacitat >= 33%)
  const ineligibleAscendants = (personal.ascendants || []).filter(a => a.age < 65 && (a.disability || 0) < 33);
  if (ineligibleAscendants.length > 0) {
    issues.push({
      id: 'personal-ascendant-age-ineligible',
      module: 'general',
      severity: 'critical',
      title: `${ineligibleAscendants.length} ascendent(s) menor(s) de 65 anys sense dret al mínim familiar`,
      message: `Segons l'Art. 59 LIRPF, els pares o avis han de tenir 65 anys o més o un grau de discapacitat >= 33% per donar dret al mínim per ascendents.`,
      legalReference: 'Art. 59 de la Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: false,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 7: DEDUCCIONS ESTATALS I AUTONÒMIQUES DE CATALUNYA (LLEI 31/2002)
  // ═══════════════════════════════════════════════════════════════════════════

  // 7.1 Límit Màxim Legal de Deducció per Inversió en Habitatge Habitual (9.040 € / Art. 68.1 LIRPF)
  if (deductions.housingDeduction && deductions.housingAmountsPaid > 9040) {
    issues.push({
      id: 'ded-housing-excess-cap',
      module: 'general',
      severity: 'warning',
      title: `Base de deducció per habitatge habitual superior al límit legal (${formatCurrency(deductions.housingAmountsPaid)})`,
      message: `La base màxima de deducció per habitatge habitual (règim transitori pre-2013) és de 9.040 € anuals per declaració. L'excés de ${formatCurrency(deductions.housingAmountsPaid - 9040)} no genera dret a deducció.`,
      legalReference: 'Art. 68.1 i Disposició Transitòria 18a de la Llei de l\'IRPF',
      autoFixable: true,
      autoFixLabel: 'Ajustar la base d\'habitatge al màxim de 9.040 €',
      autoFixKey: 'fix_cap_housing_deduction',
    });
  }

  // 7.2 Deducció de Lloguer a Catalunya per a Majors de 32 anys sense Circumstància Especial
  if (deductions.catalanRentalDeduction && personal.age > 32 && deductions.catalanRentalSituation === 'none') {
    issues.push({
      id: 'ded-catalan-rental-age-ineligible',
      module: 'general',
      severity: 'critical',
      title: 'Incompatibilitat d\'edat en la deducció de lloguer a Catalunya (> 32 anys)',
      message: `Per aplicar la deducció del 10% per lloguer a Catalunya, cal tenir 32 anys o menys a data 31/12, llevat que es trobi en situació d'atur >= 183 dies, discapacitat >= 65% o família nombrosa.`,
      legalReference: 'Art. 1 de la Llei 31/2002 de la Comunitat Autònoma de Catalunya',
      autoFixable: true,
      autoFixLabel: 'Desactivar deducció de lloguer autonòmica no aplicable',
      autoFixKey: 'fix_disable_catalan_rental_deduction',
    });
  }

  // 7.2.b Deducció de Lloguer a Catalunya: Límit de Renda (20.000 € individual / 30.000 € conjunta / Llei 31/2002)
  if (deductions.catalanRentalDeduction && data.workIncome) {
    const totalGrossIncome = (data.workIncome.employers || []).reduce((s, e) => s + e.grossSalary, 0) + (data.activities?.income || 0);
    const isJoint = personal.taxDeclarationType === 'joint';
    const incomeCap = isJoint ? 30000 : 20000;
    if (totalGrossIncome > incomeCap) {
      issues.push({
        id: 'ded-catalan-rental-income-cap-exceeded',
        module: 'general',
        severity: 'critical',
        title: `Límit de renda superat per a la deducció de lloguer a Catalunya (>${formatCurrency(incomeCap)})`,
        message: `La Llei 31/2002 exigeix que la base imposable total no superi els 20.000 € en tributació individual o 30.000 € en tributació conjunta. Els teus ingressos superen el llindar màxim permès.`,
        legalReference: 'Art. 1.2 de la Llei 31/2002 de la Comunitat Autònoma de Catalunya',
        autoFixable: true,
        autoFixLabel: 'Desactivar deducció de lloguer per superar límit de renda',
        autoFixKey: 'fix_disable_catalan_rental_deduction',
      });
    }
  }

  // 7.3 Deducció per Maternitat (1.200 € / Art. 81 LIRPF)
  if (deductions.maternityDeduction && (personal.descendants || []).every(d => d.age >= 3)) {
    issues.push({
      id: 'ded-maternity-age-exceeded',
      module: 'general',
      severity: 'critical',
      title: 'Deducció per maternitat no aplicable: no hi ha fills menors de 3 anys',
      message: `La deducció per maternitat de 1.200 € anuals només s'aplica a mares amb fills menors de 3 anys amb dret al mínim per descendents.`,
      legalReference: 'Art. 81 de la Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: true,
      autoFixLabel: 'Desactivar deducció per maternitat',
      autoFixKey: 'fix_disable_maternity_deduction',
    });
  }

  // 7.4 Límit Legal a Plans de Pensions (1.500 € individual / 8.500 € empresa / 10.000 € conjunt / Art. 52 LIRPF)
  const pensionInd = deductions.pensionPlanContributions || 0;
  const pensionEmp = deductions.companyPensionContributions || 0;
  if (pensionInd > 1500) {
    issues.push({
      id: 'ded-pension-individual-cap',
      module: 'general',
      severity: 'warning',
      title: `Aportació a pla de pensions individual (${formatCurrency(pensionInd)}) supera el límit d'1.500 €`,
      message: `El límit màxim d'aportació individual amb dret a reducció a la base imposable és d'1.500 € anuals.`,
      legalReference: 'Art. 52 de la Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: true,
      autoFixLabel: 'Ajustar pla individual a 1.500 €',
      autoFixKey: 'fix_cap_pension_individual',
    });
  }
  if (pensionEmp > 8500) {
    issues.push({
      id: 'ded-pension-company-cap',
      module: 'general',
      severity: 'warning',
      title: `Aportació empresarial a pla d'ocupació (${formatCurrency(pensionEmp)}) supera el límit de 8.500 €`,
      message: `El límit legal d'aportació empresarial és de 8.500 € anuals.`,
      legalReference: 'Art. 52 de la Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: true,
      autoFixLabel: 'Ajustar pla d\'empresa a 8.500 €',
      autoFixKey: 'fix_cap_pension_company',
    });
  }
  if (pensionInd + pensionEmp > 10000) {
    issues.push({
      id: 'ded-pension-total-cap',
      module: 'general',
      severity: 'critical',
      title: `Aportació conjunta a plans de pensions (${formatCurrency(pensionInd + pensionEmp)}) supera el límit global de 10.000 €`,
      message: `El sostre màxim absolut de reducció conjunta per plans individuals i d'empresa és de 10.000 € anuals.`,
      legalReference: 'Art. 52 de la Llei de l\'IRPF (Llei 35/2006)',
      autoFixable: true,
      autoFixLabel: 'Ajustar el total de plans a 10.000 €',
      autoFixKey: 'fix_cap_pension_total',
    });
  }

  // 7.5 Deducció per Eficiència Energètica (RD-Llei 19/2021)
  if (deductions.energyEfficiencyType && deductions.energyEfficiencyType !== 'none' && (deductions.energyEfficiencyAmount || 0) > 7500) {
    issues.push({
      id: 'ded-energy-efficiency-excess-cap',
      module: 'general',
      severity: 'warning',
      title: `Base d'eficiència energètica (${formatCurrency(deductions.energyEfficiencyAmount || 0)}) supera el límit legal màxim`,
      message: `La base màxima de deducció és de 5.000 € (modalitat 1 i 3) o 7.500 € (modalitat 2 amb reducció del 30% d'energia no renovable).`,
      legalReference: 'Disposició Addicional 50a LIRPF (RD-Llei 19/2021)',
      autoFixable: true,
      autoFixLabel: 'Ajustar la base d\'eficiència energètica a 7.500 €',
      autoFixKey: 'fix_cap_energy_deduction',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 8: COMPROVACIONS D'IVA & LLIBRES REGISTRE (LLEI 37/1992 & RD 1619/2012)
  // ═══════════════════════════════════════════════════════════════════════════

  // 8.1 Detecció de Factures Duplicades
  const issuedKeys = new Set<string>();
  const duplicateIssued: string[] = [];
  for (const inv of iva.issuedInvoices || []) {
    if (inv.invoiceNumber && inv.clientNif) {
      const key = `${inv.invoiceNumber}_${inv.clientNif}`;
      if (issuedKeys.has(key)) duplicateIssued.push(inv.invoiceNumber);
      else issuedKeys.add(key);
    }
  }
  if (duplicateIssued.length > 0) {
    issues.push({
      id: 'iva-duplicate-issued-invoices',
      module: 'iva',
      severity: 'critical',
      title: `${duplicateIssued.length} factura/es expedida/es amb numeració duplicada`,
      message: `S'ha detectat el mateix número de factura (${duplicateIssued.slice(0, 3).join(', ')}) per al mateix client. El reglament de facturació prohibeix numeracions duplicades.`,
      legalReference: 'Art. 6.1.a del Reglament de Facturació (RD 1619/2012)',
      autoFixable: false,
    });
  }

  // 8.2 Validació de NIF/CIF buits en factures emeses i rebudes
  const issuedWithoutNif = (iva.issuedInvoices || []).filter(i => !i.clientNif || i.clientNif.trim() === '');
  if (issuedWithoutNif.length > 0) {
    issues.push({
      id: 'iva-missing-client-nif',
      module: 'iva',
      severity: 'critical',
      title: `${issuedWithoutNif.length} factura/es emesa/es sense NIF/CIF de client`,
      message: `L'Agència Tributària rebutja les factures ordinàries sense NIF de client en una inspecció.`,
      legalReference: 'Art. 6 del Reglament de Facturació (RD 1619/2012)',
      autoFixable: false,
    });
  }

  const receivedWithoutNif = (iva.receivedInvoices || []).filter(i => !i.supplierNif || i.supplierNif.trim() === '');
  if (receivedWithoutNif.length > 0) {
    issues.push({
      id: 'iva-missing-supplier-nif',
      module: 'iva',
      severity: 'critical',
      title: `${receivedWithoutNif.length} factura/es rebuda/es sense NIF/CIF de proveïdor`,
      message: `No es pot deduir l'IVA suportat de factures que no continguin el NIF complet del proveïdor.`,
      legalReference: 'Art. 97.Un Llei de l\'IVA (Llei 37/1992)',
      autoFixable: false,
    });
  }

  // 8.3 Validació d'Algorisme i Format de NIF / NIE / CIF
  const invalidFormatNifs: string[] = [];
  (iva.issuedInvoices || []).forEach(i => {
    if (i.clientNif && i.category !== 'intra_eu_delivery' && !isValidSpanishTaxId(i.clientNif)) {
      invalidFormatNifs.push(i.clientNif);
    }
  });
  (iva.receivedInvoices || []).forEach(i => {
    if (i.supplierNif && i.category !== 'intra_eu_acquisition' && !isValidSpanishTaxId(i.supplierNif)) {
      invalidFormatNifs.push(i.supplierNif);
    }
  });
  if (invalidFormatNifs.length > 0) {
    issues.push({
      id: 'iva-invalid-taxpayer-id-format',
      module: 'iva',
      severity: 'warning',
      title: `${invalidFormatNifs.length} NIF/CIF amb format o dígit de control invàlid`,
      message: `Identificadors fiscals com ${invalidFormatNifs.slice(0, 3).join(', ')} no superen l'algorisme oficial de control de l'AEAT i causaran rebuig en la presentació telemàtica.`,
      legalReference: 'Art. 18 del RGAT i Ordre EHA/451/2008 de l\'AEAT',
      autoFixable: false,
    });
  }

  // 8.4 Correlació Cronològica de Factures Emeses
  const issuedList = [...(iva.issuedInvoices || [])];
  const sortedByNumber = [...issuedList].sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true }));
  let chronoIssueFound = false;
  let chronoDetails = '';
  for (let i = 1; i < sortedByNumber.length; i++) {
    const prev = sortedByNumber[i - 1];
    const curr = sortedByNumber[i];
    if ((prev.series || '') === (curr.series || '') && prev.date && curr.date && curr.date < prev.date) {
      chronoIssueFound = true;
      chronoDetails = `La factura ${curr.invoiceNumber} (${curr.date}) té data anterior a ${prev.invoiceNumber} (${prev.date}).`;
      break;
    }
  }
  if (chronoIssueFound) {
    issues.push({
      id: 'iva-chronology-inconsistency',
      module: 'iva',
      severity: 'critical',
      title: 'Incongruència cronològica en la correlació de factures emeses',
      message: `${chronoDetails} L'AEAT exigeix que les factures de la mateixa sèrie tinguin dates correlatives en consonància amb el número.`,
      legalReference: 'Art. 6.1.b del Reglament de Facturació (RD 1619/2012)',
      autoFixable: false,
    });
  }

  // 8.5 Validació de Prefix VIES en Operacions Intracomunitàries
  const intraEuWithoutVies = [...(iva.issuedInvoices || []), ...(iva.receivedInvoices || [])].filter(i => {
    const isIntra = i.category === 'intra_eu_delivery' || i.category === 'intra_eu_acquisition';
    if (!isIntra) return false;
    const nif = ('clientNif' in i ? i.clientNif : (i as any).supplierNif) || '';
    const prefix = nif.trim().substring(0, 2).toUpperCase();
    return !EU_COUNTRY_CODES.has(prefix);
  });
  if (intraEuWithoutVies.length > 0) {
    issues.push({
      id: 'iva-intra-eu-vies-prefix',
      module: 'iva',
      severity: 'warning',
      title: `${intraEuWithoutVies.length} operació/ns intracomunitària/es sense prefix NIF-IVA de la UE`,
      message: `Les operacions intracomunitàries al Model 349 requereixen que el NIF comenci pel codi de 2 lletres de l'estat membre (ex: FR, DE, IT, PT, NL).`,
      legalReference: 'Art. 25 i Art. 79 Llei de l\'IVA (Cens VIES / Model 349)',
      autoFixable: false,
    });
  }

  // 8.6 Factures Rectificatives sense Sèrie Específica
  const rectWithoutSeries = (iva.issuedInvoices || []).filter(i => {
    const isNeg = (i.taxableBase || 0) < 0;
    const isRect = i.isRectification || isNeg;
    if (!isRect) return false;
    const s = (i.series || '').toUpperCase();
    const num = (i.invoiceNumber || '').toUpperCase();
    return !s.startsWith('R') && !s.startsWith('RECT') && !num.startsWith('R') && !num.startsWith('RECT');
  });
  if (rectWithoutSeries.length > 0) {
    issues.push({
      id: 'iva-rectification-series-missing',
      module: 'iva',
      severity: 'warning',
      title: `${rectWithoutSeries.length} factura/es rectificativa/es sense sèrie específica diferenciada`,
      message: `Les factures rectificatives o amb import negatiu han d'emetre's obligatòriament en una sèrie diferenciada (ex: sèrie R-2024 o RECT-).`,
      legalReference: 'Art. 15 del Reglament de Facturació (RD 1619/2012)',
      autoFixable: false,
    });
  }

  // 8.7 Factures de Despesa Excloses de Deducció (Art. 96 LIVA)
  const nonDeductibleConcepts = ['joies', 'joieria', 'tabac', 'loteria', 'multa', 'sancio', 'regal particular', 'espectacle privat'];
  const nonDeductibleInvoices = (iva.receivedInvoices || []).filter(i => {
    const c = (i.concept || '').toLowerCase();
    return (i.deductibleVatAmount || 0) > 0 && nonDeductibleConcepts.some(nd => c.includes(nd));
  });
  if (nonDeductibleInvoices.length > 0) {
    issues.push({
      id: 'iva-non-deductible-concepts',
      module: 'iva',
      severity: 'critical',
      title: `${nonDeductibleInvoices.length} factura/es de despesa amb IVA no deduïble per llei (Art. 96 LIVA)`,
      message: `S'ha detectat deducció d'IVA en conceptes exclosos de deducció (joies, tabac, espectacles recreatius, multes). L'AEAT imposa sancions del 50% al 150% per deduccions indegudes.`,
      legalReference: 'Art. 96 de la Llei de l\'IVA (Llei 37/1992)',
      autoFixable: true,
      autoFixLabel: 'Ajustar a 0% la deducció d\'aquestes factures',
      autoFixKey: 'fix_exclude_non_deductible_iva',
    });
  }

  // 8.8 Caducitat del Termini de Deducció d'IVA de Factures Rebudes (4 Anys / Art. 99.Tres LIVA)
  const expiredInvoices = (iva.receivedInvoices || []).filter(i => {
    if (!i.date) return false;
    const invYear = parseInt(i.date.substring(0, 4), 10);
    return (year - invYear) > 4 && (i.deductibleVatAmount || 0) > 0;
  });
  if (expiredInvoices.length > 0) {
    issues.push({
      id: 'iva-prescription-4-years',
      module: 'iva',
      severity: 'critical',
      title: `${expiredInvoices.length} factura/es de despesa amb dret a deducció d'IVA prescrit (> 4 anys)`,
      message: `El dret a deduir les quotes suportades d'IVA caduca als 4 anys de la data de la factura. No es pot deduir l'IVA de factures d'exercicis prescrits.`,
      legalReference: 'Art. 99.Tres Llei de l\'IVA (Llei 37/1992)',
      autoFixable: false,
    });
  }

  // 8.9 Factures d'Arrendament d'Habitatge amb IVA erroni (> 0%)
  const exemptRentalsWithVat = (iva.issuedInvoices || []).filter(
    i => (i.category === 'property_exempt_rental' || i.concept?.toLowerCase().includes('habitatge') || i.concept?.toLowerCase().includes('vivienda')) && (i.vatRate > 0 || i.vatAmount > 0)
  );
  if (exemptRentalsWithVat.length > 0) {
    issues.push({
      id: 'iva-exempt-rental-with-vat',
      module: 'iva',
      severity: 'critical',
      title: 'IVA aplicat erròniament a l\'arrendament d\'habitatge habitual',
      message: `L'arrendament d'edificis destinats a habitatge està exempt d'IVA per llei. No s'ha de repercutir cap tipus d'IVA (ha de ser 0% exempt).`,
      legalReference: 'Art. 20.Uno.23è Llei de l\'IVA (Llei 37/1992)',
      autoFixable: true,
      autoFixLabel: 'Eliminar IVA de factures d\'habitatge (Exempt Art. 20)',
      autoFixKey: 'fix_remove_vat_exempt_rental',
    });
  }

  // 8.10 Validació de la Regla de Prorrata per Arrendaments d'Habitatge
  const hasExemptRentals = (iva.issuedInvoices || []).some(i => i.category === 'property_exempt_rental' || i.notes?.includes('exempt_art20')) ||
    properties.some(p => p.usageType === 'habitual' || p.usageType === 'temporary');
  
  const hasDeductibleVat = (iva.receivedInvoices || []).some(i => (i.vatAmount || 0) > 0);

  if (hasExemptRentals && hasDeductibleVat && (!iva.config.hasProrrata || iva.config.prorrata.definitivePercentage === 100)) {
    issues.push({
      id: 'iva-prorrata-mandatory',
      module: 'iva',
      severity: 'critical',
      title: 'Règim de Prorrata obligatori no activat',
      message: `Tens arrendaments d'habitatge (operacions exemptes sense dret a deducció segons l'Art. 20.Uno.23è LIVA) simultàniament amb despeses amb IVA suportat. La llei obliga a aplicar la Regla de Prorrata.`,
      legalReference: 'Art. 102 a 104 Llei de l\'IVA (Llei 37/1992)',
      autoFixable: true,
      autoFixLabel: 'Activar i auto-calcular Prorrata General',
      autoFixKey: 'fix_activate_prorrata',
    });
  }

  // 8.11 Validació de Retencions en Arrendaments de Locals Comercials (19%)
  const commercialWithout19 = (iva.issuedInvoices || []).filter(
    i => (i.category === 'property_commercial_rental' || i.concept?.toLowerCase().includes('local')) && i.withholdingRate !== 19 && i.taxableBase > 0
  );
  if (commercialWithout19.length > 0) {
    issues.push({
      id: 'iva-commercial-retention-19',
      module: 'properties',
      severity: 'warning',
      title: 'Retenció IRPF incorrecta en arrendament de local comercial',
      message: `S'han detectat factures de lloguer de local sense la retenció preceptiva del 19% aplicable a immobles urbans de negoci.`,
      legalReference: 'Art. 75.2.a i Art. 80.1 del Reglament de l\'IRPF (RD 439/2007)',
      autoFixable: true,
      autoFixLabel: 'Ajustar retenció al 19% en factures de locals',
      autoFixKey: 'fix_commercial_retention_19',
    });
  }

  // 8.12 Deducció d'IVA de Vehicles de Turisme superior al 50%
  const vehicleInvoices100 = (iva.receivedInvoices || []).filter(
    i => (i.category === 'vehicle_expense' || i.concept?.toLowerCase().includes('cotxe') || i.concept?.toLowerCase().includes('vehicle') || i.concept?.toLowerCase().includes('gasolina')) && (i.deductiblePercentage || 100) > 50
  );
  if (vehicleInvoices100.length > 0) {
    issues.push({
      id: 'iva-vehicle-deduction-excess',
      module: 'iva',
      severity: 'warning',
      title: 'Deducció d\'IVA en vehicles de turisme superior al 50%',
      message: `L'Art. 95 LIVA presumeix una afectació màxima del 50% en vehicles de turisme no industrials. Deducir el 100% és motiu habitual de paralització i sanció per l'AEAT.`,
      legalReference: 'Art. 95.Tres.2a Llei de l\'IVA (Llei 37/1992)',
      autoFixable: true,
      autoFixLabel: 'Ajustar deducció de vehicles al 50% legal',
      autoFixKey: 'fix_adjust_vehicle_deduction_50',
    });
  }

  // 8.13 Validació de Béns d'Inversió (> 3.005,06 €)
  const bigExpensesNotTracked = (iva.receivedInvoices || []).filter(
    i => (i.taxableBase || 0) >= 3005.06 && !i.isInvestmentAsset && (iva.investmentAssets || []).every(a => a.description !== i.concept)
  );
  if (bigExpensesNotTracked.length > 0) {
    issues.push({
      id: 'iva-investment-asset-untracked',
      module: 'iva',
      severity: 'warning',
      title: `${bigExpensesNotTracked.length} compra/es d'actius > 3.005,06 € sense registrar com a Bé d'Inversió`,
      message: `Els béns d'inversió superiors a 3.005,06 € han de constar obligatòriament al Llibre Registre de Béns d'Inversió per al seguiment de 5 o 10 anys.`,
      legalReference: 'Art. 107 a 110 Llei de l\'IVA (Llei 37/1992)',
      autoFixable: true,
      autoFixLabel: 'Registrar automàticament com a Béns d\'Inversió',
      autoFixKey: 'fix_register_investment_assets',
    });
  }

  // 8.14 Validació del Cuadre Model 303 vs Model 390
  const model390 = calculateModel390Annual(iva, year);
  if (!model390.quartersReconciliation.isBalanced) {
    issues.push({
      id: 'iva-303-390-mismatch',
      module: 'iva',
      severity: 'critical',
      title: 'Desquadre entre el Model 303 trimestral i el Model 390 anual',
      message: `La suma de les autoliquidacions trimestrals difereix del resum anual en ${formatCurrency(model390.quartersReconciliation.discrepancyAmount)}. L'AEAT emet sanció per inconsistència de caselles.`,
      legalReference: 'Ordre HFP/1395/2021 de l\'AEAT',
      autoFixable: true,
      autoFixLabel: 'Recalcular i quadrar 303 amb 390',
      autoFixKey: 'fix_recalculate_iva_all',
    });
  }

  // 8.15 Control Documental: Factures Rebudes sense PDF Original Adjunt
  const receivedWithoutPdf = (iva.receivedInvoices || []).filter(i => (i.deductibleVatAmount || 0) > 0 && !i.hasAttachment);
  if (receivedWithoutPdf.length > 0) {
    issues.push({
      id: 'iva-missing-pdf-attachments',
      module: 'iva',
      severity: 'warning',
      title: `${receivedWithoutPdf.length} factura/es deduïda/es sense PDF original adjunt al Magatzem Digital`,
      message: `En cas de requeriment o inspecció de l'AEAT, és obligatori aportar la còpia original de les factures de despesa. Pots adjuntar els PDFs directament des del Llibre de Factures.`,
      legalReference: 'Art. 97 LIVA i Art. 106 de la Llei General Tributària (LGT)',
      autoFixable: false,
    });
  }

  // 8.16 Límit de Pagaments en Efectiu (> 1.000 €)
  const cashOver1000 = [...(iva.issuedInvoices || []), ...(iva.receivedInvoices || [])].filter(
    i => i.paymentMethod === 'cash' && (i.totalInvoice || 0) > 1000
  );
  if (cashOver1000.length > 0) {
    issues.push({
      id: 'iva-cash-limit-exceeded',
      module: 'iva',
      severity: 'critical',
      title: `${cashOver1000.length} operació/ns en efectiu superior/s al límit legal de 1.000 €`,
      message: `La llei antifrau prohibeix pagaments o cobraments en efectiu superiors a 1.000 € entre empresaris i professionals (sanció del 25% de l'import).`,
      legalReference: 'Art. 7 de la Llei 11/2021 de Prevenció del Frau Fiscal',
      autoFixable: false,
    });
  }

  // 8.17 Llindar d'Operacions amb Terceres Persones (> 3.005,06 € - Model 347)
  const nifTotals = new Map<string, { name: string; total: number }>();
  [...(iva.issuedInvoices || []), ...(iva.receivedInvoices || [])].forEach(i => {
    const nif = ('clientNif' in i ? i.clientNif : (i as any).supplierNif) || '';
    const name = ('clientName' in i ? i.clientName : (i as any).supplierName) || '';
    if (nif) {
      const current = nifTotals.get(nif) || { name, total: 0 };
      current.total += (i.totalInvoice || 0);
      nifTotals.set(nif, current);
    }
  });

  const over347List = Array.from(nifTotals.entries()).filter(([_, d]) => d.total >= 3005.06);
  if (over347List.length > 0) {
    issues.push({
      id: 'iva-model-347-threshold',
      module: 'iva',
      severity: 'info',
      title: `${over347List.length} client(s)/proveïdor(s) superen els 3.005,06 € anuals (Model 347)`,
      message: `Tercers com ${over347List.slice(0, 2).map(([_, d]) => d.name).join(', ')} superen el llindar anual de 3.005,06 € i s'hauran d'incloure a la declaració informativa del Model 347 (febrer).`,
      legalReference: 'Reial Decret 1065/2007 (Model 347 de l\'AEAT)',
      autoFixable: false,
    });
  }

  // 8.18 Locals comercials arrendats sense facturació d'IVA
  const commercialProperties = properties.filter(
    p => p.usageType === 'commercial' || p.name?.toLowerCase().includes('local') || p.name?.toLowerCase().includes('oficina')
  );
  const commercialInvoices = (iva.issuedInvoices || []).filter(i => i.category === 'property_commercial_rental');

  if (commercialProperties.length > 0 && commercialInvoices.length === 0) {
    issues.push({
      id: 'cross-commercial-rentals-unbilled',
      module: 'properties',
      severity: 'critical',
      title: 'Locals comercials arrendats sense facturació d\'IVA',
      message: `Tens ${commercialProperties.length} immoble/s d'ús comercial però no hi ha factures de lloguer amb IVA al 21% emeses. L'arrendament de locals està subjecte a IVA obligatòriament.`,
      legalReference: 'Art. 4.Un i Art. 20.Uno.23è.a\' Llei de l\'IVA',
      autoFixable: true,
      autoFixLabel: 'Auto-generar factures d\'arrendament de locals',
      autoFixKey: 'fix_sync_properties_iva',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 9: BÉNS A L'ESTRANGER & CRIPTOACTIUS (MODELS 720 / 721)
  // ═══════════════════════════════════════════════════════════════════════════

  // 9.1 Obligació de Declaració de Béns a l'Estranger (Model 720 - Llindar 50.000 €)
  const foreignAccounts = (data.foreignAssets?.accounts || []).reduce((s, a) => s + (a.balanceYearEnd || 0), 0);
  const foreignSecurities = (data.foreignAssets?.securities || []).reduce((s, a) => s + (a.totalValueYearEnd || 0), 0);
  const foreignRealEstate = (data.foreignAssets?.realEstate || []).reduce((s, a) => s + (a.acquisitionCostEUR || 0), 0);
  if (foreignAccounts > 50000 || foreignSecurities > 50000 || foreignRealEstate > 50000) {
    issues.push({
      id: 'foreign-model-720-mandatory',
      module: 'general',
      severity: 'info',
      title: 'Obligació de presentació del Model 720 (Béns i Drets a l\'Estranger > 50.000 €)',
      message: `Com que el valor conjunt d'algun dels blocs (comptes, valors o immobles) supera els 50.000 €, estàs obligat a presentar el Model 720 informatiu abans del 31 de març.`,
      legalReference: 'Disposició Addicional 18a LGT i Art. 42 bis del RGAT',
      autoFixable: false,
    });
  }

  // 9.2 Obligació de Declaració de Criptoactius a l'Estranger (Model 721 - Llindar 50.000 €)
  const foreignCrypto = (data.foreignAssets?.crypto || []).reduce((s, c) => s + (c.valueYearEndEUR || 0), 0);
  if (foreignCrypto > 50000) {
    issues.push({
      id: 'foreign-model-721-mandatory',
      module: 'general',
      severity: 'info',
      title: 'Obligació de presentació del Model 721 (Criptomonedes en Custodis no Residents > 50.000 €)',
      message: `El saldo de monedes virtuals situades a l'estranger supera els 50.000 €. És preceptiu presentar el Model 721 abans del 31 de març.`,
      legalReference: 'Art. 42 quater del RGAT (Ordre HFP/886/2023)',
      autoFixable: false,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 10: CONCILIACIÓ I CUADRE INTER-MODEL (AEAT)
  // ═══════════════════════════════════════════════════════════════════════════
  const reconReport = ModelReconciliationEngine.auditAndCheckDiscrepancies(data);
  for (const disc of reconReport.discrepancies) {
    issues.push({
      id: `reconcile-${disc.id}`,
      module: disc.category === 'iva' ? 'iva' : (disc.category === 'irpf_130' ? 'activities' : 'general'),
      severity: disc.severity,
      title: disc.title,
      message: `${disc.description} Risc: ${disc.inspectionRiskExplanation}`,
      legalReference: 'Normativa General Tributària (Llei 58/2003)',
      autoFixable: disc.canAutoReconcile,
      autoFixLabel: '⚡ Executar Cuadre Automàtic Integral',
      autoFixKey: 'fix_reconcile_all_models',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 11: ARRENDAMENTS TURÍSTICS I TEMPORALS (CRITERIS DGT V1187-24 & MODEL 179)
  // ═══════════════════════════════════════════════════════════════════════════
  for (const p of properties) {
    if ((p.usageType === 'tourist' || p.usageType === 'temporary') && p.reductionType && p.reductionType !== 'none') {
      issues.push({
        id: `prop-tourist-invalid-reduction-${p.id}`,
        module: 'properties',
        severity: 'critical',
        title: `Reducció d'habitatge habitual aplicada indegudament a immoble ${p.usageType === 'tourist' ? 'turístic' : 'temporal'}`,
        message: `Els arrendaments turístics o d'ús temporal no constitueixen habitatge permanent del llogater i estan expressament exclosos de les reduccions del 50%-90% de la Llei 12/2023.`,
        legalReference: 'Art. 23.2 Llei de l\'IRPF i Consulta Vinculant DGT V1187-24',
        autoFixable: true,
        autoFixLabel: 'Eliminar reducció de lloguer temporal/turístic',
        autoFixKey: `fix_remove_tourist_reduction_${p.id}`,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 12: TELETREBALL I SUBMINISTRAMENTS D'HABITATGE D'AUTÒNOMS (ART. 30.2.5a.b LIRPF)
  // ═══════════════════════════════════════════════════════════════════════════
  const utilityInvoices = (iva.receivedInvoices || []).filter(i => {
    const c = (i.concept || '').toLowerCase();
    return c.includes('electricitat') || c.includes('llum') || c.includes('aigua') || c.includes('gas') || c.includes('fibra') || c.includes('internet');
  });
  if (utilityInvoices.length > 0 && act.income > 0) {
    const fullDeductedUtilities = utilityInvoices.filter(i => (i.deductiblePercentage || 100) > 30);
    if (fullDeductedUtilities.length > 0) {
      issues.push({
        id: 'act-home-office-utilities-overdeducted',
        module: 'activities',
        severity: 'warning',
        title: `${fullDeductedUtilities.length} factura/es de subministraments de llar deduïdes per sobre del límit legal del 30%`,
        message: `Segons l'Art. 30.2.5a.b LIRPF, les despeses de subministraments (llum, aigua, gas, internet) de l'habitatge habitual afectat a l'activitat només són deduïbles al 30% de la proporció entre els metres quadrats afectes i la superfície total. Deduir el 100% genera sanció tributària.`,
        legalReference: 'Art. 30.2.5a.b Llei de l\'IRPF (Llei 6/2017 de Reformes Urgents del Treball Autònom)',
        autoFixable: true,
        autoFixLabel: 'Ajustar subministraments a la regla del 30% d\'afectació',
        autoFixKey: 'fix_adjust_home_utilities_30',
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 13: DESPESES DE GUARDERIA I CRIANÇA (ART. 81 LIRPF & STC 8/1/2024)
  // ═══════════════════════════════════════════════════════════════════════════
  if (deductions.maternityDeduction && deductions.maternityNurseryExpenses > 1000) {
    issues.push({
      id: 'ded-nursery-expenses-capped',
      module: 'general',
      severity: 'warning',
      title: `Despeses de guarderia (${formatCurrency(deductions.maternityNurseryExpenses)}) superen el sostre màxim de 1.000 €`,
      message: `L'increment de la deducció per maternitat per despeses de custòdia en guarderies o centres d'educació infantil autoritzats té un límit màxim de 1.000 € anuals per fill.`,
      legalReference: 'Art. 81.2 Llei de l\'IRPF i Sentència del Tribunal Suprem 8/1/2024',
      autoFixable: true,
      autoFixLabel: 'Ajustar despeses de guarderia a 1.000 €',
      autoFixKey: 'fix_cap_nursery_expenses',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUP 14: IMPOST SOBRE EL PATRIMONI (MODEL 714) & LÍMIT CONJUNT 60% (ART. 31 LIP)
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.wealth && data.wealth.assets && data.wealth.assets.length > 0) {
    const hasPrimaryResidenceOver300k = (data.wealth.assets || []).some(a => a.isPrimaryResidence && (a.grossValue || 0) > 300000);
    if (hasPrimaryResidenceOver300k) {
      issues.push({
        id: 'wealth-primary-residence-exemption-cap',
        module: 'wealth',
        severity: 'info',
        title: 'Exempció d\'habitatge habitual a Patrimoni limitada a 300.000 €',
        message: `L'Art. 4.Nou LIP estableix una exempció màxima de 300.000 € per al valor de l'habitatge habitual. L'excés computa com a patrimoni net subjecte a gravamen.`,
        legalReference: 'Art. 4.Nou Llei 19/1991 de l\'Impost sobre el Patrimoni',
        autoFixable: false,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CÀLCUL DE LA PUNTUACIÓ DE CONFORMITAT FISCAL (0-100%)
  // ═══════════════════════════════════════════════════════════════════════════
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  let score = 100;
  score -= (criticalCount * 20);
  score -= (warningCount * 8);
  score -= (infoCount * 2);
  const complianceScore = Math.max(0, Math.min(100, score));

  const status = criticalCount > 0 ? 'errors' : (warningCount > 0 ? 'warnings' : 'perfect');

  return {
    timestamp: new Date().toISOString(),
    totalIssues: issues.length,
    criticalCount,
    warningCount,
    infoCount,
    complianceScore,
    status,
    issues,
  };
}

/**
 * Executa una acció d'auto-correcció automàtica (Auto-Fix).
 */
export function executeAutoFix(fixKey: string): { success: boolean; message: string } {
  switch (fixKey) {
    case 'fix_activate_prorrata': {
      const iva = store.getIVA();
      store.updateIVA({
        config: {
          ...iva.config,
          hasProrrata: true,
          prorrata: {
            ...iva.config.prorrata,
            isRegulatedAutomatically: true,
          }
        }
      });
      return { success: true, message: 'Règim de Prorrata activat i recalculat automàticament segons facturació.' };
    }

    case 'fix_remove_vat_exempt_rental': {
      const iva = store.getIVA();
      for (const inv of iva.issuedInvoices) {
        if (inv.category === 'property_exempt_rental' || inv.concept?.toLowerCase().includes('habitatge') || inv.concept?.toLowerCase().includes('vivienda')) {
          inv.vatRate = 0;
          inv.vatAmount = 0;
          inv.totalInvoice = inv.taxableBase - (inv.withholdingAmount || 0);
          inv.category = 'property_exempt_rental';
          inv.notes = 'Exempt Art. 20.Uno.23è LIVA';
        }
      }
      store.updateIVA({ issuedInvoices: iva.issuedInvoices });
      return { success: true, message: 'IVA eliminat de les factures d\'habitatge (ara marcades com a exemptes Art. 20 LIVA).' };
    }

    case 'fix_commercial_retention_19': {
      const iva = store.getIVA();
      for (const inv of iva.issuedInvoices) {
        if (inv.category === 'property_commercial_rental' || inv.concept?.toLowerCase().includes('local')) {
          inv.withholdingRate = 19;
          inv.withholdingAmount = Math.round((inv.taxableBase || 0) * 0.19 * 100) / 100;
          inv.totalInvoice = (inv.taxableBase || 0) + (inv.vatAmount || 0) - (inv.withholdingAmount || 0);
        }
      }
      store.updateIVA({ issuedInvoices: iva.issuedInvoices });
      return { success: true, message: 'Retencions del 19% aplicades a totes les factures d\'arrendament de locals.' };
    }

    case 'fix_adjust_vehicle_deduction_50': {
      const iva = store.getIVA();
      for (const inv of iva.receivedInvoices) {
        if (inv.category === 'vehicle_expense' || inv.concept?.toLowerCase().includes('cotxe') || inv.concept?.toLowerCase().includes('vehicle') || inv.concept?.toLowerCase().includes('gasolina')) {
          inv.deductiblePercentage = 50;
        }
      }
      store.updateIVA({ receivedInvoices: iva.receivedInvoices });
      return { success: true, message: 'Deducció d\'IVA en vehicles ajustada al 50% legal (Art. 95 LIVA).' };
    }

    case 'fix_exclude_non_deductible_iva': {
      const iva = store.getIVA();
      const nonDeductible = ['joies', 'joieria', 'tabac', 'loteria', 'multa', 'sancio', 'regal particular', 'espectacle privat'];
      let count = 0;
      for (const inv of iva.receivedInvoices) {
        const c = (inv.concept || '').toLowerCase();
        if (nonDeductible.some(nd => c.includes(nd))) {
          inv.deductiblePercentage = 0;
          inv.deductibleVatAmount = 0;
          count++;
        }
      }
      store.updateIVA({ receivedInvoices: iva.receivedInvoices });
      return { success: true, message: `${count} factures ajustades a 0% de deducció segons l'Art. 96 LIVA.` };
    }

    case 'fix_register_investment_assets': {
      const iva = store.getIVA();
      let added = 0;
      for (const inv of iva.receivedInvoices) {
        if ((inv.taxableBase || 0) >= 3005.06 && !inv.isInvestmentAsset) {
          inv.isInvestmentAsset = true;
          iva.investmentAssets.push({
            id: `asset_autofix_${Date.now()}_${added}`,
            description: inv.concept || 'Bé d\'Inversió',
            assetType: 'machinery',
            acquisitionDate: inv.date || `${store.getYear()}-01-15`,
            startDate: inv.date || `${store.getYear()}-01-15`,
            taxableBase: inv.taxableBase,
            vatRate: inv.vatRate,
            totalVatPaid: inv.vatAmount,
            initialDeductionPercentage: 100,
            initialDeductedVat: inv.vatAmount,
            regularizationYears: 5,
            regularizations: [],
            status: 'active',
          });
          added++;
        }
      }
      store.updateIVA({ receivedInvoices: iva.receivedInvoices, investmentAssets: iva.investmentAssets });
      return { success: true, message: `${added} actius registrats automàticament al Llibre de Béns d'Inversió.` };
    }

    case 'fix_set_reta_standard': {
      store.update('activities', { socialSecuritySelfEmployed: 3600 });
      return { success: true, message: 'Quota de Seguretat Social d\'Autònoms (3.600 € anuals) assignada a Activitats Econòmiques.' };
    }

    case 'fix_recalculate_iva_all': {
      store.recalculateIVA();
      return { success: true, message: 'Totes les liquidacions del Model 303 i el Model 390 han estat recalculades i quadrades.' };
    }

    case 'fix_sync_activities_iva': {
      const res = store.syncIVAFromActivities();
      return { success: true, message: `Sincronització completada: ${res.addedIssued} factures emeses i ${res.addedReceived} rebudes creades.` };
    }

    case 'fix_sync_properties_iva': {
      const res = store.syncIVAFromProperties();
      return { success: true, message: `Immobles sincronitzats: +${res.addedCommercialRentals} factures de locals (21% + 19% retenció) generades.` };
    }

    case 'fix_sync_commercial_withholdings_180': {
      const curData = store.getData();
      const commercialProps = (curData.properties || []).filter(p => p.usageType === 'commercial');
      const totalCommercialRent = commercialProps.reduce((s, p) => s + (p.grossRentalIncome || 0), 0);
      const expected19 = totalCommercialRent * 0.19;

      store.update('capitalIncome', {
        ...curData.capitalIncome,
        realEstateWithholdings: expected19,
      });
      return { success: true, message: `S'han imputat ${formatCurrency(expected19)} de retencions a la Casella 0598 procedents del Model 180.` };
    }

    case 'fix_cap_7p_exemption': {
      const workData = store.getData().workIncome;
      store.update('workIncome', { ...workData, foreignWorkExemption7p: 60100 });
      return { success: true, message: 'Exempció 7.p limitada al sostre màxim legal de 60.100 €.' };
    }

    case 'fix_apply_disabled_worker_deduction': {
      const workData = store.getData().workIncome;
      store.update('workIncome', { ...workData, otherDeductible: 3500 });
      return { success: true, message: 'Despesa deduïble incrementada de 3.500 € per discapacitat aplicada a Rendiments del Treball.' };
    }

    case 'fix_cap_housing_deduction': {
      store.update('deductions', { housingAmountsPaid: 9040 });
      return { success: true, message: 'Base de deducció per habitatge habitual ajustada al màxim legal de 9.040 €.' };
    }

    case 'fix_disable_catalan_rental_deduction': {
      store.update('deductions', { catalanRentalDeduction: false });
      return { success: true, message: 'Deducció de lloguer autonòmica desactivada per incompatibilitat d\'edat.' };
    }

    case 'fix_disable_maternity_deduction': {
      store.update('deductions', { maternityDeduction: false });
      return { success: true, message: 'Deducció per maternitat desactivada en no haver-hi descendents menors de 3 anys.' };
    }

    case 'fix_cap_pension_individual': {
      store.update('deductions', { pensionPlanContributions: 1500 });
      return { success: true, message: 'Aportació individual a pla de pensions ajustada al límit d\'1.500 €.' };
    }

    case 'fix_cap_pension_company': {
      store.update('deductions', { companyPensionContributions: 8500 });
      return { success: true, message: 'Aportació empresarial a pla d\'ocupació ajustada al límit de 8.500 €.' };
    }

    case 'fix_cap_pension_total': {
      store.update('deductions', { pensionPlanContributions: 1500, companyPensionContributions: 8500 });
      return { success: true, message: 'Plans de pensions ajustats al límit conjunt de 10.000 € (1.500 € ind + 8.500 € empresa).' };
    }

    case 'fix_cap_energy_deduction': {
      store.update('deductions', { energyEfficiencyAmount: 7500 });
      return { success: true, message: 'Base de deducció per eficiència energètica ajustada al màxim legal de 7.500 €.' };
    }

    case 'fix_cap_nursery_expenses': {
      store.update('deductions', { maternityNurseryExpenses: 1000 });
      return { success: true, message: 'Despeses de guarderia ajustades al límit màxim de 1.000 € anuals.' };
    }

    case 'fix_adjust_home_utilities_30': {
      const iva = store.getIVA();
      let adjusted = 0;
      for (const inv of iva.receivedInvoices) {
        const c = (inv.concept || '').toLowerCase();
        if (c.includes('electricitat') || c.includes('llum') || c.includes('aigua') || c.includes('gas') || c.includes('fibra') || c.includes('internet')) {
          inv.deductiblePercentage = 30;
          inv.deductibleVatAmount = Math.round((inv.vatAmount || 0) * 0.30 * 100) / 100;
          adjusted++;
        }
      }
      store.updateIVA({ receivedInvoices: iva.receivedInvoices });
      return { success: true, message: `${adjusted} factura/es de subministraments ajustades al 30% d'afectació legal (Art. 30.2.5a.b LIRPF).` };
    }

    case 'fix_reconcile_all_models': {
      const currentData = store.getData();
      const reconciled = ModelReconciliationEngine.executeMasterReconciliation(currentData);
      if (reconciled.quarterlyTaxes) store.update('quarterlyTaxes', reconciled.quarterlyTaxes);
      if (reconciled.activities) store.update('activities', reconciled.activities);
      if (reconciled.gains) store.update('gains', reconciled.gains);
      if (reconciled.capitalIncome) store.update('capitalIncome', reconciled.capitalIncome);
      if (reconciled.iva) store.updateIVA(reconciled.iva);
      return { success: true, message: 'Cuadre Automàtic Integral executat: 100% de models tributaris sincronitzats i quadrats.' };
    }

    default: {
      if (fixKey.startsWith('fix_remove_tourist_reduction_')) {
        const propId = fixKey.replace('fix_remove_tourist_reduction_', '');
        const props = store.getData().properties || [];
        const target = props.find(p => p.id === propId);
        if (target) {
          target.reductionType = 'none';
          store.setSection('properties', props);
          return { success: true, message: `Reducció eliminada de l'immoble ${target.name || propId} per tractar-se d'ús turístic/temporal.` };
        }
      }
      return { success: false, message: 'Acció d\'auto-correcció no reconeguda.' };
    }
  }
}
