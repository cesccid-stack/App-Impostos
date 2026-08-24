/**
 * @module fiscal/audit-risk-radar
 * Radar de Risc d'Inspecció i Requeriments de l'AEAT (Audit Risk Radar).
 * Avalua la declaració abans de presentar-la i identifica patrons que disparen comprovacions tributàries.
 */

import type { DeclaracionData, FiscalResult } from '../types.ts';

export interface AuditRiskAlert {
  id: string;
  category: 'real_estate' | 'work' | 'gains' | 'deductions' | 'general';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  aeatTriggerReason: string;
  recommendedProof: string; // Documentació legal necessària per a la defensa
}

export interface AuditRiskReport {
  overallRiskScore: number;     // 0 (Molt Segur) a 100 (Risc Elevat d'Inspecció)
  riskLevel: 'low' | 'medium' | 'high';
  alerts: AuditRiskAlert[];
  documentaryChecklist: { documentName: string; section: string; status: 'required' | 'recommended' }[];
}

const riskCache = new WeakMap<DeclaracionData, AuditRiskReport>();

/**
 * Analitza exhaustivament les dades de la declaració i calcula el risc d'inspecció de l'AEAT.
 * Memoitzat per a optimització de rendiment en Dashboard i Resum.
 */
export function evaluateAuditRisk(data: DeclaracionData, result: FiscalResult): AuditRiskReport {
  if (riskCache.has(data)) {
    return riskCache.get(data)!;
  }
  const report = computeAuditRiskInternal(data, result);
  riskCache.set(data, report);
  return report;
}

