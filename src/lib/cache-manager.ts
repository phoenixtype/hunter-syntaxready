/**
 * Hunter AI - High-Performance In-Memory Cache Manager
 *
 * Reduces database hits and API calls by caching:
 * - Job listings and search results
 * - Crawl/scrape results from FireCrawl
 * - API responses and computed data
 * - Rate limiting counters
 *
 * Features:
 * - TTL (Time To Live) expiration
 * - Memory usage monitoring
 * - Cache invalidation patterns
 * - LRU eviction when memory is full
 * - Statistics and debugging
 */

interface CacheEntry<T> {
  value: T;
  expiry: number;
  size: number;
  accessed: number;
  created: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  memoryUsage: number;
  entryCount: number;
}

type CacheKey = string;
type TTL = number; // seconds

class InMemoryCache {
  private cache = new Map<CacheKey, CacheEntry<any>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    memoryUsage: 0,
    entryCount: 0
  };

  private maxMemoryMB: number;
  private maxEntries: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: {
    maxMemoryMB?: number;
    maxEntries?: number;
    cleanupIntervalMs?: number;
  } = {}) {
    this.maxMemoryMB = options.maxMemoryMB || 100; // 100MB default
    this.maxEntries = options.maxEntries || 10000;

    // Auto-cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, options.cleanupIntervalMs || 5 * 60 * 1000);
  }

  /**
   * Get value from cache
   */
  get<T>(key: CacheKey): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.updateMemoryStats();
      this.stats.misses++;
      return null;
    }

    // Update access time for LRU
    entry.accessed = Date.now();
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache with TTL
   */
  set<T>(key: CacheKey, value: T, ttlSeconds: TTL = 300): void {
    const size = this.calculateSize(value);
    const expiry = Date.now() + (ttlSeconds * 1000);

    const entry: CacheEntry<T> = {
      value,
      expiry,
      size,
      accessed: Date.now(),
      created: Date.now()
    };

    // Check memory limits before adding
    if (this.shouldEvict(size)) {
      this.evictOldest();
    }

    this.cache.set(key, entry);
    this.updateMemoryStats();
  }

  /**
   * Delete specific key
   */
  delete(key: CacheKey): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateMemoryStats();
    }
    return deleted;
  }

  /**
   * Clear all entries matching pattern
   */
  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern);
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    this.updateMemoryStats();
    return deleted;
  }

  /**
   * Get or compute value (cache-aside pattern)
   */
  async getOrCompute<T>(
    key: CacheKey,
    computeFn: () => Promise<T>,
    ttlSeconds: TTL = 300
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const computed = await computeFn();
    this.set(key, computed, ttlSeconds);
    return computed;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number; avgEntrySize: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      avgEntrySize: this.stats.entryCount > 0 ? this.stats.memoryUsage / this.stats.entryCount : 0
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.memoryUsage = 0;
    this.stats.entryCount = 0;
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.updateMemoryStats();
    }

    return cleaned;
  }

  /**
   * LRU eviction when memory is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessed < oldestAccess) {
        oldestAccess = entry.accessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.updateMemoryStats();
    }
  }

  /**
   * Check if we should evict entries before adding new one
   */
  private shouldEvict(newEntrySize: number): boolean {
    const wouldExceedMemory = (this.stats.memoryUsage + newEntrySize) > (this.maxMemoryMB * 1024 * 1024);
    const wouldExceedEntries = this.stats.entryCount >= this.maxEntries;

    return wouldExceedMemory || wouldExceedEntries;
  }

  /**
   * Update memory usage statistics
   */
  private updateMemoryStats(): void {
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }

    this.stats.memoryUsage = totalSize;
    this.stats.entryCount = this.cache.size;
  }

  /**
   * Estimate memory size of value
   */
  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default 1KB for non-serializable
    }
  }

  /**
   * Cleanup on destruction
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// ─── Cache Instance & Key Patterns ────────────────────────────────────────

// Global cache instance
export const cache = new InMemoryCache({
  maxMemoryMB: 150, // 150MB for job data
  maxEntries: 50000,
  cleanupIntervalMs: 5 * 60 * 1000 // 5 minutes
});

// Cache key patterns for different data types
export const CacheKeys = {
  // Job listings
  JOBS_SEARCH: (query: string, page: number) => `jobs:search:${query}:${page}`,
  JOBS_COMPANY: (company: string) => `jobs:company:${company}`,
  JOBS_TRENDING: () => `jobs:trending`,

  // User data
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  USER_SUBSCRIPTION: (userId: string) => `user:subscription:${userId}`,
  USER_USAGE: (userId: string, feature: string) => `user:usage:${userId}:${feature}`,

  // Crawl results
  CRAWL_JOBS: (company: string, query: string) => `crawl:jobs:${company}:${query}`,
  CRAWL_COMPANY: (company: string) => `crawl:company:${company}`,

  // API responses
  API_FIRECRAWL: (url: string) => `api:firecrawl:${Buffer.from(url).toString('base64')}`,
  API_GEMINI: (prompt: string) => `api:gemini:${Buffer.from(prompt.slice(0, 100)).toString('base64')}`,

  // Rate limiting
  RATE_LIMIT: (userId: string, action: string, window: number) =>
    `rate:${userId}:${action}:${Math.floor(Date.now() / (window * 1000))}`,

  // Computed data
  DASHBOARD_STATS: (userId: string) => `dashboard:stats:${userId}`,
  RECRUITER_STATS: (recruiterId: string) => `recruiter:stats:${recruiterId}`,
  MATCHING_RESULTS: (userId: string, jobId: string) => `matching:${userId}:${jobId}`,
} as const;

// Cache TTL presets (in seconds)
export const CacheTTL = {
  SHORT: 5 * 60,        // 5 minutes - real-time data
  MEDIUM: 30 * 60,      // 30 minutes - user profiles, search results
  LONG: 2 * 60 * 60,    // 2 hours - job listings, company data
  VERY_LONG: 24 * 60 * 60, // 24 hours - computed analytics, trends
  RATE_LIMIT: 60,       // 1 minute - rate limiting windows
} as const;

// ─── Utility Functions ────────────────────────────────────────────────────

/**
 * Clear cache entries for a specific user (e.g., when they update profile)
 */
