/**
 * @module components/card
 * Reusable glass card factory.
 */

export interface CardOptions {
  title?: string;
  subtitle?: string;
  icon?: string;
  iconVariant?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  accent?: boolean;
  className?: string;
}

/** Create a glass card element. */
export function createCard(
  options: CardOptions = {},
  content?: HTMLElement | string,
): HTMLElement {
  const card = document.createElement('div');
  const classes = ['card'];
  if (options.accent) classes.push('card--accent');
  if (options.className) classes.push(options.className);
  card.className = classes.join(' ');

  let headerHTML = '';
  if (options.title || options.icon) {
    const iconHTML = options.icon
      ? `<div class="card__icon card__icon--${options.iconVariant ?? 'primary'}">${options.icon}</div>`
      : '';
    const titleHTML = options.title
      ? `<div>
           <div class="card__title">${options.title}</div>
           ${options.subtitle ? `<div class="card__subtitle">${options.subtitle}</div>` : ''}
         </div>`
      : '';

    headerHTML = `<div class="card__header">${titleHTML}${iconHTML}</div>`;
  }

  card.innerHTML = headerHTML;

  if (content) {
    const body = document.createElement('div');
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }
    card.appendChild(body);
  }

  return card;
}

/** Create a stat card with large number display. */
export function createStatCard(opts: {
  label: string;
  value: string;
  icon: string;
  iconVariant?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  valueClass?: string;
}): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';

  card.innerHTML = `
    <div class="card__header">
      <div class="card__icon card__icon--${opts.iconVariant ?? 'primary'}">${opts.icon}</div>
    </div>
    <div class="stat-value ${opts.valueClass ?? ''}">${opts.value}</div>
    <div class="stat-label">${opts.label}</div>
  `;

  return card;
}
