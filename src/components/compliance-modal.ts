/**
 * @module components/compliance-modal
 * Modal interactiu de Diagnòstic i Comprovacions Automàtiques de Conformitat Fiscal.
 * Mostra l'auditoria en temps real i permet corregir inconsistències en 1 clic.
 */

import { store } from '../store.ts';
import { runAutomatedComplianceChecks, executeAutoFix, type ValidationReport } from '../fiscal/auto-validator.ts';
import { showToast } from './toast.ts';

export function openComplianceModal(onUpdated?: () => void): void {
  const existing = document.getElementById('compliance-audit-modal');
  if (existing) existing.remove();

  const data = store.getData();
  let report: ValidationReport = runAutomatedComplianceChecks(data);

  const modal = document.createElement('div');
  modal.id = 'compliance-audit-modal';
  modal.className = 'modal-backdrop';
  modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.75); display:flex; justify-content:center; align-items:center; z-index:10000; padding:var(--space-md); backdrop-filter:blur(4px);';

  function renderModalContent() {
    report = runAutomatedComplianceChecks(store.getData());

    const isPerfect = report.status === 'perfect';
    const hasCritical = report.criticalCount > 0;

    modal.innerHTML = `
      <div class="modal-content card" style="max-width:720px; width:100%; max-height:90vh; overflow-y:auto; background:var(--modal-bg); border:1px solid var(--border-default); border-radius:var(--radius-lg); padding:var(--space-xl); box-shadow:var(--shadow-lg);">
        
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:var(--space-lg); border-bottom:1px solid var(--border-default); padding-bottom:var(--space-md);">
          <div>
            <div style="display:flex; align-items:center; gap:var(--space-xs);">
              <h2 style="margin:0; font-size:var(--text-lg);">🛡️ Diagnòstic & Comprovacions Fiscals Automàtiques</h2>
              <span class="badge ${isPerfect ? 'badge--success' : (hasCritical ? 'badge--error' : 'badge--warning')}">
                ${report.complianceScore}% Conformitat
              </span>
            </div>
            <p class="card__subtitle" style="margin:4px 0 0 0;">
              Auditoria contínua de coherència entre IVA, Activitats Econòmiques (IRPF) i Gestió Patrimonial
            </p>
          </div>
          <button class="btn btn--ghost btn--sm btn--icon" id="btn-close-compliance-modal" style="font-size:1.2rem;">✕</button>
        </div>

        <!-- Estat Global Scorecard -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:var(--space-sm); margin-bottom:var(--space-lg);">
          <div style="background:var(--bg-surface-elevated); padding:var(--space-sm) var(--space-md); border-radius:var(--radius-md); text-align:center; border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Puntuació Legal</div>
            <div style="font-size:1.4rem; font-weight:bold; color:${isPerfect ? 'var(--color-success)' : (hasCritical ? 'var(--color-error)' : 'var(--color-warning)')};">
              ${report.complianceScore}%
            </div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:var(--space-sm) var(--space-md); border-radius:var(--radius-md); text-align:center; border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Errors Crítics</div>
            <div style="font-size:1.4rem; font-weight:bold; color:var(--color-error);">${report.criticalCount}</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:var(--space-sm) var(--space-md); border-radius:var(--radius-md); text-align:center; border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Advertències</div>
            <div style="font-size:1.4rem; font-weight:bold; color:var(--color-warning);">${report.warningCount}</div>
          </div>
          <div style="background:var(--bg-surface-elevated); padding:var(--space-sm) var(--space-md); border-radius:var(--radius-md); text-align:center; border:1px solid var(--border-default);">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Avisos Informatius</div>
            <div style="font-size:1.4rem; font-weight:bold; color:var(--color-info);">${report.infoCount}</div>
          </div>
        </div>

        <!-- Llista de Comprovacions -->
        <div style="display:flex; flex-direction:column; gap:var(--space-md); margin-bottom:var(--space-xl);">
          ${isPerfect ? `
            <div style="padding:var(--space-xl); text-align:center; background:var(--bg-surface-elevated); border-radius:var(--radius-md); border:1px solid var(--color-success);">
              <div style="font-size:2.5rem; margin-bottom:var(--space-xs);">🎉</div>
              <h3 style="margin:0 0 var(--space-xs) 0; color:var(--color-success);">Tot és 100% Correcte!</h3>
              <p style="color:var(--text-secondary); font-size:var(--text-sm); margin:0;">
                No s'ha detectat cap incongruència entre el Mòdul d'IVA, Activitats i Immobles. La declaració s'ajusta als criteris d'inspecció de l'AEAT.
              </p>
            </div>
          ` : `
            ${report.issues.map(issue => `
              <div style="background:var(--bg-surface-elevated); border-radius:var(--radius-md); padding:var(--space-md); border:1px solid var(--border-default); border-left:4px solid ${issue.severity === 'critical' ? 'var(--color-error)' : (issue.severity === 'warning' ? 'var(--color-warning)' : 'var(--color-info)')};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:var(--space-sm); margin-bottom:4px;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:1.1rem;">
                      ${issue.severity === 'critical' ? '🔴' : (issue.severity === 'warning' ? '🟡' : 'ℹ️')}
                    </span>
                    <strong style="font-size:var(--text-sm);">${issue.title}</strong>
                  </div>
                  <span class="badge ${issue.severity === 'critical' ? 'badge--error' : (issue.severity === 'warning' ? 'badge--warning' : 'badge--info')}">
                    ${issue.severity.toUpperCase()}
                  </span>
                </div>
                
                <p style="font-size:0.8rem; color:var(--text-secondary); margin:0 0 8px 0;">
                  ${issue.message}
                </p>

                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-xs); border-top:1px solid var(--border-subtle); padding-top:6px; font-size:0.75rem;">
                  <span style="color:var(--text-muted);">⚖️ ${issue.legalReference}</span>
                  ${issue.autoFixable && issue.autoFixKey ? `
                    <button class="btn btn--primary btn--sm btn-autofix" data-fix-key="${issue.autoFixKey}" style="font-size:0.75rem; padding:3px 10px;">
                      ⚡ ${issue.autoFixLabel || 'Auto-Corregir'}
                    </button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          `}
        </div>

        <!-- Footer -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-default); padding-top:var(--space-md);">
          <button class="btn btn--secondary btn--sm" id="btn-re-run-checks">
            🔄 Tornar a Comprovar
          </button>
          <button class="btn btn--primary btn--sm" id="btn-close-modal-bottom">
            Tancar
          </button>
        </div>
      </div>
    `;

    // Listeners
    modal.querySelector('#btn-close-compliance-modal')!.addEventListener('click', () => {
      modal.remove();
      if (onUpdated) onUpdated();
    });

    modal.querySelector('#btn-close-modal-bottom')!.addEventListener('click', () => {
      modal.remove();
      if (onUpdated) onUpdated();
    });

    modal.querySelector('#btn-re-run-checks')?.addEventListener('click', () => {
      renderModalContent();
      showToast('Comprovacions fiscals actualitzades', 'info');
    });

    modal.querySelectorAll('.btn-autofix').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = (e.currentTarget as HTMLElement).dataset.fixKey!;
        const result = executeAutoFix(key);
        if (result.success) {
          showToast(result.message, 'success');
          renderModalContent();
          if (onUpdated) onUpdated();
        } else {
          showToast(result.message, 'warning');
        }
      });
    });
  }

  document.body.appendChild(modal);
  renderModalContent();
}
