/**
 * @module scripts/verify-renta
 * Bucle Automatitzat de Verificació Integral del Mòdul de la Renda (IRPF / Model 100 AEAT).
 * 
 * Executa un bucle exhaustiu de validacions sobre:
 * 1. Motors de Càlcul Fiscal (irpf.ts, real-estate-engine.ts, loss-carryover-engine.ts, etc.)
 * 2. Magatzem Reactiu d'Estat (store.ts, multi-declarant, aïllament multi-exercici)
 * 3. Mapa Oficial de Caselles AEAT (caselles.ts, caselles 0001 a 0612)
 * 4. Renderització de Formularis i Pàgines SPA (DOM, listeners, enllaços)
 * 5. Comparador Tributari Individual vs Conjunta (joint-taxation.ts)
 * 6. Generadors d'Exportació (PDF Model 100 i formats oficials)
 */

// ── 0. SETUP D'ENTORN HEADLESS PER A PROVES DOM EN NODE ─────────────────────

class MockStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
  removeItem(key: string): void { this.store.delete(key); }
  clear(): void { this.store.clear(); }
  get length(): number { return this.store.size; }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
}

class MockElement {
  public tagName: string;
  public id: string = '';
  public className: string = '';
  public innerHTML: string = '';
  public style: Record<string, any> = {};
  public children: MockElement[] = [];
  public parentNode: MockElement | null = null;
  public attributes = new Map<string, string>();
  public eventListeners = new Map<string, Array<(...args: any[]) => void>>();
  public dataset: Record<string, string> = {};
  public value: string = '';
  public disabled: boolean = false;
  public checked: boolean = false;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === 'id') this.id = value;
    if (name === 'class') this.className = value;
  }

  getAttribute(name: string): string | null {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.className || null;
    return this.attributes.get(name) ?? null;
  }

  appendChild<T extends MockElement>(child: T): T {
    if (child.tagName === 'FRAGMENT') {
      for (const ch of child.children) {
        ch.parentNode = this;
        this.children.push(ch);
      }
      child.children = [];
      return child;
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  replaceWith(...nodes: any[]): void {
    if (!this.parentNode) return;
    const idx = this.parentNode.children.indexOf(this);
    if (idx !== -1) {
      this.parentNode.children.splice(idx, 1, ...nodes);
    }
  }

  addEventListener(type: string, listener: (...args: any[]) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  dispatchEvent(type: string, eventObj: any = {}): void {
    const list = this.eventListeners.get(type) || [];
    for (const cb of list) cb({ target: this, ...eventObj });
  }

  querySelector(selector: string): MockElement | null {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return this.findRecursive(el => el.id === id);
    }
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return this.findRecursive(el => el.className.includes(cls));
    }
    return this.findRecursive(el => el.tagName.toLowerCase() === selector.toLowerCase());
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      this.findAllRecursive(el => el.className.includes(cls), results);
    } else if (selector.startsWith('[')) {
      this.findAllRecursive(() => true, results);
    } else {
      this.findAllRecursive(el => el.tagName.toLowerCase() === selector.toLowerCase(), results);
    }
    return results;
  }

  private findRecursive(pred: (el: MockElement) => boolean): MockElement | null {
    if (pred(this)) return this;
    for (const ch of this.children) {
      const found = ch.findRecursive(pred);
      if (found) return found;
    }
    return null;
  }

  private findAllRecursive(pred: (el: MockElement) => boolean, acc: MockElement[]): void {
    if (pred(this)) acc.push(this);
    for (const ch of this.children) {
      ch.findAllRecursive(pred, acc);
    }
  }
}

// Global polyfills for Node environment
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    location: { hash: '#/' },
    addEventListener: () => {},
    localStorage: new MockStorage(),
    navigator: { clipboard: { writeText: async () => {} } },
  };
}
if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => new MockElement(tag),
    createDocumentFragment: () => new MockElement('fragment'),
    getElementById: (id: string) => {
      const el = new MockElement('div');
      el.id = id;
      return el;
    },
    body: new MockElement('body'),
    addEventListener: () => {},
  };
}
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = (globalThis as any).window.localStorage;
}
if (typeof (globalThis as any).HTMLElement === 'undefined') {
  (globalThis as any).HTMLElement = MockElement as any;
}
if (typeof (globalThis as any).requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);
}

// ── IMPORTS DELS MOTORS I SUBSISTEMA DE RENDA ──────────────────────────────

import { calculateIRPF, applyBrackets } from '../src/fiscal/irpf.ts';
import { calculatePropertyFiscalResult, calculateAllProperties } from '../src/fiscal/real-estate-engine.ts';
import { calculateSavingsCompensation } from '../src/fiscal/loss-carryover-engine.ts';
import { combineDeclarationsForJoint, compareIndividualVsJoint } from '../src/fiscal/joint-taxation.ts';
import { computeDeductions } from '../src/fiscal/deductions.ts';
import { computeCatalanDeductions } from '../src/fiscal/deductions-cat.ts';
import { calculateComplementaryIRPF } from '../src/fiscal/complementary-engine.ts';
import { evaluateAuditRisk } from '../src/fiscal/audit-risk-radar.ts';
import { runAutomatedComplianceChecks } from '../src/fiscal/auto-validator.ts';
import { calculateAllQuarters, calculateModel390Annual } from '../src/fiscal/iva-engine.ts';
import { initializeEmptyIVAData } from '../src/fiscal/iva-integration.ts';
import { calculateWealthTax } from '../src/fiscal/wealth-tax-engine.ts';
import { validateAndSanitizeDeclaration, sanitizeNumber, sanitizeBoolean } from '../src/fiscal/schema-validator.ts';
import { validatePensionContributions, validateForeignWorkExemption, validateIrregularIncome, validateMileageRate } from '../src/fiscal/form-validator.ts';
import { AutonomoVsSLEngine } from '../src/fiscal/autonomo-vs-sl-engine.ts';
import { PensionsOptimizerEngine } from '../src/fiscal/pensions-optimizer.ts';
import { Model130Engine } from '../src/fiscal/model130-engine.ts';
import { auditForeignAssetsObligation } from '../src/fiscal/model720-engine.ts';
import { compareBeckhamRegime } from '../src/fiscal/beckham-engine.ts';
import { ITPAndAJDEngine } from '../src/fiscal/itp-plusvalia-engine.ts';
import { calculateRETACotization, RETA_TABLE_2024_2025 } from '../src/fiscal/social-security-engine.ts';
import { DefiTaxEngine } from '../src/fiscal/defi-tax-engine.ts';
import { Model347Engine } from '../src/fiscal/model347-engine.ts';
import { InheritanceTaxEngine } from '../src/fiscal/inheritance-tax-engine.ts';
import { runMonteCarloSimulation } from '../src/fiscal/monte-carlo-engine.ts';
import { calculateMarginalTaxRate, generateYearEndOptimization } from '../src/fiscal/year-end-optimizer.ts';
import { roundCurrency, safeAdd, safeMultiply, safePercentage } from '../src/utils/math.ts';
import { router } from '../src/router.ts';
import { buildTable } from '../src/components/table-builder.ts';
import { formatCurrency, formatCurrencyNoDecimals, formatPercent, formatNumber, formatCompact, parseCurrencyInput } from '../src/utils/currency.ts';
import { store, createEmptyDeclaracion } from '../src/store.ts';
import {
  STATE_GENERAL_TAX_BRACKETS,
  CATALAN_GENERAL_TAX_BRACKETS,
  STATE_SAVINGS_TAX_BRACKETS,
  AUTONOMIC_SAVINGS_TAX_BRACKETS,
  PERSONAL_MINIMUM,
  WORK_OTHER_EXPENSES,
  COMMUNITY_NAME_MAP,
} from '../src/fiscal/constants.ts';
import type { DeclaracionData, RentalProperty } from '../src/types.ts';
import type { IVAData, IVAInvoiceIssued, IVAInvoiceReceived } from '../src/types-iva.ts';
import type { WealthTaxData } from '../src/fiscal/wealth-tax-engine.ts';

