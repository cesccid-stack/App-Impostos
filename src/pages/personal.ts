/**
 * @module pages/personal
 * Situació personal i familiar.
 */

import { store } from '../store.ts';
import { createField, createFormRow, createFormSection } from '../components/form-field.ts';
import { showToast } from '../components/toast.ts';
import { openToolManagerModal } from '../components/tool-manager-modal.ts';
import { createSidebar } from '../components/navbar.ts';
import { ALL_APP_MODULES, getActiveModuleIdsForProfile } from '../fiscal/modules-catalog.ts';

export function renderPersonal(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page';

  const data = store.getData();
  const personal = data.personal;
  const activeProfile = store.getActiveProfile();
  const enabledModules = getActiveModuleIdsForProfile(activeProfile);

  page.innerHTML = `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-lg);">
      <div>
        <h1 class="page-header__title" style="margin:0;">Situació Personal i Familiar</h1>
        <p class="page-header__subtitle" style="margin:4px 0 0 0;">Dades del declarant, descendents, ascendents a càrrec i eines actives</p>
      </div>
      <button class="btn btn--secondary btn--sm" id="btn-personal-open-tools" style="font-weight:600;">
        ⚙️ Eines del Perfil (${enabledModules.length}/${ALL_APP_MODULES.length})
      </button>
    </div>
  `;

  page.querySelector('#btn-personal-open-tools')?.addEventListener('click', () => {
    openToolManagerModal(() => {
      document.getElementById('app-sidebar')?.replaceWith(createSidebar());
      page.replaceWith(renderPersonal());
    });
  });

  // Declarant
  const declarantCard = document.createElement('div');
  declarantCard.className = 'card';
  declarantCard.appendChild(
    createFormSection(
      'Dades del declarant',
      createFormRow(
        createField({
          id: 'personal-age',
          label: 'Edat a 31 de desembre',
          value: personal.age,
          suffix: 'anys',
          min: 0,
          max: 120,
          step: 1,
          onChange: (val) => {
            store.update('personal', { age: parseInt(val, 10) || 35 });
          },
        }),
        createField({
          id: 'personal-disability',
          label: 'Grau de discapacitat',
          value: personal.disability,
          suffix: '%',
          min: 0,
          max: 100,
          step: 1,
          onChange: (val) => {
            store.update('personal', { disability: parseInt(val, 10) || 0 });
          },
        }),
      ),
      createFormRow(
        createField({
          id: 'personal-community',
          label: 'Comunitat autònoma de residència',
          type: 'select',
          value: personal.community || 'CAT',
          options: [
            { value: 'CAT', label: 'Catalunya' },
            { value: 'AND', label: 'Andalucía' },
            { value: 'MAD', label: 'Madrid' },
            { value: 'VAL', label: 'Comunitat Valenciana' },
            // ... altres simplificades
          ],
          onChange: (val) => {
            store.update('personal', { community: val });
          },
        }),
      ),
    ),
  );
  page.appendChild(declarantCard);

  // Descendents
  const descCard = document.createElement('div');
  descCard.className = 'card';
  descCard.style.marginTop = 'var(--space-lg)';
  const descSection = createFormSection('Descendents a càrrec (< 25 anys o amb discapacitat)');
  
  const addDescBtn = document.createElement('button');
  addDescBtn.className = 'btn btn--secondary btn--sm';
  addDescBtn.innerHTML = '＋ Afegir descendent';
  addDescBtn.addEventListener('click', () => {
    const newDesc = { id: crypto.randomUUID(), age: 0, disability: 0 };
    store.update('personal', { descendants: [...store.getData().personal.descendants, newDesc] });
    renderDescendantsList(descList);
    showToast('Descendent afegit', 'success');
  });
  descSection.appendChild(addDescBtn);

  const descList = document.createElement('div');
  descList.id = 'descendants-list';
  descList.style.marginTop = 'var(--space-lg)';
  renderDescendantsList(descList);
  descSection.appendChild(descList);

  descCard.appendChild(descSection);
  page.appendChild(descCard);

  // Ascendents
  const ascCard = document.createElement('div');
  ascCard.className = 'card';
  ascCard.style.marginTop = 'var(--space-lg)';
  const ascSection = createFormSection('Ascendents a càrrec (> 65 anys o amb discapacitat >= 33% que convisquin)');
  
  const addAscBtn = document.createElement('button');
  addAscBtn.className = 'btn btn--secondary btn--sm';
  addAscBtn.innerHTML = '＋ Afegir ascendent';
  addAscBtn.addEventListener('click', () => {
    const newAsc = { id: crypto.randomUUID(), age: 68, disability: 0 };
    store.update('personal', { ascendants: [...(store.getData().personal.ascendants || []), newAsc] });
    renderAscendantsList(ascList);
    showToast('Ascendent afegit', 'success');
  });
  ascSection.appendChild(addAscBtn);

  const ascList = document.createElement('div');
  ascList.id = 'ascendants-list';
  ascList.style.marginTop = 'var(--space-lg)';
  renderAscendantsList(ascList);
  ascSection.appendChild(ascList);

  ascCard.appendChild(ascSection);
  page.appendChild(ascCard);

  return page;
}

