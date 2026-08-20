/**
 * @module pages/calendari
 * Calendari Fiscal Oficial AEAT 2025/2026 amb Alertes i Descàrrega d'Esdeveniments iCal (.ics).
 * Informa de tots els terminis d'IRPF, IVA, Pagaments Fraccionats, Retencions, Model 720 i Patrimoni.
 */

import { store } from '../store.ts';
import { showToast } from '../components/toast.ts';

export interface TaxDeadline {
  id: string;
  code: string;
  name: string;
  description: string;
  targetProfileTypes: string[];
  dueDate: string; // YYYY-MM-DD
  quarter?: '1T' | '2T' | '3T' | '4T' | 'Anual';
  legalRef: string;
  fineWarning: string;
  category: 'IRPF' | 'IVA' | 'Patrimoni' | 'Estranger' | 'Informatiu';
}

export function renderCalendariPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container';

  let selectedCategoryFilter: string = 'all';
  let onlyActiveProfileRelevant: boolean = false;

  function render() {
    const activeProfile = store.getActiveProfile();
    const currentYear = store.getYear();
    const today = new Date();

    const deadlines = getOfficialTaxDeadlines(currentYear);

    const filteredDeadlines = deadlines.filter((d) => {
      const matchCat = selectedCategoryFilter === 'all' || d.category === selectedCategoryFilter;
      const matchProfile = !onlyActiveProfileRelevant || d.targetProfileTypes.includes(activeProfile.type || 'employee') || d.targetProfileTypes.includes('all');
      return matchCat && matchProfile;
    });

    // Find next upcoming deadline
    const upcomingList = deadlines
      .map((d) => {
        const diffMs = new Date(d.dueDate + 'T23:59:59').getTime() - today.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return { ...d, diffDays };
      })
      .filter((d) => d.diffDays >= 0)
      .sort((a, b) => a.diffDays - b.diffDays);

    const nextDeadline = upcomingList[0];

    page.innerHTML = `
      <!-- Capçalera -->
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-xl);">
        <div>
          <div style="display:flex; align-items:center; gap:var(--space-sm); margin-bottom:4px;">
            <h1 class="page-header__title" style="margin:0;">📅 Calendari Fiscal & Alertes AEAT</h1>
            <span class="badge badge--primary" style="font-size:0.8rem;">Exercici ${currentYear}</span>
            <span class="badge badge--primary" style="font-size:0.8rem;">
              ${activeProfile.avatarIcon || '👤'} ${activeProfile.name}
            </span>
          </div>
          <p class="page-header__subtitle" style="margin:0;">
            Guia oficial de venciments tributaris de l'Agència Tributària (AEAT) per a IRPF, IVA trimestral, Patrimoni i Model 720
          </p>
        </div>
        <div style="display:flex; gap:var(--space-sm); flex-wrap:wrap;">
          <button class="btn btn--primary btn--sm" id="btn-export-ical" style="font-weight:700;">
            📅 Afegir a Google / Apple Calendar (.ics)
          </button>
        </div>
      </div>

      <!-- Banner de Pròxim Venciment -->
      ${nextDeadline ? `
        <div class="card" style="margin-bottom:var(--space-xl); background:linear-gradient(135deg, rgba(99, 102, 241, 0.12), var(--bg-surface)); border-left:4px solid var(--color-primary); border-top:1px solid var(--border-default); border-right:1px solid var(--border-default); border-bottom:1px solid var(--border-default);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-md);">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge ${nextDeadline.diffDays <= 15 ? 'badge--error' : 'badge--warning'}" style="font-weight:700;">
                  ${nextDeadline.diffDays === 0 ? '🚨 VENÇ AVUI' : `⏰ En ${nextDeadline.diffDays} dies (${formatDate(nextDeadline.dueDate)})`}
                </span>
                <span style="font-weight:700; font-size:var(--text-base); color:var(--text-primary);">${nextDeadline.name}</span>
                <span class="badge badge--info">${nextDeadline.code}</span>
              </div>
              <div style="margin-top:6px; font-size:var(--text-sm); color:var(--text-secondary);">
                ${nextDeadline.description} — <strong>Base Legal:</strong> ${nextDeadline.legalRef}
              </div>
            </div>
            <div>
              <span class="badge badge--success" style="font-size:0.8rem; padding:6px 12px;">✅ Estat: En termini</span>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Filtres -->
      <div class="card" style="margin-bottom:var(--space-xl); padding:var(--space-md); background:var(--bg-surface-elevated);">
        <div style="display:flex; flex-wrap:wrap; gap:var(--space-md); justify-content:space-between; align-items:center;">
          <!-- Filtres per Categoria -->
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="filter-pill ${selectedCategoryFilter === 'all' ? 'active' : ''}" data-cat="all">Tots (${deadlines.length})</button>
            <button class="filter-pill ${selectedCategoryFilter === 'IRPF' ? 'active' : ''}" data-cat="IRPF">💼 Renda (IRPF)</button>
            <button class="filter-pill ${selectedCategoryFilter === 'IVA' ? 'active' : ''}" data-cat="IVA">🧾 IVA (303/390)</button>
            <button class="filter-pill ${selectedCategoryFilter === 'Patrimoni' ? 'active' : ''}" data-cat="Patrimoni">🏰 Patrimoni (714)</button>
            <button class="filter-pill ${selectedCategoryFilter === 'Estranger' ? 'active' : ''}" data-cat="Estranger">🌍 Estranger (720)</button>
          </div>

          <!-- Toggle només perfil actiu -->
          <div>
            <label class="form-toggle" style="font-size:var(--text-xs); cursor:pointer;">
              <input type="checkbox" id="chk-only-profile" ${onlyActiveProfileRelevant ? 'checked' : ''} />
              <span>Només per a <strong>${activeProfile.name}</strong></span>
            </label>
          </div>
        </div>
      </div>

      <!-- Graella de Terminis Fiscals -->
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:var(--space-lg); margin-bottom:var(--space-2xl);">
        ${filteredDeadlines.map((item) => {
          const diffMs = new Date(item.dueDate + 'T23:59:59').getTime() - today.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          const isPast = diffDays < 0;
          const isUrgent = diffDays >= 0 && diffDays <= 20;

          return `
            <div class="card" style="
              border: 1px solid ${isUrgent ? 'var(--color-warning)' : 'var(--border-default)'};
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              background: var(--bg-surface-elevated);
              position: relative;
            ">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:var(--space-xs);">
                  <span class="badge badge--primary" style="font-family:var(--font-mono); font-weight:700;">${item.code}</span>
                  <span class="badge ${isPast ? 'badge--secondary' : (isUrgent ? 'badge--warning' : 'badge--info')}" style="font-size:0.7rem;">
                    ${isPast ? 'Finalitzat' : `${diffDays} dies restants`}
                  </span>
                </div>

                <h3 style="margin:8px 0 4px 0; font-size:var(--text-base); font-weight:700; color:var(--text-primary);">
                  ${item.name}
                </h3>
                <p style="margin:0 0 var(--space-sm) 0; font-size:var(--text-xs); color:var(--text-secondary); line-height:1.4;">
                  ${item.description}
                </p>

                <div style="background:var(--bg-surface); padding:8px 10px; border-radius:var(--radius-sm); font-size:0.75rem; border:1px solid var(--border-subtle); margin-bottom:var(--space-sm);">
                  <div>📅 <strong>Data límit:</strong> <span style="color:var(--text-primary); font-weight:600;">${formatDate(item.dueDate)}</span></div>
                  <div>⚖️ <strong>Base Legal:</strong> ${item.legalRef}</div>
                </div>
              </div>

              <div style="font-size:0.7rem; color:var(--text-muted); border-top:1px dashed var(--border-default); padding-top:8px;">
                ⚠️ <em>Sanció AEAT per retard: ${item.fineWarning}</em>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Listeners
    page.querySelectorAll('.filter-pill[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedCategoryFilter = btn.getAttribute('data-cat') || 'all';
        render();
      });
    });

    page.querySelector('#chk-only-profile')?.addEventListener('change', (e) => {
      onlyActiveProfileRelevant = (e.target as HTMLInputElement).checked;
      render();
    });

    // iCal Export Listener
    page.querySelector('#btn-export-ical')?.addEventListener('click', () => {
      exportDeadlinesToICal(deadlines, currentYear);
    });
  }

  render();
  return page;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const months = ['de gener', 'de febrer', 'de març', 'd\'abril', 'de maig', 'de juny', 'de juliol', 'd\'agost', 'de setembre', 'd\'octubre', 'de novembre', 'de desembre'];
  const monthIdx = parseInt(m, 10) - 1;
  return `${parseInt(d, 10)} ${months[monthIdx]} de ${y}`;
}

function getOfficialTaxDeadlines(year: number): TaxDeadline[] {
  const nextYear = year + 1;

  return [
    // 1T
    {
      id: 'd_1t_iva_303',
      code: 'Model 303 (1T)',
      name: 'Autoliquidació Trimestral d\'IVA (1r Trimestre)',
      description: 'Declaració i ingrés de l\'IVA meritat i deduïble del gener al març.',
      targetProfileTypes: ['freelance', 'corporate_partner'],
      dueDate: `${year}-04-20`,
      quarter: '1T',
      category: 'IVA',
      legalRef: 'Art. 71 RIVA',
      fineWarning: 'Recàrrec executiu de l\'1% + 1% per cada mes complet de retard (Art. 27 LGT).',
    },
    {
      id: 'd_1t_irpf_130',
      code: 'Model 130 (1T)',
      name: 'Pagament Fraccionat IRPF d\'Autònoms (1r Trimestre)',
      description: 'Ingrés a compte del 20% del rendiment net acumulat en estimació directa.',
      targetProfileTypes: ['freelance'],
      dueDate: `${year}-04-20`,
      quarter: '1T',
      category: 'IRPF',
      legalRef: 'Art. 109 RIRPF',
      fineWarning: 'Sanció del 50% al 150% de la quota no ingressada en cas de requeriment previ.',
    },
    {
      id: 'd_1t_ret_111',
      code: 'Model 111 (1T)',
      name: 'Retencions de Treball i Professionals (1T)',
      description: 'Liquidació de retencions practicades a treballadors i professionals independents.',
      targetProfileTypes: ['freelance', 'corporate_partner'],
      dueDate: `${year}-04-20`,
      quarter: '1T',
      category: 'IRPF',
      legalRef: 'Art. 108 RIRPF',
      fineWarning: 'Interessos de demora i recàrrecs tributaris d\'extemporaneïtat.',
    },

    // Model 720 / 721
    {
      id: 'd_m720',
      code: 'Model 720 / 721',
      name: 'Declaració Informativa de Béns i Cripto a l\'Estranger',
      description: 'Obligació informativa per a comptes, valors i immobles internacionals > 50.000 €.',
      targetProfileTypes: ['investor', 'corporate_partner', 'all'],
      dueDate: `${year}-03-31`,
      category: 'Estranger',
      legalRef: 'Disposició Addicional 18a LGT',
      fineWarning: 'Sanció formal de 20 € per dada no declarada amb un mínim de 300 € (Llei 5/2022).',
    },

    // Campanya Renda
    {
      id: 'd_renta_domiciliacio',
      code: 'Model 100 (Domiciliació)',
      name: 'Límit Domiciliació Bancària Declaració IRPF',
      description: 'Últim dia per domiciliar el pagament de la declaració de la renda amb resultat a ingressar.',
      targetProfileTypes: ['all'],
      dueDate: `${year}-06-25`,
      category: 'IRPF',
      legalRef: 'Ordre Anual IRPF AEAT',
      fineWarning: 'Després d\'aquesta data cal obtenir un NRC bancari manual o pagar per targeta.',
    },
    {
      id: 'd_renta_final',
      code: 'Model 100 & 714',
      name: 'Fi de Campanya Declaració Renda i Patrimoni',
      description: 'Termini improrrogable per a la presentació oficial del Model 100 (IRPF) i Model 714 (Patrimoni).',
      targetProfileTypes: ['all'],
      dueDate: `${year}-06-30`,
      category: 'IRPF',
      legalRef: 'Art. 96-97 LIRPF',
      fineWarning: 'Presentació fora de termini: recàrrec d\'extemporaneïtat o sanció d\'infracció tributària.',
    },

    // 2T
    {
      id: 'd_2t_iva_303',
      code: 'Model 303 (2T)',
      name: 'Autoliquidació Trimestral d\'IVA (2n Trimestre)',
      description: 'Declaració d\'operacions i liquidació d\'IVA d\'abril a juny.',
      targetProfileTypes: ['freelance', 'corporate_partner'],
      dueDate: `${year}-07-20`,
      quarter: '2T',
      category: 'IVA',
      legalRef: 'Art. 71 RIVA',
      fineWarning: 'Recàrrec executiu de l\'1% mensual sense requeriment previ.',
    },
    {
      id: 'd_2t_irpf_130',
      code: 'Model 130 (2T)',
      name: 'Pagament Fraccionat IRPF (2n Trimestre)',
      description: 'Pagament a compte del rendiment net acumulat del 1r i 2n trimestre.',
      targetProfileTypes: ['freelance'],
      dueDate: `${year}-07-20`,
      quarter: '2T',
      category: 'IRPF',
      legalRef: 'Art. 109 RIRPF',
      fineWarning: 'Interessos de demora legals sobre quotes no abonades a compte.',
    },

    // 3T
    {
      id: 'd_3t_iva_303',
      code: 'Model 303 (3T)',
      name: 'Autoliquidació Trimestral d\'IVA (3r Trimestre)',
      description: 'Declaració i ingrés d\'IVA del juliol al setembre.',
      targetProfileTypes: ['freelance', 'corporate_partner'],
      dueDate: `${year}-10-20`,
      quarter: '3T',
      category: 'IVA',
      legalRef: 'Art. 71 RIVA',
      fineWarning: 'Recàrrec executiu d\'extemporaneïtat.',
    },
    {
      id: 'd_3t_irpf_130',
      code: 'Model 130 (3T)',
      name: 'Pagament Fraccionat IRPF (3r Trimestre)',
      description: 'Pagament a compte del rendiment net acumulat dels 9 primers mesos.',
      targetProfileTypes: ['freelance'],
      dueDate: `${year}-10-20`,
      quarter: '3T',
      category: 'IRPF',
      legalRef: 'Art. 109 RIRPF',
      fineWarning: 'Sanció per retard tributari.',
    },

    // 2n Termini Renda
    {
      id: 'd_segon_pagament_renta',
      code: 'Model 100 (2n Fraccionament)',
      name: '2n Pagament del 40% de la Declaració de la Renda',
      description: 'Cobrament automàtic del segon termini fraccionat de l\'IRPF per als qui van optar pel pagament en dos terminis.',
      targetProfileTypes: ['all'],
      dueDate: `${year}-11-05`,
      category: 'IRPF',
      legalRef: 'Art. 62.2 RIRPF',
      fineWarning: 'Recàrrec de constrenyiment del 20% si no hi ha saldo suficient al compte bancari.',
    },

    // 4T i Anuals
    {
      id: 'd_4t_iva_303',
      code: 'Model 303 & 390 (4T)',
      name: '4t Trimestre d\'IVA i Resum Anual (Model 390)',
      description: 'Autoliquidació del 4t trimestre, regularització de prorrata i declaració informativa anual.',
      targetProfileTypes: ['freelance', 'corporate_partner'],
      dueDate: `${nextYear}-01-30`,
      quarter: '4T',
      category: 'IVA',
      legalRef: 'Art. 71 RIVA & Ordre HAP/2373/2014',
      fineWarning: 'Sanció fixa de 200 € per no presentar el Model 390 (Art. 198 LGT).',
    },
    {
      id: 'd_4t_irpf_130',
      code: 'Model 130 (4T)',
      name: 'Pagament Fraccionat IRPF (4t Trimestre)',
      description: 'Liquidació final a compte dels rendiments de tot l\'exercici abans de la Renda Anual.',
      targetProfileTypes: ['freelance'],
      dueDate: `${nextYear}-01-30`,
      quarter: '4T',
      category: 'IRPF',
      legalRef: 'Art. 109 RIRPF',
      fineWarning: 'Sancions per omissió d\'autoliquidació.',
    },
  ];
}

function exportDeadlinesToICal(deadlines: TaxDeadline[], year: number): void {
  const events = deadlines.map((d) => {
    const dt = d.dueDate.replace(/-/g, '');
    return [
      'BEGIN:VEVENT',
      `UID:tax-deadline-${d.id}-${year}@hacienda.antigravity`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART;VALUE=DATE:${dt}`,
      `DTEND;VALUE=DATE:${dt}`,
      `SUMMARY:📌 ${d.code} — ${d.name}`,
      `DESCRIPTION:${d.description}\\n\\nBase Legal: ${d.legalRef}\\nSanció AEAT: ${d.fineWarning}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-P7D',
      'ACTION:DISPLAY',
      `DESCRIPTION:Avís: Venciment ${d.code} en 7 dies!`,
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n');
  }).join('\r\n');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Antigravity//Hacienda Calendari Fiscal 2025//CA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Calendari Fiscal AEAT ${year}`,
    'X-WR-TIMEZONE:Europe/Madrid',
    events,
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Calendari_Fiscal_AEAT_${year}_Antigravity.ics`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Fitxer de calendari (.ics) descarregat! Podeu obrir-lo amb Google/Apple Calendar', 'success');
}