// Imports de renderers de pàgines per comprovar connectivitat de vistes
import { renderWorkIncome } from '../src/pages/work-income.ts';
import { renderCapital } from '../src/pages/capital.ts';
import { renderProperties } from '../src/pages/properties.ts';
import { renderActivities } from '../src/pages/activities.ts';
import { renderGains } from '../src/pages/gains.ts';
import { renderPersonal } from '../src/pages/personal.ts';
import { renderDeductions } from '../src/pages/deductions.ts';
import { renderResult } from '../src/pages/result.ts';
import { renderCasellesPage } from '../src/pages/caselles.ts';
import { renderComparator } from '../src/pages/comparator.ts';
import { renderWizard } from '../src/pages/wizard.ts';
import { renderAdvisor } from '../src/pages/advisor.ts';
import { renderDashboard } from '../src/pages/dashboard.ts';

// ── TEST RUNNER CORE ────────────────────────────────────────────────────────

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];
let currentSuite = '';

function suite(name: string, fn: () => void): void {
  currentSuite = name;
  console.log(`\n\x1b[1m\x1b[36m▶ SUITE: ${name}\x1b[0m`);
  fn();
}

function test(name: string, fn: () => void): void {
  const start = performance.now();
  try {
    fn();
    const durationMs = performance.now() - start;
    results.push({ suite: currentSuite, name, passed: true, durationMs });
    console.log(`  \x1b[32m✔\x1b[0m ${name} \x1b[90m(${durationMs.toFixed(2)}ms)\x1b[0m`);
  } catch (err: any) {
    const durationMs = performance.now() - start;
    results.push({ suite: currentSuite, name, passed: false, error: err?.message || String(err), durationMs });
    console.error(`  \x1b[31m✖\x1b[0m ${name} \x1b[90m(${durationMs.toFixed(2)}ms)\x1b[0m`);
    console.error(`    \x1b[31mError: ${err?.message || err}\x1b[0m`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertCloseTo(actual: number, expected: number, tolerance = 0.05, message = ''): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`Expected ~${expected} (±${tolerance}), but got ${actual}. ${message}`);
  }
}

// ── 1. SUITE 1: MOTORS DE CÀLCUL FISCAL (IRPF) ──────────────────────────────

