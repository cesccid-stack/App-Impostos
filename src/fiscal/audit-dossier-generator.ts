/**
 * @module fiscal/audit-dossier-generator
 * Generador de Dossier de Defensa Tributària i Justificació davant Requeriments de l'AEAT.
 * 
 * Normativa aplicable:
 * - Llei 58/2003 General Tributària (Art. 34 - Drets i garanties dels obligats tributaris).
 * - Procediments de Comprovació Limitada i Inspecció (Art. 136 a 159 LGT).
 * - Termini de Prescripció de 4 anys (Art. 66 a 70 LGT).
 */

import type { DeclaracionData } from '../types.ts';
import { calculateIRPF } from './irpf.ts';
import { ModelReconciliationEngine } from './model-reconciliation-engine.ts';
import { evaluateAuditRisk } from './audit-risk-radar.ts';

export interface AuditBoxJustification {
  readonly boxNumber: string;
  readonly concept: string;
  readonly declaredAmount: number;
  readonly legalBasis: string;
  readonly requiredDocuments: readonly string[];
  readonly riskLevel: 'low' | 'medium' | 'high';
}

export interface TaxDefenseDossier {
  readonly generationTimestamp: string;
  readonly fiscalYear: number;
  readonly taxpayerNif: string;
  readonly taxpayerName: string;
  readonly generalTaxBase: number;
  readonly savingsTaxBase: number;
  readonly totalNetTax: number;
  readonly riskScore: number;
  readonly prescriptionDeadline: string; // Data en què prescriu l'exercici (30/06/ANY+5)
  readonly boxJustifications: readonly AuditBoxJustification[];
  readonly requiredDocumentationChecklist: readonly {
    readonly documentType: string;
    readonly description: string;
    readonly legalObligation: string;
    readonly isMandatory: boolean;
  }[];
  readonly defenseArguments: readonly string[];
}

/**
 * Genera el Dossier Integral de Defensa Tributària per a la declaració actual.
 */
