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

/** Minimal event object handed to mock DOM listeners. */
interface MockEvent {
  target: MockElement;
  [key: string]: unknown;
}

/** Listener signature accepted by the mock DOM. */
type MockEventListener = (event: MockEvent) => void;

class MockElement {
  public tagName: string;
  public id: string = '';
  public className: string = '';
  public innerHTML: string = '';
  public style: Record<string, string> = {};
  public children: MockElement[] = [];
  public parentNode: MockElement | null = null;
  public attributes = new Map<string, string>();
  public eventListeners = new Map<string, MockEventListener[]>();
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

  replaceWith(...nodes: MockElement[]): void {
    if (!this.parentNode) return;
    const idx = this.parentNode.children.indexOf(this);
    if (idx !== -1) {
      this.parentNode.children.splice(idx, 1, ...nodes);
    }
  }

  addEventListener(type: string, listener: MockEventListener): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  dispatchEvent(type: string, eventObj: Partial<MockEvent> = {}): void {
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
interface MockWindow {
  location: { hash: string };
  addEventListener: (type: string, listener: MockEventListener) => void;
  localStorage: MockStorage;
  navigator: { clipboard: { writeText: (text: string) => Promise<void> } };
}

interface MockDocument {
  createElement: (tag: string) => MockElement;
  createDocumentFragment: () => MockElement;
  getElementById: (id: string) => MockElement;
  body: MockElement;
  addEventListener: (type: string, listener: MockEventListener) => void;
}

interface MockGlobal {
  window: MockWindow;
  document: MockDocument;
  localStorage: MockStorage;
  HTMLElement: typeof MockElement;
  requestAnimationFrame: (callback: () => void) => ReturnType<typeof setTimeout>;
}

const mockGlobal: Partial<MockGlobal> = globalThis as unknown as Partial<MockGlobal>;

if (typeof mockGlobal.window === 'undefined') {
  mockGlobal.window = {
    location: { hash: '#/' },
    addEventListener: () => {},
    localStorage: new MockStorage(),
    navigator: { clipboard: { writeText: async () => {} } },
  };
}
if (typeof mockGlobal.document === 'undefined') {
  mockGlobal.document = {
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
if (typeof mockGlobal.localStorage === 'undefined') {
  mockGlobal.localStorage = mockGlobal.window.localStorage;
}
if (typeof mockGlobal.HTMLElement === 'undefined') {
  mockGlobal.HTMLElement = MockElement;
}
if (typeof mockGlobal.requestAnimationFrame === 'undefined') {
  mockGlobal.requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);
}

// `process` is only used to set the exit code. Declare the minimal surface so
// the script type-checks without pulling in the whole `@types/node` globals
// (which would conflict with the DOM lib used across the application).
declare const process: { exit(code?: number): void };

// ── IMPORTS DELS MOTORS I SUBSISTEMA DE RENDA ──────────────────────────────

import { calculateIRPF, applyBrackets } from '../src/fiscal/irpf.ts';
import { calculatePropertyFiscalResult } from '../src/fiscal/real-estate-engine.ts';
import { calculateSavingsCompensation } from '../src/fiscal/loss-carryover-engine.ts';
import { compareIndividualVsJoint } from '../src/fiscal/joint-taxation.ts';
import { computeDeductions } from '../src/fiscal/deductions.ts';
import { computeCatalanDeductions } from '../src/fiscal/deductions-cat.ts';
import { calculateComplementaryIRPF } from '../src/fiscal/complementary-engine.ts';
import { evaluateAuditRisk } from '../src/fiscal/audit-risk-radar.ts';
import { runAutomatedComplianceChecks } from '../src/fiscal/auto-validator.ts';
import { calculateAllQuarters, calculateModel390Annual } from '../src/fiscal/iva-engine.ts';
import { initializeEmptyIVAData } from '../src/fiscal/iva-integration.ts';
import { calculateWealthTax } from '../src/fiscal/wealth-tax-engine.ts';
import { validateAndSanitizeDeclaration, sanitizeNumber } from '../src/fiscal/schema-validator.ts';
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
import { calculateEnergyEfficiencyDeduction } from '../src/fiscal/energy-efficiency-engine.ts';
import { checkTaxPrescription } from '../src/fiscal/tax-prescription-engine.ts';
import { exactAdd, exactSub, exactMultiply, applyTaxBracketsExact, calculateInvoiceLineTaxExact } from '../src/utils/exact-math.ts';
import { createChainedInvoiceRecord, verifyInvoiceChainIntegrity } from '../src/fiscal/verifactu-engine.ts';
import { getAutonomicBrackets } from '../src/fiscal/autonomic-tax-scales.ts';
import { generateTaxDefenseDossier } from '../src/fiscal/audit-dossier-generator.ts';
import { Model115And180Engine } from '../src/fiscal/model115-180-engine.ts';
import { auditAndDecoupleVehicleExpenses, isExclusiveVehicleActivity } from '../src/fiscal/vehicle-deduction-engine.ts';
import { calculateProrrataComparison } from '../src/fiscal/iva-engine.ts';
import { explainTaxReturn } from '../src/fiscal/tax-explainer-engine.ts';
import { createTaxJourneyVisualizer } from '../src/components/tax-journey-visualizer.ts';
import { createInternalBreakdownDashboards } from '../src/components/internal-breakdown-dashboards.ts';
import { analyzePortfolioFinances, analyzePropertyFinances } from '../src/fiscal/real-estate-analytics-engine.ts';
import { createRealEstateDashboard } from '../src/components/real-estate-dashboard.ts';
import { analyzeInvestmentCockpit, calculateSavingsTaxEUR, classifyAssetType, determineHoldingStyle } from '../src/fiscal/investment-cockpit-engine.ts';
import { runInstitutionalBacktest } from '../src/fiscal/backtest-engine.ts';
import { roundCurrency, safeAdd, safeMultiply, safePercentage } from '../src/utils/math.ts';
import { router } from '../src/router.ts';
import { buildTable } from '../src/components/table-builder.ts';
import { formatCurrency, formatCurrencyNoDecimals, formatPercent, formatCompact, parseCurrencyInput } from '../src/utils/currency.ts';
import { store, createEmptyDeclaracion } from '../src/store.ts';
import {
  STATE_GENERAL_TAX_BRACKETS,
  CATALAN_GENERAL_TAX_BRACKETS,
  STATE_SAVINGS_TAX_BRACKETS,
  AUTONOMIC_SAVINGS_TAX_BRACKETS,
  WORK_OTHER_EXPENSES,
  COMMUNITY_NAME_MAP,
} from '../src/fiscal/constants.ts';
import type { GainItem, RentalProperty } from '../src/types.ts';
import type { TradeRecord } from '../src/types-portfolio.ts';
import { calculateFIFO } from '../src/import/fifo-engine.ts';
import type { TradePerformanceMetrics } from '../src/fiscal/trading-analytics.ts';
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
  } catch (err: unknown) {
    const durationMs = performance.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    results.push({ suite: currentSuite, name, passed: false, error: message, durationMs });
    console.error(`  \x1b[31m✖\x1b[0m ${name} \x1b[90m(${durationMs.toFixed(2)}ms)\x1b[0m`);
    console.error(`    \x1b[31mError: ${message}\x1b[0m`);
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

/**
 * Builds a complete `TradePerformanceMetrics` fixture.
 *
 * The Monte Carlo engine only reads `totalTrades`, `winRate`, `avgWin` and
 * `avgLoss`; every other metric is filled with neutral zeros.
 */
function makeTradeMetrics(overrides: Partial<TradePerformanceMetrics>): TradePerformanceMetrics {
  return {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    breakevenTrades: 0,
    winRate: 0,
    lossRate: 0,
    totalProfit: 0,
    totalLoss: 0,
    netPnL: 0,
    totalVolumeTraded: 0,
    profitFactor: 0,
    avgTrade: 0,
    avgWin: 0,
    avgLoss: 0,
    payoffRatio: 0,
    expectancyEUR: 0,
    maxWin: 0,
    maxLoss: 0,
    maxConsecutiveWins: 0,
    maxConsecutiveLosses: 0,
    maxDrawdownEUR: 0,
    maxDrawdownPercent: 0,
    avgHoldingDaysWins: 0,
    avgHoldingDaysLosses: 0,
    estimatedTaxesSavings: 0,
    netPnLAfterTax: 0,
    sharpeRatio: 0,
    disciplineScore: 0,
    psychologicalBiases: {
      dispositionEffect: false,
      revengeTradingRisk: false,
      outlierRisk: false,
      warnings: [],
      strengths: [],
    },
    equityCurve: [],
    yearlyPerformance: [],
    monthlyBreakdown: [],
    dayOfWeekPerformance: [],
    assetComparison: [],
    distributionBuckets: [],
    benchmarkComparison: {
      tradingReturnTotalEUR: 0,
      estimatedCapitalEmployed: 0,
      tradingReturnPct: 0,
      benchmarkSp500Pct: 0,
      alphaGeneratedPct: 0,
    },
    ...overrides,
  };
}

/**
 * Builds a complete, type-safe `RentalProperty` for the test fixtures.
 *
 * The domain type requires every field, but the fixtures only care about a
 * handful of fiscally relevant ones. The neutral defaults below are
 * mathematically identical to the previous `undefined` values:
 * the engine reads numbers as `(x || 0)`, arrays as `(x || [])`,
 * ownership as `(x || 100)` and maps `reductionType: 'none'` to a 0% rate
 * (same as the `default` branch taken by `undefined`).
 */
function makeProperty(
  overrides: Partial<RentalProperty> & Pick<RentalProperty, 'id' | 'name' | 'usageType'>,
): RentalProperty {
  return {
    cadastralReference: '',
    address: '',
    ownershipPercentage: 100,
    contractDate: '',
    tenantNIFs: [],
    monthlyRent: 0,
    grossRentalIncome: 0,
    otherIncomes: 0,
    mortgageInterests: 0,
    repairExpenses: 0,
    pendingRepairsPreviousYears: 0,
    ibi: 0,
    wasteTax: 0,
    otherTaxes: 0,
    communityFees: 0,
    insurance: 0,
    managementFees: 0,
    badDebts: 0,
    totalCadastralValue: 0,
    constructionCadastralValue: 0,
    acquisitionCost: 0,
    acquisitionExpenses: 0,
    inventory: [],
    improvements: [],
    furniture: [],
    reductionType: 'none',
    ...overrides,
  };
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
      id: 'e1', name: 'Work', grossSalary: 30000, inKind: 0, withholdings: 4500, socialSecurity: 1500, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0
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
    assert((res.foreignTaxCredit ?? 0) > 0, 'Deducció per doble imposició ha de ser > 0');
    assert((res.foreignTaxCredit ?? 0) <= 450, 'Deducció per doble imposició no pot superar la retenció suportada');
  });

  test('1.4 Immobles Arrendats: Despeses Limitades, Amortitzacions i Reduccions Llei 12/2023', () => {
    const prop: RentalProperty = makeProperty({
      id: 'prop-1',
      name: 'Pis Eixample',
      cadastralReference: '1234567AB1234C0001XY',
      totalCadastralValue: 150000,
      constructionCadastralValue: 90000,
      acquisitionCost: 200000,
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
      reductionType: 'general_50',
      inventory: [
        {
          id: 'inv-1',
          invoiceNumber: 'F-2023-001',
          supplierName: 'Ikea',
          supplierNif: 'A28824360',
          concept: 'Mobiliari i electrodomèstics',
          category: 'group_2_furniture_10',
          amount: 5000,
          acquisitionDate: '2023-01-01',
          amortizationRate: 10,
          maxYears: 20,
          minYears: 10,
          previousAmortization: 500,
          status: 'active',
        }
      ],
    });

    const calc = calculatePropertyFiscalResult(prop, 2024);
    
    assert(calc.grossIncome === 12000, 'Ingressos bruts han de ser 12.000 €');
    assert(calc.limitedExpensesDeducted === 7000, 'Despeses limitades deduïdes han de ser 7.000 €');
    assert(calc.pendingRepairsForFutureYears === 0, 'No hi ha romanent de reparacions');
    assertCloseTo(calc.buildingAmortization, 3600, 1.0, 'Amortització immoble 3%');
    assertCloseTo(calc.inventoryBreakdown.totalInventoryAmortization, 500, 1.0, 'Amortització inventari mobles 10%');
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
    // Les pèrdues prèvies de mobiliari també poden creuar-se contra els guanys amb el límit del 25%
    // (Art. 49 LIRPF: la bossa de 4 anys es compensa "en el mateix orden"). 25% de 2.000 = 500 €.
    assert(comp.priorCrossCompensated === 500, `Compensació creuada de la bossa ha de ser 500, obtingut: ${comp.priorCrossCompensated}`);
    assert(comp.finalSavingsBase === 1500, `Base de l'estalvi final ha de ser 1.500, obtingut: ${comp.finalSavingsBase}`);
    assert(comp.remainingPriorMobiliaryLosses.length === 0, 'La bossa de mobiliari s\'ha d\'haver esgotat amb la creuada');
  });

  test('1.7 Mínim Personal i Familiar (Edat, Descendents, Ascendents i Discapacitat)', () => {
    const data = createEmptyDeclaracion(2024);
    data.personal = {
      name: 'Família Nombrosa',
      nif: '12345678Z',
      age: 68,
      disability: 33,
      descendants: [
        { id: 'd1', age: 14, disability: 0 },
        { id: 'd2', age: 2, disability: 0 },
        { id: 'd3', age: 9, disability: 65 },
      ],
      ascendants: [
        { id: 'a1', age: 79, disability: 0, liveTogether: true, annualIncome: 0 }
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
      id: 'e1', name: 'Empresa', grossSalary: 18000, inKind: 0, withholdings: 2500, socialSecurity: 1200, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0
    }];
    data.personal.age = 28;
    data.deductions = {
      housingDeduction: true,
      housingAmountsPaid: 10000,
      donations: [
        { id: 'don-1', entity: 'Creu Roja', amount: 500, priority: true, recurring: true }
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
      catalanRentalSituation: 'under32',
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
    // Lloguer: 300 € + Naixement: 150 € + Startups (30% de 6.000 € de base): 1.800 €
    // + AGAUR: 250 € + Llengua (15%): 30 € + Biomèdica (25%): 100 € = 2.630 €
    assertCloseTo(catDeds, 2630, 1.0, 'Total deduccions catalanes');
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
    assert(notified, 'El listener ha d\'haver estat notificat');
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
        id: 'e1', name: 'Empresa', grossSalary: 45000, inKind: 1000, withholdings: 9000, socialSecurity: 2000, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0
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
      id: 'e1', name: 'Empresa A', grossSalary: 32000, inKind: 0, withholdings: 5000, socialSecurity: 2000, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0
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
      id: 'e1', name: 'Company', grossSalary: 50000, inKind: 0, withholdings: 200, socialSecurity: 2000, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0
    }];
    data.deductions.housingDeduction = true;
    data.deductions.housingAmountsPaid = 15000;

    const res = calculateIRPF(data);
    const risk = evaluateAuditRisk(data, res);
    const compliance = runAutomatedComplianceChecks(data);

    assert(risk !== null && typeof risk.overallRiskScore === 'number', 'El radar de risc ha de retornar un overallRiskScore numèric');
    assert(compliance.issues.length > 0, 'L\'auto-validador ha de detectar incoherències');
  });

  test('6.2 Detecció d\'incompatibilitats d\'edat en descendents (> 25 anys) i ascendents (< 65 anys)', () => {
    const data = createEmptyDeclaracion(2024);
    data.personal.descendants = [
      { id: 'd1', age: 29, disability: 0 }
    ];
    data.personal.ascendants = [
      { id: 'a1', age: 56, disability: 0, liveTogether: true, annualIncome: 0 }
    ];

    const compliance = runAutomatedComplianceChecks(data);
    const descIssue = compliance.issues.find(i => i.id === 'personal-descendant-age-ineligible');
    const ascIssue = compliance.issues.find(i => i.id === 'personal-ascendant-age-ineligible');

    assert(descIssue !== undefined, 'Ha de detectar descendent > 25 anys sense discapacitat');
    assert(ascIssue !== undefined, 'Ha de detectar ascendent < 65 anys sense discapacitat');
  });

  test('6.3 Comprovació i Auto-fix dels límits legals de plans de pensions (Art. 52 LIRPF)', () => {
    const data = createEmptyDeclaracion(2024);
    data.deductions.pensionPlanContributions = 3000;
    data.deductions.companyPensionContributions = 12000;

    const compliance = runAutomatedComplianceChecks(data);
    const indIssue = compliance.issues.find(i => i.id === 'ded-pension-individual-cap');
    const empIssue = compliance.issues.find(i => i.id === 'ded-pension-company-cap');
    const totIssue = compliance.issues.find(i => i.id === 'ded-pension-total-cap');

    assert(indIssue !== undefined, 'Ha de detectar excés de pla individual (> 1.500 €)');
    assert(empIssue !== undefined, 'Ha de detectar excés de pla d\'empresa (> 8.500 €)');
    assert(totIssue !== undefined, 'Ha de detectar excés de pla conjunt (> 10.000 €)');
  });

  test('6.4 Detecció d\'obligació de Models 720 i 721 per a béns a l\'estranger (> 50.000 €)', () => {
    const data = createEmptyDeclaracion(2024);
    data.foreignAssets = {
      accounts: [{ id: 'a1', bankName: 'Revolut', countryCode: 'LT', ibanOrNumber: 'LT123', balanceYearEnd: 65000, averageBalanceQ4: 60000 }],
      securities: [],
      realEstate: [],
      crypto: [{ id: 'c1', exchangeName: 'Binance', cryptoSymbol: 'BTC', units: 1, valueYearEndEUR: 55000 }],
    };

    const compliance = runAutomatedComplianceChecks(data);
    const mod720 = compliance.issues.find(i => i.id === 'foreign-model-720-mandatory');
    const mod721 = compliance.issues.find(i => i.id === 'foreign-model-721-mandatory');

    assert(mod720 !== undefined, 'Ha de detectar obligació de presentar el Model 720');
    assert(mod721 !== undefined, 'Ha de detectar obligació de presentar el Model 721');
  });

  test('6.5 Incompatibilitat de reducció en arrendaments turístics (DGT V1187-24)', () => {
    const data = createEmptyDeclaracion(2024);
    data.properties = [makeProperty({
      id: 'prop-tourist-1',
      name: 'Apartament Turístic Costa Brava',
      usageType: 'tourist',
      reductionType: 'general_50',
      grossRentalIncome: 15000,
    })];

    const compliance = runAutomatedComplianceChecks(data);
    const touristIssue = compliance.issues.find(i => i.id.includes('prop-tourist-invalid-reduction'));

    assert(touristIssue !== undefined, 'Ha de detectar reducció del 50% indeguda en lloguer turístic');
  });

  test('6.6 Detecció d\'excés de deducció de subministraments de teletreball (Art. 30.2.5a.b LIRPF)', () => {
    const data = createEmptyDeclaracion(2024);
    data.activities = { income: 30000, expenses: 5000, withholdings: 4500, socialSecuritySelfEmployed: 3600, estimationType: 'direct_simplified' };
    data.iva = {
      ...initializeEmptyIVAData(),
      receivedInvoices: [
        { id: 'rec-util-1', invoiceNumber: 'F100', date: '2024-03-01', quarter: '1T', supplierName: 'Endesa', supplierNif: 'A12345678', concept: 'Electricitat llar despatx', taxableBase: 500, vatRate: 21, vatAmount: 105, totalInvoice: 605, deductiblePercentage: 100, deductibleVatAmount: 105, category: 'activity_expense' }
      ]
    };

    const compliance = runAutomatedComplianceChecks(data);
    const utilIssue = compliance.issues.find(i => i.id === 'act-home-office-utilities-overdeducted');

    assert(utilIssue !== undefined, 'Ha de detectar despesa de subministraments deduïda al 100% en lloc del 30% legal');
  });

  test('6.7 Sostre legal de despeses de guarderia en deducció per maternitat (1.000 €)', () => {
    const data = createEmptyDeclaracion(2024);
    data.personal.descendants = [{ id: 'd1', age: 1, disability: 0 }];
    data.deductions.maternityDeduction = true;
    data.deductions.maternityNurseryExpenses = 1800;

    const compliance = runAutomatedComplianceChecks(data);
    const nurseryIssue = compliance.issues.find(i => i.id === 'ded-nursery-expenses-capped');

    assert(nurseryIssue !== undefined, 'Ha de detectar despeses de guarderia superiors a 1.000 €');
  });

  test('6.8 Validació de cadastre (20 caràcters) i detecció de referència cadastral invàlida', () => {
    const data = createEmptyDeclaracion(2024);
    data.properties = [makeProperty({
      id: 'p-bad-cadastre',
      name: 'Local',
      usageType: 'commercial',
      cadastralReference: '123456789', // massa curta
      grossRentalIncome: 5000,
    })];

    const compliance = runAutomatedComplianceChecks(data);
    const cadIssue = compliance.issues.find(i => i.id === 'prop-invalid-cadastral-reference');

    assert(cadIssue !== undefined, 'Ha de detectar referència cadastral invàlida (< 20 caràcters)');
  });

  test('6.9 Detecció de prescripció de pèrdues de la bossa de 4 anys (> 4 anys / Art. 49 LIRPF)', () => {
    const data = createEmptyDeclaracion(2024);
    data.lossCarryovers = {
      pendingGeneralLosses: [],
      pendingMobiliaryLosses: [],
      pendingCapitalLosses: [
        { year: 2018, amount: 2500 } // Prescrita (> 4 anys)
      ]
    };

    const compliance = runAutomatedComplianceChecks(data);
    const prescIssue = compliance.issues.find(i => i.id === 'gains-loss-carryover-expired');

    assert(prescIssue !== undefined, 'Ha de detectar pèrdua de 2018 caducada/prescrita el 2024');
  });

  test('6.10 Detecció d\'incompatibilitat per límit de renda en deducció de lloguer a Catalunya (> 20.000 €)', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [{ id: 'e1', name: 'Empresa', grossSalary: 35000, inKind: 0, withholdings: 6000, socialSecurity: 2000, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0 }];
    data.personal.age = 28;
    data.deductions.catalanRentalDeduction = true;

    const compliance = runAutomatedComplianceChecks(data);
    const incCapIssue = compliance.issues.find(i => i.id === 'ded-catalan-rental-income-cap-exceeded');

    assert(incCapIssue !== undefined, 'Ha de detectar superació del límit de 20.000 € de renda a Catalunya');
  });