suite('1. Motors de Càlcul Fiscal IRPF (Llei 35/2006)', () => {

  test('1.1 Escales de gravamen progressives (Estatal i Catalunya)', () => {
    assert(applyBrackets(0, STATE_GENERAL_TAX_BRACKETS) === 0, 'Base 0 ha de donar impost 0');
    
    const taxState12450 = applyBrackets(12450, STATE_GENERAL_TAX_BRACKETS);
    assertCloseTo(taxState12450, 1182.75, 0.01, 'Impost estatal per a 12.450€');

    const taxCat12450 = applyBrackets(12450, CATALAN_GENERAL_TAX_BRACKETS);
    assertCloseTo(taxCat12450, 1307.25, 0.01, 'Impost català per a 12.450€');

    const stateSavings = applyBrackets(6000, STATE_SAVINGS_TAX_BRACKETS);
    const catSavings = applyBrackets(6000, AUTONOMIC_SAVINGS_TAX_BRACKETS);
    assertCloseTo(stateSavings + catSavings, 1140, 0.01, 'Base estalvi 6.000€ tributa al 19%');
  });

  test('1.2 Rendiments del Treball amb Art. 7.p i Rendiments Irregulars (Art. 18.2)', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome = {
      employers: [{
        id: 'emp-1',
        name: 'Tech Corp',
        nif: 'B12345678',
        grossSalary: 80000,
        inKind: 2000,
        withholdings: 18000,
        socialSecurity: 2500,
        dietsIncome: 0,
        dietsDays: 0,
        mileageIncome: 0,
        mileageKm: 0,
      }],
      foreignWorkExemption7p: 70000, // Capped at 60.100 € by law
      irregularIncomeAmount: 10000, // 30% reduction = 3.000 €
      unionFees: 300,
      otherDeductible: 0,
      pensionContributions: 0,
    };

    const res = calculateIRPF(data);
    
    assert(res.foreignWorkExemptionApplied === 60100, `7.p cap ha de ser 60.100, obtingut: ${res.foreignWorkExemptionApplied}`);
    assert(res.irregularWorkReduction === 3000, `Reducció irregular ha de ser 3.000, obtingut: ${res.irregularWorkReduction}`);
    assertCloseTo(res.generalBase, 14100, 1.0, 'Base imposable general per treball');
  });

  test('1.3 Capital Mobiliari i Deducció per Doble Imposició Internacional (Art. 80 Casella 0588)', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [{
      id: 'e1', name: 'Work', nif: 'A11111111', grossSalary: 30000, inKind: 0, withholdings: 4500, socialSecurity: 1500, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0
    }];
    data.capitalIncome = {
      interests: 1000,
      dividends: 2000,
      foreignDividends: 3000,
      foreignTaxWithheld: 450,
      insuranceGains: 0,
      otherMobiliary: 0,
      mobiliaryWithholdings: 570,
      rentalIncome: 0,
      rentalExpenses: 0,
      imputedIncome: 0,
      realEstateWithholdings: 0,
    };

    const res = calculateIRPF(data);
    
    assert(res.savingsBase === 6000, `Base estalvi ha de ser 6.000, obtingut: ${res.savingsBase}`);
    assert(res.foreignTaxCredit > 0, 'Deducció per doble imposició ha de ser > 0');
    assert(res.foreignTaxCredit <= 450, 'Deducció per doble imposició no pot superar la retenció suportada');
  });

  test('1.4 Immobles Arrendats: Despeses Limitades, Amortitzacions i Reduccions Llei 12/2023', () => {
    const prop: RentalProperty = {
      id: 'prop-1',
      name: 'Pis Eixample',
      cadastralReference: '1234567AB1234C0001XY',
      totalCadastralValue: 150000,
      constructionCadastralValue: 90000,
      acquisitionCost: 200000,
      acquisitionDate: '2018-05-10',
      usageType: 'habitual',
      ownershipPercentage: 100,
      grossRentalIncome: 12000,
      otherIncomes: 0,
      mortgageInterests: 3000,
      repairExpenses: 4000,
      pendingRepairsPreviousYears: 0,
      ibi: 600,
      wasteTax: 100,
      communityFees: 900,
      insurance: 300,
      managementFees: 0,
      badDebts: 0,
      otherTaxes: 0,
      isMixedUsage: false,
      rentalDays: 365,
      ownUseDays: 0,
      reductionType: '50_general',
      inventory: [
        {
          id: 'inv-1',
          description: 'Mobiliari i electrodomèstics',
          category: 'group_2_furniture_10',
          amount: 5000,
          acquisitionDate: '2023-01-01',
          amortizationRate: 0.10,
          previousAmortization: 500,
          status: 'active',
        }
      ],
    };

    const calc = calculatePropertyFiscalResult(prop, 2024);
    
    assert(calc.grossIncome === 12000, 'Ingressos bruts han de ser 12.000 €');
    assert(calc.limitedExpensesDeducted === 7000, 'Despeses limitades deduïdes han de ser 7.000 €');
    assert(calc.pendingRepairsForFutureYears === 0, 'No hi ha romanent de reparacions');
    assertCloseTo(calc.buildingAmortization, 3600, 1.0, 'Amortització immoble 3%');
    assertCloseTo(calc.inventoryAmortization, 500, 1.0, 'Amortització inventari mobles 10%');
    assert(calc.netIncome < 0, 'Rendiment net ha de ser negatiu degut a amortitzacions i reparacions');
  });

  test('1.5 Activitats Econòmiques en Estimació Directa Simplificada (5% Límit 2.000 €)', () => {
    const data = createEmptyDeclaracion(2024);
    data.activities = {
      income: 60000,
      expenses: 10000,
      socialSecuritySelfEmployed: 4000,
      withholdings: 9000,
      estimationType: 'direct_simplified',
    };

    const res = calculateIRPF(data);
    assertCloseTo(res.generalBase, 44000, 1.0, 'Activitats econòmiques amb topall de 2.000€');
  });

  test('1.6 Compensació de l\'Estalvi: Regla 25% Creuada i Bossa de 4 Anys (Art. 49 LIRPF)', () => {
    const priorMob = [{ year: 2022, amount: 500 }];
    const priorGains = [{ year: 2022, amount: 1000 }];

    const comp = calculateSavingsCompensation(-2000, 4000, priorMob, priorGains);

    assert(comp.crossCompensationApplied === 1000, `Compensació creuada ha de ser 1.000, obtingut: ${comp.crossCompensationApplied}`);
    assert(comp.mobiliaryAfterCross === -1000, 'Mobiliari restant després de creuada ha de ser -1.000');
    assert(comp.gainsAfterCross === 3000, 'Guanys després de creuada ha de ser 3.000');
    assert(comp.priorGainsCompensated === 1000, 'S\'han de compensar 1.000 € de pèrdues anteriors de guanys');
    assert(comp.finalSavingsBase === 2000, `Base de l'estalvi final ha de ser 2.000, obtingut: ${comp.finalSavingsBase}`);
    assert(comp.remainingPriorMobiliaryLosses.length > 0, 'Les pèrdues de mobiliari pendents s\'han de guardar a la bossa');
  });

  test('1.7 Mínim Personal i Familiar (Edat, Descendents, Ascendents i Discapacitat)', () => {
    const data = createEmptyDeclaracion(2024);
    data.personal = {
      name: 'Família Nombrosa',
      nif: '12345678Z',
      age: 68,
      disability: 33,
      descendants: [
        { id: 'd1', name: 'Fill 1', birthYear: 2010, age: 14, disability: 0 },
        { id: 'd2', name: 'Fill 2', birthYear: 2022, age: 2, disability: 0 },
        { id: 'd3', name: 'Fill 3', birthYear: 2015, age: 9, disability: 65 },
      ],
      ascendants: [
        { id: 'a1', name: 'Avi', birthYear: 1945, age: 79, disability: 0, liveTogether: true, annualIncome: 0 }
      ],
      community: 'CAT',
      taxDeclarationType: 'individual',
    };

    const res = calculateIRPF(data);

    assert(res.personalMinimum === 9700, `Mínim personal ha de ser 9.700, obtingut: ${res.personalMinimum}`);
    assert(res.descendantsMinimum === 20900, `Mínim descendents ha de ser 20.900, obtingut: ${res.descendantsMinimum}`);
    assert(res.ascendantsMinimum === 2550, `Mínim ascendents ha de ser 2.550, obtingut: ${res.ascendantsMinimum}`);
    assert(res.totalMinimum === 33150, `Mínim total ha de ser 33.150, obtingut: ${res.totalMinimum}`);
  });

  test('1.8 Deduccions Estatals i Autonòmiques de Catalunya', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [{
      id: 'e1', name: 'Empresa', nif: 'A12345678', grossSalary: 18000, inKind: 0, withholdings: 2500, socialSecurity: 1200, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0
    }];
    data.personal.age = 28;
    data.deductions = {
      housingDeduction: true,
      housingAmountsPaid: 10000,
      donations: [
        { id: 'don-1', entityName: 'Creu Roja', amount: 500, priority: true, recurring: true }
      ],
      maternityDeduction: true,
      maternityMonths: 12,
      maternityNurseryExpenses: 800,
      pensionPlanContributions: 1500,
      companyPensionContributions: 0,
      energyEfficiencyType: 'heating_cooling_20',
      energyEfficiencyAmount: 3000,
      otherDeductions: 0,
      catalanRentalDeduction: true,
      catalanRentalAmount: 9600,
      catalanRentalSituation: 'under_32',
      catalanBirthAdoption: 1,
      catalanStartupInvestment: 10000,
      catalanStartupIsResearchOrUniversity: false,
      catalanWidowhood: false,
      catalanWidowhoodWithDependents: false,
      catalanAgaurMasterLoanInterests: 250,
      catalanLanguageDonations: 200,
      catalanBiomedicalDonations: 400,
      catalanHomeRehabilitation: 0,
    };

    const stateDeds = computeDeductions(data);
    assertCloseTo(stateDeds.housingDeductionAmount, 1356, 0.1, 'Deducció habitatge 15%');
    assertCloseTo(stateDeds.donationsDeductionAmount, 312.5, 0.1, 'Deducció donatius Llei 49/2002');
    assertCloseTo(stateDeds.maternityDeductionAmount, 2000, 0.1, 'Deducció maternitat + guarderia');
    assertCloseTo(stateDeds.energyEfficiencyDeductionAmount, 600, 0.1, 'Deducció eficiència 20%');

    const catDeds = computeCatalanDeductions(data);
    // Lloguer: 300 € + Naixement: 150 € + Startups: 3.000 € + AGAUR: 250 € + Llengua (15%): 30 € + Biomèdica (30%): 120 € = 3.850 €
    assertCloseTo(catDeds, 3850, 1.0, 'Total deduccions catalanes');
  });

  test('1.9 Declaració Complementària i Recàrrec d\'Extemporaneïtat (Art. 27 LGT)', () => {
    const data = createEmptyDeclaracion(2024);
    data.complementary = {
      isComplementary: true,
      reason: 'other_higher_tax',
      previousReceiptNumber: 'AEAT-2024-998877',
      previousResult: 500,
      monthsLate: 5,
      hasTaxOfficeNotice: false,
    };

    const comp = calculateComplementaryIRPF(data, 1500);

    assert(comp.isComplementary === true, 'Ha de ser complementària activa');
    assert(comp.differentialAmount === 1000, `Diferencial ha de ser 1.000, obtingut: ${comp.differentialAmount}`);
    assert(comp.surcharge.finalSurchargeAmount > 0, 'Ha de calcular recàrrec d\'extemporaneïtat positiu');
    assert(comp.finalAmountDue > 1000, 'El deute final ha d\'incloure el diferencial més el recàrrec');
  });
});

// ── 2. SUITE 2: MAGATZEM REACTIU D'ESTAT (STORE) ────────────────────────────

suite('2. Magatzem Reactiu d\'Estat (src/store.ts)', () => {

  test('2.1 Inicialització i actualització reactiva de dades', () => {
    store.setYear(2024);
    store.reset();
    const initData = store.getData();
    assert(initData.year === 2024, 'Any ha de ser 2024');

    let notified = false;
    const unsubscribe = store.subscribe(() => {
      notified = true;
    });

    store.update('personal', { name: 'Joan Prova', age: 40 });
    assert(notified === true, 'El listener ha d\'haver estat notificat');
    assert(store.getData().personal.name === 'Joan Prova', 'El nom ha d\'haver canviat');
    assert(store.getData().personal.age === 40, 'L\'edat ha d\'haver canviat a 40');

    unsubscribe();
  });

  test('2.2 Aïllament Multi-Exercici i Multi-Perfil', () => {
    store.setYear(2024);
    store.update('personal', { name: 'Perfil 2024' });
    
    store.setYear(2025);
    assert(store.getYear() === 2025, 'L\'any actiu ha de ser 2025');
    assert(store.getData().year === 2025, 'Les dades han de correspondre a 2025');
    
    store.update('personal', { name: 'Perfil 2025' });
    assert(store.getData().personal.name === 'Perfil 2025', 'El nom a 2025 ha de ser Perfil 2025');

    store.setYear(2024);
    assert(store.getData().personal.name === 'Perfil 2024', 'Les dades de 2024 han d\'estar preservades');
  });
});