function renderDescendantsList(container: HTMLElement) {
  container.innerHTML = '';
  const descendants = store.getData().personal.descendants || [];

  if (descendants.length === 0) {
    container.innerHTML = `<div class="text-muted text-sm">No hi ha descendents registrats.</div>`;
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = 'var(--space-md)';

  descendants.forEach((desc, idx) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = 'var(--space-md)';
    row.style.alignItems = 'flex-end';
    row.style.background = 'var(--bg-surface)';
    row.style.padding = 'var(--space-md)';
    row.style.borderRadius = 'var(--radius-md)';
    row.style.border = '1px solid var(--border-default)';

    row.appendChild(
      createField({
        id: `desc-${desc.id}-age`,
        label: `Edat (Fill ${idx + 1})`,
        value: desc.age,
        type: 'number',
        onChange: (val) => {
          const arr = [...store.getData().personal.descendants];
          arr[idx].age = parseInt(val) || 0;
          store.update('personal', { descendants: arr });
        }
      })
    );

    row.appendChild(
      createField({
        id: `desc-${desc.id}-dis`,
        label: `Discapacitat %`,
        value: desc.disability,
        type: 'number',
        onChange: (val) => {
          const arr = [...store.getData().personal.descendants];
          arr[idx].disability = parseInt(val) || 0;
          store.update('personal', { descendants: arr });
        }
      })
    );

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn--icon btn--ghost';
    delBtn.innerHTML = '🗑';
    delBtn.title = 'Eliminar';
    delBtn.addEventListener('click', () => {
      const arr = store.getData().personal.descendants.filter(d => d.id !== desc.id);
      store.update('personal', { descendants: arr });
      renderDescendantsList(container);
    });
    
    // Wrap button to align with inputs
    const btnWrap = document.createElement('div');
    btnWrap.style.paddingBottom = '8px';
    btnWrap.appendChild(delBtn);
    row.appendChild(btnWrap);

    list.appendChild(row);
  });

  container.appendChild(list);
}

function renderAscendantsList(container: HTMLElement) {
  container.innerHTML = '';
  const ascendants = store.getData().personal.ascendants || [];

  if (ascendants.length === 0) {
    container.innerHTML = `<div class="text-muted text-sm">No hi ha ascendents registrats.</div>`;
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = 'var(--space-md)';

  ascendants.forEach((asc, idx) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = 'var(--space-md)';
    row.style.alignItems = 'flex-end';
    row.style.background = 'var(--bg-surface)';
    row.style.padding = 'var(--space-md)';
    row.style.borderRadius = 'var(--radius-md)';
    row.style.border = '1px solid var(--border-default)';

    row.appendChild(
      createField({
        id: `asc-${asc.id}-age`,
        label: `Edat (Pare/Mare ${idx + 1})`,
        value: asc.age,
        type: 'number',
        onChange: (val) => {
          const arr = [...(store.getData().personal.ascendants || [])];
          arr[idx].age = parseInt(val) || 0;
          store.update('personal', { ascendants: arr });
        }
      })
    );

    row.appendChild(
      createField({
        id: `asc-${asc.id}-dis`,
        label: `Discapacitat %`,
        value: asc.disability,
        type: 'number',
        onChange: (val) => {
          const arr = [...(store.getData().personal.ascendants || [])];
          arr[idx].disability = parseInt(val) || 0;
          store.update('personal', { ascendants: arr });
        }
      })
    );

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn--icon btn--ghost';
    delBtn.innerHTML = '🗑';
    delBtn.title = 'Eliminar';
    delBtn.addEventListener('click', () => {
      const arr = (store.getData().personal.ascendants || []).filter(a => a.id !== asc.id);
      store.update('personal', { ascendants: arr });
      renderAscendantsList(container);
    });
    
    const btnWrap = document.createElement('div');
    btnWrap.style.paddingBottom = '8px';
    btnWrap.appendChild(delBtn);
    row.appendChild(btnWrap);

    list.appendChild(row);
  });

  container.appendChild(list);
}
