/**
 * @module fiscal/amortization-tables
 * Taula d'amortització simplificada de l'Agència Tributària (AEAT)
 * Conforme a l'Ordre de 27 de març de 1998, Art. 23.1.b LIRPF i Criteris DGT.
 * Optimitza el coeficient màxim lineal per aconseguir la deduïbilitat en el menor temps possible.
 */

export type AEATAssetGroupId = 
  | 'group_6_tools_30'       // 30% - Útils i eines (8 anys màx -> 3.33 anys mín)
  | 'group_5_computer_26'    // 26% - Equips informàtics, sistemes, programari, domòtica (10 anys màx -> 3.85 anys mín)
  | 'group_4_transport_16'   // 16% - Elements de transport (patinets, bicicletes) (14 anys màx -> 6.25 anys mín)
  | 'group_3_machinery_12'   // 12% - Maquinària, climatització, aerotèrmia, bombes de calor (18 anys màx -> 8.33 anys mín)
  | 'group_2_furniture_10'   // 10% - Instal·lacions, mobiliari, enseres i electrodomèstics (20 anys màx -> 10 anys mín)
  | 'group_1_improvements_3'; // 3% - Edificis, construccions i obres de millora (68 anys màx -> 33.33 anys mín)

export interface AEATAssetGroupDefinition {
  id: AEATAssetGroupId;
  groupNumber: number;
  name: string;
  shortName: string;
  maxLinearRate: number; // Percentatge anual màxim (%)
  maxYears: number;      // Període màxim en anys
  minYears: number;      // Període mínim d'amortització en anys (a taxa màxima)
  description: string;
  examples: string[];
  keywords: string[];
}

/**
 * Taula oficial de grups d'amortització simplificada de l'AEAT.
 * Ordenada per taxa d'amortització decreixent (de major a menor velocitat d'amortització).
 */