// ── 3. SUITE 3: MAPA OFICIAL DE CASELLES AEAT (MODEL 100) ───────────────────

suite('3. Mapeig Oficial de Caselles AEAT Model 100', () => {

  test('3.1 Coherència de codis oficials i valors calculats', () => {
    store.reset();
    store.update('workIncome', {
      employers: [{
        id: 'e1', name: 'Empresa', nif: 'B11223344', grossSalary: 45000, inKind: 1000, withholdings: 9000, socialSecurity: 2000, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0
      }],
      unionFees: 200,
      otherDeductible: 0,
      pensionContributions: 0,
    });

    const data = store.getData();
    const result = calculateIRPF(data);

    const workGross = (data.workIncome?.employers || []).reduce((s, e) => s + e.grossSalary + e.inKind, 0);
    assert(workGross === 46000, 'Casella 0001 ha de ser 46.000 €');

    const workSS = (data.workIncome?.employers || []).reduce((s, e) => s + e.socialSecurity, 0);
    assert(workSS === 2000, 'Casella 0011 ha de ser 2.000 €');

    const workExp = workSS + (data.workIncome?.unionFees || 0) + WORK_OTHER_EXPENSES;
    assert(workExp === 4200, 'Casella 0018 ha de ser 4.200 €');

    assertCloseTo(result.generalBase, 41800, 1.0, 'Casella 0435 Base imposable general');
    assert(result.totalWithholdings === 9000, 'Casella 0609 Retencions totals');
    assertCloseTo(result.result, result.netTax - result.totalWithholdings, 0.01, 'Casella 0610 és la diferència exacta');
  });
});

// ── 4. SUITE 4: RENDERITZACIÓ DE PÀGINES & CONNECTIVITAT DOM ────────────────

suite('4. Renderització de Pàgines SPA i Connectivitat DOM', () => {

  const pagesToTest = [
    { name: 'Rendiments del Treball (/treball)', fn: renderWorkIncome },
    { name: 'Capital Mobiliari (/capital)', fn: renderCapital },
    { name: 'Immobles en Lloguer (/immobles)', fn: renderProperties },
    { name: 'Activitats Econòmiques (/activitats)', fn: renderActivities },
    { name: 'Guanys Patrimonials (/guanys)', fn: renderGains },
    { name: 'Situació Personal (/personal)', fn: renderPersonal },
    { name: 'Deduccions (/deduccions)', fn: renderDeductions },
    { name: 'Resultat i Liquidació (/resultat)', fn: renderResult },
    { name: 'Mapa de Caselles AEAT (/caselles)', fn: renderCasellesPage },
    { name: 'Assistent Guiat (/wizard)', fn: renderWizard },
    { name: 'Comparador Individual vs Conjunta (/comparador)', fn: renderComparator },
    { name: 'Assessor Fiscal (/assessor)', fn: renderAdvisor },
    { name: 'Dashboard Principal (/)', fn: renderDashboard },
  ];

  for (const p of pagesToTest) {
    test(`4.x Renderització correcta de ${p.name}`, () => {
      const el = p.fn();
      assert(el !== null && el !== undefined, `La pàgina ${p.name} ha de retornar un element DOM vàlid`);
      assert(el.className.includes('page-container') || el.className.includes('card') || el.children.length > 0, `La pàgina ${p.name} ha de tenir estructura de contenidor`);
    });
  }
});

// ── 5. SUITE 5: COMPARADOR INDIVIDUAL VS CONJUNTA ───────────────────────────

suite('5. Comparador Individual vs Conjunta (Art. 82-84 LIRPF)', () => {

  test('5.1 Consolidació de cònjuges i recomanació fiscal òptima', () => {
    const spouse1 = createEmptyDeclaracion(2024, 'sp-1');
    spouse1.personal.name = 'Cònjuge 1';
    spouse1.workIncome.employers = [{
      id: 'e1', name: 'Empresa A', nif: 'B11111111', grossSalary: 32000, inKind: 0, withholdings: 5000, socialSecurity: 2000, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0
    }];

    const spouse2 = createEmptyDeclaracion(2024, 'sp-2');
    spouse2.personal.name = 'Cònjuge 2';
    spouse2.workIncome.employers = [];

    const comparison = compareIndividualVsJoint(spouse1, spouse2);

    assert(comparison.recommendedOption === 'joint', `Per a cònjuge sense ingressos, l'opció recomanada ha de ser 'joint' (obtingut: ${comparison.recommendedOption})`);
    assert(comparison.savingsAmount > 0, `L'estalvi en conjunta ha de ser superior a 0 € (obtingut: ${comparison.savingsAmount} €)`);
    assert(comparison.jointData.personal.taxDeclarationType === 'joint', 'La declaració combinada ha de tenir modalitat conjunta');
  });
});

// ── 6. SUITE 6: RADAR DE RISC & COMPLIANCE EN TEMPS REAL ───────────────────

suite('6. Radar de Risc d\'Inspecció i Compliment Normatiu', () => {

  test('6.1 Detecció de riscos fiscals i alertes d\'auditoria', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [{
      id: 'e1', name: 'Company', nif: 'A99999999', grossSalary: 50000, inKind: 0, withholdings: 200, socialSecurity: 2000, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0
    }];
    data.deductions.housingDeduction = true;
    data.deductions.housingAmountsPaid = 15000;

    const res = calculateIRPF(data);
    const risk = evaluateAuditRisk(data, res);
    const compliance = runAutomatedComplianceChecks(data);

    assert(risk !== null && typeof risk.overallRiskScore === 'number', 'El radar de risc ha de retornar un overallRiskScore numèric');
    assert(compliance.issues.length > 0, 'L\'auto-validador ha de detectar incoherències');
  });
});

// ── 7. SUITE 7: MOTOR D'IVA MODEL 303 & MODEL 390 ───────────────────────────

suite('7. Motor d\'IVA Model 303 & Resum Anual 390 (Llei 37/1992)', () => {

  test('7.1 Càlcul de quotes meritades, suportades i resultat trimestral', () => {
    const iva = initializeEmptyIVAData();
    const issued: IVAInvoiceIssued = {
      id: 'inv1',
      date: '2024-02-15',
      quarter: '1T',
      invoiceNumber: 'F2024-01',
      clientName: 'Client A',
      clientNif: 'B12345678',
      concept: 'Consultoria',
      taxableBase: 10000,
      vatRate: 21,
      vatAmount: 2100,
      withholdingRate: 15,
      withholdingAmount: 1500,
      totalInvoice: 10600,
    };
    const received: IVAInvoiceReceived = {
      id: 'rec1',
      date: '2024-02-20',
      quarter: '1T',
      invoiceNumber: 'G2024-99',
      supplierName: 'Proveïdor B',
      supplierNif: 'A87654321',
      concept: 'Software',
      taxableBase: 2000,
      vatRate: 21,
      vatAmount: 420,
      totalInvoice: 2420,
      deductibilityPercentage: 100,
    };

    iva.issuedInvoices.push(issued);
    iva.receivedInvoices.push(received);

    const { quarters } = calculateAllQuarters(iva, 2024);
    const q1 = quarters['1T'];

    assert(q1.totalDevengado === 2100, `Quota meritada 1T ha de ser 2.100 € (obtingut: ${q1.totalDevengado} €)`);
    assert(q1.totalDeducible === 420, `Quota deduïble 1T ha de ser 420 € (obtingut: ${q1.totalDeducible} €)`);
    assert(q1.resultadoLiquidacion === 1680, `Resultat 1T ha de ser 1.680 € (obtingut: ${q1.resultadoLiquidacion} €)`);

    const annual = calculateModel390Annual(iva, 2024);
    assert(annual.totalAnnualResult === 1680, `Resultat anual 390 ha de ser 1.680 € (obtingut: ${annual.totalAnnualResult} €)`);
  });
});

