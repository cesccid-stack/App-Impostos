/**
 * @module components/navbar
 * Sidebar navigation component with multi-profile selector, modular tools activator, Command Palette (Cmd+K) and 4-theme toggle.
 */

import { router } from '../router.ts';
import { store } from '../store.ts';
import { FISCAL_YEARS } from '../fiscal/constants.ts';
import { runAutomatedComplianceChecks } from '../fiscal/auto-validator.ts';
import { openComplianceModal } from './compliance-modal.ts';
import { openCommandPalette } from './command-palette.ts';
import { openToolManagerModal } from './tool-manager-modal.ts';
import { ALL_APP_MODULES, getModuleByPath } from '../fiscal/modules-catalog.ts';
import type { Route, AppTheme } from '../types.ts';

const THEME_INFO: Record<AppTheme, { icon: string; name: string }> = {
  dark: { icon: '🌌', name: 'Dark Nebula' },
  emerald: { icon: '💚', name: 'Cyber Fintech' },
  nord: { icon: '❄️', name: 'Nord Arctic' },
  light: { icon: '☀️', name: 'Light Studio' },
};

/** Create the sidebar navigation. */
export function createSidebar(): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'app-sidebar';
  sidebar.id = 'app-sidebar';

  const profiles = store.getProfiles();
  const activeProfile = store.getActiveProfile();
  const currentTheme = store.getTheme();
  const compliance = runAutomatedComplianceChecks(store.getData());
  const enabledModuleIds = store.getEnabledModules(activeProfile.id);
  const totalAvailableModules = ALL_APP_MODULES.length;

  // Filtrar rutes segons les eines activades per a aquest usuari
  const allRoutes = router.getRoutes();
  const visibleRoutes = allRoutes.filter(r => {
    if (r.path === '/' || r.path === '/usuaris') return true; // Sempre visibles
    const mod = getModuleByPath(r.path);
    if (!mod) return true; // Si no té mòdul associat, mostrar per defecte
    return enabledModuleIds.includes(mod.id);
  });

  const sections = groupRoutesBySection(visibleRoutes);

  sidebar.innerHTML = `
    <div class="sidebar-brand" style="display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; align-items:center; gap:var(--space-sm);">
        <div class="sidebar-brand__logo">H</div>
        <div>
          <div class="sidebar-brand__name">Hacienda</div>
          <div class="sidebar-brand__year">Exercici ${store.getYear()}</div>
        </div>
      </div>
      <button class="btn btn--ghost btn--sm btn--icon" id="theme-toggle-btn" title="Tema actual: ${THEME_INFO[currentTheme]?.name || 'Dark'} (Clica per canviar)" style="font-size:1.1rem; padding:4px 8px;">
        ${THEME_INFO[currentTheme]?.icon || '🌌'}
      </button>
    </div>

    <!-- Barra de Cerca Global / Command Palette (⌘K) -->
    <div style="padding: 0 var(--space-md); margin-bottom: var(--space-xs);">
      <button id="btn-open-cmd-palette" class="btn btn--secondary btn--sm" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:6px 10px; font-size:0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border-default); background:var(--bg-surface-elevated); color:var(--text-secondary);">
        <span style="display:flex; align-items:center; gap:6px;">
          <span>🔍</span>
          <span>Cerca ràpida...</span>
        </span>
        <kbd style="background:var(--bg-surface); border:1px solid var(--border-default); border-radius:3px; padding:1px 5px; font-size:0.65rem; font-family:var(--font-mono); color:var(--text-muted);">⌘K</kbd>
      </button>
    </div>

    <!-- Multi-profile selector & Estat -->
    <div style="padding: 0 var(--space-md); margin-bottom: var(--space-xs);">
      <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-default); border-radius:var(--radius-md); padding:8px 10px; margin-bottom:6px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <!-- Avatar actiu -->
          <div style="
            width:28px; height:28px; border-radius:var(--radius-sm);
            background:${activeProfile.avatarColor || 'var(--color-primary)'};
            display:flex; align-items:center; justify-content:center;
            font-size:0.9rem; flex-shrink:0; color:#fff;
          ">
            ${activeProfile.avatarIcon || '👤'}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:0.8rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${activeProfile.name}
            </div>
            <div style="font-size:0.65rem; color:var(--color-primary); font-weight:600;">
              ${activeProfile.tags && activeProfile.tags.length > 0 ? `🏷️ ${activeProfile.tags[0]}` : '👤 Declarant'}
            </div>
          </div>
        </div>

        <div style="display:flex; gap:4px; align-items:center;">
          <select class="form-select" id="profile-select" style="flex:1; font-size:0.75rem; padding:4px 6px; background:var(--bg-surface); border:1px solid var(--border-default); border-radius:var(--radius-sm); color:var(--text-primary);">
            ${profiles.map(p => `
              <option value="${p.id}" ${p.id === activeProfile.id ? 'selected' : ''}>
                ${p.avatarIcon || '👤'} ${p.name}
              </option>
            `).join('')}
          </select>
          <button class="btn btn--ghost btn--sm btn--icon" id="btn-go-to-users" title="Gestionar Declarants" style="padding:4px 6px; font-size:0.85rem;">👥</button>
        </div>
      </div>
    </div>

    <!-- Botó d'Activació i Gestió d'Eines a la Carta -->
    <div style="padding: 0 var(--space-md); margin-bottom: var(--space-xs);">
      <button id="btn-open-tool-manager-sidebar" class="btn btn--secondary btn--sm" style="
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 10px;
        font-size: 0.75rem;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-accent);
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), var(--bg-surface-elevated));
        color: var(--text-primary);
        font-weight: 600;
      ">
        <span style="display:flex; align-items:center; gap:6px;">
          <span>⚙️</span>
          <span>Activar Eines</span>
        </span>
        <span class="badge badge--primary" style="font-size:0.65rem; padding:2px 6px;">
          ${enabledModuleIds.length}/${totalAvailableModules}
        </span>
      </button>
    </div>

    <!-- Badge d'Auditoria & Diagnòstic en Temps Real -->
    <div style="padding: 0 var(--space-md); margin-bottom: var(--space-sm);">
      <button id="btn-open-compliance-sidebar" class="btn btn--secondary btn--sm" style="width:100%; display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; padding:6px 10px; border-radius:var(--radius-sm); border:1px solid ${compliance.criticalCount > 0 ? 'var(--color-error)' : (compliance.warningCount > 0 ? 'var(--color-warning)' : 'var(--color-success)')}; background:var(--bg-surface-elevated);">
        <span style="display:flex; align-items:center; gap:4px;">
          <span>${compliance.criticalCount > 0 ? '🔴' : (compliance.warningCount > 0 ? '🟡' : '🟢')}</span>
          <span style="font-weight:600;">Auditoria Fiscal</span>
        </span>
        <span class="badge ${compliance.criticalCount > 0 ? 'badge--error' : (compliance.warningCount > 0 ? 'badge--warning' : 'badge--success')}" style="font-size:0.65rem; padding:2px 6px;">
          ${compliance.criticalCount > 0 ? `${compliance.criticalCount} errors` : (compliance.warningCount > 0 ? `${compliance.warningCount} avisos` : '100% OK')}
        </span>
      </button>
    </div>

    <nav class="sidebar-nav" id="sidebar-nav">
      ${Array.from(sections.entries())
        .map(
          ([section, sectionRoutes]) => `
        <div class="sidebar-nav__section">
          ${section ? `<div class="sidebar-nav__section-title">${section}</div>` : ''}
          ${sectionRoutes
            .map(
              (r) => `
            <button class="nav-item${router.getCurrentPath() === r.path ? ' active' : ''}"
                    data-path="${r.path}"
                    id="nav-${r.path.slice(1) || 'dashboard'}">
              <span class="nav-item__icon">${r.icon}</span>
              <span class="nav-item__label">${r.label}</span>
            </button>
          `,
            )
            .join('')}
        </div>
      `,
        )
        .join('')}
    </nav>

    <div class="sidebar-footer">
      <div class="form-group">
        <label class="form-label" for="year-select">Any fiscal</label>
        <select class="form-select sidebar-footer__year-select" id="year-select">
          ${FISCAL_YEARS.map(
            (y) =>
              `<option value="${y}" ${y === store.getYear() ? 'selected' : ''}>${y}</option>`,
          ).join('')}
        </select>
      </div>
    </div>
  `;

  // Profile switcher
  const profileSelect = sidebar.querySelector<HTMLSelectElement>('#profile-select')!;
  profileSelect?.addEventListener('change', () => {
    store.setActiveProfile(profileSelect.value);
    sidebar.replaceWith(createSidebar());
    const current = router.getCurrentPath();
    router.navigate(current);
  });

  sidebar.querySelector('#btn-open-cmd-palette')?.addEventListener('click', () => {
    openCommandPalette();
    closeMobileSidebar();
  });

  sidebar.querySelector('#btn-open-tool-manager-sidebar')?.addEventListener('click', () => {
    openToolManagerModal(() => {
      sidebar.replaceWith(createSidebar());
      const current = router.getCurrentPath();
      router.navigate(current);
    });
    closeMobileSidebar();
  });

  sidebar.querySelector('#btn-go-to-users')?.addEventListener('click', () => {
    router.navigate('/usuaris');
    closeMobileSidebar();
  });

  sidebar.querySelector('#btn-open-compliance-sidebar')?.addEventListener('click', () => {
    openComplianceModal(() => {
      sidebar.replaceWith(createSidebar());
      const current = router.getCurrentPath();
      router.navigate(current);
    });
  });

  // Theme toggle
  const themeBtn = sidebar.querySelector('#theme-toggle-btn')!;
  themeBtn.addEventListener('click', () => {
    const newTheme = store.toggleTheme();
    themeBtn.textContent = THEME_INFO[newTheme]?.icon || '🌌';
    themeBtn.setAttribute('title', `Tema actual: ${THEME_INFO[newTheme]?.name || 'Dark'} (Clica per canviar)`);
  });

  // Event delegation for nav items
  const nav = sidebar.querySelector('#sidebar-nav')!;
  nav.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.nav-item');
    if (target?.dataset.path) {
      router.navigate(target.dataset.path);
      closeMobileSidebar();
    }
  });

  // Year selector
  const yearSelect = sidebar.querySelector<HTMLSelectElement>('#year-select')!;
  yearSelect.addEventListener('change', () => {
    const year = parseInt(yearSelect.value, 10) as (typeof FISCAL_YEARS)[number];
    store.setYear(year);
    const yearLabel = sidebar.querySelector('.sidebar-brand__year');
    if (yearLabel) yearLabel.textContent = `Exercici ${year}`;
  });

  // Update active state on navigation
  router.onNavigate((path) => {
    nav.querySelectorAll('.nav-item').forEach((item) => {
      const el = item as HTMLElement;
      el.classList.toggle('active', el.dataset.path === path);
    });
  });

  return sidebar;
}

