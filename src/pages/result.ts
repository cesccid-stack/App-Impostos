/**
 * @module pages/result
 * Resultat final, liquidació Model 100 AEAT, bossa de pèrdues de 4 anys, Radar de Risc d'Inspecció i descàrrega PDF.
 */

import { store } from '../store.ts';
import { calculateIRPF, effectiveRate } from '../fiscal/irpf.ts';
import { evaluateAuditRisk } from '../fiscal/audit-risk-radar.ts';
import {
  STATE_GENERAL_TAX_BRACKETS,
  STATE_SAVINGS_TAX_BRACKETS,
} from '../fiscal/constants.ts';
import { formatCurrency, formatPercent } from '../utils/currency.ts';
import { createStackedBar } from '../components/chart.ts';
import { generateModel100PDF } from '../utils/pdf-generator.ts';
import { showToast } from '../components/toast.ts';
import { calculateComplementaryIRPF } from '../fiscal/complementary-engine.ts';
import { createTaxJourneyVisualizer } from '../components/tax-journey-visualizer.ts';
import type { IRPFComplementaryReason } from '../types.ts';

export function renderResult(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container';

  function render() {
    const data = store.getData();
    const result = calculateIRPF(data);
    const auditRisk = evaluateAuditRisk(data, result);
    const compCalc = calculateComplementaryIRPF(data, result.result);
    const isComplementary = !!data.complementary?.isComplementary;

    const compData = data.complementary || {
      isComplementary: false,
      reason: 'other_higher_tax',
      previousReceiptNumber: '',
      previousResult: 0,
      monthsLate: 0,
      hasTaxOfficeNotice: false,
    };

    // Si és complementària, el resultat clau és el diferencial final degut
    const displayAmount = isComplementary ? compCalc.finalAmountDue : result.result;
    const isRefund = displayAmount < 0;
    const heroColorClass = isRefund ? 'result-hero__amount--negative' : 'result-hero__amount--positive';
    const heroLabelClass = isRefund ? 'result-hero__label--negative' : 'result-hero__label--positive';

    let heroLabel = isRefund ? '↩ A tornar per Hisenda (Casella 0610)' : '↗ A ingressar a Hisenda (Casella 0610)';
    if (isComplementary) {
      if (compCalc.type === 'to_pay_higher') {
        heroLabel = `⚡ Import diferencial a ingressar a la Complementària (Casella 0610 - Declaració Prèvia)`;
      } else if (compCalc.type === 'rectification_refund') {
        heroLabel = `⚡ Devolució sol·licitada en l'Autoliquidació Rectificativa (Ingressos Indeguts)`;
      } else {
        heroLabel = `⚡ Sense diferència econòmica respecte a la declaració anterior`;
      }
    }

    page.innerHTML = `
      <!-- Header amb botons d'acció -->
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-lg);">
        <div>
          <div style="display:flex; align-items:center; gap:var(--space-xs); flex-wrap:wrap;">
            <h1 class="page-header__title" style="margin:0;">Resultat de la declaració</h1>
            ${isComplementary ? '<span class="badge badge--warning" style="font-size:0.85rem; padding:4px 10px; font-weight:700;">⚡ MODALITAT COMPLEMENTÀRIA</span>' : ''}
          </div>
          <p class="page-header__subtitle" style="margin:4px 0 0 0;">Liquidació oficial de l'IRPF — Model 100 AEAT (${data.year})</p>
        </div>
        <div style="display:flex; gap:var(--space-sm); flex-wrap:wrap;">
          <button class="btn ${isComplementary ? 'btn--warning' : 'btn--secondary'}" id="btn-toggle-complementary" style="display:flex; align-items:center; gap:var(--space-xs); font-weight:600;">
            <span>${isComplementary ? '⚡' : '🔄'}</span>
            <span>${isComplementary ? 'Complementària Activa' : 'Fer Declaració Complementària'}</span>
          </button>
          <button class="btn btn--primary" id="btn-download-pdf" style="display:flex; align-items:center; gap:var(--space-xs); font-weight:700;">
            <span>🖨️</span>
            <span>Descarregar Model 100 (PDF)</span>
          </button>
        </div>
      </div>

      <!-- Hero result card -->
      <div class="card card--accent">
        <div class="result-hero">
          ${isComplementary ? `
            <div style="font-size:var(--text-xs); text-transform:uppercase; letter-spacing:0.08em; background:rgba(234, 179, 8, 0.15); color:var(--color-warning); padding:4px 12px; border-radius:var(--radius-full); display:inline-block; margin-bottom:var(--space-xs); font-weight:700;">
              Autoliquidació Complementària Activa (Art. 120-122 LGT)
            </div>
          ` : ''}
          <div class="result-hero__amount ${heroColorClass}">
            ${formatCurrency(Math.abs(displayAmount))}
          </div>
          <div class="result-hero__label ${heroLabelClass}">
            ${heroLabel}
          </div>
          ${isComplementary && compCalc.surcharge.finalSurchargeAmount > 0 ? `
            <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:var(--space-xs);">
              Inclou recàrrec d'extemporaneïtat Art. 27 LGT: <strong>+${formatCurrency(compCalc.surcharge.finalSurchargeAmount)}</strong> (${compCalc.surcharge.nominalRatePercentage}% - 25% bonificació)
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Panell d'Autoliquidació Complementària i Rectificativa (si està activa) -->
      ${isComplementary ? `
        <div class="card" id="complementary-card" style="margin-top:var(--space-lg); border:2px solid var(--color-warning); background:linear-gradient(180deg, rgba(234, 179, 8, 0.04) 0%, transparent 100%);">
          <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm); margin-bottom:var(--space-md);">
            <div>
              <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
                <span>⚡ Assistent de Declaració Complementària o Rectificativa (Model 100)</span>
                <span class="badge badge--warning">Art. 120-122 LGT</span>
              </div>
              <div class="card__subtitle">Regularitza declaracions ja presentades d'aquest exercici ${data.year} amb càlcul automàtic de diferències i recàrrecs</div>
            </div>
            <button class="btn btn--secondary btn--sm" id="btn-disable-complementary" style="color:var(--color-error); font-weight:600;">
              ❌ Desactivar Complementària
            </button>
          </div>

          <!-- Formulari de paràmetres de la complementària -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:var(--space-md); background:var(--bg-surface-elevated); padding:var(--space-md); border-radius:var(--radius-md); margin-bottom:var(--space-lg); border:1px solid var(--border-default);">
            <div>
              <label class="form-label" style="font-weight:600; font-size:var(--text-xs);">📌 Motiu Oficial de la Complementària (Caselles 0120 - 0127 AEAT):</label>
              <select class="form-input form-select" id="comp-reason" style="width:100%;">
                <option value="arrears_work" ${compData.reason === 'arrears_work' ? 'selected' : ''}>Atrasos de rendiments del treball meritats en anys previs (Art. 14.2.b LIRPF) [Sense recàrrecs]</option>
                <option value="loss_deductions" ${compData.reason === 'loss_deductions' ? 'selected' : ''}>Pèrdua del dret a deduccions aplicades en anys anteriors (Art. 14.2.d LIRPF)</option>
                <option value="change_residence" ${compData.reason === 'change_residence' ? 'selected' : ''}>Pèrdua de la condició de contribuent per canvi de residència (Art. 14.3 LIRPF)</option>
                <option value="other_higher_tax" ${compData.reason === 'other_higher_tax' ? 'selected' : ''}>Altres motius (Resultat a ingressar superior o menor devolució)</option>
                <option value="rectification" ${compData.reason === 'rectification' ? 'selected' : ''}>Autoliquidació Rectificativa (Sol·licitud d'ingrés indegut o major devolució)</option>
              </select>
            </div>

            <div>
              <label class="form-label" style="font-weight:600; font-size:var(--text-xs);">🧾 Núm. de Justificant de la Declaració Originària (Casella 0120):</label>
              <input type="text" class="form-input" id="comp-prev-receipt" placeholder="Ex: 100202400012345 (13 dígits)" value="${compData.previousReceiptNumber || ''}" style="width:100%; font-family:var(--font-mono);" />
            </div>

            <div>
              <label class="form-label" style="font-weight:600; font-size:var(--text-xs);">💶 Resultat Ingressat (+) o Devolució Percebuda (-) en l'anterior Declaració (€):</label>
              <input type="number" step="0.01" class="form-input" id="comp-prev-result" placeholder="Ex: 450.00 o -200.00" value="${compData.previousResult || 0}" style="width:100%; font-weight:700;" />
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Positiu si vas pagar; Negatiu si Hisenda et va retornar.</div>
            </div>

            <div>
              <label class="form-label" style="font-weight:600; font-size:var(--text-xs);">⏱️ Mesos de Retard des de la Fi del Termini Voluntari (30 de juny):</label>
              <input type="number" min="0" max="48" class="form-input" id="comp-months-late" value="${compData.monthsLate || 0}" style="width:100%;" />
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Per al càlcul de recàrrec d'extemporaneïtat Art. 27 LGT (1% per mes o 15%).</div>
            </div>
          </div>

          <!-- Taula de Liquidació Diferencial de la Complementària -->
          <div style="border-radius:var(--radius-md); overflow:hidden; border:1px solid var(--border-default);">
            <table class="data-table" style="width:100%; font-size:var(--text-sm);">
              <thead style="background:var(--bg-surface-elevated);">
                <tr>
                  <th>Concepte Liquidatori de la Complementària</th>
                  <th>Casella AEAT</th>
                  <th style="text-align:right;">Import (€)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Resultat de la Nova Declaració Completa (Calculat)</td>
                  <td><span class="badge badge--sm">0610</span></td>
                  <td style="text-align:right; font-weight:600;">${formatCurrency(result.result)}</td>
                </tr>
                <tr>
                  <td>(-) Resultat Ingressat o (+) Devolució practicada en la Declaració Anterior</td>
                  <td><span class="badge badge--sm">0611 / Ant.</span></td>
                  <td style="text-align:right; color:var(--text-secondary);">${formatCurrency(compCalc.previousResult)}</td>
                </tr>
                <tr style="background:var(--bg-surface-elevated); font-weight:700;">
                  <td>(=) RESULTAT DIFERENCIAL DE LA COMPLEMENTÀRIA</td>
                  <td><span class="badge badge--primary badge--sm">DIF</span></td>
                  <td style="text-align:right; color:${compCalc.differentialAmount > 0 ? 'var(--color-error)' : 'var(--color-success)'}; font-size:var(--text-md);">
                    ${formatCurrency(compCalc.differentialAmount)}
                  </td>
                </tr>
                ${compCalc.surcharge.finalSurchargeAmount > 0 ? `
                  <tr>
                    <td>
                      <div>(+) Recàrrec per Declaració Extemporània (Art. 27 LGT)</div>
                      <div style="font-size:0.75rem; color:var(--text-muted);">${compCalc.surcharge.legalBasis}</div>
                    </td>
                    <td><span class="badge badge--sm">Art. 27 LGT</span></td>
                    <td style="text-align:right; color:var(--color-warning); font-weight:600;">
                      +${formatCurrency(compCalc.surcharge.finalSurchargeAmount)}
                    </td>
                  </tr>
                ` : ''}
                <tr style="background:${compCalc.finalAmountDue > 0 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; font-weight:800; font-size:var(--text-base);">
                  <td>TOTAL EFECTIU A LIQUIDAR / INGRESAR</td>
                  <td><span class="badge badge--warning">TOTAL</span></td>
                  <td style="text-align:right; color:${compCalc.finalAmountDue > 0 ? 'var(--color-warning)' : 'var(--color-success)'}; font-size:var(--text-lg);">
                    ${formatCurrency(Math.abs(compCalc.finalAmountDue))} ${compCalc.finalAmountDue > 0 ? '(A ingressar)' : '(A retornar)'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Explicador Didàctic & Cuadro de Mando Visual de la Renta -->
      <div id="result-tax-journey-mount" style="margin-top:var(--space-lg);"></div>

      <!-- Radar de risc d'inspecció AEAT -->
      <div class="card" style="margin-top:var(--space-lg); border:2px solid ${auditRisk.riskLevel === 'high' ? 'var(--color-error)' : auditRisk.riskLevel === 'medium' ? 'var(--color-warning)' : 'var(--color-success)'};">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm); margin-bottom:var(--space-md);">
          <div>
            <div class="card__title" style="display:flex; align-items:center; gap:var(--space-xs);">
              <span>🛡️ Radar de Risc d'Inspecció AEAT (Audit Risk Radar)</span>
              <span class="badge ${auditRisk.riskLevel === 'high' ? 'badge--error' : auditRisk.riskLevel === 'medium' ? 'badge--warning' : 'badge--success'}">
                Score: ${auditRisk.overallRiskScore} / 100 (${auditRisk.riskLevel.toUpperCase()})
              </span>
            </div>
            <div class="card__subtitle">Avaluació preventiva de patrons que disparen comprovacions tributàries abans de presentar</div>
          </div>
        </div>

        <!-- Alertes de risc detectades -->
        <div style="display:flex; flex-direction:column; gap:var(--space-sm); margin-bottom:var(--space-lg);">
          ${auditRisk.alerts.length > 0 ? auditRisk.alerts.map(al => `
            <div style="background:var(--bg-surface-elevated); border-left:4px solid ${al.severity === 'high' ? 'var(--color-error)' : 'var(--color-warning)'}; padding:10px 14px; border-radius:var(--radius-sm); font-size:var(--text-sm);">
              <div style="font-weight:700; color:var(--text-primary); margin-bottom:2px;">${al.title}</div>
              <div style="color:var(--text-secondary); margin-bottom:4px;">${al.description}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); background:var(--bg-surface); padding:6px 8px; border-radius:var(--radius-sm);">
                <strong>📌 Motiu AEAT:</strong> ${al.aeatTriggerReason}<br>
                <strong>🛡️ Prova Recomanada:</strong> ${al.recommendedProof}
              </div>
            </div>
          `).join('') : '<div class="text-success text-sm">✅ Declaració extremadament neta: No s\'han detectat patrons d\'alt risc.</div>'}
        </div>

        <!-- Checklist documental 4 anys -->
        <div style="border-top:1px dashed var(--border-default); padding-top:var(--space-md);">
          <h4 style="margin:0 0 var(--space-xs) 0; font-size:var(--text-sm);">📂 Justificants Obligatoris a Conservar durant 4 Anys (Art. 66-70 LGT)</h4>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:6px;">
            ${auditRisk.documentaryChecklist.map(doc => `
              <div style="display:flex; align-items:center; gap:8px; font-size:0.75rem; color:var(--text-secondary);">
                <span>📁</span>
                <span>${doc.documentName}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Tipus efectius d'imposició -->
      <div class="card" style="margin-top:var(--space-lg);">
        <div class="card__header">
          <div class="card__title">Tipus efectius d'imposició</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--space-lg);text-align:center;">
          <div>
            <div class="stat-value text-accent" style="font-size:var(--text-2xl);">${formatPercent(result.generalBase + result.savingsBase > 0 ? result.netTax / (result.generalBase + result.savingsBase) : 0)}</div>
            <div class="stat-label">Tipus efectiu global</div>
          </div>
          <div>
            <div class="stat-value" style="font-size:var(--text-2xl);color:var(--accent-start);">${formatPercent(effectiveRate(result.liquidableGeneralBase, STATE_GENERAL_TAX_BRACKETS))}</div>
            <div class="stat-label">Tipus efectiu general</div>
          </div>
          <div>
            <div class="stat-value" style="font-size:var(--text-2xl);color:var(--accent-end);">${formatPercent(effectiveRate(result.liquidableSavingsBase, STATE_SAVINGS_TAX_BRACKETS))}</div>
            <div class="stat-label">Tipus efectiu estalvi</div>
          </div>
        </div>
      </div>

      <!-- Taula de Liquidació Oficial Model 100 -->
      <div class="card" style="margin-top:var(--space-lg);">
        <div class="card__header">
          <div class="card__title">Resum Liquidatori Oficial AEAT (Model 100)</div>
        </div>
        <div style="overflow-x:auto;">
          <table class="table" style="width:100%;">
            <tbody>
              ${tableSection('BASE IMPOSABLE GENERAL I DE L\'ESTALVI')}
              ${tableRow('Rendiments nets del treball (Casella 0022)', (data.workIncome?.employers || []).reduce((s, e) => s + (e.grossSalary || 0) - (e.socialSecurity || 0), 0))}
              ${tableRow('Rendiments del capital immobiliari (Casella 0156)', result.generalBase > 0 ? result.generalBase * 0.3 : 0)}
              ${tableRow('Rendiments d\'activitats econòmiques (Casella 0235)', data.activities?.income ? data.activities.income - data.activities.expenses : 0)}
              ${tableRow('Base imposable general (Casella 0435)', result.generalBase, true)}
              ${tableRow('Base imposable de l\'estalvi (Casella 0460)', result.savingsBase, true)}
              
              ${tableSection('REDUCCIONS I BASES LIQUIDABLES')}
              ${result.jointTaxationReduction ? tableRow('Reducció tributació conjunta (Casella 0495)', -result.jointTaxationReduction) : ''}
              ${tableRow('Base liquidable general (Casella 0500)', result.liquidableGeneralBase, true)}
              ${tableRow('Base liquidable de l\'estalvi (Casella 0510)', result.liquidableSavingsBase, true)}
              
              ${tableSection('MÍNIM PERSONAL I FAMILIAR')}
              ${tableRow('Mínim del contribuent (Casella 0511)', 5550)}
              ${tableRow('Mínim per descendents i ascendents (Casella 0519)', Math.max(0, result.totalMinimum - 5550))}
              ${tableRow('Total mínim personal i familiar (Casella 0520)', result.totalMinimum, true)}
              
              ${tableSection('QUOTES ÍNTEGRES')}
              ${tableRow('Quota íntegra general (Casella 0545/0546)', result.generalTax)}
              ${tableRow('Quota íntegra de l\'estalvi (Casella 0550/0551)', result.savingsTax)}
              ${tableRow('Minoració per mínim personal i familiar', -result.minimumTaxCredit)}
              ${tableRow('Suma quotes íntegres (Casella 0552)', result.generalTax + result.savingsTax, true)}
              
              ${tableSection('DEDUCCIONS')}
              ${tableRow('Deduccions estatals (Habitatge, Donatius)', -(result.totalDeductions - result.catalanDeductionsAmount))}
              ${tableRow('Deduccions autonòmiques de Catalunya (Lloguer, etc.)', -result.catalanDeductionsAmount)}
              ${result.foreignTaxCredit ? tableRow('Doble imposició internacional (Casella 0588)', -result.foreignTaxCredit) : ''}
              ${tableRow('Total deduccions (Casella 0595)', -result.totalDeductions, true)}
              
              ${tableSection('RESULTAT DE LA LIQUIDACIÓ')}
              ${tableRow('Quota líquida total (Casella 0599)', result.netTax)}
              ${tableRow('Retencions i pagaments a compte (Casella 0609)', -result.totalWithholdings)}
              <tr style="background:${isRefund ? 'var(--color-success-soft)' : 'var(--color-error-soft)'}">
                <td style="font-weight:700;font-size:var(--text-base);">
                  ${isRefund ? '🔄 RESULTAT DE L\'EXERCICI (Casella 0610)' : '📤 RESULTAT DE L\'EXERCICI (Casella 0610)'}
                </td>
                <td class="mono" style="text-align:right;font-weight:700;font-size:var(--text-base);color:${isRefund ? 'var(--color-success)' : 'var(--color-error)'};">
                  ${formatCurrency(Math.abs(result.result))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Distribució per trams IRPF -->
      <div class="card" id="brackets-card-container" style="margin-top:var(--space-lg);">
        <div class="card__header">
          <div class="card__title">Distribució per trams IRPF</div>
          <div class="card__subtitle">Base general: ${formatCurrency(result.liquidableGeneralBase)}</div>
        </div>
      </div>
    `;

    // Gràfic de trams
    const bracketsCard = page.querySelector('#brackets-card-container');
    if (bracketsCard) {
      const bracketItems = STATE_GENERAL_TAX_BRACKETS.map((bracket: any, i: number) => {
        const prevLimit = i === 0 ? 0 : STATE_GENERAL_TAX_BRACKETS[i - 1].upTo;
        const tierSize = bracket.upTo === Infinity ? result.liquidableGeneralBase - prevLimit : bracket.upTo - prevLimit;
        const taxableInTier = Math.max(0, Math.min(result.liquidableGeneralBase - prevLimit, tierSize));

        return {
          label: bracket.upTo === Infinity
            ? `> ${formatCurrency(prevLimit)} (${(bracket.rate * 100).toFixed(0)}%)`
            : `${formatCurrency(prevLimit)} – ${formatCurrency(bracket.upTo)} (${(bracket.rate * 100).toFixed(0)}%)`,
          value: taxableInTier,
        };
      }).filter((item: any) => item.value > 0);

      bracketsCard.appendChild(createStackedBar(bracketItems));

      const legendDiv = document.createElement('div');
      legendDiv.className = 'chart-legend';
      legendDiv.style.marginTop = '12px';
      const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];
      bracketItems.forEach((item: any, i: number) => {
        const el = document.createElement('div');
        el.className = 'chart-legend__item';
        el.innerHTML = `
          <span class="chart-legend__dot" style="background:${colors[i % colors.length]}"></span>
          <span>${item.label}: ${formatCurrency(item.value)}</span>
        `;
        legendDiv.appendChild(el);
      });
      bracketsCard.appendChild(legendDiv);
    }

    // ═════════════════════════════════════════════════════════════
    // BINDING D'EVENTS INTERACTIUS AMB RE-RENDER
    // ═════════════════════════════════════════════════════════════
    page.querySelector('#btn-download-pdf')?.addEventListener('click', () => {
      try {
        generateModel100PDF(data, result);
        showToast('PDF del Model 100 generat correctament', 'success');
      } catch {
        showToast('Error en generar el PDF', 'error');
      }
    });

    page.querySelector('#btn-toggle-complementary')?.addEventListener('click', () => {
      store.updateComplementary({
        isComplementary: !isComplementary,
        reason: compData.reason || 'other_higher_tax',
        previousReceiptNumber: compData.previousReceiptNumber || '',
        previousResult: compData.previousResult || 0,
        monthsLate: compData.monthsLate || 0,
      });
      showToast(isComplementary ? 'Declaració ordinària restaurada' : 'Modalitat de Declaració Complementària activada', 'info');
      render();
    });

    page.querySelector('#btn-disable-complementary')?.addEventListener('click', () => {
      store.updateComplementary({ isComplementary: false });
      showToast('Declaració ordinària restaurada', 'info');
      render();
    });

    page.querySelector('#comp-reason')?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      store.updateComplementary({ reason: target.value as IRPFComplementaryReason });
      render();
    });

    page.querySelector('#comp-prev-receipt')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      store.updateComplementary({ previousReceiptNumber: target.value });
    });

    page.querySelector('#comp-prev-result')?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      store.updateComplementary({ previousResult: parseFloat(target.value) || 0 });
      render();
    });

    page.querySelector('#comp-months-late')?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      store.updateComplementary({ monthsLate: parseInt(target.value, 10) || 0 });
      render();
    });

    // Mount Tax Journey Visualizer
    const journeyMount = page.querySelector('#result-tax-journey-mount');
    if (journeyMount) {
      journeyMount.innerHTML = '';
      journeyMount.appendChild(createTaxJourneyVisualizer(data, result));
    }
  }

  render();
  return page;
}

function tableRow(label: string, value: number, bold = false): string {
  return `
    <tr>
      <td style="${bold ? 'font-weight:600;' : ''}">${label}</td>
      <td class="mono" style="text-align:right;${bold ? 'font-weight:600;' : ''}">${formatCurrency(value)}</td>
    </tr>
  `;
}

function tableSection(title: string): string {
  return `
    <tr>
      <td colspan="2" style="font-weight:700;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);padding-top:var(--space-lg);border-bottom:1px solid var(--border-default);">
        ${title}
      </td>
    </tr>
  `;
}

