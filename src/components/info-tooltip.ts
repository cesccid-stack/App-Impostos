/**
 * @module components/info-tooltip
 * Micro-component d'explicació fiscal interactiva i ajuda contextual (Smart Tax Tooltip).
 * Permet a qualsevol usuari entendre instantàniament conceptes tributaris avançats
 * sense abandonar el formulari o la pantalla actual.
 */

export interface TaxConceptInfo {
  title: string;
  simpleSummary: string;
  aeatBox?: string;
  legalArticle?: string;
  tip?: string;
}

export const TAX_GLOSSARY: Record<string, TaxConceptInfo> = {
  'casella_0610': {
    title: 'Casella 0610: Resultat de la Declaració',
    simpleSummary: 'L\'import econòmic final definitiu. Si és negatiu (-), Hisenda et fa una transferència al teu banc. Si és positiu (+), has de pagar la quantitat indicada.',
    aeatBox: '0610',
    legalArticle: 'Art. 102 LIRPF',
    tip: 'Pots fraccionar el pagament en dos terminis (60% al presentar i 40% al novembre) sense interessos de demora.',
  },
  'amortitzacio_3': {
    title: 'Amortització del 3% de la Construcció',
    simpleSummary: 'Deducció legal per desgast de l\'immoble llogat. Es calcula aplicant el 3% sobre el major entre el cost d\'adquisició de la construcció o el seu valor cadastral.',
    aeatBox: '0081',
    legalArticle: 'Art. 23.1.b LIRPF',
    tip: 'No requereix cap desemborsament de diners real en l\'exercici i redueix directament els teus beneficis tributaris.',
  },
  'reduccio_habitatge': {
    title: 'Reducció per Arrendament d\'Habitatge Habitual',
    simpleSummary: 'Rebaixa percentual sobre el rendiment net dels lloguers destinats a residència permanent (50% nou règim general, 60% contractes previs a 26/05/2023, o fins al 90% en zones tensionades).',
    aeatBox: '0150',
    legalArticle: 'Art. 23.2 LIRPF & Llei 12/2023',
    tip: 'Els lloguers turístics o d\'ús per temporada NO tenen dret a aquesta reducció.',
  },
  'exempcio_7p': {
    title: 'Exempció per Treballs a l\'Estranger (Art. 7.p)',
    simpleSummary: 'Exempció de fins a 60.100 € anuals de sou percebut per treballs realitzats efectivament a l\'estranger per a una empresa no resident o establiment permanent.',
    aeatBox: '0003 (Exempt)',
    legalArticle: 'Art. 7.p LIRPF & Art. 6 RIRPF',
    tip: 'El país de destinació ha de tenir un impost de naturalesa idèntica o anàloga i no ser un paradís fiscal.',
  },
  'plans_pensions': {
    title: 'Aportacions a Plans de Pensions',
    simpleSummary: 'Reducció directa de la base imposable general fins a un màxim d\'1.500 € anuals per a plans individuals (i fins a 8.500 € addicionals per a plans d\'ocupació d\'empresa).',
    aeatBox: '0465',
    legalArticle: 'Art. 51-52 LIRPF',
    tip: 'L\'estalvi real és igual a la teva aportació multiplicada pel teu tipus marginal (fins al 47-50%).',
  },
  'compensacio_borsa': {
    title: 'Compensació de Pèrdues Patrimonials (Bossa 4 Anys)',
    simpleSummary: 'Les pèrdues patides en accions, fons o cripto es compensen primer amb els guanys del mateix any, i el saldo restant es pot restar de fins al 25% dels rendiments de capital (dividends/interessos) durant 4 anys.',
    aeatBox: '0440 - 0457',
    legalArticle: 'Art. 49 LIRPF',
    tip: 'Encara que no tinguis guanys aquest any, declara sempre les pèrdues per activar la bossa dels pròxims 4 anys.',
  },
  'model_115_180': {
    title: 'Retencions de Lloguer: Model 115 i 180',
    simpleSummary: 'Els autònoms o societats que lloguen locals han de retenir el 19% del lloguer i liquidar-lo trimestralment a Hisenda (Model 115) i presentar el resum anual (Model 180).',
    aeatBox: 'Model 115 / 180',
    legalArticle: 'Art. 75.2.a RIRPF',
    tip: 'Com a propietari, aquest 19% són retencions a compte que es dedueixen directament a la teva Casella 0597 de la Renda.',
  },
  'vehicles_autonoms': {
    title: 'Deducció de Vehicles de Turisme per Autònoms',
    simpleSummary: 'Desacoblament normatiu estricte: en l\'IVA es presumeix el 50% d\'afectació laboral (dedueixes la meitat de l\'IVA), mentre que en l\'IRPF l\'afectació ha de ser del 100% per ser deduïble.',
    aeatBox: 'Model 303 & Casella 0191',
    legalArticle: 'Art. 95 LIVA vs Art. 22 RIRPF',
    tip: 'Només activitats de transport de viatgers, mercaderies o agents comercials poden deduir el 100% en IRPF sense risc d\'inspecció.',
  },
};

