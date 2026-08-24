/**
 * @module components/command-palette
 * Modern Command Palette (Cmd+K / Ctrl+K) for instant navigation, AEAT Caselles lookup,
 * profile switching, theme switching, modular tools configuration and quick fiscal tools.
 */

import { router } from '../router.ts';
import { store } from '../store.ts';
import { calculateIRPF } from '../fiscal/irpf.ts';
import { formatCurrency } from '../utils/currency.ts';
import { showToast } from './toast.ts';
import { generateModel100PDF } from '../utils/pdf-generator.ts';
import { openComplianceModal } from './compliance-modal.ts';
import { openToolManagerModal } from './tool-manager-modal.ts';
import type { AppTheme } from '../types.ts';

export interface CommandItem {
  id: string;
  category: 'Pàgines & Mòduls' | 'Caselles AEAT' | 'Configuració d\'Eines' | 'Declarants & Perfils' | 'Eines & Accions' | 'Temes Visuals';
  title: string;
  subtitle?: string;
  badge?: string;
  icon: string;
  keywords?: string[];
  action: () => void;
}

let activeIndex = 0;
let filteredItems: CommandItem[] = [];

export function openCommandPalette(): void {
  const existing = document.getElementById('command-palette-modal');
  if (existing) {
    existing.remove();
  }

  const items = buildCommandItems();
  filteredItems = items;
  activeIndex = 0;

  const overlay = document.createElement('div');
  overlay.id = 'command-palette-modal';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 10vh 16px 24px 16px;
    animation: fadeIn 150ms ease-out;
  `;

  overlay.innerHTML = `
    <div class="command-palette-box" style="
      background: var(--modal-bg);
      border: 1px solid var(--border-accent);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-lg), 0 0 50px rgba(99, 102, 241, 0.2);
      width: 100%;
      max-width: 640px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      max-height: 75vh;
      animation: scaleIn 150ms ease-out;
    ">
      <!-- Search Input Header -->
      <div style="
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-default);
        background: var(--bg-surface-elevated);
      ">
        <span style="font-size: 1.25rem; opacity: 0.7;">⚡</span>
        <input
          type="text"
          id="command-palette-input"
          placeholder="Escriu per cercar pàgines, eines, caselles AEAT (ex: 0610), declarants..."
          style="
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: var(--text-primary);
            font-size: 1rem;
            font-family: var(--font-sans);
          "
          autocomplete="off"
          spellcheck="false"
        />
        <kbd style="
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 0.7rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
        ">ESC</kbd>
      </div>

      <!-- Results list -->
      <div id="command-palette-results" style="
        flex: 1;
        overflow-y: auto;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      ">
        <!-- Injected via renderResults -->
      </div>

      <!-- Footer navigation hints -->
      <div style="
        padding: 10px 16px;
        background: var(--bg-surface);
        border-top: 1px solid var(--border-subtle);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.75rem;
        color: var(--text-muted);
      ">
        <div style="display: flex; gap: 12px; align-items: center;">
          <span><kbd style="padding: 1px 4px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 3px;">↑</kbd> <kbd style="padding: 1px 4px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 3px;">↓</kbd> Navegar</span>
          <span><kbd style="padding: 1px 4px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 3px;">↵</kbd> Executar</span>
        </div>
        <div>
          <span>Hacienda 2025/2026 — Antigravity Suite</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = overlay.querySelector<HTMLInputElement>('#command-palette-input')!;
  input.focus();

  // Close on click outside
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeCommandPalette();
    }
  });

  // Render initial list
  renderResults(overlay);

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCommandPalette();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredItems.length > 0) {
        activeIndex = (activeIndex + 1) % filteredItems.length;
        renderResults(overlay);
        scrollActiveIntoView(overlay);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredItems.length > 0) {
        activeIndex = (activeIndex - 1 + filteredItems.length) % filteredItems.length;
        renderResults(overlay);
        scrollActiveIntoView(overlay);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[activeIndex]) {
        closeCommandPalette();
        filteredItems[activeIndex].action();
      }
    }
  });

  // Live filter with fuzzy leading-zero normalization for AEAT caselles
  input.addEventListener('input', (e) => {
    const rawQ = (e.target as HTMLInputElement).value.trim();
    const q = rawQ.toLowerCase();
    const strippedNum = rawQ.replace(/^0+/, '');
    const paddedNum = rawQ.length > 0 && rawQ.length <= 4 && /^\d+$/.test(rawQ) ? rawQ.padStart(4, '0') : '';

    if (!q) {
      filteredItems = items;
    } else {
      filteredItems = items.filter((item) => {
        return (
          item.title.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q) ||
          (paddedNum && item.title.includes(paddedNum)) ||
          (item.keywords &&
            item.keywords.some(
              (k) =>
                k.toLowerCase().includes(q) ||
                (strippedNum && k.toLowerCase().includes(strippedNum)) ||
                (paddedNum && k.toLowerCase().includes(paddedNum))
            ))
        );
      });
    }
    activeIndex = 0;
    renderResults(overlay);
  });
}

