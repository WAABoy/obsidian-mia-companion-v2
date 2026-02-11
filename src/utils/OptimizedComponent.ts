/**
 * OptimizedComponent.ts - Base class for optimized UI components
 * 
 * Features:
 * - Automatic cleanup management
 * - Debounced updates
 * - Render optimization with RAF
 * - Memory leak prevention
 */

import { CleanupManager, debounce, rafThrottle } from '../utils/PerformanceMonitor';

export interface ComponentOptions {
  debounceMs?: number;
  enableRAF?: boolean;
}

export abstract class OptimizedComponent {
  protected cleanup: CleanupManager;
  protected isDestroyed = false;
  protected isUpdating = false;
  protected pendingUpdate = false;
  private updateCallbacks: Array<() => void> = [];
  private debouncedUpdate: (() => void) | null = null;
  private rafUpdate: (() => void) | null = null;

  constructor(options: ComponentOptions = {}) {
    this.cleanup = new CleanupManager();

    if (options.debounceMs) {
      this.debouncedUpdate = debounce(() => this.performUpdate(), options.debounceMs);
    }

    if (options.enableRAF !== false) {
      this.rafUpdate = rafThrottle(() => this.performUpdate());
    }
  }

  /**
   * Schedule an update - uses debounce or RAF if configured
   */
  protected scheduleUpdate(): void {
    if (this.isDestroyed) return;

    if (this.debouncedUpdate) {
      this.debouncedUpdate();
    } else if (this.rafUpdate) {
      this.rafUpdate();
    } else {
      this.performUpdate();
    }
  }

  /**
   * Force immediate update
   */
  protected forceUpdate(): void {
    if (this.isDestroyed) return;
    this.performUpdate();
  }

  /**
   * Override this method to implement actual rendering logic
   */
  protected abstract performUpdate(): void;

  /**
   * Batch multiple updates into a single render
   */
  protected batchUpdate(updates: Array<() => void>): void {
    updates.forEach(update => update());
    this.scheduleUpdate();
  }

  /**
   * Safe DOM manipulation - checks if destroyed first
   */
  protected safeDOMOperation<T>(operation: () => T): T | null {
    if (this.isDestroyed) return null;
    return operation();
  }

  /**
   * Destroy the component and clean up all resources
   */
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    
    this.cleanup.cleanup();
    this.updateCallbacks = [];
    this.debouncedUpdate = null;
    this.rafUpdate = null;
  }

  /**
   * Check if component is destroyed
   */
  getIsDestroyed(): boolean {
    return this.isDestroyed;
  }
}

/**
 * Optimized element cache for frequently accessed DOM elements
 */
export class ElementCache {
  private cache = new Map<string, Element>();
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  get(selector: string): Element | null {
    if (this.cache.has(selector)) {
      return this.cache.get(selector)!;
    }

    const element = this.root.querySelector(selector);
    if (element) {
      this.cache.set(selector, element);
    }
    return element;
  }

  getAll(selector: string): Element[] {
    return Array.from(this.root.querySelectorAll(selector));
  }

  invalidate(selector?: string): void {
    if (selector) {
      this.cache.delete(selector);
    } else {
      this.cache.clear();
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Pool for reusable DOM elements to reduce GC pressure
 */
export class ElementPool {
  private pools = new Map<string, HTMLElement[]>();
  private activeElements = new Set<HTMLElement>();
  private maxPoolSize = 20;

  acquire(tagName: string, className?: string): HTMLElement {
    const pool = this.pools.get(tagName) || [];
    
    let element: HTMLElement;
    
    if (pool.length > 0) {
      element = pool.pop()!;
      // Reset element state
      element.className = className || '';
      element.innerHTML = '';
      element.removeAttribute('style');
    } else {
      element = document.createElement(tagName);
      if (className) {
        element.className = className;
      }
    }

    this.activeElements.add(element);
    this.pools.set(tagName, pool);
    
    return element;
  }

  release(element: HTMLElement): void {
    if (!this.activeElements.has(element)) return;
    
    this.activeElements.delete(element);
    
    const tagName = element.tagName.toLowerCase();
    const pool = this.pools.get(tagName) || [];
    
    if (pool.length < this.maxPoolSize) {
      // Clean element for reuse
      element.remove();
      element.innerHTML = '';
      element.className = '';
      element.removeAttribute('style');
      pool.push(element);
      this.pools.set(tagName, pool);
    }
  }

  releaseAll(): void {
    this.activeElements.forEach(element => this.release(element));
    this.activeElements.clear();
  }

  clear(): void {
    this.releaseAll();
    this.pools.clear();
  }
}
