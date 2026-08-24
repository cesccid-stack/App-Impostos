/**
 * @module fiscal/user-presets
 * Metadata, preset definitions, visual styles, and demo data generator for all taxpayer user types.
 */

import type { UserProfile, UserType, ProfileStatus, DeclaracionData } from '../types.ts';
import { createEmptyDeclaracion } from './declaration-factory.ts';

export interface UserTypeMeta {
  type: UserType;
  label: string;
  shortLabel: string;
  icon: string;
  badgeBg: string;
  badgeColor: string;
  gradient: string;
  description: string;
  keyHighlights: string[];
  recommendedModules: { label: string; path: string; icon: string }[];
  defaultTags: string[];
  fiscalTips: string[];
}

export const USER_TYPE_CONFIGS: Record<UserType, UserTypeMeta> = {
  employee: {
    type: 'employee',
    label: "Assalariat / Compte d'altri",
    shortLabel: 'Assalariat',
    icon: '💼',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    badgeColor: '#60a5fa',
    gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    description: 'Treballadors amb contracte laboral, nòmines, retencions IRPF i possibles plans de pensions.',
    keyHighlights: ['Rendiments del treball', 'Exempció 7.p per feines a l\'estranger', 'Reducció per despeses de mobilitat i dietes'],
    recommendedModules: [
      { label: 'Rendiments Treball', path: '/treball', icon: '💼' },
      { label: 'Deduccions & Plans', path: '/deduccions', icon: '🎯' },
      { label: 'Fiscal Advisor', path: '/assessor', icon: '💡' },
    ],
    defaultTags: ['Nòmines', 'Plans Pensions'],
    fiscalTips: [
      'Si has treballat a l\'estranger per a una empresa no resident, pots aplicar l\'exempció de l\'Art. 7.p fins a 60.100 €.',
      'Revisa si l\'empresa t\'ha aplicat retencions suficients en cas de tenir dos o més pagadors per evitar sorpreses.',
    ],
  },
  freelance: {
    type: 'freelance',
    label: 'Autònom / Professional Independent',
    shortLabel: 'Autònom',
    icon: '🏢',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeColor: '#34d399',
    gradient: 'linear-gradient(135deg, #10b981, #047857)',
    description: 'Professionals i autònoms en estimació directa amb gestió de factures, IVA trimestral i quota RETA.',
    keyHighlights: ['Model 303 / 390 d\'IVA', 'Despeses deduïbles i quota d\'autònoms', 'Retencions en factures emeses'],
    recommendedModules: [
      { label: 'Gestió d\'IVA', path: '/iva', icon: '🧾' },
      { label: 'Activitats Econòmiques', path: '/activitats', icon: '🏢' },
      { label: 'Radar de Risc AEAT', path: '/resultat', icon: '🧮' },
    ],
    defaultTags: ['IVA 303', 'RETA', 'Estimació Directa'],
    fiscalTips: [
      'Recorda que la quota d\'autònoms RETA és 100% deduïble dels teus rendiments nets d\'activitats econòmiques.',
      'Aprofita la deducció del 30% en despeses de subministraments si treballes habitualment des de casa.',
    ],
  },
  investor: {
    type: 'investor',
    label: 'Inversor Financer / Trader / Cripto',
    shortLabel: 'Inversor / Trader',
    icon: '📈',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    badgeColor: '#c084fc',
    gradient: 'linear-gradient(135deg, #a855f7, #6d28d9)',
    description: 'Gestió de carteres d\'accions, ETFs, dividends internacionals, criptomonedes i models 720/721.',
    keyHighlights: ['Càlcul FIFO automàtic', 'Doble Imposició Internacional', 'Bossa de pèrdues de 4 anys i compensació'],
    recommendedModules: [
      { label: 'Trading & FIFO', path: '/trading', icon: '📈' },
      { label: 'Guanys Patrimonials', path: '/guanys', icon: '📊' },
      { label: 'Béns a l\'Estranger (720)', path: '/model720', icon: '🌍' },
    ],
    defaultTags: ['FIFO', 'Cripto', 'Model 720', 'Dividends'],
    fiscalTips: [
      'Compensa les pèrdues patrimonials pendents dels 4 exercicis anteriors per reduir la base imposable de l\'estalvi a 0.',
      'Recorda declarar la retenció en origen dels dividends estrangers (Casella 0588) per evitar doble tributació.',
    ],
  },
  landlord: {
    type: 'landlord',
    label: 'Propietari / Arrendador Immobiliari',
    shortLabel: 'Arrendador',
    icon: '🏠',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeColor: '#fbbf24',
    gradient: 'linear-gradient(135deg, #f59e0b, #b45309)',
    description: 'Propietaris amb immobles en lloguer d\'habitatge habitual, turístic o comercial.',
    keyHighlights: ['Amortització del 3% sobre construcció', 'Reduccions del 50/60/70/90%', 'Despeses de reparació i comunitat'],
    recommendedModules: [
      { label: 'Immobles en Lloguer', path: '/immobles', icon: '🏠' },
      { label: 'Patrimoni (714)', path: '/patrimoni', icon: '🏰' },
      { label: 'Annex A AEAT', path: '/exportar', icon: '💾' },
    ],
    defaultTags: ['Lloguer Habitual', 'Amortització 3%'],
    fiscalTips: [
      'L\'amortització del 3% de la construcció és deduïble fins i tot si no has tingut despeses d\'obres aquest any.',
      'Els contractes d\'habitatge habitual gaudeixen de reducció del rendiment net de fins al 90% en zones tensionades.',
    ],
  },
  retiree: {
    type: 'retiree',
    label: 'Jubilat / Pensionista',
    shortLabel: 'Pensionista',
    icon: '🏖️',
    badgeBg: 'rgba(236, 72, 153, 0.15)',
    badgeColor: '#f472b6',
    gradient: 'linear-gradient(135deg, #ec4899, #be185d)',
    description: 'Persones perceptores de pensió pública o privada, amb exempcions especials per a majors de 65 anys.',
    keyHighlights: ['Exempció plusvàlua habitatge habitual (>65 anys)', 'Rendes vitalícies fins a 240.000 €', 'Mínim personal augmentat'],
    recommendedModules: [
      { label: 'Situació Personal', path: '/personal', icon: '👤' },
      { label: 'Rendiments del Treball', path: '/treball', icon: '💼' },
      { label: 'Fiscal Advisor', path: '/assessor', icon: '💡' },
    ],
    defaultTags: ['Pensió Pública', 'Majors 65'],
    fiscalTips: [
      'Si tens més de 65 anys i vens el teu habitatge habitual, el guany patrimonial està 100% exempt d\'IRPF.',
      'El mínim del contribuent s\'incrementa automàticament a partir dels 65 anys (+1.150 €) i dels 75 (+1.400 € addicionals).',
    ],
  },
  corporate_partner: {
    type: 'corporate_partner',
    label: 'Soci / Administrador de Societats',
    shortLabel: 'Soci / Administrador',
    icon: '🏢💼',
    badgeBg: 'rgba(14, 165, 233, 0.15)',
    badgeColor: '#38bdf8',
    gradient: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
    description: 'Socis i administradors d\'SL/SA amb retribucions mercantils, dividends i operacions vinculades.',
    keyHighlights: ['Dividends i retencions de capital', 'Retencions d\'administrador (19% / 35%)', 'Patrimoni i exempció empresa familiar'],
    recommendedModules: [
      { label: 'Rendiments Capital', path: '/capital', icon: '🏦' },
      { label: 'Impost Patrimoni (714)', path: '/patrimoni', icon: '🏰' },
      { label: 'Fiscal Advisor', path: '/assessor', icon: '💡' },
    ],
    defaultTags: ['Societat', 'Dividends', 'Administrador'],
    fiscalTips: [
      'Verifica si les teves participacions compleixen els requisits d\'exempció d\'empresa familiar a l\'Impost sobre el Patrimoni.',
      'Les retribucions per càrrec d\'administrador tributen al 35% de retenció (o 19% si la xifra de negocis és < 100.000 €).',
    ],
  },
  beckham: {
    type: 'beckham',
    label: 'Impatriat / Llei Beckham (Règim Especial)',
    shortLabel: 'Llei Beckham',
    icon: '🌍',
    badgeBg: 'rgba(234, 179, 8, 0.15)',
    badgeColor: '#facc15',
    gradient: 'linear-gradient(135deg, #eab308, #a16207)',
    description: 'Treballadors i nòmades digitals desplaçats a Espanya acollits a l\'Art. 93 LIRPF (tipus fix 24%).',
    keyHighlights: ['Tipus impositiu pla del 24% fins a 600.000 €', 'Només tributen rendes generades a Espanya', 'Sense obligació de Model 720'],
    recommendedModules: [
      { label: 'Simulador Beckham', path: '/simulador', icon: '⚖️' },
      { label: 'Rendiments Treball', path: '/treball', icon: '💼' },
      { label: 'Exportar Dossier', path: '/exportar', icon: '💾' },
    ],
    defaultTags: ['Beckham 24%', 'Expat / Nòmada'],
    fiscalTips: [
      'Amb el règim Beckham només tributen les teves rendes de la feina a Espanya; els teus dividends i guanys a l\'estranger estan exempts.',
      'Utilitza el simulador per comprovar si et surt més a compte el règim general o el règim especial d\'impatriats.',
    ],
  },
  family_member: {
    type: 'family_member',
    label: 'Unitat Familiar / Cònjuge o Dependent',
    shortLabel: 'Familiar',
    icon: '👨‍👩‍👧‍👦',
    badgeBg: 'rgba(244, 63, 94, 0.15)',
    badgeColor: '#fb7185',
    gradient: 'linear-gradient(135deg, #f43f5e, #be123c)',
    description: 'Membres de la unitat familiar per optimitzar la declaració conjunta i deduccions familiars.',
    keyHighlights: ['Comparació Individual vs Conjunta (estalvi 3.400 €)', 'Mínims familiars per fills i ascendents', 'Deduccions autonòmiques'],
    recommendedModules: [
      { label: 'Comparador Conjunta', path: '/comparador', icon: '⚖️' },
      { label: 'Situació Personal', path: '/personal', icon: '👤' },
      { label: 'Deduccions Familiars', path: '/deduccions', icon: '🎯' },
    ],
    defaultTags: ['Unitat Familiar', 'Cònjuge'],
    fiscalTips: [
      'Si un dels membres de la parella no té ingressos o són inferiors a 3.400 €, la tributació conjunta sol ser la més avantatjosa.',
      'El comparador automàtic calcula la diferència neta d\'estalvi entre fer-la per separat o junts.',
    ],
  },
  advisor_client: {
    type: 'advisor_client',
    label: 'Client d\'Assessoria / Gestoria',
    shortLabel: 'Client Gestoria',
    icon: '📁',
    badgeBg: 'rgba(99, 102, 241, 0.15)',
    badgeColor: '#818cf8',
    gradient: 'linear-gradient(135deg, #6366f1, #4338ca)',
    description: 'Expedient gestionat per un assessor fiscal o gestor col·legiat amb traçabilitat de documents.',
    keyHighlights: ['Seguiment d\'estat de declaració', 'Notes i requeriments interns', 'Exportació oficial per a la Renta Web'],
    recommendedModules: [
      { label: 'Panell de Control', path: '/', icon: '📊' },
      { label: 'Radar de Risc AEAT', path: '/resultat', icon: '🧮' },
      { label: 'Guia Renta Web', path: '/exportar', icon: '💾' },
    ],
    defaultTags: ['Expedient Client', 'Pendent Revisió'],
    fiscalTips: [
      'Mantén actualitzades les notes internes del client per recordar casuístiques especials o requeriments de l\'AEAT.',
      'Pots generar el Dossier d\'Inspecció comprimit (ZIP) amb tota la documentació llesta per presentar.',
    ],
  },
};