export function generateTaxDefenseDossier(data: DeclaracionData): TaxDefenseDossier {
  const result = calculateIRPF(data);
  const radar = evaluateAuditRisk(data, result);
  const auditReport = ModelReconciliationEngine.auditAndCheckDiscrepancies(data);
  const discrepancies = auditReport.discrepancies;

  const fiscalYear = data.year || data.personal?.fiscalYear || 2024;
  const prescriptionYear = fiscalYear + 5;
  const prescriptionDeadline = `30/06/${prescriptionYear}`;

  const justifications: AuditBoxJustification[] = [];

  const totalGrossWork = (data.workIncome?.employers || []).reduce((sum, emp) => sum + (emp.grossSalary || 0), 0);
  const totalSS = (data.workIncome?.employers || []).reduce((sum, emp) => sum + (emp.socialSecurity || 0), 0);
  const exempt7p = data.workIncome?.foreignWorkExemption7p || 0;
  const activitiesIncome = data.activities?.income || 0;
  const activitiesExpenses = data.activities?.expenses || 0;
  const donationsSum = (data.deductions?.donations || []).reduce((sum, d) => sum + (d.amount || 0), 0);

  // 1. Rendiments del Treball
  if (totalGrossWork > 0) {
    justifications.push({
      boxNumber: '0003',
      concept: 'Retribucions dineràries íntegres del treball',
      declaredAmount: totalGrossWork,
      legalBasis: 'Art. 17 LIRPF',
      requiredDocuments: ['Certificat de retribucions i retencions de l’empresa pagadora', '12 nòmines de l’exercici'],
      riskLevel: 'low',
    });
  }

  // 2. Despeses de Seguretat Social
  if (totalSS > 0) {
    justifications.push({
      boxNumber: '0013',
      concept: 'Cotitzacions a la Seguretat Social o mutualitats',
      declaredAmount: totalSS,
      legalBasis: 'Art. 19.2.a LIRPF',
      requiredDocuments: ['Informe de bases de cotització de la TGSS', 'Certificat d’empresa Model 190'],
      riskLevel: 'low',
    });
  }

  // 3. Exempció per Treballs a l'Estranger (Art. 7.p)
  if (exempt7p > 0) {
    justifications.push({
      boxNumber: 'Exempció Art. 7.p',
      concept: 'Rendiments del treball exempts per treballs efectuats a l’estranger',
      declaredAmount: exempt7p,
      legalBasis: 'Art. 7.p LIRPF i Art. 6 RIRPF (Límit màxim de 60.100 €)',
      requiredDocuments: [
        'Bitllets d’avió i targetes d’embarcament dels desplaçaments',
        'Contracte mercantil entre l’empresa espanyola i l’entitat estrangera destinatària',
        'Justificants de residència hotelera a l’estranger',
        'Càlcul desglossat dels dies efectius d’estada a l’estranger',
      ],
      riskLevel: 'high',
    });
  }

  // 4. Rendiments d'Activitats Econòmiques
  if (activitiesIncome > 0) {
    justifications.push({
      boxNumber: '0165+',
      concept: 'Ingressos d’Activitats Econòmiques en Estimació Directa',
      declaredAmount: activitiesIncome,
      legalBasis: 'Art. 27 i 28 LIRPF',
      requiredDocuments: [
        'Llibre Registre de Factures Emeses (Ordre HAC/773/2019)',
        'Model 303 i Model 390 d’IVA de l’exercici',
        'Model 130 de pagaments fraccionats d’IRPF',
      ],
      riskLevel: 'medium',
    });
  }

  // 5. Despeses Deduïbles d'Autònoms
  if (activitiesExpenses > 0) {
    justifications.push({
      boxNumber: '0180+',
      concept: 'Despeses afectes a l’activitat econòmica',
      declaredAmount: activitiesExpenses,
      legalBasis: 'Art. 29 i 30 LIRPF',
      requiredDocuments: [
        'Llibre Registre de Factures Rebudes i Despeses',
        'Factures completes amb NIF, IVA desglossat i mitjà de pagament traçable',
      ],
      riskLevel: activitiesExpenses > activitiesIncome * 0.7 ? 'high' : 'medium',
    });
  }

  // 6. Deducció per Donatius
  if (donationsSum > 0) {
    justifications.push({
      boxNumber: '0722',
      concept: 'Deducció per donatius a entitats beneficiàries del mecenatge',
      declaredAmount: donationsSum,
      legalBasis: 'Art. 19 i 20 de la Llei 49/2002',
      requiredDocuments: ['Certificat fiscal emès per l’ONG/Fundació amb justificant del Model 182'],
      riskLevel: 'low',
    });
  }

  // Checklist de documents
  const documentationChecklist = [
    {
      documentType: 'Certificat de Retencions (Model 190)',
      description: 'Acreditació oficial emesa pels pagadors de rendiments del treball i activitats.',
      legalObligation: 'Art. 108.3 Reglament IRPF',
      isMandatory: totalGrossWork > 0,
    },
    {
      documentType: 'Llibres Registre Oficials de Factures (HAC/773/2019)',
      description: 'Llibres de vendes/ingressos, compres/despeses i béns d’inversió.',
      legalObligation: 'Art. 68 Reglament IRPF i Ordre HAC/773/2019',
      isMandatory: activitiesIncome > 0,
    },
    {
      documentType: 'Justificants de Desplaçament i Treballs a l’Estranger (7.p)',
      description: 'Contractes, bitllets d’avió i factures d’allotjament per justificar la realitat del desplaçament.',
      legalObligation: 'Art. 7.p LIRPF i doctrina DGT CV 1422-20',
      isMandatory: exempt7p > 0,
    },
    {
      documentType: 'Certificats Bancaris de Retencions del Capital Mobiliari',
      description: 'Justificant dels interessos percebuts i retencions practicades (Model 193/196).',
      legalObligation: 'Art. 76 Reglament IRPF',
      isMandatory: (data.capitalIncome?.dividends || 0) > 0 || (data.capitalIncome?.interests || 0) > 0,
    },
  ];

  // Arguments de defensa jurídica
  const defenseArguments = [
    'Tots els ingressos han estat declarats d’acord amb el principi d’exigibilitat i meritació establerts a l’Art. 14 LIRPF.',
    'Les despeses deduïdes compleixen els tres requisits jurisprudencials del Tribunal Suprem: correlació amb els ingressos, suport documental mitjançant factura completa i registre en els llibres oficials.',
    discrepancies.length === 0
      ? 'Conciliació creuada perfecta amb els models trimestrals de l’AEAT (Models 303, 130, 111) sense cap discrepància detectada.'
      : `Es constaten ${discrepancies.length} alertes de conciliació que requereixen revisió prèvia a la presentació.`,
  ];

  return {
    generationTimestamp: new Date().toISOString(),
    fiscalYear,
    taxpayerNif: data.personal?.nif || 'SENSE_NIF',
    taxpayerName: data.personal?.name || 'CONTRIBUENT',
    generalTaxBase: result.generalBase,
    savingsTaxBase: result.savingsBase,
    totalNetTax: result.netTax,
    riskScore: radar.overallRiskScore,
    prescriptionDeadline,
    boxJustifications: justifications,
    requiredDocumentationChecklist: documentationChecklist,
    defenseArguments,
  };
}