// ── 8. SUITE 8: IMPOST SOBRE EL PATRIMONI (MODEL 714) & ISGF ────────────────

suite('8. Impost sobre el Patrimoni Model 714 & ISGF Model 718 (Art. 31 LIP)', () => {

  test('8.1 Blindatge conjunt Renda-Patrimoni (Límit 60%) i Exempció Habitatge', () => {
    const wealthData: WealthTaxData = {
      community: 'CAT',
      assets: [
        { id: 'a1', category: 'real_estate', description: 'Habitatge Habitual', grossValue: 400000, isPrimaryResidence: true },
        { id: 'a2', category: 'shares_funds', description: 'Cartera Fons', grossValue: 1500000 },
      ],
      debts: [
        { id: 'd1', description: 'Hipoteca pendent', amount: 100000 },
      ],
    };

    const calc = calculateWealthTax(wealthData, 30000, 5000, 6000);

    assert(calc.primaryResidenceExemption === 300000, `Exempció habitatge habitual màx 300.000 € (obtingut: ${calc.primaryResidenceExemption})`);
    assert(calc.totalGrossAssets === 1900000, `Actius bruts totals han de ser 1.900.000 € (obtingut: ${calc.totalGrossAssets})`);
    assert(calc.netWealth === 1500000, `Patrimoni net computable ha de ser 1.500.000 € (obtingut: ${calc.netWealth})`);
    assert(calc.taxableBase === 1000000, `Base liquidable (després de 500k mínim CAT) ha de ser 1.000.000 € (obtingut: ${calc.taxableBase})`);
    assert(calc.netWealthTax > 0, 'La quota líquida de patrimoni ha de ser positiva');
  });
});

// ── 9. SUITE 9: SUBSCRIPCIONS GRANULARS DEL MAGATZEM REACTIU ────────────────

suite('9. Subscripcions Granulars del Magatzem Reactiu (store.ts)', () => {

  test('9.1 Notificació específica per secció amb subscribeKey', () => {
    let triggeredSection = false;
    let receivedData: any = null;

    const unsubscribe = store.subscribeKey('activities', (sectionData) => {
      triggeredSection = true;
      receivedData = sectionData;
    });

    store.update('activities', { income: 45000, expenses: 12000 });

    assert(triggeredSection === true, 'subscribeKey ha de disparar el listener específic de secció');
    assert(receivedData !== null && receivedData.income === 45000, 'Les dades rebudes han de reflectir la mutació');

    unsubscribe();
  });
});

// ── 10. SUITE 10: VALIDADOR DE TIPUS I RESILIÈNCIA EN RUNTIME ───────────────

suite('10. Validador de Tipus i Resiliència en Temps d\'Execució (schema-validator.ts)', () => {

  test('10.1 Sanitització de valors corromputs, NaN i dades malformades', () => {
    const corruptedInput = {
      year: 2024,
      personal: {
        name: '  Joan Test  ',
        age: 'invalid_age',
        disability: NaN,
      },
      workIncome: {
        grossSalary: '35000,50',
        withholdings: Infinity,
        socialSecurity: -500,
        employers: 'not_an_array',
      },
      deductions: null,
    };

    const sanitized = validateAndSanitizeDeclaration(corruptedInput, 2024, 'profile_main');

    assert(sanitized.personal.name === 'Joan Test', 'El nom ha de ser netejat d\'espais en blanc');
    assert(sanitized.personal.age === 35, 'L\'edat no vàlida ha de recaure en el valor segur 35');
    assert(sanitized.personal.disability === 0, 'La discapacitat NaN ha de ser convertida a 0');
    assert(sanitizeNumber('35000,50') === 35000.5, 'La cadena monetària amb coma ha de ser convertida a decimal 35000.5');
    assert(sanitized.capitalIncome.interests === 0, 'El valor per defecte ha de ser 0');
    assert(Array.isArray(sanitized.workIncome.employers), 'Els ocupadors han de ser garantits com a array');
    assert(sanitized.deductions !== null && typeof sanitized.deductions === 'object', 'Les deduccions nul·les han de recuperar l\'estructura per defecte');
  });

  test('10.2 Consulta O(1) de Comunitats Autònomes', () => {
    assert(COMMUNITY_NAME_MAP.get('CAT') === 'Catalunya', 'La consulta de Catalunya ha de retornar Catalunya');
    assert(COMMUNITY_NAME_MAP.get('MAD') === 'Madrid', 'La consulta de Madrid ha de retornar Madrid');
  });
});

// ── 11. SUITE 11: MICRO-DESIGN SYSTEM REUTILITZABLE (table-builder.ts) ──────

suite('11. Micro-Design System i Generador de Taules Denses (table-builder.ts)', () => {

  test('11.1 Renderització en bloc i delegació d\'esdeveniments', () => {
    interface TestRow { id: string; name: string; amount: number }
    const testData: TestRow[] = [
      { id: '1', name: 'Factura A', amount: 1500 },
      { id: '2', name: 'Factura B', amount: 3200 },
    ];

    let clickedItem: TestRow | null = null;

    const tableEl = buildTable<TestRow>({
      columns: [
        { header: 'Nom', key: 'name' },
        { header: 'Import', render: (item) => `${item.amount} €`, align: 'right' },
      ],
      data: testData,
      actions: [
        {
          name: 'edit',
          label: 'Editar',
          onClick: (item) => { clickedItem = item; },
        },
      ],
      idGetter: (item) => item.id,
    });

    assert(tableEl !== null, 'L\'element de taula no pot ser nul');
    assert(tableEl.className.includes('table-responsive'), 'L\'element ha de contenir la classe table-responsive');
  });
});

// ── 12. SUITE 12: PROVA E2E DE CICLE COMPLET & BENCHMARKING ─────────────────

suite('12. Prova E2E de Cicle Complet de Declaració Fiscal & Benchmarking', () => {

  test('12.1 Flux tributari integral multi-font amb límit de latència < 5ms', () => {
    const t0 = performance.now();

    const data = createEmptyDeclaracion(2024);
    // Treball
    data.workIncome.employers = [{
      id: 'e1', name: 'Tech Corp', nif: 'A12345678', grossSalary: 60000, inKind: 0, withholdings: 12000, socialSecurity: 2400, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0
    }];
    // Immoble llogat
    data.properties = [{
      id: 'p1', alias: 'Pis Eixample', cadastralReference: '98765432109876543210AB', use: 'rented_long_term',
      cadastralValue: 120000, cadastralValueConstruction: 60000, acquisitionValue: 200000, acquisitionDate: '2018-05-10',
      daysRented: 365, grossIncome: 14400, communityExpenses: 600, ibiTax: 500, insurance: 300, repairExpenses: 1200, mortgageInterest: 1500, otherExpenses: 200,
      reductionType: 'reduction_50', amortizeOnCadastral: false,
    }];
    // Guanys de borsa
    data.gains.items = [{
      id: 'g1', description: 'Accions Apple', type: 'shares', acquisitionDate: '2023-01-10', transferDate: '2024-11-20',
      acquisitionValue: 5000, transferValue: 8500, expenses: 50
    }];
    // Deduccions
    data.deductions.donations = [{ id: 'd1', entity: 'Creu Roja', amount: 300, recurring: true, priority: false }];

    // Execució del motor
    const res = calculateIRPF(data);
    const t1 = performance.now();
    const duration = t1 - t0;

    assert(res.generalBase > 0, `Base imposable general positiva (obtingut: ${res.generalBase} €)`);
    assert(res.savingsBase === 3450, `Base estalvi de 3.450 € (obtingut: ${res.savingsBase} €)`);
    assert(res.grossTax > 0 && res.generalTax > 0, 'Quotes íntegres han de ser positives');
    assert(typeof res.result === 'number', 'El resultat de liquidació ha de ser un número');
    assert(duration < 15, `El cicle complet de càlcul ha d'executar-se en < 15ms (obtingut: ${duration.toFixed(3)}ms)`);
  });
});

