/**
 * @module components/form-field
 * Form input builder utilities.
 */

export interface FieldConfig {
  id: string;
  label: string;
  type?: 'number' | 'text' | 'date' | 'select';
  value?: string | number;
  placeholder?: string;
  suffix?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
}

/** Create a form field with label, input, and optional suffix/hint. */
export function createField(config: FieldConfig): HTMLElement {
  const group = document.createElement('div');
  group.className = 'form-group';

  const label = document.createElement('label');
  label.className = 'form-label';
  label.htmlFor = config.id;
  label.textContent = config.label;
  group.appendChild(label);

  if (config.type === 'select' && config.options) {
    const select = document.createElement('select');
    select.className = 'form-select';
    select.id = config.id;
    select.innerHTML = config.options
      .map(
        (opt) =>
          `<option value="${opt.value}" ${String(config.value) === opt.value ? 'selected' : ''}>${opt.label}</option>`,
      )
      .join('');

    if (config.onChange) {
      const cb = config.onChange;
      select.addEventListener('change', () => cb(select.value));
    }
    group.appendChild(select);
  } else {
    const wrapper = document.createElement('div');
    if (config.suffix) wrapper.className = 'form-suffix';

    const input = document.createElement('input');
    input.className = 'form-input';
    input.id = config.id;
    input.type = config.type ?? 'number';

    if (config.type === 'number' || !config.type) {
      input.inputMode = 'decimal';
      input.step = String(config.step ?? 0.01);
      if (config.min !== undefined) input.min = String(config.min);
      if (config.max !== undefined) input.max = String(config.max);
    }

    if (config.value !== undefined) {
      input.value = String(config.value);
    }

    if (config.placeholder) {
      input.placeholder = config.placeholder;
    }

    if (config.onChange) {
      const cb = config.onChange;
      input.addEventListener('input', () => cb(input.value));
      input.addEventListener('change', () => cb(input.value));
    }

    wrapper.appendChild(input);

    if (config.suffix) {
      const suffixEl = document.createElement('span');
      suffixEl.className = 'form-suffix__text';
      suffixEl.textContent = config.suffix;
      wrapper.appendChild(suffixEl);
    }

    group.appendChild(wrapper);
  }

  if (config.hint) {
    const hint = document.createElement('span');
    hint.className = 'form-hint';
    hint.textContent = config.hint;
    group.appendChild(hint);
  }

  return group;
}

/** Create a toggle (checkbox) field. */
export function createToggle(opts: {
  id: string;
  label: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}): HTMLElement {
  const toggle = document.createElement('label');
  toggle.className = 'form-toggle';
  toggle.htmlFor = opts.id;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = opts.id;
  input.checked = opts.checked ?? false;

  if (opts.onChange) {
    const cb = opts.onChange;
    input.addEventListener('change', () => cb(input.checked));
  }

  const labelText = document.createElement('span');
  labelText.textContent = opts.label;

  toggle.appendChild(input);
  toggle.appendChild(labelText);

  return toggle;
}

/**
 * Create a form section with title and content.
 */
export function createFormSection(
  title: string,
  ...children: HTMLElement[]
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'form-section';

  const titleEl = document.createElement('h3');
  titleEl.className = 'form-section__title';
  titleEl.textContent = title;
  section.appendChild(titleEl);

  for (const child of children) {
    section.appendChild(child);
  }

  return section;
}

/** Create a form row (grid) with multiple fields. */
export function createFormRow(...children: HTMLElement[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'form-row';
  for (const child of children) {
    row.appendChild(child);
  }
  return row;
}
