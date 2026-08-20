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

  private handleHashChange(): void {
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

    this.currentPath = hash;

    if (this.container) {
      // Animate out
      this.container.style.opacity = '0';
      this.container.style.transform = 'translateY(8px)';

      setTimeout(() => {
        if (this.container) {
          this.container.innerHTML = '';
          const page = route.render();
          this.container.appendChild(page);

          // Animate in
          requestAnimationFrame(() => {
            if (this.container) {
              this.container.style.opacity = '1';
              this.container.style.transform = 'translateY(0)';
            }
          });
        }
      }, 150);
    }

    for (const cb of this.onNavigateCallbacks) {
      cb(hash);
    }
  }
}

/** Global router instance */
export const router = new Router();