function computeAuditRiskInternal(data: DeclaracionData, result: FiscalResult): AuditRiskReport {
  const alerts: AuditRiskAlert[] = [];
  const checklist: AuditRiskReport['documentaryChecklist'] = [];

  let riskPoints = 10; // Risc base mínim

  // 1. Auditoria d'Immobles en Lloguer (Art. 23 LIRPF)
  const properties = data.properties || [];
  for (const p of properties) {
    checklist.push({ documentName: `Contracte d'arrendament i NIF llogater (${p.name || p.address})`, section: 'Immobles', status: 'required' });
    checklist.push({ documentName: `Factures de reparació i rebut IBI (${p.name || p.address})`, section: 'Immobles', status: 'required' });

    if (p.grossRentalIncome > 0) {
      const repairs = (p.repairExpenses || 0) + (p.mortgageInterests || 0);
      const ratio = repairs / p.grossRentalIncome;
      if (ratio > 0.85) {
        riskPoints += 25;
        alerts.push({
          id: `prop-repairs-${p.id}`,
          category: 'real_estate',
          severity: 'high',
          title: `Despeses de reparació molt elevades a ${p.name || 'Immoble'} (${Math.round(ratio * 100)}% dels ingressos)`,
          description: `Les despeses de conservació i finançament (${repairs.toFixed(2)} €) superen el 85% dels ingressos bruts facturats (${p.grossRentalIncome.toFixed(2)} €).`,
          aeatTriggerReason: 'L\'algorisme de l\'AEAT creua despeses vs ingressos i dispara requeriments automàtics quan la ràtio supera el 80%.',
          recommendedProof: 'Conserva totes les factures oficials detallades amb NIF del constructor/proveïdor que justifiquin que no són obres de millora sinó conservació.',
        });
      }
    }

    if (!p.cadastralReference || p.cadastralReference.length !== 20) {
      riskPoints += 15;
      alerts.push({
        id: `prop-cad-${p.id}`,
        category: 'real_estate',
        severity: 'medium',
        title: `Referència cadastral incompleta a ${p.name || 'Immoble'}`,
        description: 'La referència cadastral no té exactament 20 caràcters alfanumèrics.',
        aeatTriggerReason: 'L\'AEAT no pot creuar automàticament l\'immoble amb la base de dades del Cadastre.',
        recommendedProof: 'Utilitza el botó "🔍 Consultar Cadastre" per validar la referència oficial.',
      });
    }

    if (p.usageType === 'habitual' && (!p.tenantNIFs || p.tenantNIFs.length === 0)) {
      riskPoints += 20;
      alerts.push({
        id: `prop-tenant-nif-${p.id}`,
        category: 'real_estate',
        severity: 'high',
        title: `Falta el NIF del llogater a ${p.name || 'Immoble'}`,
        description: 'S\'ha aplicat la reducció d\'arrendament d\'habitatge habitual sense especificar el NIF/NIE dels llogaters.',
        aeatTriggerReason: 'La Casella 0065 és de creuament obligatori per validar la reducció de la Llei 12/2023.',
        recommendedProof: 'Introdueix el NIF/NIE del contracte de lloguer i justificant de la fiança a l\'INCASÒL.',
      });
    }
  }

  // 2. Auditoria de Rendiments del Treball (Dietes & 7.p)
  const employers = data.workIncome?.employers || [];
  let totalGross = 0;
  let totalDiets = 0;
  employers.forEach(e => {
    totalGross += e.grossSalary || 0;
    totalDiets += e.dietsIncome || 0;
    checklist.push({ documentName: `Certificat de retencions IRPF (${e.name})`, section: 'Treball', status: 'required' });
  });

  if (data.workIncome?.foreignWorkExemption7p && data.workIncome.foreignWorkExemption7p > 0) {
    riskPoints += 15;
    checklist.push({ documentName: 'Certificat de desplaçament a l\'estranger, bitllets d\'avió i contracte de serveis no resident (Art. 7.p)', section: 'Treball', status: 'required' });
    alerts.push({
      id: 'work-7p',
      category: 'work',
      severity: 'medium',
      title: `Aplicació de l'Exempció 7.p per treballs a l'estranger (${data.workIncome.foreignWorkExemption7p.toFixed(2)} €)`,
      description: 'L\'Art. 7.p és una de les caselles més inspeccionades de l\'IRPF.',
      aeatTriggerReason: 'L\'AEAT sol·licita sistemàticament prova dels dies efectius a l\'estranger i que l\'empresa beneficiària no és resident a Espanya.',
      recommendedProof: 'Fulls de vol, reserves d\'hotel, passaport segellat i certificat de l\'empresa estrangera.',
    });
  }

  if (totalGross > 0 && (totalDiets / totalGross) > 0.25) {
    riskPoints += 15;
    alerts.push({
      id: 'work-diets',
      category: 'work',
      severity: 'medium',
      title: 'Volum de dietes exemptes elevat respecte al sou brut',
      description: `Les dietes representen el ${Math.round((totalDiets / totalGross) * 100)}% del salari brut.`,
      aeatTriggerReason: 'L\'AEAT requereix que l\'empresa certifiqui el motiu laboral i el lloc del desplaçament.',
      recommendedProof: 'Fulls de liquidació de despeses signats per l\'empresa amb tiquets de peatge i allotjament.',
    });
  }

  // 3. Auditoria de Guanys Patrimonials (Accions & Cripto)
  const gains = data.gains?.items || [];
  if (gains.length > 0) {
    checklist.push({ documentName: 'Extracte d\'operacions del Broker / Exchange amb dates i comissions (FIFO)', section: 'Guanys', status: 'required' });
  }

  // 4. Deduccions Autonòmiques de Catalunya
  if (data.deductions?.catalanRentalDeduction) {
    checklist.push({ documentName: 'Rebuts bancaris de pagament del lloguer i justificant de fiança a l\'INCASÒL', section: 'Deduccions', status: 'required' });
    if (result.generalBase > 20000) {
      riskPoints += 15;
      alerts.push({
        id: 'cat-rent-limit',
        category: 'deductions',
        severity: 'medium',
        title: 'Deducció de lloguer català propera al límit de renda (20.000 €)',
        description: 'La base imposable total s\'apropa al llindar màxim d\'ingressos per tenir dret a la deducció.',
        aeatTriggerReason: 'Creuament automàtic de base imposable amb la quota autonòmica de Catalunya.',
        recommendedProof: 'Comprova que la suma de base general i estalvi menys el mínim personal no superi 20.000 €.',
      });
    }
  }

  const overallRiskScore = Math.max(5, Math.min(95, riskPoints));
  const riskLevel: AuditRiskReport['riskLevel'] = overallRiskScore >= 50 ? 'high' : overallRiskScore >= 25 ? 'medium' : 'low';

  return {
    overallRiskScore,
    riskLevel,
    alerts,
    documentaryChecklist: checklist,
  };
}
