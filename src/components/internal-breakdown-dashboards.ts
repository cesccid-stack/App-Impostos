/**
 * @module components/internal-breakdown-dashboards
 * Quadres Interns de Desglossament Avançat & Matrius de Liquidació Específica.
 * Proporciona transparència total i precisió matemàtica per a cada bloc de la declaració:
 * 1. Quadre d'Immobles & Amortització 3% (Art. 23 & 85 LIRPF)
 * 2. Quadre de Bossa de Pèrdues de 4 Anys & Compensació Creuada 25% (Art. 49 LIRPF)
 * 3. Quadre d'Activitats Econòmiques, RETA & Despeses 5% (Art. 28-32 LIRPF)
 * 4. Quadre de Deduccions Autonòmiques de Catalunya & Eficiència Energètica
 * 5. Quadre de Distribució de Quotes: Tram a Tram Estat vs Catalunya
 */

import { calculateIRPF } from '../fiscal/irpf.ts';
import { calculateAllProperties } from '../fiscal/real-estate-engine.ts';
import { formatCurrency } from '../utils/currency.ts';
import type { DeclaracionData, FiscalResult } from '../types.ts';

export function createInternalBreakdownDashboards(data: DeclaracionData, result?: FiscalResult): HTMLElement {
  const container = document.createElement('div');
  container.className = 'internal-breakdowns-container';
  container.style.marginTop = 'var(--space-xl)';

  const res = result || calculateIRPF(data);
  const year = data.year || 2024;

  let activeTab: 'immobles' | 'borsa' | 'activitats' | 'deduccions_cat' | 'escales_estat_cat' = 'immobles';

  function renderContent() {
    container.innerHTML = `
      <div class="card" style="border:1px solid var(--border-accent); background:linear-gradient(145deg, rgba(99, 102, 241, 0.03), var(--bg-surface-elevated)); box-shadow:var(--shadow-md); padding:var(--space-lg);">
        
        <!-- Header del Panell de Quadres Interns -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-md); padding-bottom:var(--space-md); border-bottom:1px solid var(--border-default); margin-bottom:var(--space-lg);">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.3rem;">📊</span>
              <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--text-primary);">
                Quadres Interns de Desglossament & Matrius de Càlcul
              </h3>
              <span class="badge badge--success" style="font-size:0.7rem;">Rigor 100% Homogeni</span>
            </div>
            <p style="margin:4px 0 0 0; font-size:0.8rem; color:var(--text-secondary);">
              Audita casella a casella les taules d'amortització, la bossa de pèrdues de 4 anys, el rendiment d'autònoms i el repartiment Estat vs Catalunya.
            </p>
          </div>

          <!-- Selector de Quadre Intern -->
          <div style="display:flex; background:var(--bg-base); padding:3px; border-radius:var(--radius-md); border:1px solid var(--border-default); gap:2px; flex-wrap:wrap;">
            <button class="btn btn--sm tab-btn ${activeTab === 'immobles' ? 'btn--primary' : 'btn--ghost'}" data-tab="immobles" style="font-size:0.75rem; padding:4px 10px;">
              🏠 Immobles & 3%
            </button>
            <button class="btn btn--sm tab-btn ${activeTab === 'borsa' ? 'btn--primary' : 'btn--ghost'}" data-tab="borsa" style="font-size:0.75rem; padding:4px 10px;">
              📈 Bossa 4 Anys
            </button>
            <button class="btn btn--sm tab-btn ${activeTab === 'activitats' ? 'btn--primary' : 'btn--ghost'}" data-tab="activitats" style="font-size:0.75rem; padding:4px 10px;">
              💼 Autònoms & 130
            </button>
            <button class="btn btn--sm tab-btn ${activeTab === 'deduccions_cat' ? 'btn--primary' : 'btn--ghost'}" data-tab="deduccions_cat" style="font-size:0.75rem; padding:4px 10px;">
              🎗️ Deduccions Catalunya
            </button>
            <button class="btn btn--sm tab-btn ${activeTab === 'escales_estat_cat' ? 'btn--primary' : 'btn--ghost'}" data-tab="escales_estat_cat" style="font-size:0.75rem; padding:4px 10px;">
              ⚖️ Estat vs Catalunya
            </button>
          </div>
        </div>

        <!-- Contingut Dinàmic del Quadre Seleccionat -->
        <div id="breakdown-dashboard-body">
          ${renderActiveTabBody()}
        </div>

      </div>
    `;

    // Attach tab click events
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        activeTab = (target.dataset.tab as typeof activeTab) || 'immobles';
        renderContent();
      });
    });
  }

  function renderActiveTabBody(): string {
    switch (activeTab) {
      case 'immobles':
        return renderRealEstateBreakdown(data, year);
      case 'borsa':
        return renderLossCarryoverBreakdown(data, res);
      case 'activitats':
        return renderActivitiesBreakdown(data);
      case 'deduccions_cat':
        return renderCatalanDeductionsBreakdown(data, res);
      case 'escales_estat_cat':
        return renderTaxDistributionBreakdown(res);
      default:
        return '';
    }
  }

  // ── 1. QUADRE D'IMMOBLES & AMORTITZACIÓ 3% ───────────────────────────────
  function renderRealEstateBreakdown(d: DeclaracionData, yr: number): string {
    const props = d.properties || [];
    const { results, totalGrossIncome, totalExpenses, totalAmortization, totalNetReducedIncome } = calculateAllProperties(props, yr);

    return `
      <div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-md);">
          <div style="background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Ingressos Bruts (0102)</div>
            <div style="font-size:1.1rem; font-weight:800; font-family:var(--font-mono); color:var(--color-primary);">${formatCurrency(totalGrossIncome)}</div>
          </div>
          <div style="background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Despeses Corrents & IBI (0115)</div>
            <div style="font-size:1.1rem; font-weight:800; font-family:var(--font-mono); color:var(--color-warning);">${formatCurrency(totalExpenses)}</div>
          </div>
          <div style="background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Amortització 3% Deduïda (0118)</div>
            <div style="font-size:1.1rem; font-weight:800; font-family:var(--font-mono); color:var(--color-success);">${formatCurrency(totalAmortization)}</div>
          </div>
          <div style="background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Rendiment Net Reduït (0150)</div>
            <div style="font-size:1.1rem; font-weight:800; font-family:var(--font-mono); color:var(--text-primary);">${formatCurrency(totalNetReducedIncome)}</div>
          </div>
        </div>

        ${props.length === 0 ? `
          <div style="padding:var(--space-md); text-align:center; color:var(--text-secondary); background:var(--bg-surface); border-radius:var(--radius-sm);">
            No hi ha immobles registrats. Afegeix immobles a la secció <a href="#/immobles" style="color:var(--color-primary); font-weight:600;">Immobles en Lloguer</a>.
          </div>
        ` : `
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; font-size:0.75rem;">
              <thead>
                <tr style="border-bottom:1px solid var(--border-default); text-align:left;">
                  <th style="padding:6px 8px;">Immoble / Ref. Cadastral</th>
                  <th style="padding:6px 8px;">Ús / Contracte</th>
                  <th style="padding:6px 8px; text-align:right;">Ingressos</th>
                  <th style="padding:6px 8px; text-align:right;">Finançament & Rep.</th>
                  <th style="padding:6px 8px; text-align:right;">Amortització 3%</th>
                  <th style="padding:6px 8px; text-align:right;">Reducció</th>
                  <th style="padding:6px 8px; text-align:right;">Rendiment Net</th>
                </tr>
              </thead>
              <tbody>
                ${props.map((p, idx) => {
                  const r = results[idx] || { grossIncome: 0, limitedExpensesDeducted: 0, buildingAmortization: 0, reductionAmount: 0, netReducedIncome: 0 };
                  return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                      <td style="padding:6px 8px;">
                        <div style="font-weight:700; color:var(--text-primary);">${p.name || p.address}</div>
                        <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted);">${p.cadastralReference || 'Sense ref. cadastral'}</div>
                      </td>
                      <td style="padding:6px 8px;">
                        <span class="badge badge--info" style="font-size:0.65rem;">${p.usageType || 'habitual'}</span>
                      </td>
                      <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono);">${formatCurrency(r.grossIncome)}</td>
                      <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); color:var(--color-warning);">${formatCurrency(r.limitedExpensesDeducted)}</td>
                      <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); color:var(--color-success);">${formatCurrency(r.buildingAmortization)}</td>
                      <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); color:var(--color-info);">-${formatCurrency(r.reductionAmount)}</td>
                      <td style="padding:6px 8px; text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--text-primary);">${formatCurrency(r.netReducedIncome)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  // ── 2. QUADRE DE BOSSA DE PÈRDUES DE 4 ANYS (ART. 49 LIRPF) ──────────────
  function renderLossCarryoverBreakdown(d: DeclaracionData, r: FiscalResult): string {
    const carryovers = d.lossCarryovers || { pendingGeneralLosses: [], pendingMobiliaryLosses: [], pendingCapitalLosses: [] };
    const capitalGainsTotal = (d.gains?.items || []).reduce((s, i) => s + (i.transferValue - i.acquisitionValue - i.expenses), 0);

    return `
      <div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-md);">
          <div style="background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Saldo Guanys/Pèrdues Any (0424)</div>
            <div style="font-size:1.1rem; font-weight:800; font-family:var(--font-mono); color:${capitalGainsTotal >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
              ${formatCurrency(capitalGainsTotal)}
            </div>
          </div>
          <div style="background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Compensació Creuada 25% (0445)</div>
            <div style="font-size:1.1rem; font-weight:800; font-family:var(--font-mono); color:var(--color-info);">
              ${formatCurrency(r.crossCompensationAmount || 0)}
            </div>
          </div>
          <div style="background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Pèrdues Anteriors Compensades (0447)</div>
            <div style="font-size:1.1rem; font-weight:800; font-family:var(--font-mono); color:var(--color-success);">
              -${formatCurrency(r.priorLossesCompensated || 0)}
            </div>
          </div>
          <div style="background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Base Imposable de l'Estalvi (0460)</div>
            <div style="font-size:1.1rem; font-weight:800; font-family:var(--font-mono); color:var(--text-primary);">
              ${formatCurrency(r.savingsBase)}
            </div>
          </div>
        </div>

        <div style="background:var(--bg-surface); border:1px solid var(--border-default); border-radius:var(--radius-sm); padding:12px;">
          <h4 style="margin:0 0 8px 0; font-size:0.85rem; font-weight:700; color:var(--text-primary);">
            📦 Estat de la Bossa de Pèrdues Pendents dels 4 Exercicis Anteriors (2020-2023)
          </h4>
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; font-size:0.75rem;">
              <thead>
                <tr style="border-bottom:1px solid var(--border-default); text-align:left;">
                  <th style="padding:4px 6px;">Exercici Origen</th>
                  <th style="padding:4px 6px;">Casella AEAT</th>
                  <th style="padding:4px 6px; text-align:right;">Pèrdua Inicial</th>
                  <th style="padding:4px 6px; text-align:right;">Compensat en aquest Exercici</th>
                  <th style="padding:4px 6px; text-align:right;">Pendent pròxims anys</th>
                  <th style="padding:4px 6px; text-align:center;">Prescripció</th>
                </tr>
              </thead>
              <tbody>
                ${[2020, 2021, 2022, 2023].map(y => {
                  const item = carryovers.pendingCapitalLosses.find(p => p.year === y);
                  const initial = item ? item.amount : 0;
                  const comp = initial > 0 ? Math.min(initial, capitalGainsTotal > 0 ? capitalGainsTotal : 0) : 0;
                  const remaining = Math.max(0, initial - comp);
                  const isExpired = y < (year - 4);

                  return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                      <td style="padding:4px 6px; font-weight:700;">Exercici ${y}</td>
                      <td style="padding:4px 6px; font-family:var(--font-mono); color:var(--text-muted);">045${y - 2020}</td>
                      <td style="padding:4px 6px; text-align:right; font-family:var(--font-mono);">${formatCurrency(initial)}</td>
                      <td style="padding:4px 6px; text-align:right; font-family:var(--font-mono); color:var(--color-success);">${formatCurrency(comp)}</td>
                      <td style="padding:4px 6px; text-align:right; font-family:var(--font-mono); font-weight:700; color:${remaining > 0 ? 'var(--color-warning)' : 'var(--text-muted)'};">${formatCurrency(remaining)}</td>
                      <td style="padding:4px 6px; text-align:center;">
                        <span class="badge ${isExpired ? 'badge--error' : 'badge--primary'}" style="font-size:0.65rem;">
                          ${30 + y - 2020}/06/${y + 5}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ── 3. QUADRE D'ACTIVITATS ECONÒMIQUES & 130 ──────────────────────────────
  function renderActivitiesBreakdown(d: DeclaracionData): string {
    const act = d.activities || { income: 0, expenses: 0, withholdings: 0, socialSecuritySelfEmployed: 0, estimationType: 'direct_simplified' };
    const netPrev = Math.max(0, act.income - act.expenses - (act.socialSecuritySelfEmployed || 0));
    const difficultExpenses5Percent = act.estimationType === 'direct_simplified' ? Math.min(2000, netPrev * 0.05) : 0;
    const netFinal = Math.max(0, netPrev - difficultExpenses5Percent);

    return `
      <div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-md);">
          <div style="background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Ingressos Íntegres (0179)</div>
            <div style="font-size:1.1rem; font-weight:800; font-family:var(--font-mono); color:var(--color-primary);">${formatCurrency(act.income)}</div>
          </div>
          <div style="background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Despeses Deduïbles (0220)</div>
            <div style="font-size:1.1rem; font-weight:800; font-family:var(--font-mono); color:var(--color-warning);">${formatCurrency(act.expenses + (act.socialSecuritySelfEmployed || 0))}</div>
          </div>
          <div style="background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">5% Difícil Justificació (0222)</div>
            <div style="font-size:1.1rem; font-weight:800; font-family:var(--font-mono); color:var(--color-success);">-${formatCurrency(difficultExpenses5Percent)}</div>
          </div>
          <div style="background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Rendiment Net d'Activitat (0235)</div>
            <div style="font-size:1.1rem; font-weight:800; font-family:var(--font-mono); color:var(--text-primary);">${formatCurrency(netFinal)}</div>
          </div>
        </div>

        <div style="background:var(--bg-surface); border:1px solid var(--border-default); border-radius:var(--radius-sm); padding:12px; font-size:0.8rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-weight:700; color:var(--text-primary);">Règim d'Estimació:</span>
            <span class="badge badge--primary">${act.estimationType === 'direct_simplified' ? 'Estimació Directa Simplificada (5% reducció)' : 'Estimació Directa Normal'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="color:var(--text-secondary);">Retencions Suportades en Factures Emeses (Casella 0599):</span>
            <span style="font-weight:700; font-family:var(--font-mono); color:var(--color-success);">${formatCurrency(act.withholdings)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:var(--text-secondary);">Quota RETA Autònoms computada com a despesa:</span>
            <span style="font-weight:700; font-family:var(--font-mono);">${formatCurrency(act.socialSecuritySelfEmployed || 0)}</span>
          </div>
        </div>
      </div>
    `;
  }

  // ── 4. QUADRE DE DEDUCCIONS AUTONÒMIQUES DE CATALUNYA ─────────────────────
  function renderCatalanDeductionsBreakdown(d: DeclaracionData, r: FiscalResult): string {
    const ded = d.deductions;

    return `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
          <div>
            <h4 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">
              Deduccions Autonòmiques Aplicades (Comunitat Autònoma de Catalunya)
            </h4>
            <div style="font-size:0.75rem; color:var(--text-secondary);">
              Llei 31/2002 i modificacions del Parlament de Catalunya (Deducció directa sobre la quota autonòmica)
            </div>
          </div>
          <div style="font-size:1.1rem; font-weight:800; font-family:var(--font-mono); color:var(--color-success);">
            Total: -${formatCurrency(r.catalanDeductionsAmount)}
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:8px;">
          
          <div style="background:var(--bg-surface); border:1px solid var(--border-default); border-radius:var(--radius-sm); padding:10px 12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
              <span style="font-weight:700; font-size:0.8rem; color:var(--text-primary);">🏠 Lloguer d'Habitatge Habitual</span>
              <span class="badge ${ded.catalanRentalDeduction ? 'badge--success' : 'badge--neutral'}" style="font-size:0.65rem;">
                ${ded.catalanRentalDeduction ? 'Aplicat' : 'No aplicat'}
              </span>
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px;">10% del lloguer fins a 300 € (o 600 € família nombrosa/discapacitat)</div>
            <div style="font-weight:700; font-family:var(--font-mono); font-size:0.85rem; color:${ded.catalanRentalDeduction ? 'var(--color-success)' : 'var(--text-muted)'};">
              ${ded.catalanRentalDeduction ? `-${formatCurrency(Math.min(ded.catalanRentalSituation === 'large_family' ? 600 : 300, (ded.catalanRentalAmount || 0) * 0.1))}` : '0,00 €'}
            </div>
          </div>

          <div style="background:var(--bg-surface); border:1px solid var(--border-default); border-radius:var(--radius-sm); padding:10px 12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
              <span style="font-weight:700; font-size:0.8rem; color:var(--text-primary);">👶 Naixement o Adopció de Fills</span>
              <span class="badge ${ded.catalanBirthAdoption > 0 ? 'badge--success' : 'badge--neutral'}" style="font-size:0.65rem;">
                ${ded.catalanBirthAdoption > 0 ? `${ded.catalanBirthAdoption} fills` : '0'}
              </span>
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px;">150 € per fill (300 € en declaració conjunta)</div>
            <div style="font-weight:700; font-family:var(--font-mono); font-size:0.85rem; color:${ded.catalanBirthAdoption > 0 ? 'var(--color-success)' : 'var(--text-muted)'};">
              ${ded.catalanBirthAdoption > 0 ? `-${formatCurrency(ded.catalanBirthAdoption * 150)}` : '0,00 €'}
            </div>
          </div>

          <div style="background:var(--bg-surface); border:1px solid var(--border-default); border-radius:var(--radius-sm); padding:10px 12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
              <span style="font-weight:700; font-size:0.8rem; color:var(--text-primary);">🚀 Inversió en Startups Catalanes</span>
              <span class="badge ${(ded.catalanStartupInvestment || 0) > 0 ? 'badge--success' : 'badge--neutral'}" style="font-size:0.65rem;">
                ${(ded.catalanStartupInvestment || 0) > 0 ? 'Actiu' : '0 €'}
              </span>
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px;">30% fins a 6.000 € (50% fins a 12.000 € spin-offs universitàries)</div>
            <div style="font-weight:700; font-family:var(--font-mono); font-size:0.85rem; color:${(ded.catalanStartupInvestment || 0) > 0 ? 'var(--color-success)' : 'var(--text-muted)'};">
              ${(ded.catalanStartupInvestment || 0) > 0 ? `-${formatCurrency(Math.min(ded.catalanStartupIsResearchOrUniversity ? 12000 : 6000, (ded.catalanStartupInvestment || 0) * (ded.catalanStartupIsResearchOrUniversity ? 0.5 : 0.3)))}` : '0,00 €'}
            </div>
          </div>

          <div style="background:var(--bg-surface); border:1px solid var(--border-default); border-radius:var(--radius-sm); padding:10px 12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
              <span style="font-weight:700; font-size:0.8rem; color:var(--text-primary);">🧬 Recerca Biomèdica & Foment Català</span>
              <span class="badge ${(ded.catalanBiomedicalDonations || 0) + (ded.catalanLanguageDonations || 0) > 0 ? 'badge--success' : 'badge--neutral'}" style="font-size:0.65rem;">
                ${(ded.catalanBiomedicalDonations || 0) + (ded.catalanLanguageDonations || 0) > 0 ? 'Actiu' : '0 €'}
              </span>
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px;">25% recerca biomèdica i universitats + 15% foment llengua catalana</div>
            <div style="font-weight:700; font-family:var(--font-mono); font-size:0.85rem; color:${(ded.catalanBiomedicalDonations || 0) + (ded.catalanLanguageDonations || 0) > 0 ? 'var(--color-success)' : 'var(--text-muted)'};">
              ${formatCurrency(((ded.catalanBiomedicalDonations || 0) * 0.25) + ((ded.catalanLanguageDonations || 0) * 0.15))}
            </div>
          </div>

        </div>
      </div>
    `;
  }

  // ── 5. QUADRE DE DISTRIBUCIÓ FISCAL: ESTAT VS CATALUNYA ──────────────────
  function renderTaxDistributionBreakdown(r: FiscalResult): string {
    const stateNet = Math.max(0, (r.stateGeneralTax || 0) + (r.stateSavingsTax || 0) - (r.stateMinimumTaxCredit || 0));
    const catNet = Math.max(0, (r.autonomicGeneralTax || 0) + (r.autonomicSavingsTax || 0) - (r.autonomicMinimumTaxCredit || 0) - (r.catalanDeductionsAmount || 0));
    const totalNet = stateNet + catNet;

    const statePct = totalNet > 0 ? Math.round((stateNet / totalNet) * 100) : 50;
    const catPct = totalNet > 0 ? (100 - statePct) : 50;

    return `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
          <div>
            <h4 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">
              Repartiment de la Quota Líquida: Estat vs Comunitat Autònoma (Catalunya)
            </h4>
            <div style="font-size:0.75rem; color:var(--text-secondary);">
              El 50% de la recaptació de l'IRPF es cedeix a la Generalitat de Catalunya amb la seva escala pròpia.
            </div>
          </div>
        </div>

        <!-- Progress Bar Comparativa -->
        <div style="height:24px; border-radius:var(--radius-full); overflow:hidden; display:flex; margin-bottom:var(--space-md); background:var(--bg-base); border:1px solid var(--border-default);">
          <div style="width:${statePct}%; background:linear-gradient(90deg, #6366f1, #818cf8); display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.75rem; font-weight:700;">
            Estat (${statePct}%)
          </div>
          <div style="width:${catPct}%; background:linear-gradient(90deg, #ec4899, #f472b6); display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.75rem; font-weight:700;">
            Catalunya (${catPct}%)
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-md);">
          
          <div style="background:var(--bg-surface); border-left:4px solid #6366f1; border-radius:var(--radius-sm); padding:12px;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary); margin-bottom:4px;">
              🏛️ Tram Estatal (Administració Central)
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:8px;">
              Quota General: ${formatCurrency(r.stateGeneralTax)} | Estalvi: ${formatCurrency(r.stateSavingsTax)}
            </div>
            <div style="font-size:1.2rem; font-weight:800; font-family:var(--font-mono); color:#6366f1;">
              ${formatCurrency(stateNet)} <span style="font-size:0.75rem; color:var(--text-muted);">(${statePct}%)</span>
            </div>
          </div>

          <div style="background:var(--bg-surface); border-left:4px solid #ec4899; border-radius:var(--radius-sm); padding:12px;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary); margin-bottom:4px;">
              🎗️ Tram Autonòmic (Generalitat de Catalunya)
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:8px;">
              Quota General: ${formatCurrency(r.autonomicGeneralTax)} | Deduccions CCAA: -${formatCurrency(r.catalanDeductionsAmount)}
            </div>
            <div style="font-size:1.2rem; font-weight:800; font-family:var(--font-mono); color:#ec4899;">
              ${formatCurrency(catNet)} <span style="font-size:0.75rem; color:var(--text-muted);">(${catPct}%)</span>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  renderContent();
  return container;
}
