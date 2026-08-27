/**
 * @module fiscal/autonomic-tax-scales
 * Escales de Gravamen Autonòmiques de l'IRPF per a les 17 Comunitats Autònomes.
 * 
 * Normativa: Art. 74 i Art. 77 de la Llei 35/2006 de l'IRPF.
 * Cada Comunitat Autònoma té competència normativa per aprovar la seva pròpia
 * escala de gravamen sobre la base liquidable general.
 */

import type { TaxBracket } from './constants.ts';

export type SpanishAutonomousCommunity =
  | 'andalucia'
  | 'aragon'
  | 'asturias'
  | 'baleares'
  | 'canarias'
  | 'cantabria'
  | 'castilla_la_mancha'
  | 'castilla_y_leon'
  | 'catalunya'
  | 'extremadura'
  | 'galicia'
  | 'madrid'
  | 'murcia'
  | 'rioja'
  | 'valencia'
  | 'navarra'
  | 'pais_vasco'
  | 'ceuta_melilla';

export interface AutonomicCommunityInfo {
  readonly code: SpanishAutonomousCommunity;
  readonly name: string;
  readonly isForal: boolean;
  readonly brackets: readonly TaxBracket[];
  readonly description: string;
}

/**
 * Escala Autonòmica de la Comunitat de Madrid (Trams deflactats).
 */
export const MADRID_GENERAL_TAX_BRACKETS: readonly TaxBracket[] = [
  { upTo: 13_351.20, rate: 0.085 },
  { upTo: 19_656.96, rate: 0.107 },
  { upTo: 36_531.00, rate: 0.128 },
  { upTo: 57_320.40, rate: 0.174 },
  { upTo: Infinity, rate: 0.205 },
];

/**
 * Escala Autonòmica d'Andalusia.
 */
export const ANDALUCIA_GENERAL_TAX_BRACKETS: readonly TaxBracket[] = [
  { upTo: 13_000, rate: 0.095 },
  { upTo: 21_100, rate: 0.12 },
  { upTo: 35_200, rate: 0.15 },
  { upTo: 60_000, rate: 0.185 },
  { upTo: Infinity, rate: 0.225 },
];

/**
 * Escala Autonòmica de la Comunitat Valenciana.
 */
export const VALENCIA_GENERAL_TAX_BRACKETS: readonly TaxBracket[] = [
  { upTo: 12_450, rate: 0.09 },
  { upTo: 17_000, rate: 0.11 },
  { upTo: 30_000, rate: 0.13 },
  { upTo: 50_000, rate: 0.175 },
  { upTo: 65_000, rate: 0.21 },
  { upTo: 80_000, rate: 0.235 },
  { upTo: 120_000, rate: 0.255 },
  { upTo: 175_000, rate: 0.275 },
  { upTo: Infinity, rate: 0.295 },
];

/**
 * Escala Autonòmica de Galícia.
 */
export const GALICIA_GENERAL_TAX_BRACKETS: readonly TaxBracket[] = [
  { upTo: 13_000, rate: 0.09 },
  { upTo: 20_800, rate: 0.115 },
  { upTo: 36_000, rate: 0.145 },
  { upTo: 62_000, rate: 0.185 },
  { upTo: Infinity, rate: 0.225 },
];

/**
 * Escala Autonòmica de Catalunya.
 */