export const STATUS_CONFIGS: Record<ProfileStatus, { label: string; icon: string; badgeClass: string; color: string }> = {
  draft: {
    label: 'Esborrany',
    icon: '📝',
    badgeClass: 'badge--info',
    color: '#38bdf8',
  },
  in_review: {
    label: 'En Revisió',
    icon: '🔍',
    badgeClass: 'badge--warning',
    color: '#fbbf24',
  },
  ready: {
    label: 'Validat / Llest',
    icon: '✅',
    badgeClass: 'badge--success',
    color: '#34d399',
  },
  filed: {
    label: 'Presentat AEAT',
    icon: '🏛️',
    badgeClass: 'badge--primary',
    color: '#818cf8',
  },
};

export function getUserTypeConfig(type: UserType = 'employee'): UserTypeMeta {
  return USER_TYPE_CONFIGS[type] || USER_TYPE_CONFIGS.employee;
}

export function getStatusMeta(status: ProfileStatus = 'draft') {
  return STATUS_CONFIGS[status] || STATUS_CONFIGS.draft;
}

/** Retorna un conjunt de perfils demo realistes per mostrar tot el potencial de l'app */
export function getDemoProfilesData(): { profiles: UserProfile[]; declarations: Record<string, DeclaracionData> } {
  const p1: UserProfile = {
    id: 'profile_maria_freelance',
    name: 'Maria Soler (Desenvolupadora)',
    type: 'freelance',
    relation: 'main',
    nif: '47823411J',
    email: 'maria.soler@techlab.cat',
    phone: '+34 654 321 987',
    birthDate: '1989-05-14',
    community: 'CAT',
    status: 'ready',
    notes: 'Activitat com a desenvolupadora full-stack autònoma. IVA trimestral Model 303 al dia.',
    avatarColor: '#10b981',
    avatarIcon: '🏢',
    tags: ['Desenvolupament', 'IVA 303', 'Remot'],
    iban: 'ES66 2100 0418 4012 3456 7890',
    activityIAE: '763 - Programadors i analistes',
    enabledModules: ['work_income', 'activities', 'iva', 'deductions', 'caselles', 'calendari', 'advisor', 'simulator', 'export'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const p2: UserProfile = {
    id: 'profile_joan_investor',
    name: 'Joan Puig (Enginyer & Inversor)',
    type: 'investor',
    relation: 'spouse',
    nif: '38192044K',
    email: 'joan.puig@capitalinvest.io',
    phone: '+34 678 123 456',
    birthDate: '1987-11-20',
    community: 'CAT',
    status: 'in_review',
    notes: 'Assalariat a empresa tecnològica + cartera d\'accions a Degiro / IBKR i fons indexats.',
    avatarColor: '#a855f7',
    avatarIcon: '📈',
    tags: ['Tech Lead', 'Trading FIFO', 'Model 720'],
    iban: 'ES91 0182 2345 6701 2345 6789',
    enabledModules: ['work_income', 'capital', 'gains', 'trading', 'wealth_tax', 'foreign_assets', 'caselles', 'advisor', 'simulator', 'import', 'export'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const p3: UserProfile = {
    id: 'profile_laura_landlord',
    name: 'Laura Bassets (Propietària Immobiliària)',
    type: 'landlord',
    relation: 'other',
    nif: '41238901L',
    email: 'laura.bassets@habitat.barcelona',
    phone: '+34 612 987 654',
    birthDate: '1975-03-08',
    community: 'CAT',
    status: 'draft',
    notes: '2 pisos en lloguer a Barcelona (un d\'habitatge habitual i un de temporada).',
    avatarColor: '#f59e0b',
    avatarIcon: '🏠',
    tags: ['Lloguer BCN', 'Amortitzacions', 'Zona Tensionada'],
    iban: 'ES12 0049 1500 0512 3456 7890',
    enabledModules: ['work_income', 'properties', 'deductions', 'wealth_tax', 'caselles', 'advisor', 'simulator', 'export'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const p4: UserProfile = {
    id: 'profile_carles_retiree',
    name: 'Carles Font (Jubilat)',
    type: 'retiree',
    relation: 'parent',
    nif: '35091244R',
    email: 'carles.font@gencat.cat',
    phone: '+34 600 112 233',
    birthDate: '1956-07-22',
    community: 'CAT',
    status: 'ready',
    notes: 'Pensió pública de jubilació. Exempció per venda d\'habitatge habitual als 67 anys.',
    avatarColor: '#ec4899',
    avatarIcon: '🏖️',
    tags: ['Jubilació', 'Major 65 anys', 'Exempció Plusvàlua'],
    iban: 'ES45 2038 5849 1012 3456 7890',
    enabledModules: ['work_income', 'gains', 'deductions', 'personal', 'caselles', 'advisor', 'comparator', 'result', 'export'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const p5: UserProfile = {
    id: 'profile_alex_beckham',
    name: 'Alexander Weber (Impatriat / Expat)',
    type: 'beckham',
    relation: 'other',
    nif: 'Y8192341M',
    email: 'alex.weber@fintechberlin.de',
    phone: '+34 699 887 766',
    birthDate: '1992-09-12',
    community: 'CAT',
    status: 'draft',
    notes: 'Directiu d\'innovació traslladat a Barcelona acollit a la Llei Beckham (Art. 93 LIRPF).',
    avatarColor: '#eab308',
    avatarIcon: '🌍',
    tags: ['Llei Beckham', 'Tipus Fix 24%', 'Expat'],
    iban: 'ES78 0081 0550 2012 3456 7890',
    enabledModules: ['work_income', 'wealth_tax', 'foreign_assets', 'caselles', 'advisor', 'simulator', 'export'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Creem declaracions per defecte inicialitzades amb dades coherents
  const d1 = createEmptyDeclaracion(2025, p1.id);
  d1.personal.name = p1.name;
  d1.personal.nif = p1.nif;
  d1.personal.age = 36;
  d1.activities = {
    income: 58400,
    expenses: 12200,
    withholdings: 8760,
    socialSecuritySelfEmployed: 4200,
    estimationType: 'direct_simplified',
  };

  const d2 = createEmptyDeclaracion(2025, p2.id);
  d2.personal.name = p2.name;
  d2.personal.nif = p2.nif;
  d2.personal.age = 38;
  d2.workIncome = {
    employers: [
      {
        id: 'emp_1',
        name: 'Tech Global Spain SL',
        grossSalary: 62000,
        inKind: 2400,
        withholdings: 13800,
        socialSecurity: 2600,
        dietsIncome: 0,
        dietsDays: 0,
        mileageIncome: 0,
        mileageKm: 0,
      },
    ],
    unionFees: 0,
    otherDeductible: 0,
    pensionContributions: 1500,
  };
  d2.gains = {
    items: [
      {
        id: 'gain_1',
        description: 'Venda accions Apple Inc [AAPL]',
        type: 'shares',
        acquisitionDate: '2022-03-15',
        transferDate: '2025-06-10',
        acquisitionValue: 8400,
        transferValue: 12900,
        expenses: 25,
      },
    ],
    totalWithholdings: 0,
  };

  const d3 = createEmptyDeclaracion(2025, p3.id);
  d3.personal.name = p3.name;
  d3.personal.nif = p3.nif;
  d3.personal.age = 50;
  d3.properties = [
    {
      id: 'prop_demo_1',
      name: 'Pis Carrer Mallorca (Barcelona)',
      cadastralReference: '9872301DF3897B0001WA',
      address: 'Carrer de Mallorca 245, 3r 1a, Barcelona',
      ownershipPercentage: 100,
      usageType: 'habitual',
      contractDate: '2024-02-01',
      tenantNIFs: ['48910293X'],
      grossRentalIncome: 14400,
      otherIncomes: 0,
      mortgageInterests: 2100,
      repairExpenses: 450,
      pendingRepairsPreviousYears: 0,
      ibi: 680,
      wasteTax: 120,
      communityFees: 960,
      insurance: 320,
      managementFees: 0,
      badDebts: 0,
      totalCadastralValue: 180000,
      constructionCadastralValue: 90000,
      acquisitionCost: 290000,
      inventory: [],
      improvements: [],
      furniture: [],
      reductionType: 'general_50',
    },
  ];

  const d4 = createEmptyDeclaracion(2025, p4.id);
  d4.personal.name = p4.name;
  d4.personal.nif = p4.nif;
  d4.personal.age = 69;
  d4.workIncome = {
    employers: [
      {
        id: 'emp_pensio',
        name: 'INSS - Pensió Pública de Jubilació',
        grossSalary: 28500,
        inKind: 0,
        withholdings: 3950,
        socialSecurity: 0,
        dietsIncome: 0,
        dietsDays: 0,
        mileageIncome: 0,
        mileageKm: 0,
      },
    ],
    unionFees: 0,
    otherDeductible: 0,
    pensionContributions: 0,
  };

  const d5 = createEmptyDeclaracion(2025, p5.id);
  d5.personal.name = p5.name;
  d5.personal.nif = p5.nif;
  d5.personal.age = 33;
  d5.workIncome = {
    employers: [
      {
        id: 'emp_expat',
        name: 'Berlin Fintech Hub (Spain Branch)',
        grossSalary: 95000,
        inKind: 0,
        withholdings: 22800,
        socialSecurity: 2600,
        dietsIncome: 0,
        dietsDays: 0,
        mileageIncome: 0,
        mileageKm: 0,
      },
    ],
    unionFees: 0,
    otherDeductible: 0,
    pensionContributions: 0,
  };

  return {
    profiles: [p1, p2, p3, p4, p5],
    declarations: {
      [`${p1.id}_2025`]: d1,
      [`${p2.id}_2025`]: d2,
      [`${p3.id}_2025`]: d3,
      [`${p4.id}_2025`]: d4,
      [`${p5.id}_2025`]: d5,
    },
  };
}