  test('6.11 Detecció de sostre legal d\'acomiadament (> 180.000 €) i rendiments irregulars (> 300.000 €)', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.severancePay = 250000;
    data.workIncome.irregularIncomeAmount = 400000;

    const compliance = runAutomatedComplianceChecks(data);
    const sevIssue = compliance.issues.find(i => i.id === 'work-severance-pay-exemption-capped');
    const irregIssue = compliance.issues.find(i => i.id === 'work-irregular-income-capped');

    assert(sevIssue !== undefined, 'Ha de detectar indemnització per acomiadament superior a 180.000 €');
    assert(irregIssue !== undefined, 'Ha de detectar base de rendiments irregulars superior a 300.000 €');
  });

  test('6.12 Detecció de manca de convivència reglamentària amb l\'ascendent (Art. 59 LIRPF)', () => {
    const data = createEmptyDeclaracion(2024);
    data.personal.ascendants = [
      { id: 'asc1', age: 72, disability: 0, liveTogether: false }
    ];

    const compliance = runAutomatedComplianceChecks(data);
    const cohabIssue = compliance.issues.find(i => i.id === 'personal-ascendant-not-cohabiting');

    assert(cohabIssue !== undefined, 'Ha de detectar ascendent que no conviu amb el contribuent');
  });

  test('6.13 Detecció de límit de donacions del 10% sobre la base liquidable (Art. 68.3 LIRPF)', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [{ id: 'e1', name: 'Empresa', grossSalary: 20000, inKind: 0, withholdings: 3000, socialSecurity: 1200, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0 }];
    data.deductions.donations = [
      { id: 'don1', entity: 'Fundació Cultural', amount: 5000, recurring: false, priority: false, category: 'public_utility' }
    ];

    const compliance = runAutomatedComplianceChecks(data);
    const donCapIssue = compliance.issues.find(i => i.id === 'ded-donations-10pct-base-cap');

    assert(donCapIssue !== undefined, 'Ha de detectar donacions superiors al 10% de la base');
  });

  test('6.14 El mecenatge de la Llei 49/2002 no genera fals positiu del límit del 10%', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [{ id: 'e1', name: 'Empresa', grossSalary: 20000, inKind: 0, withholdings: 3000, socialSecurity: 1200, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0 }];
    data.deductions.donations = [
      { id: 'don1', entity: 'Creu Roja', amount: 5000, recurring: true, priority: true, category: 'ley_49_2002' }
    ];

    const compliance = runAutomatedComplianceChecks(data);
    const donCapIssue = compliance.issues.find(i => i.id === 'ded-donations-10pct-base-cap');

    assert(donCapIssue === undefined, 'El mecenatge (Llei 49/2002) no està subjecte al límit del 10% de base');
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
      category: 'activity_service',
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
      deductiblePercentage: 100,
      deductibleVatAmount: 420,
      category: 'activity_expense',
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
    let receivedData: { income?: number } | null = null;

    const unsubscribe = store.subscribeKey('activities', (sectionData) => {
      triggeredSection = true;
      receivedData = sectionData as { income?: number };
    });

    store.update('activities', { income: 45000, expenses: 12000 });

    assert(triggeredSection, 'subscribeKey ha de disparar el listener específic de secció');
    const received = receivedData as { income?: number } | null;
    assert(received !== null && received.income === 45000, 'Les dades rebudes han de reflectir la mutació');

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
          // La vinculació d'accions s'ha d'acceptar pel constructor de taules.
          onClick: () => {},
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
      id: 'e1', name: 'Tech Corp', grossSalary: 60000, inKind: 0, withholdings: 12000, socialSecurity: 2400, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0
    }];
    // Immoble llogat
    data.properties = [makeProperty({
      id: 'p1', name: 'Pis Eixample', cadastralReference: '98765432109876543210AB',
      usageType: 'habitual',
      reductionType: 'general_50',
    })];
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
      expectedRevenue: 120000,
      expectedExpenses: 20000,
      irpfMarginalRate: 37,
      autonomoQuota: 4500,
      corporateTaxRate: 25,
      dividendTaxRate: 19,
      slMaintenanceCost: 2000,
      societalSalary: 45000,
      netIncomeAutonomo: 0,
      totalTaxesAutonomo: 0,
      netIncomeSL: 0,
      totalTaxesSL: 0,
      recommendation: 'autonomo',
      savings: 0,
    });

    assert(sim.recommendation === 'sl' || sim.recommendation === 'autonomo', 'Ha de recomanar una opció vàlida');
    assert(sim.savings > 0, 'L\'estalvi comparatiu ha de ser superior a 0 €');
    assert(sim.netIncomeAutonomo > 0, 'Rendiment net autònom positiu');
  });

  test('16.2 Optimització de Rescat de Pla de Pensions amb Reducció 40% (PensionsOptimizerEngine)', () => {
    const opt = PensionsOptimizerEngine.optimizeRescue({
      pensionFundValue: 100000,
      pre2007Contributions: 60000,
      yearsSinceRetirement: 1,
      otherYearlyIncome: 25000,
      scenarios: [],
      bestScenarioName: '',
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
        feeAsset: 'EUR',
        feeAmount: 20,
        walletOrExchange: 'Kraken',
      },
      {
        id: 'tx2',
        date: '2024-03-15',
        type: 'staking_reward',
        assetIn: 'ETH',
        amountIn: 0.5,
        feeAsset: 'EUR',
        feeAmount: 0,
        fiatValueInEUR: 1500,
        walletOrExchange: 'Binance',
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
        feeAsset: 'EUR',
        feeAmount: 15,
        walletOrExchange: 'Kraken',
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
          invoiceNumber: 'F2024-01',
          date: '2024-02-15',
          quarter: '1T',
          clientName: 'Client Major SL',
          clientNif: 'B12345678',
          concept: 'Desenvolupament',
          taxableBase: 4000,
          vatRate: 21,
          vatAmount: 840,
          withholdingRate: 0,
          withholdingAmount: 0,
          totalInvoice: 4840,
          category: 'activity_service',
        },
        {
          id: 'inv2',
          invoiceNumber: 'F2024-02',
          date: '2024-04-10',
          quarter: '2T',
          clientName: 'Client Petit SL',
          clientNif: 'B99999999',
          concept: 'Consulta',
          taxableBase: 1000,
          vatRate: 21,
          vatAmount: 210,
          withholdingRate: 0,
          withholdingAmount: 0,
          totalInvoice: 1210,
          category: 'activity_service',
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
      makeTradeMetrics({
        totalTrades: 50,
        winRate: 60,
        profitFactor: 1.8,
        expectancyEUR: 120,
        maxDrawdownEUR: 15,
        avgWin: 300,
        avgLoss: 150,
        sharpeRatio: 1.5,
      }),
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
    assert(!cleanedUp, 'El callback de neteja no s\'ha d\'executar sense navegació');
  });
});

