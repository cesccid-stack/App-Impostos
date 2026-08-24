/**
 * @module fiscal/tax-prescription-engine
 * Càlcul del termini de prescripció de 4 anys dels tributs estatals i autonòmics
 * segons els Articles 66 a 68 de la Llei General Tributària (LGT / Llei 58/2003).
 */

export interface TaxPrescriptionStatus {
  fiscalYear: number;
  taxType: 'IRPF' | 'IVA' | 'PATRIMONI' | 'SUCCESSIONS';
  filingDeadline: string;       // Data límit oficial de presentació
  prescriptionDate: string;     // Data exacta en què prescriu el dret d'Hisenda
  isPrescribed: boolean;        // True si han passat els 4 anys sense interrupció
  daysRemaining: number;        // Dies restants fins a la prescripció (o 0 si ja ha prescrit)
  statusLabel: string;
}

/**
 * Avalua si un exercici fiscal ha prescrit o encara pot ser objecte de comprovació/inspecció.
 */
export function checkTaxPrescription(
  fiscalYear: number,
  taxType: 'IRPF' | 'IVA' | 'PATRIMONI' | 'SUCCESSIONS' = 'IRPF',
  referenceDate: Date = new Date()
): TaxPrescriptionStatus {
  let deadlineYear = fiscalYear + 1;
  let deadlineMonth = 6; // Juny (0-indexed: 5, però fem servir dates ISO reals)
  let deadlineDay = 30;

  if (taxType === 'IVA') {
    // El model 390 anual de l'IVA es presenta al gener de l'any següent (30 de gener)
    deadlineYear = fiscalYear + 1;
    deadlineMonth = 1;
    deadlineDay = 30;
  }

  const filingDeadlineDate = new Date(deadlineYear, deadlineMonth - 1, deadlineDay);
  
  // La prescripció es consuma exactament 4 anys després del final del termini de declaració
  const prescriptionDateObj = new Date(deadlineYear + 4, deadlineMonth - 1, deadlineDay);

  const diffMs = prescriptionDateObj.getTime() - referenceDate.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isPrescribed = diffMs <= 0;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatDateISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  return {
    fiscalYear,
    taxType,
    filingDeadline: formatDateISO(filingDeadlineDate),
    prescriptionDate: formatDateISO(prescriptionDateObj),
    isPrescribed,
    daysRemaining,
    statusLabel: isPrescribed 
      ? `Exercici ${fiscalYear} Prescrit (Hisenda ja no pot liquidar ni sancionar)` 
      : `Exercici ${fiscalYear} Inspeccionable (${daysRemaining} dies restants)`,
  };
}
