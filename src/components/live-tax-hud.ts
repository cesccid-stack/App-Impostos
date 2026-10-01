/**
 * @module components/live-tax-hud
 * Mini Liquidator Flotant & HUD Tributari en Temps Real.
 * Mostra permanentment el resultat de la Casella 0610 (a ingressar / tornar),
 * el tipus efectiu i la salut fiscal, actualitzant-se de manera reactiva
 * mentre l'usuari interactua amb qualsevol secció de l'aplicació.
 */

import { store } from '../store.ts';
import { calculateIRPF } from '../fiscal/irpf.ts';
import { router } from '../router.ts';
import { formatCurrency, formatPercent } from '../utils/currency.ts';

export function createLiveTaxHUD(): HTMLElement {
  const hud = document.createElement('div');
  hud.className = 'live-tax-hud-container';
  hud.id = 'live-tax-hud';
  hud.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9000;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--modal-bg, rgba(15, 16, 38, 0.95));
    border: 1px solid var(--border-accent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: 6px 12px;
    border-radius: var(--radius-full, 9999px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    user-select: none;
  `;

  function updateHUD() {
    try {
      const data = store.getData();
      const res = calculateIRPF(data);
      const isRefund = res.result < 0;
      const amountFormatted = formatCurrency(Math.abs(res.result));
      const totalBase = (res.generalBase || 0) + (res.savingsBase || 0);
      const effectiveRateVal = totalBase > 0 ? res.netTax / totalBase : 0;

      hud.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:0.9rem; animation:pulse 2s infinite;">${isRefund ? '🟢' : '🔴'}</span>
          <div style="display:flex; flex-direction:column; line-height:1.1;">
            <div style="font-size:0.65rem; text-transform:uppercase; font-weight:700; color:var(--text-muted); letter-spacing:0.04em;">
              Casella 0610 ${isRefund ? 'A Tornar' : 'A Pagar'}
            </div>
            <div style="font-size:0.9rem; font-weight:900; font-family:var(--font-mono); color:${isRefund ? 'var(--color-success)' : 'var(--color-error)'};">
              ${isRefund ? '↩ -' : '↗ +'}${amountFormatted}
            </div>
          </div>
        </div>

        <div style="height:20px; width:1px; background:var(--border-default); margin:0 2px;"></div>

        <div style="display:flex; align-items:center; gap:4px; font-size:0.7rem; color:var(--text-secondary);">
          <span>Tipus:</span>
          <strong style="color:var(--color-primary);">${formatPercent(effectiveRateVal)}</strong>
        </div>

        <button class="btn-hud-expand" style="background:transparent; border:none; color:var(--text-muted); font-size:0.8rem; padding:0 2px; cursor:pointer;" title="Obrir Quadre de Comandament Didàctic">
          🧭
        </button>

        <!-- Popover Didàctic d'Entesa Ràpida (Explicació en Viu) -->
        <div class="hud-explain-popover" style="display:none; position:absolute; bottom:calc(100% + 12px); right:0; width:290px; background:var(--modal-bg, #0f1026); border:1px solid var(--border-accent); border-radius:var(--radius-md); padding:12px; box-shadow:0 12px 36px rgba(0,0,0,0.5); font-size:0.75rem; color:var(--text-secondary); text-align:left; line-height:1.4; pointer-events:none;">
          <div style="font-weight:800; color:var(--text-primary); font-size:0.8rem; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
            <span>🧭</span>
            <span>Comprendre la Casella 0610</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between;">
              <span>Impost Real (Quota Líquida):</span>
              <strong style="color:var(--text-primary);">${formatCurrency(res.netTax)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>Retencions ja ingressades:</span>
              <strong style="color:var(--color-warning);">${formatCurrency(res.totalWithholdings)}</strong>
            </div>
            <div style="border-top:1px dashed var(--border-default); padding-top:4px; display:flex; justify-content:space-between; font-weight:800; color:${isRefund ? 'var(--color-success)' : 'var(--color-error)'};">
              <span>${isRefund ? '↩ Devolució a favor teu:' : '↗ Liquidació a pagar:'}</span>
              <span>${amountFormatted}</span>
            </div>
          </div>
          <div style="background:rgba(99,102,241,0.08); padding:6px 8px; border-radius:4px; font-size:0.7rem; color:var(--text-secondary); border-left:2px solid var(--color-primary);">
            💡 <em>Fórmula AEAT:</em> Quota Líquida menys Retencions pagades durant l'any.
          </div>
          <div style="margin-top:6px; font-size:0.65rem; color:var(--color-primary); font-weight:700; text-align:right;">
            Clica per veure el desglossament complet ➡️
          </div>
        </div>
      `;

      hud.style.borderColor = isRefund ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
    } catch {
      // Non-blocking fallback
    }
  }

  hud.addEventListener('click', () => {
    router.navigate('/resultat');
  });

  hud.addEventListener('mouseenter', () => {
    hud.style.transform = 'translateY(-3px) scale(1.03)';
    hud.style.boxShadow = '0 12px 40px rgba(99, 102, 241, 0.35)';
    const popover = hud.querySelector<HTMLElement>('.hud-explain-popover');
    if (popover) popover.style.display = 'block';
  });

  hud.addEventListener('mouseleave', () => {
    hud.style.transform = 'none';
    hud.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.45)';
    const popover = hud.querySelector<HTMLElement>('.hud-explain-popover');
    if (popover) popover.style.display = 'none';
  });

  // Reacció immediata a qualsevol canvi en el magatzem reactiu
  store.subscribe(() => {
    updateHUD();
  });

  updateHUD();
  return hud;
}