/** Create the mobile header bar. */
export function createMobileHeader(): HTMLElement {
  const header = document.createElement('header');
  header.className = 'mobile-header';
  const currentTheme = store.getTheme();

  header.innerHTML = `
    <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Obrir menú">☰</button>
    <div class="sidebar-brand__logo" style="width:28px;height:28px;font-size:0.9rem;">H</div>
    <span style="font-weight:600;font-size:var(--text-sm); flex:1;">Hacienda</span>
    <button class="btn btn--ghost btn--sm btn--icon" id="mobile-tools-btn" title="Configurar Eines" style="font-size:1rem;">⚙️</button>
    <button class="btn btn--ghost btn--sm btn--icon" id="mobile-search-btn" title="Cercar (⌘K)" style="font-size:1rem;">🔍</button>
    <button class="btn btn--ghost btn--sm btn--icon" id="mobile-theme-btn" title="Canviar Tema" style="font-size:1.1rem;">
      ${THEME_INFO[currentTheme]?.icon || '🌌'}
    </button>
  `;

  header.querySelector('#mobile-menu-btn')!.addEventListener('click', () => {
    openMobileSidebar();
  });

  header.querySelector('#mobile-tools-btn')!.addEventListener('click', () => {
    openToolManagerModal(() => {
      const existing = document.getElementById('app-sidebar');
      if (existing) existing.replaceWith(createSidebar());
      const current = router.getCurrentPath();
      router.navigate(current);
    });
  });

  header.querySelector('#mobile-search-btn')!.addEventListener('click', () => {
    openCommandPalette();
  });

  header.querySelector('#mobile-theme-btn')!.addEventListener('click', () => {
    const next = store.toggleTheme();
    header.querySelector('#mobile-theme-btn')!.textContent = THEME_INFO[next]?.icon || '🌌';
  });

  return header;
}

/** Create the mobile overlay. */
export function createMobileOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  overlay.addEventListener('click', closeMobileSidebar);
  return overlay;
}

function openMobileSidebar(): void {
  document.getElementById('app-sidebar')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('visible');
}

function closeMobileSidebar(): void {
  document.getElementById('app-sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

function groupRoutesBySection(routes: Route[]): Map<string, Route[]> {
  const map = new Map<string, Route[]>();
  for (const route of routes) {
    const section = route.section ?? '';
    if (!map.has(section)) map.set(section, []);
    map.get(section)!.push(route);
  }
  return map;
}