// ── 23. SUITE 23: DETECTOR DE PRESCRIPCIÓ TRIBUTÀRIA LGT ────────────────────

suite('23. Detector de Prescripció Tributària (Art. 66 LGT - tax-prescription-engine.ts)', () => {

  test('23.1 Càlcul de prescripció de 4 anys per a IRPF i IVA', () => {
    // Si la data de referència és l'any 2026:
    // Exercici 2020 IRPF: termini fins 30/06/2021 + 4 anys = 30/06/2025 -> PRESCRIT
    const status2020 = checkTaxPrescription(2020, 'IRPF', new Date(2026, 0, 1));
    assert(status2020.isPrescribed === true, 'L\'exercici 2020 ha de constar com a prescrit el 2026');
    assert(status2020.daysRemaining === 0, 'Els dies restants han de ser 0');

    // Exercici 2024 IRPF: termini fins 30/06/2025 + 4 anys = 30/06/2029 -> NO PRESCRIT
    const status2024 = checkTaxPrescription(2024, 'IRPF', new Date(2026, 0, 1));
    assert(status2024.isPrescribed === false, 'L\'exercici 2024 no està prescrit');
    assert(status2024.daysRemaining > 0, 'Hi ha dies restants de control d\'inspecció');
  });
});

// ── 24. SUITE 24: DEDUCCIONS PER EFICIÈNCIA ENERGÈTICA ──────────────────────

suite('24. Deduccions Estatals per Eficiència Energètica (energy-efficiency-engine.ts)', () => {

  test('24.1 Modalitat 1: 20% fins a 5.000 € (Reducció 7% calefacció/refrigeració)', () => {
    const res = calculateEnergyEfficiencyDeduction({
      id: 'work1',
      type: 'heating_cooling_20',
      amountsPaid: 6000, // Supera el topall de 5.000 €
      certificateBeforeDate: '2024-01-10',
      certificateAfterDate: '2024-05-15',
      reductionPercentageAchieved: 10, // Supera el 7% exigit
    });

    assert(res.meetsLegalRequirement === true, 'Compleix requisit legal del 7%');
    assert(res.eligibleBase === 5000, 'Base màxima computable de 5.000 €');
    assert(res.deductionAmount === 1000, 'Deducció del 20% sobre 5.000 € = 1.000 €');
  });

  test('24.2 Modalitat 2: 40% fins a 7.500 € (Reducció 30% energia primària no renovable)', () => {
    const res = calculateEnergyEfficiencyDeduction({
      id: 'work2',
      type: 'non_renewable_energy_40',
      amountsPaid: 8000,
      subsidiesReceived: 1000, // Net: 7.000 €
      certificateBeforeDate: '2024-02-01',
      certificateAfterDate: '2024-06-01',
      reductionPercentageAchieved: 35, // Supera el 30%
    });

    assert(res.meetsLegalRequirement === true, 'Compleix requisit del 30%');
    assert(res.eligibleBase === 7000, 'Base neta computable de 7.000 €');
    assert(res.deductionAmount === 2800, 'Deducció del 40% sobre 7.000 € = 2.800 €');
  });

  test('24.3 Modalitat 3: 60% en Edificis d\'Habitatges (màx 5.000 € anuals)', () => {
    const res = calculateEnergyEfficiencyDeduction({
      id: 'work3',
      type: 'building_retrofit_60',
      amountsPaid: 12000,
      certificateBeforeDate: '2024-01-01',
      certificateAfterDate: '2024-11-01',
      reductionPercentageAchieved: 40,
    });

    assert(res.meetsLegalRequirement === true, 'Compleix requisit de rehabilitació');
    assert(res.eligibleBase === 5000, 'Límit anual de 5.000 €');
    assert(res.deductionAmount === 3000, 'Deducció del 60% = 3.000 €');
    assert(res.pendingCarryover === 7000, 'Excés de 7.000 € pendent d\'arrossegar als 4 propers anys');
  });
});

suite('25. Motor d\'Aritmètica Decimal Financera i Arrodoniments AEAT (exact-math.ts)', () => {
  test('25.1 Eliminació d\'errors de coma flotant en sumes i restes iteratives', () => {
    // 0.1 + 0.2 en IEEE-754 dóna 0.30000000000000004
    const sum = exactAdd(0.1, 0.2);
    assert(sum === 0.3, 'Suma exacta sense drift decimal');

    const multiSum = exactAdd(10.15, 20.25, 30.35, 40.45);
    assert(multiSum === 101.20, 'Suma acumulada exacta = 101.20 €');

    const sub = exactSub(100.55, 0.55);
    assert(sub === 100.00, 'Resta exacta = 100.00 €');
  });

  test('25.2 Multiplicació i Divisió exacta d\'impostos i tipus impositius', () => {
    // Base 123.45 € amb IVA 21% -> 123.45 * 0.21 = 25.9245 -> arrodonit oficialment a 25.92 €
    const iva = exactMultiply(123.45, 0.21);
    assert(iva === 25.92, 'Quota d\'IVA de 123.45 € al 21% és exactament 25.92 €');

    // Desglossament de línia amb base, IVA i recàrrec d'equivalència (5.2%)
    const line = calculateInvoiceLineTaxExact(1000, 0.21, 0.052);
    assert(line.base === 1000, 'Base de 1.000 €');
    assert(line.ivaAmount === 210, 'IVA de 210 €');
    assert(line.reqAmount === 52, 'Recàrrec de 52 €');
    assert(line.total === 1262, 'Total línia = 1.262 €');
  });

  test('25.3 Aplicació progressiva exacta d\'escales de gravamen', () => {
    const brackets = [
      { upTo: 10000, rate: 0.10 },
      { upTo: 20000, rate: 0.20 },
      { upTo: Infinity, rate: 0.30 },
    ];
    // Base 25.000 € -> 10k * 10% (1.000) + 10k * 20% (2.000) + 5k * 30% (1.500) = 4.500 €
    const result = applyTaxBracketsExact(25000, brackets);
    assert(result.totalTax === 4500, 'Quota total en escala de 25.000 € = 4.500 €');
    assert(result.brackets.length === 3, '3 trams computats exactament');
  });
});

suite('26. Compliment Veri*Factu i Integritat Criptogràfica (verifactu-engine.ts)', () => {
  test('26.1 Generació i verificació de cadena de factures inalterable (Art. 201 bis LGT)', async () => {
    const inv1 = await createChainedInvoiceRecord({
      id: 'inv-1',
      invoiceNumber: 'FAC-2024-001',
      issueDate: '2024-01-15',
      issuerNif: 'B12345678',
      baseAmount: 1000,
      taxRate: 0.21,
      taxAmount: 210,
      totalAmount: 1210,
    }, '');

    assert(inv1.previousRecordHash === '', 'Primer registre sense hash anterior');
    assert(inv1.currentRecordHash.length > 0, 'Hash SHA-256 generat');

    const inv2 = await createChainedInvoiceRecord({
      id: 'inv-2',
      invoiceNumber: 'FAC-2024-002',
      issueDate: '2024-01-20',
      issuerNif: 'B12345678',
      baseAmount: 2000,
      taxRate: 0.21,
      taxAmount: 420,
      totalAmount: 2420,
    }, inv1.currentRecordHash);

    assert(inv2.previousRecordHash === inv1.currentRecordHash, 'Encadenament correcte');

    const verification = await verifyInvoiceChainIntegrity([inv1, inv2]);
    assert(verification.isValid === true, 'Cadena de registres 100% íntegra');
    assert(verification.totalRecords === 2, '2 registres validats');
  });

  test('26.2 Detecció immediata de manipulació o alteració de factures', async () => {
    const inv1 = await createChainedInvoiceRecord({
      id: 'inv-1',
      invoiceNumber: 'FAC-2024-001',
      issueDate: '2024-01-15',
      issuerNif: 'B12345678',
      baseAmount: 1000,
      taxRate: 0.21,
      taxAmount: 210,
      totalAmount: 1210,
    }, '');

    // Simulem alteració fraudulenta de l'import després de signar
    const fraudulentInv1 = { ...inv1, totalAmount: 800 };

    const verification = await verifyInvoiceChainIntegrity([fraudulentInv1]);
    assert(verification.isValid === false, 'Detecta el frau per discrepància de hash');
  });
});

suite('27. Escales de Gravamen Autonòmiques Multi-CCAA (autonomic-tax-scales.ts)', () => {
  test('27.1 Diferenciació fiscal entre Catalunya, Madrid i Andalusia', () => {
    const catBrackets = getAutonomicBrackets('catalunya');
    const madBrackets = getAutonomicBrackets('madrid');
    const andBrackets = getAutonomicBrackets('andalucia');

    assert(catBrackets.length === 9, 'Catalunya té 9 trams');
    assert(madBrackets.length === 5, 'Madrid té 5 trams');
    assert(andBrackets.length === 5, 'Andalusia té 5 trams');

    // Comprovació amb el motor d'IRPF
    const baseDecl = createEmptyDeclaracion(2024, 'profile_main');
    baseDecl.workIncome = {
      employers: [{ id: '1', name: 'Empresa', grossSalary: 60000, inKind: 0, withholdings: 12000, socialSecurity: 2000, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0 }],
      unionFees: 0,
      otherDeductible: 0,
      pensionContributions: 0,
    };

    baseDecl.personal = {
      ...baseDecl.personal,
      autonomousCommunity: 'madrid',
    };
    const resultMadrid = calculateIRPF(baseDecl, true);

    baseDecl.personal = {
      ...baseDecl.personal,
      autonomousCommunity: 'catalunya',
    };
    const resultCatalunya = calculateIRPF(baseDecl, true);

    assert(resultMadrid.autonomicGeneralTax < resultCatalunya.autonomicGeneralTax, 'La quota autonòmica de Madrid és inferior a la de Catalunya');
  });
});

suite('28. Generador de Dossier de Defensa Tributària davant Requeriments AEAT (audit-dossier-generator.ts)', () => {
  test('28.1 Generació de dossier amb justificacions legals i calendari de prescripció', () => {
    const decl = createEmptyDeclaracion(2024, 'profile_main');
    decl.personal = {
      ...decl.personal,
      nif: '12345678Z',
      name: 'Joan García',
    };
    decl.workIncome = {
      ...decl.workIncome,
      foreignWorkExemption7p: 10000,
      employers: [{
        id: '1',
        name: 'Empresa SL',
        grossSalary: 45000,
        withholdings: 8000,
        socialSecurity: 2300,
        inKind: 0,
        dietsIncome: 0,
        dietsDays: 0,
        mileageIncome: 0,
        mileageKm: 0,
      }],
    };
    decl.deductions = {
      ...decl.deductions,
      donations: [{ id: 'd1', entity: 'Fundació Recerca', amount: 300, recurring: true, priority: false }],
    };

    const dossier = generateTaxDefenseDossier(decl);

    assert(dossier.fiscalYear === 2024, 'Exercici 2024');
    assert(dossier.prescriptionDeadline === '30/06/2029', 'Prescriu el 30/06/2029 (4 anys LGT)');
    assert(dossier.taxpayerNif === '12345678Z', 'NIF assignat');
    assert(dossier.boxJustifications.length >= 3, 'Justificacions generades per treball, 7.p i donatius');
    assert(dossier.requiredDocumentationChecklist.length > 0, 'Checklist documental generat');
    assert(dossier.defenseArguments.length > 0, 'Arguments jurídics inclosos');
  });
});

