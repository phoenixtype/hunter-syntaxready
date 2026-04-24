import { useEffect } from 'react';

interface PerformanceMetrics {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
}

/**
 * Hook to monitor Core Web Vitals and performance metrics
 * Reports metrics for performance optimization and audit compliance
 */
export function usePerformanceMonitoring() {
  useEffect(() => {
    const metrics: PerformanceMetrics = {};

    // Function to report metrics (to analytics or monitoring service)
    const reportMetric = (name: string, value: number) => {
      metrics[name as keyof PerformanceMetrics] = value;

      // Only log in development, send to analytics in production
      if (import.meta.env.DEV) {
        console.log(`Performance Metric - ${name}:`, value);
      } else {
        // In production, send to analytics
        if (window.gtag) {
          window.gtag('event', 'performance_metric', {
            metric_name: name,
            value: Math.round(value),
            custom_parameter: 'core_web_vitals'
          });
        }
      }
    };

    // Largest Contentful Paint (LCP)
    const observeLCP = () => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'largest-contentful-paint') {
              reportMetric('lcp', entry.startTime);
            }
          }
        });

        try {
          observer.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (error) {
          console.warn('LCP observer not supported:', error);
        }
      }
    };

    // First Input Delay (FID)
    const observeFID = () => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'first-input') {
              const fidEntry = entry as PerformanceEventTiming;
              reportMetric('fid', fidEntry.processingStart - fidEntry.startTime);
            }
          }
        });

        try {
          observer.observe({ entryTypes: ['first-input'] });
        } catch (error) {
          console.warn('FID observer not supported:', error);
        }
      }
    };

    // Cumulative Layout Shift (CLS)
    const observeCLS = () => {
      if ('PerformanceObserver' in window) {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
        });

        try {
          observer.observe({ entryTypes: ['layout-shift'] });

          // Report CLS when page becomes hidden
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
              reportMetric('cls', clsValue);
            }
          });
        } catch (error) {
          console.warn('CLS observer not supported:', error);
        }
      }
    };

    // First Contentful Paint (FCP)
    const observeFCP = () => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              reportMetric('fcp', entry.startTime);
            }
          }
        });

        try {
          observer.observe({ entryTypes: ['paint'] });
        } catch (error) {
          console.warn('FCP observer not supported:', error);
        }
      }
    };

    // Time to First Byte (TTFB)
    const measureTTFB = () => {
      if ('performance' in window && 'getEntriesByType' in window.performance) {
        const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          const ttfb = navigation.responseStart - navigation.requestStart;
          reportMetric('ttfb', ttfb);
        }
      }
    };

    // Memory usage (if supported)
    const measureMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        reportMetric('memory_used', memory.usedJSHeapSize);
        reportMetric('memory_total', memory.totalJSHeapSize);
        reportMetric('memory_limit', memory.jsHeapSizeLimit);
      }
    };

    // Initialize observers
    observeLCP();
    observeFID();
    observeCLS();
    observeFCP();

    // Measure immediately available metrics
    measureTTFB();

    // Measure memory usage periodically
    const memoryInterval = setInterval(measureMemoryUsage, 30000); // Every 30 seconds

    // Resource timing
    const observeResources = () => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;

              // Report slow resources (> 1 second)
              if (resourceEntry.duration > 1000) {
                if (import.meta.env.DEV) {
                  console.warn(`Slow resource: ${resourceEntry.name} took ${resourceEntry.duration}ms`);
                }
              }
            }
          }
        });

        try {
          observer.observe({ entryTypes: ['resource'] });
        } catch (error) {
          console.warn('Resource observer not supported:', error);
        }
      }
    };

    observeResources();

    // Page load time
    window.addEventListener('load', () => {
      const loadTime = performance.now();
      reportMetric('page_load_time', loadTime);
    });

    // Cleanup
    return () => {
      clearInterval(memoryInterval);
    };
  }, []);

  return null;
}

/**
 * Performance utilities
 */
export const PerformanceUtils = {
  /**
   * Mark performance timing for custom metrics
   */
  mark: (name: string) => {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(name);
    }
  },

  /**
   * Measure time between two performance marks
   */
  measure: (name: string, startMark: string, endMark: string) => {
    if ('performance' in window && 'measure' in performance) {
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name)[0];
        return measure.duration;
      } catch (error) {
        console.warn('Performance measure failed:', error);
        return 0;
      }
    }
    return 0;
  },

  /**
   * Get current memory usage (if supported)
   */
  getMemoryUsage: () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }
    return null;
  }
};

export default usePerformanceMonitoring;