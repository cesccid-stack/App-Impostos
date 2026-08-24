/**
 * @module router
 * Minimal hash-based SPA router.
 */

import type { Route } from './types.ts';

class Router {
  private routes = new Map<string, Route>();
  private container: HTMLElement | null = null;
  private currentPath = '';
  private onNavigateCallbacks: Array<(path: string) => void> = [];
  private cleanupCallbacks: Array<() => void> = [];

  /** Register a route. */
  register(route: Route): void {
    this.routes.set(route.path, route);
  }

  /** Register multiple routes. */
  registerAll(routes: Route[]): void {
    for (const route of routes) {
      this.register(route);
    }
  }

  /** Register a cleanup callback executed when the current view is unmounted. */
  registerCleanup(fn: () => void): void {
    this.cleanupCallbacks.push(fn);
  }

  /** Set the DOM container for page rendering. */
  setContainer(el: HTMLElement): void {
    this.container = el;
  }

  /** Start listening to hash changes and navigate to the current hash. */
  start(): void {
    window.addEventListener('hashchange', () => this.handleHashChange());
    this.handleHashChange();
  }

  /** Programmatic navigation. */
  navigate(path: string): void {
    window.location.hash = path;
  }

  /**
   * Predictive prefetch: trigger dynamic import in background on link hover.
   */
  prefetch(path: string): void {
    const route = this.routes.get(path);
    if (route && typeof route.render === 'function') {
      try {
        const res = route.render();
        if (res instanceof Promise) {
          res.catch(() => {}); // Silent catch for speculative prefetch
        }
      } catch {
        // Non-blocking
      }
    }
  }

  /** Get all registered routes. */
  getRoutes(): Route[] {
    return Array.from(this.routes.values());
  }

  /** Get the current active path. */
  getCurrentPath(): string {
    return this.currentPath;
  }

  /** Subscribe to navigation events. */
  onNavigate(callback: (path: string) => void): void {
    this.onNavigateCallbacks.push(callback);
  }

  private async handleHashChange(): Promise<void> {
    const hash = window.location.hash.slice(1) || '/';
    const route = this.routes.get(hash);

    if (!route) {
      // Default to first route
      const firstRoute = this.routes.values().next().value;
      if (firstRoute) {
        this.navigate(firstRoute.path);
      }
      return;
    }

    // Execute all registered unmount cleanups from the previous view
    while (this.cleanupCallbacks.length > 0) {
      const cleanup = this.cleanupCallbacks.pop();
      try {
        cleanup?.();
      } catch (e) {
        console.warn('Router cleanup error:', e);
      }
    }

    this.currentPath = hash;

    if (this.container) {
      // Animate out
      this.container.style.opacity = '0';
      this.container.style.transform = 'translateY(8px)';

      try {
        const renderResult = route.render();
        const page = renderResult instanceof Promise ? await renderResult : renderResult;

        // Check if user has navigated away while waiting for async load
        if (this.currentPath !== hash) return;

        if (this.container) {
          this.container.innerHTML = '';
          this.container.appendChild(page);

          // Update document title for SEO & Accessibility
          if (typeof document !== 'undefined') {
            document.title = `${route.label} — Hacienda Control Renda`;
          }

          // Scroll to top of viewport
          window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });

          // Animate in & manage focus for screen readers
          requestAnimationFrame(() => {
            if (this.container && this.currentPath === hash) {
              this.container.style.opacity = '1';
              this.container.style.transform = 'translateY(0)';
              this.container.tabIndex = -1;
              this.container.focus({ preventScroll: true });
            }
          });
        }
      } catch (err) {
        console.error('Failed to render route:', hash, err);
        if (this.container && this.currentPath === hash) {
          this.container.innerHTML = `<div class="card" style="margin:24px; padding:24px; color:var(--color-error);">
            <h3>Error carregant la pàgina</h3>
            <p>${(err as Error)?.message || 'Error desconegut'}</p>
          </div>`;
          this.container.style.opacity = '1';
          this.container.style.transform = 'translateY(0)';
        }
      }
    }

    for (const cb of this.onNavigateCallbacks) {
      cb(hash);
    }
  }
}

/** Global router instance */
export const router = new Router();