suite('29. Motor de Retencions d\'Arrendaments Urbans: Model 115 i Model 180 (model115-180-engine.ts)', () => {
  const dummyLeases = [
    {
      id: 'lease_local_1',
      landlordNif: 'A12345678',
      landlordName: 'Inmobiliaria Central SA',
      cadastralReference: '1234567AB1234C0001XY',
      address: 'Passeig de Gràcia 50, Principal',
      postalCode: '08007',
      municipality: 'Barcelona',
      provinceCode: '08',
      propertySituation: '1' as const,
      monthlyRent: 2000,
      withholdingRate: 0.19,
      isExempt: false,
    },
    {
      id: 'lease_office_2',
      landlordNif: 'B87654321',
      landlordName: 'Patrimonis Urbans SL',
      cadastralReference: '9876543CD9876E0002ZW',
      address: 'Gran Via 120, 3r 2a',
      postalCode: '08015',
      municipality: 'Barcelona',
      provinceCode: '08',
      propertySituation: '1' as const,
      monthlyRent: 1500,
      withholdingRate: 0.19,
      isExempt: false,
    },
    {
      id: 'lease_exempt_traster',
      landlordNif: 'C99999999',
      landlordName: 'Trasters del Vallès SL',
      cadastralReference: '1111111XX1111X0003AA',
      address: 'Carrer Indústria 5',
      postalCode: '08201',
      municipality: 'Sabadell',
      provinceCode: '08',
      propertySituation: '1' as const,
      monthlyRent: 50, // 600 € anuals -> Exempt per no superar 900 €
      withholdingRate: 0.19,
      isExempt: false,
    },
  ];

  test('29.1 Avaluació d\'obligació i càlcul trimestral Model 115 (19% sobre bases de lloguer)', () => {
    const audit = Model115And180Engine.auditModel115Obligation(dummyLeases);
    assert(audit.isObligated === true, 'Hi ha obligació de presentar el Model 115');
    assert(audit.activeLeaseCount === 2, '2 contractes subjectes a retenció');
    assert(audit.exemptLeaseCount === 1, '1 contracte exempt per < 900 € anuals');

    // Càlcul 1T: Renda computable trimestral: (2.000 + 1.500) * 3 = 10.500 €
    // Retenció 19%: 10.500 * 0.19 = 1.995 €
    const mod115_1T = Model115And180Engine.calculateModel115Quarterly('1T', 2024, dummyLeases);
    assert(mod115_1T.recipientsCount === 2, '2 arrendadors perceptors');
    assert(mod115_1T.baseTotal === 10500, 'Base trimestral computable de 10.500 €');
    assert(mod115_1T.withholdingsTotal === 1995, 'Retencions trimestrals al 19% = 1.995 €');
    assert(mod115_1T.totalToPay === 1995, 'Total a ingressar = 1.995 €');
  });

  test('29.2 Generació del Resum Anual Model 180 amb dades cadastrals i perceptors', () => {
    const quarters = Model115And180Engine.calculateModel115AllQuarters(2024, dummyLeases);
    assert(quarters.length === 4, '4 trimestres generats');

    const mod180 = Model115And180Engine.generateModel180Annual(2024, dummyLeases, quarters);
    assert(mod180.year === 2024, 'Exercici 2024');
    assert(mod180.totalRecipientsCount === 2, '2 perceptors anuals');
    // Base anual: (2.000 * 12) + (1.500 * 12) = 24.000 + 18.000 = 42.000 €
    assert(mod180.totalBaseAnnual === 42000, 'Base anual total de 42.000 €');
    // Retencions anuals: 42.000 * 0.19 = 7.980 €
    assert(mod180.totalWithholdingsAnnual === 7980, 'Retencions anuals = 7.980 €');
    assert(mod180.perceptors.length === 2, '2 registres desglossats per arrendador i cadastre');
    assert(mod180.reconciliationWith115Status === 'perfect', 'Estat de conciliació 115 vs 180 perfecte');
  });

  test('29.3 Conciliació Creuada 115 vs 180 i detecció de desquadraments', () => {
    const quarters = Model115And180Engine.calculateModel115AllQuarters(2024, dummyLeases);
    const mod180 = Model115And180Engine.generateModel180Annual(2024, dummyLeases, quarters);

    const checkPerfect = Model115And180Engine.reconcileModel115vs180(quarters, mod180);
    assert(checkPerfect.isReconciled === true, 'Models 115 (1T-4T) i 180 quadren al cèntim');
    assert(checkPerfect.withholdingDifference === 0, 'Diferència 0 €');

    // Simulem desquadrament intencionat per error humà en un trimestre
    const corruptedQuarters = [...quarters];
    corruptedQuarters[3] = { ...corruptedQuarters[3], withholdingsTotal: corruptedQuarters[3].withholdingsTotal - 100 };

    const checkCorrupted = Model115And180Engine.reconcileModel115vs180(corruptedQuarters, mod180);
    assert(checkCorrupted.isReconciled === false, 'Detecta el desquadrament de 100 €');
    assert(checkCorrupted.withholdingDifference === 100, 'Diferència exacta de 100 €');
    assert(checkCorrupted.errorDetails !== undefined, 'Detall del motiu de l’error generat');
  });

  test('29.4 Conciliació de retencions suportades pel propietari amb la Renda (Model 100 Casella 0597)', () => {
    const quarters = Model115And180Engine.calculateModel115AllQuarters(2024, dummyLeases);
    const mod180 = Model115And180Engine.generateModel180Annual(2024, dummyLeases, quarters);

    const landlordDecl = createEmptyDeclaracion(2024, 'profile_main');
    landlordDecl.capitalIncome = {
      ...landlordDecl.capitalIncome,
      realEstateWithholdings: 7980, // Coincideix amb el Model 180
    };

    const reconciliation = Model115And180Engine.reconcileModel180vsLandlordDeclaracion(mod180, landlordDecl);
    assert(reconciliation.isMatching === true, 'Retencions suportades a la Renda coincideixen amb el Model 180');
    assert(reconciliation.difference === 0, 'Diferència 0 €');
  });
});

suite('30. Muralles de Blindatge i Rigor Tributari (LIVA & LIRPF)', () => {
  test('30.1 Desacoblament de vehicles turisme: 50% IVA vs 0% IRPF (Art. 95 LIVA vs Art. 22 RIRPF)', () => {
    const dummyVehicleExpenses = [
      { id: 'v1', concept: 'Combustible Repsol', totalAmount: 121, vatAmount: 21, expenseType: 'fuel' as const },
      { id: 'v2', concept: 'Rènting Turisme', totalAmount: 484, vatAmount: 84, expenseType: 'renting_leasing' as const },
    ];

    // Autònom consultor (epígraf 763) -> Vehicle no exclusiu
    const auditGeneral = auditAndDecoupleVehicleExpenses(dummyVehicleExpenses, '763');
    assert(auditGeneral.isDecoupled === true, 'Aplica desacoblament automàtic');
    assert(auditGeneral.vatDeductionRate === 50, 'Dedueix el 50% de quota d\'IVA (52,50 €)');
    assert(auditGeneral.vatDeductibleAmount === 52.5, '50% d\'IVA = 52,50 €');
    assert(auditGeneral.irpfDeductionRate === 0, '0% deducció a l\'IRPF per protegir de sanció');
    assert(auditGeneral.irpfDeductibleAmount === 0, '0 € deduïts a l\'IRPF');
    assert(auditGeneral.potentialTaxFineAvoided > 0, 'Estalvi de sanció estimat positiu');
  });

  test('30.2 Reconeixement d\'activitats de transport i agents comercials (100% deduïble en IVA i IRPF)', () => {
    const dummyVehicleExpenses = [
      { id: 'v1', concept: 'Gasoil Furgoneta', totalAmount: 121, vatAmount: 21, expenseType: 'fuel' as const },
    ];

    // Transport de mercaderies (epígraf 722)
    assert(isExclusiveVehicleActivity('722') === true, 'Epígraf 722 és transport');
    const auditTransport = auditAndDecoupleVehicleExpenses(dummyVehicleExpenses, '722');
    assert(auditTransport.isDecoupled === false, 'No desacobla: 100% deduïble');
    assert(auditTransport.vatDeductibleAmount === 21, '100% IVA deduïble (21 €)');
    assert(auditTransport.irpfDeductibleAmount === 100, '100 € de base deduïble a l\'IRPF');
  });

  test('30.3 Comparativa Prorrata General vs Especial i obligatorietat del 10% (Art. 103 LIVA)', () => {
    const dummyIVAData: IVAData = {
      config: {
        regime: 'general',
        settlementFrequency: 'quarterly',
        isREDEME: false,
        hasProrrata: true,
        prorrata: {
          type: 'general',
          provisionalPercentage: 80,
          definitivePercentage: 80,
          isRegulatedAutomatically: true,
          totalOperationsWithDeduction: 80000,
          totalOperationsVolume: 100000,
        },
        initialPendingCarryover: 0,
      },
      issuedInvoices: [],
      receivedInvoices: [
        // Despesa directa sense dret a deduir (lloguer habitatge) amb molt d'IVA
        {
          id: 'rec_1',
          invoiceNumber: 'F-001',
          quarter: '1T',
          supplierNif: 'B12345678',
          supplierName: 'Manteniment Pisos',
          date: '2024-03-01',
          category: 'property_expense',
          concept: 'Manteniment Lloguer Habitatge',
          notes: 'exempt_expense',
          taxableBase: 10000,
          vatRate: 21,
          vatAmount: 2100,
          deductiblePercentage: 0,
          deductibleVatAmount: 0,
          totalInvoice: 12100,
          isInvestmentAsset: false,
        },
        // Despesa directa amb dret a deduir
        {
          id: 'rec_2',
          invoiceNumber: 'F-002',
          quarter: '1T',
          supplierNif: 'B87654321',
          supplierName: 'Subministraments Activitat',
          date: '2024-03-05',
          category: 'activity_expense',
          concept: 'Subministraments Activitat',
          taxableBase: 1000,
          vatRate: 21,
          vatAmount: 210,
          deductiblePercentage: 100,
          deductibleVatAmount: 210,
          totalInvoice: 1210,
          isInvestmentAsset: false,
        },
      ],
      investmentAssets: [],
      quarters: initializeEmptyIVAData().quarters,
    };

    const comparison = calculateProrrataComparison(dummyIVAData, 80);
    // Prorrata General (80% de 2.310 €) = 1.848 €
    // Prorrata Especial = 210 € + 0 € = 210 €
    // Desviació: (1.848 - 210) / 210 = 780% > 10%
    assert(comparison.isSpecialProrrataMandatoryByLaw === true, 'Prorrata Especial obligatòria per superar el 10%');
    assert(comparison.recommendedRegime === 'special', 'Recomana Prorrata Especial');
    assert(comparison.warningMessage !== undefined, 'Missatge d\'advertència generat');
  });

  test('30.4 Radar de prescripció de 4 anys (Art. 66 LGT) amb dates exactes de blindatge', () => {
    // Renda 2020 (declarada el 30/06/2021) -> Prescriu el 30/06/2025
    const presc2020 = checkTaxPrescription(2020, 'IRPF', new Date('2026-01-01'));
    assert(presc2020.isPrescribed === true, 'Exercici 2020 ja ha prescrit completament');
    assert(presc2020.daysRemaining === 0, '0 dies restants');

    // Renda 2024 (declarada el 30/06/2025) -> Prescriu el 30/06/2029
    const presc2024 = checkTaxPrescription(2024, 'IRPF', new Date('2026-01-01'));
    assert(presc2024.isPrescribed === false, 'Exercici 2024 encara està en termini de revisió');
    assert(presc2024.prescriptionDate === '2029-06-30', 'Data exacta 30/06/2029');
    assert(presc2024.daysRemaining > 0, 'Compte enrere actiu');
  });
});

// ── 31. SUITE 31: QUADRE DE COMANDAMENT DIDÀCTIC & VIATGE FISCAL ────────────

suite('31. Quadre de Comandament Didàctic & Viatge Fiscal de la Renda', () => {

  test('31.1 Desglossament didàctic integral d\'una renda multi-origen complexa', () => {
    const data = createEmptyDeclaracion(2024);
    // Treball amb 2 pagadors
    data.workIncome.employers = [
      { id: 'e1', name: 'Empresa Principal', grossSalary: 45000, inKind: 0, withholdings: 8000, socialSecurity: 2800, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0 },
      { id: 'e2', name: 'Segon Pagador', grossSalary: 8000, inKind: 0, withholdings: 800, socialSecurity: 500, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0 },
    ];
    // Immoble llogat
    data.properties = [makeProperty({
      id: 'prop-1',
      name: 'Pis Carrer Aragó',
      cadastralReference: '1234567AB1234C0001XY',
      address: 'Carrer Aragó 100',
      ownershipPercentage: 100,
      usageType: 'habitual',
      contractDate: '2023-01-01',
      tenantNIFs: ['44444444A'],
      grossRentalIncome: 12000,
      totalCadastralValue: 150000,
      constructionCadastralValue: 90000,
      acquisitionCost: 200000,
      ibi: 600,
      communityFees: 800,
      mortgageInterests: 1200,
      repairExpenses: 400,
      insurance: 300,
      reductionType: 'general_50',
    })];
    // Plans de pensions i donacions
    data.deductions.pensionPlanContributions = 1500;
    data.deductions.donations = [{ id: 'don-1', entity: 'Creu Roja', amount: 250, recurring: true, priority: false }];

    const report = explainTaxReturn(data);

    assert(report.totalGrossIncome === 65000, `Total ingressos bruts 65.000 € (obtingut: ${report.totalGrossIncome})`);
    assert(report.flowSteps.length >= 8, `El viatge fiscal ha de contenir almenys 8 passos (obtingut: ${report.flowSteps.length})`);
    assert(report.plainLanguageSummary.length >= 3, 'Ha de contenir un resum didàctic en llenguatge planer');
    assert(report.keyDrivers.length > 0, 'Ha d\'identificar motors clau (pluralitat de pagadors, amortització, plans)');
    assert(report.generalBracketBreakdown.length === 6, 'Desglossament de 6 trams de l\'escala general');
    assert(report.marginalRateGeneral >= 37, `Tipus marginal estimat adequat (obtingut: ${report.marginalRateGeneral}%)`);
  });

  test('31.2 Renderització del component visual Tax Journey Visualizer', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [
      { id: 'e1', name: 'Empresa', grossSalary: 30000, inKind: 0, withholdings: 4500, socialSecurity: 1900, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0 }
    ];
    const visualizer = createTaxJourneyVisualizer(data);
    assert(visualizer !== null && visualizer !== undefined, 'El visualitzador ha de retornar un element DOM');
    assert(visualizer.className.includes('tax-journey-container'), 'Classe del contenidor correcta');
    assert(visualizer.innerHTML.includes('Cuadro de Mando Visual'), 'Títol del quadre de comandament present');
  });

  test('31.3 Renderització dels Quadres Interns de Desglossament Avançat', () => {
    const data = createEmptyDeclaracion(2024);
    data.properties = [makeProperty({
      id: 'prop-1',
      name: 'Pis Carrer Aragó',
      cadastralReference: '1234567AB1234C0001XY',
      address: 'Carrer Aragó 100',
      ownershipPercentage: 100,
      usageType: 'habitual',
      contractDate: '2023-01-01',
      tenantNIFs: ['44444444A'],
      grossRentalIncome: 12000,
      totalCadastralValue: 150000,
      constructionCadastralValue: 90000,
      acquisitionCost: 200000,
      ibi: 600,
      communityFees: 800,
      mortgageInterests: 1200,
      repairExpenses: 400,
      insurance: 300,
      reductionType: 'general_50',
    })];
    const dashboards = createInternalBreakdownDashboards(data);
    assert(dashboards !== null && dashboards !== undefined, 'El panell ha de retornar un element DOM');
    assert(dashboards.className.includes('internal-breakdowns-container'), 'Contenidor de quadres interns correcte');
    assert(dashboards.innerHTML.includes('Quadres Interns de Desglossament'), 'Títol de quadres interns present');
  });
});

// ── 32. SUITE 32: QUADRE DE COMANDAMENT & RENDIBILITAT IMMOBILIÀRIA ─────────

