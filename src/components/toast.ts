import { escapeHtml } from '../utils/dom.ts';

type ToastType = 'success' | 'error' | 'warning' | 'info';

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (typeof document === 'undefined') return {} as HTMLElement;
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
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
  if (typeof document === 'undefined') return;
  const c = ensureContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span style="font-size:1.1rem" aria-hidden="true">${TOAST_ICONS[type]}</span>
    <span class="toast__message">${escapeHtml(message)}</span>
    <button class="toast__close" aria-label="Tancar notificació">×</button>
  `;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let isDismissed = false;

  const dismiss = () => {
    if (isDismissed) return;
    isDismissed = true;
    if (timer !== null) clearTimeout(timer);
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 200);
  };

  const closeBtn = toast.querySelector('.toast__close');
  closeBtn?.addEventListener('click', dismiss);
  c.appendChild(toast);

  if (durationMs > 0) {
    timer = setTimeout(dismiss, durationMs);
  }
}
