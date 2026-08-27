/**
 * @module fiscal/vehicle-deduction-engine
 * Motor de desacoblament i blindatge fiscal per a despeses de vehicles turisme (Art. 95 LIVA vs Art. 22 RIRPF).
 * 
 * Marc Jurídic:
 * - IVA (Art. 95.Tres Llei 37/1992): Presumpció legal d'afectació al 50% en vehicles turisme i mixtos.
 * - IRPF (Art. 22 Reglament IRPF / RD 439/2007): Exigeix afectació EXCLUSIVA (100%). No s'admet afectació parcial.
 *   Excepcions 100% IRPF: Transport de mercaderies, viatgers (taxi/VTC), ensenyament de conducció (autoescola), agents comercials col·legiats.
 */

export interface VehicleExpenseInput {
  id: string;
  concept: string; // Ex: 'Combustible', 'Rènting', 'Reparació', 'Assegurança', 'Peatge'
  totalAmount: number; // Import total factura (€)
  vatAmount: number;   // Quota d'IVA (€)
  expenseType: 'fuel' | 'maintenance' | 'renting_leasing' | 'insurance' | 'tolls' | 'purchase';
  isCommercialAgentOrTransport?: boolean; // Epígrafs IAE amb presumpció 100% (ex: 511, 722, 855)
  customVatDeductionRate?: number; // 50 per defecte (o 100 si és comercial)
}

export interface VehicleDeductionAuditResult {
  totalExpenseAmount: number;
  totalVatPaid: number;
  
  // Quota deduïble en IVA (Model 303 Casella 28/29)
  vatDeductibleAmount: number;
  vatDeductionRate: number; // 50% o 100%
  
  // Despesa deduïble en IRPF (Activitats Econòmiques Casella 0180)
  irpfDeductibleAmount: number;
  irpfDeductionRate: number; // 0% per defecte, 100% només transport/agents
  
  // Despesa no deduïble que s'ha d'eliminar de l'IRPF per evitar sanció de l'Art. 191 LGT
  irpfNonDeductibleAmount: number;
  
  // Risc fiscal evitat
  potentialTaxFineAvoided: number; // 50% de la deducció indeguda en IRPF
  isDecoupled: boolean;
  legalJustification: string;
}

/** Epígrafs de l'IAE amb dret a deducció del 100% del vehicle en IRPF */
export const EXCLUSIVE_VEHICLE_IAE_PREFIXES = ['511', '721', '722', '855', '844'];

/**
 * Avalua si una activitat o epígraf IAE permet la deducció del vehicle al 100% en l'IRPF.
 */
export function isExclusiveVehicleActivity(iaeCode?: string): boolean {
  if (!iaeCode) return false;
  const clean = iaeCode.trim().replace(/\D/g, '');
  return EXCLUSIVE_VEHICLE_IAE_PREFIXES.some(prefix => clean.startsWith(prefix));
}

/**
 * Realitza l'auditoria i el desacoblament automàtic de despeses de vehicle entre IVA i IRPF.
 */
export function auditAndDecoupleVehicleExpenses(
  expenses: VehicleExpenseInput[],
  iaeCode?: string
): VehicleDeductionAuditResult {
  const isExclusive = isExclusiveVehicleActivity(iaeCode) || expenses.some(e => e.isCommercialAgentOrTransport);

  let totalExpenseAmount = 0;
  let totalVatPaid = 0;
  let vatDeductibleAmount = 0;
  let irpfDeductibleAmount = 0;

  for (const exp of expenses) {
    const base = exp.totalAmount - (exp.vatAmount || 0);
    totalExpenseAmount += exp.totalAmount;
    totalVatPaid += (exp.vatAmount || 0);

    // 1. Càlcul IVA: 50% presumpció (o 100% si és activitat exclusiva)
    const vatRate = isExclusive ? 1.0 : ((exp.customVatDeductionRate ?? 50) / 100);
    vatDeductibleAmount += (exp.vatAmount || 0) * vatRate;

    // 2. Càlcul IRPF: 0% per a turismes generals / 100% per a activitats exclusives
    if (isExclusive) {
      // Si és 100% exclusiu, la base + IVA no deduït és deduïble a l'IRPF
      const nonDeductedVat = (exp.vatAmount || 0) * (1 - vatRate);
      irpfDeductibleAmount += base + nonDeductedVat;
    } else {
      // 0% a l'IRPF (Art. 22 RIRPF)
      irpfDeductibleAmount += 0;
    }
  }

  const irpfNonDeductibleAmount = totalExpenseAmount - irpfDeductibleAmount;
  // Sanció tipificada a l'Art. 191 LGT: 50% de la quota d'IRPF defraudada (assumint tipus marginal mig del 30%)
  const potentialTaxFineAvoided = irpfNonDeductibleAmount * 0.30 * 0.50;

  const legalJustification = isExclusive
    ? `Activitat IAE (${iaeCode || 'Transport/Agents'}) qualificada per a deducció del 100% del vehicle en IVA i IRPF (Art. 95.Tres LIVA i Art. 22.4 RIRPF).`
    : `Desacoblament aplicat: Es dedueix el 50% de quota d'IVA (Art. 95.Tres LIVA) però 0 € a l'IRPF (Art. 22 RIRPF). La deducció de turismes no exclusius a l'IRPF és causa directa de sanció tributària de l'AEAT.`;

  return {
    totalExpenseAmount,
    totalVatPaid,
    vatDeductibleAmount,
    vatDeductionRate: isExclusive ? 100 : 50,
    irpfDeductibleAmount,
    irpfDeductionRate: isExclusive ? 100 : 0,
    irpfNonDeductibleAmount,
    potentialTaxFineAvoided,
    isDecoupled: !isExclusive,
    legalJustification,
  };
}