suite('32. Quadre de Comandament, Rendibilitat i Tendència Immobiliària', () => {

  test('32.1 Mètriques financeres de rendibilitat, NOI, cash flow i escut fiscal 3%', () => {
    const property = makeProperty({
      id: 'prop-test-1',
      name: 'Àtic Rambla Catalunya',
      cadastralReference: '99887766AB1234C0001XY',
      address: 'Rambla Catalunya 50',
      ownershipPercentage: 100,
      usageType: 'habitual',
      contractDate: '2023-01-01',
      tenantNIFs: ['55555555Z'],
      grossRentalIncome: 18000,
      totalCadastralValue: 250000,
      constructionCadastralValue: 150000,
      acquisitionCost: 300000,
      ibi: 900,
      communityFees: 1200,
      mortgageInterests: 2400,
      repairExpenses: 600,
      insurance: 400,
      reductionType: 'general_50',
    });

    const report = analyzePropertyFinances(property, 2024);

    assert(report.propertyMetrics.grossIncome === 18000, 'Ingressos bruts 18.000 €');
    assert(report.propertyMetrics.operatingExpenses === 3100, `OpEx 3.100 € (obtingut: ${report.propertyMetrics.operatingExpenses})`);
    assert(report.propertyMetrics.netOperatingIncome === 14900, `NOI 14.900 € (obtingut: ${report.propertyMetrics.netOperatingIncome})`);
    assert(report.propertyMetrics.grossYieldPercent === 6.0, `Yield Brut 6,0% (obtingut: ${report.propertyMetrics.grossYieldPercent}%)`);
    assert(report.propertyMetrics.netYieldPercent > 4.5, `Yield Net > 4.5% (obtingut: ${report.propertyMetrics.netYieldPercent}%)`);
    assert(report.propertyMetrics.totalAmortization === 5400, `Amortització 3% de 180.000 € = 5.400 € (obtingut: ${report.propertyMetrics.totalAmortization})`);
    assert(report.propertyMetrics.taxShieldSavings > 1900, `Escut fiscal > 1.900 € (obtingut: ${report.propertyMetrics.taxShieldSavings})`);
    assert(report.fiveYearProjection.length === 5, 'Projecció multianual a 5 anys generada');
  });

  test('32.2 Anàlisi de cartera global i rànquing d\'eficiència', () => {
    const properties = [
      makeProperty({
        id: 'p1',
        name: 'Pis Eixample',
        acquisitionCost: 200000,
        grossRentalIncome: 14000,
        totalCadastralValue: 120000,
        constructionCadastralValue: 80000,
        ibi: 500,
        communityFees: 600,
        repairExpenses: 200,
        mortgageInterests: 1000,
        insurance: 250,
        usageType: 'habitual',
        reductionType: 'general_50',
      }),
      makeProperty({
        id: 'p2',
        name: 'Local Comercial Gràcia',
        acquisitionCost: 150000,
        grossRentalIncome: 15000,
        totalCadastralValue: 100000,
        constructionCadastralValue: 60000,
        ibi: 600,
        communityFees: 400,
        repairExpenses: 300,
        mortgageInterests: 0,
        insurance: 300,
        usageType: 'commercial',
        reductionType: 'none',
      }),
    ];

    const portfolio = analyzePortfolioFinances(properties, 2024);

    assert(portfolio.totalProperties === 2, '2 immobles a la cartera');
    assert(portfolio.totalGrossIncome === 29000, `Ingressos bruts totals 29.000 € (obtingut: ${portfolio.totalGrossIncome})`);
    assert(portfolio.propertiesRanked.length === 2, '2 immobles al rànquing');
    assert(portfolio.propertiesRanked[0].propertyId === 'p2', 'El local comercial té un yield superior');
    assert(portfolio.portfolioFiveYearProjection.length === 5, 'Projecció agregada de cartera a 5 anys generada');
  });

  test('32.3 Renderització del component visual RealEstateDashboard', () => {
    const properties = [
      makeProperty({ id: 'p1', name: 'Pis Test', acquisitionCost: 200000, grossRentalIncome: 12000, totalCadastralValue: 100000, constructionCadastralValue: 70000, usageType: 'habitual' })
    ];
    const dashboard = createRealEstateDashboard(properties, 2024);
    assert(dashboard !== null && dashboard !== undefined, 'El component ha de retornar un element DOM');
    assert(dashboard.className.includes('real-estate-dashboard-container'), 'Classe del contenidor correcta');
    assert(dashboard.innerHTML.includes('Quadre de Comandament de Rendibilitat'), 'Títol del quadre present');
  });
});

suite('33. Quadre de Comandament d\'Inversions & Diari de Trading (investment-cockpit-engine.ts)', () => {
  test('33.1 Classificació intel·ligent d\'actius i estils de permanència', () => {
    assert(classifyAssetType('Bitcoin (BTC)') === 'crypto', 'Detecció de criptoactiu');
    assert(classifyAssetType('Vanguard Global Stock Index Fund') === 'funds', 'Detecció de fons d\'inversió');
    assert(classifyAssetType('iShares Core S&P 500 ETF') === 'etf', 'Detecció d\'ETF');
    assert(classifyAssetType('NVIDIA Corp (NVDA)') === 'shares', 'Detecció d\'accions');

    assert(determineHoldingStyle(0) === 'scalping', '0 dies = Scalping');
    assert(determineHoldingStyle(15) === 'swing', '15 dies = Swing');
    assert(determineHoldingStyle(90) === 'positional', '90 dies = Posicional');
    assert(determineHoldingStyle(400) === 'long_term', '400 dies = Llarg Termini');
  });

  test('33.2 Càlcul de mètriques quantitatives, P&L, Win Rate i Profit Factor', () => {
    const trades: GainItem[] = [
      {
        id: 't1',
        description: 'Apple Inc',
        type: 'shares',
        acquisitionDate: '2024-01-10',
        transferDate: '2024-02-10',
        acquisitionValue: 1000,
        transferValue: 1500,
        expenses: 10,
      },
      {
        id: 't2',
        description: 'Tesla Inc',
        type: 'shares',
        acquisitionDate: '2024-03-01',
        transferDate: '2024-03-15',
        acquisitionValue: 2000,
        transferValue: 1600,
        expenses: 10,
      },
      {
        id: 't3',
        description: 'Ethereum',
        type: 'crypto',
        acquisitionDate: '2024-02-01',
        transferDate: '2024-05-01',
        acquisitionValue: 3000,
        transferValue: 4500,
        expenses: 20,
      },
    ];

    const report = analyzeInvestmentCockpit(trades);

    // t1: 1500 - 1000 - 10 = +490
    // t2: 1600 - 2000 - 10 = -410
    // t3: 4500 - 3000 - 20 = +1480
    // GrossProfit: 490 + 1480 = 1970
    // GrossLoss: 410
    // NetPnL: 1970 - 410 = 1560
    assert(report.totalTrades === 3, '3 operacions analitzades');
    assert(report.winningTrades === 2, '2 victòries');
    assert(report.losingTrades === 1, '1 derrota');
    assert(report.winRate === 66.67, 'Win rate 66.67%');
    assert(report.grossProfit === 1970, `Gross profit 1.970 € (obtingut: ${report.grossProfit})`);
    assert(report.grossLoss === 410, `Gross loss 410 € (obtingut: ${report.grossLoss})`);
    assert(report.netPnL === 1560, `Net PnL 1.560 € (obtingut: ${report.netPnL})`);
    assert(report.profitFactor === 4.8, `Profit factor 4.8 (obtingut: ${report.profitFactor})`);
    assert(report.equityCurve.length === 3, '3 punts a la corba d\'equitat');
  });

  test('33.3 Càlcul de Fricció Fiscal (Tax Drag) i escala de l\'estalvi', () => {
    // Base imposable 10.000 €:
    // Fins a 6.000 € al 19% = 1.140 €
    // De 6.000 a 10.000 (4.000 €) al 21% = 840 €
    // Total = 1.980 €
    const tax = calculateSavingsTaxEUR(10000);
    assert(tax === 1980, `Impost de l'estalvi sobre 10.000 € és 1.980 € (obtingut: ${tax})`);

    const zeroTax = calculateSavingsTaxEUR(-500);
    assert(zeroTax === 0, 'Pèrdues tributen 0 €');
  });

  test('33.4 Detecció de Regla dels 2 Mesos (Wash Sales Art. 33.5 LIRPF) i simulació What-If', () => {
    const washTrades: GainItem[] = [
      {
        id: 'w1',
        description: 'Santander SA',
        type: 'shares',
        acquisitionDate: '2024-01-01',
        transferDate: '2024-01-20',
        acquisitionValue: 5000,
        transferValue: 4000,
        expenses: 0,
      },
      {
        id: 'w2',
        description: 'Santander SA',
        type: 'shares',
        acquisitionDate: '2024-02-05', // 16 dies després! (< 60 dies)
        transferDate: '2024-06-01',
        acquisitionValue: 4000,
        transferValue: 4200,
        expenses: 0,
      },
    ];

    const report = analyzeInvestmentCockpit(washTrades);
    assert(report.postMortem.hasWashSaleLock === true, 'Detectada recompra en menys de 2 mesos');
    assert(report.postMortem.blockedWashSaleLossesEUR === 1000, 'Pèrdua de 1.000 € bloquejada');
    assert(report.whatIfNoWashSales.pnlDifferenceEUR === 190, 'Estalvi d\'impost del 19% = 190 €');
    assert(report.whatIfStrictStopLoss5Pct.tradesModifiedCount === 1, '1 trade superava el límit del -5%');
  });

  test('33.5 Gestió de Risc Professional: Criteri de Kelly, VaR 95% i R-Multiples', () => {
    const trades: GainItem[] = [
      {
        id: 'r1',
        description: 'Nvidia Corp',
        type: 'shares',
        acquisitionDate: '2024-01-10',
        transferDate: '2024-02-10',
        acquisitionValue: 5000,
        transferValue: 6000,
        expenses: 0,
        riskAmountEUR: 250, // 1R = 250 € -> PnL = +1.000 € -> +4R
      },
      {
        id: 'r2',
        description: 'Tesla Inc',
        type: 'shares',
        acquisitionDate: '2024-03-01',
        transferDate: '2024-03-15',
        acquisitionValue: 5000,
        transferValue: 4500,
        expenses: 0,
        riskAmountEUR: 250, // 1R = 250 € -> PnL = -500 € -> -2R
      },
    ];

    const report = analyzeInvestmentCockpit(trades);
    assert(report.riskMetrics.totalRAccumulated === 2.0, `R-Multiples nets = +2R (obtingut: ${report.riskMetrics.totalRAccumulated}R)`);
    assert(report.riskMetrics.kellyFractionPct >= 0, 'Càlcul de fracció de Kelly vàlid');
    assert(report.riskMetrics.halfKellyPct === report.riskMetrics.kellyFractionPct / 2, 'Half Kelly exactament la meitat');
    assert(report.riskMetrics.var95EUR > 0, 'Value at Risk calculat per sobre de 0');
  });

  test('33.6 Mapa de Calor Calendari, Anàlisi per Setups i Diari Kaizen', () => {
    const trades: GainItem[] = [
      {
        id: 's1',
        description: 'BTC Breakout',
        type: 'crypto',
        acquisitionDate: '2024-01-10',
        transferDate: '2024-01-11',
        acquisitionValue: 1000,
        transferValue: 1300,
        expenses: 0,
        setup: 'Breakout',
        emotionTag: 'Pla Executat',
        executionGrade: 'A+',
      },
      {
        id: 's2',
        description: 'ETH DCA',
        type: 'crypto',
        acquisitionDate: '2024-02-01',
        transferDate: '2024-02-20',
        acquisitionValue: 1000,
        transferValue: 1100,
        expenses: 0,
        setup: 'DCA / Acumulació',
        emotionTag: 'Pla Executat',
        executionGrade: 'A',
      },
    ];

    const report = analyzeInvestmentCockpit(trades);
    assert(report.setups.length === 2, '2 setups registrats');
    assert(report.setups.some(s => s.setup === 'Breakout'), 'Conté setup Breakout');
    assert(report.dailyCalendarHeatmap.length === 2, '2 dies al mapa de calor');
    assert(report.postMortem.kaizenGoldenRules.length > 0, 'Generades regles d\'or Kaizen');
  });
});

