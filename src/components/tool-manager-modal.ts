/**
 * @module components/tool-manager-modal
 * Modal interactiu per a la configuració i activació d'eines a la carta (Workspace Customizer).
 * Permet a qualsevol declarant triar exactament quines eines vol veure i utilitzar.
 */

import { store } from '../store.ts';
import { ALL_APP_MODULES, MODULE_PRESETS } from '../fiscal/modules-catalog.ts';
import { showToast } from './toast.ts';

export function openToolManagerModal(onSaveCallback?: () => void): void {
  const existing = document.getElementById('tool-manager-modal');
  if (existing) existing.remove();

  const activeProfile = store.getActiveProfile();
  let currentEnabled = new Set<string>(store.getEnabledModules(activeProfile.id));
  let selectedCategory: string = 'all';
  let searchQuery: string = '';

  const overlay = document.createElement('div');
  overlay.id = 'tool-manager-modal';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 150ms ease-out;
  `;

  const modalBox = document.createElement('div');
  modalBox.className = 'tool-manager-box';
  modalBox.style.cssText = `
    background: var(--modal-bg);
    border: 1px solid var(--border-accent);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg), 0 0 50px rgba(99, 102, 241, 0.2);
    width: 100%;
    max-width: 840px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: scaleIn 150ms ease-out;
  `;

  function renderContent() {
    const totalModules = ALL_APP_MODULES.length;
    const activeCount = currentEnabled.size;

    // Filter modules
    const filteredModules = ALL_APP_MODULES.filter(m => {
      const matchCat = selectedCategory === 'all' || m.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        m.name.toLowerCase().includes(q) ||
        m.shortName.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.tags.some(t => t.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });

    modalBox.innerHTML = `
      <!-- Header -->
      <div style="
        padding: 20px 24px 16px 24px;
        border-bottom: 1px solid var(--border-default);
        background: var(--bg-surface-elevated);
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 12px;
      ">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.4rem;">⚙️</span>
            <h2 style="margin: 0; font-size: var(--text-lg); font-weight: 800; color: var(--text-primary);">
              Configurador d'Eines & Mòduls Actius
            </h2>
            <span class="badge badge--primary" id="badge-active-count" style="font-size: 0.75rem;">
              ${activeCount} / ${totalModules} Eines Actives
            </span>
          </div>
          <p style="margin: 4px 0 0 0; font-size: var(--text-xs); color: var(--text-secondary);">
            Personalitza el teu espai de treball activant únicament les eines que necessites per a <strong>${activeProfile.name}</strong>.
          </p>
        </div>
        <button class="btn btn--ghost btn--sm btn--icon" id="btn-close-tool-manager" style="font-size: 1.2rem; line-height: 1;">✕</button>
      </div>

      <!-- Presets bar -->
      <div style="
        padding: 12px 24px;
        background: var(--bg-surface);
        border-bottom: 1px solid var(--border-subtle);
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      ">
        <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
          Plantilles Ràpides:
        </span>
        ${MODULE_PRESETS.map(p => `
          <button class="btn btn--secondary btn--sm btn-apply-preset" data-preset="${p.id}" style="font-size: 0.75rem; padding: 4px 10px;" title="${p.description}">
            ${p.name}
          </button>
        `).join('')}
      </div>

      <!-- Filters & Search -->
      <div style="
        padding: 12px 24px;
        background: var(--bg-surface-elevated);
        border-bottom: 1px solid var(--border-default);
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
      ">
        <div style="flex: 1; min-width: 220px; position: relative;">
          <input
            type="text"
            id="tool-search-input"
            class="form-input"
            placeholder="🔍 Cerca eines (ex: IVA, Immobles, FIFO, Beckham...)"
            value="${searchQuery}"
            style="width: 100%; font-size: 0.85rem; padding: 6px 12px;"
          />
        </div>

        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="filter-pill ${selectedCategory === 'all' ? 'active' : ''}" data-cat="all">Totes</button>
          <button class="filter-pill ${selectedCategory === 'Ingressos & Rendiments' ? 'active' : ''}" data-cat="Ingressos & Rendiments">💼 Ingressos</button>
          <button class="filter-pill ${selectedCategory === 'Impostos & Models AEAT' ? 'active' : ''}" data-cat="Impostos & Models AEAT">🧾 Models AEAT</button>
          <button class="filter-pill ${selectedCategory === 'Inversió & Patrimoni' ? 'active' : ''}" data-cat="Inversió & Patrimoni">📈 Inversió</button>
          <button class="filter-pill ${selectedCategory === 'Eines d\'Optimització' ? 'active' : ''}" data-cat="Eines d\'Optimització">🎯 Optimització</button>
          <button class="filter-pill ${selectedCategory === 'Fiscal & Normativa' ? 'active' : ''}" data-cat="Fiscal & Normativa">📜 Normativa</button>
        </div>
      </div>

      <!-- Module List (Scrollable) -->
      <div style="
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      ">
        ${filteredModules.length === 0 ? `
          <div style="text-align: center; padding: 40px; color: var(--text-muted);">
            <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
            <p>No s'ha trobat cap eina que coincideixi amb la cerca.</p>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 12px;">
            ${filteredModules.map(m => {
              const isEnabled = currentEnabled.has(m.id);
              return `
                <div class="card" style="
                  padding: 12px 14px;
                  background: ${isEnabled ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)'};
                  border: 1px solid ${isEnabled ? 'var(--border-accent)' : 'var(--border-subtle)'};
                  border-radius: var(--radius-md);
                  display: flex;
                  gap: 12px;
                  align-items: flex-start;
                  transition: all 150ms ease;
                  opacity: ${isEnabled ? '1' : '0.65'};
                ">
                  <div style="
                    width: 38px;
                    height: 38px;
                    border-radius: var(--radius-sm);
                    background: ${isEnabled ? 'var(--accent-gradient)' : 'var(--bg-surface)'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    color: #fff;
                    flex-shrink: 0;
                  ">
                    ${m.icon}
                  </div>

                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                      <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${m.name}
                      </div>
                      <label class="switch" style="position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; margin-left: 8px;">
                        <input type="checkbox" class="tool-toggle-checkbox" data-id="${m.id}" ${isEnabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                        <span class="slider round" style="
                          position: absolute; cursor: pointer; inset: 0;
                          background-color: ${isEnabled ? 'var(--color-primary)' : 'rgba(255,255,255,0.2)'};
                          transition: .2s; border-radius: 20px;
                        ">
                          <span style="
                            position: absolute; height: 14px; width: 14px; left: ${isEnabled ? '19px' : '3px'}; bottom: 3px;
                            background-color: white; transition: .2s; border-radius: 50%; display: block;
                          "></span>
                        </span>
                      </label>
                    </div>

                    <div style="font-size: 0.72rem; color: var(--text-secondary); line-height: 1.35; margin-bottom: 6px;">
                      ${m.description}
                    </div>

                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                      <span class="badge" style="font-size: 0.65rem; background: var(--bg-surface); color: var(--text-muted); padding: 1px 6px;">
                        ${m.category}
                      </span>
                      ${m.tags.slice(0, 3).map(t => `
                        <span style="font-size: 0.65rem; color: var(--text-secondary); background: rgba(255,255,255,0.04); padding: 1px 5px; border-radius: 3px;">
                          #${t}
                        </span>
                      `).join('')}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Footer with Save & Reset -->
      <div style="
        padding: 16px 24px;
        border-top: 1px solid var(--border-default);
        background: var(--bg-surface-elevated);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      ">
        <div style="display: flex; gap: 8px;">
          <button class="btn btn--secondary btn--sm" id="btn-select-all-tools">
            ✓ Activar Tot (${totalModules})
          </button>
          <button class="btn btn--ghost btn--sm" id="btn-reset-basic-tools">
            ↺ Renda Estàndard
          </button>
        </div>

        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="btn btn--secondary btn--sm" id="btn-cancel-tool-manager">
            Cancel·lar
          </button>
          <button class="btn btn--primary btn--sm" id="btn-save-tool-manager" style="font-weight: 700; padding: 6px 18px;">
            💾 Desar Configuració
          </button>
        </div>
      </div>
    `;

    // Bind listeners
    modalBox.querySelector('#btn-close-tool-manager')?.addEventListener('click', close);
    modalBox.querySelector('#btn-cancel-tool-manager')?.addEventListener('click', close);

    const searchInput = modalBox.querySelector<HTMLInputElement>('#tool-search-input');
    searchInput?.addEventListener('input', (e) => {
      searchQuery = (e.target as HTMLInputElement).value;
      renderContent();
      const newSearch = modalBox.querySelector<HTMLInputElement>('#tool-search-input');
      if (newSearch) {
        newSearch.focus();
        newSearch.setSelectionRange(searchQuery.length, searchQuery.length);
      }
    });

    modalBox.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedCategory = (btn as HTMLElement).dataset.cat || 'all';
        renderContent();
      });
    });

    modalBox.querySelectorAll('.tool-toggle-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = (e.target as HTMLElement).dataset.id;
        if (id) {
          if ((e.target as HTMLInputElement).checked) {
            currentEnabled.add(id);
          } else {
            if (currentEnabled.size > 1) {
              currentEnabled.delete(id);
            } else {
              showToast('Cal mantenir almenys 1 eina activa', 'warning');
              (e.target as HTMLInputElement).checked = true;
            }
          }
          renderContent();
        }
      });
    });

    modalBox.querySelectorAll('.btn-apply-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = (btn as HTMLElement).dataset.preset;
        const preset = MODULE_PRESETS.find(p => p.id === pId);
        if (preset) {
          currentEnabled = new Set(preset.moduleIds);
          showToast(`S'ha aplicat la plantilla: ${preset.name}`, 'info');
          renderContent();
        }
      });
    });

    modalBox.querySelector('#btn-select-all-tools')?.addEventListener('click', () => {
      currentEnabled = new Set(ALL_APP_MODULES.map(m => m.id));
      showToast('Totes les eines activades', 'info');
      renderContent();
    });

    modalBox.querySelector('#btn-reset-basic-tools')?.addEventListener('click', () => {
      const basic = MODULE_PRESETS.find(p => p.id === 'basic_income');
      if (basic) {
        currentEnabled = new Set(basic.moduleIds);
        showToast('Configuració de renda bàsica aplicada', 'info');
        renderContent();
      }
    });

    modalBox.querySelector('#btn-save-tool-manager')?.addEventListener('click', () => {
      const idsArray = Array.from(currentEnabled);
      store.setProfileModules(activeProfile.id, idsArray);
      showToast(`S'han desat ${idsArray.length} eines per a ${activeProfile.name}`, 'success');
      close();
      if (onSaveCallback) {
        onSaveCallback();
      }
    });
  }

  function close() {
    overlay.remove();
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  renderContent();
  overlay.appendChild(modalBox);
  document.body.appendChild(overlay);
}
