/**
 * @module fiscal/iva-integration
 * Motor d'Integració i Sincronització Bidireccional de l'IVA amb:
 * 1. Activitats Econòmiques (Autònoms en Estimació Directa / IRPF).
 * 2. Gestió d'Immobles Arrendats (Arrendaments Comercials, Turístics i Prorrata per Habitatge).
 * 3. Gestió Patrimonial (Impost sobre el Patrimoni Model 714 i Béns d'Inversió).
 */

import type { DeclaracionData } from '../types.ts';
import type { 
  IVAData, 
  IVAInvoiceIssued, 
  IVAInvoiceReceived, 
  IVABienInversion, 
  FiscalQuarter,
  Model303QuarterResult
} from '../types-iva.ts';
import { calculateAllQuarters } from './iva-engine.ts';

/**
 * Sincronitza les dades d'Activitats Econòmiques (Autònoms) cap al Mòdul d'IVA.
 * Genera o actualitza factures expedides i rebudes trimestrals a partir dels ingressos i despeses declarats.
 */
export function syncActivitiesToIVA(data: DeclaracionData): {
  addedIssued: number;
  addedReceived: number;
  updatedIVA: IVAData;
} {
  const currentIVA: IVAData = data.iva ? JSON.parse(JSON.stringify(data.iva)) : initializeEmptyIVAData();
  const act = data.activities;
  const year = data.year || 2024;

  if (!act) {
    return { addedIssued: 0, addedReceived: 0, updatedIVA: currentIVA };
  }

  // Eliminar factures d'activitat prèviament auto-generades
  currentIVA.issuedInvoices = currentIVA.issuedInvoices.filter(i => !i.id.startsWith('auto_act_'));
  currentIVA.receivedInvoices = currentIVA.receivedInvoices.filter(i => !i.id.startsWith('auto_act_'));

  const quarters: FiscalQuarter[] = ['1T', '2T', '3T', '4T'];
  let addedIssued = 0;
  let addedReceived = 0;

  // 1. Distribuir ingressos de l'activitat en 4 trimestres
  if (act.income > 0) {
    const qIncome = act.income / 4;
    const withhRate = act.income > 0 && act.withholdings > 0 ? (act.withholdings / act.income) * 100 : 15;
    const effectiveWithhRate = withhRate >= 14 ? 15 : (withhRate >= 6 ? 7 : 0);

    for (let idx = 0; idx < quarters.length; idx++) {
      const q = quarters[idx];
      const month = (idx * 3) + 3;
      const monthStr = month < 10 ? `0${month}` : `${month}`;
      const base = Math.round(qIncome * 100) / 100;
      const vatAmount = Math.round(base * 0.21 * 100) / 100;
      const withhAmount = Math.round(base * (effectiveWithhRate / 100) * 100) / 100;

      const newInv: IVAInvoiceIssued = {
        id: `auto_act_issued_${q}`,
        quarter: q,
        invoiceNumber: `FAC-${year}-${q}-001`,
        date: `${year}-${monthStr}-15`,
        clientName: 'Clients Activitat Professional',
        clientNif: 'B-88997766',
        concept: 'Serveis professionals d\'activitat econòmica',
        taxableBase: base,
        vatRate: 21,
        vatAmount: vatAmount,
        withholdingRate: effectiveWithhRate as any,
        withholdingAmount: withhAmount,
        totalInvoice: base + vatAmount - withhAmount,
        category: 'activity_service',
        notes: 'Generat automàticament des del mòdul d\'Activitats Econòmiques',
      };

      currentIVA.issuedInvoices.push(newInv);
      addedIssued++;
    }
  }

  // 2. Distribuir despeses de l'activitat en 4 trimestres
  if (act.expenses > 0) {
    const qExpense = act.expenses / 4;

    for (let idx = 0; idx < quarters.length; idx++) {
      const q = quarters[idx];
      const month = (idx * 3) + 2;
      const monthStr = month < 10 ? `0${month}` : `${month}`;
      const base = Math.round(qExpense * 100) / 100;
      const vatAmount = Math.round(base * 0.21 * 100) / 100;

      const newRec: IVAInvoiceReceived = {
        id: `auto_act_received_${q}`,
        quarter: q,
        invoiceNumber: `EXP-${year}-${q}-088`,
        date: `${year}-${monthStr}-20`,
        supplierName: 'Proveïdors de Serveis i Subministraments',
        supplierNif: 'A-28001122',
        concept: 'Despeses d\'explotació i serveis necessaris per a l\'activitat',
        taxableBase: base,
        vatRate: 21,
        vatAmount: vatAmount,
        deductiblePercentage: 100,
        deductibleVatAmount: vatAmount,
        totalInvoice: base + vatAmount,
        category: 'activity_expense',
        notes: 'Generat automàticament des del mòdul d\'Activitats Econòmiques',
      };

      currentIVA.receivedInvoices.push(newRec);
      addedReceived++;
    }
  }

  // Recalcular trimestres
  const { quarters: updatedQuarters } = calculateAllQuarters(currentIVA, year);
  currentIVA.quarters = updatedQuarters;

  return { addedIssued, addedReceived, updatedIVA: currentIVA };
}

