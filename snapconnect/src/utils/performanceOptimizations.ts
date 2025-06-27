// Performance utilities for the discover feed
// Note: InteractionManager and Platform imports removed to fix type errors

// Performance utilities for the discover feed

export interface PerformanceConfig {
  enableVirtualization: boolean;
  enableImageCaching: boolean;
  enableBackgroundProcessing: boolean;
  maxConcurrentRequests: number;
  debounceMs: number;
  throttleMs: number;
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enableVirtualization: true,
  enableImageCaching: true,
  enableBackgroundProcessing: true,
  maxConcurrentRequests: 3, // Default to 3 concurrent requests
  debounceMs: 300,
  throttleMs: 100,
};

// Debounce function for expensive operations
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Throttle function for scroll events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Run task after interactions are complete
export const runAfterInteractions = (task: () => void): void => {
  // Simplified implementation without InteractionManager
  setTimeout(task, 0);
};

// Batch operations for better performance
export class BatchProcessor<T> {
  private batch: T[] = [];
  private processor: (items: T[]) => Promise<void>;
  private batchSize: number;
  private delay: number;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(
    processor: (items: T[]) => Promise<void>,
    batchSize: number = 10,
    delay: number = 1000
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.delay = delay;
  }

  add(item: T): void {
    this.batch.push(item);
    
    // Process immediately if batch is full
    if (this.batch.length >= this.batchSize) {
      this.processBatch();
    } else {
      // Schedule processing after delay
      this.scheduleProcessing();
    }
  }

  private scheduleProcessing(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    this.timeoutId = setTimeout(() => {
      this.processBatch();
    }, this.delay);
  }

  private async processBatch(): Promise<void> {
    if (this.batch.length === 0) return;
    
    const itemsToProcess = [...this.batch];
    this.batch = [];
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    try {
      await this.processor(itemsToProcess);
    } catch (error) {
      console.error('Batch processing failed:', error);
      // Re-add failed items to the front of the batch
      this.batch.unshift(...itemsToProcess);
    }
  }

  flush(): Promise<void> {
    return this.processBatch();
  }
}

// Request queue for managing concurrent API calls
export class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private running: Set<Promise<any>> = new Set();
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedRequest = async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      this.queue.push(wrappedRequest);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.running.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const request = this.queue.shift();
    if (!request) return;

    const promise = request();
    this.running.add(promise);

    try {
      await promise;
    } finally {
      this.running.delete(promise);
      // Process next item in queue
      this.processQueue();
    }
  }

  get queueSize(): number {
    return this.queue.length;
  }

  get activeRequests(): number {
    return this.running.size;
  }
}

// Memory management utilities
export const memoryOptimizations = {
  // Clear image cache when memory is low
  clearImageCache: () => {
    // This would integrate with your image caching solution
    console.log('Clearing image cache for memory optimization');
  },

  // Reduce view complexity during fast scrolling
  shouldReduceComplexity: (scrollVelocity: number): boolean => {
    return scrollVelocity > 1000; // pixels per second
  },

  // Check if device has limited memory
  isLowMemoryDevice: (): boolean => {
    // Simplified implementation without Platform
    return false; // Default to false for now
  },
};

// View recycling for better memory usage
export class ViewRecycler<T> {
  private recycledViews: T[] = [];
  private inUseViews: Set<T> = new Set();
  private createView: () => T;
  private resetView: (view: T) => void;
  private maxRecycled: number;

  constructor(
    createView: () => T,
    resetView: (view: T) => void,
    maxRecycled: number = 10
  ) {
    this.createView = createView;
    this.resetView = resetView;
    this.maxRecycled = maxRecycled;
  }

  getView(): T {
    let view = this.recycledViews.pop();
    
    if (!view) {
      view = this.createView();
    } else {
      this.resetView(view);
    }
    
    this.inUseViews.add(view);
    return view;
  }

  recycleView(view: T): void {
    if (!this.inUseViews.has(view)) {
      return; // View is not in use
    }
    
    this.inUseViews.delete(view);
    
    if (this.recycledViews.length < this.maxRecycled) {
      this.resetView(view);
      this.recycledViews.push(view);
    }
  }

  clear(): void {
    this.recycledViews = [];
    this.inUseViews.clear();
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  startMeasure(key: string): void {
    if (!__DEV__) return;
    
    const start = performance.now();
    const measurements = this.metrics.get(key) || [];
    measurements.push(start);
    this.metrics.set(key, measurements);
  }
  
  endMeasure(key: string): number | null {
    if (!__DEV__) return null;
    
    const measurements = this.metrics.get(key);
    if (!measurements || measurements.length === 0) {
      console.warn(`No start measurement found for key: ${key}`);
      return null;
    }
    
    const start = measurements.pop()!;
    const duration = performance.now() - start;
    
    console.log(`[Performance] ${key}: ${duration.toFixed(2)}ms`);
    return duration;
  }
  
  getAverageTime(key: string): number | null {
    const measurements = this.metrics.get(key);
    if (!measurements || measurements.length === 0) return null;
    
    const sum = measurements.reduce((a, b) => a + b, 0);
    return sum / measurements.length;
  }
  
  reset(): void {
    this.metrics.clear();
  }
}

// Export singleton instances
export const performanceMonitor = new PerformanceMonitor();
export const requestQueue = new RequestQueue(DEFAULT_PERFORMANCE_CONFIG.maxConcurrentRequests);

// React Hook for performance optimizations
export const usePerformanceOptimizations = (config: Partial<PerformanceConfig> = {}) => {
  const finalConfig = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
  
  const debouncedFunction = <T extends (...args: any[]) => any>(func: T) => 
    debounce(func, finalConfig.debounceMs);
  
  const throttledFunction = <T extends (...args: any[]) => any>(func: T) => 
    throttle(func, finalConfig.throttleMs);
  
  return {
    config: finalConfig,
    debounce: debouncedFunction,
    throttle: throttledFunction,
    runAfterInteractions,
    requestQueue,
    performanceMonitor,
    memoryOptimizations,
  };
};