export const CATALUNYA_GENERAL_TAX_BRACKETS: readonly TaxBracket[] = [
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
 * Escala per defecte (Igual a l'escala estatal complementària).
 */
export const DEFAULT_AUTONOMIC_BRACKETS: readonly TaxBracket[] = [
  { upTo: 12_450, rate: 0.095 },
  { upTo: 20_200, rate: 0.12 },
  { upTo: 35_200, rate: 0.15 },
  { upTo: 60_000, rate: 0.185 },
  { upTo: 300_000, rate: 0.225 },
  { upTo: Infinity, rate: 0.245 },
];

/**
 * Diccionari complet de Comunitats Autònomes.
 */
export const AUTONOMIC_COMMUNITIES_REGISTRY: Record<SpanishAutonomousCommunity, AutonomicCommunityInfo> = {
  catalunya: {
    code: 'catalunya',
    name: 'Catalunya',
    isForal: false,
    brackets: CATALUNYA_GENERAL_TAX_BRACKETS,
    description: 'Escala autonòmica catalana (9 trams, tipus marginal màxim del 25,5%).',
  },
  madrid: {
    code: 'madrid',
    name: 'Comunitat de Madrid',
    isForal: false,
    brackets: MADRID_GENERAL_TAX_BRACKETS,
    description: 'Escala autonòmica de Madrid (5 trams deflactats, marginal màxim del 20,5%).',
  },
  andalucia: {
    code: 'andalucia',
    name: 'Andalusia',
    isForal: false,
    brackets: ANDALUCIA_GENERAL_TAX_BRACKETS,
    description: 'Escala autonòmica andalusa (5 trams, marginal màxim del 22,5%).',
  },
  valencia: {
    code: 'valencia',
    name: 'Comunitat Valenciana',
    isForal: false,
    brackets: VALENCIA_GENERAL_TAX_BRACKETS,
    description: 'Escala autonòmica valenciana (9 trams progressius).',
  },
  galicia: {
    code: 'galicia',
    name: 'Galícia',
    isForal: false,
    brackets: GALICIA_GENERAL_TAX_BRACKETS,
    description: 'Escala autonòmica gallega (5 trams).',
  },
  aragon: {
    code: 'aragon',
    name: 'Aragó',
    isForal: false,
    brackets: DEFAULT_AUTONOMIC_BRACKETS,
    description: 'Escala autonòmica d’Aragó.',
  },
  asturias: {
    code: 'asturias',
    name: 'Principat d’Astúries',
    isForal: false,
    brackets: DEFAULT_AUTONOMIC_BRACKETS,
    description: 'Escala autonòmica asturiana.',
  },
  baleares: {
    code: 'baleares',
    name: 'Illes Balears',
    isForal: false,
    brackets: DEFAULT_AUTONOMIC_BRACKETS,
    description: 'Escala autonòmica de les Illes Balears.',
  },
  canarias: {
    code: 'canarias',
    name: 'Canàries',
    isForal: false,
    brackets: DEFAULT_AUTONOMIC_BRACKETS,
    description: 'Escala autonòmica de Canàries (amb aplicació de règim REF i IGIC en lloc d’IVA).',
  },
  cantabria: {
    code: 'cantabria',
    name: 'Cantàbria',
    isForal: false,
    brackets: DEFAULT_AUTONOMIC_BRACKETS,
    description: 'Escala autonòmica de Cantàbria.',
  },
  castilla_la_mancha: {
    code: 'castilla_la_mancha',
    name: 'Castella-la Manxa',
    isForal: false,
    brackets: DEFAULT_AUTONOMIC_BRACKETS,
    description: 'Escala autonòmica de Castella-la Manxa.',
  },
  castilla_y_leon: {
    code: 'castilla_y_leon',
    name: 'Castella i Lleó',
    isForal: false,
    brackets: DEFAULT_AUTONOMIC_BRACKETS,
    description: 'Escala autonòmica de Castella i Lleó.',
  },
  extremadura: {
    code: 'extremadura',
    name: 'Extremadura',
    isForal: false,
    brackets: DEFAULT_AUTONOMIC_BRACKETS,
    description: 'Escala autonòmica d’Extremadura.',
  },
  murcia: {
    code: 'murcia',
    name: 'Regió de Múrcia',
    isForal: false,
    brackets: DEFAULT_AUTONOMIC_BRACKETS,
    description: 'Escala autonòmica de Múrcia.',
  },
  rioja: {
    code: 'rioja',
    name: 'La Rioja',
    isForal: false,
    brackets: DEFAULT_AUTONOMIC_BRACKETS,
    description: 'Escala autonòmica de La Rioja.',
  },
  navarra: {
    code: 'navarra',
    name: 'Comunitat Foral de Navarra',
    isForal: true,
    brackets: DEFAULT_AUTONOMIC_BRACKETS,
    description: 'Règim Tributari Foral de Navarra (Hisenda Foral de Navarra).',
  },
  pais_vasco: {
    code: 'pais_vasco',
    name: 'País Basc',
    isForal: true,
    brackets: DEFAULT_AUTONOMIC_BRACKETS,
    description: 'Règim de Concert Econòmic del País Basc (Diputacions Forals d’Àlaba, Bizkaia i Guipúscoa).',
  },
  ceuta_melilla: {
    code: 'ceuta_melilla',
    name: 'Ceuta i Melilla',
    isForal: false,
    brackets: DEFAULT_AUTONOMIC_BRACKETS,
    description: 'Territoris amb deducció del 60% en quota segons Art. 68.4 LIRPF.',
  },
};

/**
 * Retorna l'escala autonòmica aplicable segons la Comunitat Autònoma.
 */
export function getAutonomicBrackets(ccaa: string = 'catalunya'): readonly TaxBracket[] {
  const normalized = ccaa.toLowerCase().trim() as SpanishAutonomousCommunity;
  const info = AUTONOMIC_COMMUNITIES_REGISTRY[normalized];
  if (info) {
    return info.brackets;
  }
  return CATALUNYA_GENERAL_TAX_BRACKETS;
}
