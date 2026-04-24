/**
 * JSearch API Optimizer
 *
 * Reduces API credit consumption through intelligent query optimization,
 * caching, deduplication, and strategic job fetching based on user profiles.
 */

interface CachedResult {
  data: any[];
  timestamp: number;
  queryHash: string;
}

interface UserProfile {
  targetRoles: string[];
  locations: string[];
  remotePolicy: string;
  keywords: string[];
  experienceLevel: string;
  salaryRange?: { min?: number; max?: number };
}

interface OptimizedQuery {
  query: string;
  priority: number;
  estimatedRelevance: number;
  cacheKey: string;
}

class JSearchOptimizer {
  private cache = new Map<string, CachedResult>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_QUERIES_PER_REQUEST = 2; // Reduced from 5
  private readonly MAX_PAGES_PER_QUERY = 1; // Reduced from 2
  private readonly MIN_QUERY_INTERVAL = 2000; // 2 seconds between queries

  private lastQueryTime = 0;
  private dailyQuotaUsed = 0;
  private readonly DAILY_QUOTA_LIMIT = 100; // Conservative daily limit

  /**
   * Generate optimized queries based on user profile
   */
  generateOptimizedQueries(userProfile: UserProfile): OptimizedQuery[] {
    const queries: OptimizedQuery[] = [];

    // Primary role with location (highest priority)
    if (userProfile.targetRoles.length > 0 && userProfile.locations.length > 0) {
      const primaryRole = userProfile.targetRoles[0];
      const primaryLocation = userProfile.locations[0];
      const locationStr = userProfile.remotePolicy === 'remote' ? 'remote' : primaryLocation;

      const query = `${primaryRole} ${locationStr}`;
      queries.push({
        query: query.trim(),
        priority: 1,
        estimatedRelevance: 0.9,
        cacheKey: this.generateCacheKey(query, userProfile.remotePolicy === 'remote')
      });
    }

    // Fallback: Primary role without location if we have quota
    if (queries.length < this.MAX_QUERIES_PER_REQUEST && userProfile.targetRoles.length > 0) {
      const primaryRole = userProfile.targetRoles[0];
      const keywordsStr = userProfile.keywords.slice(0, 2).join(' ');
      const query = keywordsStr ? `${primaryRole} ${keywordsStr}` : primaryRole;

      const cacheKey = this.generateCacheKey(query, userProfile.remotePolicy === 'remote');

      // Avoid duplicate queries
      if (!queries.some(q => q.cacheKey === cacheKey)) {
        queries.push({
          query: query.trim(),
          priority: 2,
          estimatedRelevance: 0.7,
          cacheKey
        });
      }
    }

    // Sort by priority and relevance
    return queries
      .sort((a, b) => a.priority - b.priority || b.estimatedRelevance - a.estimatedRelevance)
      .slice(0, this.MAX_QUERIES_PER_REQUEST);
  }

  /**
   * Check if we have cached results for a query
   */
  getCachedResults(cacheKey: string): any[] | null {
    const cached = this.cache.get(cacheKey);

    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(cacheKey);
      return null;
    }

