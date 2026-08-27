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
      const effectiveRateVal = totalBase > 0 ? (res.netTax / totalBase) : 0;

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

        <button class="btn-hud-expand" style="background:transparent; border:none; color:var(--text-muted); font-size:0.8rem; padding:0 2px; cursor:pointer;" title="Obrir Cuadro de Mando Visual">
          🧭
        </button>
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
  });

  hud.addEventListener('mouseleave', () => {
    hud.style.transform = 'none';
    hud.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.45)';
  });

  // Reacció immediata a qualsevol canvi en el magatzem reactiu
  store.subscribe(() => {
    updateHUD();
  });

  updateHUD();
  return hud;
}
