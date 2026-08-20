/**
 * @module pages/users
 * Pàgina de Gestió Integral de Declarants, Perfils Fiscals i Eines Modulars.
 * Permet crear, editar, duplicar, filtrar i configurar les eines a la carta per a cada contribuent.
 */

import { store } from '../store.ts';
import { createSidebar } from '../components/navbar.ts';
import { getStatusMeta } from '../fiscal/user-presets.ts';
import { calculateIRPF } from '../fiscal/irpf.ts';
import { formatCurrency } from '../utils/currency.ts';
import { showToast } from '../components/toast.ts';
import { openToolManagerModal } from '../components/tool-manager-modal.ts';
import { ALL_APP_MODULES, MODULE_PRESETS, getActiveModuleIdsForProfile } from '../fiscal/modules-catalog.ts';
import type { UserProfile, ProfileStatus } from '../types.ts';

export function renderUsersPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container';

  let selectedRelationFilter: string = 'all';
  let selectedStatusFilter: string = 'all';
  let searchQuery: string = '';

  function render() {
    const profiles = store.getProfiles();
    const activeProfileId = store.getActiveProfileId();
    const currentYear = store.getYear();
    const totalAvailableModules = ALL_APP_MODULES.length;

    // Filtrem perfils
    const filteredProfiles = profiles.filter((p) => {
      const matchesRelation = selectedRelationFilter === 'all' || p.relation === selectedRelationFilter;
      const matchesStatus = selectedStatusFilter === 'all' || (p.status || 'draft') === selectedStatusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.nif && p.nif.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)));

      return matchesRelation && matchesStatus && matchesSearch;
    });

    // Càlcul de KPIs globals
    const totalProfiles = profiles.length;
    const mainCount = profiles.filter((p) => p.relation === 'main').length;
    const familyCount = profiles.filter((p) => p.relation === 'spouse' || p.relation === 'child' || p.relation === 'parent').length;
    const clientCount = profiles.filter((p) => p.relation === 'client').length;
    const readyCount = profiles.filter((p) => p.status === 'ready' || p.status === 'filed').length;

    page.innerHTML = `
      <!-- Capçalera Principal -->
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-xl);">
        <div>
          <div style="display:flex; align-items:center; gap:var(--space-sm); margin-bottom:4px;">
            <h1 class="page-header__title" style="margin:0;">👥 Gestió de Declarants & Eines</h1>
            <span class="badge badge--primary" style="font-size:0.8rem;">${totalProfiles} declarants actius</span>
          </div>
          <p class="page-header__subtitle" style="margin:0;">
            Administra els teus declarants personals, familiars o clients, i activa a la carta les eines tributàries que necessiti cadascú
          </p>
        </div>
        <div style="display:flex; gap:var(--space-sm); flex-wrap:wrap;">
          <button class="btn btn--secondary btn--sm" id="btn-open-global-tools" title="Configurar eines del declarant actiu">
            ⚙️ Configurar Eines
          </button>
          <button class="btn btn--secondary btn--sm" id="btn-purge-all-data" title="Netejar totes les dades i començar de zero" style="color:var(--color-error);">
            🧹 Netejar Dades
          </button>
          <button class="btn btn--secondary btn--sm" id="btn-load-demo-profiles" title="Carregar declarants de mostra">
            🧪 Carregar Mostres
          </button>
          <button class="btn btn--secondary btn--sm" id="btn-import-profile-json" title="Importar declarant des d'un fitxer JSON">
            📥 Importar
          </button>
          <button class="btn btn--primary btn--sm" id="btn-create-new-profile" style="font-weight:700;">
            ＋ Nou Declarant
          </button>
        </div>
      </div>

      <!-- Barra de KPIs Estadístics -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-xl);">
        <div class="card" style="padding:var(--space-md); border-left:4px solid var(--color-primary); background:var(--bg-surface-elevated);">
          <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Total Declarants</div>
          <div style="font-size:1.75rem; font-weight:800; color:var(--text-primary); margin-top:2px;">${totalProfiles}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Exercici ${currentYear}</div>
        </div>

        <div class="card" style="padding:var(--space-md); border-left:4px solid #38bdf8; background:var(--bg-surface-elevated);">
          <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Titulars Principals</div>
          <div style="font-size:1.75rem; font-weight:800; color:#38bdf8; margin-top:2px;">${mainCount}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Declarants base</div>
        </div>

        <div class="card" style="padding:var(--space-md); border-left:4px solid #f43f5e; background:var(--bg-surface-elevated);">
          <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Unitat Familiar</div>
          <div style="font-size:1.75rem; font-weight:800; color:#fb7185; margin-top:2px;">${familyCount}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Cònjuges & Descendents</div>
        </div>

        <div class="card" style="padding:var(--space-md); border-left:4px solid #a855f7; background:var(--bg-surface-elevated);">
          <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Expedients / Clients</div>
          <div style="font-size:1.75rem; font-weight:800; color:#c084fc; margin-top:2px;">${clientCount}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Gestió d'assessoria</div>
        </div>

        <div class="card" style="padding:var(--space-md); border-left:4px solid #10b981; background:var(--bg-surface-elevated);">
          <div style="font-size:var(--text-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700;">Declaracions Llestes</div>
          <div style="font-size:1.75rem; font-weight:800; color:#34d399; margin-top:2px;">${readyCount} / ${totalProfiles}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Per presentar a l'AEAT</div>
        </div>
      </div>

      <!-- Barra de Filtres i Cerca -->
      <div class="card" style="margin-bottom:var(--space-xl); padding:var(--space-md); background:var(--bg-surface-elevated);">
        <div style="display:flex; flex-wrap:wrap; gap:var(--space-md); justify-content:space-between; align-items:center;">
          <!-- Cerca -->
          <div style="flex:1; min-width:240px; position:relative;">
            <input
              type="text"
              id="users-search-input"
              class="form-input"
              placeholder="🔍 Cerca per nom, NIF, etiqueta, notes..."
              value="${searchQuery}"
              style="width:100%; padding-left:36px;"
            />
            <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); opacity:0.5;">🔍</span>
          </div>

          <!-- Filtres per Rol / Relació -->
          <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
            <button class="filter-pill ${selectedRelationFilter === 'all' ? 'active' : ''}" data-rel="all">Tots (${totalProfiles})</button>
            <button class="filter-pill ${selectedRelationFilter === 'main' ? 'active' : ''}" data-rel="main">👤 Titulars</button>
            <button class="filter-pill ${selectedRelationFilter === 'spouse' ? 'active' : ''}" data-rel="spouse">👨‍👩‍👧‍👦 Cònjuges</button>
            <button class="filter-pill ${selectedRelationFilter === 'child' ? 'active' : ''}" data-rel="child">👶 Fills</button>
            <button class="filter-pill ${selectedRelationFilter === 'client' ? 'active' : ''}" data-rel="client">📁 Clients</button>
            <button class="filter-pill ${selectedRelationFilter === 'other' ? 'active' : ''}" data-rel="other">🏷️ Altres</button>
          </div>

          <!-- Filtre per Estat -->
          <div>
            <select class="form-select" id="users-status-select" style="font-size:var(--text-xs); padding:6px 10px;">
              <option value="all" ${selectedStatusFilter === 'all' ? 'selected' : ''}>Tots els estats</option>
              <option value="draft" ${selectedStatusFilter === 'draft' ? 'selected' : ''}>📝 Esborrany</option>
              <option value="in_review" ${selectedStatusFilter === 'in_review' ? 'selected' : ''}>🔍 En Revisió</option>
              <option value="ready" ${selectedStatusFilter === 'ready' ? 'selected' : ''}>✅ Validat / Llest</option>
              <option value="filed" ${selectedStatusFilter === 'filed' ? 'selected' : ''}>🏛️ Presentat AEAT</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Graella de Targetes de Perfils -->
      <div id="profiles-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap:var(--space-lg); margin-bottom:var(--space-2xl);">
        ${
          filteredProfiles.length === 0
            ? `
          <div class="card" style="grid-column: 1 / -1; text-align:center; padding:var(--space-2xl); color:var(--text-secondary);">
            <div style="font-size:2.5rem; margin-bottom:var(--space-sm);">🔍</div>
            <h3 style="margin-bottom:var(--space-xs); color:var(--text-primary);">No s'ha trobat cap declarant amb aquests criteris</h3>
            <p style="font-size:var(--text-sm);">Prova d'esborrar el text de cerca o canviar els filtres seleccionats.</p>
            <button class="btn btn--secondary btn--sm" id="btn-clear-filters" style="margin-top:var(--space-md);">Netejar filtres</button>
          </div>
        `
            : filteredProfiles
                .map((profile) => {
                  const isActive = profile.id === activeProfileId;
                  const statusConfig = getStatusMeta(profile.status);
                  const enabledIds = getActiveModuleIdsForProfile(profile);

                  // Càlcul ràpid del resultat fiscal d'aquest perfil
                  const pData = store.getProfileData(profile.id, currentYear);
                  let fiscalRes;
                  try {
                    fiscalRes = calculateIRPF(pData);
                  } catch {
                    fiscalRes = { result: 0, generalBase: 0, savingsBase: 0, netTax: 0, totalWithholdings: 0 };
                  }

                  const isRefund = fiscalRes.result < 0;
                  const grossTotal = (fiscalRes.generalBase || 0) + (fiscalRes.savingsBase || 0);

                  const relationLabel =
                    profile.relation === 'main' ? 'Titular Principal' :
                    profile.relation === 'spouse' ? 'Cònjuge' :
                    profile.relation === 'child' ? 'Descendent' :
                    profile.relation === 'parent' ? 'Ascendent' :
                    profile.relation === 'client' ? 'Client' : 'Declarant';

                  return `
            <div class="card profile-card ${isActive ? 'profile-card--active' : ''}" data-id="${profile.id}" style="
              display:flex;
              flex-direction:column;
              justify-content:space-between;
              border: 1px solid ${isActive ? 'var(--color-primary)' : 'var(--border-default)'};
              box-shadow: ${isActive ? 'var(--shadow-accent), 0 0 0 1px var(--color-primary)' : 'var(--shadow-sm)'};
              background: var(--bg-surface-elevated);
              position:relative;
              overflow:hidden;
              transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
            ">
              ${
                isActive
                  ? `<div style="
                position:absolute; top:0; right:0;
                background:var(--accent-gradient);
                color:#fff;
                font-size:0.65rem;
                font-weight:800;
                text-transform:uppercase;
                padding:4px 12px 4px 16px;
                border-bottom-left-radius:var(--radius-md);
                letter-spacing:0.05em;
                display:flex; align-items:center; gap:4px;
              "><span>⚡</span> DECLARANT ACTIU</div>`
                  : ''
              }

              <!-- Part Superior: Avatar & Dades Identificatives -->
              <div>
                <div style="display:flex; align-items:flex-start; gap:var(--space-md); margin-bottom:var(--space-md);">
                  <!-- Avatar -->
                  <div style="
                    width:48px; height:48px; border-radius:var(--radius-md);
                    background:${profile.avatarColor || 'var(--color-primary)'};
                    display:flex; align-items:center; justify-content:center;
                    font-size:1.5rem; color:#fff; flex-shrink:0;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                  ">
                    ${profile.avatarIcon || '👤'}
                  </div>

                  <div style="flex:1; min-width:0; padding-right:${isActive ? '90px' : '0'};">
                    <h3 style="margin:0 0 2px 0; font-size:var(--text-base); font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      ${profile.name}
                    </h3>
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:4px;">
                      <span class="badge badge--primary" style="font-size:0.7rem; font-weight:600; padding:2px 6px;">
                        ${relationLabel}
                      </span>
                      ${profile.nif ? `<span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-secondary);">${profile.nif}</span>` : ''}
                    </div>
                    ${profile.email ? `<div style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">✉️ ${profile.email}</div>` : ''}
                  </div>
                </div>

                <!-- Estat de Tramitació & Eines Actives -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-sm); padding-bottom:var(--space-xs); border-bottom:1px solid var(--border-subtle);">
                  <div style="display:flex; align-items:center; gap:4px; font-size:0.75rem;">
                    <span style="color:var(--text-muted);">Estat:</span>
                    <span class="badge ${statusConfig.badgeClass}" style="font-size:0.7rem; padding:2px 6px;">
                      ${statusConfig.icon} ${statusConfig.label}
                    </span>
                  </div>
                  <button class="btn btn--secondary btn--sm btn-card-tools" data-id="${profile.id}" style="font-size:0.68rem; padding:2px 8px; border-radius:var(--radius-sm);" title="Configurar eines d'aquest declarant">
                    ⚙️ ${enabledIds.length}/${totalAvailableModules} Eines
                  </button>
                </div>

                <!-- Tags / Etiquetes -->
                ${
                  profile.tags && profile.tags.length > 0
                    ? `
                  <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:var(--space-sm);">
                    ${profile.tags
                      .map(
                        (t) => `
                      <span style="font-size:0.65rem; background:var(--bg-surface); border:1px solid var(--border-subtle); padding:2px 6px; border-radius:var(--radius-sm); color:var(--text-secondary);">
                        #${t}
                      </span>
                    `,
                      )
                      .join('')}
                  </div>
                `
                    : ''
                }

                <!-- Resum Fiscal Ràpid -->
                <div style="background:var(--bg-surface); padding:8px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); margin-bottom:var(--space-md); font-size:0.75rem;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                    <span style="color:var(--text-muted);">Rendes Computables:</span>
                    <span style="font-weight:600; color:var(--text-primary);">${formatCurrency(grossTotal)}</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:var(--text-muted);">Resultat Exercici ${currentYear}:</span>
                    <span style="font-weight:700; color:${isRefund ? 'var(--color-success)' : 'var(--color-error)'}; font-size:0.85rem;">
                      ${isRefund ? '↩ A Tornar: ' : '↗ A Pagar: '} ${formatCurrency(Math.abs(fiscalRes.result))}
                    </span>
                  </div>
                </div>

                ${
                  profile.notes
                    ? `
                  <div style="font-size:0.75rem; color:var(--text-muted); font-style:italic; margin-bottom:var(--space-md); max-height:40px; overflow:hidden; text-overflow:ellipsis;">
                    💬 "${profile.notes}"
                  </div>
                `
                    : ''
                }
              </div>

              <!-- Part Inferior: Botons d'Acció -->
              <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; border-top:1px solid var(--border-subtle); padding-top:var(--space-sm); margin-top:var(--space-xs);">
                ${
                  isActive
                    ? `<button class="btn btn--primary btn--sm" style="flex:1; font-weight:600; font-size:0.75rem; pointer-events:none; opacity:0.9;">
                    ✓ Declarant Actiu
                  </button>`
                    : `<button class="btn btn--secondary btn--sm btn-activate-profile" data-id="${profile.id}" style="flex:1; font-size:0.75rem; font-weight:600;">
                    ⚡ Activar
                  </button>`
                }
                
                <button class="btn btn--ghost btn--sm btn--icon btn-edit-profile" data-id="${profile.id}" title="Editar Dades" style="padding:6px 8px;">
                  ✏️
                </button>
                <button class="btn btn--ghost btn--sm btn--icon btn-duplicate-profile" data-id="${profile.id}" title="Duplicar / Crear Escenari" style="padding:6px 8px;">
                  📋
                </button>
                <button class="btn btn--ghost btn--sm btn--icon btn-export-profile" data-id="${profile.id}" title="Exportar JSON" style="padding:6px 8px;">
                  💾
                </button>
                ${
                  profiles.length > 1
                    ? `
                  <button class="btn btn--ghost btn--sm btn--icon btn-delete-profile" data-id="${profile.id}" title="Eliminar Declarant" style="padding:6px 8px; color:var(--color-error);">
                    🗑️
                  </button>
                `
                    : ''
                }
              </div>
            </div>
          `;
                })
                .join('')
        }
      </div>

      <!-- Panell d'Eines & Mòduls Fiscals Disponibles -->
      <div class="card" style="background:var(--bg-surface); border:1px solid var(--border-default);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm); margin-bottom:var(--space-md);">
          <div style="display:flex; align-items:center; gap:var(--space-sm);">
            <span style="font-size:1.5rem;">⚙️</span>
            <div>
              <h3 style="margin:0; font-size:var(--text-base); font-weight:700;">Suite Modular d'Eines Fiscals a la Carta</h3>
              <p style="margin:2px 0 0 0; color:var(--text-secondary); font-size:var(--text-xs);">
                Totes les eines estan disponibles per a qualsevol declarant sense restriccions de tipus d'usuari
              </p>
            </div>
          </div>
          <button class="btn btn--primary btn--sm" id="btn-bottom-open-tool-manager" style="font-weight:700;">
            ⚙️ Obrir Configurador d'Eines
          </button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:var(--space-sm);">
          ${MODULE_PRESETS.map(p => `
            <div style="background:var(--bg-surface-elevated); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
              <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary); margin-bottom:2px;">
                ${p.icon} ${p.name}
              </div>
              <p style="font-size:0.75rem; color:var(--text-secondary); margin:0 0 6px 0;">
                ${p.description}
              </p>
              <div style="font-size:0.7rem; color:var(--color-primary); font-weight:600;">
                ${p.moduleIds.length} eines incloses
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    attachEventListeners();
  }

  function attachEventListeners() {
    // Cerca
    const searchInput = page.querySelector<HTMLInputElement>('#users-search-input');
    searchInput?.addEventListener('input', (e) => {
      searchQuery = (e.target as HTMLInputElement).value;
      render();
    });

    // Filtres de relació
    page.querySelectorAll<HTMLButtonElement>('.filter-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedRelationFilter = btn.dataset.rel || 'all';
        render();
      });
    });

    // Filtre d'estat
    const statusSelect = page.querySelector<HTMLSelectElement>('#users-status-select');
    statusSelect?.addEventListener('change', () => {
      selectedStatusFilter = statusSelect.value;
      render();
    });

    // Netejar filtres
    page.querySelector('#btn-clear-filters')?.addEventListener('click', () => {
      searchQuery = '';
      selectedRelationFilter = 'all';
      selectedStatusFilter = 'all';
      render();
    });

    // Botó global d'eines
    page.querySelector('#btn-open-global-tools')?.addEventListener('click', () => {
      openToolManagerModal(() => {
        render();
        document.getElementById('app-sidebar')?.replaceWith(createSidebar());
      });
    });

    page.querySelector('#btn-bottom-open-tool-manager')?.addEventListener('click', () => {
      openToolManagerModal(() => {
        render();
        document.getElementById('app-sidebar')?.replaceWith(createSidebar());
      });
    });

    // Configurar eines des d'una targeta
    page.querySelectorAll<HTMLButtonElement>('.btn-card-tools').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (id) {
          store.setActiveProfile(id);
          openToolManagerModal(() => {
            render();
            document.getElementById('app-sidebar')?.replaceWith(createSidebar());
          });
        }
      });
    });

    // Crear nou declarant
    page.querySelector('#btn-create-new-profile')?.addEventListener('click', () => {
      openProfileModal(null, () => {
        render();
        document.getElementById('app-sidebar')?.replaceWith(createSidebar());
      });
    });

    // Netejar totes les dades i reiniciar l'aplicació
    page.querySelector('#btn-purge-all-data')?.addEventListener('click', () => {
      if (confirm('Vols esborrar TOTES les dades i començar completament de zero? Aquesta acció deixarà l\'aplicació 100% neta.')) {
        store.clearAllApplicationData();
        showToast('Aplicació reiniciada: totes les dades han estat esborrades', 'info');
        render();
        document.getElementById('app-sidebar')?.replaceWith(createSidebar());
      }
    });

    // Carregar demo profiles
    page.querySelector('#btn-load-demo-profiles')?.addEventListener('click', () => {
      if (confirm('Vols carregar els declarants de mostra? Aquest canvi reiniciarà els perfils.')) {
        store.loadDemoProfiles();
        showToast('Declarants de demostració carregats amb èxit', 'success');
        render();
        document.getElementById('app-sidebar')?.replaceWith(createSidebar());
      }
    });

    // Importar perfil JSON
    page.querySelector('#btn-import-profile-json')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const content = evt.target?.result as string;
            const imported = store.importSingleProfile(content);
            showToast(`Declarant "${imported.name}" importat correctament`, 'success');
            render();
            document.getElementById('app-sidebar')?.replaceWith(createSidebar());
          } catch (err: any) {
            showToast(err.message || 'Error en importar el fitxer', 'error');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // Activar perfil
    page.querySelectorAll<HTMLButtonElement>('.btn-activate-profile').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (id) {
          store.setActiveProfile(id);
          showToast(`Declarant actiu: ${store.getActiveProfile().name}`, 'info');
          render();
          document.getElementById('app-sidebar')?.replaceWith(createSidebar());
        }
      });
    });

    // Editar perfil
    page.querySelectorAll<HTMLButtonElement>('.btn-edit-profile').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (id) {
          const prof = store.getProfile(id);
          if (prof) {
            openProfileModal(prof, () => {
              render();
              document.getElementById('app-sidebar')?.replaceWith(createSidebar());
            });
          }
        }
      });
    });

    // Duplicar perfil
    page.querySelectorAll<HTMLButtonElement>('.btn-duplicate-profile').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (id) {
          const prof = store.getProfile(id);
          const newName = prompt(`Nom per a la còpia de "${prof?.name}":`, `${prof?.name} (Còpia)`);
          if (newName && newName.trim()) {
            store.duplicateProfile(id, newName.trim());
            showToast(`Declarant copiat: "${newName}"`, 'success');
            render();
            document.getElementById('app-sidebar')?.replaceWith(createSidebar());
          }
        }
      });
    });

    // Exportar perfil individual
    page.querySelectorAll<HTMLButtonElement>('.btn-export-profile').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (id) {
          try {
            const prof = store.getProfile(id);
            const jsonStr = store.exportSingleProfile(id);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `declarant_${(prof?.name || 'usuari').replace(/\s+/g, '_')}_${store.getYear()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Declarant descarregat en format JSON', 'success');
          } catch (e: any) {
            showToast(e.message || 'Error en exportar', 'error');
          }
        }
      });
    });

    // Eliminar perfil
    page.querySelectorAll<HTMLButtonElement>('.btn-delete-profile').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (id) {
          const prof = store.getProfile(id);
          if (confirm(`Segur que vols eliminar "${prof?.name}" i totes les seves dades fiscals?`)) {
            store.deleteProfile(id);
            showToast('Declarant eliminat', 'success');
            render();
            document.getElementById('app-sidebar')?.replaceWith(createSidebar());
          }
        }
      });
    });
  }

  render();
  return page;
}

/** Modal complet de creació / edició de declarant */
function openProfileModal(profileToEdit: UserProfile | null, onSaved: () => void) {
  const isEditing = !!profileToEdit;

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay visible';
  modalOverlay.style.zIndex = '9999';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal';
  modalContent.style.maxWidth = '640px';
  modalContent.style.width = '95%';
  modalContent.style.maxHeight = '90vh';
  modalContent.style.overflowY = 'auto';

  modalContent.innerHTML = `
    <div class="modal__header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md); border-bottom:1px solid var(--border-default); padding-bottom:var(--space-sm);">
      <div>
        <h2 class="modal__title" style="margin:0; font-size:var(--text-lg); font-weight:700;">
          ${isEditing ? `✏️ Editar Declarant: ${profileToEdit.name}` : '＋ Nou Declarant / Contribuent'}
        </h2>
        <p style="margin:2px 0 0 0; font-size:var(--text-xs); color:var(--text-secondary);">
          Introdueix les dades identificatives. Podràs activar o desactivar eines fiscals a voluntat.
        </p>
      </div>
      <button class="btn btn--ghost btn--sm btn--icon" id="btn-close-modal" style="font-size:1.2rem;">✕</button>
    </div>

    <form id="profile-form" style="display:flex; flex-direction:column; gap:var(--space-md);">
      <!-- 1. Dades d'Identificació -->
      <div>
        <label class="form-label" style="font-weight:700; margin-bottom:6px; display:block;">
          1. Dades Personals & Identificació
        </label>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-sm);">
          <div>
            <label class="form-label" style="font-size:0.75rem;">Nom i Cognoms / Raó Social *</label>
            <input
              type="text"
              id="modal-prof-name"
              class="form-input"
              required
              value="${profileToEdit?.name || ''}"
              placeholder="Ex: Maria Soler Puig"
              style="font-size:0.85rem;"
            />
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">NIF / NIE / CIF</label>
            <input
              type="text"
              id="modal-prof-nif"
              class="form-input"
              value="${profileToEdit?.nif || ''}"
              placeholder="Ex: 47823411J"
              style="font-family:var(--font-mono); font-size:0.85rem; text-transform:uppercase;"
            />
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:var(--space-sm); margin-top:var(--space-xs);">
          <div>
            <label class="form-label" style="font-size:0.75rem;">Relació / Rol</label>
            <select class="form-select" id="modal-prof-relation" style="font-size:0.8rem;">
              <option value="main" ${profileToEdit?.relation === 'main' || !profileToEdit ? 'selected' : ''}>Declarant Principal</option>
              <option value="spouse" ${profileToEdit?.relation === 'spouse' ? 'selected' : ''}>Cònjuge / Parella</option>
              <option value="child" ${profileToEdit?.relation === 'child' ? 'selected' : ''}>Fill / Descendent</option>
              <option value="parent" ${profileToEdit?.relation === 'parent' ? 'selected' : ''}>Ascendent / Pare/Mare</option>
              <option value="client" ${profileToEdit?.relation === 'client' ? 'selected' : ''}>Client Assessoria</option>
              <option value="other" ${profileToEdit?.relation === 'other' ? 'selected' : ''}>Altre</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">Comunitat Autònoma</label>
            <select class="form-select" id="modal-prof-community" style="font-size:0.8rem;">
              <option value="CAT" ${profileToEdit?.community === 'CAT' || !profileToEdit ? 'selected' : ''}>Catalunya</option>
              <option value="MAD" ${profileToEdit?.community === 'MAD' ? 'selected' : ''}>Madrid</option>
              <option value="VAL" ${profileToEdit?.community === 'VAL' ? 'selected' : ''}>Comunitat Valenciana</option>
              <option value="AND" ${profileToEdit?.community === 'AND' ? 'selected' : ''}>Andalucía</option>
              <option value="BAL" ${profileToEdit?.community === 'BAL' ? 'selected' : ''}>Illes Balears</option>
              <option value="CAN" ${profileToEdit?.community === 'CAN' ? 'selected' : ''}>Canarias</option>
              <option value="OTH" ${profileToEdit?.community === 'OTH' ? 'selected' : ''}>Altres / General</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">Estat Declaració</label>
            <select class="form-select" id="modal-prof-status" style="font-size:0.8rem;">
              <option value="draft" ${profileToEdit?.status === 'draft' || !profileToEdit ? 'selected' : ''}>📝 Esborrany</option>
              <option value="in_review" ${profileToEdit?.status === 'in_review' ? 'selected' : ''}>🔍 En Revisió</option>
              <option value="ready" ${profileToEdit?.status === 'ready' ? 'selected' : ''}>✅ Validat / Llest</option>
              <option value="filed" ${profileToEdit?.status === 'filed' ? 'selected' : ''}>🏛️ Presentat AEAT</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 2. Contacte i Dades Bancàries -->
      <div>
        <label class="form-label" style="font-weight:700; margin-bottom:6px; display:block;">
          2. Dades de Contacte & Domiciliació
        </label>
        <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:var(--space-sm);">
          <div>
            <label class="form-label" style="font-size:0.75rem;">Correu Electrònic</label>
            <input
              type="email"
              id="modal-prof-email"
              class="form-input"
              value="${profileToEdit?.email || ''}"
              placeholder="correu@exemple.cat"
              style="font-size:0.85rem;"
            />
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">Telèfon</label>
            <input
              type="tel"
              id="modal-prof-phone"
              class="form-input"
              value="${profileToEdit?.phone || ''}"
              placeholder="+34 600 000 000"
              style="font-size:0.85rem;"
            />
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:var(--space-sm); margin-top:var(--space-xs);">
          <div>
            <label class="form-label" style="font-size:0.75rem;">IBAN Compte Bancari (Devolució / Pagament)</label>
            <input
              type="text"
              id="modal-prof-iban"
              class="form-input"
              value="${profileToEdit?.iban || ''}"
              placeholder="ES00 0000 0000 0000 0000 0000"
              style="font-family:var(--font-mono); font-size:0.85rem;"
            />
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">Epígraf IAE (si té activitat)</label>
            <input
              type="text"
              id="modal-prof-iae"
              class="form-input"
              value="${profileToEdit?.activityIAE || ''}"
              placeholder="Ex: 763 Programadors"
              style="font-size:0.85rem;"
            />
          </div>
        </div>
      </div>

      <!-- 3. Personalització & Notes -->
      <div>
        <label class="form-label" style="font-weight:700; margin-bottom:6px; display:block;">
          3. Personalització & Notes Internes
        </label>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:var(--space-sm);">
          <div>
            <label class="form-label" style="font-size:0.75rem;">Etiquetes (separades per comes)</label>
            <input
              type="text"
              id="modal-prof-tags"
              class="form-input"
              value="${profileToEdit?.tags ? profileToEdit.tags.join(', ') : 'Principal, Renda 2025'}"
              placeholder="IVA, Cripto, Lloguer..."
              style="font-size:0.85rem;"
            />
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">Color d'Identificació</label>
            <div style="display:flex; gap:8px; align-items:center; height:38px;">
              <input
                type="color"
                id="modal-prof-color"
                value="${profileToEdit?.avatarColor || '#6366f1'}"
                style="width:40px; height:36px; border:none; border-radius:var(--radius-sm); cursor:pointer; background:none;"
              />
              <span style="font-size:0.75rem; color:var(--text-secondary);">Color de la targeta</span>
            </div>
          </div>
        </div>

        <div style="margin-top:var(--space-xs);">
          <label class="form-label" style="font-size:0.75rem;">Notes d'Auditoria / Instruccions Especials</label>
          <textarea
            id="modal-prof-notes"
            class="form-input"
            rows="2"
            placeholder="Afegeix indicacions fiscals, números de referència o recordatoris..."
            style="font-size:0.85rem; resize:vertical;"
          >${profileToEdit?.notes || ''}</textarea>
        </div>
      </div>

      <!-- 4. Eines & Mòduls Fiscals Actius a la Carta -->
      <div style="background:var(--bg-surface); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-default);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-xs); margin-bottom:8px;">
          <div>
            <label class="form-label" style="font-weight:700; margin:0; display:block;">
              4. Eines & Mòduls Fiscals Actius a la Carta
            </label>
            <span style="font-size:0.75rem; color:var(--text-secondary);">
              Selecciona exactament les eines que necessita aquest declarant (qualsevol perfil pot activar qualsevol eina)
            </span>
          </div>
          <span class="badge badge--primary" id="modal-module-counter" style="font-size:0.75rem;">
            ${(profileToEdit?.enabledModules || ALL_APP_MODULES.map(m => m.id)).length} de ${ALL_APP_MODULES.length} eines actives
          </span>
        </div>

        <!-- Presets ràpids d'activació per a aquest perfil -->
        <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:12px;">
          <button type="button" class="btn btn--secondary btn--sm btn-modal-preset" data-preset="all" style="font-size:0.7rem; padding:3px 8px;">
            🌟 Totes (21)
          </button>
          <button type="button" class="btn btn--secondary btn--sm btn-modal-preset" data-preset="employee" style="font-size:0.7rem; padding:3px 8px;">
            💼 Assalariat
          </button>
          <button type="button" class="btn btn--secondary btn--sm btn-modal-preset" data-preset="freelance" style="font-size:0.7rem; padding:3px 8px;">
            🏢 Autònom (IVA+IRPF)
          </button>
          <button type="button" class="btn btn--secondary btn--sm btn-modal-preset" data-preset="landlord" style="font-size:0.7rem; padding:3px 8px;">
            🏠 Propietari
          </button>
          <button type="button" class="btn btn--secondary btn--sm btn-modal-preset" data-preset="investor" style="font-size:0.7rem; padding:3px 8px;">
            📈 Inversor / Cripto
          </button>
          <button type="button" class="btn btn--secondary btn--sm btn-modal-preset" data-preset="none" style="font-size:0.7rem; padding:3px 8px; color:var(--color-error);">
            ✕ Desmarcar Totes
          </button>
        </div>

        <!-- Graella de Mòduls amb Checkboxes -->
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:6px; max-height:260px; overflow-y:auto; padding-right:4px;">
          ${ALL_APP_MODULES.map(m => {
            const initialEnabled = profileToEdit?.enabledModules || ALL_APP_MODULES.map(item => item.id);
            const isChecked = initialEnabled.includes(m.id);
            return `
              <label style="
                display:flex; align-items:flex-start; gap:8px;
                background:var(--bg-surface-elevated);
                border:1px solid var(--border-subtle);
                border-radius:var(--radius-sm);
                padding:6px 8px;
                cursor:pointer;
                user-select:none;
                transition:border-color 0.15s ease;
              " class="modal-module-item">
                <input
                  type="checkbox"
                  class="modal-module-checkbox"
                  value="${m.id}"
                  ${isChecked ? 'checked' : ''}
                  style="margin-top:2px; cursor:pointer;"
                />
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; align-items:center; gap:4px; font-weight:600; font-size:0.75rem; color:var(--text-primary);">
                    <span>${m.icon}</span>
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.shortName || m.name}</span>
                  </div>
                  <div style="font-size:0.65rem; color:var(--text-muted); line-height:1.2; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${m.category}
                  </div>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Botons de Guardar / Cancel·lar -->
      <div style="display:flex; justify-content:flex-end; gap:var(--space-sm); margin-top:var(--space-sm); border-top:1px solid var(--border-default); padding-top:var(--space-md);">
        <button type="button" class="btn btn--secondary btn--sm" id="btn-cancel-modal">Cancel·lar</button>
        <button type="submit" class="btn btn--primary btn--sm" style="font-weight:700;">
          ${isEditing ? '💾 Guardar Canvis' : '＋ Crear Declarant'}
        </button>
      </div>
    </form>
  `;

  // Close & cancel
  modalContent.querySelector('#btn-close-modal')?.addEventListener('click', closeModal);
  modalContent.querySelector('#btn-cancel-modal')?.addEventListener('click', closeModal);

  // Update live counter function
  const updateModuleCounter = () => {
    const checkedBoxes = modalContent.querySelectorAll<HTMLInputElement>('.modal-module-checkbox:checked');
    const counterEl = modalContent.querySelector('#modal-module-counter');
    if (counterEl) {
      counterEl.textContent = `${checkedBoxes.length} de ${ALL_APP_MODULES.length} eines actives`;
    }
  };

  // Presets click handlers
  modalContent.querySelectorAll<HTMLButtonElement>('.btn-modal-preset').forEach((presetBtn) => {
    presetBtn.addEventListener('click', () => {
      const presetType = presetBtn.dataset.preset;
      const checkboxes = modalContent.querySelectorAll<HTMLInputElement>('.modal-module-checkbox');

      let targetIds: string[] = [];
      if (presetType === 'all') {
        targetIds = ALL_APP_MODULES.map(m => m.id);
      } else if (presetType === 'none') {
        targetIds = [];
      } else if (presetType === 'employee') {
        targetIds = ['work_income', 'deductions', 'simulator', 'result', 'caselles', 'personal'];
      } else if (presetType === 'freelance') {
        targetIds = ['activities', 'iva', 'work_income', 'deductions', 'simulator', 'caselles', 'calendari', 'result'];
      } else if (presetType === 'landlord') {
        targetIds = ['properties', 'iva', 'deductions', 'simulator', 'caselles', 'result'];
      } else if (presetType === 'investor') {
        targetIds = ['capital', 'gains', 'trading', 'wealth_tax', 'foreign_assets', 'simulator', 'result'];
      }

      checkboxes.forEach((cb) => {
        cb.checked = targetIds.includes(cb.value);
      });
      updateModuleCounter();
    });
  });

  modalContent.querySelectorAll<HTMLInputElement>('.modal-module-checkbox').forEach((cb) => {
    cb.addEventListener('change', updateModuleCounter);
  });

  // Submit form
  const form = modalContent.querySelector<HTMLFormElement>('#profile-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const nameInput = modalContent.querySelector<HTMLInputElement>('#modal-prof-name');
    const nifInput = modalContent.querySelector<HTMLInputElement>('#modal-prof-nif');
    const relationSelect = modalContent.querySelector<HTMLSelectElement>('#modal-prof-relation');
    const communitySelect = modalContent.querySelector<HTMLSelectElement>('#modal-prof-community');
    const statusSelect = modalContent.querySelector<HTMLSelectElement>('#modal-prof-status');
    const emailInput = modalContent.querySelector<HTMLInputElement>('#modal-prof-email');
    const phoneInput = modalContent.querySelector<HTMLInputElement>('#modal-prof-phone');
    const ibanInput = modalContent.querySelector<HTMLInputElement>('#modal-prof-iban');
    const iaeInput = modalContent.querySelector<HTMLInputElement>('#modal-prof-iae');
    const tagsInput = modalContent.querySelector<HTMLInputElement>('#modal-prof-tags');
    const colorInput = modalContent.querySelector<HTMLInputElement>('#modal-prof-color');
    const notesInput = modalContent.querySelector<HTMLTextAreaElement>('#modal-prof-notes');

    const nameVal = nameInput?.value.trim();
    if (!nameVal) {
      showToast('Cal introduir un nom per al declarant', 'error');
      return;
    }

    const rawTags = tagsInput?.value || '';
    const tags = rawTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const selectedModules = Array.from(modalContent.querySelectorAll<HTMLInputElement>('.modal-module-checkbox:checked')).map(cb => cb.value);

    const payload: Partial<UserProfile> & { name: string } = {
      name: nameVal,
      relation: (relationSelect?.value as UserProfile['relation']) || 'other',
      nif: nifInput?.value.trim().toUpperCase() || '',
      community: communitySelect?.value || 'CAT',
      status: (statusSelect?.value as ProfileStatus) || 'draft',
      email: emailInput?.value.trim() || '',
      phone: phoneInput?.value.trim() || '',
      iban: ibanInput?.value.trim() || '',
      activityIAE: iaeInput?.value.trim() || '',
      tags,
      avatarColor: colorInput?.value || '#6366f1',
      avatarIcon: '👤',
      notes: notesInput?.value.trim() || '',
      enabledModules: selectedModules.length > 0 ? selectedModules : ['work_income', 'result'],
    };

    if (isEditing && profileToEdit) {
      store.updateProfile(profileToEdit.id, payload);
      showToast(`Declarant "${payload.name}" actualitzat amb ${payload.enabledModules?.length || 0} eines actives`, 'success');
    } else {
      const created = store.createProfile(payload);
      showToast(`Nou declarant "${created.name}" creat amb ${created.enabledModules?.length || 0} eines actives`, 'success');
    }

    closeModal();
    onSaved();
  });

  function closeModal() {
    modalOverlay.remove();
  }

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);
}