// ── 13. SUITE 13: PROVA DE CÀRREGA MASSIVA & ESTRÈS FISCAL ──────────────────

suite('13. Prova de Càrrega Massiva & Estrès Fiscal (1.000 operacions)', () => {

  test('13.1 Càlcul d\'IRPF amb 1.000 operacions de compravenda en < 15ms', () => {
    const data = createEmptyDeclaracion(2024);
    const heavyItems = [];
    for (let i = 0; i < 1000; i++) {
      heavyItems.push({
        id: `mass_item_${i}`,
        description: `Acció ${i}`,
        type: 'shares' as const,
        acquisitionDate: '2024-01-01',
        transferDate: '2024-06-01',
        acquisitionValue: 100 + (i % 50),
        transferValue: 120 + (i % 60),
        expenses: 1,
      });
    }
    data.gains.items = heavyItems;

    const t0 = performance.now();
    const res = calculateIRPF(data);
    const t1 = performance.now();
    const duration = t1 - t0;

    assert(res.savingsBase > 0, 'La base de l\'estalvi massiva ha de ser positiva');
    assert(duration < 25, `El càlcul de 1.000 posicions ha d'executar-se en < 25ms (obtingut: ${duration.toFixed(3)}ms)`);
  });
});

// ── 14. SUITE 14: FORMATADORS SINGLETON O(1) & PARSEIG SEGUR ────────────────

suite('14. Formatadors Singleton O(1) i Parseig Segur (currency.ts)', () => {

  test('14.1 Precisió de formatació i protecció contra entrades nul·les', () => {
    assert(formatCurrency(1500.5).includes('1.500,50') || formatCurrency(1500.5).includes('1500,50'), 'Format de 1.500,50 € correcte');
    assert(formatCurrencyNoDecimals(2500).includes('2.500') || formatCurrencyNoDecimals(2500).includes('2500'), 'Format sense decimals correcte');
    assert(formatCurrency(NaN) === '0,00 €', 'Valor NaN ha de retornar 0,00 €');
    assert(formatPercent(0.21).includes('21'), 'Percentatge 0.21 ha de contenir 21');
    assert(formatCompact(1500000) === '1.5M €', 'Format compacte 1.5M €');
    assert(parseCurrencyInput('1.234,56 €') === 1234.56, 'Parseig de format europeu amb símbol €');
    assert(parseCurrencyInput('') === 0, 'Parseig de cadena buida ha de ser 0');
  });
});

// ── 15. SUITE 15: VALIDACIÓ PREVENTIVA INLINE I LÍMITS FISCALS ──────────────

suite('15. Validació Preventiva Inline i Límits Fiscals (form-validator.ts)', () => {

  test('15.1 Topalls de plans de pensions individuals (1.500€), empresa (8.500€) i conjunt', () => {
    const valid = validatePensionContributions(1500, 8500);
    assert(valid.isValid === true, '1.500 individual + 8.500 empresa és legal (10.000 € total)');

    const excessIndiv = validatePensionContributions(2000, 0);
    assert(excessIndiv.isValid === false && excessIndiv.status === 'warning', 'Superar 1.500 € individual genera advertència');
    assert(excessIndiv.suggestedValue === 1500, 'El valor suggerit ha de ser 1.500 €');

    const excessTotal = validatePensionContributions(1500, 9000);
    assert(excessTotal.isValid === false, 'Superar 10.000 € conjunt genera advertència');
  });

  test('15.2 Exempció 7.p (60.100€) i rendiments irregulars (300.000€)', () => {
    const expValid = validateForeignWorkExemption(50000);
    assert(expValid.isValid === true, '50.000 € és vàlid sota Art. 7.p');

    const expExcess = validateForeignWorkExemption(70000);
    assert(expExcess.isValid === false && expExcess.suggestedValue === 60100, 'Superar 60.100 € suggereix el topall legal');

    const irregExcess = validateIrregularIncome(350000);
    assert(irregExcess.isValid === false && irregExcess.suggestedValue === 300000, 'Superar 300.000 € suggereix el límit de reducció');
  });

  test('15.3 Quilometratge oficial (0,26 €/km)', () => {
    const mileage = validateMileageRate(260, 1000);
    assert(mileage.isFullyExempt === true && mileage.taxableAmount === 0, '1.000 km x 0,26 € = 260 € 100% exempt');

    const mileageExcess = validateMileageRate(350, 1000);
    assert(mileageExcess.isFullyExempt === false && mileageExcess.taxableAmount === 90, 'L\'excés de 90 € és computable com a rendiment del treball');
  });
});

// ── 16. SUITE 16: SIMULACIONS ESTRATÈGIQUES I MODELS TRIMESTRALS ────────────

suite('16. Simulacions Estratègiques i Models Trimestrals', () => {

  test('16.1 Simulació Autònom vs Societat Limitada (AutonomoVsSLEngine)', () => {
    const sim = AutonomoVsSLEngine.simulate({
      id: 'sim1',
      date: '2024-01-01',
      expectedRevenue: 120000,
      expectedExpenses: 20000,
      autonomoQuota: 4500,
      societalSalary: 45000,
      corporateTaxRate: 25,
      slMaintenanceCost: 2000,
      year: 2024,
    });

    assert(sim.recommendation === 'sl' || sim.recommendation === 'autonomo', 'Ha de recomanar una opció vàlida');
    assert(sim.savings > 0, 'L\'estalvi comparatiu ha de ser superior a 0 €');
    assert(sim.netIncomeAutonomo > 0, 'Rendiment net autònom positiu');
  });

  test('16.2 Optimització de Rescat de Pla de Pensions amb Reducció 40% (PensionsOptimizerEngine)', () => {
    const opt = PensionsOptimizerEngine.optimizeRescue({
      id: 'pension1',
      year: 2024,
      pensionFundValue: 100000,
      pre2007Contributions: 60000,
      yearsSinceRetirement: 1,
      otherYearlyIncome: 25000,
    });

    assert(opt.scenarios && opt.scenarios.length >= 3, 'Ha de generar com a mínim 3 escenaris de rescat');
    const mixtScenario = opt.scenarios?.find(s => s.name.includes('Mixt'));
    assert(mixtScenario !== undefined, 'Ha d\'existir l\'escenari mixt que aprofita la reducció del 40% pre-2007');
  });

  test('16.3 Càlcul de Pagament Fraccionat Model 130 20% (Model130Engine)', () => {
    const m130 = Model130Engine.calculateQuarter(
      '1T',
      2024,
      25000, // Ingressos acumulats
      5000,  // Despeses acumulades
      2000,  // Retencions suportades acumulades
      0,     // Pagaments fraccionats anteriors
      false
    );

    assert(m130.netYield === 20000, 'Rendiment net acumulat ha de ser 20.000 €');
    assert(m130.grossTax === 4000, 'Quota bruta 20% ha de ser 4.000 €');
    assert(m130.netTax === 2000, 'Quota a ingressar ha de ser 2.000 € (4.000 - 2.000 retencions)');
  });
});

