/**
 * @module components/table-builder
 * High-performance, memory-efficient reusable data table builder.
 * Features:
 * - Single DocumentFragment batch DOM insertion.
 * - Automatic XSS protection with escapeHtml.
 * - Delegated action event handling ([data-action]).
 * - Responsive table wrapping and clean typography.
 */

import { escapeHtml } from '../utils/dom.ts';

export interface TableColumn<T> {
  header: string;
  key?: keyof T;
  align?: 'left' | 'right' | 'center';
  width?: string;
  render?: (item: T, index: number) => string | HTMLElement;
}

export interface TableAction<T> {
  name: string;
  label: string;
  icon?: string;
  className?: string;
  title?: string;
  onClick: (item: T, index: number, e: MouseEvent) => void;
}

export interface TableConfig<T> {
  columns: TableColumn<T>[];
  data: T[];
  actions?: TableAction<T>[];
  emptyMessage?: string;
  idGetter?: (item: T, index: number) => string;
  className?: string;
}

/**
 * Builds a fast, accessible HTML table element with event delegation.
 */
export function buildTable<T>(config: TableConfig<T>): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = `table-responsive ${config.className || ''}`;

  if (!config.data || config.data.length === 0) {
    wrapper.innerHTML = `
      <div class="empty-state" style="padding:var(--space-xl); text-align:center; color:var(--text-muted);">
        <p style="margin:0; font-size:var(--text-sm);">${escapeHtml(config.emptyMessage || 'No hi ha dades disponibles.')}</p>
      </div>
    `;
    return wrapper;
  }

  const table = document.createElement('table');
  table.className = 'data-table';
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  // 1. Thead
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const col of config.columns) {
    const th = document.createElement('th');
    th.textContent = col.header;
    if (col.align) th.style.textAlign = col.align;
    if (col.width) th.style.width = col.width;
    headerRow.appendChild(th);
  }
  if (config.actions && config.actions.length > 0) {
    const thActions = document.createElement('th');
    thActions.textContent = 'Accions';
    thActions.style.textAlign = 'right';
    thActions.style.width = '100px';
    headerRow.appendChild(thActions);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // 2. Tbody using DocumentFragment
  const tbody = document.createElement('tbody');
  const fragment = document.createDocumentFragment();

  config.data.forEach((item, index) => {
    const tr = document.createElement('tr');
    const itemId = config.idGetter ? config.idGetter(item, index) : String(index);
    tr.dataset.rowIndex = String(index);
    tr.dataset.rowId = itemId;

    for (const col of config.columns) {
      const td = document.createElement('td');
      if (col.align) td.style.textAlign = col.align;

      if (col.render) {
        const rendered = col.render(item, index);
        if (typeof rendered === 'string') {
          td.innerHTML = rendered;
        } else if (rendered instanceof Node) {
          td.appendChild(rendered);
        }
      } else if (col.key) {
        const raw = (item as Record<string, unknown>)[col.key as string];
        td.textContent = raw !== undefined && raw !== null ? String(raw) : '—';
      }
      tr.appendChild(td);
    }

    if (config.actions && config.actions.length > 0) {
      const tdActions = document.createElement('td');
      tdActions.style.textAlign = 'right';
      tdActions.style.whiteSpace = 'nowrap';

      tdActions.innerHTML = config.actions
        .map(
          (act) => `
          <button 
            type="button"
            class="${escapeHtml(act.className || 'btn btn--ghost btn--sm btn--icon')}"
            data-action="${escapeHtml(act.name)}"
            data-row-index="${index}"
            title="${escapeHtml(act.title || act.label)}"
            style="margin-left:4px;"
          >
            ${act.icon ? `<span>${escapeHtml(act.icon)}</span>` : ''}
            ${act.label ? `<span>${escapeHtml(act.label)}</span>` : ''}
          </button>
        `
        )
        .join('');
      tr.appendChild(tdActions);
    }

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
  table.appendChild(tbody);

  // 3. Single Delegated Event Listener for All Actions
  if (config.actions && config.actions.length > 0) {
    const actionMap = new Map(config.actions.map((act) => [act.name, act]));

    tbody.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
      if (!btn) return;

      const actionName = btn.getAttribute('data-action');
      const rowIndexStr = btn.getAttribute('data-row-index');
      if (!actionName || rowIndexStr === null) return;

      const action = actionMap.get(actionName);
      const index = parseInt(rowIndexStr, 10);
      const item = config.data[index];

      if (action && item !== undefined) {
        action.onClick(item, index, e);
      }
    });
  }

  wrapper.appendChild(table);
  return wrapper;
}
