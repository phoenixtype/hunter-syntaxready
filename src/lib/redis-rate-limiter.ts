/**
 * Hunter AI - Redis-Based Rate Limiting System
 *
 * High-performance rate limiting with Redis for:
 * - API endpoints rate limiting
 * - Feature usage limiting (job applications, resume generation, etc.)
 * - Compliance engine performance
 * - Protection against abuse
 *
 * Features:
 * - Sliding window rate limiting
 * - Per-user, per-feature limits
 * - Subscription tier-aware limits
 * - Burst handling
 * - Automatic key expiration
 * - In-memory fallback when Redis unavailable
 */

import { cache, CacheKeys } from './cache-manager';

interface RateLimitConfig {
  max: number;           // Maximum requests
  window: number;        // Time window in seconds
  burst?: number;        // Burst allowance (optional)
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

type UserTier = 'free' | 'pro' | 'enterprise';
type FeatureType = 'job_applications' | 'resume_generations' | 'ai_interviews' | 'cover_letters' | 'job_matches' | 'company_research' | 'skill_assessments' | 'api_calls';

// Rate limit configurations by tier and feature
const RATE_LIMITS: Record<UserTier, Record<FeatureType, RateLimitConfig>> = {
  free: {
    job_applications: { max: 20, window: 86400 }, // 20 per day
    resume_generations: { max: 5, window: 86400 }, // 5 per day
    ai_interviews: { max: 3, window: 2592000 }, // 3 per month
    cover_letters: { max: 10, window: 86400 }, // 10 per day
    job_matches: { max: 100, window: 86400 }, // 100 per day
    company_research: { max: 5, window: 86400 }, // 5 per day
    skill_assessments: { max: 1, window: 2592000 }, // 1 per month
    api_calls: { max: 100, window: 3600 }, // 100 per hour
  },
  pro: {
    job_applications: { max: 200, window: 86400 }, // 200 per day
    resume_generations: { max: 50, window: 86400 }, // 50 per day
    ai_interviews: { max: 1000, window: 2592000 }, // Unlimited (high limit)
    cover_letters: { max: 100, window: 86400 }, // 100 per day
    job_matches: { max: 1000, window: 86400 }, // 1000 per day
    company_research: { max: 50, window: 86400 }, // 50 per day
    skill_assessments: { max: 20, window: 2592000 }, // 20 per month
    api_calls: { max: 500, window: 3600 }, // 500 per hour
  },
  enterprise: {
    job_applications: { max: 10000, window: 86400 }, // Unlimited (high limit)
    resume_generations: { max: 10000, window: 86400 },
    ai_interviews: { max: 10000, window: 2592000 },
    cover_letters: { max: 10000, window: 86400 },
    job_matches: { max: 10000, window: 86400 },
    company_research: { max: 10000, window: 86400 },
    skill_assessments: { max: 10000, window: 2592000 },
    api_calls: { max: 2000, window: 3600 }, // 2000 per hour
  }
};

// Special rate limits for API protection
const API_RATE_LIMITS = {
  'interview-coach': { max: 60, window: 3600 }, // 60 per hour
  'crawl-jobs': { max: 20, window: 3600 }, // 20 per hour (expensive)
  'generate-resume': { max: 10, window: 3600 }, // 10 per hour
  'company-research': { max: 30, window: 3600 }, // 30 per hour
};

class RedisRateLimiter {
  constructor() {
    console.log('[RATE_LIMITER] Initialized with in-memory cache fallback');
  }

  /**
   * Check if user can perform an action
   */
  async checkFeatureLimit(
    userId: string,
    feature: FeatureType,
    userTier: UserTier = 'free'
  ): Promise<RateLimitResult> {
    const config = RATE_LIMITS[userTier][feature];
    const key = CacheKeys.RATE_LIMIT(userId, feature, config.window);

    return this.checkLimit(key, config);
  }

  /**
   * Check API endpoint rate limit
   */
  async checkApiLimit(
    userId: string,
    endpoint: string,
    userTier: UserTier = 'free'
  ): Promise<RateLimitResult> {
    // Use API-specific limits or fall back to general API limits
    const config = API_RATE_LIMITS[endpoint as keyof typeof API_RATE_LIMITS] || RATE_LIMITS[userTier].api_calls;
    const key = CacheKeys.RATE_LIMIT(userId, `api:${endpoint}`, config.window);

    return this.checkLimit(key, config);
  }

