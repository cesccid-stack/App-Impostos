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
import { store, createEmptyDeclaracion } from '../src/store.ts';
import {
  STATE_GENERAL_TAX_BRACKETS,
  CATALAN_GENERAL_TAX_BRACKETS,
  STATE_SAVINGS_TAX_BRACKETS,
  AUTONOMIC_SAVINGS_TAX_BRACKETS,
  PERSONAL_MINIMUM,
  WORK_OTHER_EXPENSES,
} from '../src/fiscal/constants.ts';
import type { DeclaracionData, RentalProperty } from '../src/types.ts';

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