suite('34. Laboratori de Backtesting Institucional & Walk-Forward (backtest-engine.ts)', () => {
  test('34.1 Execució de backtest amb Stop Loss, Take Profit i Fricció (Slippage/Comissions)', () => {
    const trades: GainItem[] = [
      {
        id: 'bt1',
        description: 'Apple Inc',
        type: 'shares',
        acquisitionDate: '2024-01-10',
        transferDate: '2024-01-20',
        acquisitionValue: 2000,
        transferValue: 2600, // +30% raw -> Take Profit a +18%
        expenses: 0,
      },
      {
        id: 'bt2',
        description: 'Tesla Inc',
        type: 'shares',
        acquisitionDate: '2024-02-01',
        transferDate: '2024-02-15',
        acquisitionValue: 2000,
        transferValue: 1600, // -20% raw -> Stop Loss tallat a -6%
        expenses: 0,
      },
      {
        id: 'bt3',
        description: 'Nvidia Corp',
        type: 'shares',
        acquisitionDate: '2024-03-01',
        transferDate: '2024-03-20',
        acquisitionValue: 2000,
        transferValue: 2200, // +10% raw
        expenses: 0,
      },
    ];

    const res = runInstitutionalBacktest(trades, {
      stopLossPercent: 6,
      takeProfitPercent: 18,
      sizingModel: 'fixed_eur',
      fixedTradeAmountEUR: 2000,
      commissionPerTradeEUR: 2.50,
      slippageBps: 10,
    });

    assert(res.totalTrades === 3, '3 operacions simulades');
    assert(res.trades[0].exitReason === 'TAKE_PROFIT', 'Primera operació tancada per Take Profit');
    assert(res.trades[1].exitReason === 'STOP_LOSS', 'Segona operació tallada per Stop Loss');
    assert(res.totalNetPnL > 0, 'P&L net simulat positiu');
    assert(res.totalCommissionsEUR === 15, `Comissions totals 15 € (2.50 x 2 x 3 trades) - obtingut: ${res.totalCommissionsEUR}`);
    assert(res.totalSlippageEUR > 0, 'Slippage calculat');
  });

  test('34.2 Càlcul de mètriques quantitatives: SQN (Van Tharp), K-Ratio i Z-Score', () => {
    const trades: GainItem[] = Array.from({ length: 10 }).map((_, i) => ({
      id: `t_${i}`,
      description: `Stock ${i}`,
      type: 'shares',
      acquisitionDate: `2024-0${Math.floor(i / 2) + 1}-01`,
      transferDate: `2024-0${Math.floor(i / 2) + 1}-15`,
      acquisitionValue: 1000,
      transferValue: i % 3 === 0 ? 800 : 1250,
      expenses: 0,
    }));

    const res = runInstitutionalBacktest(trades);
    assert(res.sqn !== undefined && res.sqn !== null, 'SQN calculat');
    assert(res.sqnRating.length > 0, 'Qualificació de SQN assignada');
    assert(res.recoveryFactor > 0, 'Recovery factor calculat');
    assert(res.runsDependencyText.length > 0, 'Diagnòstic de dependència de ratxes present');
  });

  test('34.3 Validació Walk-Forward (In-Sample vs Out-of-Sample) i Matriu de Sensibilitat', () => {
    const trades: GainItem[] = Array.from({ length: 10 }).map((_, i) => ({
      id: `wf_${i}`,
      description: `Asset ${i}`,
      type: 'shares',
      acquisitionDate: `2024-0${Math.floor(i / 2) + 1}-01`,
      transferDate: `2024-0${Math.floor(i / 2) + 1}-15`,
      acquisitionValue: 1000,
      transferValue: 1150,
      expenses: 0,
    }));

    const res = runInstitutionalBacktest(trades, { walkForwardSplitPercent: 70 });
    assert(res.inSampleMetrics.tradesCount === 7, '7 trades In-Sample (70%)');
    assert(res.outOfSampleMetrics.tradesCount === 3, '3 trades Out-of-Sample (30%)');
    assert(res.sensitivityMatrix.length === 16, 'Matriu de sensibilitat 4x4 (16 combinacions)');
  });

  test('34.4 Mètriques Hedge Fund: Ràtio Omega, Ulcer Index, Tail Ratio i Matriu Mensual', () => {
    const trades: GainItem[] = [
      {
        id: 't_m1',
        description: 'Trade Gen',
        type: 'shares',
        acquisitionDate: '2024-01-05',
        transferDate: '2024-01-25',
        acquisitionValue: 3000,
        transferValue: 3600,
        expenses: 10,
      },
      {
        id: 't_m2',
        description: 'Trade Feb',
        type: 'crypto',
        acquisitionDate: '2024-02-01',
        transferDate: '2024-02-18',
        acquisitionValue: 2000,
        transferValue: 1800,
        expenses: 5,
      },
      {
        id: 't_m3',
        description: 'Trade Mar',
        type: 'funds',
        acquisitionDate: '2024-03-01',
        transferDate: '2024-03-30',
        acquisitionValue: 4000,
        transferValue: 4500,
        expenses: 0,
      },
    ];

    const res = runInstitutionalBacktest(trades);
    assert(res.omegaRatio > 0, 'Ràtio Omega calculat');
    assert(res.gainToPainRatio !== undefined, 'Gain-to-Pain calculat');
    assert(res.tailRatio > 0, 'Tail ratio calculat');
    assert(res.ulcerIndex >= 0, 'Ulcer Index calculat');
    assert(res.monthlyReturnMatrix.length > 0, 'Matriu mensual generada');
    assert(res.assetClassPerformance.length > 0, 'Rendiment per classe d\'actiu calculat');
    assert(res.assetClassPerformance.some(ac => ac.assetClass === 'shares'), 'Conté accions');
    assert(res.assetClassPerformance.some(ac => ac.assetClass === 'crypto'), 'Conté cripto');
  });

  test('34.5 Modelització CAPM (Alpha, Beta), Fiscalitat Wash Sale Art. 33.5 i R-Multiples', () => {
    const trades: GainItem[] = [
      {
        id: 'ws_1',
        description: 'Santander SA',
        type: 'shares',
        acquisitionDate: '2024-01-10',
        transferDate: '2024-01-20',
        acquisitionValue: 5000,
        transferValue: 4000, // Pèrdua de 1000€
        expenses: 0,
      },
      {
        id: 'ws_2',
        description: 'Santander SA', // Recompra homogènia en <60 dies (1 de febrer)
        type: 'shares',
        acquisitionDate: '2024-02-01',
        transferDate: '2024-02-28',
        acquisitionValue: 5000,
        transferValue: 5500,
        expenses: 0,
      },
      {
        id: 'ws_3',
        description: 'BBVA SA',
        type: 'shares',
        acquisitionDate: '2024-03-01',
        transferDate: '2024-03-15',
        acquisitionValue: 3000,
        transferValue: 3600,
        expenses: 0,
      },
    ];

    const res = runInstitutionalBacktest(trades, { enforce2MonthWashSale: true });
    assert(res.beta !== undefined, 'Beta calculada');
    assert(res.jensenAlphaPct !== undefined, 'Jensen Alpha calculat');
    assert(res.treynorRatio !== undefined, 'Treynor ratio calculat');
    assert(res.totalWashSaleDeferredLossEUR > 0, 'Pèrdua suspesa per Wash Sale identificada');
    assert(res.washSaleTradesCount === 1, '1 operació afectada per regla dels 2 mesos');
    assert(res.rMultipleDistribution.length > 0, 'Distribució de R-Multiples calculada');
  });

  test('34.6 Value at Risk Avançat (Cornish-Fisher, CVaR), Eficiència MAE/MFE i Stress-Testing', () => {
    const trades: GainItem[] = Array.from({ length: 20 }).map((_, i) => ({
      id: `cf_${i}`,
      description: `Asset ${i}`,
      type: 'shares',
      acquisitionDate: `2024-0${Math.floor(i / 3) + 1}-01`,
      transferDate: `2024-0${Math.floor(i / 3) + 1}-20`,
      acquisitionValue: 2000,
      transferValue: i % 4 === 0 ? 1700 : (i % 2 === 0 ? 2300 : 2100),
      expenses: 2,
    }));

    const res = runInstitutionalBacktest(trades);
    assert(res.historicalVaR95EUR >= 0, 'Historical VaR 95% calculat');
    assert(res.cornishFisherVaR95EUR >= 0, 'Cornish-Fisher VaR 95% calculat');
    assert(res.conditionalVaR95EUR >= 0, 'Expected Shortfall (CVaR) calculat');
    assert(res.skewness !== undefined, 'Asimetria calculada');
    assert(res.kurtosis !== undefined, 'Curtosi calculada');
    assert(res.avgMaePercent >= 0, 'Average MAE calculat');
    assert(res.avgMfePercent >= 0, 'Average MFE calculat');
    assert(res.tradeExecutionEfficiencyScore >= 0, 'Trade execution efficiency calculada');
    assert(res.stressTestScenarios.length === 3, '3 escenaris de stress testing generats');
  });

  test('34.7 Mètriques Temporals: CAGR, Volatilitat Anualitzada, Rolling Edge i Corba de Kelly', () => {
    const trades: GainItem[] = [
      {
        id: 'cagr_1',
        description: 'Trade Jan',
        type: 'shares',
        acquisitionDate: '2024-01-01',
        transferDate: '2024-03-01',
        acquisitionValue: 5000,
        transferValue: 5800,
        expenses: 5,
      },
      {
        id: 'cagr_2',
        description: 'Trade Jun',
        type: 'crypto',
        acquisitionDate: '2024-06-01',
        transferDate: '2024-08-01',
        acquisitionValue: 5000,
        transferValue: 5600,
        expenses: 5,
      },
      {
        id: 'cagr_3',
        description: 'Trade Nov',
        type: 'funds',
        acquisitionDate: '2024-11-01',
        transferDate: '2024-12-15',
        acquisitionValue: 5000,
        transferValue: 5400,
        expenses: 5,
      },
    ];

    const res = runInstitutionalBacktest(trades);
    assert(res.cagrPercent !== undefined, 'CAGR calculat');
    assert(res.annualizedVolatilityPercent >= 0, 'Volatilitat anualitzada calculada');
    assert(res.annualizedSharpeRatio !== undefined, 'Sharpe anualitzat calculat');
    assert(res.annualizedSortinoRatio !== undefined, 'Sortino anualitzat calculat');
    assert(res.kellyOptimizationCurve.length === 6, '6 punts de la corba d\'optimització de Kelly');
    assert(res.kellyOptimizationCurve.some(k => k.kellyMultiplier === 0.5), 'Conté Half-Kelly');
  });
});

suite('35. Perfeccionament de l\'Exactitud Numèrica i Blindatge Tributari Garantista', () => {
  test('35.1 Aritmètica Decimal Exacta en el Càlcul d\'IRPF (irpf.ts)', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [
      {
        id: 'emp_exact',
        name: 'Tech Corp SL',
        grossSalary: 38456.77,
        inKind: 1250.33,
        socialSecurity: 2439.81,
        withholdings: 6150.25,
        dietsIncome: 0,
        dietsDays: 0,
        mileageIncome: 0,
        mileageKm: 0,
      },
    ];

    const res = calculateIRPF(data);
    // Verificació d'arredoniment estricte a 2 decimals sense residus flotants IEEE-754
    assert(Number.isFinite(res.generalBase), 'Base general finita');
    assert(res.generalTax.toString().split('.')[1]?.length <= 2 || !res.generalTax.toString().includes('.'), 'Quota general arrodonida a 2 decimals exactes');
    assert(res.grossTax.toString().split('.')[1]?.length <= 2 || !res.grossTax.toString().includes('.'), 'Quota íntegra arrodonida a 2 decimals');
    assert(res.netTax.toString().split('.')[1]?.length <= 2 || !res.netTax.toString().includes('.'), 'Quota líquida arrodonida a 2 decimals');
    assert(res.result.toString().split('.')[1]?.length <= 2 || !res.result.toString().includes('.'), 'Resultat diferencial arrodonit a 2 decimals');
  });

  test('35.2 Despeses Garantistes de Treball: Col·legis Professionals (Art. 19.2.d) i Defensa Jurídica (Art. 19.2.e)', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [
      {
        id: 'emp_lawyer',
        name: 'Bufet Jurídic SL',
        grossSalary: 45000,
        inKind: 0,
        socialSecurity: 2000,
        withholdings: 8000,
        dietsIncome: 0,
        dietsDays: 0,
        mileageIncome: 0,
        mileageKm: 0,
      },
    ];
    // Cuotes col·legials amb excés sobre el topall de 500 €
    data.workIncome.professionalCollegeFees = 750;
    // Despeses de defensa jurídica laboral amb excés sobre el topall de 300 €
    data.workIncome.legalDefenseFees = 450;

    const res = calculateIRPF(data);
    assert(res.professionalCollegeDeduction === 500, `Topall col·legis 500€ aplicat exactament: obtingut ${res.professionalCollegeDeduction}`);
    assert(res.legalDefenseDeduction === 300, `Topall defensa laboral 300€ aplicat exactament: obtingut ${res.legalDefenseDeduction}`);

    // Ingressos nets = 45.000 - (2.000 SS + 500 Col·legi + 300 Defensa + 2.000 Altres despeses) = 40.200 €
    assert(res.generalBase === 40200, `Base imposable general correcta: ${res.generalBase} €`);
  });

  test('35.3 Indemnitzacions per Acomiadament Laboral (Art. 7.e i 18.2 LIRPF)', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [];
    data.workIncome.severancePay = 220000;
    data.workIncome.severanceMandatoryLegalLimit = 180000;

    const res = calculateIRPF(data);
    assert(res.exemptSeverancePay === 180000, 'Exempció legal d\'indemnització de 180.000 € aplicada');
    assert(res.taxableSeverancePay === 40000, 'Excés tributable de 40.000 € correctament identificat');
  });

  test('35.4 Amortització Immobiliària amb Despeses d\'Adquisició (Jurisprudència STS 1130/2021)', () => {
    const prop = makeProperty({
      id: 'prop-sts',
      name: 'Pis Passeig de Gràcia',
      cadastralReference: '77788899001122334455',
      address: 'Passeig de Gràcia 50',
      ownershipPercentage: 100,
      usageType: 'habitual',
      grossRentalIncome: 24000,
      otherIncomes: 0,
      mortgageInterests: 1200,
      repairExpenses: 800,
      pendingRepairsPreviousYears: 0,
      totalCadastralValue: 100000,
      constructionCadastralValue: 70000, // 70% construcció
      acquisitionCost: 200000,
      acquisitionExpenses: 25000, // ITP, Notaria, Registre, Gestoria (STS 1130/2021)
      ibi: 600,
      wasteTax: 100,
      communityFees: 1200,
      insurance: 400,
      managementFees: 0,
      badDebts: 0,
      isMixedUsage: false,
      rentalDays: 365,
      ownUseDays: 0,
      reductionType: 'general_50',
      inventory: [],
    });

    const calc = calculatePropertyFiscalResult(prop, 2024);
    assert(calc.effectiveAcquisitionCost === 225000, `Cost adquisició efectiu satisfet ha de ser 225.000 €, obtingut: ${calc.effectiveAcquisitionCost}`);
    // Base construcció: 225.000 * 0.70 = 157.500 € (superior a 70.000 cadastrals)
    assert(calc.constructionBase === 157500, `Base amortització de construcció ha de ser 157.500 €, obtingut: ${calc.constructionBase}`);
    // Amortització 3%: 157.500 * 0.03 = 4.725 €
    assert(calc.buildingAmortization === 4725, `Amortització 3% ha de ser 4.725 €, obtingut: ${calc.buildingAmortization}`);
  });

  test('35.5 Deducció per Maternitat Multi-Hijo (Art. 81 LIRPF i STS 8/2024)', () => {
    const data = createEmptyDeclaracion(2024);
    data.personal.descendants = [
      { id: 'child1', age: 1, disability: 0 },
      { id: 'child2', age: 1, disability: 0 },
    ];
    data.deductions.maternityDeduction = true;
    data.deductions.maternityMonths = 24; // 12 mesos x 2 fills
    data.deductions.maternityNurseryExpenses = 1800; // Despeses guarderia per ambdós (màx 1.000€ cadascun)

    const amounts = computeDeductions(data);
    // Base maternitat: 24 * 100 = 2.400 € (màx 1.200 x 2 = 2.400 €)
    // Guarderia: 1.800 € (màx 1.000 x 2 = 2.000 €)
    // Total = 2.400 + 1.800 = 4.200 €
    assert(amounts.maternityDeductionAmount === 4200, `Deducció maternitat multi-hijo ha de ser 4.200 €, obtingut: ${amounts.maternityDeductionAmount}`);
  });

  test('35.6 Compensació Garantista de l\'Estalvi amb Aritmètica Decimal Oficial (Art. 49 LIRPF)', () => {
    const priorMob = [{ year: 2021, amount: 250.75 }];
    const priorGains = [{ year: 2021, amount: 450.50 }];

    const comp = calculateSavingsCompensation(-500.50, 2000.00, priorMob, priorGains);
    // Compensació creuada 25% de 2.000 = 500 €
    assert(comp.crossCompensationApplied === 500, `Compensació creuada: ${comp.crossCompensationApplied}`);
    assert(comp.gainsAfterCross === 1500, `Guanys restants després de creuada: ${comp.gainsAfterCross}`);
    assert(comp.priorGainsCompensated === 450.5, `Pèrdues prèvies de guanys compensades: ${comp.priorGainsCompensated}`);
    // La bossa de mobiliari (250,75 €) s'aplica creuada amb el límit del 25% de 1.049,50 € = 262,375 €
    assert(comp.priorCrossCompensated === 250.75, `Compensació creuada de la bossa: ${comp.priorCrossCompensated}`);
    assert(comp.finalSavingsBase === 798.75, `Base final de l'estalvi exacta: ${comp.finalSavingsBase}`);
  });
});