export const AEAT_SIMPLIFIED_TABLE: readonly AEATAssetGroupDefinition[] = [
  {
    id: 'group_6_tools_30',
    groupNumber: 6,
    name: 'Útils i eines (Parament, vaixella, jocs de claus, petits estris)',
    shortName: 'Útils i eines (30%)',
    maxLinearRate: 30,
    maxYears: 8,
    minYears: 3.33,
    description: 'Petits béns d\'ús quotidià, estris de cuina, parament de la llar, caixes d\'eines, jocs de claus, coberteria i vaixella.',
    examples: ['Coberteria i vaixella', 'Joc de tovalloles i llençols', 'Caixa d\'eines', 'Estris de cuina / paelles', 'Jocs de claus de seguretat'],
    keywords: [
      'eina', 'eines', 'util', 'útil', 'utils', 'útils', 'vaixella', 'coberteria', 'parament', 'tovallola', 'tovalloles', 
      'llençol', 'llençols', 'cobertor', 'paella', 'olla', 'estris', 'estris de cuina', 'joc de claus', 'martell', 'tornavís',
      'menatge', 'parament llar', 'cubiertos', 'vajilla', 'toallas', 'sabanas', 'herramientas', 'menaje', 'ollas', 'sartenes'
    ],
  },
  {
    id: 'group_5_computer_26',
    groupNumber: 5,
    name: 'Equips de tractament de la informació, sistemes, programari, domòtica i Smart TV',
    shortName: 'Equips TI / Domòtica / TV (26%)',
    maxLinearRate: 26,
    maxYears: 10,
    minYears: 3.85,
    description: 'Smart TVs, sistemes de domòtica, panys electrònics, encaminadors/routers Wifi, servidors, ordinadors i programari.',
    examples: ['Smart TV menjador', 'Pany intel·ligent Wifi', 'Router Wifi 6 / Repetidors', 'Termòstat intel·ligent / Domòtica', 'Assistents de veu / Sensors'],
    keywords: [
      'tv', 'smart tv', 'televisor', 'pantalla', 'monitor', 'ordinador', 'computer', 'pc', 'portatil', 'portàtil', 'router', 
      'wifi', 'repetidor', 'domotica', 'domòtica', 'pany electronic', 'pany electrònic', 'pany intel·ligent', 'smart lock',
      'termostat intel·ligent', 'termostato', 'sensor', 'alarma', 'camera', 'càmera', 'software', 'programari', 'alexa',
      'google home', 'apple tv', 'chromecast', 'modem', 'switch', 'red'
    ],
  },
  {
    id: 'group_4_transport_16',
    groupNumber: 4,
    name: 'Elements de transport (Patinets elèctrics, bicicletes, vehicles cedits)',
    shortName: 'Transport (16%)',
    maxLinearRate: 16,
    maxYears: 14,
    minYears: 6.25,
    description: 'Mitjans de transport cedits conjuntament amb l\'immoble (ex: patinets elèctrics o bicicletes per a llogaters).',
    examples: ['Patinet elèctric Xiaomi', 'Bicicleta urbana lloguer', 'Vehicle auxiliar servei'],
    keywords: [
      'patinet', 'patinet electric', 'patinete', 'patinete electrico', 'bicicleta', 'bici', 'scooter', 'vehicle', 'vehiculo',
      'ciclomotor', 'remolc'
    ],
  },
  {
    id: 'group_3_machinery_12',
    groupNumber: 3,
    name: 'Maquinària, climatització, aerotèrmia i bombes de calor',
    shortName: 'Maquinària / Clima (12%)',
    maxLinearRate: 12,
    maxYears: 18,
    minYears: 8.33,
    description: 'Equips de climatització split, bombes de calor, sistemes d\'aerotèrmia, calderes, descalcificadors i maquinària.',
    examples: ['Aire condicionat split inverter', 'Bomba de calor / Aerotèrmia', 'Caldera de condensació gas', 'Descalcificador d\'aigua', 'Grup de pressió'],
    keywords: [
      'aire condicionat', 'aire acondicionado', 'clima', 'climatitzacio', 'climatización', 'split', 'bomba de calor', 'aerotermia',
      'aerotèrmia', 'caldera', 'caldera gas', 'termo', 'escalfador', 'calentador', 'descalcificador', 'termo electric',
      'maquinaria', 'maquinària', 'motor', 'compressor', 'purificador', 'deshumidificador', 'bomba aigua'
    ],
  },
  {
    id: 'group_2_furniture_10',
    groupNumber: 2,
    name: 'Instal·lacions, mobiliari, enseres i electrodomèstics',
    shortName: 'Mobiliari i Electrodomèstics (10%)',
    maxLinearRate: 10,
    maxYears: 20,
    minYears: 10,
    description: 'Electrodomèstics de cuina, mobles de dormitori/menjador, llits, matalassos, sofàs, il·luminació i instal·lacions no estructurals.',
    examples: ['Nevera / Frigorífic combi', 'Rentadora 8kg', 'Sofà 3 places', 'Llit i matalàs viscoelàstic', 'Taula menjador i cadires', 'Rentavaixelles', 'Forn i vitroceràmica'],
    keywords: [
      'nevera', 'frigorific', 'frigorífico', 'rentadora', 'lavadora', 'rentavaixelles', 'lavavajillas', 'assecadora', 'secadora',
      'forn', 'horno', 'microones', 'microondas', 'vitroceramica', 'vitrocerámica', 'induccio', 'inducció', 'campana', 
      'extractor', 'sofa', 'sofà', 'llit', 'cama', 'matalas', 'matalàs', 'colchon', 'armari', 'armario', 'taula', 'mesa',
      'cadira', 'cadires', 'sillas', 'estanteria', 'prestatgeria', 'comoda', 'tauleta', 'lampada', 'làmpada', 'cortines',
      'il·luminacio', 'iluminacion', 'moble', 'mobles', 'muebles'
    ],
  },
  {
    id: 'group_1_improvements_3',
    groupNumber: 1,
    name: 'Edificis i obres de millora / reformes de l\'immoble',
    shortName: 'Obres de millora / Construcció (3%)',
    maxLinearRate: 3,
    maxYears: 68,
    minYears: 33.33,
    description: 'Obres que augmenten la capacitat, habitabilitat o vida útil de l\'immoble (reforma bany/cuina, tancaments, aïllament).',
    examples: ['Reforma integral de cuina', 'Renovació bany complet', 'Canvi finestres alumini / doble vidre', 'Aïllament tèrmic façana', 'Instal·lació elèctrica integral'],
    keywords: [
      'reforma', 'obra', 'millora', 'rehabilitacio', 'rehabilitació', 'tancaments', 'finestres', 'ventanas', 'fusteria',
      'aïllament', 'aïllament termic', 'façana', 'paviment', 'parquet', 'enrajolat', 'rajoles', 'canonades', 'fontaneria',
      'instal·lacio electrica', 'instalacion electrica', 'obra cuina', 'obra bany', 'pladur', 'pintura integral'
    ],
  },
];

