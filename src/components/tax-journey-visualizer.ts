/**
 * @module components/tax-journey-visualizer
 * Component visual avançat: El Viatge dels teus Impostos & Explicador Didàctic Integral.
 * Desglossa qualsevol declaració de renda (per complexa que sigui) en una experiència visual
 * intuïtiva, amb gràfics en cascada, barres de trams, targetes explicatives i oportunitats d'estalvi.
 */

import { explainTaxReturn, type TaxExplainerReport, type TaxFlowStep } from '../fiscal/tax-explainer-engine.ts';
import { formatCurrency } from '../utils/currency.ts';
import type { DeclaracionData, FiscalResult } from '../types.ts';

export function createTaxJourneyVisualizer(data: DeclaracionData, result?: FiscalResult): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tax-journey-container';

  const report: TaxExplainerReport = explainTaxReturn(data, result);

  let activeViewMode: 'simple' | 'waterfall' | 'brackets' | 'drivers' = 'simple';

  function renderContent() {
    container.innerHTML = `
      <div class="card" style="margin-bottom:var(--space-xl); border:1px solid var(--border-accent); background:linear-gradient(145deg, rgba(99, 102, 241, 0.04), var(--bg-surface-elevated)); box-shadow:var(--shadow-md);">
        
        <!-- Header amb Selector de Vistes Didàctiques -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-md); padding-bottom:var(--space-md); border-bottom:1px solid var(--border-default); margin-bottom:var(--space-lg);">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.4rem;">🧭</span>
              <h2 style="margin:0; font-size:1.25rem; font-weight:800; color:var(--text-primary);">
                Cuadro de Mando Visual & Explicador Didáctico de la Renta
              </h2>
              <span class="badge badge--primary" style="font-size:0.75rem;">Model 100 AEAT</span>
            </div>
            <p style="margin:4px 0 0 0; font-size:0.85rem; color:var(--text-secondary);">
              Comprensió total i transparent de la teva declaració: d'on surt cada euro, per què pagues o et tornen i com optimitzar-ho.
            </p>
          </div>

          <!-- Botons de Mode Didàctic -->
          <div style="display:flex; background:var(--bg-base); padding:3px; border-radius:var(--radius-md); border:1px solid var(--border-default); gap:2px; flex-wrap:wrap;">
            <button class="btn-mode-toggle ${activeViewMode === 'simple' ? 'active-mode' : ''}" data-mode="simple" style="padding:6px 12px; font-size:0.8rem; font-weight:600; border-radius:var(--radius-sm); border:none; background:${activeViewMode === 'simple' ? 'var(--color-primary)' : 'transparent'}; color:${activeViewMode === 'simple' ? '#fff' : 'var(--text-secondary)'}; cursor:pointer;">
              💬 En Paraules Clares
            </button>
            <button class="btn-mode-toggle ${activeViewMode === 'waterfall' ? 'active-mode' : ''}" data-mode="waterfall" style="padding:6px 12px; font-size:0.8rem; font-weight:600; border-radius:var(--radius-sm); border:none; background:${activeViewMode === 'waterfall' ? 'var(--color-primary)' : 'transparent'}; color:${activeViewMode === 'waterfall' ? '#fff' : 'var(--text-secondary)'}; cursor:pointer;">
              🌊 Cascada de Renda (10 Passos)
            </button>
            <button class="btn-mode-toggle ${activeViewMode === 'brackets' ? 'active-mode' : ''}" data-mode="brackets" style="padding:6px 12px; font-size:0.8rem; font-weight:600; border-radius:var(--radius-sm); border:none; background:${activeViewMode === 'brackets' ? 'var(--color-primary)' : 'transparent'}; color:${activeViewMode === 'brackets' ? '#fff' : 'var(--text-secondary)'}; cursor:pointer;">
              📊 Trams & Tipus Marginal
            </button>
            <button class="btn-mode-toggle ${activeViewMode === 'drivers' ? 'active-mode' : ''}" data-mode="drivers" style="padding:6px 12px; font-size:0.8rem; font-weight:600; border-radius:var(--radius-sm); border:none; background:${activeViewMode === 'drivers' ? 'var(--color-primary)' : 'transparent'}; color:${activeViewMode === 'drivers' ? '#fff' : 'var(--text-secondary)'}; cursor:pointer;">
              🔍 Motors de la Declaració (${report.keyDrivers.length})
            </button>
          </div>
        </div>

        <!-- KPI Strip Ràpid Superior -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-lg);">
          
          <div style="background:var(--bg-surface); padding:12px 16px; border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Ingressos Bruts Totals</div>
            <div style="font-size:1.3rem; font-weight:800; color:var(--text-primary); margin-top:2px;">
              ${formatCurrency(report.totalGrossIncome)}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">Base Liquidable: ${formatCurrency(report.liquidableGeneralBase + report.liquidableSavingsBase)}</div>
          </div>

          <div style="background:var(--bg-surface); padding:12px 16px; border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Impost Real (Quota Líquida)</div>
            <div style="font-size:1.3rem; font-weight:800; color:var(--color-primary); margin-top:2px;">
              ${formatCurrency(report.netTax)}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">Tipus efectiu real: <strong>${report.overallEffectiveRate}%</strong></div>
          </div>

          <div style="background:var(--bg-surface); padding:12px 16px; border-radius:var(--radius-md); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Retencions Avançades</div>
            <div style="font-size:1.3rem; font-weight:800; color:var(--color-warning); margin-top:2px;">
              ${formatCurrency(report.totalWithholdings)}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">Avançat en nòmines i pagaments</div>
          </div>

          <div style="background:var(--bg-surface); padding:12px 16px; border-radius:var(--radius-md); border:1px solid ${report.isRefund ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}; background:${report.isRefund ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'};">
            <div style="font-size:0.7rem; color:${report.isRefund ? 'var(--color-success)' : 'var(--color-error)'}; text-transform:uppercase; font-weight:800;">
              Resultat Final Casella 0610
            </div>
            <div style="font-size:1.4rem; font-weight:900; color:${report.isRefund ? 'var(--color-success)' : 'var(--color-error)'}; margin-top:2px;">
              ${report.isRefund ? '↩ DEVOLUCIÓ: ' : '↗ A PAGAR: '}${formatCurrency(Math.abs(report.finalResult))}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">
              ${report.isRefund ? 'Hisenda et fa una transferència' : 'Pendent de liquidar a Hisenda'}
            </div>
          </div>

        </div>

        <!-- Contingut Segons la Vista Seleccionada -->
        <div id="tax-journey-body">
          ${renderActiveModeContent()}
        </div>

      </div>
    `;

    attachEvents();
  }

  function renderActiveModeContent(): string {
    if (activeViewMode === 'simple') {
      return renderSimplePlainLanguageView();
    } else if (activeViewMode === 'waterfall') {
      return renderWaterfallView();
    } else if (activeViewMode === 'brackets') {
      return renderBracketsView();
    } else {
      return renderDriversView();
    }
  }

  // 1. Vista Simple / Llenguatge Planer
  function renderSimplePlainLanguageView(): string {
    return `
      <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:var(--space-xl); align-items:start;">
        
        <!-- Narrativa Explicativa -->
        <div>
          <div style="background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border-left:4px solid var(--color-primary); margin-bottom:var(--space-md);">
            <h3 style="margin:0 0 var(--space-xs) 0; font-size:1rem; font-weight:700; color:var(--text-primary);">
              📝 Resum Executiu de la teva Renda ${report.year}
            </h3>
            <ul style="margin:0; padding-left:1.2rem; font-size:0.85rem; line-height:1.6; color:var(--text-secondary);">
              ${report.plainLanguageSummary.map(item => `<li style="margin-bottom:6px;">${item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`).join('')}
            </ul>
          </div>

          <!-- 3 Conceptes Fiscals Clau Desmitificats -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-sm);">
            
            <div style="padding:10px 12px; background:var(--bg-surface); border-radius:var(--radius-md); border:1px solid var(--border-default);">
              <div style="font-size:0.75rem; font-weight:700; color:var(--color-primary); margin-bottom:2px;">
                🎯 Tipus Marginal (${report.marginalRateGeneral}%)
              </div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">
                Si guanyes 1.000 € més o dedueixes 1.000 €, Hisenda s'emportarà o t'estalviarà exactament <strong>${(report.marginalRateGeneral * 10).toFixed(0)} €</strong>.
              </div>
            </div>

            <div style="padding:10px 12px; background:var(--bg-surface); border-radius:var(--radius-md); border:1px solid var(--border-default);">
              <div style="font-size:0.75rem; font-weight:700; color:var(--color-success); margin-bottom:2px;">
                🛡️ Mínim Exempt (${(data.personal?.age || 30) >= 65 ? '6.700 €' : '5.550 €'})
              </div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">
                Els primers diners que guanyes estan completament lliures d'impostos per garantir la teva subsistència personal i familiar.
              </div>
            </div>

            <div style="padding:10px 12px; background:var(--bg-surface); border-radius:var(--radius-md); border:1px solid var(--border-default);">
              <div style="font-size:0.75rem; font-weight:700; color:var(--color-info); margin-bottom:2px;">
                💡 Quota Líquida vs Retencions
              </div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">
                La quota líquida (${formatCurrency(report.netTax)}) és el teu impost real. El resultat (+ / -) només és l'ajust amb el que ja havies avançat.
              </div>
            </div>

          </div>
        </div>

        <!-- On van els teus Diners (Pie & Eficiència) -->
        <div style="background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-sm);">
            <span style="font-weight:700; font-size:0.85rem; text-transform:uppercase; color:var(--text-muted);">
              💶 Destí dels teus Ingressos Bruts
            </span>
            <span class="badge badge--success" style="font-size:0.7rem;">Eficiència: ${report.efficiencyScore}/100</span>
          </div>

          <!-- Progress Bar Dividit -->
          <div style="height:18px; border-radius:var(--radius-full); overflow:hidden; display:flex; margin-bottom:var(--space-md); background:var(--bg-base);">
            ${report.taxBreakdownPie.map(p => `
              <div style="width:${p.percentage}%; background:${p.color}; height:100%;" title="${p.label}: ${p.percentage}% (${formatCurrency(p.amount)})"></div>
            `).join('')}
          </div>

          <!-- Llegenda -->
          <div style="display:flex; flex-direction:column; gap:8px; font-size:0.8rem;">
            ${report.taxBreakdownPie.map(p => `
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span style="width:10px; height:10px; border-radius:50%; background:${p.color}; display:inline-block;"></span>
                  <span style="color:var(--text-secondary);">${p.label}</span>
                </div>
                <div style="font-weight:700; font-family:var(--font-mono);">${formatCurrency(p.amount)} <span style="font-size:0.7rem; color:var(--text-muted);">(${p.percentage}%)</span></div>
              </div>
            `).join('')}
          </div>

          <!-- Alerta d'Oportunitat d'Estalvi -->
          ${report.unclaimedSavingsOpportunities.length > 0 ? `
            <div style="margin-top:var(--space-md); padding-top:var(--space-sm); border-top:1px dashed var(--border-default);">
              <div style="font-size:0.75rem; font-weight:700; color:var(--color-warning); margin-bottom:4px;">
                ⚡ Oportunitat d'Estalvi Identificada:
              </div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">
                ${report.unclaimedSavingsOpportunities[0].title} — Estalvi estimat: <strong>+${formatCurrency(report.unclaimedSavingsOpportunities[0].estimatedSavings)}</strong>.
              </div>
              <a href="${report.unclaimedSavingsOpportunities[0].actionLink}" style="font-size:0.75rem; color:var(--color-primary); font-weight:600; text-decoration:none; display:inline-block; margin-top:4px;">
                Aplicar ara a la declaració ➡️
              </a>
            </div>
          ` : ''}

        </div>

      </div>
    `;
  }

  // 2. Vista Cascada / Waterfall de 10 Passos
  function renderWaterfallView(): string {
    return `
      <div>
        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:var(--space-md);">
          A continuació es detalla cada pas del càlcul fiscal des dels teus ingressos bruts fins a la liquidació final de la Casella 0610:
        </p>

        <div style="display:flex; flex-direction:column; gap:8px;">
          ${report.flowSteps.map((step: TaxFlowStep) => {
            const isNegative = step.deltaAmount < 0;

            return `
              <div class="waterfall-step-card" style="background:var(--bg-surface); border-radius:var(--radius-md); border:1px solid var(--border-default); padding:12px 16px; transition:all 0.2s ease;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                  
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span style="width:28px; height:28px; border-radius:50%; background:var(--bg-surface-elevated); border:1px solid var(--border-default); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.8rem; color:var(--color-primary);">
                      ${step.stepNumber}
                    </span>
                    <div>
                      <div style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">
                        ${step.title}
                      </div>
                      <div style="font-size:0.75rem; color:var(--text-muted);">
                        ${step.lawArticle} | Caselles AEAT: <strong>${step.aeatBoxes.join(', ')}</strong>
                      </div>
                    </div>
                  </div>

                  <div style="text-align:right;">
                    <div style="font-size:1.15rem; font-weight:800; font-family:var(--font-mono); color:${isNegative ? 'var(--color-success)' : (step.category === 'final' ? (report.isRefund ? 'var(--color-success)' : 'var(--color-error)') : 'var(--text-primary)')};">
                      ${isNegative ? '- ' : ''}${formatCurrency(step.amount)}
                    </div>
                    <div style="font-size:0.7rem; color:var(--text-secondary);">
                      Acumulat: ${formatCurrency(step.runningTotal)}
                    </div>
                  </div>

                </div>

                <!-- Explicació Didàctica i Detalls Tècnics -->
                <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border-default); display:grid; grid-template-columns: 1.2fr 1fr; gap:var(--space-md); font-size:0.75rem;">
                  <div style="color:var(--text-secondary);">
                    💡 <strong>En llenguatge planer:</strong> ${step.simpleExplanation}
                  </div>
                  <div style="color:var(--text-muted); font-family:var(--font-mono); font-size:0.7rem; background:var(--bg-base); padding:4px 8px; border-radius:var(--radius-sm);">
                    ⚙️ ${step.technicalDetails}
                  </div>
                </div>

              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // 3. Vista de Trams i Tipus Marginal (Brackets)
  function renderBracketsView(): string {
    return `
      <div>
        <div style="background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default); margin-bottom:var(--space-lg);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm); margin-bottom:var(--space-sm);">
            <div>
              <div style="font-size:1rem; font-weight:800; color:var(--text-primary);">
                🌡️ Termòmetre de Trams IRPF (Escala General Estatal + Autonòmica)
              </div>
              <p style="margin:2px 0 0 0; font-size:0.8rem; color:var(--text-secondary);">
                A Espanya l'impost és progressiu: només pagues el tipus alt pels diners que superen cada llindar, no per tot el sou.
              </p>
            </div>
            <div style="text-align:right;">
              <span class="badge badge--warning" style="font-size:0.8rem; font-weight:700;">
                El teu Tipus Marginal: ${report.marginalRateGeneral}%
              </span>
              ${report.eurosToNextBracket > 0 ? `
                <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:2px;">
                  Queden <strong>${formatCurrency(report.eurosToNextBracket)}</strong> per saltar al tram del ${report.nextBracketRate}%
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Escala Visual de Trams -->
          <div style="display:flex; flex-direction:column; gap:6px; margin-top:var(--space-md);">
            ${report.generalBracketBreakdown.map((b) => {
              const isFilled = b.taxedAmountInBracket > 0;
              const isCurrent = b.isCurrentBracket;

              return `
                <div style="background:${isCurrent ? 'rgba(99, 102, 241, 0.12)' : (isFilled ? 'var(--bg-surface-elevated)' : 'var(--bg-base)')}; border:1px solid ${isCurrent ? 'var(--color-primary)' : 'var(--border-default)'}; border-radius:var(--radius-md); padding:10px 14px; display:grid; grid-template-columns: 140px 80px 1fr 120px; align-items:center; gap:var(--space-md);">
                  
                  <div style="font-weight:${isCurrent ? '800' : '600'}; font-size:0.8rem; color:${isCurrent ? 'var(--color-primary)' : 'var(--text-primary)'};">
                    ${isCurrent ? '👉 ' : ''}Tram ${b.bracketIndex}
                    <div style="font-size:0.65rem; color:var(--text-muted); font-weight:normal;">${b.rangeLabel}</div>
                  </div>

                  <div>
                    <span class="badge ${isCurrent ? 'badge--primary' : 'badge--neutral'}" style="font-size:0.75rem; font-weight:700;">
                      ${b.applicableRatePercent}%
                    </span>
                  </div>

                  <div>
                    <div style="display:flex; justify-content:space-between; font-size:0.7rem; margin-bottom:2px; color:var(--text-secondary);">
                      <span>Base gravada en aquest tram:</span>
                      <strong style="font-family:var(--font-mono);">${formatCurrency(b.taxedAmountInBracket)}</strong>
                    </div>
                    <div style="height:6px; background:var(--bg-base); border-radius:var(--radius-full); overflow:hidden;">
                      <div style="height:100%; width:${b.limitMax === Infinity ? (b.taxedAmountInBracket > 0 ? 100 : 0) : Math.min(100, (b.taxedAmountInBracket / (b.limitMax - b.limitMin)) * 100)}%; background:${isCurrent ? 'var(--color-primary)' : (isFilled ? 'var(--color-info)' : 'transparent')}; border-radius:var(--radius-full);"></div>
                    </div>
                  </div>

                  <div style="text-align:right;">
                    <div style="font-size:0.85rem; font-weight:800; font-family:var(--font-mono); color:var(--text-primary);">
                      ${formatCurrency(b.taxPaidInBracket)}
                    </div>
                    <div style="font-size:0.65rem; color:var(--text-muted);">Impost del tram</div>
                  </div>

                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Trams de l'Estalvi (Dividends, Borsa, Cripto) -->
        <div style="background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-sm);">
            <div style="font-size:0.95rem; font-weight:700; color:var(--text-primary);">
              📈 Escala de l'Estalvi (Rendes del Capital & Inversions)
            </div>
            <span class="badge badge--info">Base Estalvi: ${formatCurrency(report.liquidableSavingsBase)}</span>
          </div>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:var(--space-sm);">
            ${report.savingsBracketBreakdown.map(sb => `
              <div style="padding:8px 10px; background:var(--bg-surface-elevated); border-radius:var(--radius-md); border:1px solid ${sb.isCurrentBracket ? 'var(--color-primary)' : 'var(--border-default)'}; font-size:0.75rem;">
                <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:2px;">
                  <span>${sb.rangeLabel}</span>
                  <span class="badge badge--primary" style="font-size:0.65rem;">${sb.applicableRatePercent}%</span>
                </div>
                <div style="color:var(--text-muted); font-size:0.7rem;">Gravat: ${formatCurrency(sb.taxedAmountInBracket)}</div>
                <div style="color:var(--text-primary); font-weight:700; font-family:var(--font-mono); margin-top:2px;">Impost: ${formatCurrency(sb.taxPaidInBracket)}</div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;
  }

  // 4. Vista de Motors de la Declaració (Key Drivers)
  function renderDriversView(): string {
    return `
      <div>
        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:var(--space-md);">
          Aquests són els factors determinants que tenen més impacte econòmic en el teu resultat fiscal:
        </p>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:var(--space-md);">
          ${report.keyDrivers.map((d) => `
            <div style="background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default); display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:var(--space-xs);">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:1.2rem;">${d.icon}</span>
                    <span style="font-weight:700; font-size:0.85rem; color:var(--text-primary);">${d.title}</span>
                  </div>
                  <span class="badge ${d.impactType === 'increase_refund' ? 'badge--success' : 'badge--warning'}" style="font-size:0.7rem;">
                    ${d.impactType === 'increase_refund' ? 'Estalvi / Benefici' : 'Atenció / Ajust'}
                  </span>
                </div>
                <p style="margin:0 0 var(--space-sm) 0; font-size:0.75rem; color:var(--text-secondary); line-height:1.5;">
                  ${d.description}
                </p>
              </div>

              ${d.recommendation ? `
                <div style="padding:6px 10px; background:var(--bg-base); border-radius:var(--radius-sm); border-left:3px solid var(--color-primary); font-size:0.7rem; color:var(--text-secondary); margin-top:var(--space-xs);">
                  💡 <strong>Consell expert:</strong> ${d.recommendation}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function attachEvents() {
    container.querySelectorAll('.btn-mode-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).getAttribute('data-mode') as typeof activeViewMode;
        if (mode && mode !== activeViewMode) {
          activeViewMode = mode;
          renderContent();
        }
      });
    });
  }

  renderContent();
  return container;
}
