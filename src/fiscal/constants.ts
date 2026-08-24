/**
 * @module fiscal/constants
 * Tax brackets, limits, and percentages for Spanish IRPF and Autonomous Community of Catalonia.
 * Based on current 2024/2025/2026 fiscal year regulations.
 */

/** A single tax bracket */
export interface TaxBracket {
  readonly upTo: number;
  readonly rate: number; // as decimal (0.19 = 19%)
}

/**
 * Escala estatal – base general (2024-2026).
 * State-only rates.
 */
export const STATE_GENERAL_TAX_BRACKETS: readonly TaxBracket[] = [
  { upTo: 12_450, rate: 0.095 },
  { upTo: 20_200, rate: 0.12 },
  { upTo: 35_200, rate: 0.15 },
  { upTo: 60_000, rate: 0.185 },
  { upTo: 300_000, rate: 0.225 },
  { upTo: Infinity, rate: 0.245 },
];

/**
 * Escala autonòmica – base general (Catalunya 2024-2026).
 * Catalan-specific rates.
 */
export const CATALAN_GENERAL_TAX_BRACKETS: readonly TaxBracket[] = [
  { upTo: 12_450, rate: 0.105 },
  { upTo: 17_707.20, rate: 0.12 },
  { upTo: 21_000, rate: 0.14 },
  { upTo: 33_007.20, rate: 0.15 },
  { upTo: 53_407.20, rate: 0.188 },
  { upTo: 90_000, rate: 0.215 },
  { upTo: 120_000, rate: 0.235 },
  { upTo: 175_000, rate: 0.245 },
  { upTo: Infinity, rate: 0.255 },
];

/**
 * Escala estatal de l'estalvi (2024-2026).
 */
export const STATE_SAVINGS_TAX_BRACKETS: readonly TaxBracket[] = [
  { upTo: 6_000, rate: 0.095 },
  { upTo: 50_000, rate: 0.105 },
  { upTo: 200_000, rate: 0.115 },
  { upTo: 300_000, rate: 0.135 },
  { upTo: Infinity, rate: 0.14 },
];

/**
 * Escala autonòmica de l'estalvi (2024-2026).
 */
export const AUTONOMIC_SAVINGS_TAX_BRACKETS: readonly TaxBracket[] = [
  { upTo: 6_000, rate: 0.095 },
  { upTo: 50_000, rate: 0.105 },
  { upTo: 200_000, rate: 0.115 },
  { upTo: 300_000, rate: 0.135 },
  { upTo: Infinity, rate: 0.14 },
];

/* ── Mínim personal i familiar ─────────────────────────────── */

/** Mínimo del contribuyente by age */
export const PERSONAL_MINIMUM = 5_550;
export const PERSONAL_MINIMUM_OVER_65 = 6_700; // +1,150
export const PERSONAL_MINIMUM_OVER_75 = 8_100; // +1,400 additional

/** Mínimos por descendientes */
export const DESCENDANT_MINIMUMS: readonly number[] = [
  2_400, // 1r fill
  2_700, // 2n fill
  4_000, // 3r fill
  4_500, // 4t i successius
];
export const DESCENDANT_UNDER_3_EXTRA = 2_800;

/** Mínimos por ascendientes */
export const ASCENDANT_MINIMUM_OVER_65 = 1_150;
export const ASCENDANT_MINIMUM_OVER_75_EXTRA = 1_400;

/** Mínim per discapacitat */
export const DISABILITY_MINIMUM_33 = 3_000;
export const DISABILITY_MINIMUM_65 = 9_000;
export const DISABILITY_MINIMUM_65_MOBILITY = 12_000;

/* ── Reducció per rendiments del treball ───────────────────── */

/** Fixed deductible expenses for work income */
export const WORK_OTHER_EXPENSES = 2_000;

/**
 * Reducció per rendiments del treball (2024-2026).
 */
export const WORK_REDUCTION_THRESHOLD_LOW = 14_852;
export const WORK_REDUCTION_THRESHOLD_HIGH = 19_747.50;
export const WORK_REDUCTION_MAX = 7_302;
export const WORK_REDUCTION_COEFFICIENT = 1.75;

/* ── Plans de pensions ─────────────────────────────────────── */

/** Límit d'aportació a plans de pensions individuals */
export const PENSION_PLAN_LIMIT = 1_500;
/** Límit incrementat per aportacions empresarials / ocupació */
export const PENSION_PLAN_COMPANY_LIMIT = 8_500;

/* ── Tributació Conjunta (Art. 84 LIRPF) ───────────────────── */

/** Reducció per tributació conjunta en matrimonis */
export const JOINT_TAXATION_REDUCTION_MATRIMONY = 3_400;
/** Reducció per tributació conjunta en famílies monoparentals */
export const JOINT_TAXATION_REDUCTION_SINGLE_PARENT = 2_150;

/* ── Deduccions Estatals ───────────────────────────────────── */