/**
 * Sincronitza les dades del Llibre de Factures d'IVA cap a Activitats Econòmiques (IRPF).
 * Actualitza ingressos, despeses i retencions a la declaració d'IRPF.
 */
export function syncIVAToActivities(data: DeclaracionData): {
  totalBaseIncome: number;
  totalBaseExpenses: number;
  totalWithholdings: number;
} {
  const iva = data.iva;
  if (!iva) {
    return { totalBaseIncome: 0, totalBaseExpenses: 0, totalWithholdings: 0 };
  }

  // Sumar bases de factures emeses d'activitat
  const actIssued = (iva.issuedInvoices || []).filter(
    i => i.category === 'activity_service' || i.category === 'activity_goods'
  );
  const totalBaseIncome = actIssued.reduce((s, i) => s + (i.taxableBase || 0), 0);
  const totalWithholdings = actIssued.reduce((s, i) => s + (i.withholdingAmount || 0), 0);

  // Sumar bases de despeses d'activitat (amb IVA no deduïble si n'hi ha)
  const actReceived = (iva.receivedInvoices || []).filter(
    i => i.category === 'activity_expense' || i.category === 'activity_supplies' || i.category === 'professional_services' || i.category === 'vehicle_expense'
  );
  const totalBaseExpenses = actReceived.reduce((s, i) => {
    const base = i.taxableBase || 0;
    const vat = i.vatAmount || (base * ((i.vatRate || 0) / 100));
    const dedVat = i.deductibleVatAmount !== undefined ? i.deductibleVatAmount : vat;
    const nonDeductibleVat = Math.max(0, vat - dedVat);
    // En IRPF, l'IVA no deduïble forma part de la despesa deduïble
    return s + base + nonDeductibleVat;
  }, 0);

  return {
    totalBaseIncome: Math.round(totalBaseIncome * 100) / 100,
    totalBaseExpenses: Math.round(totalBaseExpenses * 100) / 100,
    totalWithholdings: Math.round(totalWithholdings * 100) / 100,
  };
}

/**
 * Sincronitza la cartera d'Immobles (`properties`) amb el Mòdul d'IVA.
 * - Detecta locals comercials, naus, oficines i genera factures periòdiques (21% IVA + 19% Retenció IRPF).
 * - Detecta lloguers turístics amb serveis (10% IVA).
 * - Identifica lloguers d'habitatge habitual (exempts Art. 20.Uno.23è) i els computa per a la regla de prorrata.
 * - Sincronitza l'inventari d'actius dels immobles cap a Béns d'Inversió d'IVA.
 */