export const invalidateUserCache = (userId: string): number => {
  return cache.invalidatePattern(`user:.*:${userId}`);
};

/**
 * Clear job-related cache (e.g., when new jobs are crawled)
 */
export const invalidateJobsCache = (): number => {
  return cache.invalidatePattern(`jobs:.*`);
};

/**
 * Clear company-specific cache
 */
export const invalidateCompanyCache = (company: string): number => {
  return cache.invalidatePattern(`:${company}(:.*)?$`);
};

/**
 * Get cache health status
 */
export const getCacheHealth = () => {
  const stats = cache.getStats();
  const health = {
    status: 'healthy' as 'healthy' | 'warning' | 'critical',
    ...stats,
    memoryUsageMB: stats.memoryUsage / (1024 * 1024),
    recommendations: [] as string[]
  };

  // Health checks
  if (health.hitRate < 0.7) {
    health.status = 'warning';
    health.recommendations.push('Low hit rate - consider longer TTL for frequently accessed data');
  }

  if (health.memoryUsageMB > 120) {
    health.status = 'warning';
    health.recommendations.push('High memory usage - consider reducing max memory or TTL');
  }

  if (health.evictions > health.entryCount * 0.1) {
    health.status = 'critical';
    health.recommendations.push('High eviction rate - increase memory limit or reduce cache usage');
  }

  return health;
};

// Export for cleanup on app shutdown
export const destroyCache = () => cache.destroy();

console.log('[CACHE] In-memory cache manager initialized');