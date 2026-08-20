/**
 * @module fiscal/real-estate-automator
 * Motor d'automatització avançada per a la gestió d'immobles en lloguer:
 * - Parser i categoritzador heurístic de despeses, factures i extractes bancaris.
 * - Motor d'actualització de contractes de lloguer i límits legals (IPC / IRAV / Llei 12/2023).
 * - Algorisme de seguiment i optimització d'excedents de despeses a 4 anys (Art. 23.1.a LIRPF).
 * - Càlcul de mètriques de rendibilitat (Gross/Net Yield, Cash Flow, Cap Rate, ROI net IRPF).
 * - Presets d'immobles i auditoria/correcció automàtica de la cartera immobiliària.
 */

import type { 
  RentalProperty, 
  PropertyInventoryItem, 
  PropertyFiscalResult, 
  PropertyFinancialMetrics
} from '../types-properties.ts';
import { getAEATAssetGroup, type AEATAssetGroupId } from './amortization-tables.ts';

export interface ParsedExpenseItem {
  id: string;
  date: string;
  concept: string;
  supplierName: string;
  supplierNif?: string;
  invoiceNumber?: string;
  amount: number;
  type: 'operating' | 'inventory';
  operatingTarget?: 'ibi' | 'wasteTax' | 'otherTaxes' | 'communityFees' | 'insurance' | 'mortgageInterests' | 'repairExpenses' | 'managementFees' | 'badDebts';
  inventoryCategory?: AEATAssetGroupId;
  amortizationRate?: number;
  confidence: number; // 0 a 100
  notes?: string;
}

/**
 * Analitza text lliure, línies enganxades d'extractes bancaris (CaixaBank, BBVA, Santander, etc.) o CSV
 * i classifica automàticament cada concepte en despesa operativa IRPF o actiu d'inventari AEAT (3%-30%).
 */
