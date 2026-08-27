/**
 * @module fiscal/tax-explainer-engine
 * Motor d'Anàlisi Didàctica, Desglossament Integral i Explicador en Llenguatge Planer.
 * Transforma declaracions de renda extremadament complexes en una narrativa visual,
 * intuïtiva i comprensible pas a pas per a qualsevol contribuent.
 */

import { calculateIRPF } from './irpf.ts';
import { calculateAllProperties } from './real-estate-engine.ts';
import { exactAdd, exactSub } from '../utils/exact-math.ts';
import type { DeclaracionData, FiscalResult } from '../types.ts';

function round2(num: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export interface TaxFlowStep {
  id: string;
  stepNumber: number;
  title: string;
  category: 'income' | 'deduction' | 'base' | 'tax' | 'credit' | 'withholding' | 'final';
  amount: number;
  deltaAmount: number;
  runningTotal: number;
  percentageOfGross: number;
  aeatBoxes: string[];
  lawArticle: string;
  simpleExplanation: string;
  technicalDetails: string;
  badgeType: 'neutral' | 'success' | 'warning' | 'error' | 'info';
}

export interface TaxDriverInsight {
  title: string;
  description: string;
  impactAmount: number;
  impactType: 'increase_refund' | 'increase_tax' | 'neutral';
  importance: 'high' | 'medium' | 'low';
  icon: string;
  recommendation?: string;
}

export interface BracketDetail {
  bracketIndex: number;
  rangeLabel: string;
  limitMin: number;
  limitMax: number;
  applicableRatePercent: number;
  taxedAmountInBracket: number;
  taxPaidInBracket: number;
  isCurrentBracket: boolean;
}

export interface TaxExplainerReport {
  year: number;
  totalGrossIncome: number;
  totalNetIncome: number;
  totalReductions: number;
  liquidableGeneralBase: number;
  liquidableSavingsBase: number;
  grossTax: number;
  totalTaxCreditsAndDeductions: number;
  netTax: number;
  totalWithholdings: number;
  finalResult: number;
  isRefund: boolean;
  overallEffectiveRate: number;
  marginalRateGeneral: number;
  marginalRateSavings: number;
  eurosToNextBracket: number;
  nextBracketRate: number;
  plainLanguageSummary: string[];
  keyDrivers: TaxDriverInsight[];
  flowSteps: TaxFlowStep[];
  generalBracketBreakdown: BracketDetail[];
  savingsBracketBreakdown: BracketDetail[];
  taxBreakdownPie: {
    label: string;
    amount: number;
    color: string;
    percentage: number;
  }[];
  efficiencyScore: number;
  unclaimedSavingsOpportunities: {
    title: string;
    estimatedSavings: number;
    actionLink: string;
    reason: string;
  }[];
}

/**
 * Genera l'informe integral d'explicació didàctica i visual de la declaració de Renda.
 */
export function explainTaxReturn(data: DeclaracionData, result?: FiscalResult): TaxExplainerReport {
  const res = result || calculateIRPF(data);
  const year = data.year || 2024;

  // 1. Desglossament d'ingressos bruts
  const workGross = (data.workIncome?.employers || []).reduce((s, e) => s + (e.grossSalary || 0) + (e.inKind || 0), 0);
  const workSS = (data.workIncome?.employers || []).reduce((s, e) => s + (e.socialSecurity || 0), 0);
  const workWithholdings = (data.workIncome?.employers || []).reduce((s, e) => s + (e.withholdings || 0), 0);

  const propSummary = calculateAllProperties(data.properties || [], year);
  const realEstateGross = propSummary.totalGrossIncome;
  const realEstateAmortization = propSummary.totalAmortization;
  const realEstateExpenses = propSummary.totalExpenses;

  const capitalInterests = data.capitalIncome?.interests || 0;
  const capitalDividends = (data.capitalIncome?.dividends || 0) + (data.capitalIncome?.foreignDividends || 0);
  const capitalWithholdings = data.capitalIncome?.mobiliaryWithholdings || 0;

  const activityGross = data.activities?.income || 0;
  const activityExpenses = data.activities?.expenses || 0;

  const gainsPositive = (data.gains?.items || [])
    .filter(i => (i.transferValue - i.acquisitionValue - i.expenses) > 0)
    .reduce((s, i) => s + (i.transferValue - i.acquisitionValue - i.expenses), 0);
  const gainsNegative = (data.gains?.items || [])
    .filter(i => (i.transferValue - i.acquisitionValue - i.expenses) < 0)
    .reduce((s, i) => s + Math.abs(i.transferValue - i.acquisitionValue - i.expenses), 0);

  const totalGrossIncome = exactAdd(
    exactAdd(workGross, realEstateGross),
    exactAdd(exactAdd(capitalInterests, capitalDividends), exactAdd(activityGross, gainsPositive))
  );

  // 2. Reduccions i Bases
  const totalReductions = res.totalReductions || 0;
  const netTax = res.netTax || 0;
  const totalWithholdings = res.totalWithholdings || 0;
  const finalResult = res.result;
  const isRefund = finalResult < 0;

  const overallEffectiveRate = totalGrossIncome > 0 ? round2((netTax / totalGrossIncome) * 100, 2) : 0;

  // 3. Càlcul de Trams i Tipus Marginal (Estatal + Autonòmic combinats aprox)
  const combinedGeneralBrackets = [
    { min: 0, max: 12450, rate: 19.0 },
    { min: 12450, max: 20200, rate: 24.0 },
    { min: 20200, max: 35200, rate: 30.0 },
    { min: 35200, max: 60000, rate: 37.0 },
    { min: 60000, max: 300000, rate: 45.0 },
    { min: 300000, max: Infinity, rate: 47.0 },
  ];

  let currentBracketIdx = 0;
  let eurosToNextBracket = 0;
  let nextBracketRate = 19.0;
  const generalBracketBreakdown: BracketDetail[] = [];

  let remainingBase = res.liquidableGeneralBase;
  for (let i = 0; i < combinedGeneralBrackets.length; i++) {
    const b = combinedGeneralBrackets[i];
    const bracketSize = b.max - b.min;
    let taxedInBracket = 0;

    if (remainingBase > 0) {
      taxedInBracket = Math.min(remainingBase, bracketSize);
      remainingBase -= taxedInBracket;
      currentBracketIdx = i;
    }

    const isCurrent = (res.liquidableGeneralBase >= b.min && (res.liquidableGeneralBase < b.max || b.max === Infinity));
    if (isCurrent) {
      eurosToNextBracket = b.max === Infinity ? 0 : Math.max(0, b.max - res.liquidableGeneralBase);
      nextBracketRate = i + 1 < combinedGeneralBrackets.length ? combinedGeneralBrackets[i + 1].rate : b.rate;
    }

    generalBracketBreakdown.push({
      bracketIndex: i + 1,
      rangeLabel: b.max === Infinity ? `Més de ${b.min.toLocaleString('es-ES')} €` : `${b.min.toLocaleString('es-ES')} € - ${b.max.toLocaleString('es-ES')} €`,
      limitMin: b.min,
      limitMax: b.max,
      applicableRatePercent: b.rate,
      taxedAmountInBracket: round2(taxedInBracket, 2),
      taxPaidInBracket: round2(taxedInBracket * (b.rate / 100), 2),
      isCurrentBracket: isCurrent,
    });
  }

  const marginalRateGeneral = combinedGeneralBrackets[currentBracketIdx]?.rate || 19.0;

  // Trams de l'Estalvi
  const savingsBrackets = [
    { min: 0, max: 6000, rate: 19.0 },
    { min: 6000, max: 50000, rate: 21.0 },
    { min: 50000, max: 200000, rate: 23.0 },
    { min: 200000, max: 300000, rate: 27.0 },
    { min: 300000, max: Infinity, rate: 28.0 },
  ];
  let remainingSavings = res.liquidableSavingsBase;
  let savingsMarginal = 19.0;
  const savingsBracketBreakdown: BracketDetail[] = [];
  for (let i = 0; i < savingsBrackets.length; i++) {
    const sb = savingsBrackets[i];
    const bSize = sb.max - sb.min;
    let taxedInBracket = 0;
    if (remainingSavings > 0) {
      taxedInBracket = Math.min(remainingSavings, bSize);
      remainingSavings -= taxedInBracket;
      savingsMarginal = sb.rate;
    }
    const isCurrent = (res.liquidableSavingsBase >= sb.min && (res.liquidableSavingsBase < sb.max || sb.max === Infinity));
    savingsBracketBreakdown.push({
      bracketIndex: i + 1,
      rangeLabel: sb.max === Infinity ? `Més de ${sb.min.toLocaleString('es-ES')} €` : `${sb.min.toLocaleString('es-ES')} € - ${sb.max.toLocaleString('es-ES')} €`,
      limitMin: sb.min,
      limitMax: sb.max,
      applicableRatePercent: sb.rate,
      taxedAmountInBracket: round2(taxedInBracket, 2),
      taxPaidInBracket: round2(taxedInBracket * (sb.rate / 100), 2),
      isCurrentBracket: isCurrent,
    });
  }

  // 4. Construcció del Viatge Fiscal en Cascada (Waterfall Steps)
  const flowSteps: TaxFlowStep[] = [];
  let stepCounter = 1;
  let running = 0;

  // Step 1: Ingressos Bruts
  running = totalGrossIncome;
  flowSteps.push({
    id: 'step-gross',
    stepNumber: stepCounter++,
    title: '1. Ingressos Bruts Totals',
    category: 'income',
    amount: totalGrossIncome,
    deltaAmount: totalGrossIncome,
    runningTotal: running,
    percentageOfGross: 100,
    aeatBoxes: ['0003', '0029', '0102', '0180', '0270'],
    lawArticle: 'Art. 17-39 LIRPF',
    simpleExplanation: 'Tots els diners que has generat durant l\'any (salaris, lloguers, dividends, guanys d\'inversions o activitat).',
    technicalDetails: `Treball: ${workGross.toLocaleString('es-ES')}€ | Lloguers: ${realEstateGross.toLocaleString('es-ES')}€ | Capital: ${(capitalInterests + capitalDividends).toLocaleString('es-ES')}€ | Activitats: ${activityGross.toLocaleString('es-ES')}€ | Plusvàlues: ${gainsPositive.toLocaleString('es-ES')}€`,
    badgeType: 'neutral',
  });

  // Step 2: Despeses Deducibles i Amortitzacions
  const totalDeductibleExpenses = exactAdd(exactAdd(workSS, realEstateExpenses), exactAdd(realEstateAmortization, activityExpenses));
  if (totalDeductibleExpenses > 0) {
    running = exactSub(running, totalDeductibleExpenses);
    flowSteps.push({
      id: 'step-expenses',
      stepNumber: stepCounter++,
      title: '2. Despeses Deduïdes & Amortitzacions',
      category: 'deduction',
      amount: totalDeductibleExpenses,
      deltaAmount: -totalDeductibleExpenses,
      runningTotal: running,
      percentageOfGross: totalGrossIncome > 0 ? round2((totalDeductibleExpenses / totalGrossIncome) * 100, 1) : 0,
      aeatBoxes: ['0013', '0105', '0109', '0115', '0191'],
      lawArticle: 'Art. 19, 23, 28 LIRPF',
      simpleExplanation: 'Despeses necessàries per obtenir els teus ingressos que no tributen (Seguretat Social de nòmina, IBI, comunitat i amortització del 3% d\'immobles).',
      technicalDetails: `Seguretat Social: -${workSS.toLocaleString('es-ES')}€ | Despeses Immobles: -${realEstateExpenses.toLocaleString('es-ES')}€ | Amortització 3%: -${realEstateAmortization.toLocaleString('es-ES')}€ | Despeses Activitat: -${activityExpenses.toLocaleString('es-ES')}€`,
      badgeType: 'success',
    });
  }

  // Step 3: Reduccions de Rendiment i Base (Treball, Plans Pensions, Conjunta)
  if (totalReductions > 0 || (res.workIncomeReduction || 0) > 0) {
    const combinedReductions = exactAdd(totalReductions, res.workIncomeReduction || 0);
    running = exactSub(running, combinedReductions);
    flowSteps.push({
      id: 'step-reductions',
      stepNumber: stepCounter++,
      title: '3. Reduccions Legals de la Base',
      category: 'deduction',
      amount: combinedReductions,
      deltaAmount: -combinedReductions,
      runningTotal: Math.max(0, running),
      percentageOfGross: totalGrossIncome > 0 ? round2((combinedReductions / totalGrossIncome) * 100, 1) : 0,
      aeatBoxes: ['0022', '0465', '0500'],
      lawArticle: 'Art. 20, 51, 84 LIRPF',
      simpleExplanation: 'Rebaixes especials que la llei aplica sobre els teus rendiments nets abans de calcular els impostos (per rendes baixes del treball o aportacions a plans de pensions).',
      technicalDetails: `Reducció Rend. Treball: -${(res.workIncomeReduction || 0).toLocaleString('es-ES')}€ | Plans de Pensions: -${(res.pensionReduction || 0).toLocaleString('es-ES')}€ | Altres: -${(totalReductions - (res.pensionReduction || 0)).toLocaleString('es-ES')}€`,
      badgeType: 'success',
    });
  }

  // Step 4: Base Liquidable Sotmesa a Gravamen
  const totalBaseLiquidable = exactAdd(res.liquidableGeneralBase, res.liquidableSavingsBase);
  flowSteps.push({
    id: 'step-base-liquidable',
    stepNumber: stepCounter++,
    title: '4. Base Liquidable (Sobre la que es calcula l\'IRPF)',
    category: 'base',
    amount: totalBaseLiquidable,
    deltaAmount: 0,
    runningTotal: totalBaseLiquidable,
    percentageOfGross: totalGrossIncome > 0 ? round2((totalBaseLiquidable / totalGrossIncome) * 100, 1) : 0,
    aeatBoxes: ['0500', '0510'],
    lawArticle: 'Art. 50-55 LIRPF',
    simpleExplanation: 'La xifra definitiva sobre la qual s\'apliquen les taules de percentatges de l\'IRPF estatal i autonòmic.',
    technicalDetails: `Base General (Salaris, Lloguers, Activitats): ${res.liquidableGeneralBase.toLocaleString('es-ES')}€ | Base Estalvi (Dividends, Borsa, Cripto): ${res.liquidableSavingsBase.toLocaleString('es-ES')}€`,
    badgeType: 'info',
  });

  // Step 5: Quota Íntegra Teòrica (Abans de Mínims i Deduccions)
  const theoreticalGrossTax = res.grossTax;
  flowSteps.push({
    id: 'step-gross-tax',
    stepNumber: stepCounter++,
    title: '5. Quota Íntegra Bruta (Tarifa IRPF)',
    category: 'tax',
    amount: theoreticalGrossTax,
    deltaAmount: theoreticalGrossTax,
    runningTotal: theoreticalGrossTax,
    percentageOfGross: totalGrossIncome > 0 ? round2((theoreticalGrossTax / totalGrossIncome) * 100, 1) : 0,
    aeatBoxes: ['0545', '0546'],
    lawArticle: 'Art. 62-66 LIRPF',
    simpleExplanation: 'L\'import total d\'impost teòric que correspondria pagar aplicant els trams de la renda estatal i catalana sense cap descompte.',
    technicalDetails: `Quota Escala General: ${(res.generalTax || 0).toLocaleString('es-ES')}€ | Quota Escala Estalvi: ${(res.savingsTax || 0).toLocaleString('es-ES')}€`,
    badgeType: 'warning',
  });

  // Step 6: Crèdit per Mínim Personal i Familiar
  const minCredit = res.minimumTaxCredit || 0;
  if (minCredit > 0) {
    flowSteps.push({
      id: 'step-min-credit',
      stepNumber: stepCounter++,
      title: '6. Crèdit Fiscal per Mínim Personal & Familiar',
      category: 'credit',
      amount: minCredit,
      deltaAmount: -minCredit,
      runningTotal: Math.max(0, exactSub(theoreticalGrossTax, minCredit)),
      percentageOfGross: totalGrossIncome > 0 ? round2((minCredit / totalGrossIncome) * 100, 1) : 0,
      aeatBoxes: ['0511', '0512', '0513', '0514'],
      lawArticle: 'Art. 56-61 LIRPF',
      simpleExplanation: 'Els primers diners que necessites per viure (mínim del declarant de 5.550 € més fills/ascendents) no paguen impostos i et rebaixen directament la quota.',
      technicalDetails: `Mínim Personal Total Computat: ${(res.totalMinimum || 5550).toLocaleString('es-ES')}€ | Rebaixa de Quota generada: -${minCredit.toLocaleString('es-ES')}€`,
      badgeType: 'success',
    });
  }

  // Step 7: Deduccions Estatals i Autonòmiques
  const totalDeductions = res.totalDeductions || 0;
  if (totalDeductions > 0) {
    flowSteps.push({
      id: 'step-deductions',
      stepNumber: stepCounter++,
      title: '7. Deduccions Estatals & Autonòmiques (Directes a Quota)',
      category: 'credit',
      amount: totalDeductions,
      deltaAmount: -totalDeductions,
      runningTotal: netTax,
      percentageOfGross: totalGrossIncome > 0 ? round2((totalDeductions / totalGrossIncome) * 100, 1) : 0,
      aeatBoxes: ['0588', '0595', '0600'],
      lawArticle: 'Art. 67-68 LIRPF i Llei CCAA',
      simpleExplanation: 'Descomptes directes euro a euro que es resten del teu impost per donacions, lloguer d\'habitatge habitual, maternitat o quotes sindicals.',
      technicalDetails: `Deduccions Autonòmiques Catalunya: -${(res.catalanDeductionsAmount || 0).toLocaleString('es-ES')}€ | Donatius i Altres Estatals: -${(totalDeductions - (res.catalanDeductionsAmount || 0)).toLocaleString('es-ES')}€`,
      badgeType: 'success',
    });
  }

  const stateTax = Math.max(0, (res.stateGeneralTax || 0) + (res.stateSavingsTax || 0) - (res.stateMinimumTaxCredit || 0));
  const regionalTax = Math.max(0, (res.autonomicGeneralTax || 0) + (res.autonomicSavingsTax || 0) - (res.autonomicMinimumTaxCredit || 0) - (res.catalanDeductionsAmount || 0));

  // Step 8: Quota Líquida Total (El que realment has de pagar d'impostos de l'any)
  flowSteps.push({
    id: 'step-net-tax',
    stepNumber: stepCounter++,
    title: '8. Quota Líquida Total (La teva factura fiscal real)',
    category: 'tax',
    amount: netTax,
    deltaAmount: 0,
    runningTotal: netTax,
    percentageOfGross: totalGrossIncome > 0 ? round2((netTax / totalGrossIncome) * 100, 1) : 0,
    aeatBoxes: ['0595', '0599'],
    lawArticle: 'Art. 69 LIRPF',
    simpleExplanation: 'L\'import total i definitiu que et pertoca contribuir a Hisenda per tot l\'any després d\'aplicar totes les deduccions i mínims.',
    technicalDetails: `Quota Estatal Neta: ${stateTax.toLocaleString('es-ES')}€ | Quota Autonòmica Neta: ${regionalTax.toLocaleString('es-ES')}€ | Tipus Efectiu Global: ${overallEffectiveRate}%`,
    badgeType: 'neutral',
  });

  // Step 9: Retencions i Pagaments Ja Fets per Avançat
  flowSteps.push({
    id: 'step-withholdings',
    stepNumber: stepCounter++,
    title: '9. Retencions i Pagaments Ja Fets Durant l\'Any',
    category: 'withholding',
    amount: totalWithholdings,
    deltaAmount: -totalWithholdings,
    runningTotal: finalResult,
    percentageOfGross: totalGrossIncome > 0 ? round2((totalWithholdings / totalGrossIncome) * 100, 1) : 0,
    aeatBoxes: ['0597', '0606', '0607', '0609'],
    lawArticle: 'Art. 99-101 LIRPF',
    simpleExplanation: 'Els diners que la teva empresa, el teu banc o els teus llogaters ja van enviar a Hisenda cada mes al teu nom per avançat.',
    technicalDetails: `Retencions Nòmines: ${workWithholdings.toLocaleString('es-ES')}€ | Bancs / Dividends: ${capitalWithholdings.toLocaleString('es-ES')}€ | Lloguers / Models Trimestrals: ${(totalWithholdings - workWithholdings - capitalWithholdings).toLocaleString('es-ES')}€`,
    badgeType: 'info',
  });

  // Step 10: Resultat Final Casella 0610
  flowSteps.push({
    id: 'step-final-result',
    stepNumber: stepCounter++,
    title: isRefund ? '10. 🎉 RESULTAT FINAL: A DEVOLVER (Hacienda et torna)' : '10. ↗ RESULTAT FINAL: A INGRESAR (Pendent de pagar)',
    category: 'final',
    amount: Math.abs(finalResult),
    deltaAmount: finalResult,
    runningTotal: finalResult,
    percentageOfGross: totalGrossIncome > 0 ? round2((Math.abs(finalResult) / totalGrossIncome) * 100, 1) : 0,
    aeatBoxes: ['0610'],
    lawArticle: 'Art. 102 LIRPF',
    simpleExplanation: isRefund
      ? `Com que vas pagar ${totalWithholdings.toLocaleString('es-ES')} € en retencions i la teva factura real era de només ${netTax.toLocaleString('es-ES')} €, Hisenda t'ha d'ingressar al teu compte bancari la diferència de ${Math.abs(finalResult).toLocaleString('es-ES')} €.`
      : `Com que la teva factura real és de ${netTax.toLocaleString('es-ES')} € i només et van retenir ${totalWithholdings.toLocaleString('es-ES')} € durant l'any, has d'ingressar a Hisenda la diferència pendent de ${finalResult.toLocaleString('es-ES')} €.`,
    technicalDetails: `Casella 0595 (Quota Líquida ${netTax.toLocaleString('es-ES')}€) - Casella 0609 (Retencions ${totalWithholdings.toLocaleString('es-ES')}€) = Casella 0610 (${finalResult.toLocaleString('es-ES')}€)`,
    badgeType: isRefund ? 'success' : 'error',
  });

  // 5. Narrativa en Llenguatge Planer (Plain-Language Bullet Summary)
  const plainLanguageSummary: string[] = [];

  plainLanguageSummary.push(
    `Has ingressat un total brut de **${totalGrossIncome.toLocaleString('es-ES')} €** provinents de ${[
      workGross > 0 ? `${(data.workIncome?.employers || []).length} pagadors de feina` : null,
      realEstateGross > 0 ? `${(data.properties || []).length} immobles llogats` : null,
      (capitalInterests + capitalDividends) > 0 ? 'inversions/dividends' : null,
      gainsPositive > 0 ? 'venda d\'actius o fons' : null,
      activityGross > 0 ? 'activitat econòmica d\'autònom' : null,
    ].filter(Boolean).join(', ') || 'les teves rendes'}.`
  );

  plainLanguageSummary.push(
    `La teva factura fiscal total (quota líquida real) és de **${netTax.toLocaleString('es-ES')} €**, el que representa un **tipus impositiu real del ${overallEffectiveRate}%** sobre els teus ingressos bruts.`
  );

  if (totalWithholdings > 0) {
    plainLanguageSummary.push(
      `Al llarg de l'any, ja havies avançat a Hisenda **${totalWithholdings.toLocaleString('es-ES')} €** en retencions mensuals de nòmina i pagaments a compte.`
    );
  }

  if (isRefund) {
    plainLanguageSummary.push(
      `**Per què et surt a tornar?** Com que les teves retencions avançades (${totalWithholdings.toLocaleString('es-ES')} €) superen la teva obligació tributària definitiva (${netTax.toLocaleString('es-ES')} €), **Hisenda té l'obligació de transferir-te ${Math.abs(finalResult).toLocaleString('es-ES')} €** al teu compte bancari.`
    );
  } else {
    plainLanguageSummary.push(
      `**Per què et surt a pagar?** Com que les retencions que et van aplicar durant l'any (${totalWithholdings.toLocaleString('es-ES')} €) van ser inferiors al teu impost definitiu calculat (${netTax.toLocaleString('es-ES')} €), **has de liquidar la diferència de ${finalResult.toLocaleString('es-ES')} €**.`
    );
  }

  // 6. Motors Clau (Key Drivers & Insights)
  const keyDrivers: TaxDriverInsight[] = [];

  // Drivers de Treball
  if ((data.workIncome?.employers || []).length > 1) {
    keyDrivers.push({
      title: 'Pluralitat de Pagadors (2 o més empreses)',
      description: 'Tenir diversos pagadors sol provocar que cada empresa retingui a un tram inferior, generant un desajust que augmenta el resultat a pagar a la Renda.',
      impactAmount: workWithholdings,
      impactType: 'increase_tax',
      importance: 'high',
      icon: '👥',
      recommendation: 'Sol·licita a la teva empresa principal un tipus voluntari de retenció IRPF més alt (Model 145) per evitar sorpreses.',
    });
  }

  // Drivers d'Immobles i Amortitzacions
  if (realEstateAmortization > 0) {
    const amortTaxSaving = round2(realEstateAmortization * (marginalRateGeneral / 100), 2);
    keyDrivers.push({
      title: `Amortització AEAT del 3% als teus immobles`,
      description: `Has aplicat ${realEstateAmortization.toLocaleString('es-ES')} € d'amortització fiscal sobre la construcció, reduint la base imposable sense desemborsar diners.`,
      impactAmount: amortTaxSaving,
      impactType: 'increase_refund',
      importance: 'high',
      icon: '🏠',
      recommendation: 'Assegura\'t de conservar les escriptures de compra i els rebuts de l\'IBI per justificar el valor cadastral de construcció.',
    });
  }

  // Drivers de Plans de Pensions
  if ((res.pensionReduction || 0) > 0) {
    const pensionSaving = round2((res.pensionReduction || 0) * (marginalRateGeneral / 100), 2);
    keyDrivers.push({
      title: `Aportació a Plans de Pensions (-${(res.pensionReduction || 0).toLocaleString('es-ES')} €)`,
      description: `T\'ha estalviat directament ${pensionSaving.toLocaleString('es-ES')} € d'impostos gràcies al teu tipus marginal del ${marginalRateGeneral}%.`,
      impactAmount: pensionSaving,
      impactType: 'increase_refund',
      importance: 'medium',
      icon: '🎯',
    });
  }

  // Drivers de Pèrdues Patrimonials Compensades
  if (gainsNegative > 0) {
    keyDrivers.push({
      title: `Compensació de Pèrdues en Inversions (${gainsNegative.toLocaleString('es-ES')} €)`,
      description: `Les pèrdues de borsa o cripto s'han neutralitzat contra guanys de l'exercici i fins al 25% del capital mobiliari, reduint la factura de l'estalvi.`,
      impactAmount: gainsNegative,
      impactType: 'increase_refund',
      importance: 'medium',
      icon: '📉',
    });
  }

  // Drivers de Deduccions Autonòmiques
  if ((res.catalanDeductionsAmount || 0) > 0) {
    keyDrivers.push({
      title: `Deduccions Autonòmiques de Catalunya`,
      description: `Has deduït ${res.catalanDeductionsAmount?.toLocaleString('es-ES')} € directes de la quota autonòmica.`,
      impactAmount: res.catalanDeductionsAmount || 0,
      impactType: 'increase_refund',
      importance: 'medium',
      icon: '🏛️',
    });
  }

  // 7. Oportunitats d'Estalvi No Aprofitades
  const unclaimedSavingsOpportunities = [];
  if (!data.deductions?.pensionPlanContributions || data.deductions.pensionPlanContributions < 1500) {
    const remainingPension = 1500 - (data.deductions?.pensionPlanContributions || 0);
    const estSaving = round2(remainingPension * (marginalRateGeneral / 100), 2);
    unclaimedSavingsOpportunities.push({
      title: 'Aportació Màxima a Plans Individuals (Topall 1.500 €)',
      estimatedSavings: estSaving,
      actionLink: '#/deduccions',
      reason: `Pots aportar fins a ${remainingPension.toLocaleString('es-ES')} € més abans del 31 de desembre per estalviar aproximadament ${estSaving.toLocaleString('es-ES')} € a la Renda.`,
    });
  }

  if (!data.deductions?.donations || data.deductions.donations.length === 0) {
    unclaimedSavingsOpportunities.push({
      title: 'Deducció del 80% per Donatius (Fins a 250 €)',
      estimatedSavings: 200,
      actionLink: '#/deduccions',
      reason: 'Els primers 250 € donats a ONGs tenen una deducció directa del 80% a la quota (recuperes 200 € a la teva Renda).',
    });
  }

  // 8. Distribució en Format Gràfic (Pie Breakdown)
  const taxBreakdownPie = [
    {
      label: 'Diners que et queden lliures (Net)',
      amount: Math.max(0, exactSub(totalGrossIncome, netTax)),
      color: '#10b981',
      percentage: totalGrossIncome > 0 ? round2((Math.max(0, totalGrossIncome - netTax) / totalGrossIncome) * 100, 1) : 100,
    },
    {
      label: 'IRPF Estatal',
      amount: stateTax,
      color: '#6366f1',
      percentage: totalGrossIncome > 0 ? round2((stateTax / totalGrossIncome) * 100, 1) : 0,
    },
    {
      label: 'IRPF Autonòmic (Catalunya)',
      amount: regionalTax,
      color: '#ec4899',
      percentage: totalGrossIncome > 0 ? round2((regionalTax / totalGrossIncome) * 100, 1) : 0,
    },
  ];

  // 9. Eficiència Fiscal (0 - 100)
  let efficiencyScore = 100;
  if (unclaimedSavingsOpportunities.length > 0) efficiencyScore -= (unclaimedSavingsOpportunities.length * 10);
  if (totalGrossIncome > 30000 && (res.totalDeductions || 0) === 0) efficiencyScore -= 15;
  if ((data.properties || []).length > 0 && realEstateAmortization === 0) efficiencyScore -= 20;
  efficiencyScore = Math.max(30, Math.min(100, efficiencyScore));

  return {
    year,
    totalGrossIncome,
    totalNetIncome: exactSub(totalGrossIncome, totalDeductibleExpenses),
    totalReductions,
    liquidableGeneralBase: res.liquidableGeneralBase,
    liquidableSavingsBase: res.liquidableSavingsBase,
    grossTax: theoreticalGrossTax,
    totalTaxCreditsAndDeductions: exactAdd(minCredit, totalDeductions),
    netTax,
    totalWithholdings,
    finalResult,
    isRefund,
    overallEffectiveRate,
    marginalRateGeneral,
    marginalRateSavings: savingsMarginal,
    eurosToNextBracket,
    nextBracketRate,
    plainLanguageSummary,
    keyDrivers,
    flowSteps,
    generalBracketBreakdown,
    savingsBracketBreakdown,
    taxBreakdownPie,
    efficiencyScore,
    unclaimedSavingsOpportunities,
  };
}