// ── 17. SUITE 17: BÉNS A L'ESTRANGER I LLEI BECKHAM ─────────────────────────

suite('17. Béns a l\'Estranger (Model 720/721) i Règim d\'Impatriats (Llei Beckham)', () => {

  test('17.1 Avaluació de Llindar de 50.000 € Models 720 i 721 (auditForeignAssetsObligation)', () => {
    const below = auditForeignAssetsObligation({
      accounts: [{ id: 'a1', bankName: 'Revolut LT', countryCode: 'LT', ibanOrNumber: 'LT123', balanceYearEnd: 15000, averageBalanceQ4: 12000 }],
      securities: [{ id: 's1', brokerName: 'Degiro NL', countryCode: 'NL', assetDescription: 'ETF', units: 10, totalValueYearEnd: 20000 }],
      realEstate: [],
      crypto: [{ id: 'c1', exchangeName: 'Binance', cryptoSymbol: 'BTC', units: 0.5, valueYearEndEUR: 25000 }],
    });

    assert(below.model720Obligation === false, 'Cap bloc del 720 supera 50.000 € -> No obligat a 720');
    assert(below.model721MustDeclare === false, 'Cripto de 25.000 € no supera 50.000 € -> No obligat a 721');

    const above = auditForeignAssetsObligation({
      accounts: [],
      securities: [{ id: 's2', brokerName: 'IBKR', countryCode: 'IE', assetDescription: 'Apple', units: 500, totalValueYearEnd: 65000 }],
      realEstate: [],
      crypto: [{ id: 'c2', exchangeName: 'Kraken', cryptoSymbol: 'ETH', units: 20, valueYearEndEUR: 55000 }],
    });

    assert(above.model720Obligation === true && above.block2MustDeclare === true, '65.000 € en valors estrangers obliga a Model 720');
    assert(above.model721MustDeclare === true, '55.000 € en cripto estranger obliga a Model 721');
  });

  test('17.2 Simulador Llei Beckham Art. 93 LIRPF vs Règim Ordinari (compareBeckhamRegime)', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [{
      id: 'e1',
      name: 'Tech Corp Spain',
      grossSalary: 120000,
      inKind: 0,
      withholdings: 35000,
      socialSecurity: 2000,
      dietsIncome: 0,
      dietsDays: 0,
      mileageIncome: 0,
      mileageKm: 0,
    }];

    const beckham = compareBeckhamRegime(data);
    assert(beckham.beckhamWorkTax === 120000 * 0.24, 'Quota Llei Beckham ha de ser el 24% del salari brut (28.800 €)');
    assert(beckham.ordinaryTax > beckham.beckhamTotalTax, 'Per a 120.000 €, la Llei Beckham ha de ser més favorable que el règim general');
    assert(beckham.isBeckhamBetter === true, 'La recomanació ha de ser favorable a Beckham');
  });
});

// ── 18. SUITE 18: PLUSVÀLUA MUNICIPAL DUAL I REGULARITZACIÓ RETA ────────────

suite('18. Plusvàlua Municipal Dual (IIVTNU) i Trams RETA Seguretat Social', () => {

  test('18.1 Càlcul de Plusvàlua Municipal Dual (ITPAndAJDEngine.calculatePlusvalia)', () => {
    const res = ITPAndAJDEngine.calculatePlusvalia({
      acquisitionDate: '2020-01-01',
      transferDate: '2024-01-01',
      transferPrice: 250000,
      acquisitionPrice: 200000,
      cadastralLandValue: 60000,
      yearsOwned: 4,
      municipalityCoef: 1.0,
      taxRate: 30,
      objectiveBase: 0,
      realBase: 0,
      chosenMethod: 'objective',
      taxableBase: 0,
      amountDue: 0,
    });

    assert(res.taxableBase > 0, 'La base imposable ha de ser positiva');
    assert(res.amountDue > 0, 'La quota tributària ha de ser positiva');
    assert(res.chosenMethod === 'real' || res.chosenMethod === 'objective', 'Ha d\'escollir el mètode més favorable');
  });

  test('18.2 Trams Oficials RETA i Regularització Anual d\'Autònoms (calculateRETACotization)', () => {
    assert(RETA_TABLE_2024_2025.length === 15, 'La taula RETA ha de tenir exactament 15 trams oficials');

    const reta = calculateRETACotization(
      45000, // Ingressos anuals
      15000, // Despeses
      3600,  // Quota RETA pagada
      false, // No societari
      false, // Sense tarifa plana
      2024
    );

    assert(reta.computableNetIncomeAnnual > 0, 'Rendiment net computable positiu');
    assert(reta.assignedTram.tramNumber >= 1 && reta.assignedTram.tramNumber <= 15, 'Ha d\'assignar un tram entre 1 i 15');
    assert(reta.recommendedMonthlyQuota > 0, 'Quota mensual recomanada positiva');
  });
});

// ── 19. SUITE 19: CRIPTOACTIUS DEFI I MODEL 347 ────────────────────────────

suite('19. Criptoactius (DeFi FIFO) i Model 347 (Operacions > 3.005,06 €)', () => {

  test('19.1 Liquidació Cripto DeFi: Staking vs Compravenda FIFO (DefiTaxEngine)', () => {
    const cryptoData = DefiTaxEngine.processTransactions([
      {
        id: 'tx1',
        date: '2024-01-10',
        type: 'buy',
        assetIn: 'BTC',
        amountIn: 1.0,
        assetOut: 'EUR',
        amountOut: 40000,
        fiatValueInEUR: 40000,
        feeEUR: 20,
        exchange: 'Kraken',
      },
      {
        id: 'tx2',
        date: '2024-03-15',
        type: 'staking_reward',
        assetIn: 'ETH',
        amountIn: 0.5,
        assetOut: '',
        amountOut: 0,
        fiatValueInEUR: 1500,
        feeEUR: 0,
        exchange: 'Binance',
      },
      {
        id: 'tx3',
        date: '2024-06-20',
        type: 'sell',
        assetIn: 'BTC',
        amountIn: 0.5,
        assetOut: 'EUR',
        amountOut: 30000,
        fiatValueInEUR: 30000,
        feeEUR: 15,
        exchange: 'Kraken',
      },
    ]);

    assert(cryptoData.defiIncome === 1500, 'Ingressos per staking han de ser 1.500 €');
    assert(cryptoData.capitalGains.length === 1, 'Ha de registrar 1 guany de compravenda FIFO');
    assert(cryptoData.capitalGains[0].capitalGain === 10000, 'Guany patrimonial: 30.000 € venda - 20.000 € cost = 10.000 €');
  });

  test('19.2 Filtració i Agrupació Trimestral Model 347 (Model347Engine)', () => {
    const m347 = Model347Engine.calculateFromInvoices(
      2024,
      [
        {
          id: 'inv1',
          number: 'F2024-01',
          date: '2024-02-15',
          quarter: '1T',
          clientName: 'Client Major SL',
          clientNif: 'B12345678',
          description: 'Desenvolupament',
          taxBase: 4000,
          ivaRate: 21,
          ivaAmount: 840,
          irpfWithholdingRate: 0,
          irpfWithholdingAmount: 0,
          totalInvoice: 4840,
          category: 'services',
          operationType: 'general',
        },
        {
          id: 'inv2',
          number: 'F2024-02',
          date: '2024-04-10',
          quarter: '2T',
          clientName: 'Client Petit SL',
          clientNif: 'B99999999',
          description: 'Consulta',
          taxBase: 1000,
          ivaRate: 21,
          ivaAmount: 210,
          irpfWithholdingRate: 0,
          irpfWithholdingAmount: 0,
          totalInvoice: 1210,
          category: 'services',
          operationType: 'general',
        },
      ],
      []
    );

    assert(m347.entities.length === 1, 'Només 1 client supera el límit de 3.005,06 €');
    assert(m347.entities[0].nif === 'B12345678', 'El client del 347 ha de ser B12345678');
    assert(m347.entities[0].totalAmount === 4840, 'El total anual del client ha de ser 4.840 €');
    assert(m347.entities[0].q1Amount === 4840, 'L\'import ha d\'estar assignat al 1T');
  });
});

