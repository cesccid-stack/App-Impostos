/**
 * @module components/modal
 * Modal dialog component.
 */

export interface ModalOptions {
  title: string;
  onClose?: () => void;
}

/** Open a modal dialog. Returns the body element to populate. */
export function openModal(options: ModalOptions): {
  body: HTMLElement;
  footer: HTMLElement;
  close: () => void;
} {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const header = document.createElement('div');
  header.className = 'modal__header';
  header.innerHTML = `
    <h2 class="modal__title">${options.title}</h2>
    <button class="modal__close" aria-label="Tancar">×</button>
  `;

  const body = document.createElement('div');
  body.className = 'modal__body';

  const footer = document.createElement('div');
  footer.className = 'modal__footer';

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      options.onClose?.();
    }, 150);
  };

  header.querySelector('.modal__close')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Escape key
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  return { body, footer, close };
}
