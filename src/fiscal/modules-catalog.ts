/**
 * @module fiscal/modules-catalog
 * Catàleg centralitzat de mòduls i eines de l'aplicació.
 * Permet a qualsevol declarant activar o desactivar eines a la carta segons les seves necessitats.
 */

import type { UserProfile } from '../types.ts';

export type ModuleCategory =
  | 'Ingressos & Rendiments'
  | 'Impostos & Models AEAT'
  | 'Inversió & Patrimoni'
  | 'Eines d\'Optimització'
  | 'Fiscal & Normativa';

export interface AppModuleItem {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  category: ModuleCategory;
  path: string;
  badge?: string;
  tags: string[];
  recommendedFor?: string;
  isCore?: boolean;
}

export const ALL_APP_MODULES: AppModuleItem[] = [
  // ── Ingressos & Rendiments ──
  {
    id: 'work_income',
    name: 'Rendiments del Treball & 7.p',
    shortName: 'Treball & Nòmines',
    description: 'Gestió de nòmines, múltiples pagadors, retencions IRPF, cotitzacions a la SS i exempció per feina a l\'estranger (Art. 7.p).',
    icon: '💼',
    category: 'Ingressos & Rendiments',
    path: '/treball',
    tags: ['Nòmines', 'Retencions', 'Art. 7.p', 'Dietes'],
  },
  {
    id: 'properties',
    name: 'Immobles en Lloguer & Amortitzacions',
    shortName: 'Immobles & Lloguers',
    description: 'Rendiments del capital immobiliari, càlcul oficial de l\'amortització AEAT (3% construcció), despeses deduïbles i zones tensionades.',
    icon: '🏠',
    category: 'Ingressos & Rendiments',
    path: '/immobles',
    badge: 'Amortització AEAT',
    tags: ['Lloguer', 'Amortització 3%', 'IBI', 'Comunitat'],
  },
  {
    id: 'capital',
    name: 'Rendiments del Capital Mobiliari',
    shortName: 'Capital Mobiliari',
    description: 'Interessos de comptes, dividends nacionals i internacionals amb doble imposició (W-8BEN / Casella 0588) i assegurances de vida.',
    icon: '🏦',
    category: 'Ingressos & Rendiments',
    path: '/capital',
    tags: ['Dividends', 'Interessos', 'W-8BEN', 'Retencions'],
  },
  {
    id: 'activities',
    name: 'Activitats Econòmiques (Autònoms)',
    shortName: 'Autònoms & Activitats',
    description: 'Rendiments d\'activitats en estimació directa (simplificada i normal), despeses de subministraments i quota d\'autònoms (RETA).',
    icon: '🏢',
    category: 'Ingressos & Rendiments',
    path: '/activitats',
    tags: ['RETA', 'Estimació Directa', 'Subministraments'],
  },
  {
    id: 'gains',
    name: 'Guanys i Pèrdues Patrimonials (FIFO)',
    shortName: 'Guanys & Vendes',
    description: 'Vendes d\'accions, immobles, fons d\'inversió i criptomonedes amb mètode FIFO, regla antiaplicació de 2 mesos i exempcions >65 anys.',
    icon: '📊',
    category: 'Ingressos & Rendiments',
    path: '/guanys',
    tags: ['FIFO', 'Accions', 'Fons', 'Plusvàlues'],
  },

  // ── Impostos & Models AEAT ──
  {
    id: 'iva',
    name: 'Gestió Integral d\'IVA (Models 303/390/349)',
    shortName: 'Gestió d\'IVA',
    description: 'Liquidació trimestral del Model 303, resum anual Model 390, llibres registre de factures emeses i rebudes i sincronització amb IRPF.',
    icon: '🧾',
    category: 'Impostos & Models AEAT',
    path: '/iva',
    badge: 'Model 303',
    tags: ['IVA', 'Facturació', 'Model 303', 'Model 390'],
  },
  {
    id: 'quarterly_taxes',
    name: 'Obligacions Trimestrals (Models 130, 111, 115, 347)',
    shortName: 'Trimestrals (130, 111)',
    description: 'Pagaments fraccionats de l\'IRPF, retencions de treballadors i professionals, retencions de lloguers i operacions amb tercers (>3005€).',
    icon: '🗓️',
    category: 'Impostos & Models AEAT',
    path: '/trimestrals',
    badge: '130 / 111 / 347',
    tags: ['130', '111', '115', '347', 'Retencions', 'Trimestrals'],
  },
  {
    id: 'wealth_tax',
    name: 'Impost sobre el Patrimoni (Model 714)',
    shortName: 'Patrimoni (714)',
    description: 'Càlcul i liquidació de l\'Impost sobre el Patrimoni per comunitats autònomes amb exempcions d\'habitatge habitual i empresa familiar.',
    icon: '🏰',
    category: 'Impostos & Models AEAT',
    path: '/patrimoni',
    tags: ['Patrimoni', 'Model 714', 'Riquesa'],
  },
  {
    id: 'foreign_assets',
    name: 'Béns i Drets a l\'Estranger (Models 720/721)',
    shortName: 'Béns Estranger (720)',
    description: 'Control i declaració informativa de comptes bancaris, valors, immobles i criptomonedes custodiades fora d\'Espanya.',
    icon: '🌍',
    category: 'Impostos & Models AEAT',
    path: '/model720',
    tags: ['Model 720', 'Model 721', 'Cripto', 'Brokers'],
  },
  {
    id: 'caselles',
    name: 'Mapa Interactiu de Caselles AEAT',
    shortName: 'Caselles AEAT',
    description: 'Cercador i visualitzador visual de totes les caselles oficials del Model 100 de la Renda amb equivalències directes.',
    icon: '🗺️',
    category: 'Impostos & Models AEAT',
    path: '/caselles',
    tags: ['Caselles', 'Model 100', 'AEAT', 'Renta Web'],
  },
  {
    id: 'calendari',
    name: 'Calendari Fiscal & Venciments AEAT',
    shortName: 'Calendari Fiscal',
    description: 'Cronograma oficial de terminis de presentació dels models fiscals de l\'exercici en curs amb alertes i exportació a iCal.',
    icon: '📅',
    category: 'Impostos & Models AEAT',
    path: '/calendari',
    tags: ['Terminis', 'Venciments', 'AEAT', 'Calendari'],
  },

  // ── Inversió & Patrimoni ──
  {
    id: 'trading',
    name: 'Trading Analytics & Backtesting Fiscal',
    shortName: 'Trading & FIFO',
    description: 'Anàlisi de rendiment de carteres financeres, càlcul avançat de pèrdues i guanys patrimonials i optimització de Tax-Loss Harvesting.',
    icon: '📈',
    category: 'Inversió & Patrimoni',
    path: '/trading',
    tags: ['Trading', 'Tax Loss Harvesting', 'Backtesting'],
  },
  {
    id: 'projeccio',
    name: 'Projecció Multianual & Simulació Monte Carlo',
    shortName: 'Projecció Multianual',
    description: 'Previsió fiscal a 5 anys vista, anàlisi de variació d\'ingressos i modelització probabilística de la càrrega tributària futura.',
    icon: '🔮',
    category: 'Inversió & Patrimoni',
    path: '/projeccio',
    tags: ['Monte Carlo', 'Previsió', '5 Anys', 'Escenaris'],
  },
  {
    id: 'inheritance',
    name: 'Successions i Donacions (Models 650/651)',
    shortName: 'Successions',
    description: 'Calculadora de l\'impost sobre successions i donacions amb bonificacions autonòmiques per parentiu i patrimoni preexistent.',
    icon: '⚰️',
    category: 'Inversió & Patrimoni',
    path: '/sucesiones',
    badge: 'Multi-CCAA',
    tags: ['Herències', 'Donacions', '650', '651'],
  },
  {
    id: 'itp_plusvalia',
    name: 'ITP, AJD i Plusvàlua Municipal',
    shortName: 'ITP i Plusvàlua',
    description: 'Impost sobre Transmissions Patrimoniales (Mod 600) i Impost sobre l\'Increment de Valor dels Terrenys de Naturalesa Urbana (IIVTNU).',
    icon: '🏢',
    category: 'Inversió & Patrimoni',
    path: '/itp-plusvalia',
    tags: ['ITP', 'AJD', 'Plusvàlua', 'IIVTNU', '600'],
  },
  {
    id: 'crypto',
    name: 'Criptomonedes, DeFi i Model 721',
    shortName: 'Cripto & DeFi',
    description: 'Càlcul automàtic de FIFO per a vendes i permutes cripto. Tractament de Staking, Airdrops i avaluació automàtica d\'obligació del model 721.',
    icon: '₿',
    category: 'Inversió & Patrimoni',
    path: '/cripto',
    tags: ['Crypto', 'DeFi', 'FIFO', 'Model 721', 'Staking'],
  },

  // ── Eines d'Optimització ──
  {
    id: 'deductions',
    name: 'Deduccions Fiscals (Catalunya & Estatals)',
    shortName: 'Deduccions & Beneficis',
    description: 'Deduccions per lloguer d\'habitatge habitual, maternitat, donatius a entitats beneficiàries, aportacions a plans de pensions i rehabilitació.',
    icon: '🎯',
    category: 'Eines d\'Optimització',
    path: '/deduccions',
    tags: ['Deduccions', 'Catalunya', 'Plans Pensions', 'Donatius'],
  },
  {
    id: 'strategic',
    name: 'Assessorament Estratègic',
    shortName: 'Estratega',
    description: 'Simulador financer avançat: Comparativa Autònom vs Societat Limitada, i optimització matemàtica del rescat de plans de pensions.',
    icon: '🧠',
    category: 'Eines d\'Optimització',
    path: '/estratega',
    tags: ['Estratègia', 'S.L.', 'Autònoms', 'Pensions'],
  },
  {
    id: 'advisor',
    name: 'Fiscal Advisor (Motor d\'Estalvi)',
    shortName: 'Assessor d\'Estalvi',
    description: 'Auditoria fiscal intel·ligent que analitza la declaració i detecta automàticament oportunitats d\'estalvi i beneficis fiscals no aprofitats.',
    icon: '💡',
    category: 'Eines d\'Optimització',
    path: '/assessor',
    badge: 'Intel·ligent',
    tags: ['Auditoria', 'Estalvi', 'Recomanacions'],
  },
  {
    id: 'comparator',
    name: 'Comparador Tributació Individual vs Conjunta',
    shortName: 'Individual vs Conjunta',
    description: 'Càlcul comparatiu automàtic en temps real de la tributació separada davant la conjunta (Art. 84 LIRPF) per a parelles casades.',
    icon: '⚖️',
    category: 'Eines d\'Optimització',
    path: '/comparador',
    tags: ['Conjunta', 'Individual', 'Parella', 'Reducció 3400'],
  },
  {
    id: 'simulator',
    name: 'Simulador Règim Impatriats (Llei Beckham)',
    shortName: 'Simulador Beckham',
    description: 'Simulació i comparativa tributària entre el règim general de l\'IRPF i el règim especial d\'impatriats a tipus fix del 24% (Art. 93).',
    icon: '⚖️',
    category: 'Eines d\'Optimització',
    path: '/simulador',
    tags: ['Beckham', 'Expat', 'Tipus Fix 24%'],
  },
  {
    id: 'wizard',
    name: 'Assistent Guiat Pas a Pas (Wizard)',
    shortName: 'Assistent Guiat',
    description: 'Formulari assistit pas a pas dissenyat per emplenar la declaració des de zero sense necessitat de coneixements tributaris previs.',
    icon: '🧙',
    category: 'Eines d\'Optimització',
    path: '/wizard',
    tags: ['Wizard', 'Assistent', 'Pas a pas'],
  },

  // ── Fiscal & Normativa ──
  {
    id: 'personal',
    name: 'Situació Personal, Familiar & Mínims',
    shortName: 'Situació Personal',
    description: 'Edat, discapacitat, mínim del contribuent, descendents, ascendents a càrrec i comunitat autònoma de residència habitual.',
    icon: '👤',
    category: 'Fiscal & Normativa',
    path: '/personal',
    tags: ['Mínims', 'Fills', 'Pares', 'Discapacitat'],
  },
  {
    id: 'result',
    name: 'Liquidació Oficial & Radar de Risc AEAT',
    shortName: 'Resultat & Risc AEAT',
    description: 'Càlcul detallat de bases imposables, quota íntegra, crèdits fiscals, quota líquida i radar de probabilitat de requeriment de l\'Agència Tributària.',
    icon: '🧮',
    category: 'Fiscal & Normativa',
    path: '/resultat',
    tags: ['Liquidació', 'Radar Risc', 'Casella 0610'],
  },
  {
    id: 'import',
    name: 'Importar Operacions (CSV / Brokers / Borsa)',
    shortName: 'Importar Dades',
    description: 'Carrega massiva d\'operacions d\'accions, criptomonedes i dividends des de fitxers CSV o extractes de brokers financers.',
    icon: '📥',
    category: 'Fiscal & Normativa',
    path: '/importar',
    tags: ['CSV', 'Importar', 'Brokers', 'Degiro', 'IBKR'],
  },
  {
    id: 'export',
    name: 'Exportar Informes, Còpies & Dossier AEAT',
    shortName: 'Exportar & Còpies',
    description: 'Descàrrega del Model 100 oficial en PDF, generació de fitxers de seguretat JSON, còpies de seguretat i dossier complet d\'inspecció en ZIP.',
    icon: '💾',
    category: 'Fiscal & Normativa',
    path: '/exportar',
    tags: ['PDF', 'Excel', 'Certificats'],
  },
  {
    id: 'compliance_verifactu',
    name: 'Compliance & Veri*Factu (AEAT)',
    shortName: 'Compliance',
    description: 'Certificació de llibres oficials i enviament blockchain-like (Veri*Factu) a l\'AEAT per garantir inalterabilitat i complir amb la nova normativa de facturació.',
    icon: '🏛️',
    category: 'Fiscal & Normativa',
    path: '/compliance',
    tags: ['VeriFactu', 'Compliance', 'AEAT', 'Llibres'],
  },
  {
    id: 'ocr_ingestion',
    name: 'Bústia d\'Ingesta Intel·ligent',
    shortName: 'Ingesta OCR',
    description: 'Pujada de documents PDFs i fotos de tiquets. El sistema AI extreu automàticament imports, NIF i IVA detectant duplicats.',
    icon: '🤖',
    category: 'Fiscal & Normativa',
    path: '/ingesta',
    badge: 'Beta',
    tags: ['OCR', 'IA', 'Automatització', 'Tickets'],
  },
  {
    id: 'tax_reconciliation',
    name: 'Conciliació & Cuadre Inter-Model (AEAT)',
    shortName: 'Cuadre Tributari',
    description: 'Audita el creuament automàtic entre Models 100, 303, 390, 130, 111, 115, 347 i 721. Detecta discrepàncies i executa el cuadre integral per blindar la declaració davant inspeccions.',
    icon: '⚖️',
    category: 'Fiscal & Normativa',
    path: '/conciliacio',
    tags: ['Conciliació', 'AEAT', 'Inspecció', 'Cuadre', '303', '390', '130', '347'],
  },
];