export function syncPropertiesToIVA(data: DeclaracionData): {
  addedCommercialRentals: number;
  addedTouristRentals: number;
  addedExemptRentals: number;
  addedInvestmentAssets: number;
  updatedIVA: IVAData;
} {
  const currentIVA: IVAData = data.iva ? JSON.parse(JSON.stringify(data.iva)) : initializeEmptyIVAData();
  const properties = data.properties || [];
  const year = data.year || 2024;

  // Netejar factures d'immobles generades automàticament
  currentIVA.issuedInvoices = currentIVA.issuedInvoices.filter(i => !i.id.startsWith('auto_prop_'));
  currentIVA.investmentAssets = currentIVA.investmentAssets.filter(b => !b.id.startsWith('auto_prop_inv_'));

  const quarters: FiscalQuarter[] = ['1T', '2T', '3T', '4T'];
  let addedCommercialRentals = 0;
  let addedTouristRentals = 0;
  let addedExemptRentals = 0;
  let addedInvestmentAssets = 0;

  for (const prop of properties) {
    const isCommercial = prop.usageType === 'commercial' || prop.name?.toLowerCase().includes('local') || prop.name?.toLowerCase().includes('oficina') || prop.name?.toLowerCase().includes('nau');
    const isTourist = prop.usageType === 'tourist';
    const isResidential = prop.usageType === 'habitual' || prop.usageType === 'temporary';

    const annualIncome = prop.grossRentalIncome || 0;
    const tenantNif = (prop.tenantNIFs && prop.tenantNIFs.length > 0) ? prop.tenantNIFs[0] : 'B-12345678';

    if (annualIncome > 0) {
      const qIncome = annualIncome / 4;

      for (let idx = 0; idx < quarters.length; idx++) {
        const q = quarters[idx];
        const month = (idx * 3) + 1;
        const monthStr = month < 10 ? `0${month}` : `${month}`;
        const base = Math.round(qIncome * 100) / 100;

        if (isCommercial) {
          // Arrendament comercial: IVA 21% + Retenció IRPF 19%
          const vatAmount = Math.round(base * 0.21 * 100) / 100;
          const withhAmount = Math.round(base * 0.19 * 100) / 100;

          currentIVA.issuedInvoices.push({
            id: `auto_prop_comm_${prop.id}_${q}`,
            quarter: q,
            invoiceNumber: `LLOG-${prop.id.substring(0, 4)}-${year}-${q}`,
            date: `${year}-${monthStr}-01`,
            clientName: `Llogater ${prop.name}`,
            clientNif: tenantNif,
            concept: `Arrendament de local comercial / immoble d'ús terciari - ${prop.name}`,
            taxableBase: base,
            vatRate: 21,
            vatAmount: vatAmount,
            withholdingRate: 19,
            withholdingAmount: withhAmount,
            totalInvoice: base + vatAmount - withhAmount,
            category: 'property_commercial_rental',
            linkedEntityId: prop.id,
            notes: `Immoble ${prop.address || prop.name} (Cadastre: ${prop.cadastralReference || 'N/A'})`,
          });
          addedCommercialRentals++;
        } else if (isTourist) {
          // Lloguer turístic amb serveis: IVA 10%
          const vatAmount = Math.round(base * 0.10 * 100) / 100;

          currentIVA.issuedInvoices.push({
            id: `auto_prop_tour_${prop.id}_${q}`,
            quarter: q,
            invoiceNumber: `TUR-${prop.id.substring(0, 4)}-${year}-${q}`,
            date: `${year}-${monthStr}-01`,
            clientName: `Hostes Turístics - ${prop.name}`,
            clientNif: tenantNif,
            concept: `Allotjament turístic amb prestació de serveis d'hostaleria - ${prop.name}`,
            taxableBase: base,
            vatRate: 10,
            vatAmount: vatAmount,
            totalInvoice: base + vatAmount,
            category: 'property_tourist_rental',
            linkedEntityId: prop.id,
          });
          addedTouristRentals++;
        } else if (isResidential) {
          // Lloguer d'habitatge: Exempt Art. 20.Uno.23è LIVA
          currentIVA.issuedInvoices.push({
            id: `auto_prop_hab_${prop.id}_${q}`,
            quarter: q,
            invoiceNumber: `HAB-${prop.id.substring(0, 4)}-${year}-${q}`,
            date: `${year}-${monthStr}-01`,
            clientName: `Arrendatari Habitatge - ${prop.name}`,
            clientNif: tenantNif,
            concept: `Arrendament d'habitatge per a residència habitual (Exempt Art. 20.Uno.23è LIVA) - ${prop.name}`,
            taxableBase: base,
            vatRate: 0,
            vatAmount: 0,
            totalInvoice: base,
            category: 'property_exempt_rental',
            linkedEntityId: prop.id,
            notes: 'exempt_art20',
          });
          addedExemptRentals++;
        }
      }
    }

    // Sincronitzar inventari com a Béns d'Inversió si l'import > 3.005,06 €
    if (prop.inventory && prop.inventory.length > 0) {
      for (const item of prop.inventory) {
        if (item.amount >= 3000) {
          const vatPaid = Math.round(item.amount * 0.21 * 100) / 100;
          const bien: IVABienInversion = {
            id: `auto_prop_inv_${item.id}`,
            description: `${item.concept} (${prop.name})`,
            assetType: item.category === 'group_1_improvements_3' ? 'real_estate' : 'furniture',
            acquisitionDate: item.acquisitionDate || `${year}-01-15`,
            startDate: item.acquisitionDate || `${year}-01-15`,
            taxableBase: item.amount,
            vatRate: 21,
            totalVatPaid: vatPaid,
            initialDeductionPercentage: 100,
            initialDeductedVat: vatPaid,
            regularizationYears: item.category === 'group_1_improvements_3' ? 10 : 5,
            regularizations: [],
            status: item.status === 'disposed' ? 'disposed' : 'active',
            linkedPropertyId: prop.id,
          };
          currentIVA.investmentAssets.push(bien);
          addedInvestmentAssets++;
        }
      }
    }
  }

  // Si hi ha lloguers exempts d'habitatge i activitats comercials alhora, activar prorrata
  if (addedExemptRentals > 0 && (addedCommercialRentals > 0 || currentIVA.issuedInvoices.some(i => i.vatRate > 0))) {
    currentIVA.config.hasProrrata = true;
    currentIVA.config.prorrata.isRegulatedAutomatically = true;
  }

  // Recalcular trimestres
  const { quarters: updatedQuarters } = calculateAllQuarters(currentIVA, year);
  currentIVA.quarters = updatedQuarters;

  return {
    addedCommercialRentals,
    addedTouristRentals,
    addedExemptRentals,
    addedInvestmentAssets,
    updatedIVA: currentIVA,
  };
}

