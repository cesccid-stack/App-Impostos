/**
 * @module components/toast
 * Toast notification system.
 */

type ToastType = 'success' | 'error' | 'warning' | 'info';

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

/** Show a toast notification. */
export function showToast(
  message: string,
  type: ToastType = 'info',
  durationMs = 4000,
): void {
  const c = ensureContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span style="font-size:1.1rem">${TOAST_ICONS[type]}</span>
    <span class="toast__message">${message}</span>
    <button class="toast__close" aria-label="Tancar">×</button>
  `;

  const closeBtn = toast.querySelector('.toast__close')!;
  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 200);
  };

  closeBtn.addEventListener('click', dismiss);
  c.appendChild(toast);

  if (durationMs > 0) {
    setTimeout(dismiss, durationMs);
  }
}