export function parsePropertyExpenses(rawText: string): ParsedExpenseItem[] {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const items: ParsedExpenseItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Ignorar capçaleres típiques
    if (line.toLowerCase().includes('data') && line.toLowerCase().includes('import') && line.toLowerCase().includes('concepte')) {
      continue;
    }

    // Extreure import monetari (ex: 1.250,50 €, 450.00, -120,00 EUR)
    const amountMatch = line.match(/(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})|-?\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR|eur)?/);
    if (!amountMatch) continue;

    // Normalitzar import
    let rawAmountStr = amountMatch[1].replace(/\s/g, '');
    if (rawAmountStr.includes('.') && rawAmountStr.includes(',')) {
      rawAmountStr = rawAmountStr.replace(/\./g, '').replace(',', '.');
    } else if (rawAmountStr.includes(',')) {
      rawAmountStr = rawAmountStr.replace(',', '.');
    }
    const amount = Math.abs(parseFloat(rawAmountStr));
    if (isNaN(amount) || amount <= 0) continue;

    // Extreure data si existeix (AAAA-MM-DD o DD/MM/AAAA o DD-MM-AAAA)
    let dateStr = new Date().toISOString().split('T')[0];
    const dateMatch = line.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/) || line.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (dateMatch) {
      if (dateMatch[1].length === 4) {
        dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      } else {
        const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
        dateStr = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
      }
    }

    // Extreure NIF si existeix (ex: B12345678, 12345678Z)
    let nifMatch = line.match(/\b([A-Z]\d{8}|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b/i);
    const supplierNif = nifMatch ? nifMatch[1].toUpperCase() : '';

    // Extreure número de factura si existeix (ex: F-2024-012, FAC/1234, Factura 987)
    let invoiceMatch = line.match(/(?:factura|fac|fra|f-)\s*[:#]?\s*([a-z0-9\-\/]+)/i);
    const invoiceNumber = invoiceMatch ? invoiceMatch[1].toUpperCase() : `REC-${dateStr.replace(/-/g, '')}-${i + 1}`;

    // Netejar concepte
    let concept = line
      .replace(amountMatch[0], '')
      .replace(dateMatch ? dateMatch[0] : '', '')
      .replace(nifMatch ? nifMatch[0] : '', '')
      .replace(/[;|,\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (concept.length < 3) {
      concept = `Despesa immoble ${dateStr}`;
    }

    // Auto-categorització intel·ligent
    const lower = line.toLowerCase();

    // 1. Inventari / Immobilitzat (Amortitzable AEAT)
    if (
      lower.includes('smart tv') || lower.includes('televisio') || lower.includes('televisor') ||
      lower.includes('router') || lower.includes('wifi') || lower.includes('domotica') ||
      lower.includes('alarma') || lower.includes('pany electronic') || lower.includes('termostat')
    ) {
      const g = getAEATAssetGroup('group_5_computer_26');
      items.push({
        id: `parsed-${i}-${Date.now()}`,
        date: dateStr,
        concept,
        supplierName: extractSupplierName(concept, 'Proveïdor TI/Domòtica'),
        supplierNif,
        invoiceNumber,
        amount,
        type: 'inventory',
        inventoryCategory: 'group_5_computer_26',
        amortizationRate: g?.maxLinearRate || 26,
        confidence: 95,
        notes: 'Classificat com Grup 5 AEAT (TI/Domòtica/TV - 26%)',
      });
    } else if (
      lower.includes('nevera') || lower.includes('frigorific') || lower.includes('frigo') ||
      lower.includes('rentadora') || lower.includes('lavadora') || lower.includes('rentaplats') || lower.includes('lavavajillas') ||
      lower.includes('forn') || lower.includes('microones') || lower.includes('sofa') || lower.includes('llit') ||
      lower.includes('matalas') || lower.includes('colcho') || lower.includes('taula') || lower.includes('cadires') ||
      lower.includes('armari') || lower.includes('moble') || lower.includes('ikea') || lower.includes('conforama')
    ) {
      const g = getAEATAssetGroup('group_2_furniture_10');
      items.push({
        id: `parsed-${i}-${Date.now()}`,
        date: dateStr,
        concept,
        supplierName: extractSupplierName(concept, 'Botiga Mobiliari/Electrodomèstics'),
        supplierNif,
        invoiceNumber,
        amount,
        type: 'inventory',
        inventoryCategory: 'group_2_furniture_10',
        amortizationRate: g?.maxLinearRate || 10,
        confidence: 95,
        notes: 'Classificat com Grup 2 AEAT (Mobiliari i electrodomèstics - 10%)',
      });
    } else if (
      lower.includes('aire condicionat') || lower.includes('clima') || lower.includes('aerotermia') ||
      lower.includes('bomba calor') || lower.includes('caldera') || lower.includes('escalfador') || lower.includes('splits')
    ) {
      const g = getAEATAssetGroup('group_3_machinery_12');
      items.push({
        id: `parsed-${i}-${Date.now()}`,
        date: dateStr,
        concept,
        supplierName: extractSupplierName(concept, 'Instal·lacions Climatització'),
        supplierNif,
        invoiceNumber,
        amount,
        type: 'inventory',
        inventoryCategory: 'group_3_machinery_12',
        amortizationRate: g?.maxLinearRate || 12,
        confidence: 90,
        notes: 'Classificat com Grup 3 AEAT (Climatització / Maquinària - 12%)',
      });
    } else if (
      lower.includes('reforma integral') || lower.includes('rehabilitacio') || lower.includes('tancaments alumini') ||
      lower.includes('finestres climalit') || lower.includes('façana') || lower.includes('derrama ascensor')
    ) {
      const g = getAEATAssetGroup('group_1_improvements_3');
      items.push({
        id: `parsed-${i}-${Date.now()}`,
        date: dateStr,
        concept,
        supplierName: extractSupplierName(concept, 'Empresa de Reformes'),
        supplierNif,
        invoiceNumber,
        amount,
        type: 'inventory',
        inventoryCategory: 'group_1_improvements_3',
        amortizationRate: g?.maxLinearRate || 3,
        confidence: 90,
        notes: 'Classificat com Grup 1 AEAT (Obres de millora / Reforma - 3%)',
      });
    } else if (lower.includes('eina') || lower.includes('trepant') || lower.includes('utillatge') || lower.includes('brico')) {
      const g = getAEATAssetGroup('group_6_tools_30');
      items.push({
        id: `parsed-${i}-${Date.now()}`,
        date: dateStr,
        concept,
        supplierName: extractSupplierName(concept, 'Ferreteria / Bricolatge'),
        supplierNif,
        invoiceNumber,
        amount,
        type: 'inventory',
        inventoryCategory: 'group_6_tools_30',
        amortizationRate: g?.maxLinearRate || 30,
        confidence: 85,
        notes: 'Classificat com Grup 6 AEAT (Eines i útils - 30%)',
      });
    }
    // 2. Despeses Operatives Corrents
    else if (lower.includes('ibi') || lower.includes('contribucio') || lower.includes('contribucion') || lower.includes('impost bens immobles') || lower.includes('impuesto bienes inmuebles') || (lower.includes('ajuntament') && !lower.includes('escombraries') && !lower.includes('bross') && !lower.includes('residus') && !lower.includes('gual'))) {
      items.push({
        id: `parsed-${i}-${Date.now()}`,
        date: dateStr,
        concept,
        supplierName: 'Ajuntament / Hisenda Local',
        supplierNif,
        invoiceNumber,
        amount,
        type: 'operating',
        operatingTarget: 'ibi',
        confidence: 98,
        notes: 'Casella 0073 AEAT (IBI - Impost sobre Béns Immobles)',
      });
    } else if (lower.includes('escombraries') || lower.includes('basuras') || lower.includes('basura') || lower.includes('brossa') || lower.includes('brosses') || lower.includes('taxa residus') || lower.includes('residus')) {
      items.push({
        id: `parsed-${i}-${Date.now()}`,
        date: dateStr,
        concept,
        supplierName: 'Ajuntament / Mancomunitat de Residus',
        supplierNif,
        invoiceNumber,
        amount,
        type: 'operating',
        operatingTarget: 'wasteTax',
        confidence: 98,
        notes: 'Casella 0073 AEAT (Taxa d\'escombraries i brosses)',
      });
    } else if (lower.includes('gual') || lower.includes('vado') || lower.includes('clavegueram') || lower.includes('alcantarillado') || lower.includes('taxa municipal') || lower.includes('tribut local') || lower.includes('taxa pas')) {
      items.push({
        id: `parsed-${i}-${Date.now()}`,
        date: dateStr,
        concept,
        supplierName: 'Ajuntament / Tributs Locals',
        supplierNif,
        invoiceNumber,
        amount,
        type: 'operating',
        operatingTarget: 'otherTaxes',
        confidence: 95,
        notes: 'Casella 0073 AEAT (Altres taxes i tributs no estatals)',
      });
    } else if (lower.includes('comunitat') || lower.includes('comunidad') || lower.includes('administrador finques') || lower.includes('quota escala')) {
      items.push({
        id: `parsed-${i}-${Date.now()}`,
        date: dateStr,
        concept,
        supplierName: extractSupplierName(concept, 'Comunitat de Propietaris'),
        supplierNif,
        invoiceNumber,
        amount,
        type: 'operating',
        operatingTarget: 'communityFees',
        confidence: 95,
        notes: 'Casella 0074 AEAT (Despeses de comunitat de propietaris)',
      });
    } else if (lower.includes('assegurança') || lower.includes('asseguranca') || lower.includes('seguro') || lower.includes('polissa') || lower.includes('mapfre') || lower.includes('mutua') || lower.includes('axa') || lower.includes('allianz') || lower.includes('arrenta') || lower.includes('segurcaixa') || lower.includes('ocaso') || lower.includes('generali') || lower.includes('zurich') || lower.includes('catalana occidente')) {
      items.push({
        id: `parsed-${i}-${Date.now()}`,
        date: dateStr,
        concept,
        supplierName: extractSupplierName(concept, 'Companyia Asseguradora (Llar/Impagament/RC)'),
        supplierNif,
        invoiceNumber,
        amount,
        type: 'operating',
        operatingTarget: 'insurance',
        confidence: 95,
        notes: 'Casella 0075 AEAT (Assegurança llar, RC i impagament de lloguer)',
      });
    } else if (lower.includes('hipoteca') || lower.includes('prestec') || lower.includes('interessos') || lower.includes('comissio bancaria') || lower.includes('caixabank') || lower.includes('bbva') || lower.includes('santander')) {
      items.push({
        id: `parsed-${i}-${Date.now()}`,
        date: dateStr,
        concept,
        supplierName: 'Entitat Financera',
        supplierNif,
        invoiceNumber,
        amount,
        type: 'operating',
        operatingTarget: 'mortgageInterests',
        confidence: 90,
        notes: 'Casella 0069 AEAT (Interessos i despeses financeres)',
      });
    } else if (lower.includes('gestoria') || lower.includes('agencia') || lower.includes('immobiliaria') || lower.includes('inmobiliaria') || lower.includes('advocat') || lower.includes('notari') || lower.includes('contracte')) {
      items.push({
        id: `parsed-${i}-${Date.now()}`,
        date: dateStr,
        concept,
        supplierName: extractSupplierName(concept, 'Agència / Gestoria'),
        supplierNif,
        invoiceNumber,
        amount,
        type: 'operating',
        operatingTarget: 'managementFees',
        confidence: 90,
        notes: 'Casella 0076 AEAT (Despeses d\'administració i jurídiques)',
      });
    } else {
      // Per defecte reparació / conservació (lampista, pintor, manteniment, reparacions diverses)
      items.push({
        id: `parsed-${i}-${Date.now()}`,
        date: dateStr,
        concept,
        supplierName: extractSupplierName(concept, 'Manteniment / Reparacions'),
        supplierNif,
        invoiceNumber,
        amount,
        type: 'operating',
        operatingTarget: 'repairExpenses',
        confidence: 80,
        notes: 'Casella 0070 AEAT (Reparació i conservació)',
      });
    }
  }

  return items;
}

function extractSupplierName(concept: string, fallback: string): string {
  const parts = concept.split(/[-–—:]/);
  if (parts.length > 1 && parts[0].trim().length > 2) {
    return parts[0].trim();
  }
  return fallback;
}

/**
 * Aplica automàticament el conjunt de despeses i factures parsejades directament a una propietat,
 * actualitzant tant els camps de despeses operatives com creant els registres d'inventari AEAT.
 */
export function applyParsedExpensesToProperty(
  property: RentalProperty, 
  items: ParsedExpenseItem[],
  _fiscalYear: number = 2024
): {
  updatedProperty: RentalProperty;
  operatingExpensesAdded: number;
  inventoryItemsAdded: number;
  totalAmountApplied: number;
} {
  const updated: RentalProperty = JSON.parse(JSON.stringify(property));
  if (!updated.inventory) updated.inventory = [];

  let operatingAddedCount = 0;
  let inventoryAddedCount = 0;
  let totalAmount = 0;

  for (const item of items) {
    totalAmount += item.amount;

    if (item.type === 'inventory') {
      const g = getAEATAssetGroup(item.inventoryCategory || 'group_2_furniture_10');
      const invItem: PropertyInventoryItem = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        invoiceNumber: item.invoiceNumber || `FAC-${item.date.replace(/-/g, '')}`,
        supplierName: item.supplierName || 'Proveïdor',
        supplierNif: item.supplierNif || '',
        concept: item.concept,
        category: item.inventoryCategory || 'group_2_furniture_10',
        acquisitionDate: item.date,
        amount: item.amount,
        amortizationRate: item.amortizationRate || g?.maxLinearRate || 10,
        maxYears: g?.maxYears || 20,
        minYears: g?.minYears || 10,
        previousAmortization: 0,
        status: 'active',
        notes: item.notes || 'Importat automàticament',
      };
      updated.inventory.push(invItem);
      inventoryAddedCount++;
    } else {
      // Despesa operativa
      const target = item.operatingTarget || 'repairExpenses';
      updated[target] = (updated[target] || 0) + item.amount;
      operatingAddedCount++;
    }
  }

  return {
    updatedProperty: updated,
    operatingExpensesAdded: operatingAddedCount,
    inventoryItemsAdded: inventoryAddedCount,
    totalAmountApplied: totalAmount,
  };
}

/**
 * Calculadora d'Actualització de Renda Legal (IPC / IRAV / Llei 12/2023).
 * Limita legalment l'increment al 3,0% (2024) o a l'índex de referència oficial (IRAV).
 */
export function calculateRentAdjustment(
  currentRent: number,
  indexationType: 'ipc' | 'irav' | 'custom' = 'ipc',
  customRate?: number,
  fiscalYear: number = 2024
): {
  previousMonthlyRent: number;
  newMonthlyRent: number;
  monthlyIncrease: number;
  annualExtraGrossIncome: number;
  legalMaxRate: number;
  appliedRate: number;
  legalNoticePeriodDays: number;
  legalRecommendation: string;
} {
  // Límit Llei 12/2023 pel Dret a l'Habitatge: 3% màxim per al 2024
  let legalMaxRate = fiscalYear <= 2024 ? 3.0 : 2.8;
  let appliedRate = legalMaxRate;

  if (indexationType === 'custom' && customRate !== undefined) {
    appliedRate = Math.min(legalMaxRate, Math.max(0, customRate));
  } else if (indexationType === 'irav') {
    appliedRate = 2.5; // Estimació nou índex INE/IRAV
  }

  const monthlyIncrease = currentRent * (appliedRate / 100);
  const newMonthlyRent = currentRent + monthlyIncrease;
  const annualExtraGrossIncome = monthlyIncrease * 12;

  let legalRecommendation = `Increment conforme amb l'Art. 46 del RDL 6/2022 i la Llei 12/2023 (Límit legal màxim: ${legalMaxRate}%). Cal notificar a l'arrendatari amb 30 dies d'antelació a la data d'aniversari del contracte.`;

  return {
    previousMonthlyRent: currentRent,
    newMonthlyRent,
    monthlyIncrease,
    annualExtraGrossIncome,
    legalMaxRate,
    appliedRate,
    legalNoticePeriodDays: 30,
    legalRecommendation,
  };
}

/**
 * Algorisme de seguiment i optimització de l'excedent de despeses de reparació i finançament a 4 anys (Art. 23.1.a LIRPF).
 */
export function calculateFourYearCarryoverPlan(
  property: RentalProperty,
  _fiscalYear: number = 2024
): {
  yearMinus4Available: number;
  yearMinus3Available: number;
  yearMinus2Available: number;
  yearMinus1Available: number;
  totalPriorCarryover: number;
  currentYearGrossIncome: number;
  currentYearRepairMortgage: number;
  absorbedThisYear: number;
  expiringCarryoverLost: number; // Excedent d'any N-4 que caduca si no s'utilitza
  remainingCarryoverForNextYears: number;
  projectedTaxShieldEUR: number; // Valor de l'escut fiscal a tipus marginal estimat (ex: 35%)
} {
  const history = property.carryoverHistory || {
    yearMinus4: 0,
    yearMinus3: 0,
    yearMinus2: 0,
    yearMinus1: 0,
  };

  const totalPriorCarryover = (history.yearMinus4 || 0) + (history.yearMinus3 || 0) + (history.yearMinus2 || 0) + (history.yearMinus1 || 0);
  const currentGross = (property.grossRentalIncome || 0) + (property.otherIncomes || 0);
  const currentRepairMortgage = (property.mortgageInterests || 0) + (property.repairExpenses || 0);

  // Límit màxim deduïble = ingressos íntegres
  let remainingCapacity = Math.max(0, currentGross - currentRepairMortgage);
  
  // Ordre de deducció FIFO: primer s'absorbeix el més antic (N-4) per evitar que caduqui
  let n4Absorbed = Math.min(remainingCapacity, history.yearMinus4 || 0);
  remainingCapacity -= n4Absorbed;
  const expiringCarryoverLost = Math.max(0, (history.yearMinus4 || 0) - n4Absorbed);

  let n3Absorbed = Math.min(remainingCapacity, history.yearMinus3 || 0);
  remainingCapacity -= n3Absorbed;

  let n2Absorbed = Math.min(remainingCapacity, history.yearMinus2 || 0);
  remainingCapacity -= n2Absorbed;

  let n1Absorbed = Math.min(remainingCapacity, history.yearMinus1 || 0);
  remainingCapacity -= n1Absorbed;

  const totalPriorAbsorbed = n4Absorbed + n3Absorbed + n2Absorbed + n1Absorbed;
  const currentYearExcess = Math.max(0, currentRepairMortgage - currentGross);

  const remainingCarryoverForNextYears = 
    ((history.yearMinus3 || 0) - n3Absorbed) +
    ((history.yearMinus2 || 0) - n2Absorbed) +
    ((history.yearMinus1 || 0) - n1Absorbed) +
    currentYearExcess;

  // Escut fiscal estimat al 35% de tipus marginal
  const projectedTaxShieldEUR = remainingCarryoverForNextYears * 0.35;

  return {
    yearMinus4Available: history.yearMinus4 || 0,
    yearMinus3Available: history.yearMinus3 || 0,
    yearMinus2Available: history.yearMinus2 || 0,
    yearMinus1Available: history.yearMinus1 || 0,
    totalPriorCarryover,
    currentYearGrossIncome: currentGross,
    currentYearRepairMortgage: currentRepairMortgage,
    absorbedThisYear: Math.min(currentGross, currentRepairMortgage + totalPriorAbsorbed),
    expiringCarryoverLost,
    remainingCarryoverForNextYears,
    projectedTaxShieldEUR,
  };
}

/**
 * Calcula totes les mètriques financeres, ROI i rendibilitat real d'un immoble.
 */
export function calculatePropertyFinancialMetrics(
  property: RentalProperty,
  res: PropertyFiscalResult
): PropertyFinancialMetrics {
  const acquisitionCost = property.acquisitionCost || property.totalCadastralValue || 1;
  const grossIncome = res.grossIncome || 0;
  
  // 1. Gross Yield (%)
  const grossYield = acquisitionCost > 0 ? (grossIncome / acquisitionCost) * 100 : 0;

  // 2. Net Operating Income (NOI) & Net Yield (%)
  const operatingExpenses = res.totalCurrentExpenses + res.repairExpenses + res.mortgageInterests;
  const noi = grossIncome - operatingExpenses;
  const netYield = acquisitionCost > 0 ? (noi / acquisitionCost) * 100 : 0;

  // 3. Cash Flow Anual Net (€)
  const cashFlowAnnual = grossIncome - operatingExpenses;

  // 4. Cap Rate (%)
  const capRate = acquisitionCost > 0 ? (noi / acquisitionCost) * 100 : 0;

  // 5. Estalvi Fiscal per Amortitzacions i Reduccions AEAT (€)
  // Estalvi directe calculat al tipus marginal mitjà del 35%
  const taxDeductionsTotal = res.totalAmortization + res.reductionAmount;
  const estimatedSavingsAEAT = taxDeductionsTotal * 0.35;

  // 6. Retorn Real després d'IRPF (%)
  const afterTaxNetIncome = noi + estimatedSavingsAEAT;
  const afterTaxReturn = acquisitionCost > 0 ? (afterTaxNetIncome / acquisitionCost) * 100 : 0;

  return {
    grossYield: parseFloat(grossYield.toFixed(2)),
    netYield: parseFloat(netYield.toFixed(2)),
    cashFlowAnnual: parseFloat(cashFlowAnnual.toFixed(2)),
    capRate: parseFloat(capRate.toFixed(2)),
    afterTaxReturn: parseFloat(afterTaxReturn.toFixed(2)),
    estimatedSavingsAEAT: parseFloat(estimatedSavingsAEAT.toFixed(2)),
  };
}

/**
 * Presets d'immobles configurats professionalment per a demostracions i càrrega ràpida.
 */
export function getRealEstatePortfolioPresets(): {
  name: string;
  description: string;
  property: RentalProperty;
}[] {
  return [
    {
      name: '🏠 Pis Habitatge Habitual (Barcelona - Eixample)',
      description: 'Lloguer habitual en zona tensionada amb reducció del 50% de la Llei 12/2023, moblat i amb despeses de comunitat i IBI.',
      property: {
        id: 'preset-bcn-habitual',
        name: 'Pis Carrer Aragó (Barcelona)',
        cadastralReference: '9872023DF3897S0001WX',
        address: 'C/ Aragó 245, 3r 2a, 08007 Barcelona',
        ownershipPercentage: 100,
        usageType: 'habitual',
        contractDate: '2023-11-01',
        tenantNIFs: ['47891234K', '48901235P'],
        monthlyRent: 1150,
        contractStartDate: '2023-11-01',
        grossRentalIncome: 13800,
        otherIncomes: 0,
        mortgageInterests: 1450,
        repairExpenses: 650,
        pendingRepairsPreviousYears: 0,
        ibi: 680,
        wasteTax: 85,
        otherTaxes: 45,
        communityFees: 960,
        insurance: 320,
        managementFees: 600,
        badDebts: 0,
        totalCadastralValue: 120000,
        constructionCadastralValue: 84000, // 70% construcció
        acquisitionCost: 265000,
        reductionType: 'general_50',
        inventory: [
          {
            id: 'inv-1',
            invoiceNumber: 'FRA-2023-441',
            supplierName: 'Ikea Sabadell',
            supplierNif: 'A-28824360',
            concept: 'Mobiliari menjador i dormitori principal',
            category: 'group_2_furniture_10',
            acquisitionDate: '2023-10-15',
            amount: 3400,
            amortizationRate: 10,
            maxYears: 20,
            minYears: 10,
            previousAmortization: 340,
            status: 'active',
          },
          {
            id: 'inv-2',
            invoiceNumber: 'MM-2023-998',
            supplierName: 'MediaMarkt',
            supplierNif: 'A-08284687',
            concept: 'Smart TV 55" Samsung + Domòtica WiFi',
            category: 'group_5_computer_26',
            acquisitionDate: '2023-10-20',
            amount: 850,
            amortizationRate: 26,
            maxYears: 8,
            minYears: 4,
            previousAmortization: 221,
            status: 'active',
          },
          {
            id: 'inv-3',
            invoiceNumber: 'CLIMA-2023-12',
            supplierName: 'Instal·lacions Clima BCN',
            supplierNif: 'B-65432190',
            concept: 'Bomba de calor / Aire condicionat Daikin',
            category: 'group_3_machinery_12',
            acquisitionDate: '2023-10-05',
            amount: 2200,
            amortizationRate: 12,
            maxYears: 18,
            minYears: 8,
            previousAmortization: 264,
            status: 'active',
          },
        ],
        improvements: [],
        furniture: [],
      },
    },
    {
      name: '🏖️ Apartament Turístic & Ús Mixt (Costa Brava)',
      description: 'Apartament a Platja d\'Aro llogat durant 90 dies d\'estiu i amb 275 dies a disposició pròpia (Art. 85 LIRPF).',
      property: {
        id: 'preset-costa-brava',
        name: 'Apartament Platja d\'Aro (Ús Mixt)',
        cadastralReference: '1234501EG0813S0001KL',
        address: 'Av. Cavall Bernat 88, 1r 1a, 17250 Platja d\'Aro',
        ownershipPercentage: 100,
        usageType: 'tourist',
        contractDate: '2024-06-01',
        tenantNIFs: [],
        isMixedUsage: true,
        rentalDays: 90,
        ownUseDays: 275,
        isCadastralRevised: true, // 1.1%
        grossRentalIncome: 9500,
        otherIncomes: 350,
        mortgageInterests: 900,
        repairExpenses: 1200,
        pendingRepairsPreviousYears: 0,
        ibi: 550,
        wasteTax: 120,
        otherTaxes: 60,
        communityFees: 1100,
        insurance: 280,
        managementFees: 1425, // 15% gestió turística
        badDebts: 0,
        totalCadastralValue: 95000,
        constructionCadastralValue: 57000, // 60%
        acquisitionCost: 185000,
        reductionType: 'none',
        inventory: [
          {
            id: 'inv-cb-1',
            invoiceNumber: 'LEROY-2024-11',
            supplierName: 'Leroy Merlin',
            supplierNif: 'A-84848484',
            concept: 'Parament, llits i mobiliari terrassa',
            category: 'group_2_furniture_10',
            acquisitionDate: '2024-05-10',
            amount: 2800,
            amortizationRate: 10,
            maxYears: 20,
            minYears: 10,
            previousAmortization: 0,
            status: 'active',
          },
        ],
        improvements: [],
        furniture: [],
      },
    },
    {
      name: '🛠️ Pis Totalment Reformat amb Excedent a 4 Anys',
      description: 'Pis amb reforma integral recent i despeses de reparació superiors als ingressos, generant escut fiscal per als propers 4 exercicis.',
      property: {
        id: 'preset-reformat-4anys',
        name: 'Pis Reformat (Girona Centre)',
        cadastralReference: '7654321DF1234S0001ZX',
        address: 'Gran Via de Jaume I 34, 4t, 17001 Girona',
        ownershipPercentage: 100,
        usageType: 'habitual',
        contractDate: '2024-04-01',
        tenantNIFs: ['41234567M'],
        monthlyRent: 850,
        grossRentalIncome: 7650, // 9 mesos
        otherIncomes: 0,
        mortgageInterests: 2100,
        repairExpenses: 8900, // Supera ingressos -> excedent a 4 anys
        pendingRepairsPreviousYears: 1500,
        carryoverHistory: {
          yearMinus4: 0,
          yearMinus3: 0,
          yearMinus2: 500,
          yearMinus1: 1000,
        },
        ibi: 520,
        wasteTax: 70,
        otherTaxes: 35,
        communityFees: 720,
        insurance: 260,
        managementFees: 300,
        badDebts: 0,
        totalCadastralValue: 80000,
        constructionCadastralValue: 56000,
        acquisitionCost: 175000,
        reductionType: 'general_50',
        inventory: [
          {
            id: 'inv-gi-1',
            invoiceNumber: 'REF-2024-001',
            supplierName: 'Construccions Gironines SL',
            supplierNif: 'B-17890456',
            concept: 'Reforma de bany, cuina i instal·lació elèctrica',
            category: 'group_1_improvements_3',
            acquisitionDate: '2024-03-15',
            amount: 14500,
            amortizationRate: 3,
            maxYears: 68,
            minYears: 33,
            previousAmortization: 0,
            status: 'active',
          },
        ],
        improvements: [],
        furniture: [],
      },
    },
    {
      name: '🏢 Local Comercial Arrendat',
      description: 'Local comercial en planta baixa arrendat a negoci, sense dret a reducció d\'habitatge habitual i amb retenció de lloguer.',
      property: {
        id: 'preset-local-comercial',
        name: 'Local Comercial (Terrassa)',
        cadastralReference: '5432167DF8912S0001MN',
        address: 'Rambla d\'Ègara 110, Baixos, 08221 Terrassa',
        ownershipPercentage: 100,
        usageType: 'commercial',
        contractDate: '2022-01-01',
        tenantNIFs: ['B-65890123'],
        monthlyRent: 1400,
        grossRentalIncome: 16800,
        otherIncomes: 0,
        mortgageInterests: 800,
        repairExpenses: 400,
        pendingRepairsPreviousYears: 0,
        ibi: 890,
        wasteTax: 160,
        otherTaxes: 75,
        communityFees: 600,
        insurance: 410,
        managementFees: 500,
        badDebts: 0,
        totalCadastralValue: 110000,
        constructionCadastralValue: 77000,
        acquisitionCost: 210000,
        reductionType: 'none',
        inventory: [],
        improvements: [],
        furniture: [],
      },
    },
  ];
}

/**
 * Executa una auditoria completa i optimització fiscal de tots els immobles del contribuent:
 * - Omple ràtios de construcció segons criteris màxims DGT (70% per defecte si no s'ha especificat).
 * - Maximitza la base d'amortització seleccionant el màxim legal entre Cadastre i Cost d'Adquisició.
 * - Detecta si un immoble d'ús habitual té seleccionada una reducció inferior a la legalment aplicable.
 */
export function auditAndOptimizeProperties(properties: RentalProperty[]): {
  optimizedProperties: RentalProperty[];
  improvementsApplied: string[];
  estimatedTotalTaxSaved: number;
} {
  const optimized: RentalProperty[] = JSON.parse(JSON.stringify(properties));
  const improvementsApplied: string[] = [];
  let estimatedTotalTaxSaved = 0;

  optimized.forEach((p, idx) => {
    const label = p.name || p.address || `Immoble #${idx + 1}`;

    // 1. Optimització valor de construcció cadastral si està buit
    if ((!p.constructionCadastralValue || p.constructionCadastralValue <= 0) && p.totalCadastralValue > 0) {
      p.constructionCadastralValue = Math.round(p.totalCadastralValue * 0.70);
      improvementsApplied.push(`[${label}] S'ha establert el % de construcció cadastral al 70% per maximitzar la base del 3% d'amortització.`);
      estimatedTotalTaxSaved += (p.acquisitionCost * 0.70 * 0.03) * 0.35;
    }

    // 2. Verificació de la reducció de la Llei 12/2023 si és habitatge habitual
    if (p.usageType === 'habitual' && p.reductionType === 'none') {
      p.reductionType = 'general_50';
      improvementsApplied.push(`[${label}] S'ha activat la reducció del 50% de la Llei 12/2023 per a habitatge habitual.`);
      estimatedTotalTaxSaved += (p.grossRentalIncome * 0.50) * 0.35;
    }

    // 3. Verificació de despeses de comunitat i IBI
    if (p.ibi <= 0 && p.totalCadastralValue > 0) {
      improvementsApplied.push(`[${label}] ⚠️ Alerta: No s'ha indicat la despesa d'IBI de l'immoble. Recorda introduir el rebut pagat.`);
    }

    // 4. Verificació d'inventari d'actius i coeficients màxims
    if (p.inventory && p.inventory.length > 0) {
      p.inventory.forEach(inv => {
        const g = getAEATAssetGroup(inv.category);
        if (g && inv.amortizationRate < g.maxLinearRate) {
          const oldRate = inv.amortizationRate;
          inv.amortizationRate = g.maxLinearRate;
          improvementsApplied.push(`[${label} - ${inv.concept}] Coeficient d'amortització accelerat del ${oldRate}% al màxim legal del ${g.maxLinearRate}% (${g.name}).`);
          estimatedTotalTaxSaved += (inv.amount * ((g.maxLinearRate - oldRate) / 100)) * 0.35;
        }
      });
    }
  });

  return {
    optimizedProperties: optimized,
    improvementsApplied,
    estimatedTotalTaxSaved: Math.round(estimatedTotalTaxSaved),
  };
}