/**
 * Retorna la definició d'un grup d'actius per ID.
 */
export function getAEATAssetGroup(groupId: AEATAssetGroupId): AEATAssetGroupDefinition {
  const found = AEAT_SIMPLIFIED_TABLE.find(g => g.id === groupId);
  return found || AEAT_SIMPLIFIED_TABLE[4]; // Default: Grup 2 Mobiliari (10%)
}

/**
 * Suggeriment automàtic de la categoria AEAT més beneficiosa (coeficient màxim més alt)
 * a partir de la descripció o concepte de la factura.
 */
export function suggestAEATCategory(description: string): AEATAssetGroupId {
  if (!description) return 'group_2_furniture_10';
  const text = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const group of AEAT_SIMPLIFIED_TABLE) {
    for (const kw of group.keywords) {
      const normalizedKw = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const regex = new RegExp(`\\b${normalizedKw}\\b`, 'i');
      if (regex.test(text) || text.includes(normalizedKw)) {
        return group.id;
      }
    }
  }

  return 'group_2_furniture_10'; // Per defecte: mobiliari i enseres al 10%
}

/**
 * Càlcul complet i dinàmic d'un actiu en l'extracontable d'immobilitzat:
 * - Traça any per any des de la data d'adquisició (data d'alta).
 * - Té en compte la data de baixa (si l'element s'ha donat de baixa, venut o destruït).
 * - S'atura automàticament quan arriba al 100% del cost (totalment amortitzat).
 * - Calcula la quota de l'exercici actual, l'amortització acumulada total i el valor net comptable pendent.
 */