export interface ModulePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  moduleIds: string[];
}

export const MODULE_PRESETS: ModulePreset[] = [
  {
    id: 'all_active',
    name: '🌟 Totes les Eines (Suite Completa)',
    description: 'Activa el 100% de les funcionalitats fiscals, eines d\'inversió i models AEAT.',
    icon: '🚀',
    moduleIds: ALL_APP_MODULES.map(m => m.id),
  },
  {
    id: 'basic_income',
    name: '💼 Renda Bàsica & Treball',
    description: 'Centrat en assalariats amb nòmines, pensions, deduccions bàsiques i comprovacions AEAT.',
    icon: '💼',
    moduleIds: ['work_income', 'personal', 'deductions', 'result', 'advisor', 'comparator', 'caselles', 'calendari', 'export'],
  },
  {
    id: 'investor_suite',
    name: '📈 Inversor Financer, Cripto & Borsa',
    description: 'Optimitzat per a gestió de carteres, FIFO, dividends internacionals, models 720/721 i Trading.',
    icon: '📈',
    moduleIds: ['gains', 'capital', 'trading', 'foreign_assets', 'wealth_tax', 'crypto', 'strategic', 'work_income', 'personal', 'deductions', 'result', 'advisor', 'import', 'export'],
  },
  {
    id: 'real_estate_suite',
    name: '🏠 Propietari Immobiliari & Lloguers',
    description: 'Amortitzacions d\'immobles del 3%, despeses deduïbles, ingressos de lloguer i Impost de Patrimoni.',
    icon: '🏠',
    moduleIds: ['properties', 'capital', 'wealth_tax', 'itp_plusvalia', 'inheritance_tax', 'personal', 'deductions', 'result', 'advisor', 'caselles', 'export'],
  },
  {
    id: 'freelance_suite',
    name: '🏢 Autònom, Activitats & IVA 303',
    description: 'Gestió de facturació, liquidació trimestral d\'IVA 303, RETA i estimació directa.',
    icon: '🏢',
    moduleIds: ['activities', 'iva', 'quarterly_taxes', 'strategic', 'compliance_verifactu', 'ocr_ingestion', 'work_income', 'personal', 'deductions', 'result', 'advisor', 'calendari', 'caselles', 'export'],
  },
];

/**
 * Obté la llista de mòduls activats per a un perfil donat.
 * Si el perfil no té configuració expressa, retorna tots els mòduls.
 */
export function getActiveModuleIdsForProfile(profile?: UserProfile | null): string[] {
  if (!profile) return ALL_APP_MODULES.map(m => m.id);
  if (Array.isArray(profile.enabledModules) && profile.enabledModules.length > 0) {
    return profile.enabledModules;
  }
  return ALL_APP_MODULES.map(m => m.id);
}

/**
 * Comprova si un mòdul específic està activat per a un perfil.
 */
export function isModuleActive(moduleId: string, profile?: UserProfile | null): boolean {
  const activeIds = getActiveModuleIdsForProfile(profile);
  return activeIds.includes(moduleId);
}

/**
 * Obté la ruta associada a un mòdul.
 */
export function getModuleByPath(path: string): AppModuleItem | undefined {
  return ALL_APP_MODULES.find(m => m.path === path);
}

/**
 * Obté la definició d'un mòdul pel seu ID.
 */
export function getModuleById(id: string): AppModuleItem | undefined {
  return ALL_APP_MODULES.find(m => m.id === id);
}
