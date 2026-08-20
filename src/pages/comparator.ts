/**
 * @module pages/comparator
 * Pàgina interactiva de comparació Tributació Individual vs Tributació Conjunta (Art. 82-84 LIRPF).
 */

import { store } from '../store.ts';
import { compareIndividualVsJoint } from '../fiscal/joint-taxation.ts';
import { formatCurrency } from '../utils/currency.ts';

export function renderComparator(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page';

  const profiles = store.getProfiles();
  const currentYear = store.getYear();

  let profile1Id = profiles[0]?.id || 'profile_main';
  let profile2Id = profiles[1]?.id || profiles[0]?.id;
  let isSingleParent = false;

  function renderView() {
    const data1 = store.getProfileData(profile1Id, currentYear);
    const data2 = store.getProfileData(profile2Id, currentYear);
    const comparison = compareIndividualVsJoint(data1, data2, isSingleParent);

    const p1 = profiles.find(p => p.id === profile1Id) || profiles[0];
    const p2 = profiles.find(p => p.id === profile2Id) || profiles[1] || profiles[0];

    const isJointBest = comparison.recommendedOption === 'joint';
    const isIndividualBest = comparison.recommendedOption === 'individual';

    page.innerHTML = `
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md);">
        <div>
          <h1 class="page-header__title">⚖️ Comparador Individual vs Conjunta</h1>
          <p class="page-header__subtitle">Optimitza la declaració de la parella/matrimoni amb la reducció de 3.400 € (Art. 84 LIRPF) i compensació de bases</p>
        </div>
        <div style="display:flex; gap:var(--space-sm); align-items:center;">
          <label style="display:flex; align-items:center; gap:var(--space-xs); font-size:var(--text-sm); cursor:pointer; background:var(--bg-surface-elevated); padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <input type="checkbox" id="check-single-parent" ${isSingleParent ? 'checked' : ''}>
            <span>Família monoparental (2.150 €)</span>
          </label>
        </div>
      </div>

      <!-- Selectors de Perfils -->
      <div class="card" style="margin-bottom:var(--space-xl); background:var(--bg-surface-elevated);">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:var(--space-lg); align-items:center;">
          <div>
            <label class="form-label">Declarant 1</label>
            <select class="form-input" id="select-profile-1">
              ${profiles.map(p => `
                <option value="${p.id}" ${p.id === profile1Id ? 'selected' : ''}>
                  👤 ${p.name} (${p.relation})
                </option>
              `).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Declarant 2 (Cònjuge / Parella)</label>
            <select class="form-input" id="select-profile-2">
              ${profiles.map(p => `
                <option value="${p.id}" ${p.id === profile2Id ? 'selected' : ''}>
                  👤 ${p.name} (${p.relation})
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Banner de Recomanació i Estalvi Màxim -->
      <div class="card" style="margin-bottom:var(--space-xl); border: 2px solid ${isJointBest ? 'var(--color-success)' : isIndividualBest ? 'var(--color-info)' : 'var(--border-default)'}; background: ${isJointBest ? 'var(--color-success-soft)' : isIndividualBest ? 'var(--color-info-soft)' : 'var(--bg-surface-elevated)'};">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-md);">
          <div>
            <div style="display:flex; align-items:center; gap:var(--space-sm);">
              <span style="font-size:2rem;">${isJointBest ? '🎉' : isIndividualBest ? '💡' : '⚖️'}</span>
              <div>
                <h3 style="margin:0; font-size:var(--text-xl); font-weight:700;">
                  ${isJointBest ? 'Recomanació: TRIBUTACIÓ CONJUNTA' : isIndividualBest ? 'Recomanació: TRIBUTACIÓ INDIVIDUAL' : 'Totes dues modalitats són equivalents'}
                </h3>
                <p style="margin:4px 0 0 0; color:var(--text-secondary); font-size:var(--text-sm);">
                  ${comparison.reasoning}
                </p>
              </div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Estalvi net aconseguit</div>
            <div style="font-size:var(--text-3xl); font-weight:800; color:${isJointBest ? 'var(--color-success)' : isIndividualBest ? 'var(--color-info)' : 'var(--text-primary)'};">
              ${formatCurrency(comparison.savingsAmount)}
            </div>
          </div>
        </div>
      </div>

      <!-- Taula Comparativa a 3 Columnes -->
      <div class="card" style="overflow-x:auto;">
        <table class="table" style="width:100%; border-collapse:collapse; font-size:var(--text-sm);">
          <thead>
            <tr style="border-bottom:2px solid var(--border-default); text-align:left;">
              <th style="padding:12px;">Concepte Fiscal (Exercici ${currentYear})</th>
              <th style="padding:12px; text-align:right;">${p1.name} (Individual)</th>
              <th style="padding:12px; text-align:right;">${p2.name} (Individual)</th>
              <th style="padding:12px; text-align:right; background:var(--bg-surface-elevated);">Suma Individuals</th>
              <th style="padding:12px; text-align:right; font-weight:700; color:var(--color-primary); background:var(--bg-surface-hover);">Tributació Conjunta</th>
            </tr>
          </thead>
          <tbody>
            <!-- Bases Imposables -->
            <tr>
              <td style="padding:10px; font-weight:600;">Base Imposable General (Feina, Lloguers, Activitats)</td>
              <td style="padding:10px; text-align:right;">${formatCurrency(comparison.spouse1Result.generalBase)}</td>
              <td style="padding:10px; text-align:right;">${formatCurrency(comparison.spouse2Result.generalBase)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-elevated); font-weight:600;">${formatCurrency(comparison.spouse1Result.generalBase + comparison.spouse2Result.generalBase)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-hover); font-weight:700;">${formatCurrency(comparison.jointResult.generalBase)}</td>
            </tr>
            <tr>
              <td style="padding:10px; font-weight:600;">Base Imposable de l'Estalvi (Interessos, Dividends, Accions)</td>
              <td style="padding:10px; text-align:right;">${formatCurrency(comparison.spouse1Result.savingsBase)}</td>
              <td style="padding:10px; text-align:right;">${formatCurrency(comparison.spouse2Result.savingsBase)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-elevated); font-weight:600;">${formatCurrency(comparison.spouse1Result.savingsBase + comparison.spouse2Result.savingsBase)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-hover); font-weight:700;">${formatCurrency(comparison.jointResult.savingsBase)}</td>
            </tr>

            <!-- Reduccions -->
            <tr style="border-top:1px solid var(--border-default);">
              <td style="padding:10px; color:var(--text-muted);">Reducció per Rendiments del Treball</td>
              <td style="padding:10px; text-align:right;">-${formatCurrency(comparison.spouse1Result.workIncomeReduction)}</td>
              <td style="padding:10px; text-align:right;">-${formatCurrency(comparison.spouse2Result.workIncomeReduction)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-elevated);">-${formatCurrency(comparison.spouse1Result.workIncomeReduction + comparison.spouse2Result.workIncomeReduction)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-hover);">-${formatCurrency(comparison.jointResult.workIncomeReduction)}</td>
            </tr>
            <tr>
              <td style="padding:10px; color:var(--text-muted);">Reducció per Plans de Pensions</td>
              <td style="padding:10px; text-align:right;">-${formatCurrency(comparison.spouse1Result.pensionReduction)}</td>
              <td style="padding:10px; text-align:right;">-${formatCurrency(comparison.spouse2Result.pensionReduction)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-elevated);">-${formatCurrency(comparison.spouse1Result.pensionReduction + comparison.spouse2Result.pensionReduction)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-hover);">-${formatCurrency(comparison.jointResult.pensionReduction)}</td>
            </tr>
            <tr>
              <td style="padding:10px; font-weight:600; color:var(--color-success);">Reducció per Tributació Conjunta (Art. 84 LIRPF)</td>
              <td style="padding:10px; text-align:right;">0,00 €</td>
              <td style="padding:10px; text-align:right;">0,00 €</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-elevated);">0,00 €</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-hover); font-weight:700; color:var(--color-success);">-${formatCurrency(comparison.jointResult.jointTaxationReduction || 0)}</td>
            </tr>

            <!-- Base Liquidable i Mínims -->
            <tr style="border-top:1px solid var(--border-default); font-weight:600;">
              <td style="padding:10px;">Base Liquidable General</td>
              <td style="padding:10px; text-align:right;">${formatCurrency(comparison.spouse1Result.liquidableGeneralBase)}</td>
              <td style="padding:10px; text-align:right;">${formatCurrency(comparison.spouse2Result.liquidableGeneralBase)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-elevated);">${formatCurrency(comparison.spouse1Result.liquidableGeneralBase + comparison.spouse2Result.liquidableGeneralBase)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-hover); font-weight:700;">${formatCurrency(comparison.jointResult.liquidableGeneralBase)}</td>
            </tr>
            <tr>
              <td style="padding:10px; color:var(--text-muted);">Mínim Personal i Familiar Exempt</td>
              <td style="padding:10px; text-align:right;">${formatCurrency(comparison.spouse1Result.totalMinimum)}</td>
              <td style="padding:10px; text-align:right;">${formatCurrency(comparison.spouse2Result.totalMinimum)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-elevated); font-weight:600; color:var(--color-info);">${formatCurrency(comparison.spouse1Result.totalMinimum + comparison.spouse2Result.totalMinimum)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-hover); font-weight:700;">${formatCurrency(comparison.jointResult.totalMinimum)}</td>
            </tr>

            <!-- Quotes i Deduccions -->
            <tr style="border-top:1px solid var(--border-default);">
              <td style="padding:10px;">Quota Íntegra Total</td>
              <td style="padding:10px; text-align:right;">${formatCurrency(comparison.spouse1Result.grossTax)}</td>
              <td style="padding:10px; text-align:right;">${formatCurrency(comparison.spouse2Result.grossTax)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-elevated);">${formatCurrency(comparison.spouse1Result.grossTax + comparison.spouse2Result.grossTax)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-hover); font-weight:700;">${formatCurrency(comparison.jointResult.grossTax)}</td>
            </tr>
            <tr>
              <td style="padding:10px; color:var(--color-success);">Deduccions Totals (Habitatge, Donatius, Catalunya...)</td>
              <td style="padding:10px; text-align:right;">-${formatCurrency(comparison.spouse1Result.totalDeductions)}</td>
              <td style="padding:10px; text-align:right;">-${formatCurrency(comparison.spouse2Result.totalDeductions)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-elevated); font-weight:600;">-${formatCurrency(comparison.spouse1Result.totalDeductions + comparison.spouse2Result.totalDeductions)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-hover); font-weight:700; color:var(--color-success);">-${formatCurrency(comparison.jointResult.totalDeductions)}</td>
            </tr>
            <tr style="border-top:1px solid var(--border-default); font-weight:700;">
              <td style="padding:10px;">Quota Líquida (Impostos Meritats)</td>
              <td style="padding:10px; text-align:right;">${formatCurrency(comparison.spouse1Result.netTax)}</td>
              <td style="padding:10px; text-align:right;">${formatCurrency(comparison.spouse2Result.netTax)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-elevated); font-size:var(--text-base);">${formatCurrency(comparison.sumIndividualsTax)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-hover); font-size:var(--text-base); color:var(--color-primary);">${formatCurrency(comparison.jointResult.netTax)}</td>
            </tr>

            <!-- Retencions i Resultat -->
            <tr>
              <td style="padding:10px; color:var(--text-muted);">Retencions i Pagaments a Compte Practicats</td>
              <td style="padding:10px; text-align:right;">-${formatCurrency(comparison.spouse1Result.totalWithholdings)}</td>
              <td style="padding:10px; text-align:right;">-${formatCurrency(comparison.spouse2Result.totalWithholdings)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-elevated); font-weight:600;">-${formatCurrency(comparison.spouse1Result.totalWithholdings + comparison.spouse2Result.totalWithholdings)}</td>
              <td style="padding:10px; text-align:right; background:var(--bg-surface-hover); font-weight:700;">-${formatCurrency(comparison.jointResult.totalWithholdings)}</td>
            </tr>
            <tr style="border-top:2px solid var(--border-default); font-size:var(--text-lg); font-weight:800;">
              <td style="padding:14px;">RESULTAT FINAL (A pagar / A tornar)</td>
              <td style="padding:14px; text-align:right;" class="${comparison.spouse1Result.result >= 0 ? 'text-error' : 'text-success'}">
                ${formatCurrency(comparison.spouse1Result.result)}
              </td>
              <td style="padding:14px; text-align:right;" class="${comparison.spouse2Result.result >= 0 ? 'text-error' : 'text-success'}">
                ${formatCurrency(comparison.spouse2Result.result)}
              </td>
              <td style="padding:14px; text-align:right; background:var(--bg-surface-elevated);" class="${comparison.sumIndividualsResult >= 0 ? 'text-error' : 'text-success'}">
                ${formatCurrency(comparison.sumIndividualsResult)}
              </td>
              <td style="padding:14px; text-align:right; background:var(--bg-surface-hover);" class="${comparison.jointResult.result >= 0 ? 'text-error' : 'text-success'}">
                ${formatCurrency(comparison.jointResult.result)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // Listeners
    page.querySelector('#select-profile-1')?.addEventListener('change', (e) => {
      profile1Id = (e.target as HTMLSelectElement).value;
      renderView();
    });

    page.querySelector('#select-profile-2')?.addEventListener('change', (e) => {
      profile2Id = (e.target as HTMLSelectElement).value;
      renderView();
    });

    page.querySelector('#check-single-parent')?.addEventListener('change', (e) => {
      isSingleParent = (e.target as HTMLInputElement).checked;
      renderView();
    });
  }

  renderView();
  return page;
}
