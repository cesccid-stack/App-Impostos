/**
 * @module fiscal/advisor-engine
 * Assistent d'Estalvi i Planificació Fiscal (Fiscal Advisor).
 * Audita la declaració i calcula oportunitats d'optimització fiscal en temps real,
 * incloent Tax-Loss Harvesting, Impost de Patrimoni i control de models informatius.
 */

import type { DeclaracionData, FiscalResult } from '../types.ts';
import { calculateIRPF } from './irpf.ts';
import { PENSION_PLAN_LIMIT, DONATION_FIRST_TIER, DONATION_FIRST_TIER_RATE } from './constants.ts';

export interface FiscalAdviceItem {
  id: string;
  category: 'pension' | 'donations' | 'savings_gains' | 'real_estate' | 'catalan' | 'energy' | 'joint' | 'wealth' | 'foreign';
  title: string;
  badge: string;
  badgeType: 'success' | 'warning' | 'info' | 'primary';
  potentialSavingsEUR: number;
  description: string;
  actionHint: string;
  isApplied: boolean;
}

export interface FiscalAdvisorAudit {
  marginalGeneralRate: number;      // % Tipus marginal general (ex: 35%)
  marginalSavingsRate: number;      // % Tipus marginal estalvi (ex: 21%)
  effectiveRate: number;            // % Tipus mitjà efectiu
  totalPotentialSavings: number;    // Estalvi total acumulable (€)
  adviceList: FiscalAdviceItem[];
}

/**
 * Executa l'auditoria fiscal completa sobre les dades actuals.
 */