export function closeCommandPalette(): void {
  const modal = document.getElementById('command-palette-modal');
  if (modal) {
    modal.remove();
  }
}

function renderResults(container: HTMLElement): void {
  const resultsEl = container.querySelector('#command-palette-results');
  if (!resultsEl) return;

  if (filteredItems.length === 0) {
    resultsEl.innerHTML = `
      <div style="padding: 32px 16px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
        <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-secondary);">No s'ha trobat cap resultat</div>
        <div style="font-size: 0.75rem; margin-top: 4px;">Prova de cercar per nom de pàgina, número de casella (ex: 0610) o eina</div>
      </div>
    `;
    return;
  }

  let html = '';
  let currentCategory = '';

  filteredItems.forEach((item, idx) => {
    if (item.category !== currentCategory) {
      currentCategory = item.category;
      html += `
        <div style="
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          padding: 8px 8px 4px 8px;
          margin-top: 4px;
        ">${currentCategory}</div>
      `;
    }

    const isSelected = idx === activeIndex;
    html += `
      <div class="command-palette-item ${isSelected ? 'selected' : ''}" data-idx="${idx}" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        background: ${isSelected ? 'var(--bg-surface-hover)' : 'transparent'};
        border: 1px solid ${isSelected ? 'var(--border-accent)' : 'transparent'};
        transition: all var(--transition-fast);
      ">
        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
          <span style="font-size: 1.1rem; flex-shrink: 0;">${item.icon}</span>
          <div style="min-width: 0;">
            <div style="
              font-weight: ${isSelected ? '700' : '500'};
              font-size: 0.85rem;
              color: ${isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'};
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            ">${item.title}</div>
            ${item.subtitle ? `
              <div style="
                font-size: 0.7rem;
                color: var(--text-muted);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              ">${item.subtitle}</div>
            ` : ''}
          </div>
        </div>
        ${item.badge ? `
          <span class="badge badge--primary" style="font-size: 0.65rem; padding: 2px 6px; flex-shrink: 0;">${item.badge}</span>
        ` : ''}
      </div>
    `;
  });

  resultsEl.innerHTML = html;

  // Add click handlers
  resultsEl.querySelectorAll('.command-palette-item').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-idx') || '0', 10);
      if (filteredItems[idx]) {
        closeCommandPalette();
        filteredItems[idx].action();
      }
    });
  });
}

function scrollActiveIntoView(container: HTMLElement): void {
  const activeEl = container.querySelector('.command-palette-item.selected') as HTMLElement;
  if (activeEl) {
    activeEl.scrollIntoView({ block: 'nearest' });
  }
}

function refreshSidebar(): void {
  window.dispatchEvent(new CustomEvent('app:refresh-sidebar'));
}