/**
 * Retorna l'element HTML d'un botó d'informació interactiu amb Popover flotant.
 */
export function createInfoTooltip(conceptKey: keyof typeof TAX_GLOSSARY | string, customInfo?: TaxConceptInfo): HTMLElement {
  const info = customInfo || TAX_GLOSSARY[conceptKey] || {
    title: 'Informació Fiscal',
    simpleSummary: 'Concepte tributari computable a la declaració de la Renda.',
  };

  const wrapper = document.createElement('span');
  wrapper.className = 'tax-info-tooltip-wrapper';
  wrapper.style.cssText = 'position:relative; display:inline-flex; align-items:center; cursor:pointer; vertical-align:middle; margin-left:4px;';

  wrapper.innerHTML = `
    <button type="button" class="btn-info-popover" style="background:transparent; border:none; color:var(--color-primary); font-size:0.85rem; padding:0 2px; cursor:pointer; display:inline-flex; align-items:center; opacity:0.85; transition:opacity 0.2s;" title="Clica per veure ajuda fiscal">
      ℹ️
    </button>
    <div class="tax-info-popover" style="display:none; position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%); width:280px; background:var(--modal-bg, #0f1026); border:1px solid var(--border-accent); border-radius:var(--radius-md); padding:12px; box-shadow:var(--shadow-lg); z-index:9999; font-size:0.75rem; color:var(--text-secondary); text-align:left; line-height:1.4; pointer-events:auto;">
      <div style="font-weight:700; color:var(--text-primary); font-size:0.8rem; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
        <span>${info.title}</span>
        <button class="btn-close-popover" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:0.8rem;">✕</button>
      </div>
      <p style="margin:0 0 6px 0; color:var(--text-secondary);">${info.simpleSummary}</p>
      ${info.aeatBox ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:2px;">📍 <strong>Casella AEAT:</strong> ${info.aeatBox}</div>` : ''}
      ${info.legalArticle ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px;">⚖️ <strong>Base legal:</strong> ${info.legalArticle}</div>` : ''}
      ${info.tip ? `<div style="background:rgba(99,102,241,0.1); border-left:2px solid var(--color-primary); padding:4px 6px; border-radius:3px; margin-top:4px; color:var(--text-primary); font-size:0.7rem;">💡 <strong>Consell:</strong> ${info.tip}</div>` : ''}
    </div>
  `;

  const btn = wrapper.querySelector('.btn-info-popover') as HTMLButtonElement;
  const popover = wrapper.querySelector('.tax-info-popover') as HTMLElement;
  const closeBtn = wrapper.querySelector('.btn-close-popover') as HTMLButtonElement;

  function togglePopover(e: Event) {
    e.stopPropagation();
    const isVisible = popover.style.display === 'block';
    popover.style.display = isVisible ? 'none' : 'block';
  }

  btn?.addEventListener('click', togglePopover);
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.style.display = 'none';
  });

  // Tancar quan es clica a fora
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node)) {
      popover.style.display = 'none';
    }
  });

  return wrapper;
}