/**
 * Sincronitza el Mòdul d'IVA amb la Gestió Patrimonial (Model 714 - Impost sobre el Patrimoni).
 * Integra els crèdits/deutes tributaris d'IVA i vincula els Béns d'Inversió.
 */
export function syncWealthToIVA(data: DeclaracionData): {
  syncedAssetsCount: number;
  totalVatDebtOrCredit: number;
} {
  const iva = data.iva;
  if (!iva) {
    return { syncedAssetsCount: 0, totalVatDebtOrCredit: 0 };
  }

  const { quarters } = calculateAllQuarters(iva, data.year || 2024);
  const q4 = quarters['4T'];
  const totalVatDebtOrCredit = q4.resultadoLiquidacion; // Positiu = a ingressar (deute), Negatiu = a compensar/tornar (crèdit)

  const syncedAssetsCount = (iva.investmentAssets || []).length;

  return {
    syncedAssetsCount,
    totalVatDebtOrCredit,
  };
}

/**
 * Inicialitza un estat d'IVA buit i estructurat.
 */
export function initializeEmptyIVAData(): IVAData {
  return {
    config: {
      regime: 'general',
      settlementFrequency: 'quarterly',
      isREDEME: false,
      hasProrrata: false,
      prorrata: {
        type: 'general',
        provisionalPercentage: 100,
        definitivePercentage: 100,
        isRegulatedAutomatically: true,
        totalOperationsWithDeduction: 0,
        totalOperationsVolume: 0,
      },
      initialPendingCarryover: 0,
    },
    issuedInvoices: [],
    receivedInvoices: [],
    investmentAssets: [],
    quarters: {
      '1T': createEmptyQuarterResult('1T'),
      '2T': createEmptyQuarterResult('2T'),
      '3T': createEmptyQuarterResult('3T'),
      '4T': createEmptyQuarterResult('4T'),
    },
  };
}

function createEmptyQuarterResult(quarter: FiscalQuarter): Model303QuarterResult {
  return {
    quarter,
    year: 2024,
    base21: 0, cuota21: 0,
    base10: 0, cuota10: 0,
    base4: 0, cuota4: 0,
    base0: 0, cuota0: 0,
    modBase: 0, modCuota: 0,
    recargoBases: 0, recargoCuotas: 0,
    intraEuBase: 0, intraEuCuota: 0,
    ispBase: 0, ispCuota: 0,
    totalDevengado: 0,
    deducibleCorrienteBase: 0, deducibleCorrienteCuota: 0,
    deducibleInversionBase: 0, deducibleInversionCuota: 0,
    deducibleImportacionesBase: 0, deducibleImportacionesCuota: 0,
    deducibleIntraEuBase: 0, deducibleIntraEuCuota: 0,
    rectificacionDeducciones: 0,
    regularizacionBienesInversion: 0,
    regularizacionProrrata: 0,
    totalDeducible: 0,
    diferencia: 0,
    porcentajeAtribuibleEstado: 100,
    tributacionEstado: 0,
    cuotasCompensarPeriodosAnteriores: 0,
    resultadoLiquidacion: 0,
    status: 'draft',
    paymentType: 'zero',
  };
}