/** Deducció per inversió en habitatge habitual (règim transitori pre-2013) */
export const HOUSING_DEDUCTION_RATE = 0.15;
export const HOUSING_DEDUCTION_MAX_BASE = 9_040;

/** Deduccions per donatius (Llei 49/2002 actualitzada per RD-Llei 6/2023) */
export const DONATION_FIRST_TIER = 250;
export const DONATION_FIRST_TIER_RATE = 0.80;
export const DONATION_REST_RATE = 0.40;
export const DONATION_REST_RECURRING_RATE = 0.45;

/** Deducció per maternitat */
export const MATERNITY_DEDUCTION_PER_MONTH = 100;
export const MATERNITY_DEDUCTION_MAX = 1_200;
export const MATERNITY_NURSERY_MAX = 1_000; // Despeses de custòdia / guarderia

/* ── Deduccions Autonòmiques de Catalunya ──────────────────── */

/** Deducció per lloguer d'habitatge habitual a Catalunya */
export const CAT_RENTAL_RATE = 0.10;
export const CAT_RENTAL_LIMIT_GENERAL = 300;
export const CAT_RENTAL_LIMIT_SPECIAL = 600; // Família nombrosa, monoparental o conjunta
export const CAT_RENTAL_INCOME_LIMIT_INDIVIDUAL = 20_000;
export const CAT_RENTAL_INCOME_LIMIT_SPECIAL = 30_000; // Famílies nombroses o tributació conjunta

/** Naixement o adopció de fills a Catalunya */
export const CAT_BIRTH_INDIVIDUAL = 150;
export const CAT_BIRTH_SPECIAL = 300; // Monoparental o conjunta

/** Inversió en empreses de nova creació a Catalunya */
export const CAT_STARTUP_GENERAL_RATE = 0.30;
export const CAT_STARTUP_GENERAL_MAX = 6_000;
export const CAT_STARTUP_RESEARCH_RATE = 0.50; // Spin-off universitat o centre de recerca
export const CAT_STARTUP_RESEARCH_MAX = 12_000;

/** Viduïtat a Catalunya */
export const CAT_WIDOWHOOD_GENERAL = 150;
export const CAT_WIDOWHOOD_WITH_DEPENDENTS = 300;

/** Foment de la llengua catalana / aranesa */
export const CAT_LANGUAGE_DONATION_RATE = 0.15;

/** Donacions a recerca biomèdica i universitats a Catalunya */
export const CAT_BIOMEDICAL_DONATION_RATE = 0.30;

/** Rehabilitació habitatge habitual a Catalunya */
export const CAT_HOME_REHAB_RATE = 0.015;
export const CAT_HOME_REHAB_MAX_BASE = 9_040;

/* ── Imputació de rendes immobiliàries ─────────────────────── */

export const IMPUTED_INCOME_RATE_GENERAL = 0.02;
export const IMPUTED_INCOME_RATE_REVISED = 0.011; // Valor cadastral revisat

/* ── Activitats econòmiques ────────────────────────────────── */

/** Reducció per estimació directa simplificada */
export const SIMPLIFIED_EXPENSES_RATE = 0.05;
export const SIMPLIFIED_EXPENSES_MAX = 2_000;

/* ── Comunitats autònomes ──────────────────────────────────── */

export const AUTONOMOUS_COMMUNITIES: readonly { code: string; name: string }[] = Object.freeze([
  { code: 'CAT', name: 'Catalunya' },
  { code: 'AND', name: 'Andalucía' },
  { code: 'ARA', name: 'Aragón' },
  { code: 'AST', name: 'Asturias' },
  { code: 'BAL', name: 'Illes Balears' },
  { code: 'CAN', name: 'Canarias' },
  { code: 'CTB', name: 'Cantabria' },
  { code: 'CLM', name: 'Castilla-La Mancha' },
  { code: 'CYL', name: 'Castilla y León' },
  { code: 'EXT', name: 'Extremadura' },
  { code: 'GAL', name: 'Galicia' },
  { code: 'MAD', name: 'Madrid' },
  { code: 'MUR', name: 'Murcia' },
  { code: 'NAV', name: 'Navarra' },
  { code: 'PVA', name: 'País Vasco' },
  { code: 'RIO', name: 'La Rioja' },
  { code: 'VAL', name: 'Comunitat Valenciana' },
  { code: 'CEU', name: 'Ceuta' },
  { code: 'MEL', name: 'Melilla' },
]);

/** O(1) map for autonomous community name resolution */
export const COMMUNITY_NAME_MAP: ReadonlyMap<string, string> = new Map(
  AUTONOMOUS_COMMUNITIES.map(c => [c.code, c.name])
);

/** Available fiscal years */
export const FISCAL_YEARS = Object.freeze([2024, 2025, 2026] as const);
export type FiscalYear = (typeof FISCAL_YEARS)[number];