    console.log(`[JSEARCH_OPTIMIZER] Cache hit for ${cacheKey}`);
    return cached.data;
  }

  /**
   * Cache API results
   */
  setCachedResults(cacheKey: string, data: any[], queryHash: string): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      queryHash
    });
  }

  /**
   * Check if we can make an API call (quota and rate limiting)
   */
  canMakeApiCall(): { allowed: boolean; reason?: string } {
    // Check daily quota
    if (this.dailyQuotaUsed >= this.DAILY_QUOTA_LIMIT) {
      return { allowed: false, reason: 'Daily quota exceeded' };
    }

    // Check rate limiting
    const timeSinceLastQuery = Date.now() - this.lastQueryTime;
    if (timeSinceLastQuery < this.MIN_QUERY_INTERVAL) {
      return { allowed: false, reason: 'Rate limit - too frequent' };
    }

    return { allowed: true };
  }

  /**
   * Execute optimized search with intelligent query selection
   */
  async executeOptimizedSearch(
    userProfile: UserProfile,
    jsearchApiCall: (query: string, remoteOnly: boolean) => Promise<any[]>
  ): Promise<{ jobs: any[]; queriesUsed: number; cacheHits: number; quotaRemaining: number }> {
    const optimizedQueries = this.generateOptimizedQueries(userProfile);
    const allJobs: any[] = [];
    const seenJobIds = new Set<string>();
    let queriesUsed = 0;
    let cacheHits = 0;

    console.log(`[JSEARCH_OPTIMIZER] Planning ${optimizedQueries.length} optimized queries`);

    for (const optimizedQuery of optimizedQueries) {
      // Check cache first
      const cachedJobs = this.getCachedResults(optimizedQuery.cacheKey);
      if (cachedJobs) {
        cacheHits++;
        this.addUniqueJobs(cachedJobs, allJobs, seenJobIds);
        continue;
      }

      // Check if we can make API call
      const { allowed, reason } = this.canMakeApiCall();
      if (!allowed) {
        console.warn(`[JSEARCH_OPTIMIZER] Skipping query: ${reason}`);
        break;
      }

      try {
        // Rate limiting delay
        await this.enforceRateLimit();

        console.log(`[JSEARCH_OPTIMIZER] Executing query: "${optimizedQuery.query}"`);

        const jobs = await jsearchApiCall(
          optimizedQuery.query,
          userProfile.remotePolicy === 'remote'
        );

        // Update tracking
        queriesUsed++;
        this.dailyQuotaUsed++;
        this.lastQueryTime = Date.now();

        // Cache results
        this.setCachedResults(
          optimizedQuery.cacheKey,
          jobs,
          optimizedQuery.query
        );

        // Add unique jobs
        this.addUniqueJobs(jobs, allJobs, seenJobIds);

      } catch (error) {
        console.error(`[JSEARCH_OPTIMIZER] Query failed:`, error);
        // Don't break on individual query failures
      }
    }

    return {
      jobs: allJobs,
      queriesUsed,
      cacheHits,
      quotaRemaining: this.DAILY_QUOTA_LIMIT - this.dailyQuotaUsed
    };
  }

  /**
   * Filter jobs based on user profile relevance
   */
  filterJobsByRelevance(jobs: any[], userProfile: UserProfile): any[] {
    return jobs
      .map(job => ({
        ...job,
        relevanceScore: this.calculateRelevanceScore(job, userProfile)
      }))
      .filter(job => job.relevanceScore > 0.3) // Only keep relevant jobs
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calculate relevance score based on user profile
   */
  private calculateRelevanceScore(job: any, userProfile: UserProfile): number {
    let score = 0.5; // Base score

    // Role matching
    const jobTitle = String(job.title || '').toLowerCase();
    const roleMatch = userProfile.targetRoles.some(role =>
      jobTitle.includes(role.toLowerCase()) ||
      role.toLowerCase().split(' ').some(word => jobTitle.includes(word))
    );
    if (roleMatch) score += 0.3;

    // Location matching
    const jobLocation = String(job.location || '').toLowerCase();
    if (userProfile.remotePolicy === 'remote' && jobLocation.includes('remote')) {
      score += 0.2;
    } else if (userProfile.locations.some(loc =>
      jobLocation.includes(loc.toLowerCase()) || loc.toLowerCase().includes(jobLocation)
    )) {
      score += 0.2;
    }

    // Keywords matching
    const jobDescription = String(job.description || '').toLowerCase();
    const keywordMatches = userProfile.keywords.filter(keyword =>
      jobDescription.includes(keyword.toLowerCase()) || jobTitle.includes(keyword.toLowerCase())
    ).length;
    score += (keywordMatches / Math.max(userProfile.keywords.length, 1)) * 0.2;

    // Salary matching
    if (userProfile.salaryRange && job.salary_min) {
      const jobSalary = parseInt(job.salary_min);
      if (userProfile.salaryRange.min && jobSalary >= userProfile.salaryRange.min) {
        score += 0.1;
      }
      if (userProfile.salaryRange.max && jobSalary <= userProfile.salaryRange.max) {
        score += 0.1;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Add unique jobs to results array
   */
  private addUniqueJobs(newJobs: any[], allJobs: any[], seenJobIds: Set<string>): void {
    for (const job of newJobs) {
      const jobId = job.job_id || `${job.title}-${job.company}`.toLowerCase();
      if (!seenJobIds.has(jobId)) {
        seenJobIds.add(jobId);
        allJobs.push(job);
      }
    }
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(query: string, remoteOnly: boolean): string {
    const normalized = query.toLowerCase().trim().replace(/\s+/g, '-');
    return `jsearch:${normalized}:remote-${remoteOnly}`;
  }

  /**
   * Enforce rate limiting between API calls
   */
  private async enforceRateLimit(): Promise<void> {
    const timeSinceLastQuery = Date.now() - this.lastQueryTime;
    if (timeSinceLastQuery < this.MIN_QUERY_INTERVAL) {
      const delay = this.MIN_QUERY_INTERVAL - timeSinceLastQuery;
      console.log(`[JSEARCH_OPTIMIZER] Rate limiting: waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get optimizer statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      dailyQuotaUsed: this.dailyQuotaUsed,
      quotaRemaining: this.DAILY_QUOTA_LIMIT - this.dailyQuotaUsed,
      maxQueriesPerRequest: this.MAX_QUERIES_PER_REQUEST,
      maxPagesPerQuery: this.MAX_PAGES_PER_QUERY
    };
  }

  /**
   * Reset daily quota (call once per day)
   */
  resetDailyQuota(): void {
    this.dailyQuotaUsed = 0;
    console.log('[JSEARCH_OPTIMIZER] Daily quota reset');
  }
}

/**
 * Daily crawl quota management for different user tiers and search types
 */
export interface DailyQuotaConfig {
  automated: {
    free: number;
    pro: number;
    enterprise: number;
  };
  manual: {
    free: number;
    pro: number;
    enterprise: number;
  };
}

export const DAILY_QUOTA_CONFIG: DailyQuotaConfig = {
  automated: {
    free: 1,      // 1 broad automated crawl per day
    pro: 1,       // 1 broad automated crawl per day
    enterprise: 2 // 2 broad automated crawls per day
  },
  manual: {
    free: 0,      // No manual searches for free users
    pro: 3,       // 3 manual targeted searches per day
    enterprise: 10 // 10 manual targeted searches per day
  }
};

class DailyQuotaManager {
  private quotaUsage = new Map<string, { automated: number; manual: number; date: string }>();

  /**
   * Check if user can perform a search
   */
  canPerformSearch(
    userId: string,
    searchType: 'automated' | 'manual',
    userTier: 'free' | 'pro' | 'enterprise' = 'free'
  ): { allowed: boolean; remaining: number; reason?: string } {
    const today = new Date().toISOString().split('T')[0];
    const userUsage = this.getUserUsage(userId, today);

    const limit = DAILY_QUOTA_CONFIG[searchType][userTier];
    const used = userUsage[searchType];
    const remaining = Math.max(0, limit - used);

    if (used >= limit) {
      const reason = searchType === 'manual' && userTier === 'free'
        ? 'Manual job searches require a Pro subscription'
        : `Daily ${searchType} search limit reached (${limit}/${limit})`;

      return { allowed: false, remaining: 0, reason };
    }

    return { allowed: true, remaining };
  }

  /**
   * Record a search usage
   */
  recordUsage(
    userId: string,
    searchType: 'automated' | 'manual'
  ): void {
    const today = new Date().toISOString().split('T')[0];
    const userUsage = this.getUserUsage(userId, today);

    userUsage[searchType]++;
    this.quotaUsage.set(userId, { ...userUsage, date: today });

    console.log(`[QUOTA] User ${userId} used ${searchType} search. Remaining: automated=${DAILY_QUOTA_CONFIG.automated.pro - userUsage.automated}, manual=${DAILY_QUOTA_CONFIG.manual.pro - userUsage.manual}`);
  }

  /**
   * Get user's current usage
   */
  getUserUsage(userId: string, date: string): { automated: number; manual: number; date: string } {
    const existing = this.quotaUsage.get(userId);

    // Reset if it's a new day
    if (!existing || existing.date !== date) {
      return { automated: 0, manual: 0, date };
    }

    return existing;
  }

  /**
   * Get user's quota status
   */
  getQuotaStatus(
    userId: string,
    userTier: 'free' | 'pro' | 'enterprise' = 'free'
  ): {
    automated: { used: number; limit: number; remaining: number };
    manual: { used: number; limit: number; remaining: number };
  } {
    const today = new Date().toISOString().split('T')[0];
    const usage = this.getUserUsage(userId, today);

    return {
      automated: {
        used: usage.automated,
        limit: DAILY_QUOTA_CONFIG.automated[userTier],
        remaining: Math.max(0, DAILY_QUOTA_CONFIG.automated[userTier] - usage.automated)
      },
      manual: {
        used: usage.manual,
        limit: DAILY_QUOTA_CONFIG.manual[userTier],
        remaining: Math.max(0, DAILY_QUOTA_CONFIG.manual[userTier] - usage.manual)
      }
    };
  }

  /**
   * Reset all quotas (for testing or manual reset)
   */
  resetAllQuotas(): void {
    this.quotaUsage.clear();
    console.log('[QUOTA] All quotas reset');
  }
}

// Export singleton instances
export const jsearchOptimizer = new JSearchOptimizer();
export const dailyQuotaManager = new DailyQuotaManager();
export { UserProfile, OptimizedQuery };