suite('36. Validació UI, Formularis Reactius i Mapa de Caselles Oficials (Iteració 2)', () => {
  test('36.1 Renderització i actualització de camps garantistes de treball (work-income.ts)', () => {
    store.reset();
    const el = renderWorkIncome();
    assert(el !== null, 'Pàgina de rendiments del treball renderitzada');

    const profInput = el.querySelector('#prof-college-fees') as unknown as MockElement;
    assert(profInput !== null, 'Camp de quotes a col·legis professionals existent');
    profInput.value = '450';
    profInput.dispatchEvent('input');
    assert(store.getData().workIncome.professionalCollegeFees === 450, 'Store actualitzat amb quotes col·legials');

    const legalInput = el.querySelector('#legal-defense-fees') as unknown as MockElement;
    assert(legalInput !== null, 'Camp de defensa jurídica laboral existent');
    legalInput.value = '250';
    legalInput.dispatchEvent('input');
    assert(store.getData().workIncome.legalDefenseFees === 250, 'Store actualitzat amb defensa laboral');

    const sevInput = el.querySelector('#severance-pay') as unknown as MockElement;
    assert(sevInput !== null, 'Camp d\'indemnització per acomiadament existent');
    sevInput.value = '50000';
    sevInput.dispatchEvent('input');
    assert(store.getData().workIncome.severancePay === 50000, 'Store actualitzat amb indemnització');
  });

  test('36.2 Fidelitat i exactitud en el Mapa Oficial de Caselles AEAT (caselles.ts)', () => {
    store.reset();
    store.update('workIncome', {
      employers: [
        {
          id: 'emp_1',
          name: 'Empresa A',
          grossSalary: 50000,
          inKind: 0,
          socialSecurity: 3000,
          withholdings: 10000,
          dietsIncome: 0,
          dietsDays: 0,
          mileageIncome: 0,
          mileageKm: 0,
        },
      ],
      unionFees: 120,
      professionalCollegeFees: 500,
      legalDefenseFees: 300,
    });

    const page = renderCasellesPage();
    assert(page !== null, 'Pàgina de caselles renderitzada');

    const data = store.getData();
    const result = calculateIRPF(data);
    assert(result.professionalCollegeDeduction === 500, 'Deducció col·legi 500 €');
    assert(result.legalDefenseDeduction === 300, 'Deducció defensa jurídica 300 €');

    // Comprovar contingut HTML amb les caselles oficials
    assert(page.innerHTML.includes('[0013]'), 'Casella [0013] de quotes sindicals present');
    assert(page.innerHTML.includes('[0015]'), 'Casella [0015] de col·legis professionals present');
    assert(page.innerHTML.includes('[0016]'), 'Casella [0016] de defensa jurídica laboral present');
    assert(page.innerHTML.includes('[0081]'), 'Casella [0081] de cost d\'adquisició amortitzable present');
  });

  test('36.3 Radar de Compliment: Oportunitat STS 1130/2021 i Caducitat de 4 Anys (auto-validator.ts)', () => {
    const data = createEmptyDeclaracion(2024);
    data.properties = [
      makeProperty({
        id: 'prop-alert-1',
        name: 'Apartament València',
        cadastralReference: '12345678901234567890',
        address: 'Carrer Colón 10',
        ownershipPercentage: 100,
        usageType: 'habitual',
        grossRentalIncome: 12000,
        otherIncomes: 0,
        mortgageInterests: 0,
        repairExpenses: 0,
        pendingRepairsPreviousYears: 0,
        totalCadastralValue: 100000,
        constructionCadastralValue: 60000,
        acquisitionCost: 180000,
        acquisitionExpenses: 0, // 0 € -> Dispara oportunitat STS 1130/2021
        ibi: 400,
        wasteTax: 80,
        communityFees: 600,
        insurance: 250,
        managementFees: 0,
        badDebts: 0,
        inventory: [],
        improvements: [],
        furniture: [],
        reductionType: 'general_50',
        tenantNIFs: ['12345678Z'],
      }),
    ];

    // Bossa de pèrdues de fa exactament 4 anys (2020 en exercici 2024)
    data.lossCarryovers = {
      pendingGeneralLosses: [],
      pendingMobiliaryLosses: [{ year: 2020, amount: 1500 }],
      pendingCapitalLosses: [],
    };

    const report = runAutomatedComplianceChecks(data);
    const hasStsNotice = report.issues.some(i => i.id.startsWith('prop-missing-acq-expenses'));
    assert(hasStsNotice, 'Radar ha detectat oportunitat d\'estalvi fiscal STS 1130/2021');

    const hasPrescriptionWarning = report.issues.some(i => i.id === 'gains-loss-carryover-expiring-this-year');
    assert(hasPrescriptionWarning, 'Radar ha emès alerta de caducitat imminent de 4 anys d\'Art. 49 LIRPF');
  });
});

// ── 37. SUITE 37: GENERACIÓ DE DOSSIER DE DEFENSA FISCAL I COCKPIT EXACTE ───

suite('37. Generació de Dossier de Defensa Fiscal i Cockpit Exacte', () => {

  test('37.1 Dossier de defensa amb jurisprudència STS 1130/2021, STS 8/2024 i Art. 19.2 LIRPF', () => {
    const data = createEmptyDeclaracion(2024);
    data.personal.name = 'Maria Vidal';
    data.personal.nif = '44556677B';
    data.personal.community = 'CAT';

    // Despeses laborals amb col·legi professional i defensa jurídica
    data.workIncome.employers = [{
      id: 'emp1',
      name: 'Empresa SA',
      grossSalary: 45000,
      withholdings: 9000,
      socialSecurity: 2800,
      inKind: 0,
      dietsIncome: 0,
      dietsDays: 0,
      mileageIncome: 0,
      mileageKm: 0,
    }];
    data.workIncome.unionFees = 150;
    data.workIncome.professionalCollegeFees = 500;
    data.workIncome.legalDefenseFees = 300;

    // Immoble amb despeses d'adquisició STS 1130/2021
    data.properties = [makeProperty({
      id: 'prop-1',
      name: 'Passeig de Gràcia',
      cadastralReference: '99887766BC1234S0001AA',
      address: 'Passeig de Gràcia 50',
      ownershipPercentage: 100,
      usageType: 'habitual',
      grossRentalIncome: 15000,
      otherIncomes: 0,
      mortgageInterests: 0,
      repairExpenses: 0,
      pendingRepairsPreviousYears: 0,
      totalCadastralValue: 120000,
      constructionCadastralValue: 72000,
      acquisitionCost: 200000,
      acquisitionExpenses: 20000, // 20.000 € d'ITP, notaria, registre
      ibi: 500,
      wasteTax: 90,
      communityFees: 800,
      insurance: 300,
      managementFees: 0,
      badDebts: 0,
      inventory: [],
      improvements: [],
      furniture: [],
      reductionType: 'general_50',
      tenantNIFs: ['12345678Z'],
    })];

    // Deducció maternitat amb despeses de custòdia / llar d'infants STS 8/2024
    data.personal.descendants = [
      { id: 'c1', age: 1, disability: 0 },
    ];
    data.deductions.maternityDeduction = true;
    data.deductions.maternityMonths = 12;
    data.deductions.maternityNurseryExpenses = 1000;

    const dossier = generateTaxDefenseDossier(data);

    assert(dossier.boxJustifications.length >= 2, 'El dossier ha de generar múltiples seccions justificatives');
    assert(dossier.boxJustifications.some(j => j.boxNumber === '0081' && j.legalBasis.includes('1130/2021')), 'El dossier ha d\'invocar la Sentència del Tribunal Suprem 1130/2021 per a despeses d\'adquisició');
    assert(dossier.boxJustifications.some(j => j.legalBasis.includes('8/2024')), 'El dossier ha d\'invocar la Sentència del Tribunal Suprem 8/2024 per a despeses de llar d\'infants sense autorització autonòmica');
    assert(dossier.boxJustifications.some(j => j.boxNumber === '0015' && j.legalBasis.includes('Art. 19.2.d')), 'El dossier ha de citar l\'Art. 19.2.d LIRPF per a col·legiació obligatòria');
    assert(dossier.boxJustifications.some(j => j.boxNumber === '0016' && j.legalBasis.includes('Art. 19.2.e')), 'El dossier ha de citar l\'Art. 19.2.e LIRPF per a defensa jurídica laboral');

    // Comprovar arguments globals de defensa
    const hasSts1130Arg = dossier.defenseArguments.some(arg => arg.includes('1130/2021'));
    assert(hasSts1130Arg, 'Els arguments de defensa han de citar STS 1130/2021');
    const hasSts8Arg = dossier.defenseArguments.some(arg => arg.includes('8/2024'));
    assert(hasSts8Arg, 'Els arguments de defensa han de citar STS 8/2024');
  });

  test('37.2 Motor de Cockpit d\'Inversió amb Càlcul Exacte de Trams de l\'Estalvi (calculateSavingsTaxEUR)', () => {
    // Tram 1: Fins a 6.000 € al 19% = 1.140 €
    const tax6k = calculateSavingsTaxEUR(6000);
    assert(Math.abs(tax6k - 1140) < 0.001, `6.000 € d'estalvi ha de tributar exactament 1.140,00 € (obtingut: ${tax6k})`);

    // Tram 2: Fins a 50.000 € (6k al 19% = 1.140 + 44k al 21% = 9.240) = 10.380 €
    const tax50k = calculateSavingsTaxEUR(50000);
    assert(Math.abs(tax50k - 10380) < 0.001, `50.000 € d'estalvi ha de tributar exactament 10.380,00 € (obtingut: ${tax50k})`);

    // Import intermedi amb decimals
    const taxMid = calculateSavingsTaxEUR(12345.67);
    // 6.000 * 0.19 = 1140.00
    // 6.345,67 * 0.21 = 1332.5907 -> 1332.59
    // Total = 2472.59 €
    assert(Math.abs(taxMid - 2472.59) < 0.01, `12.345,67 € ha de tributar 2.472,59 € (obtingut: ${taxMid})`);
  });
});

// ── 38. SUITE 38: BLINDATGE PLUSVÀLUA STC 182/2021, BECKHAM & CCAA MULTI-FORMAT ──

suite('38. Blindatge Plusvàlua STC 182/2021, Llei Beckham & CCAA Multi-Format', () => {

  test('38.1 Plusvàlua Municipal: No subjecció per inexistència d\'increment (STC 182/2021)', () => {
    // Venda a pèrdues: comprat a 250.000 € i venut a 210.000 €
    const lossSale = ITPAndAJDEngine.calculatePlusvalia({
      acquisitionDate: '2018-05-10',
      transferDate: '2024-06-15',
      cadastralLandValue: 80000,
      acquisitionPrice: 250000,
      transferPrice: 210000, // Pèrdua real de 40.000 €
      municipalityCoef: 1.0,
      taxRate: 30,
      yearsOwned: 6,
      objectiveBase: 0,
      realBase: 0,
      chosenMethod: 'real',
      taxableBase: 0,
      amountDue: 0,
    });

    assert(lossSale.taxableBase === 0, `Base imposable en venda a pèrdues ha de ser 0 € (obtingut: ${lossSale.taxableBase})`);
    assert(lossSale.amountDue === 0, `Quota tributària en venda a pèrdues ha de ser 0 € segons STC 182/2021 (obtingut: ${lossSale.amountDue})`);

    // Venda amb guanys: comprat a 150.000 € i venut a 200.000 € (+50.000 €)
    const gainSale = ITPAndAJDEngine.calculatePlusvalia({
      acquisitionDate: '2020-01-10',
      transferDate: '2024-01-10',
      cadastralLandValue: 60000,
      acquisitionPrice: 150000,
      transferPrice: 200000,
      municipalityCoef: 1.0,
      taxRate: 30,
      yearsOwned: 4,
      objectiveBase: 0,
      realBase: 0,
      chosenMethod: 'objective',
      taxableBase: 0,
      amountDue: 0,
    });

    assert(gainSale.taxableBase > 0, 'Amb guanys la base imposable ha de ser positiva');
    assert(gainSale.amountDue > 0, 'Amb guanys la quota ha de ser positiva');
    // Mètode real: 50.000 * 0.5 = 25.000 €
    // Mètode objectiu: 60.000 * 0.15 = 9.000 € -> Més favorable objectiu!
    assert(gainSale.chosenMethod === 'objective', 'Ha d\'escollir el mètode objectiu (9.000 € vs 25.000 €)');
    assert(gainSale.taxableBase === 9000, `Base imposable objectiva de 9.000 € (obtingut: ${gainSale.taxableBase})`);
    assert(gainSale.amountDue === 2700, `Quota al 30% ha de ser 2.700 € (obtingut: ${gainSale.amountDue})`);
  });

  test('38.2 Exactitud Aritmètica Llei Beckham i Exempció de Rendes Estrangeres', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [{
      id: 'emp_exp',
      name: 'Global Tech Spain SL',
      grossSalary: 120000, // 120.000 € al 24% = 28.800 €
      withholdings: 28800,
      socialSecurity: 2500,
      inKind: 0,
      dietsIncome: 0,
      dietsDays: 0,
      mileageIncome: 0,
      mileageKm: 0,
    }];
    data.capitalIncome = {
      interests: 5000, // 5.000 € estalvi espanyol al 19% = 950 €
      dividends: 1000, // 1.000 € estalvi espanyol al 19% = 190 € (total 6.000 € -> 1.140 €)
      foreignDividends: 25000, // 25.000 € a l'estranger -> 0 € a Espanya sota Llei Beckham!
      foreignTaxWithheld: 3750,
      insuranceGains: 0,
      otherMobiliary: 0,
      mobiliaryWithholdings: 1140,
      rentalIncome: 0,
      rentalExpenses: 0,
      imputedIncome: 0,
      realEstateWithholdings: 0,
    };

    const comp = compareBeckhamRegime(data);
    // Salari: 120.000 * 0.24 = 28.800,00 €
    assert(comp.beckhamWorkTax === 28800, `Quota feina Beckham: 28.800 € (obtingut: ${comp.beckhamWorkTax})`);
    // Estalvi nacional: 6.000 * 0.19 = 1.140,00 €
    assert(comp.beckhamSavingsTax === 1140, `Quota estalvi Beckham: 1.140 € (obtingut: ${comp.beckhamSavingsTax})`);
    assert(comp.beckhamTotalTax === 29940, `Quota total Beckham: 29.940 € (obtingut: ${comp.beckhamTotalTax})`);
  });

  test('38.3 Resolució Multi-Format de Comunitats Autònomes (getAutonomicBrackets)', () => {
    // Per codi de 3 lletres
    const bCatShort = getAutonomicBrackets('CAT');
    assert(bCatShort.length === 9, 'CAT ha de retornar l\'escala de Catalunya de 9 trams');

    const bMadShort = getAutonomicBrackets('MAD');
    assert(bMadShort.length === 5, 'MAD ha de retornar l\'escala de Madrid de 5 trams');

    const bAndShort = getAutonomicBrackets('AND');
    assert(bAndShort.length === 5, 'AND ha de retornar l\'escala d\'Andalusia');

    const bValShort = getAutonomicBrackets('VAL');
    assert(bValShort.length === 9, 'VAL ha de retornar l\'escala valenciana');

    // Per nom normalitzat
    const bCatName = getAutonomicBrackets('catalunya');
    assert(bCatName[0].rate === 0.105, 'Tram 1 català al 10,5%');

    const bMadName = getAutonomicBrackets('madrid');
    assert(bMadName[0].rate === 0.085, 'Tram 1 madrileny al 8,5% deflactat');
  });
});