function buildCommandItems(): CommandItem[] {
  const state = store.getData();
  const profiles = store.getProfiles();
  const activeProfile = store.getActiveProfile();
  const routes = router.getRoutes();

  // Generem la llista de totes les comandes disponibles
  const items: CommandItem[] = [];

  // 1. Configuració d'Eines & Presets
  items.push(
    {
      id: 'tool_manager',
      category: 'Configuració d\'Eines',
      title: '⚙️ Obrir Configurador d\'Eines & Mòduls Actius',
      subtitle: 'Activa o desactiva eines a la carta per a ' + activeProfile.name,
      badge: 'Espai de Treball',
      icon: '⚙️',
      keywords: ['eines', 'moduls', 'activar', 'configuracio', 'personalitzar', 'toolkit'],
      action: () => {
        openToolManagerModal(() => {
          refreshSidebar();
          router.navigate(router.getCurrentPath());
        });
      },
    },
    {
      id: 'tool_preset_all',
      category: 'Configuració d\'Eines',
      title: '🚀 Activar Totes les Eines (Suite Completa)',
      subtitle: 'Habilita el 100% de les funcionalitats tributàries i d\'inversió',
      badge: 'Tot Actiu',
      icon: '🌟',
      keywords: ['tot', 'activar tot', 'suite completa'],
      action: () => {
        store.enableAllModules();
        showToast('Totes les eines activades!', 'success');
        refreshSidebar();
        router.navigate(router.getCurrentPath());
      },
    },
    {
      id: 'tool_preset_freelance',
      category: 'Configuració d\'Eines',
      title: '🏢 Plantilla: Autònom, Facturació & IVA 303',
      subtitle: 'Activa eines per a professionals independents i gestió trimestral',
      badge: 'Autònom',
      icon: '🏢',
      keywords: ['autonom', 'iva', 'reta', 'factures'],
      action: () => {
        store.applyModulePreset('freelance_suite');
        showToast('Plantilla Autònom & IVA aplicada!', 'success');
        refreshSidebar();
        router.navigate(router.getCurrentPath());
      },
    },
    {
      id: 'tool_preset_investor',
      category: 'Configuració d\'Eines',
      title: '📈 Plantilla: Inversor Financer, FIFO & Cripto',
      subtitle: 'Activa carteres, guanys patrimonials, Trading i models 720/721',
      badge: 'Inversor',
      icon: '📈',
      keywords: ['inversor', 'trading', 'cripto', 'fifo', 'borsa'],
      action: () => {
        store.applyModulePreset('investor_suite');
        showToast('Plantilla Inversor aplicada!', 'success');
        refreshSidebar();
        router.navigate(router.getCurrentPath());
      },
    }
  );

  // 2. Pàgines & Mòduls
  for (const r of routes) {
    items.push({
      id: `route_${r.path}`,
      category: 'Pàgines & Mòduls',
      title: r.label,
      subtitle: `Secció: ${r.section || 'General'} · Ruta: ${r.path}`,
      icon: r.icon || '📄',
      keywords: [r.label, r.section || '', r.path, 'anar', 'obrir', 'pagina', 'seccio'],
      action: () => router.navigate(r.path),
    });
  }

  // 3. Caselles Principals AEAT
  const irpf = calculateIRPF(state);
  const caselles = [
    { num: '0001', label: 'Retribucions dineràries del treball', val: state.workIncome.employers.reduce((s, e) => s + (e.grossSalary || 0), 0), path: '/treball' },
    { num: '0019', label: 'Cotitzacions a la Seguretat Social', val: state.workIncome.employers.reduce((s, e) => s + (e.socialSecurity || 0), 0), path: '/treball' },
    { num: '0027', label: 'Interessos de comptes i dipòsits', val: state.capitalIncome.interests || 0, path: '/capital' },
    { num: '0029', label: 'Dividends i participació en beneficis', val: state.capitalIncome.dividends || 0, path: '/capital' },
    { num: '0102', label: 'Ingressos d\'immobles en lloguer', val: state.properties.reduce((s, p) => s + (p.grossRentalIncome || 0), 0), path: '/immobles' },
    { num: '0230', label: 'Ingressos d\'Activitats Econòmiques', val: state.activities.income || 0, path: '/activitats' },
    { num: '0435', label: 'Base Imposable General', val: irpf.generalBase, path: '/resultat' },
    { num: '0460', label: 'Base Imposable de l\'Estalvi', val: irpf.savingsBase, path: '/resultat' },
    { num: '0519', label: 'Mínim Personal i Familiar Total', val: irpf.totalMinimum, path: '/personal' },
    { num: '0545', label: 'Quota Líquida Total', val: irpf.netTax, path: '/resultat' },
    { num: '0588', label: 'Deducció per Doble Imposició Internacional', val: irpf.foreignTaxCredit || 0, path: '/capital' },
    { num: '0595', label: 'Retencions suportades del treball', val: state.workIncome.employers.reduce((s, e) => s + (e.withholdings || 0), 0), path: '/treball' },
    { num: '0610', label: 'Resultat de la Declaració (a ingressar/tornar)', val: irpf.result, path: '/resultat' },
  ];

  for (const c of caselles) {
    items.push({
      id: `casella_${c.num}`,
      category: 'Caselles AEAT',
      title: `Casella [${c.num}] — ${c.label}`,
      subtitle: `Valor calculat: ${formatCurrency(c.val)}`,
      badge: formatCurrency(c.val),
      icon: '🏷️',
      keywords: [c.num, c.label, `casella ${c.num}`, 'aeat', 'model 100', 'irpf'],
      action: () => {
        navigator.clipboard?.writeText(String(c.val));
        showToast(`Valor de Casella ${c.num} (${formatCurrency(c.val)}) copiat al porta-retalls`, 'info');
        router.navigate(c.path);
      },
    });
  }

  // 4. Declarants & Perfils
  for (const p of profiles) {
    const isCurrent = p.id === activeProfile.id;
    items.push({
      id: `profile_${p.id}`,
      category: 'Declarants & Perfils',
      title: `${p.name} ${isCurrent ? '★ (Actiu)' : ''}`,
      subtitle: `Rol: ${p.relation} | NIF: ${p.nif || 'No informat'}`,
      badge: isCurrent ? 'Actiu' : 'Canviar',
      icon: p.avatarIcon || '👤',
      keywords: [p.name, p.relation, p.nif || '', 'perfil', 'usuari', 'declarant'],
      action: () => {
        store.setActiveProfile(p.id);
        showToast(`S'ha canviat al declarant: ${p.name}`, 'success');
        refreshSidebar();
        router.navigate(router.getCurrentPath());
      },
    });
  }

  // 5. Eines & Accions ràpides
  items.push(
    {
      id: 'action_pdf',
      category: 'Eines & Accions',
      title: 'Descarregar Informe Oficial PDF Model 100',
      subtitle: 'Genera document complet d\'auditoria amb liquidació, caselles i gràfics',
      badge: 'PDF Oficial',
      icon: '📄',
      keywords: ['pdf', 'descarregar', 'informe', 'imprimir', 'exportar pdf', 'model 100'],
      action: () => {
        try {
          generateModel100PDF(state, irpf);
          showToast('Informe PDF generat correctament!', 'success');
        } catch {
          showToast('Error en generar el PDF', 'error');
        }
      },
    },
    {
      id: 'action_compliance',
      category: 'Eines & Accions',
      title: 'Auditoria Fiscal & Diagnòstic de Coherència',
      subtitle: 'Revisa avisos, alertes de frau, límits legals i optimitzacions pendents',
      badge: 'Auditoria',
      icon: '🛡️',
      keywords: ['auditoria', 'compliance', 'validacio', 'errors', 'avisos'],
      action: () => {
        openComplianceModal(() => {
          refreshSidebar();
          router.navigate(router.getCurrentPath());
        });
      },
    },
    {
      id: 'action_export_json',
      category: 'Eines & Accions',
      title: 'Còpia de Seguretat (Exportar JSON complet)',
      subtitle: 'Descarrega totes les dades fiscals i perfils en fitxer JSON xifrat/pla',
      badge: 'Backup',
      icon: '💾',
      keywords: ['backup', 'copia', 'exportar', 'json', 'descarregar'],
      action: () => router.navigate('/exportar'),
    }
  );

  // 6. Temes visuals
  const themes: { id: AppTheme; name: string; icon: string; desc: string }[] = [
    { id: 'dark', name: 'Tema Dark Nebula (Indigo)', icon: '🌌', desc: 'Fosc profund amb tocs violeta i vidre' },
    { id: 'emerald', name: 'Tema Cyber Fintech (Emerald)', icon: '💚', desc: 'Alta tecnologia amb tocs verds menta' },
    { id: 'nord', name: 'Tema Nord Arctic (Slate)', icon: '❄️', desc: 'Equilibri àrtic blau i gris elegant' },
    { id: 'light', name: 'Tema Light Studio (Clean)', icon: '☀️', desc: 'Mode clar d\'alt contrast i claredat' },
  ];

  for (const t of themes) {
    items.push({
      id: `theme_${t.id}`,
      category: 'Temes Visuals',
      title: t.name,
      subtitle: t.desc,
      badge: store.getTheme() === t.id ? 'Actiu' : 'Aplicar',
      icon: t.icon,
      keywords: ['tema', 'color', 'dark', 'light', 'emerald', 'nord', t.id, t.name],
      action: () => {
        store.setTheme(t.id);
        showToast(`Tema canviat a: ${t.name}`, 'info');
      },
    });
  }

  return items;
}

/** Configura el listener global per a la drecera Ctrl+K / Cmd+K */
export function initCommandPaletteShortcut(): void {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
  });
}
