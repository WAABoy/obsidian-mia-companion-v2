/**
 * PerformanceMonitor.ts - Performance tracking and optimization utilities
 * 
 * Features:
 * - Render time tracking
 * - Memory usage monitoring
 * - API call timing
 * - Performance metrics collection
 * - Lazy loading helpers
 * - Debouncing/throttling utilities
 * - Memoization helpers
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface RenderMetrics {
  componentName: string;
  renderTime: number;
  timestamp: number;
  propsChanged?: string[];
  unnecessary?: boolean;
}

export interface MemoryMetrics {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface APICallMetrics {
  endpoint: string;
  method: string;
  duration: number;
  success: boolean;
  timestamp: number;
  retryCount?: number;
}

export interface PerformanceReport {
  renderMetrics: RenderMetrics[];
  memoryMetrics: MemoryMetrics[];
  apiMetrics: APICallMetrics[];
  slowRenders: RenderMetrics[];
  averageRenderTime: number;
  maxMemoryUsage: number;
  slowestAPICalls: APICallMetrics[];
}

// ============================================================================
// Performance Monitor Class
// ============================================================================

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private renderMetrics: RenderMetrics[] = [];
  private memoryMetrics: MemoryMetrics[] = [];
  private apiMetrics: APICallMetrics[] = [];
  private isMonitoring = false;
  private memoryInterval: number | null = null;
  private slowRenderThreshold = 16; // 60fps = 16.67ms
  private slowAPICallThreshold = 1000; // 1 second
  private maxMetricsCount = 1000;

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  startMonitoring(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Monitor memory every 30 seconds
    this.memoryInterval = window.setInterval(() => {
      this.recordMemoryUsage();
    }, 30000);

    console.log('[PerformanceMonitor] Started monitoring');
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.memoryInterval) {
      window.clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
  }

  // ============================================================================
  // Render Tracking
  // ============================================================================

  trackRender<T>(
    componentName: string,
    renderFn: () => T,
    propsChanged?: string[]
  ): T {
    const start = performance.now();
    const result = renderFn();
    const duration = performance.now() - start;

    const metric: RenderMetrics = {
      componentName,
      renderTime: duration,
      timestamp: Date.now(),
      propsChanged,
      unnecessary: duration < 1 && !propsChanged?.length,
    };

    this.addRenderMetric(metric);

    if (duration > this.slowRenderThreshold) {
      console.warn(`[Performance] Slow render in ${componentName}: ${duration.toFixed(2)}ms`);
    }

    return result;
  }

  createRenderTracker(componentName: string) {
    let lastProps: Record<string, any> = {};
    
    return <T>(props: Record<string, any>, renderFn: () => T): T => {
      const changedProps = Object.keys(props).filter(
        key => props[key] !== lastProps[key]
      );
      lastProps = { ...props };
      
      return this.trackRender(componentName, renderFn, changedProps);
    };
  }

  private addRenderMetric(metric: RenderMetrics): void {
    this.renderMetrics.push(metric);
    if (this.renderMetrics.length > this.maxMetricsCount) {
      this.renderMetrics = this.renderMetrics.slice(-this.maxMetricsCount / 2);
    }
  }

  // ============================================================================
  // Memory Tracking
  // ============================================================================

  recordMemoryUsage(): void {
    if (!performance.memory) return;

    const metric: MemoryMetrics = {
      timestamp: Date.now(),
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    };

    this.memoryMetrics.push(metric);
    if (this.memoryMetrics.length > this.maxMetricsCount) {
      this.memoryMetrics = this.memoryMetrics.slice(-this.maxMetricsCount / 2);
    }
  }

  getMemoryUsage(): MemoryMetrics | null {
    if (!performance.memory) return null;
    
    return {
      timestamp: Date.now(),
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    };
  }

  // ============================================================================
  // API Call Tracking
  // ============================================================================

  async trackAPICall<T>(
    endpoint: string,
    method: string,
    callFn: () => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    const start = performance.now();
    let success = false;

    try {
      const result = await callFn();
      success = true;
      return result;
    } finally {
      const duration = performance.now() - start;
      
      const metric: APICallMetrics = {
        endpoint,
        method,
        duration,
        success,
        timestamp: Date.now(),
        retryCount,
      };

      this.apiMetrics.push(metric);
      if (this.apiMetrics.length > this.maxMetricsCount) {
        this.apiMetrics = this.apiMetrics.slice(-this.maxMetricsCount / 2);
      }

      if (duration > this.slowAPICallThreshold) {
        console.warn(`[Performance] Slow API call ${method} ${endpoint}: ${duration.toFixed(2)}ms`);
      }
    }
  }

  // ============================================================================
  // Reporting
  // ============================================================================

  generateReport(): PerformanceReport {
    const recentRenders = this.renderMetrics.slice(-100);
    const averageRenderTime = recentRenders.reduce((sum, m) => sum + m.renderTime, 0) / recentRenders.length || 0;
    
    const slowRenders = this.renderMetrics.filter(m => m.renderTime > this.slowRenderThreshold);
    
    const maxMemory = this.memoryMetrics.reduce(
      (max, m) => Math.max(max, m.usedJSHeapSize),
      0
    );

    const slowestAPICalls = [...this.apiMetrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      renderMetrics: recentRenders,
      memoryMetrics: this.memoryMetrics.slice(-50),
      apiMetrics: this.apiMetrics.slice(-50),
      slowRenders,
      averageRenderTime,
      maxMemoryUsage: maxMemory,
      slowestAPICalls,
    };
  }

  clearMetrics(): void {
    this.renderMetrics = [];
    this.memoryMetrics = [];
    this.apiMetrics = [];
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  setSlowRenderThreshold(ms: number): void {
    this.slowRenderThreshold = ms;
  }

  setSlowAPICallThreshold(ms: number): void {
    this.slowAPICallThreshold = ms;
  }
}

// ============================================================================
// Debounce Utility
// ============================================================================

export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel(): void;
  flush(): ReturnType<T> | undefined;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean; maxWait?: number } = {}
): DebouncedFunction<T> {
  let timeoutId: number | null = null;
  let lastCallTime: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  let result: ReturnType<T>;

  const invoke = (args: Parameters<T>): ReturnType<T> => {
    result = func(...args);
    return result;
  };

  const startTimer = (pendingFunc: () => void, wait: number): number => {
    return window.setTimeout(pendingFunc, wait);
  };

  const cancelTimer = (id: number | null): void => {
    if (id !== null) {
      clearTimeout(id);
    }
  };

  const shouldInvoke = (time: number): boolean => {
    const timeSinceLastCall = time - (lastCallTime || 0);
    return (
      lastCallTime === null ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (options.maxWait !== undefined && timeSinceLastCall >= options.maxWait)
    );
  };

  const trailingEdge = (): ReturnType<T> | undefined => {
    timeoutId = null;
    if (options.trailing !== false && lastArgs) {
      return invoke(lastArgs);
    }
    lastArgs = null;
    return undefined;
  };

  const timerExpired = (): void => {
    const time = Date.now();
    if (shouldInvoke(time)) {
      trailingEdge();
    } else {
      timeoutId = startTimer(timerExpired, wait - (time - (lastCallTime || 0)));
    }
  };

  const debounced = (...args: Parameters<T>): void => {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastCallTime = time;

    if (isInvoking) {
      if (timeoutId === null) {
        if (options.leading) {
          invoke(args);
        }
        timeoutId = startTimer(timerExpired, wait);
      } else if (options.maxWait !== undefined) {
        timeoutId = startTimer(timerExpired, options.maxWait);
      }
    }
  };

  debounced.cancel = (): void => {
    cancelTimer(timeoutId);
    timeoutId = null;
    lastArgs = null;
    lastCallTime = null;
  };

  debounced.flush = (): ReturnType<T> | undefined => {
    if (timeoutId === null) return undefined;
    return trailingEdge();
  };

  return debounced as DebouncedFunction<T>;
}

// ============================================================================
// Throttle Utility
// ============================================================================

export interface ThrottledFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T> | undefined;
  cancel(): void;
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): ThrottledFunction<T> {
  let timeoutId: number | null = null;
  let previous = 0;
  let lastArgs: Parameters<T> | null = null;
  let result: ReturnType<T>;

  const later = (): void => {
    previous = options.leading === false ? 0 : Date.now();
    timeoutId = null;
    if (lastArgs) {
      result = func(...lastArgs);
      lastArgs = null;
    }
  };

  const throttled = (...args: Parameters<T>): ReturnType<T> | undefined => {
    const now = Date.now();
    if (!previous && options.leading === false) previous = now;
    
    const remaining = limit - (now - previous);
    lastArgs = args;

    if (remaining <= 0 || remaining > limit) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      previous = now;
      result = func(...args);
      lastArgs = null;
    } else if (!timeoutId && options.trailing !== false) {
      timeoutId = window.setTimeout(later, remaining);
    }

    return result;
  };

  throttled.cancel = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    previous = 0;
    timeoutId = null;
    lastArgs = null;
  };

  return throttled as ThrottledFunction<T>;
}

// ============================================================================
// Memoization Utility
// ============================================================================

export function memoize<T extends (...args: any[]) => any>(
  func: T,
  keyResolver?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  const memoized = (...args: Parameters<T>): ReturnType<T> => {
    const key = keyResolver ? keyResolver(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = func(...args);
    cache.set(key, result);
    return result;
  };

  // Expose cache for clearing if needed
  (memoized as any).cache = cache;
  (memoized as any).clear = () => cache.clear();

  return memoized as T;
}

export function memoizeWithTTL<T extends (...args: any[]) => any>(
  func: T,
  ttl: number,
  keyResolver?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, { value: ReturnType<T>; expires: number }>();

  const memoized = (...args: Parameters<T>): ReturnType<T> => {
    const key = keyResolver ? keyResolver(...args) : JSON.stringify(args);
    const cached = cache.get(key);
    
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    const result = func(...args);
    cache.set(key, { value: result, expires: Date.now() + ttl });
    
    // Clean expired entries periodically
    if (cache.size > 100) {
      const now = Date.now();
      for (const [k, v] of cache.entries()) {
        if (v.expires <= now) {
          cache.delete(k);
        }
      }
    }
    
    return result;
  };

  (memoized as any).cache = cache;
  (memoized as any).clear = () => cache.clear();

  return memoized as T;
}

// ============================================================================
// RAF-based Animation Helpers
// ============================================================================

export function rafThrottle<T extends (...args: any[]) => void>(
  callback: T
): (...args: Parameters<T>) => void {
  let ticking = false;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>): void => {
    lastArgs = args;
    
    if (!ticking) {
      window.requestAnimationFrame(() => {
        if (lastArgs) {
          callback(...lastArgs);
        }
        ticking = false;
        lastArgs = null;
      });
      ticking = true;
    }
  };
}

// ============================================================================
// Lazy Loading Helper
// ============================================================================

export interface LazyLoaderOptions<T> {
  loader: () => Promise<T>;
  placeholder?: HTMLElement;
  errorHandler?: (error: Error) => void;
  timeout?: number;
}

export class LazyLoader<T> {
  private loaded = false;
  private loading = false;
  private result: T | null = null;
  private error: Error | null = null;
  private callbacks: Array<(result: T | null, error: Error | null) => void> = [];

  constructor(private options: LazyLoaderOptions<T>) {}

  async load(): Promise<T> {
    if (this.loaded) {
      if (this.error) throw this.error;
      return this.result!;
    }

    if (this.loading) {
      return new Promise((resolve, reject) => {
        this.callbacks.push((result, error) => {
          if (error) reject(error);
          else resolve(result!);
        });
      });
    }

    this.loading = true;

    try {
      const timeoutPromise = this.options.timeout
        ? new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Lazy load timeout')), this.options.timeout);
          })
        : null;

      const loadPromise = this.options.loader();
      
      this.result = timeoutPromise
        ? await Promise.race([loadPromise, timeoutPromise])
        : await loadPromise;

      this.loaded = true;
      this.notifyCallbacks();
      return this.result;
    } catch (err) {
      this.error = err as Error;
      this.options.errorHandler?.(this.error);
      this.notifyCallbacks();
      throw this.error;
    } finally {
      this.loading = false;
    }
  }

  private notifyCallbacks(): void {
    this.callbacks.forEach(cb => cb(this.result, this.error));
    this.callbacks = [];
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  isLoading(): boolean {
    return this.loading;
  }

  getResult(): T | null {
    return this.result;
  }
}

// ============================================================================
// Intersection Observer Helper for Lazy Loading
// ============================================================================

export function createLazyObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
): IntersectionObserver {
  return new IntersectionObserver(callback, {
    root: null,
    rootMargin: '50px',
    threshold: 0.01,
    ...options,
  });
}

// ============================================================================
// Memory Cleanup Helper
// ============================================================================

export class CleanupManager {
  private cleanups: Array<() => void> = [];
  private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListener }> = [];
  private timeouts: number[] = [];
  private intervals: number[] = [];

  addCleanup(cleanup: () => void): () => void {
    this.cleanups.push(cleanup);
    return () => this.removeCleanup(cleanup);
  }

  removeCleanup(cleanup: () => void): void {
    const index = this.cleanups.indexOf(cleanup);
    if (index > -1) {
      this.cleanups.splice(index, 1);
    }
  }

  addEventListener(
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): void {
    element.addEventListener(event, handler, options);
    this.eventListeners.push({ element, event, handler });
  }

  setTimeout(callback: () => void, delay: number): number {
    const id = window.setTimeout(callback, delay);
    this.timeouts.push(id);
    return id;
  }

  setInterval(callback: () => void, delay: number): number {
    const id = window.setInterval(callback, delay);
    this.intervals.push(id);
    return id;
  }

  cleanup(): void {
    // Run all cleanup functions
    this.cleanups.forEach(cleanup => {
      try {
        cleanup();
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    });
    this.cleanups = [];

    // Remove all event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // Clear all timeouts
    this.timeouts.forEach(id => clearTimeout(id));
    this.timeouts = [];

    // Clear all intervals
    this.intervals.forEach(id => clearInterval(id));
    this.intervals = [];
  }
}

// ============================================================================
// Virtual List Helper for Large Lists
// ============================================================================

export interface VirtualListConfig {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export interface VirtualListState {
  startIndex: number;
  endIndex: number;
  virtualOffset: number;
  totalHeight: number;
}

export function calculateVirtualListState(
  totalItems: number,
  scrollTop: number,
  config: VirtualListConfig
): VirtualListState {
  const { itemHeight, containerHeight, overscan = 3 } = config;
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(totalItems - 1, startIndex + visibleCount + overscan * 2);
  
  const virtualOffset = startIndex * itemHeight;
  const totalHeight = totalItems * itemHeight;

  return {
    startIndex,
    endIndex,
    virtualOffset,
    totalHeight,
  };
}

// ============================================================================
// Singleton Export
// ============================================================================

export const performanceMonitor = PerformanceMonitor.getInstance();
export default performanceMonitor;