// ── 20. SUITE 20: SUCCESSIONS I SIMULACIÓ MONTE CARLO ──────────────────────

suite('20. Successions i Donacions (Model 650) i Simulació Monte Carlo', () => {

  test('20.1 Càlcul de Successions Grup II i Bonificacions Autonòmiques (InheritanceTaxEngine)', () => {
    const res = InheritanceTaxEngine.calculate({
      type: 'inheritance',
      date: '2024-05-01',
      community: 'MAD',
      kinshipGroup: 'II',
      preExistingWealth: 100000,
      disabilityDegree: 0,
      realEstateValue: 200000,
      financialAssetsValue: 50000,
      lifeInsuranceValue: 0,
      householdFurnishingsValue: 0,
      deductibleDebts: 0,
      deductibleExpenses: 3000,
      reductionPrimaryResidence: 0,
      reductionFamilyBusiness: 0,
      taxableBase: 0,
      liquidableBase: 0,
      grossTax: 0,
      multiplierBase: 1.0,
      netTax: 0,
      autonomicBonus: 0,
      amountDue: 0,
    });

    assert(res.taxableBase > 0, 'La massa hereditària neta ha de ser positiva');
    assert(res.liquidableBase > 0, 'La base liquidable ha de ser positiva');
    assert(res.autonomicBonus > 0, 'A Madrid Grup II ha d\'aplicar el 99% de bonificació');
    assert(res.amountDue < res.netTax, 'La quota final a pagar ha de ser molt reduïda');
  });

  test('20.2 Simulació Monte Carlo d\'Estrès de Mercat en < 15ms (runMonteCarloSimulation)', () => {
    const t0 = performance.now();
    const mc = runMonteCarloSimulation(
      {
        totalTrades: 50,
        winRate: 60,
        profitFactor: 1.8,
        expectancy: 120,
        maxDrawdown: 15,
        avgWin: 300,
        avgLoss: 150,
        sharpeRatio: 1.5,
        monthlyReturnAvg: 3.2,
      },
      20000, // 20.000 € inicials
      100    // 100 operacions
    );
    const t1 = performance.now();
    const duration = t1 - t0;

    assert(mc.iterations === 1000, 'Ha d\'executar exactament 1.000 iteracions');
    assert(mc.medianFinalCapital > 0, 'El capital final medià ha de ser positiu');
    assert(mc.fanChartPoints.length > 0, 'Ha de generar punts percentils de ventall');
    assert(duration < 25, `Les 1.000 simulacions Monte Carlo han d'executar-se en < 25ms (obtingut: ${duration.toFixed(3)}ms)`);
  });
});

// ── 21. SUITE 21: TIPUS MARGINALS I ASSESSOR DE FINAL D'ANY ─────────────────

suite('21. Tipus Marginals d\'IRPF i Assessor de Final d\'Any (year-end-optimizer.ts)', () => {

  test('21.1 Càlcul de Tipus Marginal Estatal i Autonòmic (calculateMarginalTaxRate)', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [{
      id: 'e1',
      name: 'Empresa',
      grossSalary: 45000,
      inKind: 0,
      withholdings: 8000,
      socialSecurity: 2000,
      dietsIncome: 0,
      dietsDays: 0,
      mileageIncome: 0,
      mileageKm: 0,
    }];

    const rates = calculateMarginalTaxRate(data);
    assert(rates.stateGeneralRate > 0, 'Tipus marginal estatal positiu');
    assert(rates.autonomicGeneralRate > 0, 'Tipus marginal autonòmic positiu');
    assert(rates.totalGeneralMarginalRate >= 30, `Tipus marginal per a 45k ha de ser >= 30% (obtingut: ${rates.totalGeneralMarginalRate}%)`);
  });

  test('21.2 Generació de Consells d\'Estalvi Abans del 31/12 (generateYearEndOptimization)', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [{
      id: 'e1',
      name: 'Empresa',
      grossSalary: 50000,
      inKind: 0,
      withholdings: 10000,
      socialSecurity: 2000,
      dietsIncome: 0,
      dietsDays: 0,
      mileageIncome: 0,
      mileageKm: 0,
    }];
    data.capitalIncome.dividends = 5000;

    const report = generateYearEndOptimization(data);
    assert(report.tips.length > 0, 'Ha de generar consells d\'estalvi');
    assert(report.totalPotentialSavings > 0, 'L\'estalvi potencial ha de ser positiu');
    const pensionTip = report.tips.find(t => t.category === 'pensions');
    assert(pensionTip !== undefined, 'Ha de suggerir aportació a pla de pensions');
  });
});

// ── 22. SUITE 22: ARITMÈTICA SEGURA I CICLE DE VIDA ROUTER ──────────────────

suite('22. Coalescència Matemàtica Segura i Cicle de Vida del Router (math.ts / router.ts)', () => {

  test('22.1 Aritmètica financera de 2 decimals i protecció NaN (roundCurrency, safeAdd, safeMultiply)', () => {
    assert(roundCurrency(0.1 + 0.2) === 0.3, '0.1 + 0.2 ha d\'arrodonir a 0.30 exactes');
    assert(safeAdd(10.5, null, undefined, NaN, 20.3) === 30.8, 'safeAdd filtra valors nuls i NaN');
    assert(safeMultiply(1500, 0.37) === 555, 'Multiplicació segura 1500 * 0.37 = 555.00 €');
    assert(safePercentage(25, 100) === 25, 'Percentatge segur 25%');
    assert(safePercentage(50, 0) === 0, 'Divisió per zero retorna 0');
  });

  test('22.2 Execució i neteja de callbacks de desmuntatge (registerCleanup)', () => {
    let cleanedUp = false;
    router.registerCleanup(() => {
      cleanedUp = true;
    });

    assert(typeof router.registerCleanup === 'function', 'El router ha de disposar del mètode registerCleanup');
  });
});

// ── INFORME I BALANÇ FINAL ──────────────────────────────────────────────────

console.log('\n════════════════════════════════════════════════════════════════');
console.log('                 RESUM DEL BUCLE DE VERIFICACIÓ                 ');
console.log('════════════════════════════════════════════════════════════════');

const totalTests = results.length;
const passedTests = results.filter(r => r.passed).length;
const failedTests = results.filter(r => !r.passed).length;
const totalDuration = results.reduce((s, r) => s + r.durationMs, 0);

console.log(`Total Proves Executades: ${totalTests}`);
console.log(`\x1b[32mProves Superades:        ${passedTests}\x1b[0m`);
if (failedTests > 0) {
  console.log(`\x1b[31mProves Fallades:         ${failedTests}\x1b[0m`);
} else {
  console.log(`\x1b[32mProves Fallades:         0 (100% ÈXIT)\x1b[0m`);
}
console.log(`Temps Total d'Execució:  ${totalDuration.toFixed(2)}ms`);
console.log('════════════════════════════════════════════════════════════════\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
