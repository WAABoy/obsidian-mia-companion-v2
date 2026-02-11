/**
 * Utils Module - Performance utilities and optimized base classes
 */

// Performance monitoring
export {
  PerformanceMonitor,
  performanceMonitor,
  RenderMetrics,
  MemoryMetrics,
  APICallMetrics,
  PerformanceReport,
} from './PerformanceMonitor';

// Optimization utilities
export {
  debounce,
  throttle,
  DebouncedFunction,
  ThrottledFunction,
  memoize,
  memoizeWithTTL,
  rafThrottle,
  LazyLoader,
  LazyLoaderOptions,
  createLazyObserver,
  CleanupManager,
  calculateVirtualListState,
  VirtualListConfig,
  VirtualListState,
} from './PerformanceMonitor';

// Optimized component base
export {
  OptimizedComponent,
  ComponentOptions,
  ElementCache,
  ElementPool,
} from './OptimizedComponent';

// Default export
export { performanceMonitor as default } from './PerformanceMonitor';