export function calculateItemAnnualAmortization(
  amount: number,
  ratePercent: number,
  manualPreviousAmortization: number = 0,
  fiscalYear: number = 2024,
  acquisitionDate?: string,
  disposalDate?: string,
  status?: 'active' | 'disposed'
): {
  annualAmount: number;
  accumulatedPrior: number;
  accumulatedTotal: number;
  pendingValue: number;
  isFullyAmortized: boolean;
  statusText: string;
} {
  const cost = Math.max(0, amount || 0);
  if (cost <= 0) {
    return {
      annualAmount: 0,
      accumulatedPrior: 0,
      accumulatedTotal: 0,
      pendingValue: 0,
      isFullyAmortized: true,
      statusText: 'Sense cost',
    };
  }

  const rate = Math.max(0, (ratePercent || 10) / 100);
  const fullYearQuota = cost * rate;

  // Analitzar dates
  let acqDate: Date | null = null;
  if (acquisitionDate) {
    try {
      const d = new Date(acquisitionDate);
      if (!isNaN(d.getTime())) acqDate = d;
    } catch {}
  }

  let dispDate: Date | null = null;
  if ((status === 'disposed' || disposalDate) && disposalDate) {
    try {
      const d = new Date(disposalDate);
      if (!isNaN(d.getTime())) dispDate = d;
    } catch {}
  }

  const acqYear = acqDate ? acqDate.getFullYear() : fiscalYear;
  const dispYear = dispDate ? dispDate.getFullYear() : null;

  // Si l'element encara no s'havia adquirit a l'any fiscal actual
  if (acqDate && acqYear > fiscalYear) {
    return {
      annualAmount: 0,
      accumulatedPrior: 0,
      accumulatedTotal: 0,
      pendingValue: cost,
      isFullyAmortized: false,
      statusText: 'No adquirit encara',
    };
  }

  // Si l'element es va donar de baixa abans de l'any fiscal actual
  if (dispDate && dispYear !== null && dispYear < fiscalYear) {
    return {
      annualAmount: 0,
      accumulatedPrior: 0, // ja no computa
      accumulatedTotal: cost,
      pendingValue: 0,
      isFullyAmortized: true,
      statusText: 'Donat de baixa (anys anteriors)',
    };
  }

  // Calculem l'evolució acumulada any per any des d'acqYear fins a fiscalYear - 1
  let accumulatedPrior = 0;

  if (manualPreviousAmortization > 0) {
    accumulatedPrior = Math.min(cost, manualPreviousAmortization);
  } else if (acqDate && acqYear < fiscalYear) {
    for (let y = acqYear; y < fiscalYear; y++) {
      let yearQuota = fullYearQuota;
      
      // Pro-rata l'any d'adquisició
      if (y === acqYear) {
        const startOfYear = new Date(y, 0, 1);
        const endOfYear = new Date(y, 11, 31);
        const totalDays = (endOfYear.getTime() - startOfYear.getTime()) / (1000 * 3600 * 24) + 1;
        const activeDays = Math.max(1, (endOfYear.getTime() - acqDate.getTime()) / (1000 * 3600 * 24) + 1);
        yearQuota = fullYearQuota * Math.min(1, activeDays / totalDays);
      }

      // Si es va donar de baixa en aquest any intermedi
      if (dispDate && dispYear === y) {
        const startOfYear = new Date(y, 0, 1);
        const endOfYear = new Date(y, 11, 31);
        const totalDays = (endOfYear.getTime() - startOfYear.getTime()) / (1000 * 3600 * 24) + 1;
        const activeDays = Math.max(1, (dispDate.getTime() - startOfYear.getTime()) / (1000 * 3600 * 24) + 1);
        yearQuota = fullYearQuota * Math.min(1, activeDays / totalDays);
      }

      const availableToAmortize = Math.max(0, cost - accumulatedPrior);
      accumulatedPrior += Math.min(availableToAmortize, yearQuota);

      if (accumulatedPrior >= cost) break;
    }
  }

  // Si ja està totalment amortitzat abans d'aquest any
  if (accumulatedPrior >= cost - 0.01) {
    return {
      annualAmount: 0,
      accumulatedPrior: cost,
      accumulatedTotal: cost,
      pendingValue: 0,
      isFullyAmortized: true,
      statusText: 'Totalment amortitzat (100%)',
    };
  }

  // Quota per a l'exercici fiscal actual
  let currentYearQuota = fullYearQuota;

  // Si s'ha adquirit en el propi exercici actual (pro-rata d'alta)
  if (acqDate && acqYear === fiscalYear) {
    const startOfYear = new Date(fiscalYear, 0, 1);
    const endOfYear = new Date(fiscalYear, 11, 31);
    const totalDays = (endOfYear.getTime() - startOfYear.getTime()) / (1000 * 3600 * 24) + 1;
    const activeDays = Math.max(1, (endOfYear.getTime() - acqDate.getTime()) / (1000 * 3600 * 24) + 1);
    currentYearQuota = fullYearQuota * Math.min(1, activeDays / totalDays);
  }

  // Si s'ha donat de baixa en el propi exercici actual (pro-rata de baixa)
  if (dispDate && dispYear === fiscalYear) {
    const startOfYear = (acqDate && acqYear === fiscalYear) ? acqDate : new Date(fiscalYear, 0, 1);
    const endOfYear = new Date(fiscalYear, 11, 31);
    const totalDays = (endOfYear.getTime() - new Date(fiscalYear, 0, 1).getTime()) / (1000 * 3600 * 24) + 1;
    const activeDays = Math.max(1, (dispDate.getTime() - startOfYear.getTime()) / (1000 * 3600 * 24) + 1);
    currentYearQuota = fullYearQuota * Math.min(1, activeDays / totalDays);
  }

  // Capar perquè no superi el cost restant
  const remainingCost = Math.max(0, cost - accumulatedPrior);
  const annualAmount = Math.min(remainingCost, currentYearQuota);
  const accumulatedTotal = accumulatedPrior + annualAmount;
  const pendingValue = Math.max(0, cost - accumulatedTotal);
  const isFullyAmortized = pendingValue <= 0.01;

  let statusText = 'En amortització';
  if (isFullyAmortized) {
    statusText = 'Totalment amortitzat (100%)';
  } else if (dispDate && dispYear === fiscalYear) {
    statusText = 'Donat de baixa aquest exercici';
  }

  return {
    annualAmount,
    accumulatedPrior,
    accumulatedTotal,
    pendingValue,
    isFullyAmortized,
    statusText,
  };
}