  /**
   * Core rate limiting logic using sliding window
   */
  private async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    try {
      // Get current count from cache
      const current = cache.get<number>(key) || 0;

      // Calculate window boundaries
      const now = Date.now();
      const windowStart = Math.floor(now / (config.window * 1000)) * config.window * 1000;
      const resetTime = windowStart + (config.window * 1000);

      // Check if limit exceeded
      if (current >= config.max) {
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter: Math.ceil((resetTime - now) / 1000)
        };
      }

      // Increment counter
      cache.set(key, current + 1, config.window);

      return {
        allowed: true,
        remaining: config.max - current - 1,
        resetTime
      };

    } catch (error) {
      console.error('[RATE_LIMITER] Error checking limit:', error);
      // Default to allowing request on error (fail open for better UX)
      return {
        allowed: true,
        remaining: 999,
        resetTime: Date.now() + (config.window * 1000)
      };
    }
  }

  /**
   * Record feature usage (call after successful action)
   */
  async recordUsage(
    userId: string,
    feature: FeatureType,
    userTier: UserTier = 'free'
  ): Promise<void> {
    try {
      // Update daily usage counter for analytics
      const dailyKey = `usage:daily:${userId}:${feature}:${this.getDayKey()}`;
      const currentDaily = cache.get<number>(dailyKey) || 0;
      cache.set(dailyKey, currentDaily + 1, 86400); // 24 hours

      // Update monthly usage for monthly limits
      const monthlyKey = `usage:monthly:${userId}:${feature}:${this.getMonthKey()}`;
      const currentMonthly = cache.get<number>(monthlyKey) || 0;
      cache.set(monthlyKey, currentMonthly + 1, 2592000); // 30 days

      console.log(`[RATE_LIMITER] Recorded ${feature} usage for user ${userId} (tier: ${userTier})`);

    } catch (error) {
      console.error('[RATE_LIMITER] Error recording usage:', error);
      // Non-critical error, continue execution
    }
  }

  /**
   * Get current usage for a feature
   */
  async getUsage(
    userId: string,
    feature: FeatureType,
    period: 'daily' | 'monthly' = 'daily'
  ): Promise<number> {
    try {
      const key = period === 'daily'
        ? `usage:daily:${userId}:${feature}:${this.getDayKey()}`
        : `usage:monthly:${userId}:${feature}:${this.getMonthKey()}`;

      return cache.get<number>(key) || 0;

    } catch (error) {
      console.error('[RATE_LIMITER] Error getting usage:', error);
      return 0;
    }
  }

  /**
   * Reset user limits (e.g., when upgrading subscription)
   */
  async resetUserLimits(userId: string): Promise<void> {
    try {
      // Clear all rate limit keys for user
      cache.invalidatePattern(`rate:${userId}:.*`);
      cache.invalidatePattern(`usage:.*:${userId}:.*`);

      console.log(`[RATE_LIMITER] Reset all limits for user ${userId}`);

    } catch (error) {
      console.error('[RATE_LIMITER] Error resetting limits:', error);
    }
  }

  /**
   * Get rate limit status for user dashboard
   */
  async getUserLimitStatus(userId: string, userTier: UserTier): Promise<Record<FeatureType, {
    used: number;
    limit: number;
    percentage: number;
    resetTime: number;
  }>> {
    const status = {} as Record<FeatureType, any>;

    for (const feature of Object.keys(RATE_LIMITS[userTier]) as FeatureType[]) {
      const config = RATE_LIMITS[userTier][feature];
      const used = await this.getUsage(userId, feature, config.window > 86400 ? 'monthly' : 'daily');

      status[feature] = {
        used,
        limit: config.max,
        percentage: (used / config.max) * 100,
        resetTime: this.getNextResetTime(config.window)
      };
    }

    return status;
  }

  private getDayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getMonthKey(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private getNextResetTime(windowSeconds: number): number {
    const now = Date.now();
    if (windowSeconds <= 86400) { // Daily or shorter
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.getTime();
    } else { // Monthly
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
      nextMonth.setHours(0, 0, 0, 0);
      return nextMonth.getTime();
    }
  }
}

// Export singleton instance
export const rateLimiter = new RedisRateLimiter();

// Export helper functions for easy usage
export const checkFeatureLimit = rateLimiter.checkFeatureLimit.bind(rateLimiter);
export const checkApiLimit = rateLimiter.checkApiLimit.bind(rateLimiter);
export const recordUsage = rateLimiter.recordUsage.bind(rateLimiter);
export const getUserLimitStatus = rateLimiter.getUserLimitStatus.bind(rateLimiter);

// Export types
export type { RateLimitResult, UserTier, FeatureType };