/**
 * Hunter AI - Cached Job Engine
 *
 * Wraps existing job operations with intelligent caching to:
 * - Reduce database hits for job searches
 * - Cache expensive crawl operations
 * - Prevent unnecessary API calls to FireCrawl
 * - Speed up job matching and recommendations
 *
 * Features:
 * - Smart cache invalidation
 * - Incremental updates
 * - Background cache warming
 * - Cache-aside pattern
 * - Fallback to direct DB on cache miss
 */

import { supabase } from '@/integrations/supabase/client';
import { cache, CacheKeys, CacheTTL, invalidateJobsCache } from './cache-manager';
import type { Database } from '@/integrations/supabase/types';

type JobListing = Database['public']['Tables']['job_listings']['Row'];
type JobMatch = Database['public']['Tables']['job_matches']['Row'] & { job_listings?: JobListing };

interface SearchFilters {
  location?: string;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string[];
  experienceLevel?: string;
  company?: string;
}

interface CachedSearchResult {
  jobs: JobListing[];
  totalCount: number;
  page: number;
  hasMore: boolean;
  cachedAt: number;
}

interface CompanyCrawlResult {
  jobs: JobListing[];
  companyInfo: any;
  crawledAt: number;
  source: string;
}

class CachedJobEngine {

  /**
   * Search jobs with intelligent caching
   */
  async searchJobs(
    query: string,
    filters: SearchFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<CachedSearchResult> {
    // Create cache key from search parameters
    const searchKey = this.createSearchKey(query, filters, page, limit);
    const cacheKey = CacheKeys.JOBS_SEARCH(searchKey, page);

    // Try cache first
    const cached = cache.get<CachedSearchResult>(cacheKey);
    if (cached) {
      console.log(`[JOBS_CACHE] Cache hit for search: ${query}`);
      return cached;
    }

    console.log(`[JOBS_CACHE] Cache miss for search: ${query}, fetching from DB`);

    try {
      // Build database query
      let dbQuery = supabase
        .from('job_listings')
        .select('*', { count: 'exact' })
        .range((page - 1) * limit, page * limit - 1)
        .order('created_at', { ascending: false });

      // Apply filters
      if (query.trim()) {
        dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%,company.ilike.%${query}%`);
      }

      if (filters.location) {
        dbQuery = dbQuery.ilike('location', `%${filters.location}%`);
      }

      if (filters.company) {
        dbQuery = dbQuery.ilike('company', `%${filters.company}%`);
      }

      if (filters.jobType) {
        dbQuery = dbQuery.eq('job_type', filters.jobType);
      }

      if (filters.experienceLevel) {
        dbQuery = dbQuery.eq('experience_level', filters.experienceLevel);
      }

      if (filters.salaryMin) {
        dbQuery = dbQuery.gte('salary_min', filters.salaryMin);
      }

      if (filters.salaryMax) {
        dbQuery = dbQuery.lte('salary_max', filters.salaryMax);
      }

      const { data: jobs, error, count } = await dbQuery;

      if (error) {
        console.error('[JOBS_CACHE] Database query failed:', error);
        throw error;
      }

      const result: CachedSearchResult = {
        jobs: jobs || [],
        totalCount: count || 0,
        page,
        hasMore: (count || 0) > page * limit,
        cachedAt: Date.now()
      };

      // Cache the result (shorter TTL for searches to keep results fresh)
      cache.set(cacheKey, result, CacheTTL.SHORT);

      return result;

    } catch (error) {
      console.error('[JOBS_CACHE] Search failed:', error);
      throw error;
    }
  }

  /**
   * Get jobs by company with caching
   */
  async getJobsByCompany(
    company: string,
    limit: number = 50
  ): Promise<JobListing[]> {
    const cacheKey = CacheKeys.JOBS_COMPANY(company.toLowerCase());

    return cache.getOrCompute(
      cacheKey,
      async () => {
        console.log(`[JOBS_CACHE] Fetching jobs for company: ${company}`);

        const { data: jobs, error } = await supabase
          .from('job_listings')
          .select('*')
          .ilike('company', `%${company}%`)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('[JOBS_CACHE] Company jobs query failed:', error);
          throw error;
        }

        return jobs || [];
      },
      CacheTTL.LONG // Company jobs change less frequently
    );
  }

  /**
   * Get trending jobs with caching
   */
  async getTrendingJobs(limit: number = 20): Promise<JobListing[]> {
    const cacheKey = CacheKeys.JOBS_TRENDING();

    return cache.getOrCompute(
      cacheKey,
      async () => {
        console.log('[JOBS_CACHE] Fetching trending jobs');

        const { data: jobs, error } = await supabase
          .from('job_listings')
          .select('*')
          .order('freshness_score', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('[JOBS_CACHE] Trending jobs query failed:', error);
          throw error;
        }

        return jobs || [];
      },
      CacheTTL.MEDIUM // Trending changes every 30 minutes
    );
  }

  /**
   * Get job matches for user with caching.
   *
   * Only returns rows whose `matched_at` timestamp is within the last 12 hours.
   * Stale rows return [] so the caller (useJobs) falls through to a live
   * getMatchedJobsServerSide query instead of showing signup-era jobs forever.
   */
  async getJobMatches(
    userId: string,
    limit: number = 20
  ): Promise<JobMatch[]> {
    const cacheKey = `job_matches:${userId}:${limit}`;
    const cached = cache.get<JobMatch[]>(cacheKey);
    if (cached) return cached;

    try {
      // Only consider matches refreshed within the last 12 hours
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('job_matches')
        .select('*, job_listings(*)')
        .eq('user_id', userId)
        .gte('matched_at', twelveHoursAgo)   // ← freshness gate
        .order('match_score', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[JOBS_CACHE] job_matches query error:', error.message);
        return [];
      }

      const matches = data || [];
      // If no fresh matches, return empty array so useJobs falls through to live DB search
      if (matches.length === 0) {
        console.log('[JOBS_CACHE] No fresh job_matches within 12 h — falling through to live query');
        return [];
      }

      cache.set(cacheKey, matches, CacheTTL.SHORT);
      return matches;
    } catch (err) {
      console.warn('[JOBS_CACHE] getJobMatches failed:', err);
      return [];
    }
  }

  /**
   * Crawl and cache company jobs (expensive operation)
   */
  async crawlCompanyJobs(
    company: string,
    forceRefresh: boolean = false
  ): Promise<CompanyCrawlResult> {
    const cacheKey = CacheKeys.CRAWL_COMPANY(company.toLowerCase());

    // Check cache first unless forcing refresh
    if (!forceRefresh) {
      const cached = cache.get<CompanyCrawlResult>(cacheKey);
      if (cached) {
        // Only use cache if less than 6 hours old
        const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);
        if (cached.crawledAt > sixHoursAgo) {
          console.log(`[JOBS_CACHE] Using cached crawl for company: ${company}`);
          return cached;
        }
      }
    }

    console.log(`[JOBS_CACHE] Crawling fresh jobs for company: ${company}`);

    try {
      // Call the crawl-jobs edge function
      const { data, error } = await supabase.functions.invoke('crawl-jobs', {
        body: {
          company,
          mode: 'company_focused',
          limit: 50
        }
      });

      if (error) {
        console.error('[JOBS_CACHE] Crawl failed:', error);
        throw error;
      }

      const result: CompanyCrawlResult = {
        jobs: data.jobs || [],
        companyInfo: data.companyInfo || {},
        crawledAt: Date.now(),
        source: 'firecrawl'
      };

      // Cache for a long time since crawling is expensive
      cache.set(cacheKey, result, CacheTTL.VERY_LONG);

      return result;

    } catch (error) {
      console.error('[JOBS_CACHE] Company crawl failed:', error);

      // Fallback to cached data even if expired
      const fallback = cache.get<CompanyCrawlResult>(cacheKey);
      if (fallback) {
        console.log('[JOBS_CACHE] Using expired cache as fallback');
        return fallback;
      }

      throw error;
    }
  }

  /**
   * Invalidate job caches when new jobs are added
   */
  async invalidateJobCaches(): Promise<void> {
    console.log('[JOBS_CACHE] Invalidating job caches after update');

    // Clear search results (they'll be stale)
    invalidateJobsCache();

    // Clear trending jobs
    cache.delete(CacheKeys.JOBS_TRENDING());
    
    // Clear all job matches so the freshness gate is bypassed
    cache.invalidatePattern('job_matches:.*');

    console.log('[JOBS_CACHE] Cache invalidation complete');
  }

  /**
   * Completely clear all caches (used when user explicitly requests fresh jobs)
   */
  clearAllCaches(): void {
    console.log('[JOBS_CACHE] Force clearing all job caches completely');
    cache.invalidatePattern('jobs:.*');
    cache.invalidatePattern('job_matches:.*');
    cache.invalidatePattern('crawl:.*');
    // We could use cache.clear() but that might destroy user metadata caches.
    // Targeting jobs explicitly is safer.
  }

  /**
   * Warm up cache with common searches
   */
  async warmCache(): Promise<void> {
    console.log('[JOBS_CACHE] Starting cache warm-up');

    try {
      // Common search terms to pre-cache
      const commonSearches = [
        'software engineer',
        'product manager',
        'data scientist',
        'frontend developer',
        'backend developer',
        'marketing manager',
        'sales',
        'designer'
      ];

      // Warm up trending jobs
      await this.getTrendingJobs();

      // Warm up common searches
      for (const term of commonSearches) {
        await this.searchJobs(term, {}, 1, 10);
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('[JOBS_CACHE] Cache warm-up complete');

    } catch (error) {
      console.error('[JOBS_CACHE] Cache warm-up failed:', error);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return cache.getStats();
  }

  /**
   * Create a normalized cache key from search parameters
   */
  private createSearchKey(
    query: string,
    filters: SearchFilters,
    page: number,
    limit: number
  ): string {
    const normalized = {
      q: query.toLowerCase().trim(),
      ...filters,
      page,
      limit
    };

    // Sort keys for consistent cache keys
    const sortedKeys = Object.keys(normalized).sort();
    const keyParts = sortedKeys.map(key => `${key}:${(normalized as Record<string, any>)[key]}`);

    return keyParts.join('|');
  }
}

// Export singleton instance
export const cachedJobEngine = new CachedJobEngine();

// Export convenience methods
export const searchJobsCached = cachedJobEngine.searchJobs.bind(cachedJobEngine);
export const getJobsByCompanyCached = cachedJobEngine.getJobsByCompany.bind(cachedJobEngine);
export const getTrendingJobsCached = cachedJobEngine.getTrendingJobs.bind(cachedJobEngine);
export const getJobMatchesCached = cachedJobEngine.getJobMatches.bind(cachedJobEngine);
export const crawlCompanyJobsCached = cachedJobEngine.crawlCompanyJobs.bind(cachedJobEngine);

// Auto-warm cache on import (only in browser, not during SSR)
if (typeof window !== 'undefined') {
  // Delay warming to avoid blocking initial page load
  setTimeout(() => {
    cachedJobEngine.warmCache().catch(console.error);
  }, 5000);
}