export function auditTaxReturn(data: DeclaracionData, currentResult: FiscalResult): FiscalAdvisorAudit {
  const adviceList: FiscalAdviceItem[] = [];

  // 1. Càlcul del Tipus Marginal General
  // Simulem afegir 100€ a la base general
  const simDataGeneral = JSON.parse(JSON.stringify(data)) as DeclaracionData;
  if (!simDataGeneral.workIncome.employers || simDataGeneral.workIncome.employers.length === 0) {
    simDataGeneral.workIncome.employers = [{
      id: 'sim', name: 'Sim', grossSalary: 100, inKind: 0, withholdings: 0, socialSecurity: 0, dietsIncome: 0, dietsDays: 0, mileageIncome: 0, mileageKm: 0
    }];
  } else {
    simDataGeneral.workIncome.employers[0].grossSalary += 100;
  }
  const simResultGeneral = calculateIRPF(simDataGeneral);
  const marginalGeneralRate = Math.max(0, Math.round(((simResultGeneral.netTax - currentResult.netTax) / 100) * 1000) / 10);

  // 2. Càlcul del Tipus Marginal de l'Estalvi
  const simDataSavings = JSON.parse(JSON.stringify(data)) as DeclaracionData;
  simDataSavings.capitalIncome.interests = (simDataSavings.capitalIncome.interests || 0) + 100;
  const simResultSavings = calculateIRPF(simDataSavings);
  const marginalSavingsRate = Math.max(0, Math.round(((simResultSavings.netTax - currentResult.netTax) / 100) * 1000) / 10);

  const effectiveRate = currentResult.generalBase > 0 
    ? Math.round((currentResult.netTax / (currentResult.generalBase + currentResult.savingsBase)) * 1000) / 10
    : 0;

  // ── AUDITORIA 1: Pla de Pensions Individual ──
  const currentPension = (data.deductions?.pensionPlanContributions || 0) + (data.workIncome?.pensionContributions || 0);
  const remainingPensionLimit = Math.max(0, PENSION_PLAN_LIMIT - currentPension);

  if (remainingPensionLimit > 0 && currentResult.liquidableGeneralBase > 0) {
    const simPensionData = JSON.parse(JSON.stringify(data)) as DeclaracionData;
    simPensionData.deductions.pensionPlanContributions = (simPensionData.deductions.pensionPlanContributions || 0) + remainingPensionLimit;
    const simPensionRes = calculateIRPF(simPensionData);
    const pensionSavings = Math.max(0, currentResult.netTax - simPensionRes.netTax);

    if (pensionSavings > 5) {
      adviceList.push({
        id: 'pension_individual',
        category: 'pension',
        title: 'Maximitzar Pla de Pensions Individual',
        badge: `Estalvi fins a ${pensionSavings.toFixed(2)} €`,
        badgeType: 'success',
        potentialSavingsEUR: pensionSavings,
        description: `Pots aportar encara ${remainingPensionLimit.toFixed(2)} € al teu pla de pensions abans del 31 de desembre. Atès el teu tipus marginal del ${marginalGeneralRate}%, cada 100 € aportats et fan estalviar ${marginalGeneralRate} € en impostos.`,
        actionHint: `Aportar ${remainingPensionLimit.toFixed(2)} € al teu pla de pensions.`,
        isApplied: false,
      });
    }
  }

  // ── AUDITORIA 2: Donatius Llei 49/2002 (80% primers 250€) ──
  const totalDonations = (data.deductions?.donations || []).reduce((s, d) => s + (d.amount || 0), 0);
  if (totalDonations < DONATION_FIRST_TIER) {
    const diffToTier = DONATION_FIRST_TIER - totalDonations;
    const donationDeduction = diffToTier * DONATION_FIRST_TIER_RATE; // 80%

    adviceList.push({
      id: 'donations_first_tier',
      category: 'donations',
      title: 'Tram Bonificat de Donatius (80% de Deducció)',
      badge: `Deducció del 80%`,
      badgeType: 'success',
      potentialSavingsEUR: donationDeduction,
      description: `La Llei 49/2002 permet deduir el 80% dels primers 250 € donats a ONGs, universitats o entitats sense ànim de lucre. Si aportes ${diffToTier.toFixed(2)} € més, hisenda et tornarà ${donationDeduction.toFixed(2)} € (cost net real per a tu: només ${(diffToTier - donationDeduction).toFixed(2)} €).`,
      actionHint: `Realitzar un donatiu de ${diffToTier.toFixed(2)} € a una ONG o entitat d'utilitat pública.`,
      isApplied: false,
    });
  }

  // ── AUDITORIA 3: Tax-Loss Harvesting de Borsa i Cripto ──
  if (currentResult.savingsBase > 300) {
    const estimatedSavingsHarvest = currentResult.savingsTax;
    adviceList.push({
      id: 'tax_loss_harvesting',
      category: 'savings_gains',
      title: 'Tax-Loss Harvesting: Redueix l\'Impost de l\'Estalvi a 0 €',
      badge: `Estalvi fins a ${estimatedSavingsHarvest.toFixed(2)} €`,
      badgeType: 'success',
      potentialSavingsEUR: estimatedSavingsHarvest,
      description: `Tens una base de l'estalvi positiva de ${currentResult.savingsBase.toFixed(2)} € per la qual pagues ${estimatedSavingsHarvest.toFixed(2)} € d'impostos. Si vens actius de borsa o criptomonedes que estiguin en pèrdues abans del 31 de desembre, compensaràs el 100% d'aquest impost.`,
      actionHint: `Obre la pestanya "Trading & Backtesting" i revisa l'algorisme de Tax-Loss Harvesting.`,
      isApplied: false,
    });
  }

  // ── AUDITORIA 4: Lloguer d'Habitatge Habitual a Catalunya ──
  const age = data.personal?.age || 35;
  const isTenant = data.deductions?.catalanRentalDeduction;
  if (!isTenant && age <= 32 && currentResult.generalBase <= 20000) {
    adviceList.push({
      id: 'catalan_rental',
      category: 'catalan',
      title: 'Deducció per Lloguer d\'Habitatge Habitual (Catalunya)',
      badge: `Fins a 300,00 €`,
      badgeType: 'warning',
      potentialSavingsEUR: 300,
      description: `Si vius de lloguer i tens 32 anys o menys (o estàs a l'atur), pots deduir el 10% del que pagues de lloguer fins a un màxim de 300 € (o 600 € per família nombrosa/monoparental).`,
      actionHint: `Activa la casella de deducció de lloguer de Catalunya a la pestanya Deduccions.`,
      isApplied: false,
    });
  }

  // ── AUDITORIA 5: Préstecs AGAUR Màster/Doctorat ──
  if (!data.deductions?.catalanAgaurMasterLoanInterests || data.deductions.catalanAgaurMasterLoanInterests === 0) {
    adviceList.push({
      id: 'catalan_agaur',
      category: 'catalan',
      title: 'Interessos de Préstecs AGAUR Màster / Doctorat',
      badge: `100% deduïble`,
      badgeType: 'info',
      potentialSavingsEUR: 100,
      description: `A Catalunya és deduïble el 100% dels interessos pagats per préstecs concedits per l'AGAUR per a estudis universitaris de màster i de doctorat.`,
      actionHint: `Introdueix els interessos financers de l'AGAUR si en vas pagar durant l'exercici.`,
      isApplied: false,
    });
  }

  // ── AUDITORIA 6: Immobles i Despeses de Reparació (Control 4 Anys) ──
  let totalPendingRepairs = 0;
  (data.properties || []).forEach(p => {
    totalPendingRepairs += p.pendingRepairsPreviousYears || 0;
  });

  if (totalPendingRepairs > 0) {
    adviceList.push({
      id: 'real_estate_repairs_carryover',
      category: 'real_estate',
      title: 'Seguiment de Despeses de Reparació Pendents d\'Immobles',
      badge: `Pendent: ${totalPendingRepairs.toFixed(2)} €`,
      badgeType: 'warning',
      potentialSavingsEUR: totalPendingRepairs * (marginalGeneralRate / 100),
      description: `Tens ${totalPendingRepairs.toFixed(2)} € de despeses de reparació/conservació d'immobles pendents d'exercicis anteriors. Recorda que l'Art. 23.1.a LIRPF estableix un límit màxim de 4 exercicis per compensar-les abans que caduquin.`,
      actionHint: `Assegura't de deduir-les contra els ingressos de lloguer d'aquest any o planifica ingressos suficients.`,
      isApplied: true,
    });
  }

  // ── AUDITORIA 7: Eficiència Energètica en Habitatge ──
  if (!data.deductions?.energyEfficiencyType || data.deductions.energyEfficiencyType === 'none') {
    adviceList.push({
      id: 'energy_efficiency',
      category: 'energy',
      title: 'Deduccions per Obres d\'Eficiència Energètica (20% - 60%)',
      badge: `Fins a 3.000 €`,
      badgeType: 'info',
      potentialSavingsEUR: 1000,
      description: `Si has realitzat obres per reduir la demanda de calefacció/refrigeració (-7%) o reduir el consum d'energia primària no renovable (-30%) amb certificat energètic, pots deduir entre el 20% i el 60% de les obres.`,
      actionHint: `Revisa si disposes de certificats d'eficiència energètica abans i després de la reforma.`,
      isApplied: false,
    });
  }

  const totalPotentialSavings = adviceList
    .filter(a => !a.isApplied)
    .reduce((sum, a) => sum + a.potentialSavingsEUR, 0);

  return {
    marginalGeneralRate,
    marginalSavingsRate,
    effectiveRate,
    totalPotentialSavings,
    adviceList,
  };
}