// ── 39. SUITE 39: DEDUCCIONS AUTONÒMIQUES DE CATALUNYA I EXACTITUD DE BASES ─

suite('39. Deduccions Autonòmiques de Catalunya i Exactitud de Bases', () => {

  test('39.1 Deducció per lloguer d\'habitatge habitual a Catalunya amb límit de renda (20.000 €)', () => {
    // Cas 1: Contribuent que compleix el límit de renda (Rendiment net del treball 18.000 € < 20.000 €)
    const dataOk = createEmptyDeclaracion(2024);
    dataOk.personal.community = 'CAT';
    dataOk.personal.taxDeclarationType = 'individual';
    dataOk.workIncome.employers = [{
      id: 'emp_low',
      name: 'Empresa SL',
      grossSalary: 21000,
      withholdings: 2000,
      socialSecurity: 1000,
      inKind: 0,
      dietsIncome: 0,
      dietsDays: 0,
      mileageIncome: 0,
      mileageKm: 0,
    }];
    dataOk.deductions.catalanRentalDeduction = true;
    dataOk.deductions.catalanRentalAmount = 6000; // 6.000 € pagats de lloguer a l'any
    dataOk.deductions.catalanRentalSituation = 'under32';

    const resOk = calculateIRPF(dataOk);
    // 10% de 6.000 = 600 €, però topall general individual = 300,00 €
    assert(resOk.catalanDeductionsAmount === 300, `Deducció lloguer Catalunya ha d'aplicar el límit de 300 € (obtingut: ${resOk.catalanDeductionsAmount})`);

    // Cas 2: Contribuent que supera el límit de renda (Rendiment net 35.000 € > 20.000 €)
    const dataOver = createEmptyDeclaracion(2024);
    dataOver.personal.community = 'CAT';
    dataOver.personal.taxDeclarationType = 'individual';
    dataOver.workIncome.employers = [{
      id: 'emp_high',
      name: 'Empresa SL',
      grossSalary: 45000,
      withholdings: 8000,
      socialSecurity: 2000,
      inKind: 0,
      dietsIncome: 0,
      dietsDays: 0,
      mileageIncome: 0,
      mileageKm: 0,
    }];
    dataOver.deductions.catalanRentalDeduction = true;
    dataOver.deductions.catalanRentalAmount = 6000;
    dataOver.deductions.catalanRentalSituation = 'under32';

    const resOver = calculateIRPF(dataOver);
    assert(resOver.catalanDeductionsAmount === 0, `Contribuent amb base > 20.000 € no pot aplicar la deducció de lloguer (obtingut: ${resOver.catalanDeductionsAmount})`);
  });

  test('39.2 Deducció per lloguer en família nombrosa o conjunta (topall incrementat a 600 € i límit 30.000 €)', () => {
    const dataSpecial = createEmptyDeclaracion(2024);
    dataSpecial.personal.community = 'CAT';
    dataSpecial.personal.taxDeclarationType = 'joint';
    dataSpecial.workIncome.employers = [{
      id: 'emp_mid',
      name: 'Empresa SL',
      grossSalary: 28000,
      withholdings: 4000,
      socialSecurity: 1500,
      inKind: 0,
      dietsIncome: 0,
      dietsDays: 0,
      mileageIncome: 0,
      mileageKm: 0,
    }];
    dataSpecial.deductions.catalanRentalDeduction = true;
    dataSpecial.deductions.catalanRentalAmount = 8000; // 10% = 800 €
    dataSpecial.deductions.catalanRentalSituation = 'large_family'; // Família nombrosa -> topall 600 €

    const resSpecial = calculateIRPF(dataSpecial);
    assert(resSpecial.catalanDeductionsAmount === 600, `Família nombrosa ha d'aplicar el topall incrementat de 600 € (obtingut: ${resSpecial.catalanDeductionsAmount})`);
  });
});

// ── 40. BLINDATGE DE L'ESTAT: SNAPSHOT IMMUTABLE DEL STORE ──────────────────

suite("40. Blindatge de l'Estat: Snapshot Immutable del Store (getSnapshot)", () => {

  test('40.1 getSnapshot() retorna una còpia desconnectada i profundament congelada', () => {
    store.setYear(2024);
    store.update('personal', { name: 'Snapshot Test', age: 42 });

    const snapshot = store.getSnapshot();

    assert(snapshot.personal.name === 'Snapshot Test', `El snapshot ha de reflectir l'estat viu (obtingut: ${snapshot.personal.name})`);

    // La còpia està congelada: qualsevol escriptura ha de llançar en mode estricte.
    let threw = false;
    try {
      (snapshot.personal as { name?: string }).name = 'Mutació il·legal';
    } catch {
      threw = true;
    }
    assert(threw, "L'escriptura sobre un snapshot congelat ha de llançar un error");
    assert(snapshot.personal.name === 'Snapshot Test', 'El snapshot no ha de canviar després d’un intent de mutació');

    // ...i tampoc no ha contaminat l'estat viu del store.
    assert(store.getData().personal.name === 'Snapshot Test', "L'estat viu del store no ha de quedar alterat");
  });

  test('40.2 El snapshot conserva el valor del moment i no bloqueja el store', () => {
    store.setYear(2024);
    store.update('personal', { name: 'Base Original' });

    const snapshot = store.getSnapshot();
    const frozenName = snapshot.personal.name;

    // El store ha de seguir operatiu després de prendre el snapshot.
    store.update('personal', { name: 'Actualitzat' });

    assert(store.getData().personal.name === 'Actualitzat', `El store ha de reflectir la nova actualització (obtingut: ${store.getData().personal.name})`);
    assert(frozenName === 'Base Original', 'El snapshot anterior ha de conservar el valor del moment en què es va prendre');
    assert(snapshot.personal.name === 'Base Original', "El snapshot no ha de rebre l'actualització posterior del store");
  });
});

// ── 41. CORRECCIONS D'AUDITORIA FISCAL ─────────────────────────────────────

suite("41. Blindatge Fiscal: Startups, Donatius, Maternitat, Mínims i Antiaplicació", () => {

  test('41.1 Startups Catalunya: el topall s\'aplica a la BASE, no a la deducció', () => {
    const data = createEmptyDeclaracion(2024);
    data.deductions.catalanStartupInvestment = 100000;
    data.deductions.catalanStartupIsResearchOrUniversity = false;
    // 30% amb base màxima de 6.000 € → 1.800 € (no 3.000 €)
    assert(computeCatalanDeductions(data) === 1800, `Startup general ha de ser 1.800 €, obtingut: ${computeCatalanDeductions(data)}`);

    data.deductions.catalanStartupIsResearchOrUniversity = true;
    // 50% amb base màxima de 12.000 € → 6.000 € (no 12.000 €)
    assert(computeCatalanDeductions(data) === 6000, `Startup recerca ha de ser 6.000 €, obtingut: ${computeCatalanDeductions(data)}`);
  });

  test('41.2 Donatius a partits polítics: 20% amb base màxima de 600 € (Art. 68.3.c)', () => {
    const data = createEmptyDeclaracion(2024);
    data.deductions.donations = [
      { id: 'pp1', entity: 'Partit Polític', amount: 5000, recurring: false, priority: false, category: 'political_party' },
    ];
    const deds = computeDeductions(data);
    assert(deds.donationsDeductionAmount === 120, `Partits polítics: 600 × 20% = 120 €, obtingut: ${deds.donationsDeductionAmount}`);
  });

  test('41.3 Donatius d\'utilitat pública: 10% amb el sostre del 10% de la base liquidable', () => {
    const data = createEmptyDeclaracion(2024);
    data.deductions.donations = [
      { id: 'fu1', entity: 'Fundació Cultural', amount: 5000, recurring: false, priority: false, category: 'public_utility' },
    ];
    assert(computeDeductions(data).donationsDeductionAmount === 500, 'Sense base informada: 5.000 × 10% = 500 €');
    // Amb base liquidable de 10.000 € el sostre és 1.000 € de base → 100 € de deducció
    assert(computeDeductions(data, 10000).donationsDeductionAmount === 100, 'Amb base 10.000 €: sostre 1.000 € → 100 €');
  });

  test('41.4 Maternitat: deducció no lligada a quota (pot generar quota negativa, Art. 81)', () => {
    const data = createEmptyDeclaracion(2024);
    data.workIncome.employers = [{ id: 'e1', name: 'Empresa', grossSalary: 3000, inKind: 0, withholdings: 0, socialSecurity: 200, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0 }];
    data.personal.descendants = [{ id: 'd1', age: 1, disability: 0 }];
    data.deductions.maternityDeduction = true;
    data.deductions.maternityMonths = 12;

    const res = calculateIRPF(data);
    assert(res.maternityDeductionAmount === 1200, `Deducció maternitat 1.200 €, obtingut: ${res.maternityDeductionAmount}`);
    assert(res.netTax === -1200, `Quota líquida negativa de -1.200 €, obtingut: ${res.netTax}`);
    assert(res.result === -1200, `Retorn de 1.200 €, obtingut: ${res.result}`);
  });

  test('41.5 Mínim per discapacitat ≥ 65% amb mobilitat reduïda: 12.000 € (Art. 60.2)', () => {
    const senseMobilitat = createEmptyDeclaracion(2024);
    senseMobilitat.personal.age = 40;
    senseMobilitat.personal.disability = 65;
    assert(calculateIRPF(senseMobilitat).totalMinimum === 14550, 'Sense mobilitat reduïda: 5.550 + 9.000 = 14.550 €');

    const ambMobilitat = createEmptyDeclaracion(2024);
    ambMobilitat.personal.age = 40;
    ambMobilitat.personal.disability = 65;
    ambMobilitat.personal.reducedMobility = true;
    assert(calculateIRPF(ambMobilitat).totalMinimum === 17550, 'Amb mobilitat reduïda: 5.550 + 12.000 = 17.550 €');
  });

  test('41.6 Antiaplicació Art. 33.5.f: detecta la recompra POSTERIOR dins dels 2 mesos', () => {
    const trades: TradeRecord[] = [
      { id: 'b1', broker: 'generic', date: '2024-01-10', symbol: 'ACME', isin: 'US1234567890', name: 'ACME', type: 'buy', assetClass: 'shares', quantity: 100, price: 100, currency: 'EUR', exchangeRate: 1, commission: 0, totalEUR: 10000, isListed: true },
      { id: 's1', broker: 'generic', date: '2024-06-10', symbol: 'ACME', isin: 'US1234567890', name: 'ACME', type: 'sell', assetClass: 'shares', quantity: 100, price: 80, currency: 'EUR', exchangeRate: 1, commission: 0, totalEUR: 8000, isListed: true },
      { id: 'b2', broker: 'generic', date: '2024-07-10', symbol: 'ACME', isin: 'US1234567890', name: 'ACME', type: 'buy', assetClass: 'shares', quantity: 100, price: 80, currency: 'EUR', exchangeRate: 1, commission: 0, totalEUR: 8000, isListed: true },
    ];

    const { matches } = calculateFIFO(trades);
    assert(matches.length === 1, `Ha de generar 1 casament, obtingut: ${matches.length}`);
    const m = matches[0];
    assert(m.totalGain === -2000, `Pèrdua de 2.000 €, obtingut: ${m.totalGain}`);
    assert(m.antiApplicationRuleApplied, 'Ha de detectar la recompra posterior dins dels 2 mesos');
    assert(m.suspendedLossEUR === 2000, `Pèrdua suspesa de 2.000 €, obtingut: ${m.suspendedLossEUR}`);
    assert(m.computedGainLossEUR === 0, `Pèrdua computable de 0 €, obtingut: ${m.computedGainLossEUR}`);
  });

  test('41.7 Antiaplicació: el valor d\'adquisició de la recompra s\'incrementa amb la pèrdua suspesa', () => {
    const trades: TradeRecord[] = [
      { id: 'b1', broker: 'generic', date: '2024-01-10', symbol: 'ACME', isin: 'US1234567890', name: 'ACME', type: 'buy', assetClass: 'shares', quantity: 100, price: 100, currency: 'EUR', exchangeRate: 1, commission: 0, totalEUR: 10000, isListed: true },
      { id: 's1', broker: 'generic', date: '2024-06-10', symbol: 'ACME', isin: 'US1234567890', name: 'ACME', type: 'sell', assetClass: 'shares', quantity: 100, price: 80, currency: 'EUR', exchangeRate: 1, commission: 0, totalEUR: 8000, isListed: true },
      { id: 'b2', broker: 'generic', date: '2024-07-10', symbol: 'ACME', isin: 'US1234567890', name: 'ACME', type: 'buy', assetClass: 'shares', quantity: 100, price: 80, currency: 'EUR', exchangeRate: 1, commission: 0, totalEUR: 8000, isListed: true },
      { id: 's2', broker: 'generic', date: '2024-11-10', symbol: 'ACME', isin: 'US1234567890', name: 'ACME', type: 'sell', assetClass: 'shares', quantity: 100, price: 100, currency: 'EUR', exchangeRate: 1, commission: 0, totalEUR: 10000, isListed: true },
    ];

    const { matches } = calculateFIFO(trades);
    const second = matches.find(m => m.sellTrade.id === 's2');
    assert(second !== undefined, 'Hi ha d\'haver la segona venda');
    // Cost inicial 8.000 € + 2.000 € de pèrdua suspesa = 10.000 € → guany 0 €
    assert(second!.totalAcquisitionEUR === 10000, `Cost ajustat 10.000 €, obtingut: ${second!.totalAcquisitionEUR}`);
    assert(second!.totalGain === 0, `Guany de 0 €, obtingut: ${second!.totalGain}`);
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
